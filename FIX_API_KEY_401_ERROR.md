# 🔧 Fix 401 Error - Multiple Solutions

The 401 error occurs because the Python backend needs the HuggingFace API key. There are **two possible scenarios** depending on your setup:

## 🔍 First: Determine Your Setup

Check your browser console - it will show one of these messages:
- `🔧 Local dev mode: Calling Python backend directly` → **You're using the Python backend locally**
- `🚀 Production mode: Using Supabase Edge Function` → **You're using the Edge Function**

---

## ✅ Solution 1: Using Python Backend Locally (Development)

If you're running the Python backend locally (dev mode):

### Step 1: Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:HUGGINGFACE_API_KEY="your_huggingface_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set HUGGINGFACE_API_KEY=your_huggingface_api_key_here
```

**For permanent setup (Windows):**
1. Open System Properties → Environment Variables
2. Add new User variable:
   - Name: `HUGGINGFACE_API_KEY`
   - Value: `your_huggingface_api_key_here`

### Step 2: Restart Python Backend

1. Stop the Python backend (Ctrl+C)
2. Restart it with the environment variable set
3. Try the image generation again

---

## ✅ Solution 2: Using Edge Function (Production)

If you're using the Edge Function route (production mode):

The Edge Function proxies to a Python backend. You need to:

### Option A: Deploy Python Backend with API Key

If you have a deployed Python backend:
1. Set `HUGGINGFACE_API_KEY` as an environment variable in your Python backend hosting (Heroku, Railway, etc.)

### Option B: Use Direct Backend Locally (Recommended for Testing)

Change your setup to use the local Python backend:

1. **Create/Edit `.env` file** in the project root:
```env
VITE_USE_DIRECT_BACKEND=true
VITE_PYTHON_BACKEND_URL=http://localhost:8501
```

2. **Start the Python backend:**
```bash
cd AI_Agent/multimodal_backend
python main.py
```

3. **Set the environment variable** (see Solution 1 above)

4. **Restart your React app**

---

## 🔧 Additional Fix: Python Backend Environment Variable Names

The Python backend uses **inconsistent environment variable names**. We should fix this, but for now, set **all three** to be safe:

**Windows (PowerShell):**
```powershell
$env:HUGGINGFACE_API_KEY="your_huggingface_api_key_here"
$env:HF_API_KEY="your_huggingface_api_key_here"
$env:HUGGING_FACE_TOKEN="your_huggingface_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set HUGGINGFACE_API_KEY=your_huggingface_api_key_here
set HF_API_KEY=your_huggingface_api_key_here
set HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

---

## ✅ Quick Test

After setting the environment variable:

1. **Verify it's set:**
   ```powershell
   echo $env:HUGGINGFACE_API_KEY
   ```

2. **Restart Python backend** (if running locally)

3. **Try image generation again**

---

## 📝 Summary

- ✅ **Supabase secrets** are for Edge Functions (TypeScript/Deno)
- ✅ **Environment variables** are for Python backend (local or deployed)
- ✅ The Python backend needs the key in its environment, not in Supabase secrets (unless the backend is deployed and reads from Supabase)

If you're running locally, you need to set the environment variable in your terminal/system, not just in Supabase Dashboard.

