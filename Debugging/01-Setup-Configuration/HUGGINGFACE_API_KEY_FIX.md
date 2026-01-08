# 🔧 HuggingFace API Key Setup & 401 Error Fix

This comprehensive guide covers all scenarios for setting up HuggingFace API keys and fixing 401 errors.

---

## 🔍 Determine Your Setup

Check your browser console - it will show one of these messages:
- `🔧 Local dev mode: Calling Python backend directly` → **You're using the Python backend locally**
- `🚀 Production mode: Using Supabase Edge Function` → **You're using the Edge Function**

---

## ✅ Solution 1: Supabase Edge Functions (Production)

If you're using Supabase Edge Functions (production mode), the API key must be set in **Supabase Edge Functions secrets**.

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Select your project

### Step 2: Navigate to Edge Functions Secrets

**Option A: Via Edge Functions Menu**
1. Click **"Edge Functions"** in the left sidebar
2. Click the **"Secrets"** tab (at the top)

**Option B: Via Project Settings**
1. Click **"Project Settings"** (gear icon at bottom of left sidebar)
2. Click **"Edge Functions"** in the settings menu
3. Click **"Secrets"** tab

### Step 3: Add Your HuggingFace API Key

1. Click **"Add new secret"** or **"New secret"** button
2. Fill in:
   - **Name**: `HUGGINGFACE_API_KEY` (must be exactly this, case-sensitive)
   - **Value**: `your_huggingface_api_key_here` (your token, starts with `hf_`)
3. Click **"Save"** or **"Add secret"**

### Step 4: Verify the Secret Was Added

You should see `HUGGINGFACE_API_KEY` in the secrets list.

### Important Notes:
- ✅ **Don't put the key in your `.env` file** - it won't work for Edge Functions
- ✅ **Don't put the key in your code** - it's a security risk
- ✅ **The key must be in Supabase Secrets** - this is the only way Edge Functions can access it
- ✅ **No need to redeploy** - secrets are available immediately after adding

---

## ✅ Solution 2: Python Backend Locally (Development)

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

### Step 2: Use .env File (Recommended)

1. Navigate to `AI_Agent/multimodal_backend/`
2. Create a new file named `.env` (no extension)
3. Add this content:

```env
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
HF_API_KEY=your_huggingface_api_key_here
HUGGING_FACE_TOKEN=your_huggingface_api_key_here
```

**Note:** The Python backend uses inconsistent environment variable names. Set all three to be safe.

4. Install python-dotenv:
```bash
cd AI_Agent/multimodal_backend
pip install python-dotenv
```

5. The backend will automatically load the `.env` file when it starts.

### Step 3: Restart Python Backend

1. Stop the Python backend (Ctrl+C)
2. Restart it
3. Try the feature again

---

## 🧪 Test It

After adding the secret or setting the environment variable:

1. Go back to your app
2. Try the feature again (Text to Image, workflow generation, etc.)
3. The 401 error should be gone!

---

## ❌ Still Getting 401?

### For Supabase Edge Functions:
1. **Check the secret name** - must be exactly `HUGGINGFACE_API_KEY` (no spaces, correct case)
2. **Check the token value** - make sure you copied the entire token (starts with `hf_`)
3. **Verify the token is valid** - go to https://huggingface.co/settings/tokens and check if it's active
4. **Wait a few seconds** - secrets may take a moment to propagate
5. **Check Edge Function logs** - go to Edge Functions → Your Function → Logs to see detailed error messages

### For Python Backend:
1. **Verify it's set:**
   ```powershell
   echo $env:HUGGINGFACE_API_KEY
   ```
2. **Check all three variable names** - set `HUGGINGFACE_API_KEY`, `HF_API_KEY`, and `HUGGING_FACE_TOKEN`
3. **Restart Python backend** after setting variables
4. **Check Python backend logs** for detailed error messages

---

## 📝 Summary

- ✅ **Supabase secrets** are for Edge Functions (TypeScript/Deno)
- ✅ **Environment variables** are for Python backend (local or deployed)
- ✅ **For local Python backend**: Set environment variables in your terminal/system or use `.env` file
- ✅ **For Edge Functions**: Set secrets in Supabase Dashboard
- ✅ **For multiple Edge Functions**: The secret is shared across all functions, so you only need to add it once

---

## 🔗 Useful Links

- [Supabase Edge Functions Secrets Docs](https://supabase.com/docs/guides/functions/secrets)
- [HuggingFace Tokens](https://huggingface.co/settings/tokens)
- [API Keys Setup Guide](./API_KEYS_SETUP_GUIDE.md)
- [Environment Setup Guide](./ENV_SETUP_GUIDE.md)

