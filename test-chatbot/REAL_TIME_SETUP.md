# Real-Time Chatbot Setup - Quick Guide

## ✅ What's Been Updated

The webhook now returns AI responses in **real-time**! Here's what changed:

### 1. Webhook Function (`webhook-trigger/index.ts`)
- ✅ Now **waits** for workflow execution to complete
- ✅ **Extracts** AI response from execution output
- ✅ Returns response in format: `{reply: "AI response here"}`
- ✅ Handles errors gracefully

### 2. Test Chatbot (`script.js`)
- ✅ Handles response extraction from multiple formats
- ✅ Added **typing animation** for bot messages
- ✅ Better error handling and display

### 3. Styling (`style.css`)
- ✅ Added typing indicator animation
- ✅ Smooth message appearance

---

## 🚀 How to Set Up Real-Time Chat

### Step 1: Create Workflow

1. **Add Webhook Node** (Trigger)
   - Drag "Webhook" from Triggers
   - Properties: Method = `POST` (default)

2. **Add AI Node** (Processing)
   - Drag "OpenAI GPT" or "Google Gemini"
   - **Connect Webhook → AI Node**
   - **Properties:**
     - **System Prompt**: `"You are a friendly, helpful chatbot. Keep responses short and warm."`
     - **Input/Message**: `{{trigger.message}}` ⚠️ **IMPORTANT!**
     - **Model**: `gpt-4o-mini` or `gemini-pro`
     - **Temperature**: `0.7`

3. **Save & Enable Webhook**
   - Save workflow
   - Click "Webhook" button → Enable
   - Copy webhook URL
   - Set status to **"active"**

### Step 2: Update Test Page

1. **Open** `test-chatbot/script.js`
2. **Replace** `YOUR_WEBHOOK_URL_HERE` with your webhook URL:
   ```javascript
   const WEBHOOK_URL = 'https://your-project.supabase.co/functions/v1/webhook-trigger/your-workflow-id';
   ```

### Step 3: Test

1. **Open** `test-chatbot/index.html` in browser
2. **Type a message** → Click Send
3. **See typing animation** → Bot responds in real-time!

---

## 🔑 Key Configuration

### AI Node Input Property

**CRITICAL:** Set the AI node's input to:
```
{{trigger.message}}
```

This passes the user's message from the webhook to the AI.

### How It Works:

```
User types "Hello"
    ↓
HTML sends: {message: "Hello"} to webhook
    ↓
Webhook receives → Passes to workflow
    ↓
Webhook node outputs: {message: "Hello"}
    ↓
AI node receives via {{trigger.message}}
    ↓
AI processes → Returns: "Hello! How can I help?"
    ↓
Webhook extracts response → Returns: {reply: "Hello! How can I help?"}
    ↓
HTML displays bot message with typing animation
```

---

## 🎨 Features

### Real-Time Response
- Webhook waits for execution
- Returns AI response immediately
- No polling needed

### Typing Animation
- Shows "typing..." indicator
- Messages appear character by character
- Smooth, chat-like experience

### Error Handling
- Graceful error messages
- Console logging for debugging
- User-friendly error display

---

## 🐛 Troubleshooting

### Issue: "Workflow execution started" but no reply

**Solution:**
1. Check AI node input is set to `{{trigger.message}}`
2. Verify workflow is "active"
3. Check execution logs in CtrlChecks
4. Verify AI API key is set

### Issue: Response is empty or wrong format

**Solution:**
1. The webhook automatically extracts AI output
2. Make sure AI node is the last node (or only connected node)
3. Check execution logs to see what AI returned

### Issue: Typing animation doesn't show

**Solution:**
1. Check browser console for errors
2. Verify CSS file is loaded
3. Try refreshing the page

---

## 📋 Quick Checklist

- [ ] Webhook node added
- [ ] AI node added and connected to Webhook
- [ ] AI node input set to `{{trigger.message}}`
- [ ] System prompt configured
- [ ] Workflow saved
- [ ] Webhook enabled
- [ ] Workflow status = "active"
- [ ] Webhook URL copied
- [ ] `script.js` updated with webhook URL
- [ ] Test page opens in browser

---

## 🎯 Expected Behavior

1. **User sends message** → Appears immediately in chat
2. **Loading indicator** shows "Thinking..."
3. **Typing animation** appears (3 dots)
4. **Bot response** types out character by character
5. **Ready for next message**

---

**You're all set for real-time chatting! 🎉**

