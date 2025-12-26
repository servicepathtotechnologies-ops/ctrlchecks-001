# Testing Your Chatbot Webhook

## ✅ Your Webhook URL is Configured

Your webhook URL is now set in `script.js`:
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/53250865-7484-4aa9-9517-7317f4943223
```

---

## 🧪 How to Test

### Method 1: Using the HTML Test Page (Recommended)

1. **Open** `test-chatbot/index.html` in your browser
2. **Type a message** (e.g., "Hello")
3. **Click Send** or press Enter
4. **Wait for response** - you'll see typing animation
5. **Bot responds** in real-time!

### Method 2: Using cURL (Command Line)

```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/53250865-7484-4aa9-9517-7317f4943223" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

**Expected Response:**
```json
{
  "success": true,
  "reply": "Hello! I'm doing well, thank you for asking. How can I help you today?",
  "executionId": "..."
}
```

### Method 3: Using JavaScript (Browser Console)

Open browser console (F12) and run:

```javascript
fetch('https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/53250865-7484-4aa9-9517-7317f4943223', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' })
})
.then(r => r.json())
.then(data => console.log(data));
```

---

## 📋 Request Format

### What to Send:

```json
{
  "message": "Your message here"
}
```

### What You'll Receive:

```json
{
  "success": true,
  "reply": "AI response here",
  "executionId": "execution-uuid"
}
```

---

## 🔍 Troubleshooting

### Issue: "Workflow execution started" but no reply

**Check:**
1. ✅ Workflow has **Webhook node** connected to **AI node**
2. ✅ AI node has **API key** configured (required!)
3. ✅ AI node **Input** is set to `{{trigger.message}}`
4. ✅ Workflow status is **"active"**

### Issue: "API Key is required" error

**Solution:**
1. Open workflow in CtrlChecks
2. Click on Gemini/GPT/Claude node
3. Add your API key in Properties Panel
4. Save workflow

### Issue: CORS error

**Solution:**
- The webhook already has CORS enabled
- If you see CORS error, check browser console
- Make sure you're testing from `file://` or `http://localhost`

### Issue: 404 Not Found

**Check:**
- Webhook URL is correct
- Workflow ID matches your workflow
- Webhook is enabled in workflow settings

---

## ✅ Quick Checklist

Before testing, ensure:

- [ ] Webhook URL is correct in `script.js`
- [ ] Workflow has Webhook → AI node connection
- [ ] AI node has API key configured
- [ ] AI node input is `{{trigger.message}}`
- [ ] Workflow is saved
- [ ] Webhook is enabled
- [ ] Workflow status is "active"

---

## 🎯 Expected Flow

```
1. User types "Hello" in HTML
   ↓
2. HTML sends: POST {message: "Hello"} to webhook
   ↓
3. Webhook receives → Passes to workflow
   ↓
4. Webhook node outputs: {message: "Hello"}
   ↓
5. AI node receives via {{trigger.message}}
   ↓
6. AI processes → Returns: "Hello! How can I help?"
   ↓
7. Webhook extracts response → Returns: {reply: "Hello! How can I help?"}
   ↓
8. HTML displays bot message with typing animation
```

---

## 🚀 Ready to Test!

1. **Open** `test-chatbot/index.html`
2. **Send a message**
3. **See real-time response!**

**Your chatbot is ready! 🎉**

