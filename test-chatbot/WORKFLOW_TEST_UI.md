# Workflow Test UI - Quick Start Guide

## ✅ What's Included

This test UI template is pre-configured with your webhook URL:
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/7603163d-abfd-4d82-a71f-064864810461
```

## 🚀 How to Use

### Step 1: Open the Test Page

1. Navigate to the `test-chatbot` folder
2. Open `index.html` in your web browser
   - You can double-click the file, or
   - Right-click → "Open with" → Your browser

### Step 2: Test Your Workflow

1. **Type a message** in the input field (e.g., "Hello, how are you?")
2. **Click Send** or press Enter
3. **Wait for response** - you'll see a typing indicator
4. **Bot responds** with the workflow output!

## 📋 Features

- ✅ **Real-time chat interface** - Clean, modern UI
- ✅ **Typing animation** - Shows bot is thinking
- ✅ **Session management** - Maintains conversation context
- ✅ **Error handling** - Displays helpful error messages
- ✅ **Mobile responsive** - Works on all devices

## 🔧 Configuration

The webhook URL is already configured in `script.js`:
```javascript
const WEBHOOK_URL = "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/7603163d-abfd-4d82-a71f-064864810461";
```

If you need to change it, edit `script.js` and update the `WEBHOOK_URL` constant.

## 📝 Request Format

The UI sends requests in this format:
```json
{
  "message": "Your message here",
  "session_id": "session_1234567890_abc123"
}
```

The `session_id` is automatically generated and stored in browser localStorage to maintain conversation context.

## 🎯 Expected Response Format

The webhook should return:
```json
{
  "success": true,
  "reply": "AI response here",
  "executionId": "execution-uuid"
}
```

## 🔍 Troubleshooting

### Issue: "Chat Trigger: message is required"

**Solution:** Make sure your workflow's first node is a **Chat Trigger** node, not a Webhook node. The Chat Trigger expects:
- `message` field (required)
- `session_id` field (optional, auto-generated)

### Issue: No response or error message

**Check:**
1. ✅ Workflow status is **"active"**
2. ✅ Webhook is **enabled** for the workflow
3. ✅ All nodes have required **API keys** configured
4. ✅ Workflow nodes are **properly connected**

### Issue: CORS errors

**Solution:** The webhook function already includes CORS headers. If you see CORS errors, check:
- The webhook URL is correct
- The workflow exists and is active
- Browser console for specific error messages

## 📱 Testing Different Scenarios

### Test 1: Simple Message
```
User: "Hello"
Expected: Bot responds with greeting
```

### Test 2: Conversation Context
```
User: "What's my name?"
Bot: (should remember from previous messages if memory is configured)
```

### Test 3: Complex Query
```
User: "Can you help me with X?"
Bot: (should process through AI Agent → Gemini → Memory)
```

## 🎨 Customization

### Change Colors
Edit `style.css`:
- Gradient colors: Lines 9, 30, 104, 166
- Background colors: Lines 21, 51, 110

### Change Webhook URL
Edit `script.js`:
- Line 7: Update `WEBHOOK_URL` constant

### Add Features
- Edit `script.js` to add new functionality
- Modify `index.html` to add UI elements
- Update `style.css` for styling

## 📚 Related Files

- `index.html` - Main HTML structure
- `script.js` - Chat functionality and API calls
- `style.css` - Styling and animations
- `README.md` - General documentation
- `SETUP_GUIDE.md` - Detailed setup instructions

---

**Ready to test?** Open `index.html` in your browser and start chatting! 🚀

