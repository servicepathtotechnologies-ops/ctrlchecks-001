# 🔑 API Keys Setup Guide - Multimodal Agent Builder

This guide will walk you through obtaining free API keys for the Multimodal Agent Builder.

---

## 📋 Table of Contents

1. [HuggingFace API Key](#1-huggingface-api-key-required)
2. [Replicate API Token](#2-replicate-api-token-optional)
3. [Groq API Key](#3-groq-api-key-optional)
4. [Setting Up in Supabase](#4-setting-up-in-supabase)

---

## 1. HuggingFace API Key (Required) ⭐

**HuggingFace is the primary API used for most AI models in the system.**

### Step-by-Step:

1. **Go to HuggingFace Website**
   - Visit: https://huggingface.co/
   - Click **"Sign Up"** in the top right corner

2. **Create Account**
   - Sign up with email, Google, or GitHub
   - Verify your email if required

3. **Get Your Access Token**
   - Click on your **profile picture** (top right)
   - Go to **"Settings"**
   - Click **"Access Tokens"** in the left sidebar
   - Click **"New token"** button

4. **Configure Token**
   - **Name**: `multimodal-agent-builder` (or any name you prefer)
   - **Type**: Select **"Read"** (sufficient for inference API)
   - Click **"Generate token"**

5. **Copy Your Token**
   - ⚠️ **Important**: Copy the token immediately - you won't see it again!
   - It will look like: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Free Tier Limits:
- ✅ **30,000 tokens/month** for most models
- ✅ **Unlimited** for some models (with rate limits)
- ✅ No credit card required

### Where to Use:
- Add as `HUGGINGFACE_API_KEY` in Supabase Edge Functions secrets

---

## 2. Replicate API Token (Optional) 🎨

**Replicate is used for high-quality image generation (Stable Diffusion XL).**

### Step-by-Step:

1. **Go to Replicate Website**
   - Visit: https://replicate.com/
   - Click **"Sign Up"** or **"Get Started"**

2. **Create Account**
   - Sign up with email, Google, or GitHub
   - Verify your email if required

3. **Get Your API Token**
   - Click on your **profile picture** (top right)
   - Go to **"Account"** or **"API Tokens"**
   - Click **"Create token"** or **"New token"**

4. **Copy Your Token**
   - ⚠️ **Important**: Copy the token immediately
   - It will look like: `r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Free Tier Limits:
- ✅ **500 images/month** free
- ✅ No credit card required for free tier
- ⚠️ After free tier, pay-as-you-go pricing

### Where to Use:
- Add as `REPLICATE_API_TOKEN` in Supabase Edge Functions secrets

### Note:
- If you don't set this, the system will use HuggingFace's Stable Diffusion (slower but unlimited)

---

## 3. Groq API Key (Optional) ⚡

**Groq provides ultra-fast text processing (300+ tokens/second).**

### Step-by-Step:

1. **Go to Groq Website**
   - Visit: https://console.groq.com/
   - Click **"Sign Up"** or **"Get Started"**

2. **Create Account**
   - Sign up with email or Google
   - Verify your email if required

3. **Get Your API Key**
   - After logging in, you'll be in the **Console Dashboard**
   - Click on **"API Keys"** in the left sidebar (or top navigation)
   - Click **"Create API Key"** button

4. **Configure API Key**
   - **Name**: `multimodal-agent-builder` (or any name)
   - Click **"Submit"** or **"Create"**

5. **Copy Your API Key**
   - ⚠️ **Important**: Copy the key immediately
   - It will look like: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Free Tier Limits:
- ✅ **Limited requests** (varies by model)
- ✅ Very fast processing (300+ tokens/sec)
- ✅ No credit card required

### Where to Use:
- Add as `GROQ_API_KEY` in Supabase Edge Functions secrets

### Note:
- If you don't set this, the system will use HuggingFace models (slower but still free)

---

## 4. Setting Up in Supabase 🔧

Once you have your API keys, add them to Supabase Edge Functions:

### Method 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **"Edge Functions"** in the left sidebar
   - Click **"Secrets"** tab (or go to Project Settings → Edge Functions → Secrets)

3. **Add Secrets**
   - Click **"Add new secret"** or **"New secret"**
   - For each key:
     - **Name**: `HUGGINGFACE_API_KEY`
     - **Value**: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (paste your token)
     - Click **"Save"**
   
   Repeat for:
   - `REPLICATE_API_TOKEN` (optional)
   - `GROQ_API_KEY` (optional)

### Method 2: Supabase CLI

```bash
# Set secrets using Supabase CLI
npx supabase secrets set HUGGINGFACE_API_KEY=your_token_here --project-ref YOUR_PROJECT_REF
npx supabase secrets set REPLICATE_API_TOKEN=your_token_here --project-ref YOUR_PROJECT_REF
npx supabase secrets set GROQ_API_KEY=your_token_here --project-ref YOUR_PROJECT_REF
```

### Verify Secrets Are Set:

```bash
# List all secrets (values are hidden)
npx supabase secrets list --project-ref YOUR_PROJECT_REF
```

---

## 🎯 Quick Setup Checklist

- [ ] Create HuggingFace account
- [ ] Generate HuggingFace access token
- [ ] (Optional) Create Replicate account
- [ ] (Optional) Generate Replicate API token
- [ ] (Optional) Create Groq account
- [ ] (Optional) Generate Groq API key
- [ ] Add `HUGGINGFACE_API_KEY` to Supabase secrets
- [ ] (Optional) Add `REPLICATE_API_TOKEN` to Supabase secrets
- [ ] (Optional) Add `GROQ_API_KEY` to Supabase secrets
- [ ] Deploy Edge Function: `npx supabase functions deploy build-multimodal-agent`

---

## 🔒 Security Best Practices

1. **Never commit API keys to Git**
   - Keep them in Supabase secrets only
   - Use environment variables for local development

2. **Use Read-Only Tokens**
   - For HuggingFace, use "Read" tokens (not "Write")
   - This limits access if compromised

3. **Rotate Keys Regularly**
   - Regenerate keys every few months
   - Revoke old keys when creating new ones

4. **Monitor Usage**
   - Check API usage in each platform's dashboard
   - Set up alerts if available

---

## 🆘 Troubleshooting

### "HuggingFace API key not configured"
- ✅ Verify the secret name is exactly `HUGGINGFACE_API_KEY` (case-sensitive)
- ✅ Check that the token starts with `hf_`
- ✅ Redeploy the Edge Function after adding secrets

### "Rate limit exceeded"
- ✅ Check your HuggingFace dashboard for usage
- ✅ Wait a few minutes and try again
- ✅ Consider upgrading to a paid plan if needed

### "Invalid API key"
- ✅ Verify you copied the entire token (no spaces)
- ✅ Check if the token was revoked or expired
- ✅ Generate a new token if needed

---

## 📊 API Usage Comparison

| Service | Speed | Free Tier | Best For |
|---------|-------|-----------|----------|
| **HuggingFace** | Medium | 30K tokens/month | General AI tasks |
| **Groq** | ⚡ Ultra-Fast | Limited requests | Fast text processing |
| **Replicate** | Fast | 500 images/month | High-quality images |

---

## 💡 Tips

1. **Start with HuggingFace only** - It's sufficient for most use cases
2. **Add Groq later** - If you need faster text processing
3. **Add Replicate later** - If you need better image quality
4. **Monitor usage** - Check dashboards regularly to avoid hitting limits

---

## ✅ You're All Set!

Once you've added at least the `HUGGINGFACE_API_KEY`, your Multimodal Agent Builder is ready to use! 🎉

Navigate to `/multimodal` and start building AI agents with words!

