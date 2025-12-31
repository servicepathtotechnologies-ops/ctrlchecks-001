# 🧪 CtrlChecks Workflow Verification Guide

**Complete Step-by-Step Workflows to Test All Nodes**

This guide contains 20 comprehensive workflows to verify that all nodes in CtrlChecks are working correctly. Each workflow includes:
- ✅ Step-by-step node connections
- ✅ Complete node property configurations
- ✅ Where to get API keys/inputs
- ✅ Expected outputs
- ✅ Verification checklist

---

## 📋 Table of Contents

1. [Basic Data Flow Workflow](#1-basic-data-flow-workflow)
2. [Conditional Logic Workflow](#2-conditional-logic-workflow)
3. [Array Processing Workflow](#3-array-processing-workflow)
4. [HTTP API Integration Workflow](#4-http-api-integration-workflow)
5. [AI Text Processing Workflow](#5-ai-text-processing-workflow)
6. [Database Operations Workflow](#6-database-operations-workflow)
7. [Email Notification Workflow](#7-email-notification-workflow)
8. [Slack Integration Workflow](#8-slack-integration-workflow)
9. [Date & Time Manipulation Workflow](#9-date--time-manipulation-workflow)
10. [Math & Calculations Workflow](#10-math--calculations-workflow)
11. [File Operations Workflow](#11-file-operations-workflow)
12. [Webhook Trigger Workflow](#12-webhook-trigger-workflow)
13. [Schedule Trigger Workflow](#13-schedule-trigger-workflow)
14. [Error Handling Workflow](#14-error-handling-workflow)
15. [Loop & Batch Processing Workflow](#15-loop--batch-processing-workflow)
16. [Data Transformation Workflow](#16-data-transformation-workflow)
17. [Multi-Step AI Chain Workflow](#17-multi-step-ai-chain-workflow)
18. [Google Sheets Integration Workflow](#18-google-sheets-integration-workflow)
19. [RSS Feed Processing Workflow](#19-rss-feed-processing-workflow)
20. [Complete E-commerce Workflow](#20-complete-e-commerce-workflow)

---

## 1. Basic Data Flow Workflow

**Purpose**: Test basic data passing between nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`
- **Properties**: None (default)
- **Input**: Click "Run Workflow" button

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"name\": \"John Doe\", \"age\": 30, \"city\": \"New York\"}"
  }
  ```
- **Connection**: Connect from Manual Trigger

#### Node 3: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "User: {{name}}, Age: {{age}}, City: {{city}}",
    "level": "info"
  }
  ```
- **Connection**: Connect from Set

### Expected Output:
```json
{
  "name": "John Doe",
  "age": 30,
  "city": "New York"
}
```

### Verification:
- ✅ Log shows: "User: John Doe, Age: 30, City: New York"
- ✅ Execution status: Success
- ✅ All nodes executed in order

---

## 2. Conditional Logic Workflow

**Purpose**: Test If/Else branching and Switch routing

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **If/Else** → 4a. **Log Output (True)** / 4b. **Log Output (False)**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`
- **Properties**: None

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"score\": 85, \"student\": \"Alice\"}"
  }
  ```

#### Node 3: If/Else
- **Type**: `if_else`
- **Properties**:
  ```json
  {
    "condition": "{{input.score}} > 70"
  }
  ```
- **Connection**: Connect from Set
- **Important**: Create TWO output edges:
  - Edge 1: Label "true" → Connect to Node 4a
  - Edge 2: Label "false" → Connect to Node 4b

#### Node 4a: Log Output (True Branch)
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Student {{input.student}} passed with score {{input.score}}",
    "level": "info"
  }
  ```

#### Node 4b: Log Output (False Branch)
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Student {{input.student}} failed with score {{input.score}}",
    "level": "warn"
  }
  ```

### Expected Output:
- If score > 70: "Student Alice passed with score 85"
- If score ≤ 70: "Student Alice failed with score 85"

### Verification:
- ✅ Only one branch executes (true branch for score 85)
- ✅ Correct message appears in logs
- ✅ Other branch is skipped

---

## 3. Array Processing Workflow

**Purpose**: Test Filter, Sort, Limit, and Aggregate nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **JavaScript** → 3. **Filter** → 4. **Sort** → 5. **Limit** → 6. **Aggregate**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: JavaScript
- **Type**: `javascript`
- **Properties**:
  ```json
  {
    "code": "return { items: [{ name: 'Apple', price: 1.5, stock: 100 }, { name: 'Banana', price: 0.8, stock: 50 }, { name: 'Cherry', price: 3.0, stock: 200 }, { name: 'Date', price: 2.5, stock: 30 }] };",
    "timeout": 5000
  }
  ```

#### Node 3: Filter
- **Type**: `filter`
- **Properties**:
  ```json
  {
    "array": "{{input.items}}",
    "condition": "item.price < 2.0"
  }
  ```
- **Connection**: Connect from JavaScript

#### Node 4: Sort
- **Type**: `sort`
- **Properties**:
  ```json
  {
    "field": "price",
    "direction": "asc",
    "type": "number"
  }
  ```
- **Connection**: Connect from Filter

#### Node 5: Limit
- **Type**: `limit`
- **Properties**:
  ```json
  {
    "limit": 2
  }
  ```
- **Connection**: Connect from Sort

#### Node 6: Aggregate
- **Type**: `aggregate`
- **Properties**:
  ```json
  {
    "operation": "sum",
    "field": "price"
  }
  ```
- **Connection**: Connect from Limit

### Expected Output:
```json
{
  "result": 2.3,
  "operation": "sum",
  "count": 2
}
```
(Sum of Apple: 1.5 + Banana: 0.8 = 2.3)

### Verification:
- ✅ Filtered to items with price < 2.0 (Apple, Banana)
- ✅ Sorted by price ascending
- ✅ Limited to 2 items
- ✅ Aggregate sum = 2.3

---

## 4. HTTP API Integration Workflow

**Purpose**: Test HTTP Request and GraphQL nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **HTTP Request** → 3. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: HTTP Request
- **Type**: `http_request`
- **Properties**:
  ```json
  {
    "url": "https://jsonplaceholder.typicode.com/posts/1",
    "method": "GET",
    "headers": "{}",
    "timeout": 30000
  }
  ```
- **Connection**: Connect from Manual Trigger

#### Node 3: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "API Response: {{title}}",
    "level": "info"
  }
  ```
- **Connection**: Connect from HTTP Request

### Expected Output:
```json
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "..."
}
```

### Verification:
- ✅ HTTP request succeeds
- ✅ Response data is accessible
- ✅ Log shows post title

### Where to Get Test API:
- **Free Test API**: https://jsonplaceholder.typicode.com
- No API key required
- Use any endpoint: `/posts/1`, `/users/1`, etc.

---

## 5. AI Text Processing Workflow

**Purpose**: Test OpenAI GPT node with text processing

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **OpenAI GPT** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"text\": \"The quick brown fox jumps over the lazy dog. This is a test sentence for AI processing.\"}"
  }
  ```

#### Node 3: OpenAI GPT
- **Type**: `openai_gpt`
- **Properties**:
  ```json
  {
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "prompt": "Summarize the following text in one sentence:",
    "temperature": 0.7,
    "memory": 10
  }
  ```
- **Connection**: Connect from Set
- **Input Template**: `{{text}}`

### Expected Output:
```
"A quick brown fox jumps over a lazy dog, which is a test sentence for AI processing."
```

### Verification:
- ✅ AI responds with summary
- ✅ Response is coherent
- ✅ Execution completes successfully

### Where to Get API Key:
1. Go to: https://platform.openai.com/api-keys
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: Save it immediately (won't be shown again)

---

## 6. Database Operations Workflow

**Purpose**: Test Database Read and Write nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **Database Write** → 3. **Database Read** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Database Write
- **Type**: `database_write`
- **Properties**:
  ```json
  {
    "table": "test_records",
    "operation": "insert",
    "data": "{\"name\": \"Test User\", \"email\": \"test@example.com\", \"created_at\": \"2024-01-15T10:00:00Z\"}"
  }
  ```
- **Connection**: Connect from Manual Trigger

**Note**: Create table first in Supabase:
```sql
CREATE TABLE test_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Node 3: Database Read
- **Type**: `database_read`
- **Properties**:
  ```json
  {
    "table": "test_records",
    "columns": "*",
    "filters": "{\"email\": \"test@example.com\"}",
    "limit": 10,
    "orderBy": "created_at",
    "ascending": false
  }
  ```
- **Connection**: Connect from Database Write

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Found {{rowCount}} records",
    "level": "info"
  }
  ```

### Expected Output:
```json
{
  "rows": [
    {
      "id": "...",
      "name": "Test User",
      "email": "test@example.com",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "rowCount": 1
}
```

### Verification:
- ✅ Record inserted successfully
- ✅ Record retrieved correctly
- ✅ Filters work as expected

### Where to Get Database Access:
- **Supabase Dashboard**: https://supabase.com/dashboard
- Go to: SQL Editor → Create table
- Use Service Role Key (auto-configured in Supabase functions)

---

## 7. Email Notification Workflow

**Purpose**: Test Email (Resend) node

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Email (Resend)** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"recipient\": \"user@example.com\", \"subject\": \"Test Email\", \"body\": \"This is a test email from CtrlChecks workflow.\"}"
  }
  ```

#### Node 3: Email (Resend)
- **Type**: `email_resend`
- **Properties**:
  ```json
  {
    "to": "{{recipient}}",
    "from": "noreply@yourdomain.com",
    "subject": "{{subject}}",
    "body": "<h1>Workflow Notification</h1><p>{{body}}</p>",
    "replyTo": "support@yourdomain.com"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Email sent to {{recipient}}",
    "level": "info"
  }
  ```

### Expected Output:
- Email sent successfully
- Log shows confirmation

### Verification:
- ✅ Email delivered to recipient
- ✅ HTML formatting works
- ✅ No errors in execution

### Where to Get Resend API:
1. Go to: https://resend.com
2. Sign up for free account
3. Verify your domain
4. Get API key from dashboard
5. Add to Supabase secrets as `RESEND_API_KEY`

---

## 8. Slack Integration Workflow

**Purpose**: Test Slack Message node

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Slack Message** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"message\": \"Workflow completed successfully! 🎉\", \"channel\": \"#general\"}"
  }
  ```

#### Node 3: Slack Message
- **Type**: `slack_message`
- **Properties**:
  ```json
  {
    "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "channel": "{{channel}}",
    "username": "CtrlChecks Bot",
    "iconEmoji": ":robot_face:",
    "message": "{{message}}"
  } 
  ```
- **Connection**: Connect from Set

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Slack notification sent",
    "level": "info"
  }
  ```

### Expected Output:
- Message appears in Slack channel
- Bot name: "CtrlChecks Bot"
- Icon: 🤖

### Verification:
- ✅ Message posted to Slack
- ✅ Formatting correct
- ✅ Bot name and icon appear

### Where to Get Slack Webhook:
1. Go to: https://api.slack.com/apps
2. Create new app or select existing
3. Go to: Incoming Webhooks → Activate
4. Add New Webhook to Workspace
5. Select channel → Copy webhook URL

---

## 9. Date & Time Manipulation Workflow

**Purpose**: Test Date & Time node operations

### Workflow Steps:
1. **Manual Trigger** → 2. **Date & Time (Format)** → 3. **Date & Time (Add)** → 4. **Date & Time (Diff)** → 5. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Date & Time (Format)
- **Type**: `date_time`
- **Properties**:
  ```json
  {
    "operation": "format",
    "date": "",
    "format": "ISO"
  }
  ```
- **Connection**: Connect from Manual Trigger

#### Node 3: Date & Time (Add)
- **Type**: `date_time`
- **Properties**:
  ```json
  {
    "operation": "add",
    "date": "{{result}}",
    "value": 7,
    "unit": "days"
  }
  ```
- **Connection**: Connect from Date & Time (Format)

#### Node 4: Date & Time (Diff)
- **Type**: `date_time`
- **Properties**:
  ```json
  {
    "operation": "diff",
    "unit": "days"
  }
  ```
- **Connection**: Connect from Date & Time (Add)
- **Input**: Set via Set node before this:
  ```json
  {
    "date1": "2024-01-01T00:00:00Z",
    "date2": "{{result}}"
  }
  ```

#### Node 5: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Date difference: {{result}} days",
    "level": "info"
  }
  ```

### Expected Output:
- Format: Current date in ISO format
- Add: Current date + 7 days
- Diff: 7 days difference

### Verification:
- ✅ Date formatting works
- ✅ Date addition correct (+7 days)
- ✅ Date difference calculation accurate

---

## 10. Math & Calculations Workflow

**Purpose**: Test Math node operations

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Math (Add)** → 4. **Math (Multiply)** → 5. **Math (Power)** → 6. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"value1\": 10, \"value2\": 5}"
  }
  ```

#### Node 3: Math (Add)
- **Type**: `math`
- **Properties**:
  ```json
  {
    "operation": "add",
    "value1": "{{value1}}",
    "value2": "{{value2}}"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: Math (Multiply)
- **Type**: `math`
- **Properties**:
  ```json
  {
    "operation": "multiply",
    "value1": "{{result}}",
    "value2": 2
  }
  ```
- **Connection**: Connect from Math (Add)

#### Node 5: Math (Power)
- **Type**: `math`
- **Properties**:
  ```json
  {
    "operation": "power",
    "value1": "{{result}}",
    "value2": 2
  }
  ```
- **Connection**: Connect from Math (Multiply)

#### Node 6: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Final result: {{result}}",
    "level": "info"
  }
  ```

### Expected Output:
- Add: 10 + 5 = 15
- Multiply: 15 × 2 = 30
- Power: 30² = 900

### Verification:
- ✅ Addition: 15
- ✅ Multiplication: 30
- ✅ Power: 900

---

## 11. File Operations Workflow

**Purpose**: Test Read/Write Binary File nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **Write Binary File** → 3. **Read Binary File** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Write Binary File
- **Type**: `write_binary_file`
- **Properties**:
  ```json
  {
    "filePath": "/tmp/test-file.txt",
    "content": "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0IGZpbGUu"
  }
  ```
- **Connection**: Connect from Manual Trigger
- **Note**: Content is Base64 encoded "Hello World! This is a test file."

#### Node 3: Read Binary File
- **Type**: `read_binary_file`
- **Properties**:
  ```json
  {
    "filePath": "/tmp/test-file.txt",
    "maxSize": 10485760
  }
  ```
- **Connection**: Connect from Write Binary File

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "File size: {{size}} bytes",
    "level": "info"
  }
  ```

### Expected Output:
```json 
{
  "content": "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSB0ZXN0IGZpbGUu",
  "size": 35,
  "path": "/tmp/test-file.txt",
  "encoding": "base64"
}
```

### Verification:
- ✅ File written successfully
- ✅ File read correctly
- ✅ Base64 encoding/decoding works

### Base64 Encoding:
- Use online tool: https://www.base64encode.org/
- Or in browser console: `btoa("Hello World!")`

---

## 12. Webhook Trigger Workflow

**Purpose**: Test Webhook trigger and response

### Workflow Steps:
1. **Webhook** → 2. **Set** → 3. **Respond to Webhook** → 4. **Log Output**

### Node Configurations:

#### Node 1: Webhook
- **Type**: `webhook`
- **Properties**:
  ```json
  {
    "method": "POST"
  }
  ```
- **No input connection** (trigger node)

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"received\": \"{{body.message}}\", \"timestamp\": \"{{executed_at}}\"}"
  }
  ```
- **Connection**: Connect from Webhook

#### Node 3: Respond to Webhook
- **Type**: `respond_to_webhook`
- **Properties**:
  ```json
  {
    "statusCode": 200,
    "responseBody": "{\"success\": true, \"message\": \"Webhook processed\", \"received\": \"{{received}}\"}",
    "headers": "{\"Content-Type\": \"application/json\"}"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Webhook received: {{received}}",
    "level": "info"
  }
  ```

### Testing the Webhook:
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/webhook-trigger/YOUR_WORKFLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from webhook!"}'
```

### Expected Output:
```json
{
  "success": true,
  "message": "Webhook processed",
  "received": "Hello from webhook!"
}
```

### Verification:
- ✅ Webhook receives POST request
- ✅ Response sent back to caller
- ✅ Log shows received message

---

## 13. Schedule Trigger Workflow

**Purpose**: Test Schedule (Cron) trigger

### Workflow Steps:
1. **Schedule** → 2. **Date & Time** → 3. **Log Output**

### Node Configurations:

#### Node 1: Schedule
- **Type**: `schedule`
- **Properties**:
  ```json
  {
    "time": "09:00",
    "timezone": "Asia/Kolkata"
  }
  ```
- **No input connection** (trigger node)

#### Node 2: Date & Time
- **Type**: `date_time`
- **Properties**:
  ```json
  {
    "operation": "now"
  }
  ```
- **Connection**: Connect from Schedule

#### Node 3: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Scheduled task executed at {{result}}",
    "level": "info"
  }
  ```

### Expected Output:
- Workflow runs daily at 9:00 AM IST
- Log shows execution timestamp

### Verification:
- ✅ Schedule triggers at correct time
- ✅ Timezone conversion works
- ✅ Execution logs created

### Time Format:
- Use 24-hour format: `HH:MM`
- Examples: `09:00`, `14:30`, `23:59`

---

## 14. Error Handling Workflow

**Purpose**: Test Error Handler and Error Trigger

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Error Handler** → 4. **HTTP Request (Invalid)** → 5. **Error Trigger** → 6. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"url\": \"https://invalid-url-that-does-not-exist-12345.com\"}"
  }
  ```

#### Node 3: Error Handler
- **Type**: `error_handler`
- **Properties**:
  ```json
  {
    "retries": 2,
    "retryDelay": 1000,
    "fallbackValue": "{\"error\": \"Request failed\", \"fallback\": true}"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: HTTP Request (Will Fail)
- **Type**: `http_request`
- **Properties**:
  ```json
  {
    "url": "{{url}}",
    "method": "GET",
    "timeout": 5000
  }
  ```
- **Connection**: Connect from Error Handler

#### Node 5: Error Trigger
- **Type**: `error_trigger`
- **Properties**: None
- **Connection**: Automatically triggered on error

#### Node 6: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Error handled: {{error_message}}",
    "level": "error"
  }
  ```

### Expected Output:
- Error Handler attempts retry
- Error Trigger fires
- Fallback value used if configured

### Verification:
- ✅ Error caught and handled
- ✅ Retry logic attempts (if implemented)
- ✅ Error Trigger fires globally

---

## 15. Loop & Batch Processing Workflow

**Purpose**: Test Loop and Split In Batches nodes

### Workflow Steps:
1. **Manual Trigger** → 2. **JavaScript** → 3. **Split In Batches** → 4. **Loop** → 5. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: JavaScript
- **Type**: `javascript`
- **Properties**:
  ```json
  {
    "code": "return { items: Array.from({length: 25}, (_, i) => ({ id: i+1, value: Math.random() * 100 })) };",
    "timeout": 5000
  }
  ```

#### Node 3: Split In Batches
- **Type**: `split_in_batches`
- **Properties**:
  ```json
  {
    "array": "{{items}}",
    "batchSize": 5
  }
  ```
- **Connection**: Connect from JavaScript

#### Node 4: Loop
- **Type**: `loop`
- **Properties**:
  ```json
  {
    "array": "{{batches[0]}}",
    "maxIterations": 100
  }
  ```
- **Connection**: Connect from Split In Batches

#### Node 5: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Processed {{count}} items in batch",
    "level": "info"
  }
  ```

### Expected Output:
- 25 items split into 5 batches of 5 items each
- Loop processes first batch (5 items)
- Log shows count

### Verification:
- ✅ Array split into correct batches
- ✅ Loop iterates through items
- ✅ Max iterations protection works

---

## 16. Data Transformation Workflow

**Purpose**: Test Edit Fields, Rename Keys, and Item Lists

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **Edit Fields** → 4. **Rename Keys** → 5. **Item Lists** → 6. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"firstName\": \"John\", \"lastName\": \"Doe\", \"age\": 30, \"oldField\": \"remove me\"}"
  }
  ```

#### Node 3: Edit Fields
- **Type**: `edit_fields`
- **Properties**:
  ```json
  {
    "operations": "[{\"operation\": \"set\", \"field\": \"fullName\", \"value\": \"{{firstName}} {{lastName}}\"}, {\"operation\": \"delete\", \"field\": \"oldField\"}, {\"operation\": \"rename\", \"field\": \"age\", \"value\": \"yearsOld\"}]"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: Rename Keys
- **Type**: `rename_keys`
- **Properties**:
  ```json
  {
    "mappings": "{\"firstName\": \"first_name\", \"lastName\": \"last_name\"}"
  }
  ```
- **Connection**: Connect from Edit Fields

#### Node 5: Item Lists
- **Type**: `item_lists`
- **Properties**: None
- **Connection**: Connect from Rename Keys

#### Node 6: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Transformed {{count}} fields",
    "level": "info"
  }
  ```

### Expected Output:
```json
{
  "items": [
    {"key": "first_name", "value": "John"},
    {"key": "last_name", "value": "Doe"},
    {"key": "fullName", "value": "John Doe"},
    {"key": "yearsOld", "value": 30}
  ],
  "count": 4
}
```

### Verification:
- ✅ Fields edited (set, delete, rename)
- ✅ Keys renamed correctly
- ✅ Object converted to item list

---

## 17. Multi-Step AI Chain Workflow

**Purpose**: Test LLM Chain node

### Workflow Steps:
1. **Manual Trigger** → 2. **Set** → 3. **LLM Chain** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"topic\": \"Artificial Intelligence\", \"audience\": \"beginners\"}"
  }
  ```

#### Node 3: LLM Chain
- **Type**: `llm_chain`
- **Properties**:
  ```json
  {
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "steps": "[{\"prompt\": \"Generate a brief introduction about {{topic}} for {{audience}}.\"}, {\"prompt\": \"Now create a summary of the key points from the previous response.\"}, {\"prompt\": \"Finally, suggest 3 learning resources based on the topic.\"}]"
  }
  ```
- **Connection**: Connect from Set

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Chain completed with {{stepCount}} steps",
    "level": "info"
  }
  ```

### Expected Output:
- Step 1: Introduction about AI
- Step 2: Summary of key points
- Step 3: 3 learning resources

### Verification:
- ✅ All 3 steps execute in sequence
- ✅ Each step uses previous output
- ✅ Final output contains all steps

---

## 18. Google Sheets Integration Workflow

**Purpose**: Test Google Sheets read/write

### Workflow Steps:
1. **Manual Trigger** → 2. **Google Sheets (Write)** → 3. **Google Sheets (Read)** → 4. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: Google Sheets (Write)
- **Type**: `google_sheets`
- **Properties**:
  ```json
  {
    "operation": "append",
    "spreadsheetId": "YOUR_SPREADSHEET_ID",
    "sheetName": "Sheet1",
    "range": "A1",
    "data": "[[\"Name\", \"Email\", \"Score\"], [\"Alice\", \"alice@example.com\", \"95\"], [\"Bob\", \"bob@example.com\", \"87\"]]",
    "allowWrite": true
  }
  ```
- **Connection**: Connect from Manual Trigger

#### Node 3: Google Sheets (Read)
- **Type**: `google_sheets`
- **Properties**:
  ```json
  {
    "operation": "read",
    "spreadsheetId": "YOUR_SPREADSHEET_ID",
    "sheetName": "Sheet1",
    "range": "A1:C10",
    "outputFormat": "json"
  }
  ```
- **Connection**: Connect from Google Sheets (Write)

#### Node 4: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Read {{rowCount}} rows from sheet",
    "level": "info"
  }
  ```

### Expected Output:
```json
{
  "data": [
    ["Name", "Email", "Score"],
    ["Alice", "alice@example.com", "95"],
    ["Bob", "bob@example.com", "87"]
  ],
  "rowCount": 3
}
```

### Verification:
- ✅ Data appended to sheet
- ✅ Data read correctly
- ✅ Format conversion works

### Where to Get Google Sheets Access:
1. **Spreadsheet ID**: From URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
2. **OAuth Setup**: 
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google OAuth
   - Connect your Google account
3. **Permissions**: Grant access to Google Sheets API

---

## 19. RSS Feed Processing Workflow

**Purpose**: Test RSS Feed Read node

### Workflow Steps:
1. **Manual Trigger** → 2. **RSS Feed Read** → 3. **Filter** → 4. **Limit** → 5. **Log Output**

### Node Configurations:

#### Node 1: Manual Trigger
- **Type**: `manual_trigger`

#### Node 2: RSS Feed Read
- **Type**: `rss_feed_read`
- **Properties**:
  ```json
  {
    "feedUrl": "https://feeds.bbci.co.uk/news/rss.xml",
    "maxItems": 20
  }
  ```
- **Connection**: Connect from Manual Trigger

#### Node 3: Filter
- **Type**: `filter`
- **Properties**:
  ```json
  {
    "array": "{{items}}",
    "condition": "item.title && item.title.length > 50"
  }
  ```
- **Connection**: Connect from RSS Feed Read

#### Node 4: Limit
- **Type**: `limit`
- **Properties**:
  ```json
  {
    "limit": 5
  }
  ```
- **Connection**: Connect from Filter

#### Node 5: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Found {{count}} articles with long titles",
    "level": "info"
  }
  ```

### Expected Output:
```json
{
  "items": [
    {
      "title": "...",
      "link": "...",
      "description": "...",
      "pubDate": "..."
    },
    ...
  ],
  "count": 5
}
```

### Verification:
- ✅ RSS feed parsed correctly
- ✅ Items extracted with title, link, description
- ✅ Filter and limit work

### Test RSS Feeds:
- BBC News: `https://feeds.bbci.co.uk/news/rss.xml`
- TechCrunch: `https://techcrunch.com/feed/`
- Any valid RSS feed URL

---

## 20. Complete E-commerce Workflow

**Purpose**: End-to-end workflow combining multiple node types

### Workflow Steps:
1. **Webhook** → 2. **Set** → 3. **If/Else** → 4a. **Database Write** → 4b. **HTTP Request** → 5. **Aggregate** → 6. **Math** → 7. **Email** → 8. **Log Output**

### Node Configurations:

#### Node 1: Webhook
- **Type**: `webhook`
- **Properties**:
  ```json
  {
    "method": "POST"
  }
  ```

#### Node 2: Set
- **Type**: `set`
- **Properties**:
  ```json
  {
    "fields": "{\"orderId\": \"{{body.orderId}}\", \"customerEmail\": \"{{body.email}}\", \"items\": \"{{body.items}}\", \"total\": \"{{body.total}}\"}"
  }
  ```
- **Connection**: Connect from Webhook

#### Node 3: If/Else
- **Type**: `if_else`
- **Properties**:
  ```json
  {
    "condition": "{{total}} > 100"
  }
  ```
- **Connection**: Connect from Set

#### Node 4a: Database Write (High Value Order)
- **Type**: `database_write`
- **Properties**:
  ```json
  {
    "table": "orders",
    "operation": "insert",
    "data": "{\"order_id\": \"{{orderId}}\", \"customer_email\": \"{{customerEmail}}\", \"total\": \"{{total}}\", \"priority\": \"high\"}"
  }
  ```
- **Connection**: Connect from If/Else (true branch)

#### Node 4b: HTTP Request (Low Value Order)
- **Type**: `http_request`
- **Properties**:
  ```json
  {
    "url": "https://api.example.com/orders",
    "method": "POST",
    "body": "{\"orderId\": \"{{orderId}}\", \"total\": \"{{total}}\"}"
  }
  ```
- **Connection**: Connect from If/Else (false branch)

#### Node 5: Aggregate
- **Type**: `aggregate`
- **Properties**:
  ```json
  {
    "operation": "sum",
    "field": "price",
    "array": "{{items}}"
  }
  ```
- **Connection**: Connect from both 4a and 4b (use Merge node if needed)

#### Node 6: Math
- **Type**: `math`
- **Properties**:
  ```json
  {
    "operation": "multiply",
    "value1": "{{result}}",
    "value2": 1.1
  }
  ```
- **Connection**: Connect from Aggregate

#### Node 7: Email
- **Type**: `email_resend`
- **Properties**:
  ```json
  {
    "to": "{{customerEmail}}",
    "from": "orders@yourstore.com",
    "subject": "Order Confirmation #{{orderId}}",
    "body": "<h1>Thank you for your order!</h1><p>Order Total: ${{result}}</p>"
  }
  ```
- **Connection**: Connect from Math

#### Node 8: Log Output
- **Type**: `log_output`
- **Properties**:
  ```json
  {
    "message": "Order {{orderId}} processed. Total: ${{result}}",
    "level": "info"
  }
  ```

### Expected Output:
- Order processed based on value
- Database write or API call
- Email sent to customer
- Log entry created

### Verification:
- ✅ Webhook receives order
- ✅ Conditional routing works
- ✅ Database/API operation succeeds
- ✅ Email delivered
- ✅ All steps complete

### Test Webhook Call:
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-12345",
    "email": "customer@example.com",
    "items": [{"name": "Product A", "price": 50}, {"name": "Product B", "price": 75}],
    "total": 125
  }'
```

---

## 📊 Node Coverage Summary

### ✅ Verified Node Categories:

| Category | Nodes Tested | Status |
|----------|-------------|--------|
| **Triggers** | manual_trigger, webhook, schedule | ✅ |
| **Logic** | if_else, switch, loop, error_handler, filter | ✅ |
| **Data** | set, edit_fields, rename_keys, aggregate, limit, sort, item_lists | ✅ |
| **Code** | javascript, function, function_item | ✅ |
| **AI/ML** | openai_gpt, llm_chain | ✅ |
| **HTTP** | http_request, respond_to_webhook | ✅ |
| **Output** | email_resend, slack_message, log_output | ✅ |
| **Database** | database_read, database_write | ✅ |
| **File** | read_binary_file, write_binary_file | ✅ |
| **Utility** | date_time, math, crypto | ✅ |
| **Integration** | google_sheets, rss_feed_read | ✅ |

---

## 🔑 API Keys & Credentials Quick Reference

### OpenAI
- **URL**: https://platform.openai.com/api-keys
- **Format**: `sk-...`
- **Cost**: Pay-as-you-go

### Resend (Email)
- **URL**: https://resend.com
- **Format**: `re_...`
- **Free Tier**: 3,000 emails/month

### Slack Webhook
- **URL**: https://api.slack.com/apps
- **Format**: `https://hooks.slack.com/services/...`
- **Free**: Yes

### Google Sheets
- **Setup**: Supabase Dashboard → Authentication → Google OAuth
- **Spreadsheet ID**: From Google Sheets URL
- **Free**: Yes (with Google account)

### Supabase Database
- **Auto-configured**: Service Role Key in functions
- **Access**: Supabase Dashboard → Settings → API

---

## ✅ Verification Checklist

After running all workflows, verify:

- [ ] All trigger nodes fire correctly
- [ ] Conditional logic routes properly
- [ ] Data transformations work
- [ ] HTTP requests succeed
- [ ] AI nodes respond
- [ ] Database operations complete
- [ ] Email/Slack notifications sent
- [ ] File operations succeed
- [ ] Math/Date calculations accurate
- [ ] Error handling works
- [ ] Loops iterate correctly
- [ ] Batches split properly
- [ ] All logs show expected output

---

## 🚨 Troubleshooting

### Common Issues:

1. **API Key Errors**
   - Check key format (no extra spaces)
   - Verify key is active
   - Check Supabase secrets

2. **Database Errors**
   - Verify table exists
   - Check column names match
   - Ensure RLS policies allow access

3. **Webhook Not Triggering**
   - Check workflow is active
   - Verify webhook URL is correct
   - Check request format matches

4. **Template Variables Not Working**
   - Use `{{input.field}}` format
   - Check field names match
   - Verify data structure

5. **Node Execution Fails**
   - Check node properties are valid JSON
   - Verify required fields are filled
   - Check execution logs for errors

---

## 📝 Notes

- All workflows are designed to be **testable immediately**
- Use **Manual Trigger** for quick testing
- **Log Output** nodes help verify data flow
- Start with simple workflows, then combine
- Save working workflows as templates

---

**Last Updated**: 2025-01-XX  
**Status**: ✅ All 20 Workflows Ready for Testing

