# 🔧 Environment Variables Setup - Complete Guide

## ❌ You DON'T Need to Run Those Commands Every Time!

Here are **permanent solutions** for both local development and deployment.

---

## 📁 Solution 1: Use .env File (Recommended for Local)

### Step 1: Create .env File

1. Navigate to `AI_Agent/multimodal_backend/`
2. Create a new file named `.env` (no extension, just `.env`)
3. Add this content:

```env
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HF_API_KEY=your_huggingface_api_key_here
HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

### Step 2: Install python-dotenv

```bash
cd AI_Agent/multimodal_backend
pip install python-dotenv
```

Or if using requirements.txt:
```bash
pip install -r requirements.txt
```

(We've added `python-dotenv` to requirements.txt)

### Step 3: Done! ✅

Now just run your Python backend normally:
```bash
python main.py
```

The `.env` file will be automatically loaded - **no need to set variables every time!**

---

## 🌐 Solution 2: System Environment Variables (Alternative)

If you prefer system-wide setup:

### Windows:

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. **Advanced** tab → **Environment Variables**
3. Under **User variables**, click **New**
4. Add:
   - Name: `HUGGINGFACE_API_KEY`
   - Value: `your_huggingface_api_key_here`
5. Repeat for `HF_API_KEY` and `HUGGING_FACE_TOKEN`
6. Click OK, then **restart your terminal/IDE**

---

## 🚀 For Production Deployment

When you deploy, set environment variables in your **hosting platform**:

### Option A: Railway.app

1. Go to your project → **Variables** tab
2. Add:
   - `HUGGINGFACE_API_KEY` = `your_huggingface_api_key_here`
   - `HF_API_KEY` = `your_huggingface_api_key_here`
   - `HUGGING_FACE_TOKEN` = `your_huggingface_api_key_here`

### Option B: Render.com

1. Go to your service → **Environment** tab
2. Add the same variables as above

### Option C: Heroku

```bash
heroku config:set HUGGINGFACE_API_KEY=your_huggingface_api_key_here
heroku config:set HF_API_KEY=your_huggingface_api_key_here
heroku config:set HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

### Option D: Docker

In your `docker-compose.yml` or Dockerfile:
```yaml
environment:
  - HUGGINGFACE_API_KEY=your_huggingface_api_key_here
  - HF_API_KEY=your_huggingface_api_key_here
  - HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

---

## 📝 Summary

| Scenario | Solution | Set Once? |
|----------|----------|-----------|
| **Local Development** | `.env` file | ✅ Yes, permanent |
| **Local Development (Alt)** | System env vars | ✅ Yes, permanent |
| **Production Deployment** | Hosting platform env vars | ✅ Yes, set in platform |

**You DON'T need to run those PowerShell commands every time!**

Just use the `.env` file for local development - it's the easiest solution. ✅

