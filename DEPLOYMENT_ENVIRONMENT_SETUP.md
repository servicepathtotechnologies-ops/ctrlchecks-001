# 🔧 Environment Variables Setup - Local & Deployment Guide

This guide explains how to set up environment variables permanently for local development and deployment.

---

## 📁 Option 1: Using .env File (Recommended for Local Development)

### Step 1: Create .env File

1. Go to `AI_Agent/multimodal_backend/` directory
2. Create a file named `.env` (no extension)
3. Copy the content from `.env.example` and add your API key:

```env
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HF_API_KEY=your_huggingface_api_key_here
HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

### Step 2: Install python-dotenv

The Python backend needs to load the .env file. Install the package:

```bash
cd AI_Agent/multimodal_backend
pip install python-dotenv
```

### Step 3: Update main.py to Load .env

We need to add code to load the .env file. The backend will automatically load environment variables from the .env file when it starts.

**Note:** The .env file is already in .gitignore, so it won't be committed to your repository.

### Step 4: Start the Backend

Just run the backend normally - it will automatically load the .env file:

```bash
python main.py
```

**✅ Benefits:**
- ✅ No need to set variables every time
- ✅ Variables are stored in one place
- ✅ Easy to update
- ✅ Not committed to Git (secure)

---

## 🌐 Option 2: System Environment Variables (Alternative)

If you prefer system-wide environment variables:

### Windows (Permanent Setup):

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to **"Advanced"** tab → Click **"Environment Variables"**
3. Under **"User variables"**, click **"New"**
4. Add each variable:
   - Variable name: `HUGGINGFACE_API_KEY`
   - Variable value: `your_huggingface_api_key_here`
5. Repeat for: `HF_API_KEY` and `HUGGING_FACE_TOKEN`
6. Click **OK** on all dialogs
7. **Restart your terminal/IDE** for changes to take effect

**✅ Benefits:**
- ✅ Works system-wide
- ✅ All applications can use it
- ✅ Persists across reboots

---

## 🚀 Deployment Options

When deploying to production, you need to set environment variables in your hosting platform. Here are the most common options:

### Option A: Deploy Python Backend Separately

If you deploy the Python backend to a hosting platform (Railway, Render, Heroku, etc.):

#### Railway.app:
1. Go to your project → **Variables** tab
2. Add each variable:
   - `HUGGINGFACE_API_KEY` = `your_huggingface_api_key_here`
   - `HF_API_KEY` = `your_huggingface_api_key_here`
   - `HUGGING_FACE_TOKEN` = `your_huggingface_api_key_here`
3. Deploy your backend - variables are automatically available

#### Render.com:
1. Go to your service → **Environment** tab
2. Add environment variables (same as above)
3. Redeploy if needed

#### Heroku:
```bash
heroku config:set HUGGINGFACE_API_KEY=your_huggingface_api_key_here
heroku config:set HF_API_KEY=your_huggingface_api_key_here
heroku config:set HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

### Option B: Use Supabase Edge Functions Only (Recommended)

**If you want to avoid managing a separate Python backend**, you can:

1. **Skip the Python backend entirely** for image processing
2. **Use Edge Functions directly** - They already have access to Supabase secrets
3. The Edge Function `execute-multimodal-agent` proxies to Python backend, but you could modify it to call HuggingFace API directly

**Current Setup:**
- Frontend → Edge Function (`execute-multimodal-agent`) → Python Backend → HuggingFace API

**Simplified Setup:**
- Frontend → Edge Function → HuggingFace API (direct)

**For this option:**
- Set `HUGGINGFACE_API_KEY` in Supabase Secrets (already done ✅)
- The Edge Function can call HuggingFace API directly
- No separate Python backend deployment needed

---

## 📝 Quick Comparison

| Method | Local Dev | Deployment | Ease of Use |
|--------|-----------|------------|-------------|
| **.env file** | ✅ Perfect | ❌ Not used | ⭐⭐⭐⭐⭐ |
| **System Env Vars** | ✅ Works | ❌ Not used | ⭐⭐⭐ |
| **Hosting Platform Env Vars** | ❌ Not needed | ✅ Required | ⭐⭐⭐⭐ |
| **Supabase Secrets** | ❌ Not for Python | ✅ Perfect for Edge Functions | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recommended Setup

### For Local Development:
1. ✅ Use **.env file** (Option 1) - easiest and most flexible

### For Production:
1. ✅ **If using Python backend:** Set env vars in hosting platform
2. ✅ **If using Edge Functions only:** Use Supabase Secrets (already set ✅)

---

## 🔒 Security Notes

1. **Never commit .env files** - They're in .gitignore
2. **Never commit API keys** to Git
3. **Use different keys** for development and production if possible
4. **Rotate keys regularly** for security

---

## ✅ Summary

**Local Development:**
- Use `.env` file → Set once, works every time ✅

**Production Deployment:**
- Set environment variables in your hosting platform
- OR use Supabase Edge Functions with Secrets (simpler)

You **don't need to run those commands every time** - use the `.env` file for local development!

