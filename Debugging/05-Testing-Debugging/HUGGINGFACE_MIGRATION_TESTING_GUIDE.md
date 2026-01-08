# Hugging Face Migration Testing Guide

## 🧪 Quick Test Procedure

### Step 1: Environment Setup

1. **Set Hugging Face API Key**:
   ```bash
   # In Supabase Dashboard → Edge Functions → Secrets
   HUGGINGFACE_API_KEY=hf_your_key_here
   ```

2. **Optional: Keep Gemini API Key** (for fallback testing):
   ```bash
   GEMINI_API_KEY=AIza_your_key_here
   ```

### Step 2: Deploy Updated Function

```bash
# From project root
npx supabase functions deploy generate-workflow
```

### Step 3: Basic Functionality Test

#### Test 1: Simple Workflow Generation

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-workflow \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a workflow that sends email when form is submitted",
    "mode": "create"
  }'
```

**Expected**:
- ✅ Response contains `nodes` and `edges` arrays
- ✅ Console logs show: `[AGENT] Using Hugging Face (qwen-7b)`
- ✅ Workflow includes: `form` trigger → `google_gmail` node
- ✅ Response time: < 30 seconds

#### Test 2: Complex Workflow Generation

**Request**:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-workflow \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a workflow that reads Google Sheets, processes data with JavaScript, and sends results to Slack",
    "mode": "create"
  }'
```

**Expected**:
- ✅ Workflow includes: `manual_trigger` → `google_sheets` → `javascript` → `slack_message`
- ✅ All nodes properly configured
- ✅ Edges connect nodes correctly
- ✅ Response time: < 45 seconds

#### Test 3: Fallback to Gemini

**Request** (temporarily disable HF key):
```bash
# Remove HUGGINGFACE_API_KEY from Supabase secrets
# Then test:
curl -X POST https://your-project.supabase.co/functions/v1/generate-workflow \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple workflow",
    "mode": "create"
  }'
```

**Expected**:
- ✅ Console logs show: `[AGENT] Falling back to Gemini...`
- ✅ Workflow generation succeeds
- ✅ Uses Gemini API as fallback

### Step 4: Validate Response Format

**Check Response Structure**:
```json
{
  "nodes": [
    {
      "id": "...",
      "type": "form",
      "data": { ... },
      "position": { ... }
    }
  ],
  "edges": [
    {
      "id": "...",
      "source": "...",
      "target": "..."
    }
  ]
}
```

**Validation Checklist**:
- [ ] `nodes` array exists and is non-empty
- [ ] Each node has: `id`, `type`, `data`, `position`
- [ ] `edges` array exists
- [ ] Each edge has: `id`, `source`, `target`
- [ ] All node IDs in edges exist in nodes
- [ ] Workflow starts with a trigger node
- [ ] All nodes are properly configured

### Step 5: Test All 7 Phases

The autonomous agent has 7 phases. Verify each phase logs correctly:

1. **Phase 0: Summarize & Clarify**
   - Log: `[PHASE 0] Summarizing and clarifying user goal...`

2. **Phase 1: Understand & Plan (Combined)**
   - Log: `[PHASE 1+2 COMBINED] Analysis and plan complete`

3. **Phase 3: Workflow Construction**
   - Log: `[PHASE 3] Workflow construction complete`

4. **Phase 4: Validation**
   - Log: `[PHASE 4] Validation complete`

5. **Phase 5: Error Handling**
   - Log: `[PHASE 5] Error handling complete` (if errors found)

6. **Phase 6: Goal Verification**
   - Log: `[PHASE 6] Goal verification complete`

### Step 6: Error Handling Tests

#### Test: Invalid API Key

```bash
# Set invalid HF key temporarily
HUGGINGFACE_API_KEY=hf_invalid_key
```

**Expected**:
- ✅ System falls back to Gemini (if configured)
- ✅ Error message is clear
- ✅ No crash or unhandled exception

#### Test: Rate Limit Handling

**Expected**:
- ✅ System automatically retries with backoff
- ✅ Logs show: `[HF] Rate limit hit, waiting...`
- ✅ Eventually succeeds or falls back

#### Test: Model Loading (503 Error)

**Expected**:
- ✅ System waits for model to load
- ✅ Logs show: `[HF Inference] Model loading, waiting...`
- ✅ Retries automatically

### Step 7: Performance Tests

#### Test: Response Time

**Measure**:
- Simple workflow: Should be < 20 seconds
- Complex workflow: Should be < 45 seconds
- With fallback: Should be < 60 seconds

#### Test: Memory Usage

**Monitor**:
- Edge function memory usage
- Should stay within Supabase limits
- No memory leaks

#### Test: Concurrent Requests

**Test**:
- Send 3-5 concurrent requests
- All should complete successfully
- Response times should be reasonable

### Step 8: Integration Tests

#### Test: Frontend Integration

1. Open workflow creation UI
2. Enter a prompt
3. Click "Generate Workflow"
4. Verify workflow appears correctly
5. Verify nodes are draggable and editable

#### Test: Workflow Execution

1. Generate a workflow
2. Save it to database
3. Execute the workflow
4. Verify execution succeeds
5. Verify expected outputs

### Step 9: Regression Tests

Verify existing workflows still work:

- [ ] Form submission workflows
- [ ] Webhook-triggered workflows
- [ ] Scheduled workflows
- [ ] Complex multi-node workflows
- [ ] Workflows with Google integrations
- [ ] Workflows with Slack integrations

## 📊 Monitoring & Validation

### Key Metrics to Monitor

1. **Success Rate**: Should be > 95%
2. **Response Time**: Average < 30 seconds
3. **Error Rate**: < 5%
4. **Fallback Rate**: Monitor how often fallback occurs
5. **API Quota Usage**: Monitor Hugging Face API usage

### Log Analysis

**Success Indicators**:
```
[AGENT] Using Hugging Face (qwen-7b)
[HF] Success with model: Qwen/Qwen2.5-7B-Instruct
[PHASE 3] Workflow construction complete
```

**Fallback Indicators**:
```
[AGENT] Primary provider (huggingface) failed: ...
[AGENT] Falling back to Gemini...
[AGENT] Using Gemini fallback (gemini-2.5-flash)
```

### Dashboard Checks

1. **Supabase Edge Function Logs**:
   - Check for errors
   - Monitor response times
   - Check API key issues

2. **Hugging Face Dashboard**:
   - Monitor API usage
   - Check rate limits
   - Monitor model availability

## 🐛 Troubleshooting Tests

### Issue: "HuggingFace API key not configured"

**Test**:
```bash
# Verify key is set
echo $HUGGINGFACE_API_KEY
```

**Fix**:
- Set key in Supabase Dashboard → Edge Functions → Secrets

### Issue: "Model not supported"

**Test**:
- Check model name in logs
- Verify model exists on Hugging Face

**Fix**:
- System should automatically fall back to Inference API
- If persists, check model name mapping

### Issue: "Request timeout"

**Test**:
- Check network connectivity
- Verify model is available
- Check response time

**Fix**:
- System retries automatically
- If persists, check Hugging Face status

### Issue: "All models failed"

**Test**:
- Check both API keys
- Verify network connectivity
- Check Supabase logs

**Fix**:
- Verify API keys are correct
- Check Hugging Face/Gemini API status
- Review error logs

## ✅ Final Validation Checklist

Before considering migration complete:

- [ ] All basic tests pass
- [ ] All complex tests pass
- [ ] Fallback mechanism works
- [ ] Error handling works
- [ ] Performance is acceptable
- [ ] No regressions in existing workflows
- [ ] Logging is clear and helpful
- [ ] Documentation is updated
- [ ] Team is trained on new system

## 🎉 Success Criteria

Migration is successful when:

1. ✅ Workflows generate correctly using Hugging Face
2. ✅ Response times are acceptable (< 30s)
3. ✅ Error rate is low (< 5%)
4. ✅ Fallback to Gemini works when needed
5. ✅ No regressions in existing functionality
6. ✅ All team members can use the new system
7. ✅ Monitoring and logging are in place

## 📝 Test Results Template

```
Migration Test Results
=====================
Date: [DATE]
Tester: [NAME]

Basic Tests:
- Simple workflow: ✅ / ❌
- Complex workflow: ✅ / ❌
- Response format: ✅ / ❌

Fallback Tests:
- HF → Gemini fallback: ✅ / ❌
- Error handling: ✅ / ❌

Performance Tests:
- Response time (simple): [TIME]s
- Response time (complex): [TIME]s
- Memory usage: [USAGE]

Integration Tests:
- Frontend integration: ✅ / ❌
- Workflow execution: ✅ / ❌

Regression Tests:
- Existing workflows: ✅ / ❌
- All node types: ✅ / ❌

Issues Found:
1. [ISSUE]
2. [ISSUE]

Overall Status: ✅ PASS / ❌ FAIL
```

