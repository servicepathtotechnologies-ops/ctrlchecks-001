# 🔗 CtrlChecks AWS EC2 Integration Architecture

**Visual guide showing how the Vercel frontend connects to AWS EC2 backend.**

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL FRONTEND                          │
│  (React + TypeScript + Vite)                                    │
│  https://your-app.vercel.app                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS Request
                             │ VITE_PYTHON_BACKEND_URL
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE TUNNEL                            │
│  https://ctrlchecks-abc123.trycloudflare.com                    │
│  (Public URL - Exposes EC2 to Internet)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Proxy
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS EC2 INSTANCE                           │
│  g4dn.xlarge (4 vCPU, 16 GB RAM, T4 GPU)                        │
│  Public IP: 54.123.45.67                                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              FASTAPI BACKEND (Port 8000)                 │   │
│  │  - /health          → Health check                       │   │
│  │  - /run             → Ollama workflow execution          │   │
│  │  - /process         → Multimodal processing              │   │
│  │  - /api/agent/execute → Unified agent endpoint           │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│                         │ subprocess.run(["ollama", "run", ...])│
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    OLLAMA SERVICE                        │   │
│  │  - qwen2.5:7b    (4.7 GB)                                │   │
│  │  - llama3:8b    (4.7 GB)                                 │   │ 
│  │  - mistral:7b    (4.1 GB)                                │   │
│  └──────────────────────────────────────────────────────────┘   │ 
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SYSTEMD SERVICE (Auto-start)                │   │
│  │  Service: ctrlchecks.service                             │   │
│  │  Auto-restart: Enabled                                   │   │
│  │  Start on boot: Enabled                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow

### 1. Frontend Request (Vercel)

**Component:** `ImageProcessing.tsx` or `TextProcessing.tsx`

```typescript
// Environment variables from Vercel
const PYTHON_BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL;
// Example: https://ctrlchecks-abc123.trycloudflare.com

const USE_DIRECT_BACKEND = import.meta.env.VITE_USE_DIRECT_BACKEND === 'true';
// Set to: true

// API Call
const response = await fetch(`${PYTHON_BACKEND_URL}/process`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'summarize',
    input: 'Machine learning is transforming industries...'
  })
});
```

### 2. Cloudflare Tunnel (Public Gateway)

```
Frontend Request
  ↓
https://ctrlchecks-abc123.trycloudflare.com/process
  ↓
Cloudflare Tunnel (cloudflared)
  ↓
HTTP Proxy to EC2
  ↓
http://localhost:8000/process
```

### 3. FastAPI Backend (EC2)

```python
@app.post("/process")
async def process_task(request: ProcessRequest):
    # Map task to Ollama prompt
    prompt = f"Summarize: {request.input}"
    
    # Call Ollama via subprocess
    response = run_ollama("qwen2.5:7b", prompt)
    
    return {
        "success": True,
        "output": response,
        "model_used": "qwen2.5:7b"
    }
```

### 4. Ollama Processing (EC2)

```bash
# FastAPI executes:
ollama run qwen2.5:7b "Summarize: Machine learning..."

# Ollama returns:
"Machine learning is a subset of artificial intelligence..."
```

### 5. Response Flow

```
Ollama Response
  ↓
FastAPI Backend
  ↓
Cloudflare Tunnel
  ↓
Vercel Frontend
  ↓
User sees result
```

---

## 🔧 Configuration Points

### Vercel Environment Variables

**Location:** Vercel Dashboard → Settings → Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_PYTHON_BACKEND_URL` | `https://ctrlchecks-abc123.trycloudflare.com` | Backend API URL |
| `VITE_USE_DIRECT_BACKEND` | `true` | Bypass Edge Functions |

### AWS EC2 Security Group

**Location:** AWS Console → EC2 → Security Groups

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | Your IP | SSH access |
| Custom TCP | 8000 | 0.0.0.0/0 | FastAPI backend |

### EC2 Systemd Service

**Location:** `/etc/systemd/system/ctrlchecks.service`

```ini
[Service]
ExecStart=/home/ubuntu/ctrlchecks-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
```

---

## 📡 API Endpoints

### Health Check
```
GET https://your-backend-url/health

Response:
{
  "status": "healthy",
  "ollama": "running",
  "models_available": ["qwen2.5:7b", "llama3:8b", "mistral:7b"]
}
```

### Workflow Execution (Ollama)
```
POST https://your-backend-url/run

Request:
{
  "prompt": "What is machine learning?",
  "model": "qwen2.5:7b"
}

Response:
{
  "success": true,
  "model": "qwen2.5:7b",
  "response": "Machine learning is...",
  "latency": 2.34
}
```

### Multimodal Processing (Frontend Compatible)
```
POST https://your-backend-url/process

Request:
{
  "task": "summarize",
  "input": "Long text to summarize..."
}

Response:
{
  "success": true,
  "output": "Summary text...",
  "model_used": "qwen2.5:7b",
  "processing_time": 1.23
}
```

### Agent Execution (Unified)
```
POST https://your-backend-url/api/agent/execute

Request:
{
  "task": "qa",
  "question": "What is AI?",
  "context": "AI is..."
}

Response:
{
  "success": true,
  "output": "AI is...",
  "model_used": "qwen2.5:7b"
}
```

---

## 🔐 Security Flow

```
1. User → Vercel Frontend (HTTPS)
   ↓
2. Frontend → Cloudflare Tunnel (HTTPS)
   ↓
3. Cloudflare → EC2 (HTTP internal)
   ↓
4. EC2 FastAPI (CORS enabled)
   ↓
5. EC2 Ollama (local subprocess)
```

**Security Features:**
- ✅ HTTPS via Cloudflare tunnel
- ✅ CORS middleware in FastAPI
- ✅ Security group restricts SSH to your IP
- ✅ Systemd service runs as non-root user
- ✅ No direct EC2 IP exposure (via Cloudflare)

---

## 🚀 Deployment Checklist

### AWS EC2 Setup
- [ ] Request GPU quota (24-48 hours)
- [ ] Launch EC2 instance (g4dn.xlarge)
- [ ] Create and download key pair
- [ ] Configure security group (ports 22, 8000)
- [ ] SSH to instance

### Backend Installation
- [ ] Update system packages
- [ ] Install Ollama
- [ ] Pull models (qwen2.5:7b, llama3:8b, mistral:7b)
- [ ] Setup Python virtual environment
- [ ] Install FastAPI dependencies
- [ ] Create main.py
- [ ] Test backend locally

### Auto-Start Setup
- [ ] Create systemd service file
- [ ] Enable and start service
- [ ] Verify service starts on boot
- [ ] Test service restart

### Internet Exposure
- [ ] Install Cloudflare tunnel
- [ ] Run tunnel and get public URL
- [ ] Test public URL access
- [ ] (Optional) Setup persistent tunnel

### Frontend Integration
- [ ] Add Vercel environment variables
- [ ] Set VITE_PYTHON_BACKEND_URL
- [ ] Set VITE_USE_DIRECT_BACKEND=true
- [ ] Redeploy Vercel frontend
- [ ] Test integration from frontend

### Verification
- [ ] Test /health endpoint
- [ ] Test /run endpoint
- [ ] Test /process endpoint
- [ ] Test from Vercel frontend
- [ ] Monitor logs and performance

---

## 📊 Performance Metrics

### Expected Latency

| Task | Model | Expected Time |
|------|-------|---------------|
| Text summarization | qwen2.5:7b | 1-3 seconds |
| Translation | qwen2.5:7b | 1-3 seconds |
| Q&A | llama3:8b | 2-4 seconds |
| Chat | mistral:7b | 1-3 seconds |

### Resource Usage (g4dn.xlarge)

| Resource | Usage | Limit |
|----------|-------|-------|
| CPU | 20-40% | 4 vCPUs |
| RAM | 8-12 GB | 16 GB |
| GPU VRAM | 4-8 GB | 16 GB |
| Storage | ~20 GB | 200 GB |

---

## 🔄 Update Flow

### Backend Update Process

```bash
# 1. SSH to EC2
ssh -i key.pem ubuntu@IP

# 2. Update code
cd ~/ctrlchecks-backend
git pull  # If using git
# Or edit main.py directly

# 3. Restart service
sudo systemctl restart ctrlchecks

# 4. Verify
curl http://localhost:8000/health
```

### Model Update Process

```bash
# 1. Pull new model version
ollama pull qwen2.5:7b

# 2. Update main.py if needed
# Change model name in code

# 3. Restart service
sudo systemctl restart ctrlchecks
```

### Frontend Update Process

1. Update environment variables in Vercel (if backend URL changes)
2. Commit and push code changes
3. Vercel auto-deploys
4. Test integration

---

## 🐛 Common Issues & Solutions

### Issue: Frontend can't reach backend

**Symptoms:**
- CORS errors in browser
- Network errors
- Timeout errors

**Solutions:**
1. Check Cloudflare tunnel is running: `ps aux | grep cloudflared`
2. Verify backend is running: `curl http://localhost:8000/health`
3. Check Vercel env vars are set correctly
4. Verify security group allows port 8000

### Issue: Slow responses

**Symptoms:**
- Requests take >10 seconds
- Timeout errors

**Solutions:**
1. Warm up models: `echo "" | ollama run qwen2.5:7b`
2. Check EC2 instance CPU/RAM usage: `htop`
3. Consider upgrading instance type
4. Implement request queue for concurrency

### Issue: Service not starting

**Symptoms:**
- `systemctl status ctrlchecks` shows failed
- No response on port 8000

**Solutions:**
1. Check logs: `sudo journalctl -u ctrlchecks -n 50`
2. Verify Python path in service file
3. Check virtual environment exists
4. Verify main.py syntax: `python3 -m py_compile main.py`

---

## 📚 Related Documentation

- **Full Setup Guide:** `AWS_EC2_DEPLOYMENT_GUIDE.md`
- **Quick Reference:** `AWS_EC2_QUICK_REFERENCE.md`
- **Frontend Integration:** See `src/components/multimodal/ImageProcessing.tsx`
- **Backend Code:** See `AI_Agent/multimodal_backend/main.py`

---

**Last Updated:** 2024  
**Version:** 1.0.0

