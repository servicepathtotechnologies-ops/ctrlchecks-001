# Chatbot Test Page

This is a simple HTML test page to test your CtrlChecks webhook chatbot.

## 📁 Files

- `index.html` - Main HTML structure
- `style.css` - Styling for the chat interface
- `script.js` - JavaScript logic for sending messages
- `README.md` - This file

## 🚀 How to Use

### Step 1: Get Your Webhook URL

1. Go to your CtrlChecks workflow builder
2. Create or open a workflow with a **Webhook Trigger** node
3. Enable webhook in workflow settings
4. Copy the webhook URL (looks like: `https://your-project.supabase.co/functions/v1/webhook-trigger/{workflow-id}`)

### Step 2: Configure the Webhook URL

1. Open `script.js`
2. Find this line at the top:
   ```javascript
   const WEBHOOK_URL = 'YOUR_WEBHOOK_URL_HERE';
   ```
3. Replace `YOUR_WEBHOOK_URL_HERE` with your actual webhook URL:
   ```javascript
   const WEBHOOK_URL = 'https://your-project.supabase.co/functions/v1/webhook-trigger/abc123';
   ```

### Step 3: Open the Test Page

1. Open `index.html` in your web browser
   - You can double-click the file, or
   - Right-click → Open with → Browser
   - Or use a local server: `python -m http.server 8000` then visit `http://localhost:8000/test-chatbot/`

### Step 4: Test the Chatbot

1. Type a message in the input box
2. Click Send or press Enter
3. Wait for the bot's response
4. Check the browser console (F12) if there are any errors

## 🔧 Troubleshooting

### Error: "Please configure WEBHOOK_URL"
- Make sure you replaced `YOUR_WEBHOOK_URL_HERE` in `script.js`

### Error: "CORS error" or "Network error"
- Make sure your webhook function has CORS headers enabled
- Check that the webhook URL is correct
- Verify the workflow is active

### Error: "404 Not Found"
- Check that the webhook URL is correct
- Make sure the workflow ID in the URL matches your workflow
- Verify the webhook is enabled in workflow settings

### No response from bot
- Open browser console (F12) to see error details
- Check that your workflow is set to "active" status
- Verify the workflow has proper nodes configured

## 📝 Workflow Setup Guide

### How to Create a Chatbot Workflow:

1. **Add Webhook Trigger Node**
   - Drag "Webhook" node from triggers
   - This receives incoming messages

2. **Add AI Processing Node**
   - Drag "OpenAI GPT" or "Google Gemini" node
   - Connect it to the Webhook node
   - Configure with your API key
   - Set system prompt: "You are a friendly, helpful chatbot."

3. **Add Output Node (Optional)**
   - Drag "HTTP Request" node if you want to send response back
   - Or the response will be in execution logs

4. **Enable Webhook**
   - Click "Webhook" button in workflow header
   - Toggle "Enable Webhook" ON
   - Copy the generated URL

5. **Save and Activate**
   - Save the workflow
   - Set status to "active"

## 🎯 Expected Response Format

The webhook should return JSON in one of these formats:

```json
{
  "reply": "Hello! How can I help you?"
}
```

OR

```json
{
  "content": "Hello! How can I help you?"
}
```

The test page will automatically handle both formats.

## 📱 Mobile Friendly

The chat interface is responsive and works on mobile devices.

## 🔒 Security Note

This is a test page. For production:
- Add authentication
- Validate inputs
- Use HTTPS
- Implement rate limiting

