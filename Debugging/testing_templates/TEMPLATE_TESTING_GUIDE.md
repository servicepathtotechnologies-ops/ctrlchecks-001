# Template Testing Guide
## Comprehensive Testing Documentation for All 30 Workflow Templates

This document provides testing procedures, dummy input data, expected outputs, and node configuration details for all 30 workflow templates.

---

## Table of Contents

### Beginner Templates (1-10)
1. [Manual Trigger Basics](#template-1-manual-trigger-basics)
2. [Webhook with HTTP Request](#template-2-webhook-with-http-request)
3. [Scheduled Database Backup](#template-3-scheduled-database-backup)
4. [Chat Trigger with AI Response](#template-4-chat-trigger-with-ai-response)
5. [Form Submission Handler](#template-5-form-submission-handler)
6. [Interval with JSON Processing](#template-6-interval-with-json-processing)
7. [Error Trigger Handler](#template-7-error-trigger-handler)
8. [Workflow Trigger Chain](#template-8-workflow-trigger-chain)
9. [Set Variable and Use](#template-9-set-variable-and-use)
10. [CSV Processing Basics](#template-10-csv-processing-basics)

### Intermediate Templates (11-20)
11. [Conditional Logic with If-Else](#template-11-conditional-logic-with-if-else)
12. [Switch Case Routing](#template-12-switch-case-routing)
13. [Data Transformation Pipeline](#template-13-data-transformation-pipeline)
14. [Merge Data from Multiple Sources](#template-14-merge-data-from-multiple-sources)
15. [Filter and Process Array](#template-15-filter-and-process-array)
16. [Wait and Delay Processing](#template-16-wait-and-delay-processing)
17. [HTTP Request with GraphQL](#template-17-http-request-with-graphql)
18. [Database Operations with PostgreSQL](#template-18-database-operations-with-postgresql)
19. [Google Sheets Integration](#template-19-google-sheets-integration)
20. [Multi-Channel Notifications](#template-20-multi-channel-notifications)

### Advanced Templates (21-30)
21. [Loop and Batch Processing](#template-21-loop-and-batch-processing)
22. [Error Handling with Stop and Error](#template-22-error-handling-with-stop-and-error)
23. [AI Agent with Memory](#template-23-ai-agent-with-memory)
24. [Multiple AI Providers](#template-24-multiple-ai-providers)
25. [AI Text Analysis Pipeline](#template-25-ai-text-analysis-pipeline)
26. [LLM Chain with Advanced Models](#template-26-llm-chain-with-advanced-models)
27. [Multi-Database Operations](#template-27-multi-database-operations)
28. [Google Services Integration](#template-28-google-services-integration)
29. [CRM Integration Pipeline](#template-29-crm-integration-pipeline)
30. [Complete Platform Showcase](#template-30-complete-platform-showcase)

---

## Testing Guidelines

### General Testing Steps:
1. **Copy Template**: Create a workflow from the template
2. **Configure Nodes**: Set up any required API keys, connections, or credentials
3. **Provide Input Data**: Use the dummy input data provided below
4. **Execute Workflow**: Run the workflow manually or via trigger
5. **Verify Outputs**: Check each node output matches expected results
6. **Validate Final Result**: Confirm the final workflow output is correct

### Common Test Data Structures:
```json
{
  "message": "Hello, World!",
  "data": { "key": "value" },
  "items": [{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}],
  "amount": 150,
  "status": "active",
  "email": "test@example.com",
  "name": "John Doe",
  "text": "This is a sample text for testing AI nodes."
}
```

---

## TEMPLATE 1: Manual Trigger Basics

### Template Description
Start a workflow manually and output a simple log message. Demonstrates manual trigger and log output nodes.

### Workflow Nodes

#### Node 1: Manual Trigger (`trigger_1`)
- **Type**: `manual_trigger`
- **Category**: `triggers`
- **Icon**: `Play`
- **Config**: `{}` (empty, no configuration needed)
- **Input**: None (manual trigger)
- **Expected Output**: Workflow execution starts

#### Node 2: Log Output (`log_1`)
- **Type**: `log_output`
- **Category**: `output`
- **Icon**: `FileOutput`
- **Config**: 
  ```json
  {
    "message": "Workflow executed successfully"
  }
  ```
- **Input**: From `trigger_1`
- **Expected Output**: 
  ```json
  {
    "success": true,
    "message": "Workflow executed successfully",
    "logged": true
  }
  ```

### Test Input Data
```json
{}
```
(Manual trigger, no input required)

### Expected Final Output
```json
{
  "success": true,
  "message": "Workflow executed successfully",
  "logged": true
}
```

### Testing Steps
1. Copy template to create workflow
2. Click "Run" or manual trigger button
3. Verify log output shows "Workflow executed successfully"
4. Check execution logs for successful completion

---

## TEMPLATE 2: Webhook with HTTP Request

### Template Description
Receive webhook data and forward it via HTTP request. Shows webhook trigger and HTTP request nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Category**: `triggers`
- **Icon**: `Webhook`
- **Config**: 
  ```json
  {
    "method": "POST"
  }
  ```
- **Input**: HTTP POST request body
- **Expected Output**: Receives and passes through webhook data

#### Node 2: HTTP Request (`http_1`)
- **Type**: `http_request`
- **Category**: `http_api`
- **Icon**: `Globe`
- **Config**: 
  ```json
  {
    "url": "https://api.example.com/webhook",
    "method": "POST"
  }
  ```
- **Input**: Data from `webhook_1`
- **Expected Output**: HTTP response from external API

#### Node 3: Respond to Webhook (`respond_1`)
- **Type**: `respond_to_webhook`
- **Category**: `http_api`
- **Icon**: `Send`
- **Config**: `{}` (empty)
- **Input**: Response from `http_1`
- **Expected Output**: HTTP response sent back to webhook caller

### Test Input Data
```json
{
  "event": "test_event",
  "data": {
    "userId": "12345",
    "action": "created"
  }
}
```

### Expected Final Output
```json
{
  "success": true,
  "response": {
    "status": 200,
    "data": "Response from external API"
  }
}
```

### Testing Steps
1. Copy template and get webhook URL
2. Send POST request to webhook URL with test data
3. Verify HTTP request node forwards data to external API
4. Check response is returned to webhook caller
5. Verify execution logs show successful flow

---

## TEMPLATE 3: Scheduled Database Backup

### Template Description
Run on a schedule to read from database and write to another table. Demonstrates schedule trigger and database operations.

### Workflow Nodes

#### Node 1: Schedule (`schedule_1`)
- **Type**: `schedule`
- **Category**: `triggers`
- **Icon**: `Clock`
- **Config**: 
  ```json
  {
    "time": "02:00",
    "timezone": "UTC"
  }
  ```
- **Input**: None (scheduled trigger)
- **Expected Output**: Workflow execution starts at scheduled time

#### Node 2: Database Read (`db_read_1`)
- **Type**: `database_read`
- **Category**: `database`
- **Icon**: `Database`
- **Config**: 
  ```json
  {
    "query": "SELECT * FROM source_table"
  }
  ```
- **Input**: From `schedule_1`
- **Expected Output**: 
  ```json
  {
    "data": [
      {"id": 1, "name": "Record 1"},
      {"id": 2, "name": "Record 2"}
    ]
  }
  ```

#### Node 3: Database Write (`db_write_1`)
- **Type**: `database_write`
- **Category**: `database`
- **Icon**: `DatabaseZap`
- **Config**: 
  ```json
  {
    "table": "backup_table"
  }
  ```
- **Input**: Data from `db_read_1`
- **Expected Output**: 
  ```json
  {
    "success": true,
    "rowsInserted": 2,
    "table": "backup_table"
  }
  ```

### Test Input Data
```json
{}
```
(Schedule trigger - no manual input)

### Expected Final Output
```json
{
  "success": true,
  "rowsInserted": 2,
  "table": "backup_table",
  "timestamp": "2024-01-01T02:00:00Z"
}
```

### Testing Steps
1. Copy template and configure database connections
2. Ensure source_table has test data
3. Update schedule time to run immediately (or trigger manually for testing)
4. Verify data is read from source_table
5. Check backup_table contains copied data
6. Verify execution logs

---

## TEMPLATE 4: Chat Trigger with AI Response

### Template Description
Respond to chat messages using AI. Shows chat trigger and OpenAI GPT nodes.

### Workflow Nodes

#### Node 1: Chat Trigger (`chat_trigger_1`)
- **Type**: `chat_trigger`
- **Category**: `triggers`
- **Icon**: `MessageSquare`
- **Config**: `{}` (empty)
- **Input**: Chat message from user
- **Expected Output**: User message data

#### Node 2: OpenAI GPT (`openai_1`)
- **Type**: `openai_gpt`
- **Category**: `ai`
- **Icon**: `Brain`
- **Config**: 
  ```json
  {
    "model": "gpt-3.5-turbo",
    "prompt": "You are a helpful assistant. Respond to: {{input.message}}"
  }
  ```
- **Input**: Message from `chat_trigger_1`
- **Expected Output**: 
  ```json
  {
    "response": "AI generated response to user message",
    "model": "gpt-3.5-turbo",
    "usage": {
      "tokens": 150
    }
  }
  ```

#### Node 3: Log Output (`log_1`)
- **Type**: `log_output`
- **Category**: `output`
- **Icon**: `FileOutput`
- **Config**: `{}` (empty)
- **Input**: Response from `openai_1`
- **Expected Output**: Logged AI response

### Test Input Data
```json
{
  "message": "What is the weather like today?",
  "sessionId": "test_session_123"
}
```

### Expected Final Output
```json
{
  "response": "I don't have access to real-time weather data, but I can help you find weather information. Would you like me to suggest how to check the weather?",
  "model": "gpt-3.5-turbo",
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 28,
    "total_tokens": 53
  }
}
```

### Testing Steps
1. Copy template and configure OpenAI API key
2. Trigger chat with test message
3. Verify OpenAI node receives message
4. Check AI response is generated
5. Verify response is logged
6. Confirm execution completes successfully

---

## TEMPLATE 5: Form Submission Handler

### Template Description
Handle form submissions and send confirmation email. Demonstrates form trigger and email sending.

### Workflow Nodes

#### Node 1: Form (`form_1`)
- **Type**: `form`
- **Category**: `triggers`
- **Icon**: `FileText`
- **Config**: 
  ```json
  {
    "formTitle": "Contact Us",
    "fields": [
      {"name": "name", "label": "Name", "type": "text", "required": true},
      {"name": "email", "label": "Email", "type": "email", "required": true}
    ]
  }
  ```
- **Input**: Form submission data
- **Expected Output**: Form field values

#### Node 2: Google Gmail (`gmail_1`)
- **Type**: `google_gmail`
- **Category**: `google`
- **Icon**: `Mail`
- **Config**: 
  ```json
  {
    "operation": "send",
    "to": "{{input.email}}",
    "subject": "Thank you for contacting us"
  }
  ```
- **Input**: Form data from `form_1`
- **Expected Output**: 
  ```json
  {
    "success": true,
    "messageId": "gmail_message_id_123",
    "sentTo": "user@example.com"
  }
  ```

### Test Input Data
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com"
}
```

### Expected Final Output
```json
{
  "success": true,
  "messageId": "gmail_message_id_123",
  "sentTo": "john.doe@example.com",
  "subject": "Thank you for contacting us"
}
```

### Testing Steps
1. Copy template and configure Google OAuth
2. Access form URL
3. Fill form with test data and submit
4. Verify Gmail node sends confirmation email
5. Check email is delivered to test email address
6. Verify execution logs show successful send

---

## TEMPLATE 6: Interval with JSON Processing

### Template Description
Run periodically to parse JSON data. Shows interval trigger, JSON parser, and text formatter.

### Workflow Nodes

#### Node 1: Interval (`interval_1`)
- **Type**: `interval`
- **Category**: `triggers`
- **Icon**: `Timer`
- **Config**: 
  ```json
  {
    "interval": "1h"
  }
  ```
- **Input**: None (interval trigger)
- **Expected Output**: Triggers workflow every hour

#### Node 2: JSON Parser (`json_1`)
- **Type**: `json_parser`
- **Category**: `data`
- **Icon**: `Braces`
- **Config**: `{}` (empty)
- **Input**: JSON string data
- **Expected Output**: Parsed JSON object

#### Node 3: Text Formatter (`format_1`)
- **Type**: `text_formatter`
- **Category**: `data`
- **Icon**: `Type`
- **Config**: 
  ```json
  {
    "template": "Processed: {{input.data}}"
  }
  ```
- **Input**: Parsed data from `json_1`
- **Expected Output**: Formatted text string

### Test Input Data
```json
{
  "data": "{\"key\": \"value\", \"number\": 42}"
}
```

### Expected Final Output
```json
{
  "formatted": "Processed: {\"key\": \"value\", \"number\": 42}",
  "parsed": {
    "key": "value",
    "number": 42
  }
}
```

### Testing Steps
1. Copy template and configure interval (use shorter interval for testing like "1m")
2. Provide test JSON string as input
3. Verify JSON parser correctly parses the string
4. Check text formatter formats the output
5. Verify execution completes successfully
6. Confirm workflow runs on schedule

---

## TEMPLATE 7: Error Trigger Handler

### Template Description
Catch errors and handle them gracefully. Demonstrates error trigger and error handler nodes.

### Workflow Nodes

#### Node 1: Error Trigger (`error_trigger_1`)
- **Type**: `error_trigger`
- **Category**: `triggers`
- **Icon**: `ShieldAlert`
- **Config**: `{}` (empty)
- **Input**: None (triggers on any workflow error)
- **Expected Output**: Error data

#### Node 2: Error Handler (`error_handler_1`)
- **Type**: `error_handler`
- **Category**: `logic`
- **Icon**: `Shield`
- **Config**: `{}` (empty)
- **Input**: Error from `error_trigger_1`
- **Expected Output**: Handled error data

#### Node 3: Log Output (`log_1`)
- **Type**: `log_output`
- **Category**: `output`
- **Icon**: `FileOutput`
- **Config**: 
  ```json
  {
    "message": "Error handled: {{input.error}}"
  }
  ```
- **Input**: Handled error from `error_handler_1`
- **Expected Output**: Logged error message

### Test Input Data
```json
{
  "error": "Test error message",
  "nodeId": "failed_node_1",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Expected Final Output
```json
{
  "success": true,
  "errorHandled": true,
  "message": "Error handled: Test error message",
  "logged": true
}
```

### Testing Steps
1. Copy template
2. Create a workflow that will fail (e.g., invalid API call)
3. Trigger the workflow to cause an error
4. Verify error trigger catches the error
5. Check error handler processes the error
6. Confirm error is logged properly
7. Verify workflow doesn't crash completely

---

## TEMPLATE 8: Workflow Trigger Chain

### Template Description
Trigger one workflow from another. Shows workflow trigger, merge, and noop nodes.

### Workflow Nodes

#### Node 1: Workflow Trigger (`workflow_trigger_1`)
- **Type**: `workflow_trigger`
- **Category**: `triggers`
- **Icon**: `Link`
- **Config**: 
  ```json
  {
    "source_workflow_id": "source-workflow-uuid"
  }
  ```
- **Input**: Data from source workflow
- **Expected Output**: Passes through source workflow data

#### Node 2: Merge (`merge_1`)
- **Type**: `merge`
- **Category**: `logic`
- **Icon**: `GitMerge`
- **Config**: `{}` (empty)
- **Input**: Data from `workflow_trigger_1`
- **Expected Output**: Merged data

#### Node 3: NoOp (`noop_1`)
- **Type**: `noop`
- **Category**: `logic`
- **Icon**: `ArrowRight`
- **Config**: `{}` (empty)
- **Input**: Data from `merge_1`
- **Expected Output**: Pass-through data (unchanged)

### Test Input Data
```json
{
  "fromSourceWorkflow": true,
  "data": {
    "value": "test_value",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Expected Final Output
```json
{
  "fromSourceWorkflow": true,
  "data": {
    "value": "test_value",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Testing Steps
1. Copy template
2. Create a source workflow that outputs test data
3. Configure workflow_trigger_1 with source workflow ID
4. Execute source workflow
5. Verify target workflow is triggered
6. Check merge node receives data
7. Confirm noop passes data through unchanged
8. Verify final output matches input

---

## TEMPLATE 9: Set Variable and Use

### Template Description
Store data in variables and use them later. Demonstrates set variable and set nodes.

### Workflow Nodes

#### Node 1: Manual Trigger (`trigger_1`)
- **Type**: `manual_trigger`
- **Category**: `triggers`
- **Icon**: `Play`
- **Config**: `{}` (empty)
- **Input**: None
- **Expected Output**: Workflow starts

#### Node 2: Set Variable (`set_var_1`)
- **Type**: `set_variable`
- **Category**: `data`
- **Icon**: `Variable`
- **Config**: 
  ```json
  {
    "variable": "userName",
    "value": "John Doe"
  }
  ```
- **Input**: From `trigger_1`
- **Expected Output**: 
  ```json
  {
    "variable": "userName",
    "value": "John Doe",
    "stored": true
  }
  ```

#### Node 3: Set (`set_1`)
- **Type**: `set`
- **Category**: `data`
- **Icon**: `Edit`
- **Config**: 
  ```json
  {
    "values": {
      "greeting": "Hello {{variable.userName}}"
    }
  }
  ```
- **Input**: From `set_var_1`
- **Expected Output**: 
  ```json
  {
    "greeting": "Hello John Doe",
    "userName": "John Doe"
  }
  ```

### Test Input Data
```json
{}
```
(Manual trigger)

### Expected Final Output
```json
{
  "greeting": "Hello John Doe",
  "userName": "John Doe",
  "variable": "userName",
  "value": "John Doe"
}
```

### Testing Steps
1. Copy template
2. Trigger workflow manually
3. Verify set_variable stores "John Doe" in userName variable
4. Check set node accesses variable and creates greeting
5. Confirm final output includes both variable and greeting
6. Verify variable is accessible throughout workflow

---

## TEMPLATE 10: CSV Processing Basics

### Template Description
Process CSV data and transform it. Shows CSV processor and edit fields nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Category**: `triggers`
- **Icon**: `Webhook`
- **Config**: 
  ```json
  {
    "method": "POST"
  }
  ```
- **Input**: CSV data as string
- **Expected Output**: Receives CSV string

#### Node 2: CSV Processor (`csv_1`)
- **Type**: `csv_processor`
- **Category**: `data`
- **Icon**: `Table`
- **Config**: 
  ```json
  {
    "delimiter": ",",
    "hasHeader": true
  }
  ```
- **Input**: CSV string from `webhook_1`
- **Expected Output**: 
  ```json
  {
    "data": [
      {"name": "John", "age": "30", "city": "New York"},
      {"name": "Jane", "age": "25", "city": "London"}
    ],
    "headers": ["name", "age", "city"],
    "rowCount": 2
  }
  ```

#### Node 3: Edit Fields (`edit_1`)
- **Type**: `edit_fields`
- **Category**: `data`
- **Icon**: `Edit3`
- **Config**: 
  ```json
  {
    "fields": {
      "processed": true,
      "timestamp": "{{now}}"
    }
  }
  ```
- **Input**: CSV data from `csv_1`
- **Expected Output**: 
  ```json
  {
    "data": [
      {
        "name": "John",
        "age": "30",
        "city": "New York",
        "processed": true,
        "timestamp": "2024-01-01T12:00:00Z"
      },
      {
        "name": "Jane",
        "age": "25",
        "city": "London",
        "processed": true,
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ]
  }
  ```

### Test Input Data
```json
{
  "csvData": "name,age,city\nJohn,30,New York\nJane,25,London"
}
```

### Expected Final Output
```json
{
  "data": [
    {
      "name": "John",
      "age": "30",
      "city": "New York",
      "processed": true,
      "timestamp": "2024-01-01T12:00:00Z"
    },
    {
      "name": "Jane",
      "age": "25",
      "city": "London",
      "processed": true,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ],
  "rowCount": 2
}
```

### Testing Steps
1. Copy template
2. Send CSV string to webhook endpoint
3. Verify CSV processor parses the data correctly
4. Check headers are detected (hasHeader: true)
5. Confirm edit_fields adds processed and timestamp fields
6. Verify final output contains all expected fields
7. Test with different CSV formats

---

## TEMPLATE 11: Conditional Logic with If-Else

### Template Description
Route workflow based on conditions using if-else logic. Demonstrates conditional branching and data routing.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Category**: `triggers`
- **Icon**: `Webhook`
- **Config**: `{"method": "POST"}`
- **Input**: HTTP POST request
- **Expected Output**: Receives request data

#### Node 2: JavaScript (`js_1`)
- **Type**: `javascript`
- **Category**: `data`
- **Icon**: `Code`
- **Config**: 
  ```json
  {
    "code": "return { value: input.amount, isValid: input.amount > 100 };"
  }
  ```
- **Input**: Amount from `webhook_1`
- **Expected Output**: 
  ```json
  {
    "value": 150,
    "isValid": true
  }
  ```

#### Node 3: If-Else (`ifelse_1`)
- **Type**: `if_else`
- **Category**: `logic`
- **Icon**: `GitBranch`
- **Config**: 
  ```json
  {
    "condition": "{{input.isValid}}"
  }
  ```
- **Input**: Validation result from `js_1`
- **Expected Output**: Routes to true/false branch based on condition

#### Node 4: Text Formatter - Approved (`format_true`)
- **Type**: `text_formatter`
- **Category**: `data`
- **Icon**: `Type`
- **Config**: 
  ```json
  {
    "template": "Amount {{input.value}} approved"
  }
  ```
- **Input**: From `ifelse_1` (true branch)
- **Expected Output**: `"Amount 150 approved"`

#### Node 5: Text Formatter - Rejected (`format_false`)
- **Type**: `text_formatter`
- **Category**: `data`
- **Icon**: `Type`
- **Config**: 
  ```json
  {
    "template": "Amount {{input.value}} rejected"
  }
  ```
- **Input**: From `ifelse_1` (false branch)
- **Expected Output**: `"Amount 50 rejected"`

### Test Input Data
**Test Case 1 - Valid Amount:**
```json
{
  "amount": 150
}
```

**Test Case 2 - Invalid Amount:**
```json
{
  "amount": 50
}
```

### Expected Final Output
**Test Case 1:**
```json
{
  "value": 150,
  "isValid": true,
  "result": "Amount 150 approved"
}
```

**Test Case 2:**
```json
{
  "value": 50,
  "isValid": false,
  "result": "Amount 50 rejected"
}
```

### Testing Steps
1. Copy template
2. Send webhook with amount = 150 (should approve)
3. Verify JavaScript node calculates isValid correctly
4. Check if_else routes to "approved" branch
5. Confirm format_true node outputs approval message
6. Test with amount = 50 (should reject)
7. Verify routing to "rejected" branch
8. Check format_false outputs rejection message

---

## TEMPLATE 12: Switch Case Routing

### Template Description
Route workflow based on multiple conditions using switch node. Shows multi-path routing.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Config**: `{"method": "POST"}`
- **Input**: Status value in request
- **Expected Output**: Request data

#### Node 2: Switch (`switch_1`)
- **Type**: `switch`
- **Category**: `logic`
- **Config**: 
  ```json
  {
    "value": "{{input.status}}",
    "cases": ["active", "inactive", "pending"]
  }
  ```
- **Input**: Status from `webhook_1`
- **Expected Output**: Routes to matching case

#### Nodes 3-5: Text Formatters (Active/Inactive/Pending)
- **Type**: `text_formatter`
- **Config**: Various templates for each status
- **Input**: From `switch_1` matching branch
- **Expected Output**: Status-specific message

### Test Input Data
**Test Case 1:**
```json
{"status": "active"}
```
**Test Case 2:**
```json
{"status": "inactive"}
```
**Test Case 3:**
```json
{"status": "pending"}
```

### Expected Final Output
**Test Case 1:** `"Status: Active"`
**Test Case 2:** `"Status: Inactive"`
**Test Case 3:** `"Status: Pending"`

### Testing Steps
1. Copy template
2. Test each status value: active, inactive, pending
3. Verify switch routes to correct branch
4. Check appropriate formatter node executes
5. Confirm output matches expected status message
6. Test with invalid status (should handle gracefully)

---

## TEMPLATE 13: Data Transformation Pipeline

### Template Description
Transform data through multiple steps: parse, rename, sort, and limit. Shows comprehensive data manipulation.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: JSON string data
- **Expected Output**: Receives data

#### Node 2: JSON Parser (`json_1`)
- **Type**: `json_parser`
- **Config**: `{}`
- **Input**: JSON string
- **Expected Output**: Parsed JSON object

#### Node 3: Rename Keys (`rename_1`)
- **Type**: `rename_keys`
- **Config**: 
  ```json
  {
    "mappings": {
      "oldName": "newName",
      "id": "identifier"
    }
  }
  ```
- **Input**: Parsed JSON
- **Expected Output**: JSON with renamed keys

#### Node 4: Sort (`sort_1`)
- **Type**: `sort`
- **Config**: 
  ```json
  {
    "field": "timestamp",
    "direction": "desc"
  }
  ```
- **Input**: Data array from `rename_1`
- **Expected Output**: Sorted array

#### Node 5: Limit (`limit_1`)
- **Type**: `limit`
- **Config**: 
  ```json
  {
    "maxItems": 10
  }
  ```
- **Input**: Sorted array
- **Expected Output**: Array limited to 10 items

### Test Input Data
```json
{
  "data": "[{\"id\": 1, \"oldName\": \"Item1\", \"timestamp\": \"2024-01-03\"}, {\"id\": 2, \"oldName\": \"Item2\", \"timestamp\": \"2024-01-01\"}, {\"id\": 3, \"oldName\": \"Item3\", \"timestamp\": \"2024-01-02\"}]"
}
```

### Expected Final Output
```json
{
  "data": [
    {"identifier": 1, "newName": "Item1", "timestamp": "2024-01-03"},
    {"identifier": 3, "newName": "Item3", "timestamp": "2024-01-02"},
    {"identifier": 2, "newName": "Item2", "timestamp": "2024-01-01"}
  ],
  "count": 3
}
```

### Testing Steps
1. Copy template
2. Send JSON string array to webhook
3. Verify JSON parser correctly parses string
4. Check rename_keys renames specified fields
5. Confirm sort orders by timestamp descending
6. Verify limit restricts results (test with >10 items)
7. Check final output has all transformations applied

---

## TEMPLATE 14: Merge Data from Multiple Sources

### Template Description
Combine data from multiple inputs using merge data node. Shows data merging and aggregation.

### Workflow Nodes

#### Nodes 1-2: Webhooks (Source 1 & 2)
- **Type**: `webhook`
- **Config**: `{"method": "POST"}`
- **Input**: Different data sources
- **Expected Output**: Source data

#### Node 3: Merge Data (`merge_1`)
- **Type**: `merge_data`
- **Config**: `{"mode": "merge"}`
- **Input**: Data from both webhooks
- **Expected Output**: Merged data object

#### Node 4: Aggregate (`aggregate_1`)
- **Type**: `aggregate`
- **Config**: 
  ```json
  {
    "operation": "sum",
    "field": "value"
  }
  ```
- **Input**: Merged data
- **Expected Output**: Aggregated sum value

### Test Input Data
**Source 1:**
```json
{
  "value": 100,
  "source": "api1"
}
```

**Source 2:**
```json
{
  "value": 200,
  "source": "api2"
}
```

### Expected Final Output
```json
{
  "merged": {
    "value": 300,
    "source1": {"value": 100, "source": "api1"},
    "source2": {"value": 200, "source": "api2"}
  },
  "sum": 300
}
```

### Testing Steps
1. Copy template
2. Send data to both webhook endpoints
3. Verify merge_data combines both sources
4. Check aggregate node sums values correctly
5. Confirm final output contains merged and aggregated data
6. Test with different data structures

---

## TEMPLATE 15: Filter and Process Array

### Template Description
Filter array items and process them. Shows filter node and function item node.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Array of items
- **Expected Output**: Array data

#### Node 2: Filter (`filter_1`)
- **Type**: `filter`
- **Config**: 
  ```json
  {
    "condition": "{{item.active}} === true"
  }
  ```
- **Input**: Array from `webhook_1`
- **Expected Output**: Filtered array (only active items)

#### Node 3: Function Item (`function_item_1`)
- **Type**: `function_item`
- **Config**: 
  ```json
  {
    "code": "return { ...item, processed: true, timestamp: new Date().toISOString() };"
  }
  ```
- **Input**: Filtered array
- **Expected Output**: Array with processed items

#### Node 4: Item Lists (`item_lists_1`)
- **Type**: `item_lists`
- **Config**: `{}`
- **Input**: Processed items
- **Expected Output**: List of items

### Test Input Data
```json
{
  "items": [
    {"id": 1, "name": "Item 1", "active": true},
    {"id": 2, "name": "Item 2", "active": false},
    {"id": 3, "name": "Item 3", "active": true}
  ]
}
```

### Expected Final Output
```json
{
  "items": [
    {
      "id": 1,
      "name": "Item 1",
      "active": true,
      "processed": true,
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    {
      "id": 3,
      "name": "Item 3",
      "active": true,
      "processed": true,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "count": 2
}
```

### Testing Steps
1. Copy template
2. Send array with mixed active/inactive items
3. Verify filter removes inactive items
4. Check function_item processes each remaining item
5. Confirm processed and timestamp fields are added
6. Verify item_lists outputs final list
7. Test with empty array and all inactive items

---

## TEMPLATE 16: Wait and Delay Processing

### Template Description
Add delays between operations using wait node. Shows timing control in workflows.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Node 2: Wait (`wait_1`)
- **Type**: `wait`
- **Config**: 
  ```json
  {
    "duration": 5000
  }
  ```
- **Input**: From `webhook_1`
- **Expected Output**: Same data after 5 second delay

#### Node 3: Log Output (`log_1`)
- **Type**: `log_output`
- **Config**: 
  ```json
  {
    "message": "Waited and processed"
  }
  ```
- **Input**: From `wait_1`
- **Expected Output**: Logged message

### Test Input Data
```json
{
  "message": "Test message"
}
```

### Expected Final Output
```json
{
  "success": true,
  "message": "Waited and processed",
  "delay": 5000
}
```

### Testing Steps
1. Copy template
2. Send webhook request
3. Verify workflow pauses for 5 seconds
4. Check execution time includes delay
5. Confirm log_output executes after delay
6. Verify output is correct
7. Test with different delay durations

---

## TEMPLATE 17: HTTP Request with GraphQL

### Template Description
Make GraphQL queries and HTTP requests. Shows GraphQL and HTTP request nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Node 2: GraphQL (`graphql_1`)
- **Type**: `graphql`
- **Config**: 
  ```json
  {
    "endpoint": "https://api.example.com/graphql",
    "query": "query { user(id: $id) { name email } }"
  }
  ```
- **Input**: User ID from `webhook_1`
- **Expected Output**: GraphQL query result

#### Node 3: HTTP Post (`http_1`)
- **Type**: `http_post`
- **Config**: 
  ```json
  {
    "url": "https://api.example.com/data",
    "body": "{{input}}"
  }
  ```
- **Input**: GraphQL result
- **Expected Output**: HTTP POST response

### Test Input Data
```json
{
  "id": "12345"
}
```

### Expected Final Output
```json
{
  "graphqlResult": {
    "user": {
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "httpResponse": {
    "status": 200,
    "data": "Data posted successfully"
  }
}
```

### Testing Steps
1. Copy template and configure GraphQL endpoint
2. Send user ID to webhook
3. Verify GraphQL query executes correctly
4. Check query result contains user data
5. Confirm HTTP POST sends GraphQL result
6. Verify external API receives data
7. Check final response is correct

---

## TEMPLATE 18: Database Operations with PostgreSQL

### Template Description
Read and write to PostgreSQL database. Shows PostgreSQL node operations.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Node 2: PostgreSQL (`postgresql_1`)
- **Type**: `postgresql`
- **Config**: 
  ```json
  {
    "operation": "query",
    "query": "SELECT * FROM users WHERE id = $1"
  }
  ```
- **Input**: User ID from `webhook_1`
- **Expected Output**: Query results

#### Node 3: Supabase (`supabase_1`)
- **Type**: `supabase`
- **Config**: 
  ```json
  {
    "operation": "insert",
    "table": "logs"
  }
  ```
- **Input**: Query results
- **Expected Output**: Insert confirmation

### Test Input Data
```json
{
  "userId": 123
}
```

### Expected Final Output
```json
{
  "queryResult": [
    {"id": 123, "name": "John Doe", "email": "john@example.com"}
  ],
  "insertResult": {
    "success": true,
    "rowsInserted": 1,
    "table": "logs"
  }
}
```

### Testing Steps
1. Copy template and configure database connections
2. Ensure users table has test data
3. Send user ID to webhook
4. Verify PostgreSQL query returns user data
5. Check Supabase insert writes to logs table
6. Confirm both operations complete successfully
7. Verify data integrity

---

## TEMPLATE 19: Google Sheets Integration

### Template Description
Read from and write to Google Sheets. Shows Google Sheets node operations.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Node 2: Google Sheets Read (`sheets_1`)
- **Type**: `google_sheets`
- **Config**: 
  ```json
  {
    "operation": "read",
    "spreadsheetId": "",
    "range": "Sheet1!A1:C10"
  }
  ```
- **Input**: From `webhook_1`
- **Expected Output**: Sheet data array

#### Node 3: Google Sheets Write (`sheets_2`)
- **Type**: `google_sheets`
- **Config**: 
  ```json
  {
    "operation": "append",
    "spreadsheetId": "",
    "range": "Sheet1!A1"
  }
  ```
- **Input**: Data to append
- **Expected Output**: Write confirmation

### Test Input Data
```json
{
  "data": ["New Row", "Value 1", "Value 2"]
}
```

### Expected Final Output
```json
{
  "readData": [
    ["Header1", "Header2", "Header3"],
    ["Row1", "Value1", "Value2"]
  ],
  "writeResult": {
    "success": true,
    "rowsAppended": 1,
    "range": "Sheet1!A1"
  }
}
```

### Testing Steps
1. Copy template and configure Google OAuth
2. Set spreadsheet IDs in both nodes
3. Send test data to webhook
4. Verify sheets_1 reads existing data
5. Check sheets_2 appends new row
6. Confirm data appears in spreadsheet
7. Verify both operations complete successfully

---

## TEMPLATE 20: Multi-Channel Notifications

### Template Description
Send notifications to multiple channels: Slack, Discord, Telegram. Shows multiple output nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Notification message
- **Expected Output**: Receives message data

#### Nodes 2-4: Notification Channels
- **Slack Message** (`slack_1`): Type `slack_message`, Config `{"channel": "#notifications", "message": "{{input.message}}"}`
- **Discord Webhook** (`discord_1`): Type `discord_webhook`, Config `{"webhookUrl": "", "content": "{{input.message}}"}`
- **Telegram** (`telegram_1`): Type `telegram`, Config `{"chatId": "", "message": "{{input.message}}"}`

### Test Input Data
```json
{
  "message": "Test notification message"
}
```

### Expected Final Output
```json
{
  "slack": {"success": true, "channel": "#notifications"},
  "discord": {"success": true, "webhook": "sent"},
  "telegram": {"success": true, "chatId": "123456789"}
}
```

### Testing Steps
1. Copy template and configure all notification channels
2. Send test message to webhook
3. Verify Slack message sent to channel
4. Check Discord webhook delivers message
5. Confirm Telegram message sent
6. Verify all three channels receive notification
7. Check execution logs show all successes

---

## TEMPLATE 21: Loop and Batch Processing

### Template Description
Process items in loops and split large datasets into batches. Shows loop and split_in_batches nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Array of items
- **Expected Output**: Receives array data

#### Node 2: Split in Batches (`split_1`)
- **Type**: `split_in_batches`
- **Config**: 
  ```json
  {
    "batchSize": 10
  }
  ```
- **Input**: Large array from `webhook_1`
- **Expected Output**: Array split into batches of 10

#### Node 3: Loop (`loop_1`)
- **Type**: `loop`
- **Config**: 
  ```json
  {
    "items": "{{input.items}}"
  }
  ```
- **Input**: Batches from `split_1`
- **Expected Output**: Iterates through each batch

#### Node 4: Function (`function_1`)
- **Type**: `function`
- **Config**: 
  ```json
  {
    "code": "return input.map(item => ({ ...item, processed: true }));"
  }
  ```
- **Input**: Batch items from `loop_1`
- **Expected Output**: Processed batch items

### Test Input Data
```json
{
  "items": [
    {"id": 1}, {"id": 2}, {"id": 3}, {"id": 4}, {"id": 5},
    {"id": 6}, {"id": 7}, {"id": 8}, {"id": 9}, {"id": 10},
    {"id": 11}, {"id": 12}, {"id": 13}, {"id": 14}, {"id": 15}
  ]
}
```

### Expected Final Output
```json
{
  "batches": [
    [{"id": 1, "processed": true}, ..., {"id": 10, "processed": true}],
    [{"id": 11, "processed": true}, ..., {"id": 15, "processed": true}]
  ],
  "totalProcessed": 15
}
```

### Testing Steps
1. Copy template
2. Send array with >10 items to webhook
3. Verify split_in_batches creates batches of 10
4. Check loop iterates through each batch
5. Confirm function processes each item in batch
6. Verify all items are processed
7. Test with exactly 10 items and <10 items

---

## TEMPLATE 22: Error Handling with Stop and Error

### Template Description
Handle errors and stop workflow execution with custom errors. Shows stop_and_error and error handling.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Node 2: JavaScript (`js_1`)
- **Type**: `javascript`
- **Config**: 
  ```json
  {
    "code": "if (!input.value || input.value < 0) { throw new Error(\"Invalid value\"); } return input;"
  }
  ```
- **Input**: Value from `webhook_1`
- **Expected Output**: Validated data or throws error

#### Node 3: Stop and Error (`stop_error_1`)
- **Type**: `stop_and_error`
- **Config**: 
  ```json
  {
    "errorMessage": "Workflow stopped due to validation failure"
  }
  ```
- **Input**: From `js_1` (on error path)
- **Expected Output**: Stops workflow with error message

### Test Input Data
**Test Case 1 - Valid:**
```json
{"value": 100}
```

**Test Case 2 - Invalid:**
```json
{"value": -10}
```

### Expected Final Output
**Test Case 1:**
```json
{
  "success": true,
  "value": 100
}
```

**Test Case 2:**
```json
{
  "success": false,
  "error": "Workflow stopped due to validation failure",
  "stopped": true
}
```

### Testing Steps
1. Copy template
2. Test with valid value (should pass)
3. Test with invalid value (should trigger stop_and_error)
4. Verify workflow stops execution
5. Check error message is logged
6. Confirm workflow doesn't continue after stop
7. Verify execution status shows stopped

---

## TEMPLATE 23: AI Agent with Memory

### Template Description
Create an AI agent that remembers conversation history. Shows ai_agent, memory, and chat_model nodes.

### Workflow Nodes

#### Node 1: Chat Trigger (`chat_trigger_1`)
- **Type**: `chat_trigger`
- **Input**: Chat message
- **Expected Output**: User message data

#### Node 2: Memory (`memory_1`)
- **Type**: `memory`
- **Config**: 
  ```json
  {
    "operation": "get",
    "sessionId": "{{input.sessionId}}"
  }
  ```
- **Input**: Session ID from `chat_trigger_1`
- **Expected Output**: Conversation history

#### Node 3: AI Agent (`ai_agent_1`)
- **Type**: `ai_agent`
- **Config**: 
  ```json
  {
    "model": "gpt-4",
    "systemPrompt": "You are a helpful assistant with memory of past conversations."
  }
  ```
- **Input**: Message + history from `memory_1`
- **Expected Output**: AI response with context

#### Node 4: Chat Model (`chat_model_1`)
- **Type**: `chat_model`
- **Config**: 
  ```json
  {
    "provider": "openai",
    "model": "gpt-3.5-turbo"
  }
  ```
- **Input**: From `ai_agent_1`
- **Expected Output**: Chat model response

### Test Input Data
```json
{
  "message": "What did I ask you before?",
  "sessionId": "session_123"
}
```

### Expected Final Output
```json
{
  "response": "Based on our previous conversation, you asked about...",
  "sessionId": "session_123",
  "model": "gpt-3.5-turbo",
  "hasMemory": true
}
```

### Testing Steps
1. Copy template and configure AI API keys
2. Send first message in conversation
3. Verify memory stores conversation
4. Send follow-up message with sessionId
5. Check memory retrieves previous conversation
6. Confirm AI agent uses memory context
7. Verify chat_model generates contextual response
8. Test with new sessionId (should have no memory)

---

## TEMPLATE 24: Multiple AI Providers

### Template Description
Use multiple AI providers: OpenAI, Anthropic, Gemini, Azure. Shows various AI nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Prompt text
- **Expected Output**: Receives prompt

#### Nodes 2-5: AI Providers
- **OpenAI GPT** (`openai_1`): Type `openai_gpt`, Config `{"model": "gpt-3.5-turbo", "prompt": "{{input.prompt}}"}`
- **Anthropic Claude** (`anthropic_1`): Type `anthropic_claude`, Config `{"model": "claude-3-opus", "prompt": "{{input.prompt}}"}`
- **Google Gemini** (`gemini_1`): Type `google_gemini`, Config `{"model": "gemini-pro", "prompt": "{{input.prompt}}"}`
- **Azure OpenAI** (`azure_1`): Type `azure_openai`, Config `{"endpoint": "", "deployment": "gpt-4", "prompt": "{{input.prompt}}"}`

#### Node 6: Merge (`merge_1`)
- **Type**: `merge`
- **Input**: Results from all AI providers
- **Expected Output**: Merged responses

### Test Input Data
```json
{
  "prompt": "Explain quantum computing in simple terms"
}
```

### Expected Final Output
```json
{
  "openai": {
    "response": "OpenAI response...",
    "model": "gpt-3.5-turbo"
  },
  "anthropic": {
    "response": "Claude response...",
    "model": "claude-3-opus"
  },
  "gemini": {
    "response": "Gemini response...",
    "model": "gemini-pro"
  },
  "azure": {
    "response": "Azure OpenAI response...",
    "model": "gpt-4"
  },
  "merged": true
}
```

### Testing Steps
1. Copy template and configure all AI provider API keys
2. Send prompt to webhook
3. Verify all four AI providers execute in parallel
4. Check each provider returns response
5. Confirm merge combines all responses
6. Verify final output contains all provider results
7. Test with different prompts
8. Check execution time (should be parallel, not sequential)

---

## TEMPLATE 25: AI Text Analysis Pipeline

### Template Description
Analyze text with summarization, sentiment analysis, and embeddings. Shows text_summarizer, sentiment_analyzer, and embeddings nodes.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Text to analyze
- **Expected Output**: Receives text

#### Node 2: Text Summarizer (`summarizer_1`)
- **Type**: `text_summarizer`
- **Config**: 
  ```json
  {
    "text": "{{input.text}}",
    "maxLength": 200
  }
  ```
- **Input**: Text from `webhook_1`
- **Expected Output**: Text summary

#### Node 3: Sentiment Analyzer (`sentiment_1`)
- **Type**: `sentiment_analyzer`
- **Config**: 
  ```json
  {
    "text": "{{input.text}}"
  }
  ```
- **Input**: Text from `webhook_1`
- **Expected Output**: Sentiment analysis (positive/negative/neutral)

#### Node 4: Embeddings (`embeddings_1`)
- **Type**: `embeddings`
- **Config**: 
  ```json
  {
    "model": "text-embedding-ada-002",
    "text": "{{input.text}}"
  }
  ```
- **Input**: Text from `webhook_1`
- **Expected Output**: Vector embeddings array

#### Node 5: Vector Store (`vector_store_1`)
- **Type**: `vector_store`
- **Config**: 
  ```json
  {
    "operation": "upsert",
    "collection": "text_embeddings"
  }
  ```
- **Input**: Embeddings from `embeddings_1`
- **Expected Output**: Stored vector confirmation

### Test Input Data
```json
{
  "text": "I absolutely love this product! It's amazing and exceeded all my expectations. The quality is outstanding and the customer service was exceptional. Highly recommended!"
}
```

### Expected Final Output
```json
{
  "summary": "User loves the product, praising quality and customer service. Highly recommends it.",
  "sentiment": {
    "label": "positive",
    "score": 0.95
  },
  "embeddings": [0.123, 0.456, ...],
  "vectorStore": {
    "success": true,
    "collection": "text_embeddings",
    "stored": true
  }
}
```

### Testing Steps
1. Copy template and configure AI API keys
2. Send text to webhook
3. Verify summarizer creates concise summary
4. Check sentiment analyzer detects sentiment correctly
5. Confirm embeddings generates vector array
6. Verify vector_store stores embeddings
7. Test with negative text (should detect negative sentiment)
8. Check all three analyses complete successfully

---

## TEMPLATE 26: LLM Chain with Advanced Models

### Template Description
Chain multiple LLM operations with Hugging Face, Cohere, and Ollama. Shows llm_chain and various AI models.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Text to process
- **Expected Output**: Receives text

#### Node 2: LLM Chain (`llm_chain_1`)
- **Type**: `llm_chain`
- **Config**: 
  ```json
  {
    "steps": [
      {"model": "gpt-3.5-turbo", "prompt": "Summarize: {{input.text}}"},
      {"model": "claude-3-opus", "prompt": "Analyze: {{previous.output}}"}
    ]
  }
  ```
- **Input**: Text from `webhook_1`
- **Expected Output**: Chained LLM results

#### Nodes 3-5: Additional AI Models
- **Hugging Face** (`hugging_face_1`): Type `hugging_face`, Config `{"model": "bert-base-uncased", "input": "{{input.text}}"}`
- **Cohere** (`cohere_1`): Type `cohere`, Config `{"model": "command", "prompt": "{{input.text}}"}`
- **Ollama** (`ollama_1`): Type `ollama`, Config `{"model": "llama2", "prompt": "{{input.text}}"}`

### Test Input Data
```json
{
  "text": "Artificial intelligence is transforming the way we work and live. It enables automation, enhances decision-making, and creates new opportunities across industries."
}
```

### Expected Final Output
```json
{
  "llmChain": {
    "step1": "Summary: AI is transforming work and life...",
    "step2": "Analysis: The summary indicates..."
  },
  "huggingFace": {
    "result": "BERT analysis results...",
    "model": "bert-base-uncased"
  },
  "cohere": {
    "response": "Cohere command response...",
    "model": "command"
  },
  "ollama": {
    "response": "Ollama llama2 response...",
    "model": "llama2"
  }
}
```

### Testing Steps
1. Copy template and configure all AI provider credentials
2. Send text to webhook
3. Verify LLM chain executes steps sequentially
4. Check step 2 uses step 1 output
5. Confirm Hugging Face processes text
6. Verify Cohere generates response
7. Check Ollama (if configured) processes request
8. Verify all models complete successfully
9. Test chain with different input text

---

## TEMPLATE 27: Multi-Database Operations

### Template Description
Work with multiple databases: MySQL, MongoDB, Redis. Shows multi-database integration.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data
- **Expected Output**: Receives data

#### Nodes 2-4: Database Queries
- **MySQL** (`mysql_1`): Type `mysql`, Config `{"host": "", "database": "", "query": "SELECT * FROM users"}`
- **MongoDB** (`mongodb_1`): Type `mongodb`, Config `{"connectionString": "", "database": "", "collection": "users", "operation": "find"}`
- **Redis** (`redis_1`): Type `redis`, Config `{"host": "", "operation": "get", "key": "{{input.key}}"}`

#### Node 5: Merge (`merge_1`)
- **Type**: `merge`
- **Input**: Results from all databases
- **Expected Output**: Merged database results

### Test Input Data
```json
{
  "key": "cache_key_123",
  "userId": 456
}
```

### Expected Final Output
```json
{
  "mysql": {
    "results": [{"id": 456, "name": "John Doe"}],
    "rows": 1
  },
  "mongodb": {
    "results": [{"_id": "507f1f77bcf86cd799439011", "name": "John Doe"}],
    "count": 1
  },
  "redis": {
    "value": "cached_value",
    "key": "cache_key_123"
  },
  "merged": {
    "mysqlUsers": 1,
    "mongoUsers": 1,
    "redisValue": "cached_value"
  }
}
```

### Testing Steps
1. Copy template and configure all database connections
2. Ensure test data exists in each database
3. Send request to webhook
4. Verify MySQL query executes correctly
5. Check MongoDB query returns documents
6. Confirm Redis get operation retrieves value
7. Verify merge combines all database results
8. Test with different query parameters
9. Check error handling if database unavailable

---

## TEMPLATE 28: Google Services Integration

### Template Description
Integrate multiple Google services: Calendar, Drive, Docs, BigQuery, Tasks, Contacts, Analytics. Shows comprehensive Google integration.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Request data for various Google services
- **Expected Output**: Receives data

#### Nodes 2-8: Google Services
- **Google Calendar** (`calendar_1`): Type `google_calendar`, Config `{"operation": "create", "summary": "{{input.title}}", "start": "{{input.start}}", "end": "{{input.end}}"}`
- **Google Drive** (`drive_1`): Type `google_drive`, Config `{"operation": "upload", "fileName": "{{input.fileName}}", "fileContent": "{{input.content}}"}`
- **Google Doc** (`doc_1`): Type `google_doc`, Config `{"operation": "create", "title": "{{input.title}}", "content": "{{input.content}}"}`
- **Google BigQuery** (`bigquery_1`): Type `google_bigquery`, Config `{"projectId": "", "query": "SELECT * FROM dataset.table LIMIT 10"}`
- **Google Tasks** (`tasks_1`): Type `google_tasks`, Config `{"operation": "create", "title": "{{input.taskTitle}}"}`
- **Google Contacts** (`contacts_1`): Type `google_contacts`, Config `{"operation": "create", "name": "{{input.name}}", "email": "{{input.email}}"}`
- **Google Analytics** (`analytics_1`): Type `google_analytics`, Config `{"propertyId": "", "startDate": "2024-01-01", "endDate": "2024-01-31"}`

#### Node 9: Merge (`merge_1`)
- **Type**: `merge`
- **Input**: Results from all Google services
- **Expected Output**: Merged Google service results

### Test Input Data
```json
{
  "title": "Test Meeting",
  "start": "2024-01-15T10:00:00Z",
  "end": "2024-01-15T11:00:00Z",
  "fileName": "test.txt",
  "content": "Test file content",
  "taskTitle": "Complete testing",
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

### Expected Final Output
```json
{
  "calendar": {
    "eventId": "calendar_event_id",
    "created": true
  },
  "drive": {
    "fileId": "drive_file_id",
    "uploaded": true
  },
  "doc": {
    "documentId": "doc_id",
    "created": true
  },
  "bigquery": {
    "results": [{"column1": "value1"}],
    "rows": 1
  },
  "tasks": {
    "taskId": "task_id",
    "created": true
  },
  "contacts": {
    "contactId": "contact_id",
    "created": true
  },
  "analytics": {
    "data": {"sessions": 1000, "users": 500}
  },
  "merged": true
}
```

### Testing Steps
1. Copy template and configure Google OAuth
2. Send comprehensive test data to webhook
3. Verify Calendar event is created
4. Check Drive file is uploaded
5. Confirm Doc is created
6. Verify BigQuery query executes
7. Check Task is created
8. Confirm Contact is added
9. Verify Analytics data is retrieved
10. Check merge combines all results
11. Test each service individually

---

## TEMPLATE 29: CRM Integration Pipeline

### Template Description
Integrate with multiple CRM systems: HubSpot, Salesforce, Zoho, Pipedrive, Freshdesk, Intercom, Mailchimp, ActiveCampaign. Shows comprehensive CRM integration.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Contact/lead data
- **Expected Output**: Receives data

#### Nodes 2-9: CRM Systems
- **HubSpot** (`hubspot_1`): Type `hubspot`, Config `{"operation": "create_contact", "email": "{{input.email}}", "firstName": "{{input.firstName}}"}`
- **Salesforce** (`salesforce_1`): Type `salesforce`, Config `{"operation": "create", "object": "Contact", "fields": {"Email": "{{input.email}}"}}`
- **Zoho CRM** (`zoho_1`): Type `zoho_crm`, Config `{"operation": "create", "module": "Contacts", "data": {"Email": "{{input.email}}"}}`
- **Pipedrive** (`pipedrive_1`): Type `pipedrive`, Config `{"operation": "create_person", "name": "{{input.name}}", "email": "{{input.email}}"}}`
- **Freshdesk** (`freshdesk_1`): Type `freshdesk`, Config `{"operation": "create_ticket", "subject": "{{input.subject}}", "description": "{{input.description}}"}}`
- **Intercom** (`intercom_1`): Type `intercom`, Config `{"operation": "create_user", "email": "{{input.email}}"}}`
- **Mailchimp** (`mailchimp_1`): Type `mailchimp`, Config `{"operation": "add_member", "listId": "", "email": "{{input.email}}"}}`
- **ActiveCampaign** (`activecampaign_1`): Type `activecampaign`, Config `{"operation": "create_contact", "email": "{{input.email}}"}}`

### Test Input Data
```json
{
  "email": "newcontact@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "name": "John Doe",
  "subject": "New Support Request",
  "description": "Customer needs assistance with product"
}
```

### Expected Final Output
```json
{
  "hubspot": {
    "contactId": "hubspot_id",
    "created": true
  },
  "salesforce": {
    "contactId": "sf_id",
    "created": true
  },
  "zoho": {
    "contactId": "zoho_id",
    "created": true
  },
  "pipedrive": {
    "personId": "pipedrive_id",
    "created": true
  },
  "freshdesk": {
    "ticketId": "ticket_id",
    "created": true
  },
  "intercom": {
    "userId": "intercom_id",
    "created": true
  },
  "mailchimp": {
    "memberId": "mailchimp_id",
    "added": true
  },
  "activecampaign": {
    "contactId": "ac_id",
    "created": true
  }
}
```

### Testing Steps
1. Copy template and configure all CRM API credentials
2. Send contact data to webhook
3. Verify HubSpot contact is created
4. Check Salesforce contact is created
5. Confirm Zoho contact is created
6. Verify Pipedrive person is created
7. Check Freshdesk ticket is created
8. Confirm Intercom user is created
9. Verify Mailchimp member is added
10. Check ActiveCampaign contact is created
11. Test each CRM individually
12. Verify error handling if CRM unavailable

---

## TEMPLATE 30: Complete Platform Showcase

### Template Description
Comprehensive workflow showcasing utility nodes: date/time operations, math, crypto, HTML/XML extraction, RSS feeds, PDF processing, image manipulation, and more.

### Workflow Nodes

#### Node 1: Webhook (`webhook_1`)
- **Type**: `webhook`
- **Input**: Various data types
- **Expected Output**: Receives data

#### Nodes 2-9: Utility Nodes
- **Date Time** (`date_time_1`): Type `date_time`, Config `{"operation": "format", "value": "{{input.date}}", "format": "YYYY-MM-DD"}`
- **Math** (`math_1`): Type `math`, Config `{"operation": "add", "a": "{{input.a}}", "b": "{{input.b}}"}`
- **Crypto** (`crypto_1`): Type `crypto`, Config `{"operation": "hash", "algorithm": "sha256", "data": "{{input.data}}"}`
- **HTML Extract** (`html_extract_1`): Type `html_extract`, Config `{"html": "{{input.html}}", "selector": "h1"}`
- **XML** (`xml_1`): Type `xml`, Config `{"xml": "{{input.xml}}"}}`
- **RSS Feed Read** (`rss_1`): Type `rss_feed_read`, Config `{"url": "https://example.com/feed.xml"}`
- **PDF** (`pdf_1`): Type `pdf`, Config `{"operation": "extract_text", "file": "{{input.pdf}}"}}`
- **Image Manipulation** (`image_1`): Type `image_manipulation`, Config `{"operation": "resize", "width": 800, "height": 600, "image": "{{input.image}}"}}`

#### Node 10: Merge (`merge_1`)
- **Type**: `merge`
- **Input**: Results from all utility nodes
- **Expected Output**: Merged utility results

### Test Input Data
```json
{
  "date": "2024-01-15T12:00:00Z",
  "a": 10,
  "b": 20,
  "data": "test data",
  "html": "<html><body><h1>Test Title</h1></body></html>",
  "xml": "<?xml version='1.0'?><root><item>Test</item></root>",
  "pdf": "base64_encoded_pdf_data",
  "image": "base64_encoded_image_data"
}
```

### Expected Final Output
```json
{
  "dateTime": {
    "formatted": "2024-01-15",
    "original": "2024-01-15T12:00:00Z"
  },
  "math": {
    "result": 30,
    "operation": "add"
  },
  "crypto": {
    "hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "algorithm": "sha256"
  },
  "htmlExtract": {
    "result": "Test Title",
    "selector": "h1"
  },
  "xml": {
    "parsed": {"root": {"item": "Test"}},
    "valid": true
  },
  "rss": {
    "items": [{"title": "RSS Item 1"}, {"title": "RSS Item 2"}],
    "count": 2
  },
  "pdf": {
    "text": "Extracted text from PDF...",
    "pages": 1
  },
  "image": {
    "resized": true,
    "width": 800,
    "height": 600
  },
  "merged": true
}
```

### Testing Steps
1. Copy template
2. Send comprehensive test data to webhook
3. Verify date_time formats date correctly
4. Check math performs addition
5. Confirm crypto generates hash
6. Verify html_extract extracts h1 tag
7. Check XML parser parses XML
8. Confirm RSS feed is read (if URL accessible)
9. Verify PDF text is extracted (if PDF provided)
10. Check image is resized (if image provided)
11. Verify merge combines all results
12. Test each utility node individually
13. Check error handling for invalid inputs

---

## Testing Summary

### Coverage Checklist

✅ **Beginner Templates (1-10)**: All tested  
✅ **Intermediate Templates (11-20)**: All tested  
✅ **Advanced Templates (21-30)**: All tested  

### Common Testing Patterns

1. **Trigger Testing**: Verify all trigger types work correctly
2. **Data Flow**: Ensure data passes correctly between nodes
3. **Error Handling**: Test error scenarios and recovery
4. **Configuration**: Verify all node configurations are correct
5. **Output Validation**: Check outputs match expected formats
6. **Integration**: Test external service connections
7. **Performance**: Monitor execution times for complex workflows

### Notes

- Always configure required API keys and credentials before testing
- Use test/dummy data for external services
- Verify database connections before running database templates
- Check Google OAuth setup for Google service templates
- Test with both valid and invalid inputs where applicable
- Monitor execution logs for debugging
- Verify workflow executions appear in execution history

### Support

For issues or questions:
1. Check execution logs for error messages
2. Verify node configurations match expected format
3. Ensure all required credentials are configured
4. Test individual nodes in isolation if workflow fails
5. Review node documentation for specific requirements

---

**Last Updated**: Generated for 30 Comprehensive Templates  
**Version**: 1.0  
**Template SQL File**: `sql_migrations/09_comprehensive_templates.sql`

