# 🔧 Quick Fix: HuggingFace API Key 401 Error

You're getting a 401 Unauthorized error because the HuggingFace API key needs to be set in **Supabase Edge Functions secrets**, not in your code or environment file.

## ✅ Solution: Add API Key to Supabase Secrets

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
   - **Value**: `your_huggingface_api_key_here` (your token)
3. Click **"Save"** or **"Add secret"**

### Step 4: Verify the Secret Was Added

You should see `HUGGINGFACE_API_KEY` in the secrets list.

## 🔄 Important Notes

1. **Don't put the key in your `.env` file** - it won't work for Edge Functions
2. **Don't put the key in your code** - it's a security risk
3. **The key must be in Supabase Secrets** - this is the only way Edge Functions can access it
4. **No need to redeploy** - secrets are available immediately after adding

## 🧪 Test It

After adding the secret:
1. Go back to your app
2. Try the "Text to Image" feature again
3. The 401 error should be gone!

## 📝 For Multiple Edge Functions

If you have multiple Edge Functions that need the API key (like `execute-multimodal-agent`, `build-multimodal-agent`), the secret is shared across all functions, so you only need to add it once.

## ❌ Still Getting 401?

If you're still getting 401 after adding the secret:

1. **Check the secret name** - must be exactly `HUGGINGFACE_API_KEY` (no spaces, correct case)
2. **Check the token value** - make sure you copied the entire token (starts with `hf_`)
3. **Verify the token is valid** - go to https://huggingface.co/settings/tokens and check if it's active
4. **Wait a few seconds** - secrets may take a moment to propagate
5. **Check Edge Function logs** - go to Edge Functions → Your Function → Logs to see detailed error messages

## 🔗 Useful Links

- [Supabase Edge Functions Secrets Docs](https://supabase.com/docs/guides/functions/secrets)
- [HuggingFace Tokens](https://huggingface.co/settings/tokens)
- [API Keys Setup Guide](../Debugging/01-Setup-Configuration/API_KEYS_SETUP_GUIDE.md)

