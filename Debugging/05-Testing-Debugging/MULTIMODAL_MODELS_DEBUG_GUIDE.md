# Multimodal Models Debugging Guide

This guide helps you debug and verify that your multimodal models are working correctly and can retrieve information according to user requirements.

## Quick Start

### Option 1: Use the Built-in Model Tester (Recommended)

1. Navigate to `/multimodal` in your application
2. Scroll down to the **Model Testing & Debugging** section
3. Click **"Run All Tests"** to test all model capabilities
4. Review the results to see which models are working

### Option 2: Use the Command-Line Test Script

```bash
# Set your API key
export HUGGINGFACE_API_KEY=your_key_here

# Run the test script
deno run --allow-net --allow-env scripts/test-multimodal-models.ts
```

## What Gets Tested

The debugging tools test the following capabilities:

1. **Text Generation (Q&A)** - Basic question answering
2. **Text Summarization** - Condensing long text into summaries
3. **Information Extraction** - Extracting structured data from text
4. **Translation** - Translating text between languages
5. **Data Analysis** - Analyzing and providing insights from data
6. **Code Generation** - Generating code from descriptions

## Understanding Test Results

### ✅ Success Indicators

- **Green checkmark** - Model processed successfully
- **Output text** - Actual AI-generated response (not fallback)
- **Duration** - Response time in milliseconds
- **No fallback warning** - Model is working correctly

### ⚠️ Warning Indicators

- **Yellow warning badge** - Model returned fallback response
- **"Fallback" label** - Model may not be working
- **Generic output** - Output starts with "Processed:" or "[AI Processing]"

### ❌ Error Indicators

- **Red X** - Test failed completely
- **Error message** - Specific error details
- **No output** - Model didn't return any response

## Common Issues and Solutions

### Issue 1: All Tests Show "Fallback" Response

**Symptoms:**
- All tests return outputs starting with "Processed:" or "[AI Processing]"
- No actual AI-generated content

**Solutions:**
1. **Check API Key Configuration**
   ```bash
   # Verify API key is set in Supabase
   npx supabase secrets list --project-ref YOUR_PROJECT_REF
   ```

2. **Verify API Key Format**
   - Should start with `hf_`
   - Should be a valid HuggingFace API token
   - Get one from: https://huggingface.co/settings/tokens

3. **Check API Key Permissions**
   - Ensure the key has read access
   - Verify it hasn't expired
   - Check if you have sufficient credits/quota

### Issue 2: 401 Unauthorized Error

**Symptoms:**
- Error message contains "401" or "Unauthorized"
- Tests fail immediately

**Solutions:**
1. **Regenerate API Key**
   - Go to https://huggingface.co/settings/tokens
   - Create a new token
   - Update it in Supabase secrets

2. **Verify Secret Name**
   - Must be exactly: `HUGGINGFACE_API_KEY` (case-sensitive)
   - Check in Supabase dashboard: Settings → Edge Functions → Secrets

### Issue 3: 429 Rate Limit Error

**Symptoms:**
- Error message contains "429" or "Rate limit"
- Tests work sometimes but fail on retry

**Solutions:**
1. **Wait Before Retrying**
   - HuggingFace free tier has rate limits
   - Wait 30-60 seconds between test runs

2. **Reduce Test Frequency**
   - Don't run all tests repeatedly
   - Use custom test for specific scenarios

3. **Check Your Usage**
   - Visit https://huggingface.co/settings/billing
   - Monitor your API usage

### Issue 4: 503 Model Loading Error

**Symptoms:**
- Error message contains "503" or "loading"
- Tests fail but work on retry

**Solutions:**
1. **Wait and Retry**
   - Models need time to load on first use
   - Wait 10-30 seconds and try again

2. **Use Different Model**
   - Some models load faster than others
   - Try switching to a different model in the registry

### Issue 5: Timeout Errors

**Symptoms:**
- Tests take too long and timeout
- No response received

**Solutions:**
1. **Check Network Connection**
   - Ensure stable internet connection
   - Check if HuggingFace is accessible

2. **Increase Timeout (if needed)**
   - Default timeout is 60 seconds
   - Some models are slower than others

3. **Use Faster Models**
   - Mistral-7B is generally faster
   - CodeLlama may be slower for code generation

## Testing Specific Scenarios

### Test Custom Input

1. In the Model Tester component, enter your custom text
2. Click **"Test Custom Input"**
3. Review the output to verify model response

### Test Different Model Types

The system automatically selects models based on:
- **Text tasks** → Mistral-7B or Zephyr-7B
- **Code generation** → CodeLlama-7B
- **Image tasks** → Stable Diffusion
- **Audio tasks** → Whisper or Bark

### Verify Information Retrieval

To test if models retrieve information correctly:

1. **Test with specific questions:**
   ```
   "What are the main features of React?"
   ```

2. **Test with data extraction:**
   ```
   "Extract the dates and amounts from: Sales: Jan $1000, Feb $2000, Mar $3000"
   ```

3. **Test with analysis:**
   ```
   "Analyze this data: Q1: 100 units, Q2: 150 units, Q3: 200 units"
   ```

## Checking Supabase Function Logs

If tests are failing, check the detailed logs:

1. **Via Supabase Dashboard:**
   - Go to Edge Functions → `execute-multimodal-agent`
   - Click on "Logs" tab
   - Review error messages

2. **Via CLI:**
   ```bash
   npx supabase functions logs execute-multimodal-agent --project-ref YOUR_PROJECT_REF
   ```

3. **Look for:**
   - API key errors
   - Model loading messages
   - Rate limit warnings
   - Timeout errors

## Expected Response Times

- **Text Generation:** 2-5 seconds
- **Summarization:** 3-7 seconds
- **Translation:** 2-5 seconds
- **Code Generation:** 5-15 seconds
- **Analysis:** 3-8 seconds

If responses take significantly longer, there may be an issue.

## Model Registry

Available models are defined in:
```
supabase/functions/build-multimodal-agent/services/FreeModelRegistry.ts
```

Key models:
- **Mistral-7B-Instruct:** Text processing, Q&A, summarization
- **CodeLlama-7B:** Code generation
- **Stable Diffusion:** Image generation
- **Whisper:** Speech-to-text
- **BLIP:** Image understanding

## Verification Checklist

Use this checklist to verify everything is working:

- [ ] API key is set in Supabase secrets
- [ ] API key starts with `hf_`
- [ ] Basic text generation test passes
- [ ] Summarization test returns actual summary (not fallback)
- [ ] Information extraction test extracts structured data
- [ ] Translation test translates correctly
- [ ] Analysis test provides insights
- [ ] No "fallback" warnings in test results
- [ ] Response times are reasonable (< 15 seconds)
- [ ] Supabase function logs show no errors

## Getting Help

If issues persist:

1. **Check the test output** - Look for specific error messages
2. **Review Supabase logs** - Check Edge Function logs for details
3. **Test API key directly** - Use HuggingFace API directly to verify key works
4. **Check model availability** - Some models may be temporarily unavailable

## Next Steps

Once all tests pass:

1. ✅ Models are configured correctly
2. ✅ API connectivity is working
3. ✅ Models can retrieve information accurately
4. ✅ Ready for production use

You can now use the multimodal features with confidence!

