# ⚡ AWS EC2 Quick Reference - CtrlChecks Backend

**Quick copy-paste commands for CtrlChecks backend deployment on AWS EC2.**

---

## 🚀 Quick Setup (Copy-Paste All)

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget python3-pip python3-venv build-essential

# 2. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 3. Pull models
ollama pull qwen2.5:7b
ollama pull llama3:8b
ollama pull mistral:7b

# 4. Setup Python backend
mkdir -p ~/ctrlchecks-backend && cd ~/ctrlchecks-backend
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip
pip install fastapi==0.104.1 uvicorn[standard]==0.24.0 pydantic==2.5.0 python-multipart==0.0.6

# 5. Create main.py (see full guide for content)
# Copy main.py from AWS_EC2_DEPLOYMENT_GUIDE.md Phase 4.3

# 6. Test backend
uvicorn main:app --host 0.0.0.0 --port 8000 &
curl http://localhost:8000/health

# 7. Setup systemd (see full guide for service file)
# Copy service file from AWS_EC2_DEPLOYMENT_GUIDE.md Phase 6.1

# 8. Install Cloudflare tunnel
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
cloudflared tunnel --url http://localhost:8000
```

---

## 📝 Essential Commands

### SSH Connection
```bash
# Linux/Mac
ssh -i ~/Downloads/ctrlchecks-key.pem ubuntu@YOUR_PUBLIC_IP

# Windows PowerShell
ssh -i ctrlchecks-key.pem ubuntu@YOUR_PUBLIC_IP
```

### Service Management
```bash
# Start service
sudo systemctl start ctrlchecks

# Stop service
sudo systemctl stop ctrlchecks

# Restart service
sudo systemctl restart ctrlchecks

# Check status
sudo systemctl status ctrlchecks

# View logs
sudo journalctl -u ctrlchecks -f
```

### Ollama Commands
```bash
# List models
ollama list

# Test model
ollama run qwen2.5:7b "Hello"

# Pull model
ollama pull qwen2.5:7b

# Warm up model
echo "" | ollama run qwen2.5:7b
```

### API Testing
```bash
# Health check
curl http://localhost:8000/health

# Test workflow endpoint
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is AI?","model":"qwen2.5:7b"}'

# Test process endpoint
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"task":"summarize","input":"Machine learning is AI."}'
```

### Monitoring
```bash
# Check GPU (if GPU instance)
nvidia-smi

# Check resources
htop
free -h
df -h

# Check port
sudo netstat -tlnp | grep 8000
```

---

## 🔧 Troubleshooting Quick Fixes

```bash
# Service not starting
sudo systemctl daemon-reload
sudo systemctl restart ctrlchecks
sudo journalctl -u ctrlchecks -n 50

# Port not accessible
sudo ufw allow 8000
sudo netstat -tlnp | grep 8000

# Ollama not working
sudo systemctl restart ollama
ollama list

# Out of memory
free -h
# Consider upgrading instance or reducing model size
```

---

## 🌐 Vercel Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
VITE_PYTHON_BACKEND_URL=https://your-cloudflare-url.trycloudflare.com
VITE_USE_DIRECT_BACKEND=true
```

---

## ✅ Verification Checklist

```bash
# 1. Ollama models
ollama list
# ✓ Should show 3 models

# 2. Backend health
curl http://localhost:8000/health
# ✓ Should return {"status": "healthy"}

# 3. Service status
sudo systemctl status ctrlchecks
# ✓ Should show "active (running)"

# 4. Test API
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","model":"qwen2.5:7b"}'
# ✓ Should return {"success": true, ...}

# 5. Cloudflare tunnel
curl https://your-url.trycloudflare.com/health
# ✓ Should return {"status": "healthy"}
```

---

## 📋 AWS EC2 Instance Types

| Users | Instance | vCPUs | RAM | GPU | Cost/Hour |
|-------|-----------|-------|-----|-----|-----------|
| 100 | g4dn.xlarge | 4 | 16 GB | T4 (16 GB) | ~$0.526 |
| 200 | g5.xlarge | 4 | 16 GB | A10G (24 GB) | ~$1.006 |

---

## 🔐 Security Group Rules

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | SSH access |
| Custom TCP | 8000 | 0.0.0.0/0 | FastAPI backend |
| Custom TCP | 11434 | Your IP (optional) | Ollama direct |

---

## 📚 Full Documentation

See `AWS_EC2_DEPLOYMENT_GUIDE.md` for complete step-by-step instructions.

---

**Quick Start Time:** ~30-45 minutes  
**Cost:** ~$400-500/month (g4dn.xlarge, 24/7)  
**Support:** Check full guide for troubleshooting

