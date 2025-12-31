# 🔍 How to Check Supabase Function Logs

The output shows "Processed: ..." which means the AI model isn't working. Here's how to check what's wrong:

## Step 1: Check Supabase Function Logs

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click **"Edge Functions"** in the left sidebar
   - Find **`execute-multimodal-agent`** in the list
   - Click on it

3. **View Logs**
   - Click the **"Logs"** tab
   - You'll see real-time logs from the function

4. **Trigger a Request**
   - Go back to your app
   - Click "Process" button
   - Return to the logs tab
   - You should see new log entries

## What to Look For in Logs

### ✅ Good Signs:
```
🔑 API Key check: ✅ Present
🤖 Model: mistralai/Mistral-7B-Instruct-v0.2
📡 Calling HuggingFace API: ...
📥 Response status: 200 OK
✅ Successfully extracted generated text!
```

### ❌ Bad Signs:

**1. No API Key:**
```
🔑 API Key check: ❌ Missing
❌ No HuggingFace API key found in environment
```
**Fix:** Add `HUGGINGFACE_API_KEY` to Supabase secrets

**2. API Error 401 (Unauthorized):**
```
❌ API Error (401): Unauthorized
```
**Fix:** API key is invalid - regenerate it in HuggingFace

**3. API Error 503 (Model Loading):**
```
⏳ Model loading, estimated time: 20s
```
**Fix:** Wait and try again, or the function will auto-retry

**4. API Error 410 (Gone):**
```
❌ Model endpoint gone (410) - model may have been removed
```
**Fix:** Model name might be wrong, or model was removed

**5. Could Not Extract Text:**
```
⚠️ Could not extract generated text, using fallback
📦 Full response: {...}
```
**Fix:** Response format is unexpected - check the full response in logs

## Common Issues & Quick Fixes

### Issue: "No HuggingFace API key"
**Solution:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add: `HUGGINGFACE_API_KEY` = `hf_xxxxxxxxxxxxx`
3. Redeploy function: `npx supabase functions deploy execute-multimodal-agent`

### Issue: "Model loading" (503)
**Solution:**
- Wait 10-30 seconds
- Try again
- The function will auto-retry once

### Issue: "Could not extract generated text"
**Solution:**
- Check the "Full response" in logs
- The response format might be different than expected
- Share the log output for debugging

## Quick Test

1. **Check logs** in Supabase Dashboard
2. **Click "Process"** in your UI
3. **Look for** the log messages above
4. **Share the logs** if you see errors

The logs will tell us exactly what's wrong! 🔍

