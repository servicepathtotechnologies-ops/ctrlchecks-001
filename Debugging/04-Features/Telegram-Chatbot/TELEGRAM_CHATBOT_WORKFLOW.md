# Telegram Chatbot Workflow Guide (Legacy)
## ⚠️ This file is kept for reference. For the current workflow, see: TELEGRAM_CHATBOT_SETUP.md

This guide explains how to create a Telegram chatbot using CtrlChecks workflows. The chatbot will receive messages from Telegram, process them with AI, and send responses back.

**For the Webhook → Text Formatter → Gemini → Telegram workflow, use: `TELEGRAM_CHATBOT_SETUP.md`**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Telegram Bot](#step-1-create-telegram-bot)
4. [Step 2: Create Workflow](#step-2-create-workflow)
5. [Step 3: Configure Nodes](#step-3-configure-nodes)
6. [Step 4: Set Up Telegram Webhook](#step-4-set-up-telegram-webhook)
7. [Step 5: Test Your Bot](#step-5-test-your-bot)
8. [Node Properties Reference](#node-properties-reference)
9. [Expected Input/Output](#expected-inputoutput)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### Workflow Architecture

```
Telegram Update → Webhook Trigger → Extract Message → AI Processing → Telegram Response
```

### What This Workflow Does

1. **Receives** Telegram messages via webhook
2. **Extracts** the message text and chat ID from Telegram update
3. **Processes** the message with AI (OpenAI GPT, Claude, or Gemini)
4. **Sends** the AI response back to Telegram

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] CtrlChecks account with workflow access
- [ ] Telegram account
- [ ] OpenAI API key (or Claude/Gemini API key)
- [ ] Access to your Supabase project URL (for webhook)

---

## 🤖 Step 1: Create Telegram Bot

### 1.1 Get Bot Token from BotFather

1. Open Telegram and search for **@BotFather**
2. Start a chat with BotFather
3. Send command: `/newbot`
4. Follow the prompts:
   - Choose a name for your bot (e.g., "My CtrlChecks Bot")
   - Choose a username (must end with `bot`, e.g., `my_ctrlchecks_bot`)
5. **Copy the Bot Token** - You'll need this later
   - Format: `123456789:ABC-DEF123456ghIkl-zyx57W2v1u123ew11`

### 1.2 Get Your Chat ID

**Method 1: Using @userinfobot**
1. Search for **@userinfobot** on Telegram
2. Start a chat and send `/start`
3. The bot will reply with your Chat ID (a number like `123456789`)

**Method 2: Using @getidsbot**
1. Search for **@getidsbot** on Telegram
2. Start a chat
3. It will show your Chat ID

**Save both:**
- ✅ Bot Token: `123456789:ABC-DEF...`
- ✅ Your Chat ID: `123456789`

---

## 🔧 Step 2: Create Workflow

### 2.1 Create New Workflow

1. Go to CtrlChecks dashboard
2. Click **"New Workflow"** or **"Create Workflow"**
3. Name it: **"Telegram Chatbot"**
4. Set workflow type: **"Chatbot"** (if available)

### 2.2 Workflow Structure

You'll create a workflow with these nodes in order:

```
Webhook Trigger → Set Node (Extract Data) → AI Node → Telegram Node
```

---

## ⚙️ Step 3: Configure Nodes

### Node 1: Webhook Trigger

**Purpose**: Receives Telegram updates from Telegram servers

#### Configuration:

1. **Drag "Webhook" node** from Triggers category
2. **Place it first** (leftmost position)
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **Method** | `POST` | Telegram sends POST requests |
| **Path** | (Auto-generated) | Will be shown after saving |

#### Expected Input (from Telegram):

When Telegram sends an update, the webhook receives:

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 123,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "John",
      "username": "john_doe"
    },
    "chat": {
      "id": 123456789,
      "type": "private",
      "first_name": "John"
    },
    "date": 1234567890,
    "text": "Hello, bot!"
  }
}
```

#### Output:

The webhook node outputs:

```json
{
  "trigger": "webhook",
  "method": "POST",
  "headers": {...},
  "body": {
    "update_id": 123456789,
    "message": {
      "text": "Hello, bot!",
      "chat": {
        "id": 123456789
      },
      "from": {
        "id": 123456789,
        "first_name": "John"
      }
    }
  }
}
```

**Access in next nodes:**
- Message text: `{{trigger.body.message.text}}`
- Chat ID: `{{trigger.body.message.chat.id}}`
- User ID: `{{trigger.body.message.from.id}}`
- User name: `{{trigger.body.message.from.first_name}}`

---

### Node 2: Set Node (Extract Data)

**Purpose**: Extract and structure the message data for easier use

#### Configuration:

1. **Drag "Set" node** from Data Processing category
2. **Connect**: Webhook → Set Node
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **Mode** | `Values to Set` | Create new fields |
| **Field 1 - Name** | `message` | Message text field |
| **Field 1 - Value** | `{{trigger.body.message.text}}` | Extract message text |
| **Field 2 - Name** | `chatId` | Chat ID field |
| **Field 2 - Value** | `{{trigger.body.message.chat.id}}` | Extract chat ID |
| **Field 3 - Name** | `userId` | User ID field |
| **Field 3 - Value** | `{{trigger.body.message.from.id}}` | Extract user ID |
| **Field 4 - Name** | `userName` | User name field |
| **Field 4 - Value** | `{{trigger.body.message.from.first_name}}` | Extract user name |

#### Output:

```json
{
  "message": "Hello, bot!",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

**Access in next nodes:**
- Message: `{{input.message}}`
- Chat ID: `{{input.chatId}}`
- User name: `{{input.userName}}`

---

### Node 3: AI Node (OpenAI GPT / Claude / Gemini)

**Purpose**: Process the user's message and generate a response

#### Option A: OpenAI GPT

1. **Drag "OpenAI GPT" node** from AI Processing category
2. **Connect**: Set Node → OpenAI GPT Node
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **API Key** | `sk-...` | Your OpenAI API key (or leave empty to use default) |
| **Model** | `gpt-4o-mini` | Recommended model (or `gpt-4o`, `gpt-3.5-turbo`) |
| **System Prompt** | `You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational. Be helpful and professional.` | Defines bot personality |
| **Input/Message** | `{{input.message}}` | **CRITICAL**: Pass the user's message |
| **Temperature** | `0.7` | Controls creativity (0-2) |
| **Max Tokens** | `150` | Limit response length |

#### Option B: Google Gemini

1. **Drag "Google Gemini" node** from AI Processing category
2. **Connect**: Set Node → Google Gemini Node
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **API Key** | `AIza...` | Your Google API key |
| **Model** | `gemini-pro` or `gemini-2.5-flash` | Model selection |
| **System Prompt** | `You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.` | Bot personality |
| **Input/Message** | `{{input.message}}` | **CRITICAL**: User's message |
| **Temperature** | `0.7` | Creativity level |

#### Option C: Anthropic Claude

1. **Drag "Anthropic Claude" node** from AI Processing category
2. **Connect**: Set Node → Claude Node
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **API Key** | `sk-ant-...` | Your Claude API key |
| **Model** | `claude-3-5-sonnet-20241022` | Model selection |
| **System Prompt** | `You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.` | Bot personality |
| **Input/Message** | `{{input.message}}` | **CRITICAL**: User's message |
| **Temperature** | `0.7` | Creativity level |

#### Expected Output:

```json
{
  "response": "Hello! I'm here to help. How can I assist you today?",
  "message": "Hello! I'm here to help. How can I assist you today?",
  "content": "Hello! I'm here to help. How can I assist you today?",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

**Access in next node:**
- AI Response: `{{input.response}}` or `{{input.message}}` or `{{input.content}}`

---

### Node 4: Telegram Node (Send Response)

**Purpose**: Send the AI response back to Telegram

#### Configuration:

1. **Drag "Telegram" node** from Output category
2. **Connect**: AI Node → Telegram Node
3. **Node Properties**:

| Property | Value | Description |
|----------|-------|-------------|
| **Bot Token** | `123456789:ABC-DEF...` | Your bot token from BotFather |
| **Chat ID** | `{{input.chatId}}` | **CRITICAL**: Use chat ID from Set node |
| **Message** | `{{input.response}}` | **CRITICAL**: AI response (or `{{input.message}}` or `{{input.content}}`) |

#### Expected Output:

```json
{
  "success": true,
  "messageId": 456,
  "response": "Hello! I'm here to help. How can I assist you today?",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

---

## 🔗 Step 4: Set Up Telegram Webhook

### 4.1 Get Your Webhook URL

1. **Save your workflow** in CtrlChecks
2. **Enable the webhook**:
   - Click on the Webhook node
   - Click "Enable" or "Activate"
   - Copy the webhook URL
   - Format: `https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID`

### 4.2 Set Telegram Webhook

You need to tell Telegram where to send updates. Use one of these methods:

#### Method 1: Using Browser/curl

Open this URL in your browser (replace with your values):

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>
```

**Example:**
```
https://api.telegram.org/bot123456789:ABC-DEF123456ghIkl-zyx57W2v1u123ew11/setWebhook?url=https://your-project.supabase.co/functions/v1/webhook-trigger/abc123
```

**Expected Response:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

#### Method 2: Using curl Command

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<YOUR_WEBHOOK_URL>"}'
```

#### Method 3: Using HTTP Request Node (Optional)

You can create a one-time workflow to set the webhook:

1. Create a new workflow
2. Add **Manual Trigger** node
3. Add **HTTP Request** node
4. Configure:
   - **Method**: `POST`
   - **URL**: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook`
   - **Headers**: `Content-Type: application/json`
   - **Body** (JSON):
     ```json
     {
       "url": "https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID"
     }
     ```
5. Execute once to set webhook

### 4.3 Verify Webhook

Check if webhook is set correctly:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Expected Response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 🧪 Step 5: Test Your Bot

### 5.1 Test in Telegram

1. **Open Telegram**
2. **Search for your bot** (using the username you created, e.g., `@my_ctrlchecks_bot`)
3. **Start a chat** with your bot
4. **Send a message**: "Hello"
5. **Wait for response** - The bot should reply with an AI-generated message

### 5.2 Check Workflow Execution

1. Go to CtrlChecks dashboard
2. Open your workflow
3. Check the **Execution Console** or **Execution History**
4. Verify:
   - ✅ Webhook received the update
   - ✅ Set node extracted data correctly
   - ✅ AI node generated response
   - ✅ Telegram node sent message successfully

---

## 📚 Node Properties Reference

### Webhook Trigger Node

```json
{
  "type": "webhook",
  "config": {
    "method": "POST"
  }
}
```

**Properties:**
- `method`: HTTP method (POST for Telegram)

**Output Fields:**
- `trigger.body.message.text` - Message text
- `trigger.body.message.chat.id` - Chat ID
- `trigger.body.message.from.id` - User ID
- `trigger.body.message.from.first_name` - User name

---

### Set Node

```json
{
  "type": "set",
  "config": {
    "mode": "values_to_set",
    "values": [
      {
        "name": "message",
        "value": "{{trigger.body.message.text}}"
      },
      {
        "name": "chatId",
        "value": "{{trigger.body.message.chat.id}}"
      },
      {
        "name": "userId",
        "value": "{{trigger.body.message.from.id}}"
      },
      {
        "name": "userName",
        "value": "{{trigger.body.message.from.first_name}}"
      }
    ]
  }
}
```

**Properties:**
- `mode`: `values_to_set` - Create new fields
- `values`: Array of field definitions

**Output Fields:**
- `input.message` - User's message
- `input.chatId` - Chat ID for response
- `input.userId` - User ID
- `input.userName` - User name

---

### OpenAI GPT Node

```json
{
  "type": "openai_gpt",
  "config": {
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "systemPrompt": "You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.",
    "input": "{{input.message}}",
    "temperature": 0.7,
    "maxTokens": 150
  }
}
```

**Properties:**
- `apiKey`: OpenAI API key (optional if using default)
- `model`: Model name (`gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`)
- `systemPrompt`: Bot personality and instructions
- `input`: User message (use `{{input.message}}`)
- `temperature`: 0-2, controls creativity (0.7 recommended)
- `maxTokens`: Maximum response length

**Output Fields:**
- `input.response` - AI response text
- `input.message` - AI response text (alternative)
- `input.content` - AI response text (alternative)

---

### Google Gemini Node

```json
{
  "type": "google_gemini",
  "config": {
    "apiKey": "AIza...",
    "model": "gemini-pro",
    "systemPrompt": "You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.",
    "input": "{{input.message}}",
    "temperature": 0.7
  }
}
```

**Properties:**
- `apiKey`: Google API key
- `model`: `gemini-pro` or `gemini-2.5-flash`
- `systemPrompt`: Bot personality
- `input`: User message (`{{input.message}}`)
- `temperature`: 0-2, creativity level

---

### Anthropic Claude Node

```json
{
  "type": "anthropic_claude",
  "config": {
    "apiKey": "sk-ant-...",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.",
    "input": "{{input.message}}",
    "temperature": 0.7
  }
}
```

**Properties:**
- `apiKey`: Claude API key
- `model`: `claude-3-5-sonnet-20241022` or `claude-3-opus-20240229`
- `systemPrompt`: Bot personality
- `input`: User message (`{{input.message}}`)
- `temperature`: 0-2, creativity level

---

### Telegram Node

```json
{
  "type": "telegram",
  "config": {
    "botToken": "123456789:ABC-DEF...",
    "chatId": "{{input.chatId}}",
    "message": "{{input.response}}"
  }
}
```

**Properties:**
- `botToken`: Bot token from BotFather (required)
- `chatId`: Chat ID to send message to (use `{{input.chatId}}`)
- `message`: Message text to send (use `{{input.response}}` or `{{input.message}}`)

**Output Fields:**
- `success`: `true` if message sent
- `messageId`: Telegram message ID
- All input fields are passed through

---

## 📥 Expected Input/Output

### Complete Workflow Flow

#### Input (Telegram Update):

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 123,
    "from": {
      "id": 123456789,
      "is_bot": false,
      "first_name": "John",
      "username": "john_doe"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "date": 1234567890,
    "text": "Hello, bot!"
  }
}
```

#### After Webhook Node:

```json
{
  "trigger": "webhook",
  "method": "POST",
  "body": {
    "update_id": 123456789,
    "message": {
      "text": "Hello, bot!",
      "chat": {
        "id": 123456789
      },
      "from": {
        "id": 123456789,
        "first_name": "John"
      }
    }
  }
}
```

#### After Set Node:

```json
{
  "message": "Hello, bot!",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

#### After AI Node:

```json
{
  "response": "Hello! I'm here to help. How can I assist you today?",
  "message": "Hello! I'm here to help. How can I assist you today?",
  "content": "Hello! I'm here to help. How can I assist you today?",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

#### After Telegram Node (Final Output):

```json
{
  "success": true,
  "messageId": 456,
  "response": "Hello! I'm here to help. How can I assist you today?",
  "chatId": "123456789",
  "userId": "123456789",
  "userName": "John"
}
```

---

## 🔧 Troubleshooting

### ⚠️ CRITICAL: Webhook Not Receiving Telegram Updates

**Problem**: Webhook receives empty body `{}` or only internal metadata, no Telegram message data

**Symptoms:**
- Execution logs show: `"body": {"_user_id": "...", "_workflow_id": "..."}`
- No `message`, `update_id`, or Telegram data in webhook output
- Bot responds with generic message regardless of user input

**Root Cause**: Telegram webhook is not set correctly, or Telegram is not sending updates to your webhook URL.

**Solution Steps**:

#### Step 1: Verify Telegram Webhook is Set

Check if webhook is configured:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

**Expected Response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**If webhook is NOT set** (url is empty), set it:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID
```

#### Step 2: Check Webhook URL Format

Your webhook URL should be:
- ✅ HTTPS (required by Telegram)
- ✅ Publicly accessible
- ✅ Format: `https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID`

#### Step 3: Test Webhook Manually

Send a test Telegram update to your webhook:

1. **Get a real Telegram update** by sending a message to your bot
2. **Copy the update JSON** from Telegram API (use `getUpdates` method)
3. **Send it manually** to your webhook URL using curl or Postman:

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 123,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test",
        "username": "test_user"
      },
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "date": 1234567890,
      "text": "Hello, bot!"
    }
  }'
```

#### Step 4: Update Workflow to Handle Telegram Data

If webhook is receiving data but workflow isn't extracting it correctly:

**Current Issue**: Your workflow is using `Text Formatter` which converts everything to string, losing the Telegram data structure.

**Fix**: Replace `Text Formatter` with `Set Node` to properly extract Telegram data:

1. **Remove Text Formatter node**
2. **Add Set Node** after Webhook:
   - **Mode**: `Values to Set`
   - **Field 1**: Name: `message`, Value: `{{trigger.body.message.text}}`
   - **Field 2**: Name: `chatId`, Value: `{{trigger.body.message.chat.id}}`
   - **Field 3**: Name: `userId`, Value: `{{trigger.body.message.from.id}}`
   - **Field 4**: Name: `userName`, Value: `{{trigger.body.message.from.first_name}}`

3. **Update AI Node**:
   - **Input/Message**: `{{input.message}}` (not the formatted string)

4. **Update Telegram Node**:
   - **Chat ID**: `{{input.chatId}}`
   - **Message**: `{{input.response}}` or `{{input.message}}`

#### Step 5: Alternative - Handle Root Level Data

If Telegram data is at root level (not in `body`), update Set node:

- **Message**: `{{trigger.message.text}}` (instead of `{{trigger.body.message.text}}`)
- **Chat ID**: `{{trigger.message.chat.id}}` (instead of `{{trigger.body.message.chat.id}}`)

#### Step 6: Verify Telegram is Sending Updates

Check pending updates:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

If you see updates here but not in your webhook, the webhook URL might be wrong.

#### Step 7: Clear Pending Updates (if needed)

If webhook was set incorrectly before:

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook?drop_pending_updates=true
```

Then set webhook again with correct URL.

---

### Bot Not Responding

**Problem**: Bot doesn't reply to messages

**Solutions:**
1. **Check webhook is set**:
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
   ```
2. **Verify webhook URL** is correct and accessible
3. **Check workflow is active** in CtrlChecks
4. **Check execution logs** in CtrlChecks for errors
5. **Verify bot token** is correct
6. **Check chat ID** is being extracted correctly
7. **Verify Telegram node** is using `{{input.chatId}}` (not hardcoded)

### "Chat ID is required" Error

**Problem**: Telegram node fails with "Chat ID is required"

**Solutions:**
1. **Verify Set node** is extracting chat ID correctly
2. **Check expression**: Should be `{{input.chatId}}` in Telegram node
3. **Test Set node output** - ensure chatId field exists
4. **Check Telegram update format** - ensure `message.chat.id` exists

### "Bot Token is required" Error

**Problem**: Telegram node fails with "Bot Token is required"

**Solutions:**
1. **Verify bot token** is entered correctly in Telegram node
2. **Check token format**: Should be `123456789:ABC-DEF...`
3. **Get new token** from @BotFather if needed

### AI Not Responding

**Problem**: AI node doesn't generate response

**Solutions:**
1. **Check API key** is valid
2. **Verify input expression**: Should be `{{input.message}}`
3. **Check API quota** - ensure you have credits
4. **Review system prompt** - ensure it's not empty
5. **Check execution logs** for API errors

### Webhook Not Receiving Updates

**Problem**: Webhook doesn't receive Telegram updates

**Solutions:**
1. **Verify webhook is set**:
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
   ```
2. **Check webhook URL** is accessible (HTTPS required)
3. **Ensure webhook URL** matches your workflow webhook URL
4. **Check Supabase function** is deployed and active
5. **Test webhook manually** by sending a POST request

### Message Format Issues

**Problem**: Messages appear incorrectly formatted

**Solutions:**
1. **Check message length** - Telegram has limits
2. **Verify HTML parsing** - Telegram node uses HTML parse mode
3. **Escape special characters** if needed
4. **Check for newlines** - use `\n` for line breaks

---

## 🎨 Advanced Configurations

### Add Conversation Memory

To add conversation history:

1. **Add Memory Node** after Set node
2. **Configure**:
   - **Session ID**: `{{input.userId}}` (use user ID as session)
   - **Store**: User message
3. **Update AI Node**:
   - **Memory**: Enable and set limit (e.g., 10 messages)
   - System will automatically include conversation history

### Handle Different Message Types

To handle images, documents, etc.:

1. **Update Set Node** to extract:
   - `photo`: `{{trigger.body.message.photo}}`
   - `document`: `{{trigger.body.message.document}}`
   - `caption`: `{{trigger.body.message.caption}}`
2. **Add conditional logic** (IF node) to handle different types
3. **Process accordingly** in AI node

### Add Error Handling

1. **Add Error Trigger** node
2. **Connect** to all nodes
3. **Add Telegram node** in error path
4. **Send error message** to user or log

---

## 📝 Example Workflow JSON

Here's a complete example workflow JSON you can import:

```json
{
  "name": "Telegram Chatbot",
  "nodes": [
    {
      "id": "webhook_1",
      "type": "webhook",
      "position": { "x": 250, "y": 100 },
      "data": {
        "type": "webhook",
        "config": {
          "method": "POST"
        }
      }
    },
    {
      "id": "set_1",
      "type": "set",
      "position": { "x": 550, "y": 100 },
      "data": {
        "type": "set",
        "config": {
          "mode": "values_to_set",
          "values": [
            {
              "name": "message",
              "value": "{{trigger.body.message.text}}"
            },
            {
              "name": "chatId",
              "value": "{{trigger.body.message.chat.id}}"
            },
            {
              "name": "userId",
              "value": "{{trigger.body.message.from.id}}"
            },
            {
              "name": "userName",
              "value": "{{trigger.body.message.from.first_name}}"
            }
          ]
        }
      }
    },
    {
      "id": "ai_1",
      "type": "openai_gpt",
      "position": { "x": 850, "y": 100 },
      "data": {
        "type": "openai_gpt",
        "config": {
          "model": "gpt-4o-mini",
          "systemPrompt": "You are a friendly and helpful Telegram chatbot. Keep your responses concise (2-3 sentences max), warm, and conversational.",
          "input": "{{input.message}}",
          "temperature": 0.7,
          "maxTokens": 150
        }
      }
    },
    {
      "id": "telegram_1",
      "type": "telegram",
      "position": { "x": 1150, "y": 100 },
      "data": {
        "type": "telegram",
        "config": {
          "botToken": "YOUR_BOT_TOKEN_HERE",
          "chatId": "{{input.chatId}}",
          "message": "{{input.response}}"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "webhook_1",
      "target": "set_1"
    },
    {
      "id": "e2",
      "source": "set_1",
      "target": "ai_1"
    },
    {
      "id": "e3",
      "source": "ai_1",
      "target": "telegram_1"
    }
  ]
}
```

---

## 🚀 Quick Start Checklist

- [ ] Create Telegram bot with @BotFather
- [ ] Get bot token and your chat ID
- [ ] Create workflow in CtrlChecks
- [ ] Add Webhook Trigger node
- [ ] Add Set node to extract message and chat ID
- [ ] Add AI node (OpenAI/Claude/Gemini)
- [ ] Add Telegram node
- [ ] Connect all nodes in order
- [ ] Configure all node properties
- [ ] Save workflow
- [ ] Enable webhook and copy URL
- [ ] Set Telegram webhook using API
- [ ] Test bot in Telegram
- [ ] Verify execution in CtrlChecks

---

## 📞 Support

If you encounter issues:

1. **Check execution logs** in CtrlChecks
2. **Verify webhook status**: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. **Test webhook manually** with a POST request
4. **Review node configurations** - ensure all expressions are correct
5. **Check API keys** are valid and have credits

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Compatible with**: CtrlChecks Workflow System

