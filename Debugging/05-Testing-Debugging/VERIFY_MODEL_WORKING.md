# 🔍 How to Verify Your Model is Working

## Quick Verification Steps

### 1. **Check Browser Console (F12)**

Open your browser's Developer Tools (F12) and check the Console tab. You should see:

```
📝 Processing input: "your text here"
🔧 Pipeline: {steps: [...], ...}
⚙️ Execution Engine: {models: [...], ...}
📡 Calling execute-multimodal-agent...
📥 Response received in XXXms: {data: {...}, error: null}
✅ Processing successful!
📤 Output: "processed result here"
🎉 Processing completed! Result: "processed result"
```

### 2. **Check Debug Panel**

After clicking "Process", scroll down in the generated interface. You'll see a **"Show Debug Info"** button. Click it to see:

- ✅ Pipeline Status (number of steps, models)
- ✅ Execution Logs (what happened during processing)
- ✅ Selected Models (which AI models were used)
- ✅ Processing time

### 3. **Check Supabase Edge Function Logs**

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on **`execute-multimodal-agent`**
3. Go to **Logs** tab
4. You should see:
   - Function invocation logs
   - HuggingFace API calls
   - Processing steps
   - Output generation

### 4. **Verify Output Quality**

The output should be **different from input**:
- ✅ **Summarize**: Should be shorter, condensed version
- ✅ **Extract**: Should extract key information
- ✅ **Translate**: Should be in different language
- ✅ **Analyze**: Should provide insights

If output is just "Processed: [your input]", the AI model isn't being called.

## Common Issues & Solutions

### Issue: "Function not found"

**Solution:**
```bash
npx supabase functions deploy execute-multimodal-agent
```

### Issue: Output is same as input

**Possible causes:**
1. **HuggingFace API key not set** → Check Supabase secrets
2. **Model loading** → Wait 10-30 seconds and try again
3. **API rate limit** → Check HuggingFace dashboard

**Check:**
- Browser console for errors
- Supabase function logs
- HuggingFace API key in secrets

### Issue: "No output" or empty output

**Check:**
1. Browser console (F12) for errors
2. Network tab - is the function being called?
3. Supabase function logs

### Issue: Output is just "Processed: ..."

This means the fallback is being used (AI model not called).

**Check:**
1. Is `HUGGINGFACE_API_KEY` set in Supabase secrets?
2. Check browser console for API errors
3. Check Supabase function logs for HuggingFace errors

## Expected Behavior

### ✅ Working Correctly:

1. **Input**: "AI is transforming the world"
2. **Processing**: Shows progress bar, logs appear
3. **Output**: AI-generated summary/analysis (NOT just "Processed: AI is transforming the world")
4. **Console**: Shows successful API calls
5. **Debug Panel**: Shows models used, processing time

### ❌ Not Working:

1. Output is identical to input
2. Output is "Processed: [input]" (fallback)
3. Console shows errors
4. No logs in Supabase function

## Test Commands

### Test 1: Simple Summarization
**Input:** "Artificial intelligence is revolutionizing how we work, learn, and interact with technology. AI systems can process vast amounts of data, recognize patterns, and make predictions that were previously impossible."

**Expected Output:** A concise summary (shorter than input)

### Test 2: Check Console Logs
1. Open browser console (F12)
2. Click "Process"
3. Look for:
   - `📡 Calling execute-multimodal-agent...`
   - `📥 Response received...`
   - `✅ Processing successful!`

### Test 3: Check Function Logs
1. Supabase Dashboard → Edge Functions → `execute-multimodal-agent` → Logs
2. Click "Process" in the UI
3. Check logs for:
   - Function invocation
   - HuggingFace API calls
   - Processing steps

## Success Indicators

✅ **Model is working if:**
- Output is different from input
- Console shows successful API calls
- Debug panel shows models used
- Processing takes 2-10 seconds (not instant)
- Output makes sense (summary, analysis, etc.)

❌ **Model is NOT working if:**
- Output = Input
- Output = "Processed: [input]"
- Console shows errors
- Processing is instant (< 1 second)
- No logs in Supabase

## Next Steps

If the model is working:
- ✅ Try different prompts
- ✅ Test different processing steps
- ✅ Build more complex pipelines

If the model is NOT working:
1. Check `HUGGINGFACE_API_KEY` in Supabase secrets
2. Deploy `execute-multimodal-agent` function
3. Check browser console for errors
4. Check Supabase function logs

---

**Remember:** The debug panel and browser console are your best friends for verifying the model is working! 🔍

