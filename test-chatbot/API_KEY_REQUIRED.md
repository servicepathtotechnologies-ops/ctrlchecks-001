# API Key Now Required - Update Guide

## ✅ What Changed

**All AI nodes now require users to provide their own API keys.**

- ❌ Removed: `LOVABLE_API_KEY` fallback
- ✅ Required: Users must add API key in node properties
- ✅ UI: Red asterisk (*) shows required fields

---

## 🔧 Updated Nodes

These nodes now **require** API key:

1. **OpenAI GPT** - Requires OpenAI API key
2. **Anthropic Claude** - Requires Anthropic API key  
3. **Google Gemini** - Requires Google Gemini API key
4. **Text Summarizer** - Requires API key
5. **Sentiment Analyzer** - Requires API key

---

## 📝 How to Use

### Step 1: Get Your API Key

**For Google Gemini:**
1. Go to: https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)

**For OpenAI:**
1. Go to: https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-...`)

**For Anthropic Claude:**
1. Go to: https://console.anthropic.com/settings/keys
2. Create API key
3. Copy the key (starts with `sk-ant-...`)

### Step 2: Add to Workflow Node

1. **Open your workflow** in CtrlChecks
2. **Click on the AI node** (GPT/Gemini/Claude)
3. **In Properties Panel:**
   - Find "API Key" field (marked with red *)
   - Paste your API key
   - Save the workflow

### Step 3: Test

1. Run the workflow
2. Should work with your API key!

---

## ⚠️ Important Notes

- **API keys are stored in workflow node config**
- **Each node can have its own API key**
- **No fallback keys** - you must provide your own
- **Keys are encrypted** in database (via Supabase)

---

## 🚨 Error Messages

If you see these errors, add your API key:

- `"API Key is required for Google Gemini node. Please add your Gemini API key in the node properties."`
- `"API Key is required for OpenAI GPT node. Please add your API key in the node properties."`
- `"API Key is required for Anthropic Claude node. Please add your API key in the node properties."`

---

## 🔒 Security

- API keys are stored per-node in workflow config
- Keys are not exposed in logs
- Each user manages their own keys
- No shared/default keys

---

## ✅ Benefits

- ✅ **User control** - Each user uses their own API keys
- ✅ **No shared limits** - Your usage, your quota
- ✅ **Better security** - No centralized key storage
- ✅ **Flexibility** - Different keys for different nodes

---

**Update your workflow nodes with API keys and you're ready to go! 🚀**

