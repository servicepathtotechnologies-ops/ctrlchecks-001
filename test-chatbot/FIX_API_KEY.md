# Fix: Gemini API Key Leaked Error

## 🔴 Problem
You're getting this error:
```
Google Gemini request failed: 403 - {
  "error": {
    "code": 403,
    "message": "Your API key was reported as leaked. Please use another API key.",
    "status": "PERMISSION_DENIED"
  }
}
```

## ✅ Solution: Get a New API Key

### Step 1: Get New Gemini API Key

1. **Go to Google AI Studio:**
   - Visit: https://aistudio.google.com/apikey
   - Sign in with your Google account

2. **Create New API Key:**
   - Click "Create API Key"
   - Select your Google Cloud project (or create new one)
   - Copy the new API key immediately
   - ⚠️ **Save it securely** - you won't see it again!

3. **Delete Old Key (Important!):**
   - Go to Google Cloud Console
   - Navigate to "APIs & Services" → "Credentials"
   - Find and delete the old leaked key

### Step 2: Update API Key in Supabase

You have **TWO options**:

#### Option A: Set as Environment Variable (Recommended)

1. **Open Supabase Dashboard:**
   - Go to your project: https://supabase.com/dashboard
   - Select your project

2. **Go to Edge Functions → Secrets:**
   - Click "Edge Functions" in sidebar
   - Click "Secrets" tab
   - Or go to: Project Settings → Edge Functions → Secrets

3. **Add/Update Secret:**
   - Click "Add new secret"
   - **Name:** `CHATBOT_API_KEY`
   - **Value:** Paste your new Gemini API key
   - Click "Save"

4. **If using LOVABLE_API_KEY:**
   - Also update `LOVABLE_API_KEY` with the new key
   - This is used as fallback for workflow nodes

#### Option B: Set in Workflow Node (Alternative)

1. **Open your workflow** in CtrlChecks
2. **Click on the Gemini AI node**
3. **In Properties Panel:**
   - Find "API Key" field
   - Paste your new Gemini API key
   - Save the workflow

**Note:** Option A is better because it's centralized and secure.

### Step 3: Redeploy Edge Functions (If Needed)

After updating secrets, you may need to redeploy:

```bash
# If using Supabase CLI
supabase functions deploy execute-workflow
supabase functions deploy webhook-trigger
```

Or the secrets will be picked up automatically on next function call.

### Step 4: Test Again

1. **Open your test chatbot:** `test-chatbot/index.html`
2. **Send a test message**
3. **Should work now!** ✅

---

## 🔍 Where API Keys Are Used

### In Your Project:

1. **`CHATBOT_API_KEY`** - Used by:
   - `chatbot` Edge Function (website chatbot)
   - Can be used as fallback for workflows

2. **`LOVABLE_API_KEY`** - Used by:
   - `execute-workflow` Edge Function
   - Fallback for AI nodes if node doesn't have its own key

3. **Node-level API Key** - Used by:
   - Individual workflow nodes (if configured in node properties)
   - Takes priority over environment variables

---

## 🛡️ Security Best Practices

1. **Never commit API keys to Git**
2. **Use Supabase Secrets** (not hardcoded)
3. **Rotate keys regularly**
4. **Restrict API key permissions** in Google Cloud Console
5. **Monitor API usage** for unusual activity

---

## 🚨 If Error Persists

1. **Check key is correct:**
   - No extra spaces
   - Full key copied
   - Key starts with `AIza...`

2. **Verify key is active:**
   - Go to Google AI Studio
   - Check key status

3. **Check Supabase secrets:**
   - Verify secret name is exactly `CHATBOT_API_KEY`
   - Check for typos

4. **Check workflow node:**
   - If node has API key field, make sure it's updated
   - Or leave empty to use environment variable

---

## 📝 Quick Checklist

- [ ] Got new API key from Google AI Studio
- [ ] Deleted old leaked key
- [ ] Updated `CHATBOT_API_KEY` in Supabase secrets
- [ ] Updated `LOVABLE_API_KEY` if using it
- [ ] Updated workflow node API key (if configured)
- [ ] Tested chatbot again

---

**After updating, your chatbot should work! 🎉**

