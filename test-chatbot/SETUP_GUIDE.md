# Complete Setup Guide: Chatbot Webhook Workflow

## 📋 Overview

This guide explains how to:
1. Create a chatbot workflow in CtrlChecks
2. Connect the nodes properly
3. Configure node properties
4. Connect the HTML test page to your webhook

---

## 🎯 PART 1: Creating the Workflow

### Step 1: Create New Workflow

1. Go to CtrlChecks dashboard
2. Click "New Workflow"
3. Name it: "Chatbot Webhook Test"

### Step 2: Add Webhook Trigger Node

1. **Drag "Webhook" node** from the node library (Triggers category)
2. **Place it on the canvas** (this is your starting point)
3. **Properties to set:**
   - **Method**: `POST` (default)
   - No other configuration needed for basic setup

**What this does:**
- Receives HTTP POST requests
- Passes request data to next node
- The `message` from request body becomes available as `{{trigger.message}}`

---

## 🤖 PART 2: Adding AI Processing

### Step 3: Add AI Node

1. **Drag "OpenAI GPT"** or **"Google Gemini"** node from AI Processing category
2. **Connect it to Webhook node:**
   - Click on the Webhook node
   - Drag from the output handle (right side)
   - Connect to the AI node's input handle (left side)

3. **Configure AI Node Properties:**

#### For OpenAI GPT:
- **API Key**: (Optional - uses default if empty)
- **Model**: `gpt-4o` or `gpt-4o-mini` (recommended)
- **System Prompt**: 
  ```
  You are a friendly, helpful, and concise chatbot for a website. 
  Keep your responses short (2-3 sentences max), warm, and helpful. 
  Be conversational but professional.
  ```
- **Temperature**: `0.7` (default)
- **Input/Message**: `{{trigger.message}}` (this passes the user's message)

#### For Google Gemini:
- **API Key**: (Optional - uses default if empty)
- **Model**: `gemini-pro` or `gemini-2.5-flash`
- **System Prompt**: Same as above
- **Temperature**: `0.7`
- **Input/Message**: `{{trigger.message}}`

**What this does:**
- Takes the user's message from webhook
- Sends it to AI with system prompt
- Returns AI-generated response

---

## 📤 PART 3: Returning the Response (Optional)

### Step 4: Understanding Response Flow

**IMPORTANT:** The webhook now waits for workflow execution and automatically extracts the AI response!

**How it works:**
1. Webhook receives your message
2. Passes it to AI node via `{{trigger.message}}`
3. AI node processes and returns response
4. Webhook extracts the AI output from execution logs
5. Returns it as `{reply: "AI response here"}`

**No additional nodes needed!** The AI node output is automatically returned.

---

## 🔗 PART 4: Connecting Nodes - Visual Guide

```
┌─────────────┐
│   Webhook   │  ← Receives POST request with {message: "user text"}
│   Trigger   │
└──────┬──────┘
       │
       │ (connects to)
       │
       ▼
┌─────────────┐
│  OpenAI GPT │  ← Processes message, returns AI response
│   (or)      │
│   Gemini    │
└─────────────┘
```

### How to Connect:

1. **Click on Webhook node** - you'll see a small circle on the right edge
2. **Click and drag** from that circle
3. **Drag to AI node** - you'll see a circle on the left edge
4. **Release** - a line connects them
5. **Connection is complete!**

---

## ⚙️ PART 5: Enabling Webhook

### Step 5: Enable Webhook in Workflow

1. **Save your workflow** (click Save button)
2. **Click "Webhook" button** in the workflow header
3. **Toggle "Enable Webhook"** to ON
4. **Copy the Webhook URL** that appears
   - Example: `https://xxxxx.supabase.co/functions/v1/webhook-trigger/abc-123-def`

### Step 6: Activate Workflow

1. **Set workflow status to "active"**
   - In workflow settings or header
   - Status dropdown → Select "active"

**Important:** Webhook only works if workflow is "active"

---

## 🌐 PART 6: Connecting HTML Test Page

### Step 7: Update script.js

1. **Open** `test-chatbot/script.js`
2. **Find this line** (near the top):
   ```javascript
   const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';
   ```
3. **Replace with your webhook URL:**
   ```javascript
   const WEBHOOK_URL = 'https://xxxxx.supabase.co/functions/v1/webhook-trigger/abc-123-def';
   ```
4. **Save the file**

### Step 8: Open Test Page

1. **Open** `test-chatbot/index.html` in your browser
2. **Type a message** and click Send
3. **Wait for response** from your chatbot

---

## 📝 PART 7: Node Properties Summary

### Webhook Node Properties:
```
Type: webhook
Method: POST (default)
Config: {} (empty - no special config needed)
```

### AI Node Properties (OpenAI GPT):
```
Type: openai_gpt
API Key: (optional - leave empty to use default)
Model: gpt-4o-mini (recommended for testing)
System Prompt: "You are a friendly, helpful chatbot..."
Temperature: 0.7
Input: {{trigger.message}}
```

### AI Node Properties (Google Gemini):
```
Type: google_gemini
API Key: (optional - leave empty to use default)
Model: gemini-pro
System Prompt: "You are a friendly, helpful chatbot..."
Temperature: 0.7
Input: {{trigger.message}}
```

---

## 🔍 PART 8: Testing & Troubleshooting

### Test the Connection:

1. **Open browser console** (F12)
2. **Send a message** from test page
3. **Check console** for any errors

### Common Issues:

#### Issue: "CORS error"
**Solution:** The webhook-trigger function already has CORS enabled. If you see this, check:
- Webhook URL is correct
- Workflow is active
- Browser isn't blocking requests

#### Issue: "404 Not Found"
**Solution:**
- Verify webhook URL is correct
- Check workflow ID in URL matches your workflow
- Ensure webhook is enabled in workflow settings

#### Issue: "No response"
**Solution:**
- Check workflow execution logs
- Verify AI node is configured correctly
- Check API keys are set (if using custom keys)
- Ensure workflow status is "active"

#### Issue: "Invalid response format"
**Solution:**
- The webhook returns execution output
- Check execution logs to see what's being returned
- Modify workflow to format response correctly

---

## 🎨 PART 9: Advanced Configuration

### Custom Response Format:

If you want to return a specific format, add a "Data Transform" node:

1. **Add "JSON" node** after AI node
2. **Configure to format response:**
   ```json
   {
     "reply": "{{openai_gpt.output}}"
   }
   ```
3. **This ensures consistent response format**

### Adding Memory:

1. **Add "Memory" node** before AI node
2. **Connect Webhook → Memory → AI**
3. **Memory stores conversation context**
4. **AI can access previous messages**

### Error Handling:

1. **Add "If/Else" node** after AI node
2. **Check if AI response is valid**
3. **Return fallback message if error**

---

## ✅ Checklist

Before testing, make sure:

- [ ] Webhook node is added to workflow
- [ ] AI node is connected to Webhook node
- [ ] AI node properties are configured
- [ ] System prompt is set in AI node
- [ ] Input is set to `{{trigger.message}}`
- [ ] Workflow is saved
- [ ] Webhook is enabled in workflow settings
- [ ] Workflow status is "active"
- [ ] Webhook URL is copied
- [ ] `script.js` has correct webhook URL
- [ ] Test page opens in browser

---

## 🚀 Quick Start Summary

1. **Create workflow** → Add Webhook node → Add AI node → Connect them
2. **Configure AI node** → Set system prompt → Set input to `{{trigger.message}}`
3. **Enable webhook** → Save workflow → Toggle webhook ON → Copy URL
4. **Update script.js** → Replace `YOUR_WEBHOOK_URL_HERE` with your URL
5. **Test** → Open index.html → Send message → See response!

---

## 📞 Need Help?

- Check workflow execution logs in CtrlChecks
- Open browser console (F12) for JavaScript errors
- Verify webhook URL is accessible
- Test webhook with curl:
  ```bash
  curl -X POST "YOUR_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{"message": "Hello"}'
  ```

---

**You're all set! Happy testing! 🎉**

