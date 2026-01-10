# 🚀 Complete AWS EC2 Deployment Guide for CtrlChecks Backend

**Complete step-by-step guide to deploy CtrlChecks AI backend on AWS EC2 with Ollama integration and Vercel frontend connection.**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: AWS EC2 Setup](#phase-1-aws-ec2-setup)
3. [Phase 2: Connect to EC2](#phase-2-connect-to-ec2)
4. [Phase 3: Install Ollama & Models](#phase-3-install-ollama--models)
5. [Phase 4: Setup Python Backend](#phase-4-setup-python-backend)
6. [Phase 5: Run and Test Backend](#phase-5-run-and-test-backend)
7. [Phase 6: Setup Auto-Start](#phase-6-setup-auto-start)
8. [Phase 7: Expose to Internet](#phase-7-expose-to-internet)
9. [Phase 8: Vercel Frontend Integration](#phase-8-vercel-frontend-integration)
10. [Troubleshooting](#troubleshooting)
11. [Quick Command Reference](#quick-command-reference)

---

## Prerequisites

- AWS Account (with credit card for free tier)
- SSH client (Windows: PowerShell/Terminal, Mac/Linux: Terminal)
- Basic knowledge of Linux commands
- Your CtrlChecks frontend codebase

---

## Phase 1: AWS EC2 Setup

### Step 1.1: Create AWS Account (If Needed)

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Sign up (requires credit card, but you get 12 months free tier)
3. Enable MFA for security

### Step 1.2: Request GPU Quota (IMPORTANT)

⚠️ **CRITICAL:** GPU instances require quota approval. Do this first!

1. Open AWS Console
2. Go to **Service Quotas** (search in top bar)
3. Search for **"Running On-Demand G instances"**
4. Request quota increase to at least **4 vCPUs**
5. ⏰ **Wait 24-48 hours for approval** (don't skip this!)

### Step 1.3: Launch EC2 Instance

1. Go to **EC2 Dashboard**
2. Click **Launch Instance**

**Name:** `ctrlchecks-backend`

### Step 1.4: Choose AMI (Operating System)

**Amazon Machine Image (AMI):**
- **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
- AMI ID: `ami-0c7217cdde317cfec` (us-east-1) or select from list

### Step 1.5: Choose Instance Type (CRITICAL CHOICE)

Based on your user target:

| Users | Instance Type | vCPUs | RAM | GPU | Storage |
|-------|--------------|-------|-----|-----|---------|
| 100 users | `g4dn.xlarge` | 4 | 16 GB | 1 x T4 (16 GB VRAM) | 125 GB SSD |
| 200 users | `g5.xlarge` | 4 | 16 GB | 1 x A10G (24 GB VRAM) | 250 GB SSD |

**Select from dropdown:**
```
Instance Type: g4dn.xlarge
- vCPUs: 4
- RAM: 16 GB
- GPU: 1 x T4 (16 GB VRAM)
- Storage: 125 GB SSD
```

### Step 1.6: Create Key Pair (For SSH Access)

1. Click **Create new key pair**
2. **Name:** `ctrlchecks-key`
3. **Key pair type:** RSA
4. **Private key format:** `.pem`
5. Click **Create key pair**
6. ⚠️ **Download and save the `.pem` file securely** (you'll need it to SSH)

### Step 1.7: Configure Network Settings

**Network settings:**
- **VPC:** Default VPC
- **Subnet:** Any availability zone
- **Auto-assign public IP:** Enable
- **Security groups:** Create new security group

**Security group rules (Inbound):**

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | My IP | For SSH access |
| Custom TCP | 8000 | 0.0.0.0/0 | FastAPI backend |
| Custom TCP | 11434 | Your IP (optional) | Ollama direct access |

### Step 1.8: Configure Storage

**Storage (Volumes):**
- **Root volume:** 200 GB gp3
- **Delete on termination:** ☑ Yes

### Step 1.9: Launch Instance

1. Click **Launch Instance**
2. ⏰ Wait 2-3 minutes for instance to be **Running**
3. **Note the Public IPv4 address** (e.g., `54.123.45.67`)

---

## Phase 2: Connect to EC2

### Step 2.1: SSH to EC2 (Linux/Mac)

```bash
# Make key file secure
chmod 400 ~/Downloads/ctrlchecks-key.pem

# Connect to EC2 (replace YOUR_PUBLIC_IP with your actual IP)
ssh -i ~/Downloads/ctrlchecks-key.pem ubuntu@YOUR_PUBLIC_IP
```

### Step 2.2: SSH to EC2 (Windows)

Use **Windows Terminal** or **PowerShell**:

```powershell
# Navigate to folder with .pem file
cd Downloads

# Connect to EC2 (replace YOUR_PUBLIC_IP with your actual IP)
ssh -i ctrlchecks-key.pem ubuntu@YOUR_PUBLIC_IP
```

### Step 2.3: First-Time Update

Once connected, run:

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl wget python3-pip python3-venv build-essential
```

---

## Phase 3: Install Ollama & Models

### Step 3.1: Install Ollama

```bash
# Download and install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Verify installation
ollama --version
```

### Step 3.2: Pull All Models

```bash
# Pull all 3 models (this takes time, be patient - ~10-15 minutes)
ollama pull qwen2.5:7b
ollama pull llama3:8b
ollama pull mistral:7b

# Verify models are installed
ollama list
```

**Expected output:**
```
NAME            ID              SIZE    MODIFIED
qwen2.5:7b      abc123...       4.7 GB  2 minutes ago
llama3:8b       def456...       4.7 GB  1 minute ago
mistral:7b      ghi789...       4.1 GB  just now
```

### Step 3.3: Test Models (Optional)

```bash
# Quick test
ollama run qwen2.5:7b "Hello, are you working?"
# Press Ctrl+D to exit
```

### Step 3.4: Warm Up Models

```bash
# Warm up all models to avoid cold starts
echo "" | ollama run qwen2.5:7b
echo "" | ollama run llama3:8b
echo "" | ollama run mistral:7b
```

---

## Phase 4: Setup Python Backend

### Step 4.1: Create Project Structure

```bash
# Create project folder
mkdir -p ~/ctrlchecks-backend
cd ~/ctrlchecks-backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip
```

### Step 4.2: Create Requirements File

```bash
# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
EOF

# Install dependencies
pip install -r requirements.txt
```

### Step 4.3: Create Backend Code

```bash
# Create main.py
cat > main.py << 'EOF'
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import subprocess
import json
import asyncio
import time

app = FastAPI(title="CtrlChecks AI Backend")

# CORS middleware - Allow all origins (configure for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WorkflowRequest(BaseModel):
    prompt: str
    model: str = "qwen2.5:7b"  # default model
    max_tokens: Optional[int] = 500

class ProcessRequest(BaseModel):
    """Request schema for /process endpoint (compatible with existing frontend)"""
    task: str
    image: Optional[str] = None
    audio: Optional[str] = None
    input: Optional[str] = None
    sentence_count: Optional[int] = 5
    target_language: Optional[str] = None
    question: Optional[str] = None
    context: Optional[str] = None
    steps: Optional[int] = 2
    guidance_scale: Optional[float] = 1.0
    speed: Optional[float] = 1.0
    pitch: Optional[float] = 0.0
    volume: Optional[float] = 1.0
    options: Optional[dict] = None

def run_ollama(model: str, prompt: str) -> str:
    """
    Call Ollama model and return response
    """
    try:
        # Using subprocess to call Ollama
        result = subprocess.run(
            ["ollama", "run", model, prompt],
            capture_output=True,
            text=True,
            timeout=180  # 3 minute timeout
        )
        
        if result.returncode != 0:
            return f"Error: {result.stderr}"
        
        return result.stdout.strip()
    
    except subprocess.TimeoutExpired:
        return "Error: Request timeout"
    except Exception as e:
        return f"Error: {str(e)}"

@app.get("/")
async def root():
    return {
        "service": "CtrlChecks AI Backend",
        "status": "running",
        "models": ["qwen2.5:7b", "llama3:8b", "mistral:7b"],
        "endpoints": {
            "/": "Root endpoint",
            "/health": "Health check",
            "/run": "Workflow execution (Ollama)",
            "/process": "Multimodal processing (compatible with frontend)",
            "/api/agent/execute": "Agent execution (unified endpoint)"
        }
    }

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    try:
        # Quick test of Ollama
        test_result = run_ollama("qwen2.5:7b", "test")
        return {
            "status": "healthy",
            "ollama": "running",
            "test_response": test_result[:50] + "..." if len(test_result) > 50 else test_result,
            "models_available": ["qwen2.5:7b", "llama3:8b", "mistral:7b"]
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.post("/run")
async def run_workflow(request: WorkflowRequest):
    """
    Main API endpoint for workflow execution (Ollama-based)
    """
    # Validate model
    valid_models = ["qwen2.5:7b", "llama3:8b", "mistral:7b"]
    if request.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Choose from {valid_models}")
    
    # Call Ollama
    start_time = time.time()
    response = run_ollama(request.model, request.prompt)
    latency = time.time() - start_time
    
    return {
        "success": True,
        "model": request.model,
        "prompt": request.prompt,
        "response": response,
        "latency": round(latency, 2),
        "timestamp": time.time()
    }

@app.post("/process")
async def process_task(request: ProcessRequest):
    """
    Multimodal processing endpoint (compatible with existing frontend)
    Maps frontend tasks to Ollama models
    """
    start_time = time.time()
    
    try:
        # Map frontend tasks to appropriate Ollama models and prompts
        valid_models = ["qwen2.5:7b", "llama3:8b", "mistral:7b"]
        model = "qwen2.5:7b"  # Default model
        
        # Build prompt based on task type
        prompt = ""
        
        if request.task == "image_caption" and request.image:
            # For image tasks, we'll use text description (frontend should send base64)
            prompt = "Describe this image in detail: [Image provided]"
            # Note: Ollama CLI doesn't support images directly via subprocess
            # For full image support, you'd need Ollama API or different approach
            prompt = "Generate a detailed image caption based on the provided image data."
        
        elif request.task == "summarize" and request.input:
            prompt = f"Summarize the following text in 2-3 sentences:\n\n{request.input}"
        
        elif request.task == "translate" and request.input:
            target = request.target_language or "Spanish"
            prompt = f"Translate the following text to {target}:\n\n{request.input}"
        
        elif request.task == "extract" and request.input:
            prompt = f"Extract key information from the following text:\n\n{request.input}"
        
        elif request.task == "sentiment" and request.input:
            prompt = f"Analyze the sentiment of the following text (positive, negative, or neutral) and explain why:\n\n{request.input}"
        
        elif request.task == "generate" and request.input:
            prompt = f"Generate creative content based on: {request.input}"
        
        elif request.task == "qa" and request.question:
            context = request.context or request.input or ""
            prompt = f"Answer this question based on the context:\n\nQuestion: {request.question}\n\nContext: {context}"
        
        elif request.task == "chat" and request.input:
            prompt = request.input
        
        else:
            raise HTTPException(status_code=400, detail=f"Task '{request.task}' not supported or missing required input")
        
        # Call Ollama
        response = run_ollama(model, prompt)
        latency = time.time() - start_time
        
        return {
            "success": True,
            "output": response,
            "model_used": model,
            "processing_time": round(latency, 2)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        latency = time.time() - start_time
        return {
            "success": False,
            "error": str(e),
            "processing_time": round(latency, 2)
        }

@app.post("/api/agent/execute")
async def execute_agent(request: ProcessRequest):
    """
    Unified entry point for Multi-Agent Tools
    Routes to /process logic
    """
    return await process_task(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF
```

### Step 4.4: Create Ollama Wrapper (Optional - Enhanced Version)

```bash
# Create ollama_client.py for better model management
cat > ollama_client.py << 'EOF'
import subprocess
import json
import time

class OllamaClient:
    def __init__(self):
        self.models = {
            "qwen2.5:7b": "qwen2.5:7b",
            "llama3:8b": "llama3:8b", 
            "mistral:7b": "mistral:7b"
        }
        
    def list_models(self):
        """List available models"""
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True
            )
            return result.stdout
        except Exception as e:
            return f"Error listing models: {str(e)}"
    
    def generate(self, model: str, prompt: str, options: dict = None) -> dict:
        """
        Generate response from specified model
        
        Args:
            model: Model name (qwen2.5:7b, llama3:8b, mistral:7b)
            prompt: Input prompt
            options: Additional options like temperature, max_tokens
            
        Returns:
            Dictionary with response and metadata
        """
        if model not in self.models:
            return {"error": f"Model {model} not available"}
        
        # Build command
        cmd = ["ollama", "run", model]
        
        # Add options if provided
        if options:
            options_str = json.dumps(options)
            cmd.extend(["--options", options_str])
        
        # Add prompt
        cmd.append(prompt)
        
        try:
            start_time = time.time()
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=180  # 3 minute timeout
            )
            
            end_time = time.time()
            latency = end_time - start_time
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "response": result.stdout.strip(),
                    "latency": round(latency, 2),
                    "model": model
                }
            else:
                return {
                    "success": False,
                    "error": result.stderr,
                    "latency": round(latency, 2)
                }
                
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Request timeout (180s)"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def warm_up(self, model: str = None):
        """
        Warm up model to avoid cold start
        """
        if model:
            models_to_warm = [model]
        else:
            models_to_warm = list(self.models.keys())
        
        for model_name in models_to_warm:
            print(f"Warming up {model_name}...")
            self.generate(model_name, "warmup")
            print(f"✓ {model_name} warmed up")
EOF
```

---

## Phase 5: Run and Test Backend

### Step 5.1: Start Backend Server

```bash
# Make sure you're in the project folder
cd ~/ctrlchecks-backend

# Activate virtual environment
source venv/bin/activate

# Start FastAPI server (in background)
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &

# Check if server is running
sleep 2
curl http://localhost:8000/
```

### Step 5.2: Test API Endpoints

```bash
# Test root endpoint
curl http://localhost:8000/

# Test health endpoint
curl http://localhost:8000/health

# Test workflow endpoint
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is machine learning?",
    "model": "qwen2.5:7b"
  }'

# Test process endpoint (frontend compatible)
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{
    "task": "summarize",
    "input": "Machine learning is a subset of artificial intelligence that enables systems to learn from data."
  }'
```

**Expected responses:**
- Root: `{"service": "CtrlChecks AI Backend", "status": "running", ...}`
- Health: `{"status": "healthy", "ollama": "running", ...}`
- Run: `{"success": true, "response": "...", ...}`
- Process: `{"success": true, "output": "...", ...}`

---

## Phase 6: Setup Auto-Start

### Step 6.1: Create Systemd Service

```bash
# Create systemd service file
sudo nano /etc/systemd/system/ctrlchecks.service
```

**Add this content:**

```ini
[Unit]
Description=CtrlChecks AI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/ctrlchecks-backend
Environment="PATH=/home/ubuntu/ctrlchecks-backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/ubuntu/ctrlchecks-backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### Step 6.2: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (starts on boot)
sudo systemctl enable ctrlchecks

# Start service now
sudo systemctl start ctrlchecks

# Check status
sudo systemctl status ctrlchecks
```

**Expected output:** `Active: active (running)`

### Step 6.3: View Logs

```bash
# View service logs
sudo journalctl -u ctrlchecks -f

# View last 50 lines
sudo journalctl -u ctrlchecks -n 50
```

---

## Phase 7: Expose to Internet

### Step 7.1: Install Cloudflare Tunnel

```bash
# Download and install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### Step 7.2: Run Tunnel (Temporary - For Testing)

```bash
# Run tunnel (this will give you a public URL)
cloudflared tunnel --url http://localhost:8000
```

**You'll see output like:**
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has started! Visit it at (it may take some time to be reachable):       |
|  https://random-name.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

**⚠️ Save this URL** - your frontend will use it!

### Step 7.3: Setup Persistent Tunnel (Recommended)

For production, set up a named tunnel:

```bash
# Login to Cloudflare (optional, for persistent tunnels)
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create ctrlchecks-backend

# Create config file
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: ctrlchecks-backend
credentials-file: /home/ubuntu/.cloudflared/ctrlchecks-backend.json

ingress:
  - hostname: your-domain.com  # Replace with your domain
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run tunnel as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## Phase 8: Vercel Frontend Integration

### Step 8.1: Get Your Backend URL

From **Phase 7**, you should have a Cloudflare tunnel URL like:
```
https://random-name.trycloudflare.com
```

Or if you set up a persistent tunnel:
```
https://your-domain.com
```

### Step 8.2: Configure Vercel Environment Variables

1. Go to your **Vercel Dashboard**
2. Select your **CtrlChecks project**
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_PYTHON_BACKEND_URL` | `https://your-cloudflare-url.trycloudflare.com` | Production, Preview, Development |
| `VITE_USE_DIRECT_BACKEND` | `true` | Production, Preview, Development |

**Example:**
```
VITE_PYTHON_BACKEND_URL=https://ctrlchecks-abc123.trycloudflare.com
VITE_USE_DIRECT_BACKEND=true
```

### Step 8.3: Update Frontend Code (If Needed)

The frontend should already be configured to use these environment variables. Verify in your code:

**File: `src/components/multimodal/ImageProcessing.tsx`**
```typescript
const PYTHON_BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8501';
const USE_DIRECT_BACKEND = import.meta.env.VITE_USE_DIRECT_BACKEND === 'true' || 
                          import.meta.env.DEV || 
                          !import.meta.env.VITE_SUPABASE_URL;
```

**File: `src/components/multimodal/TextProcessing.tsx`**
```typescript
const PYTHON_BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8501';
const USE_DIRECT_BACKEND = import.meta.env.VITE_USE_DIRECT_BACKEND === 'true' || 
                          import.meta.env.DEV || 
                          !import.meta.env.VITE_SUPABASE_URL;
```

### Step 8.4: Redeploy Frontend

1. **Commit and push** your changes (if any)
2. Vercel will **automatically redeploy** when it detects the new environment variables
3. Or manually trigger a **redeploy** from Vercel Dashboard

### Step 8.5: Test Integration

1. Open your **Vercel-deployed frontend** (e.g., `https://your-app.vercel.app`)
2. Navigate to **Multimodal Builder** or **AI Workflow Builder**
3. Test an image or text processing task
4. Check browser console for API calls to your EC2 backend

**Expected behavior:**
- Frontend calls: `https://your-cloudflare-url.trycloudflare.com/process`
- Backend responds with AI-generated content
- No CORS errors

---

## Troubleshooting

### Issue 1: "Permission denied" for .pem file

```bash
# Linux/Mac
chmod 400 ~/Downloads/ctrlchecks-key.pem

# Windows PowerShell
icacls ctrlchecks-key.pem /inheritance:r
icacls ctrlchecks-key.pem /grant:r "%username%:R"
```

### Issue 2: Port 8000 not accessible

```bash
# Check if service is running
sudo systemctl status ctrlchecks

# Check if port is listening
sudo netstat -tlnp | grep 8000

# Check security group in AWS Console
# Make sure port 8000 is open to 0.0.0.0/0

# Check firewall
sudo ufw status
sudo ufw allow 8000
```

### Issue 3: Ollama models not loading

```bash
# Restart Ollama
sudo systemctl restart ollama

# Check GPU drivers (for GPU instances)
nvidia-smi

# Check Ollama status
ollama list

# Re-pull models if needed
ollama pull qwen2.5:7b
```

### Issue 4: Out of memory

```bash
# Monitor memory
htop

# Check memory usage
free -h

# Reduce concurrent users or upgrade instance
# Consider using smaller models or implementing request queue
```

### Issue 5: CORS errors in frontend

**Solution:** The backend already has CORS enabled. If you still see errors:

1. Check backend is running: `curl https://your-backend-url/health`
2. Verify CORS middleware in `main.py` allows your Vercel domain
3. Update CORS origins in `main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",
        "https://*.vercel.app",  # All Vercel previews
        "http://localhost:5173"  # Local dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue 6: Cloudflare tunnel not working

```bash
# Check if tunnel is running
ps aux | grep cloudflared

# Restart tunnel
pkill cloudflared
cloudflared tunnel --url http://localhost:8000

# For persistent tunnel
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

### Issue 7: Service not starting on boot

```bash
# Check service status
sudo systemctl status ctrlchecks

# Check service logs
sudo journalctl -u ctrlchecks -n 50

# Verify service file
sudo cat /etc/systemd/system/ctrlchecks.service

# Re-enable service
sudo systemctl daemon-reload
sudo systemctl enable ctrlchecks
sudo systemctl start ctrlchecks
```

---

## Quick Command Reference

### Essential Commands

```bash
# SSH to EC2
ssh -i ~/Downloads/ctrlchecks-key.pem ubuntu@YOUR_PUBLIC_IP

# Check Ollama
ollama list
ollama run qwen2.5:7b "test"

# Check backend service
sudo systemctl status ctrlchecks
sudo journalctl -u ctrlchecks -f

# Test API
curl http://localhost:8000/health
curl -X POST http://localhost:8000/run -H "Content-Type: application/json" -d '{"prompt":"test","model":"qwen2.5:7b"}'

# Restart service
sudo systemctl restart ctrlchecks

# View logs
sudo journalctl -u ctrlchecks -f
tail -f ~/ctrlchecks-backend/server.log

# Check system resources
htop
nvidia-smi  # For GPU instances
free -h
df -h
```

### Quick Setup Script

Save this as `setup.sh` and run it:

```bash
#!/bin/bash
# Quick setup script for CtrlChecks backend

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget python3-pip python3-venv build-essential

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull qwen2.5:7b
ollama pull llama3:8b
ollama pull mistral:7b

# Setup Python backend
mkdir -p ~/ctrlchecks-backend
cd ~/ctrlchecks-backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn pydantic python-multipart

# Create main.py (copy from Phase 4.3)

# Setup systemd service (copy from Phase 6.1)

# Install Cloudflare tunnel
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

echo "Setup complete! Now configure systemd service and Cloudflare tunnel."
```

---

## Verification Checklist

Run these commands to verify everything works:

```bash
# 1. Check Ollama is running
ollama list
# Should show: qwen2.5:7b, llama3:8b, mistral:7b

# 2. Check backend is running
curl http://localhost:8000/health
# Should return: {"status": "healthy", ...}

# 3. Check systemd service
sudo systemctl status ctrlchecks
# Should show: Active: active (running)

# 4. Test full workflow
curl -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain AI workflows in 2 sentences",
    "model": "llama3:8b"
  }'
# Should return: {"success": true, "response": "...", ...}

# 5. Test frontend-compatible endpoint
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{
    "task": "summarize",
    "input": "Machine learning is transforming industries."
  }'
# Should return: {"success": true, "output": "...", ...}

# 6. Check Cloudflare tunnel
curl https://your-cloudflare-url.trycloudflare.com/health
# Should return: {"status": "healthy", ...}
```

---

## Monitoring Commands

```bash
# Check GPU usage (if using GPU)
nvidia-smi

# Check CPU/RAM
htop
# Or
top

# Check service logs
sudo journalctl -u ctrlchecks -f

# Check API requests (if logging enabled)
tail -f ~/ctrlchecks-backend/server.log

# Check system resources
free -h  # Memory
df -h    # Disk
iostat   # I/O (if installed)
```

---

## Next Steps After Setup

1. ✅ **Test with 10+ concurrent users** using Postman/curl
2. ✅ **Add API key authentication** to `/run` and `/process` endpoints
3. ✅ **Implement request queue** for better concurrency
4. ✅ **Add database (PostgreSQL)** for workflow persistence
5. ✅ **Set up monitoring** with Prometheus/Grafana
6. ✅ **Configure persistent Cloudflare tunnel** with custom domain
7. ✅ **Set up automated backups** of EC2 instance
8. ✅ **Implement rate limiting** to prevent abuse
9. ✅ **Add request logging** and analytics
10. ✅ **Set up alerts** for service downtime

---

## Cost Estimation

**AWS EC2 g4dn.xlarge (100 users):**
- Instance: ~$0.526/hour = ~$378/month (if running 24/7)
- Storage: 200 GB gp3 = ~$16/month
- Data transfer: First 100 GB free, then $0.09/GB
- **Total: ~$400-500/month** (estimate)

**Ways to reduce costs:**
- Use Spot Instances (up to 90% discount)
- Stop instance when not in use
- Use Reserved Instances (1-3 year commitment)
- Optimize model usage (smaller models, caching)

---

## Security Best Practices

1. ✅ **Enable MFA** on AWS account
2. ✅ **Restrict SSH access** to your IP only
3. ✅ **Use API keys** for backend authentication
4. ✅ **Enable HTTPS** via Cloudflare tunnel
5. ✅ **Regular security updates**: `sudo apt update && sudo apt upgrade`
6. ✅ **Firewall rules**: Only open necessary ports
7. ✅ **Monitor access logs** regularly
8. ✅ **Backup important data** regularly

---

## Support & Resources

- **AWS EC2 Documentation**: https://docs.aws.amazon.com/ec2/
- **Ollama Documentation**: https://ollama.com/docs
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Cloudflare Tunnel**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Vercel Environment Variables**: https://vercel.com/docs/concepts/projects/environment-variables

---

## Summary

✅ **Backend deployed on AWS EC2** with Ollama models  
✅ **FastAPI server** running on port 8000  
✅ **Auto-start configured** with systemd  
✅ **Exposed to internet** via Cloudflare tunnel  
✅ **Frontend integrated** on Vercel  
✅ **All endpoints tested** and working  

**Your CtrlChecks backend is now LIVE! 🎉**

Share the Cloudflare URL with your frontend, and users can start using AI workflows immediately.

---

**Last Updated:** 2024  
**Version:** 1.0.0  
**Maintained by:** CtrlChecks Team

