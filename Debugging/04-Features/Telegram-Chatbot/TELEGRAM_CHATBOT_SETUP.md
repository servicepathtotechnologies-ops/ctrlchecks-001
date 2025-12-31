# Telegram Chatbot Setup Guide
## Workflow: Webhook → Text Formatter → Gemini → Telegram

Complete step-by-step guide to create a working Telegram chatbot.

---

## 🎯 Workflow Structure

```
Telegram Message → Webhook → Text Formatter → Google Gemini → Telegram Response
```

---

## ✅ Step 1: Create Telegram Bot

### 1.1 Get Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow prompts to create your bot
4. **Copy the Bot Token** (format: `123456789:ABC-DEF...`)

### 1.2 Get Your Chat ID

1. Search for **@userinfobot** on Telegram
2. Send `/start`
3. **Copy your Chat ID** (a number like `123456789`)

---

## 🔧 Step 2: Create Workflow in CtrlChecks

### 2.1 Create New Workflow

1. Go to CtrlChecks dashboard
2. Click **"New Workflow"**
3. Name it: **"Telegram Chatbot"**

### 2.2 Add Nodes in This Order

1. **Webhook** (Trigger)
2. **Text Formatter** (Extract message)
3. **Google Gemini** (AI processing)
4. **Telegram** (Send response)

---

## ⚙️ Step 3: Configure Each Node

### Node 1: Webhook

**Configuration:**
- **Method**: `POST` (default)
- **No other settings needed**

**What it does:** Receives Telegram updates

**Output:** The webhook outputs Telegram data with message at `message.text`

---

### Node 2: Text Formatter

**Configuration:**
- **Template**: `{{message.text}}`

**What it does:** Extracts the message text from Telegram update

**Important:** This extracts just the text string, which Gemini needs

---

### Node 3: Google Gemini

**Configuration:**

| Property | Value |
|---------|-------|
| **API Key** | Your Google Gemini API key (or leave empty for default) |
| **Model** | `gemini-pro` or `gemini-2.5-flash` |
| **System Prompt** | `You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.` |
| **Input/Message** | `{{input}}` |
| **Temperature** | `0.7` |
| **Max Tokens** | `150` (optional) |

**What it does:** Processes the user's message and generates a response

**Important:** The input comes from Text Formatter, which is already a string (the message text)

---

### Node 4: Telegram

**Configuration:**

| Property | Value |
|---------|-------|
| **Bot Token** | Your bot token from @BotFather (e.g., `123456789:ABC-DEF...`) |
| **Chat ID** | `{{message.chat.id}}` |
| **Message** | `{{input}}` or `{{input.response}}` or `{{input.message}}` or `{{input.content}}` |

**What it does:** Sends the AI response back to Telegram

**Important:** 
- Chat ID uses `{{message.chat.id}}` to get the chat ID from the original webhook data
- Message uses `{{input}}` to get Gemini's response

---

## 🔗 Step 4: Connect Nodes

Connect them in this order:
1. **Webhook** → **Text Formatter**
2. **Text Formatter** → **Google Gemini**
3. **Google Gemini** → **Telegram**

---

## 🌐 Step 5: Set Up Telegram Webhook

### 5.1 Get Your Webhook URL

1. **Save your workflow** in CtrlChecks
2. Click on the **Webhook node**
3. Click **"Enable"** or **"Activate"**
4. **Copy the webhook URL**
   - Format: `https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID`

### 5.2 Set Telegram Webhook

**Open this URL in your browser** (replace with your values):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>
```

**Example:**
```
https://api.telegram.org/bot123456789:ABC-DEF.../setWebhook?url=https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/65e9137e-8e41-409d-8277-3715a714080b
```

**Expected Response:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 5.3 Verify Webhook

Check if webhook is set:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

You should see your webhook URL in the response.

---

## 🧪 Step 6: Test Your Bot

1. **Open Telegram**
2. **Search for your bot** (the username you created)
3. **Send a message**: "Hello"
4. **Wait for response** - The bot should reply!

---

## 📋 Complete Node Configuration Summary

### Webhook Node
```json
{
  "type": "webhook",
  "config": {
    "method": "POST"
  }
}
```

### Text Formatter Node
```json
{
  "type": "text_formatter",
  "config": {
    "template": "{{message.text}}"
  }
}
```

### Google Gemini Node
```json
{
  "type": "google_gemini",
  "config": {
    "apiKey": "YOUR_API_KEY",
    "model": "gemini-pro",
    "systemPrompt": "You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.",
    "input": "{{input}}",
    "temperature": 0.7
  }
}
```

### Telegram Node
```json
{
  "type": "telegram",
  "config": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "{{message.chat.id}}",
    "message": "{{input}}"
  }
}
```

---

## 🔍 How It Works

1. **User sends message** on Telegram → "Hello"
2. **Telegram sends update** to your webhook URL
3. **Webhook node** receives: `{message: {text: "Hello", chat: {id: 123456789}}}`
4. **Text Formatter** extracts: `"Hello"` (just the text string)
5. **Gemini** processes: Takes "Hello" → Generates response "Hello! How can I help you?"
6. **Telegram node** sends: Uses `{{message.chat.id}}` to get chat ID, sends response back

---

## ❌ Common Issues & Fixes

### Issue: "Invalid value at 'contents[0].parts[1]'" Error

**Problem:** Gemini is receiving an object instead of a string

**Fix:** 
- Make sure Text Formatter template is exactly: `{{message.text}}`
- This extracts just the text string, not the whole object

### Issue: Bot Not Responding

**Check:**
1. Webhook is set: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Workflow is active in CtrlChecks
3. Bot token is correct
4. Chat ID expression is `{{message.chat.id}}`

### Issue: Wrong Chat ID

**Problem:** Message goes to wrong chat or fails

**Fix:** 
- Telegram node Chat ID must be: `{{message.chat.id}}`
- This gets the chat ID from the original webhook data

### Issue: Webhook Not Receiving Updates

**Fix:**
1. Verify webhook URL is set correctly
2. Check webhook URL is HTTPS (required by Telegram)
3. Ensure workflow is saved and active
4. Test by sending a message to your bot

---

## 📝 Quick Reference

### Set Telegram Webhook
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WEBHOOK_URL>
```

### Check Webhook Status
```
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

### Delete Webhook (if needed)
```
https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook?drop_pending_updates=true
```

---

## ✅ Final Checklist

- [ ] Created Telegram bot with @BotFather
- [ ] Got bot token
- [ ] Created workflow in CtrlChecks
- [ ] Added Webhook node (Method: POST)
- [ ] Added Text Formatter (Template: `{{message.text}}`)
- [ ] Added Google Gemini (Input: `{{input}}`, System Prompt configured)
- [ ] Added Telegram node (Chat ID: `{{message.chat.id}}`, Message: `{{input}}`)
- [ ] Connected all nodes in order
- [ ] Saved workflow
- [ ] Enabled webhook and copied URL
- [ ] Set Telegram webhook using API
- [ ] Verified webhook is set
- [ ] Tested bot by sending a message

---

## 🎉 You're Done!

Your Telegram chatbot should now be working. Send a message to your bot and it will respond using Google Gemini!

---

**Need Help?** Check the execution logs in CtrlChecks to see what data is passing through each node.

