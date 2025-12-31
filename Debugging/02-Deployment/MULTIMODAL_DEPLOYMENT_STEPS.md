# 🚀 Multimodal Agent Builder - Deployment Steps

Now that you've set up your API keys, follow these steps to deploy and test the system.

---

## ✅ Step 1: Verify API Keys Are Set

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Edge Functions** → **Secrets** (or **Project Settings** → **Edge Functions** → **Secrets**)
3. Verify you have at least:
   - ✅ `HUGGINGFACE_API_KEY` (Required)
   - ⚠️ `REPLICATE_API_TOKEN` (Optional)
   - ⚠️ `GROQ_API_KEY` (Optional)

---

## 📦 Step 2: Deploy the Edge Function

You have two options:

### Option A: Deploy via Supabase CLI (Recommended)

Open your terminal in the project root and run:

```bash
# Deploy the multimodal agent builder function
npx supabase functions deploy build-multimodal-agent
```

**If you get "Not logged in" error:**
```bash
# First, login to Supabase
npx supabase login

# Then link your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Now deploy
npx supabase functions deploy build-multimodal-agent
```

**To find your Project Ref:**
- Go to Supabase Dashboard → Project Settings → General
- Look for "Reference ID" (it's a string like `nvrrqvlqnnvlihtlgmzn`)

### Option B: Deploy via Supabase Dashboard

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Edge Functions**
3. Click **"Create a new function"** or **"Deploy function"**
4. Upload the function folder:
   - Function name: `build-multimodal-agent`
   - Upload folder: `supabase/functions/build-multimodal-agent/`
5. Click **"Deploy"**

---

## ✅ Step 3: Verify Deployment

1. Go to **Supabase Dashboard** → **Edge Functions**
2. You should see `build-multimodal-agent` in the list
3. Status should be **"Active"** ✅

---

## 🧪 Step 4: Test the System

### Test 1: Access the Builder Page

1. **Start your development server** (if not running):
   ```bash
   npm run dev
   ```

2. **Navigate to the Multimodal Builder:**
   - Go to: `http://localhost:5173/multimodal`
   - Or click the **"Multimodal"** button on the Dashboard

### Test 2: Try a Simple Prompt

Try this test prompt:
```
Summarize this text: "Artificial intelligence is transforming how we work and live. AI can help automate tasks, analyze data, and make predictions."
```

**Expected behavior:**
- ✅ Logs appear in the right panel
- ✅ System analyzes the prompt
- ✅ UI template is generated
- ✅ No errors in browser console

### Test 3: Check Browser Console

1. Open **Developer Tools** (F12)
2. Go to **Console** tab
3. Look for any errors
4. If you see errors, check:
   - Is the Edge Function deployed?
   - Are API keys set correctly?
   - Is the function name correct?

---

## 🐛 Troubleshooting

### Error: "Function not found"

**Solution:**
```bash
# Verify function exists
ls supabase/functions/build-multimodal-agent

# Redeploy
npx supabase functions deploy build-multimodal-agent
```

### Error: "HuggingFace API key not configured"

**Solution:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Verify `HUGGINGFACE_API_KEY` exists
3. Check the value starts with `hf_`
4. Redeploy the function after adding secrets:
   ```bash
   npx supabase functions deploy build-multimodal-agent
   ```

### Error: "Failed to invoke function"

**Solution:**
1. Check Supabase Dashboard → Edge Functions → Logs
2. Look for error messages
3. Verify API keys are correct
4. Check function code for syntax errors

### Function Deployed But Not Working

**Solution:**
1. Check **Edge Functions Logs** in Supabase Dashboard
2. Look for runtime errors
3. Verify API keys are accessible:
   ```bash
   # Test if secrets are accessible (values are hidden)
   npx supabase secrets list
   ```

---

## ✅ Step 5: Success Checklist

- [ ] API keys added to Supabase secrets
- [ ] Edge Function deployed successfully
- [ ] Function shows as "Active" in dashboard
- [ ] Can access `/multimodal` page
- [ ] Test prompt works without errors
- [ ] Logs appear in the right panel
- [ ] UI template is generated

---

## 🎉 You're Ready!

Once all steps are complete, your Multimodal Agent Builder is fully operational!

### Next Steps:

1. **Try different prompts:**
   - "Generate an image of a sunset"
   - "Convert speech to text"
   - "Create a Python script to sort a list"

2. **Explore the generated UI:**
   - Check the input/output sections
   - See the workflow visualization
   - Review model usage stats

3. **Save workflows:**
   - Generated workflows can be saved to your workflow library
   - They'll appear in your Dashboard

---

## 📚 Additional Resources

- **API Keys Guide:** See `API_KEYS_SETUP_GUIDE.md`
- **Full Documentation:** See `MULTIMODAL_AGENT_BUILDER_README.md`
- **Supabase Docs:** https://supabase.com/docs/guides/functions

---

## 🆘 Need Help?

If you encounter issues:

1. **Check Edge Function Logs** in Supabase Dashboard
2. **Verify API keys** are set correctly
3. **Test with a simple prompt** first
4. **Check browser console** for frontend errors
5. **Review the troubleshooting section** above

Happy building! 🚀

