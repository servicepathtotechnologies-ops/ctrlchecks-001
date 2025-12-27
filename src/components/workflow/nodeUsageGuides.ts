import { NodeUsageGuide } from './nodeTypes';

export const NODE_USAGE_GUIDES: Record<string, NodeUsageGuide> = {
  // Trigger Nodes
  manual_trigger: {
    overview: 'Starts your workflow when you click the "Run" button. Perfect for testing or on-demand tasks. No input required - fires once per manual execution.',
    inputs: ['None - This is a start node'],
    outputs: ['trigger', 'workflow_id', 'executed_at'],
    example: `Connect → OpenAI GPT → Slack Message

When you click Run, the workflow executes.
Output: { 
  trigger: "manual",
  workflow_id: "uuid",
  executed_at: "2024-01-15T10:30:00Z"
}`,
    tips: ['Use for testing before adding automated triggers', 'Can pass custom input data when running', 'workflow_id is auto-generated', 'executed_at is ISO-8601 timestamp'],
  },

  schedule: {
    overview: 'Runs your workflow automatically on a schedule using a simple time picker. Select your time (HH:MM format) and timezone, and the workflow will execute daily at that time. Great for daily reports, periodic checks, or recurring tasks.',
    inputs: ['None - Triggered by schedule'],
    outputs: ['trigger', 'time', 'cron', 'timezone', 'executed_at'],
    example: `Time: "09:00"
Timezone: "Asia/Kolkata" (IST)
Meaning: Daily at 9:00 AM Indian Standard Time

Time: "14:30"
Timezone: "America/New_York"
Meaning: Daily at 2:30 PM Eastern Time

Output: {
  trigger: "schedule",
  time: "09:00",
  cron: "0 9 * * *",
  timezone: "Asia/Kolkata",
  executed_at: "2024-01-15T03:30:00Z"
}`,
    tips: ['Use 24-hour format (e.g., 09:00 for 9 AM, 14:30 for 2:30 PM)', 'Select your timezone from the dropdown (IST, UTC, etc.)', 'Workflow runs daily at the specified time', 'Test with manual trigger first', 'Timezone conversion is handled automatically'],
  },

  webhook: {
    overview: 'Receives HTTP requests from external services. Use this to trigger workflows from other apps, APIs, or services. Parses headers, query parameters, and JSON body safely.',
    inputs: ['HTTP request body', 'Headers', 'Query params'],
    outputs: ['trigger', 'method', 'headers', 'query', 'body'],
    example: `Webhook URL: https://your-app.com/api/webhook/abc123

External Service sends POST:
{
  "event": "order_created",
  "data": { "id": 123, "total": 99.99 }
}

Output: { 
  trigger: "webhook",
  method: "POST",
  headers: {"Content-Type": "application/json"},
  query: {},
  body: {"event": "order_created", "data": {...}}
}`,
    tips: ['Copy the webhook URL after saving', 'Supports GET, POST, PUT methods', 'Headers and query params are available in output', 'JSON body is parsed safely'],
  },

  chat_trigger: {
    overview: 'Triggers workflow from chat / AI / UI messages. Perfect for chatbot integrations and AI assistants. Requires message and session_id.',
    inputs: ['message (required)', 'session_id (required)', 'user_context (optional)'],
    outputs: ['trigger', 'message', 'session_id', 'user_context'],
    example: `Chat Input:
{
  "message": "Hello, how can I help?",
  "session_id": "session_123",
  "user_context": {"name": "John", "role": "user"}
}

Output: {
  trigger: "chat",
  message: "Hello, how can I help?",
  session_id: "session_123",
  user_context: {"name": "John", "role": "user"}
}`,
    tips: ['message cannot be empty', 'session_id is required', 'user_context is optional and normalized to object', 'Perfect for chatbot integrations'],
  },

  error_trigger: {
    overview: 'Automatically fires when any node fails in the workflow. Global scope - cannot be manually executed. Fires on unhandled exceptions.',
    inputs: ['Error information from failed node'],
    outputs: ['trigger', 'failed_node', 'error_message', 'stack_trace'],
    example: `When a node fails:

Output: {
  trigger: "error",
  failed_node: "http_request",
  error_message: "HTTP Request failed: Connection timeout",
  stack_trace: "Error: Connection timeout\n    at executeNode..."
}`,
    tips: ['Cannot be manually executed', 'Fires automatically on node failures', 'Global scope - catches all errors', 'Use for error logging and recovery workflows'],
  },

  interval: {
    overview: 'Runs workflow repeatedly at fixed intervals. Non-blocking and prevents duplicate executions. Supports seconds (s), minutes (m), and hours (h) units.',
    inputs: ['None - Triggered by interval'],
    outputs: ['trigger', 'interval', 'executed_at'],
    example: `Interval: "10m" (every 10 minutes)
Interval: "30s" (every 30 seconds)
Interval: "1h" (every 1 hour)

Output: {
  trigger: "interval",
  interval: "10m",
  executed_at: "2024-01-15T10:30:00Z"
}`,
    tips: ['Use format: number + unit (s/m/h)', 'Examples: 30s, 5m, 1h', 'Non-blocking execution', 'Duplicate executions are prevented', 'Deactivate when not needed'],
  },

  workflow_trigger: {
    overview: 'Triggers one workflow from another workflow. Accepts source workflow_id and passes execution payload. Prevents circular triggers.',
    inputs: ['payload from source workflow'],
    outputs: ['trigger', 'source_workflow_id', 'payload'],
    example: `Source Workflow A triggers Target Workflow B:

Workflow B receives:
{
  trigger: "workflow",
  source_workflow_id: "workflow-a-uuid",
  payload: {
    "order_id": 123,
    "status": "completed"
  }
}`,
    tips: ['source_workflow_id is required', 'Payload is passed from source workflow', 'Prevents circular triggers', 'Great for workflow orchestration'],
  },

  // AI Processing
  openai_gpt: {
    overview: 'Processes text using OpenAI GPT models. Provide a system prompt and the input will be sent as the user message.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "You are a helpful assistant that summarizes emails."

Input: { text: "Meeting tomorrow at 3pm..." }
Output: { response: "Summary: Meeting scheduled for tomorrow afternoon", usage: { tokens: 45 } }

Connect: Webhook → OpenAI GPT → Slack`,
    tips: ['Leave API Key empty to use Lovable AI (free)', 'Lower temperature = more focused responses', 'Use {{input.text}} in prompts for dynamic content'],
  },

  anthropic_claude: {
    overview: 'Processes text using Anthropic Claude models. Known for nuanced understanding and detailed responses.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "Analyze customer feedback and categorize sentiment."

Input: { text: "Great product but shipping was slow" }
Output: { 
  response: "Mixed sentiment. Positive: product quality. Negative: shipping speed.",
  sentiment: "mixed"
}`,
    tips: ['Claude excels at analysis and nuanced tasks', 'Great for longer documents', 'Sonnet offers best balance of speed/quality'],
  },

  google_gemini: {
    overview: 'Processes text using Google Gemini models. Fast and efficient with strong reasoning capabilities.',
    inputs: ['text', 'any JSON data'],
    outputs: ['response', 'usage', 'model'],
    example: `System Prompt: "Extract key dates and action items from text."

Input: { text: "Call John on Friday about Q2 review" }
Output: { 
  response: "Date: Friday\nAction: Call John\nTopic: Q2 review"
}`,
    tips: ['Gemini Flash is fastest for simple tasks', 'Flash Lite for high volume, low cost', 'Pro for complex reasoning'],
  },

  text_summarizer: {
    overview: 'Automatically summarizes long text content. Choose between concise summaries, detailed overviews, or bullet points.',
    inputs: ['text', 'content'],
    outputs: ['summary', 'word_count'],
    example: `Input: { text: "Long article about AI trends..." }
Style: "bullets"
Max Length: 100

Output: {
  summary: "• AI adoption growing 40% YoY\n• Focus on automation\n• Privacy concerns rising",
  word_count: 15
}`,
    tips: ['Use bullets for quick scanning', 'Detailed for comprehensive summaries', 'Adjust max length for your needs'],
  },

  sentiment_analyzer: {
    overview: 'Analyzes the emotional tone of text. Returns sentiment score and classification (positive, negative, neutral).',
    inputs: ['text'],
    outputs: ['sentiment', 'score', 'confidence'],
    example: `Input: { text: "I love this product!" }
Output: {
  sentiment: "positive",
  score: 0.95,
  confidence: 0.92
}

Connect: Webhook → Sentiment → If/Else (route by sentiment)`,
    tips: ['Score ranges from -1 (negative) to 1 (positive)', 'Use with If/Else to route messages', 'Great for customer feedback analysis'],
  },

  // Logic & Control
  if_else: {
    overview: 'Routes workflow based on conditions. Creates two branches: one for when condition is true, another for false.',
    inputs: ['any data to evaluate'],
    outputs: ['true_branch', 'false_branch'],
    example: `Condition: {{input.score}} > 0.5

If score is 0.8 → Takes TRUE branch
If score is 0.3 → Takes FALSE branch

Connect TRUE → Send Happy Email
Connect FALSE → Send Followup Email`,
    tips: ['Use {{input.field}} to reference data', 'Supports ==, !=, >, <, >=, <=', 'Combine conditions with && or ||'],
  },

  switch: {
    overview: 'Routes to different branches based on matching values. Like multiple if/else statements combined.',
    inputs: ['value to match'],
    outputs: ['matched_case', 'default'],
    example: `Expression: {{input.status}}
Cases: [
  {"value": "pending", "label": "Pending"},
  {"value": "approved", "label": "Approved"},
  {"value": "rejected", "label": "Rejected"}
]

Connects to different nodes based on status value.`,
    tips: ['Add a default case for unmatched values', 'Great for status-based routing', 'Each case can connect to different nodes'],
  },

  loop: {
    overview: 'Iterates over an array of items, executing connected nodes for each item. Useful for batch processing.',
    inputs: ['array of items'],
    outputs: ['current_item', 'index', 'results'],
    example: `Input: { items: ["email1", "email2", "email3"] }
Array Expression: {{input.items}}

Loop executes 3 times:
• Iteration 1: current_item = "email1"
• Iteration 2: current_item = "email2"
• Iteration 3: current_item = "email3"`,
    tips: ['Set max iterations to prevent infinite loops', 'Access current item with {{loop.item}}', 'Results collected after all iterations'],
  },

  wait: {
    overview: 'Pauses workflow execution for a specified duration. Use for rate limiting or delays between actions.',
    inputs: ['any (passes through)'],
    outputs: ['input (unchanged)'],
    example: `Duration: 5000 (5 seconds)

API Call → Wait (5s) → API Call
Prevents hitting rate limits.

Common durations:
• 1000ms = 1 second
• 60000ms = 1 minute`,
    tips: ['Use between API calls to avoid rate limits', 'Data passes through unchanged', 'Duration is in milliseconds'],
  },

  error_handler: {
    overview: 'Catches errors from connected nodes and provides retry logic or fallback values. Prevents workflow failures.',
    inputs: ['any (wraps connected node)'],
    outputs: ['result', 'error', 'attempts'],
    example: `Max Retries: 3
Retry Delay: 2000 (2 seconds)
Fallback: {"status": "failed"}

If connected node fails:
1. Retry up to 3 times
2. Wait 2s between retries
3. If still failing, return fallback`,
    tips: ['Wrap unreliable API calls', 'Set appropriate retry delays', 'Log errors for debugging'],
  },

  filter: {
    overview: 'Filters an array to keep only items matching a condition. Removes items that do not meet criteria.',
    inputs: ['array of items'],
    outputs: ['filtered_array', 'removed_count'],
    example: `Array: {{input.users}}
Condition: item.age >= 18

Input: [
  {name: "John", age: 25},
  {name: "Jane", age: 16},
  {name: "Bob", age: 30}
]
Output: [John, Bob] (filtered out Jane)`,
    tips: ['Use "item" to reference current element', 'Returns new array, original unchanged', 'Chain multiple filters for complex logic'],
  },

  // Data Transformation
  javascript: {
    overview: 'Execute custom JavaScript code. Full access to input data with ability to transform, calculate, or process as needed.',
    inputs: ['any data as "input"'],
    outputs: ['return value'],
    example: `Code:
const total = input.items.reduce(
  (sum, item) => sum + item.price, 0
);
return {
  total,
  count: input.items.length,
  average: total / input.items.length
};

Input: {items: [{price: 10}, {price: 20}]}
Output: {total: 30, count: 2, average: 15}`,
    tips: ['Always return a value', 'Input available as "input" variable', 'Use for complex transformations'],
  },

  json_parser: {
    overview: 'Extract specific values from JSON using JSONPath expressions. Navigate nested data structures easily.',
    inputs: ['JSON data'],
    outputs: ['extracted_value'],
    example: `Input: {
  "data": {
    "users": [
      {"name": "John", "email": "john@test.com"},
      {"name": "Jane", "email": "jane@test.com"}
    ]
  }
}

Expression: $.data.users[*].email
Output: ["john@test.com", "jane@test.com"]`,
    tips: ['$ represents root', '[*] selects all items', 'Use .field for nested access'],
  },

  text_formatter: {
    overview: 'Format text using templates with variable substitution. Create dynamic messages, emails, or any text content.',
    inputs: ['data for template variables'],
    outputs: ['formatted_text'],
    example: `Template: "Hello {{name}}! Your order #{{orderId}} ships on {{shipDate}}."

Input: {name: "John", orderId: 123, shipDate: "Jan 20"}
Output: "Hello John! Your order #123 ships on Jan 20."`,
    tips: ['Use {{variable}} for substitution', 'Supports nested: {{user.name}}', 'Great for email/message templates'],
  },

  http_request: {
    overview: 'Make HTTP requests to external APIs. Fetch data, call webhooks, or interact with any REST API.',
    inputs: ['URL params', 'body data'],
    outputs: ['response', 'status', 'headers'],
    example: `URL: https://api.example.com/users/{{input.userId}}
Method: GET
Headers: {"Authorization": "Bearer {{input.token}}"}

Output: {
  response: {id: 1, name: "John"},
  status: 200
}`,
    tips: ['Use {{input.x}} in URL for dynamic values', 'Add auth headers for protected APIs', 'Set timeout for slow APIs'],
  },

  set_variable: {
    overview: 'Store a value for use later in the workflow. Variables persist throughout the workflow execution.',
    inputs: ['any value'],
    outputs: ['variable_name', 'value'],
    example: `Variable Name: totalCount
Value: {{input.items.length}}

Later nodes can access: {{variables.totalCount}}

Useful for storing computed values to use in multiple places.`,
    tips: ['Access with {{variables.name}}', 'Great for values used multiple times', 'Persists through entire workflow'],
  },

  google_sheets: {
    overview: 'Read or write data from Google Sheets. Connect your spreadsheets to workflows for data analysis, validation, and automation.',
    inputs: ['spreadsheet_id', 'range', 'data (for write operations)'],
    outputs: ['data', 'rows', 'columns', 'formatted_data'],
    example: `Operation: Read
Spreadsheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
Sheet: Sheet1
Range: A1:D100
Output Format: JSON

Output: {
  data: [
    {Name: "John", Email: "john@example.com", Status: "Active"},
    {Name: "Jane", Email: "jane@example.com", Status: "Pending"}
  ],
  rows: 2,
  columns: 4
}

AI Agent can then analyze, filter, or process this data.`,
    tips: [
      'Get Spreadsheet ID from URL: /d/SPREADSHEET_ID/edit',
      'Leave range empty to read all used cells',
      'Use key-value format for easier AI processing',
      'Admin can enable write access for updates',
      'Authenticate with Google account first',
    ],
  },

  merge_data: {
    overview: 'Combine data from multiple sources. Merge objects together or concatenate arrays.',
    inputs: ['multiple data inputs'],
    outputs: ['merged_data'],
    example: `Mode: "merge"
Inputs from two nodes:
  1: {name: "John", age: 30}
  2: {email: "john@test.com"}

Output: {name: "John", age: 30, email: "john@test.com"}

Mode: "concat" for arrays:
  [1,2] + [3,4] = [1,2,3,4]`,
    tips: ['Merge combines object properties', 'Concat joins arrays', 'Connect multiple nodes as inputs'],
  },

  database_read: {
    overview: 'Read data from your database tables. Query with filters, ordering, and limits.',
    inputs: ['filter criteria'],
    outputs: ['rows', 'count'],
    example: `Table: orders
Columns: id, customer_name, total
Filters: {"status": "pending"}
Limit: 10
Order By: created_at

Output: [
  {id: 1, customer_name: "John", total: 99},
  {id: 2, customer_name: "Jane", total: 150}
]`,
    tips: ['Use * for all columns', 'Filters use exact match', 'Combine with Loop for batch processing'],
  },

  // Output Actions
  http_post: {
    overview: 'Send data to external APIs via HTTP POST. Perfect for webhooks, API integrations, and data sync.',
    inputs: ['data to send'],
    outputs: ['response', 'status'],
    example: `URL: https://api.example.com/webhook
Headers: {"Content-Type": "application/json"}
Body: {"event": "workflow_complete", "data": "{{input}}"}

Sends POST request with workflow data.`,
    tips: ['Use body template for dynamic content', 'Add auth headers if needed', 'Check response for errors'],
  },

  email_resend: {
    overview: 'Send emails using Resend. Supports HTML content, templates, and dynamic content from workflow data.',
    inputs: ['email content', 'recipient data'],
    outputs: ['message_id', 'status'],
    example: `To: {{input.customer.email}}
From: notifications@yourapp.com
Subject: Order Confirmed #{{input.orderId}}
Body: "<h1>Thank you!</h1><p>Order {{input.orderId}} confirmed.</p>"

Sends personalized order confirmation.`,
    tips: ['Requires RESEND_API_KEY secret', 'Use HTML for rich emails', 'Use {{input.x}} for personalization'],
  },

  slack_message: {
    overview: 'Send messages to Slack channels. Supports rich formatting, blocks, and custom bot appearance.',
    inputs: ['message content'],
    outputs: ['message_id', 'channel'],
    example: `Webhook URL: https://hooks.slack.com/services/...
Channel: #alerts
Message: "New order: {{input.orderId}} - Total: {{input.total}}"
Icon: :robot_face:

Sends formatted alert to Slack channel.`,
    tips: ['Create webhook at api.slack.com', 'Use emoji for visual appeal', 'Blocks for rich formatting'],
  },

  discord_webhook: {
    overview: 'Send messages to Discord channels via webhook. Great for notifications and alerts.',
    inputs: ['message content'],
    outputs: ['message_id'],
    example: `Webhook URL: https://discord.com/api/webhooks/...
Message: "✅ Workflow completed successfully!"
Username: "Alert Bot"

Sends message to Discord channel.`,
    tips: ['Create webhook in Discord channel settings', 'Customize username and avatar', 'Supports markdown formatting'],
  },

  database_write: {
    overview: 'Write data to your database tables. Supports insert, update, upsert, and delete operations.',
    inputs: ['data to write'],
    outputs: ['affected_rows', 'inserted_id'],
    example: `Table: orders
Operation: insert
Data: {
  "customer_id": "{{input.userId}}",
  "total": "{{input.cart.total}}",
  "status": "pending"
}

Creates new order record from workflow data.`,
    tips: ['Use upsert to update or insert', 'Match column required for updates', 'Data uses {{input.x}} for dynamic values'],
  },

  log_output: {
    overview: 'Log data for debugging and monitoring. View logs in the execution history.',
    inputs: ['any data'],
    outputs: ['logged (passes input through)'],
    example: `Message: "Processing order: {{input.orderId}}"
Level: info

Appears in execution logs:
[INFO] Processing order: 12345

Useful for debugging workflow flow.`,
    tips: ['Use different levels for filtering', 'Data passes through to next node', 'Check execution history for logs'],
  },

  llm_chain: {
    overview: 'Chain multiple AI prompts together where each step builds on the previous. Great for complex reasoning tasks.',
    inputs: ['initial text/data'],
    outputs: ['final_response', 'step_outputs'],
    example: `Steps: [
  {"prompt": "Summarize: {{input}}"},
  {"prompt": "Extract key points from: {{previous}}"},
  {"prompt": "Format as bullet list: {{previous}}"}
]

Each step uses output from previous step.`,
    tips: ['Use {{previous}} to reference last output', 'Build complex reasoning chains', 'Each step can use different prompts'],
  },

  csv_processor: {
    overview: 'Parse and process CSV data. Converts CSV text to JSON array for further processing.',
    inputs: ['CSV text'],
    outputs: ['rows', 'headers', 'count'],
    example: `Input CSV:
"name,email,age
John,john@test.com,30
Jane,jane@test.com,25"

Output: [
  {name: "John", email: "john@test.com", age: "30"},
  {name: "Jane", email: "jane@test.com", age: "25"}
]`,
    tips: ['Set correct delimiter (comma, tab, etc)', 'Enable "has header" for column names', 'Output is JSON array'],
  },

  slack_webhook: {
    overview: 'Simple Slack webhook for quick messages. Less features than Slack Message but easier to set up.',
    inputs: ['message text'],
    outputs: ['status'],
    example: `Webhook URL: https://hooks.slack.com/services/...
Text: "Workflow completed at {{input.timestamp}}"

Sends simple text message to Slack.`,
    tips: ['Simplest Slack integration', 'No blocks or rich formatting', 'Good for basic alerts'],
  },

  google_doc: {
    overview: 'Read, create, or update Google Docs documents. Extract text content from existing documents, create new documents, or add content to existing ones. The read operation extracts ALL text including paragraphs, tables, and lists.',
    inputs: ['documentId or full URL (required for read/update)', 'title (required for create)', 'content (required for create/update)'],
    outputs: ['documentId', 'title', 'content (full extracted text)', 'body (same as content)', 'text (same as content)', 'contentLength', 'hasContent', 'documentUrl'],
    example: `Operation: Read
Document ID or URL: https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit
(You can paste the full URL or just the ID: 1a2b3c4d5e6f7g8h9i0j)

Output: {
  documentId: "1a2b3c4d5e6f7g8h9i0j",
  title: "My Document",
  content: "Full text content extracted from the document including all paragraphs, tables, and formatted text...",
  body: "Full text content...", // Same as content
  text: "Full text content...", // Same as content
  contentLength: 1234,
  hasContent: true,
  documentUrl: "https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit"
}

Access the content in next nodes using: {{input.content}}, {{input.body}}, or {{input.text}}

Operation: Create
Title: "New Report"
Content: "This is the document content..."

Output: {
  documentId: "new_doc_id",
  title: "New Report",
  documentUrl: "https://docs.google.com/document/d/new_doc_id/edit"
}

Operation: Update
Document ID: 1a2b3c4d5e6f7g8h9i0j
Content: "New content to append"

Output: {
  documentId: "1a2b3c4d5e6f7g8h9i0j",
  updated: true
}`,
    tips: [
      'Get Document ID from Google Docs URL: https://docs.google.com/document/d/DOCUMENT_ID/edit - you can paste the full URL or just the DOCUMENT_ID part',
      'Read operation extracts ALL text content including paragraphs, tables, lists, and formatted text',
      'The content/body/text fields in read output contain the full document text as a string - use {{input.content}} to access it',
      'Create operation creates an empty document first, then inserts content if provided',
      'Update operation appends new content to the beginning of the document',
      'Always authenticate with Google account first via Settings > Integrations > Google',
      'For read operation, ensure the document is shared with your Google account or is publicly accessible',
    ],
  },

  google_drive: {
    overview: 'List, upload, download, or delete files in Google Drive. Manage your Drive files programmatically.',
    inputs: ['folderId (for list)', 'fileId (for download/delete)', 'fileName and fileContent (for upload)'],
    outputs: ['files array (list)', 'fileId and webViewLink (upload)', 'content (download)', 'deleted status (delete)'],
    example: `Operation: List Files
Folder ID: (leave empty for root)

Output: [
  {id: "file1", name: "document.pdf", mimeType: "application/pdf"},
  {id: "file2", name: "image.jpg", mimeType: "image/jpeg"}
]

Operation: Upload File
File Name: "report.pdf"
File Content: [Base64 encoded content]

Output: {
  fileId: "uploaded_file_id",
  name: "report.pdf",
  webViewLink: "https://drive.google.com/file/d/.../view"
}`,
    tips: [
      'Leave Folder ID empty to list root folder',
      'File IDs are in URL: /file/d/FILE_ID/view',
      'Upload requires Base64 encoded file content',
      'Download returns Base64 encoded content',
    ],
  },

  google_calendar: {
    overview: 'Create, list, update, or delete Google Calendar events. Manage your calendar programmatically.',
    inputs: ['calendarId', 'eventId (for update/delete)', 'summary', 'startTime', 'endTime', 'description'],
    outputs: ['events array (list)', 'eventId and htmlLink (create)', 'updated event (update)', 'deleted status (delete)'],
    example: `Operation: Create Event
Calendar ID: primary
Event Title: "Team Meeting"
Start Time: 2024-01-15T14:00:00Z
End Time: 2024-01-15T15:00:00Z
Description: "Weekly sync"

Output: {
  eventId: "event_id",
  summary: "Team Meeting",
  htmlLink: "https://calendar.google.com/event?eid=..."
}`,
    tips: [
      'Use "primary" for main calendar',
      'Times must be ISO 8601 format (UTC)',
      'Event IDs returned when creating events',
      'List shows upcoming events only',
    ],
  },

  google_gmail: {
    overview: 'Send, list, get, or search Gmail messages. Automate email operations in your workflows.',
    inputs: ['to, subject, body (for send)', 'messageId (for get)', 'query (for search)'],
    outputs: ['messageId and threadId (send)', 'messages array (list/search)', 'full message (get)'],
    example: `Operation: Send Email
To: recipient@example.com
Subject: "Workflow Notification"
Body: "Your workflow completed successfully!"

Output: {
  messageId: "sent_message_id",
  threadId: "thread_id"
}

Operation: Search Messages
Search Query: from:example@gmail.com
Max Results: 10

Output: [
  {id: "message_id_1"},
  {id: "message_id_2"}
]`,
    tips: [
      'Gmail search syntax: from:, subject:, is:unread, has:attachment',
      'Message IDs returned when listing/searching',
      'Body is plain text only',
      'Use search to filter messages before getting details',
    ],
  },

  google_bigquery: {
    overview: 'Execute SQL queries on BigQuery datasets. Run analytics queries and get results.',
    inputs: ['projectId', 'datasetId', 'query', 'useLegacySql'],
    outputs: ['rows', 'totalRows', 'jobComplete'],
    example: `Project ID: my-project-id
Dataset ID: my_dataset
SQL Query: SELECT * FROM \`my-project-id.my_dataset.my_table\` LIMIT 10

Output: {
  rows: [
    {column1: "value1", column2: "value2"},
    {column1: "value3", column2: "value4"}
  ],
  totalRows: "2",
  jobComplete: true
}`,
    tips: [
      'Use backticks for table names: \`project.dataset.table\`',
      'Standard SQL recommended (set Use Legacy SQL to false)',
      'Results automatically formatted as JSON objects',
      'Large queries may take time',
    ],
  },

  google_tasks: {
    overview: 'Create, list, update, or complete Google Tasks. Manage your task list programmatically.',
    inputs: ['taskListId', 'taskId (for update/complete)', 'title', 'notes', 'dueDate'],
    outputs: ['tasks array (list)', 'created task (create)', 'updated task (update)', 'completed task (complete)'],
    example: `Operation: Create Task
Task List ID: @default
Task Title: "Review proposal"
Notes: "Check budget and timeline"
Due Date: 2024-01-20T17:00:00Z

Output: {
  id: "task_id",
  title: "Review proposal",
  status: "needsAction"
}`,
    tips: [
      'Use "@default" for default task list',
      'Task IDs returned when creating tasks',
      'Due dates must be ISO 8601 format',
      'Completed tasks hidden from list by default',
    ],
  },

  google_contacts: {
    overview: 'List, create, update, or delete Google Contacts. Manage your contact list programmatically.',
    inputs: ['contactId (for update/delete)', 'name', 'email', 'phone', 'maxResults'],
    outputs: ['contacts array (list)', 'created contact (create)', 'updated contact (update)', 'deleted status (delete)'],
    example: `Operation: Create Contact
Name: "John Doe"
Email: john@example.com
Phone: +1234567890

Output: {
  resourceName: "people/c1234567890",
  name: "John Doe",
  email: "john@example.com"
}`,
    tips: [
      'Contact ID is resourceName field (e.g., people/c1234567890)',
      'Email required for creating contacts',
      'Phone should include country code (e.g., +1234567890)',
      'Max results limit applies to list operation',
    ],
  },

  // ============================================
  // AUTHENTICATION & IDENTITY NODES
  // ============================================
  oauth2: {
    overview: 'OAuth2 authentication and token management. Get access tokens, refresh tokens, validate tokens, and revoke access.',
    inputs: ['clientId', 'clientSecret', 'tokenUrl', 'code (for authorization_code)', 'refreshToken (for refresh)'],
    outputs: ['access_token', 'refresh_token', 'expires_in', 'token_type'],
    example: `Operation: Get Access Token
Grant Type: Authorization Code
Client ID: your-client-id
Client Secret: your-client-secret
Token URL: https://api.example.com/oauth/token
Code: authorization-code-from-callback

Output: {
  access_token: "eyJhbGci...",
  refresh_token: "def502...",
  expires_in: 3600,
  token_type: "Bearer"
}`,
    tips: [
      'Use authorization_code for user authorization flows',
      'Use client_credentials for server-to-server',
      'Store refresh tokens securely for token renewal',
      'Token URL is usually: https://provider.com/oauth/token',
    ],
  },

  jwt: {
    overview: 'Generate, verify, and decode JSON Web Tokens. Sign tokens with HMAC or RSA algorithms, verify signatures, and decode token payloads.',
    inputs: ['secret/key', 'payload (for sign)', 'token (for verify/decode)', 'algorithm'],
    outputs: ['token (sign)', 'valid, header, payload (verify)', 'header, payload (decode)'],
    example: `Operation: Sign Token
Algorithm: HS256
Secret: your-secret-key
Payload: {"sub": "user123", "exp": 1735689600}

Output: {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0...",
  header: {alg: "HS256", typ: "JWT"},
  payload: {sub: "user123", exp: 1735689600}
}`,
    tips: [
      'HS256/HS384/HS512 use symmetric keys (secret)',
      'RS256/RS384/RS512 use asymmetric keys (private/public)',
      'Include "exp" claim for expiration',
      'Token format: header.payload.signature',
    ],
  },

  okta: {
    overview: 'Okta SSO and identity management. Manage users, authenticate, and perform directory operations.',
    inputs: ['domain', 'apiToken', 'userId (for get/update/delete)', 'userData (for create/update)'],
    outputs: ['user object', 'users array (list)', 'success status'],
    example: `Operation: Get User
Domain: dev-123456.okta.com
API Token: your-api-token
User ID: 00u1abc123

Output: {
  id: "00u1abc123",
  profile: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com"
  },
  status: "ACTIVE"
}`,
    tips: [
      'Get API token from Okta Admin → Security → API → Tokens',
      'Domain format: your-domain.okta.com',
      'Use filter queries for list_users (e.g., status eq "ACTIVE")',
      'User IDs are returned in create/list operations',
    ],
  },

  auth0: {
    overview: 'Auth0 identity and access management. Manage users, get tokens, and perform identity operations.',
    inputs: ['domain', 'clientId', 'clientSecret', 'userId (for user ops)', 'userData (for create/update)'],
    outputs: ['user object', 'users array', 'access_token (get_token)', 'success status'],
    example: `Operation: Get User
Domain: dev-abc123.us.auth0.com
Client ID: your-client-id
Client Secret: your-client-secret
User ID: auth0|123456

Output: {
  user_id: "auth0|123456",
  email: "user@example.com",
  name: "John Doe",
  created_at: "2024-01-15T10:00:00Z"
}`,
    tips: [
      'Get credentials from Auth0 Dashboard → Applications',
      'User ID format: "auth0|123456" or "google-oauth2|123456"',
      'Use Management API for user operations',
      'Get token operation uses client credentials grant',
    ],
  },

  keycloak: {
    overview: 'Keycloak identity and access management. Get tokens, manage users, and perform SSO operations.',
    inputs: ['serverUrl', 'realm', 'clientId', 'clientSecret', 'username/password (for get_token)'],
    outputs: ['access_token', 'refresh_token', 'user object', 'users array'],
    example: `Operation: Get Token
Server URL: https://keycloak.example.com
Realm: master
Client ID: your-client-id
Client Secret: your-client-secret
Username: user@example.com
Password: password

Output: {
  access_token: "eyJhbGci...",
  refresh_token: "def502...",
  expires_in: 300,
  token_type: "Bearer"
}`,
    tips: [
      'Realm is usually "master" for admin operations',
      'Use password grant for user authentication',
      'Use client credentials for admin API access',
      'Token endpoint: /realms/{realm}/protocol/openid-connect/token',
    ],
  },

  // ============================================
  // PAYMENT & FINANCE NODES
  // ============================================
  stripe: {
    overview: 'Stripe payment processing. Create payments, manage customers, handle subscriptions, and process refunds.',
    inputs: ['apiKey', 'amount', 'currency', 'paymentMethodId', 'customerId'],
    outputs: ['payment_intent', 'payment', 'customer', 'subscription', 'refund'],
    example: `Operation: Create Payment Intent
API Key: sk_test_...
Amount: 1000 (cents)
Currency: usd

Output: {
  id: "pi_1234567890",
  amount: 1000,
  currency: "usd",
  status: "requires_payment_method",
  client_secret: "pi_1234567890_secret_..."
}`,
    tips: [
      'Amount is in smallest currency unit (cents for USD)',
      'Use test keys (sk_test_) for development',
      'Payment Intent is required for modern payment flows',
      'Customer ID format: cus_...',
    ],
  },

  razorpay: {
    overview: 'Razorpay payment gateway. Create orders, process payments, handle refunds, and manage customers.',
    inputs: ['keyId', 'keySecret', 'amount', 'currency', 'orderId', 'paymentId'],
    outputs: ['order', 'payment', 'refund', 'customer'],
    example: `Operation: Create Order
Key ID: rzp_test_...
Key Secret: your-key-secret
Amount: 10000 (paise)
Currency: INR

Output: {
  id: "order_1234567890",
  amount: 10000,
  currency: "INR",
  status: "created",
  created_at: 1642234567
}`,
    tips: [
      'Amount is in smallest currency unit (paise for INR)',
      'Use test keys (rzp_test_) for development',
      'Order must be created before payment',
      'Payment ID format: pay_...',
    ],
  },

  paypal: {
    overview: 'PayPal payment processing. Create orders, capture payments, process refunds, and manage transactions.',
    inputs: ['clientId', 'clientSecret', 'environment', 'amount', 'currency', 'orderId'],
    outputs: ['order', 'access_token', 'capture', 'refund'],
    example: `Operation: Create Order
Client ID: your-client-id
Client Secret: your-client-secret
Environment: sandbox
Amount: 10.00
Currency: USD

Output: {
  id: "5O190127TN364715T",
  status: "CREATED",
  links: [{
    href: "https://api.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T",
    rel: "self"
  }]
}`,
    tips: [
      'Use sandbox for testing, production for live',
      'Amount is decimal string (e.g., "10.00")',
      'Order must be captured after creation',
      'Access token auto-generated for API calls',
    ],
  },

  quickbooks: {
    overview: 'QuickBooks accounting operations. Manage invoices, customers, payments, and financial data.',
    inputs: ['accessToken', 'realmId', 'environment', 'invoiceId', 'customerId', 'invoiceData'],
    outputs: ['invoice', 'invoices array', 'customer', 'payment'],
    example: `Operation: Get Invoice
Access Token: your-access-token
Realm ID: 123456789
Environment: sandbox
Invoice ID: 1

Output: {
  Invoice: {
    Id: "1",
    DocNumber: "1001",
    TotalAmt: 100.00,
    Balance: 0.00,
    CustomerRef: {
      value: "1",
      name: "Customer Name"
    }
  }
}`,
    tips: [
      'Use OAuth2 to get access token',
      'Realm ID is your Company ID',
      'Use sandbox for testing',
      'Invoice ID is numeric',
    ],
  },

  xero: {
    overview: 'Xero accounting operations. Manage invoices, contacts, payments, and financial records.',
    inputs: ['accessToken', 'tenantId', 'invoiceId', 'contactId', 'invoiceData'],
    outputs: ['invoice', 'invoices array', 'contact', 'payment'],
    example: `Operation: Get Invoice
Access Token: your-access-token
Tenant ID: your-tenant-id
Invoice ID: invoice-id

Output: {
  Invoices: [{
    InvoiceID: "invoice-id",
    Type: "ACCREC",
    Contact: {
      Name: "Customer Name"
    },
    Total: 100.00,
    Status: "AUTHORISED"
  }]
}`,
    tips: [
      'Get access token via OAuth2 flow',
      'Tenant ID from OAuth connection',
      'Invoice Type: ACCREC (Accounts Receivable) or ACCPAY (Accounts Payable)',
      'Contact ID required for creating invoices',
    ],
  },

  // ============================================
  // E-COMMERCE NODES
  // ============================================
  shopify: {
    overview: 'Shopify e-commerce operations. Manage products, orders, customers, and inventory.',
    inputs: ['shopDomain', 'accessToken', 'productId', 'orderId', 'customerId'],
    outputs: ['product', 'products array', 'order', 'orders array', 'customer', 'customers array'],
    example: `Operation: Get Product
Shop Domain: mystore.myshopify.com
Access Token: shpat_...
Product ID: 123456789

Output: {
  product: {
    id: 123456789,
    title: "Product Name",
    vendor: "Vendor Name",
    product_type: "Type",
    variants: [...],
    images: [...]
  }
}`,
    tips: [
      'Get access token from Shopify Admin → Settings → Apps → Develop apps',
      'Shop domain format: your-shop.myshopify.com',
      'Product ID is numeric',
      'Use Admin API version 2024-01 or later',
    ],
  },

  woocommerce: {
    overview: 'WooCommerce store operations. Manage products, orders, customers, and store data.',
    inputs: ['storeUrl', 'consumerKey', 'consumerSecret', 'productId', 'orderId', 'customerId'],
    outputs: ['product', 'products array', 'order', 'orders array', 'customer'],
    example: `Operation: Get Product
Store URL: https://yourstore.com
Consumer Key: ck_...
Consumer Secret: cs_...
Product ID: 123

Output: {
  id: 123,
  name: "Product Name",
  sku: "PRODUCT-SKU",
  price: "29.99",
  stock_status: "instock"
}`,
    tips: [
      'Get API keys from WooCommerce → Settings → Advanced → REST API',
      'Store URL without trailing slash',
      'Consumer key starts with ck_, secret with cs_',
      'Product/Order IDs are numeric',
    ],
  },

  magento: {
    overview: 'Magento e-commerce operations. Manage products, orders, and store data via REST API.',
    inputs: ['storeUrl', 'accessToken', 'productId (SKU)', 'orderId', 'searchCriteria'],
    outputs: ['product', 'products array', 'order', 'orders array'],
    example: `Operation: Get Product
Store URL: https://yourstore.com
Access Token: your-access-token
Product ID (SKU): PRODUCT-SKU

Output: {
  sku: "PRODUCT-SKU",
  name: "Product Name",
  price: 29.99,
  status: 1,
  type_id: "simple"
}`,
    tips: [
      'Get access token from Magento Admin → System → Integrations',
      'Product ID is the SKU (string)',
      'Order ID is numeric',
      'Use searchCriteria for filtering list operations',
    ],
  },

  bigcommerce: {
    overview: 'BigCommerce store operations. Manage products, orders, customers, and store data.',
    inputs: ['storeHash', 'accessToken', 'productId', 'orderId', 'customerId'],
    outputs: ['product', 'products array', 'order', 'orders array', 'customer'],
    example: `Operation: Get Product
Store Hash: your-store-hash
Access Token: your-access-token
Product ID: 123

Output: {
  data: {
    id: 123,
    name: "Product Name",
    sku: "PRODUCT-SKU",
    price: "29.99",
    inventory_level: 100
  }
}`,
    tips: [
      'Get credentials from BigCommerce → Advanced Settings → API Accounts',
      'Store hash is in API URL: /stores/{storeHash}/v3',
      'Product/Order IDs are numeric',
      'API uses v3 endpoint',
    ],
  },

  // ============================================
  // ANALYTICS & DATA TOOLS NODES
  // ============================================
  google_analytics: {
    overview: 'Google Analytics data and reporting. Get reports, track events, and analyze user behavior.',
    inputs: ['accessToken', 'propertyId', 'dateRanges', 'dimensions', 'metrics', 'eventName'],
    outputs: ['report data', 'properties array', 'success status'],
    example: `Operation: Get Report
Access Token: your-access-token
Property ID: properties/123456789
Date Ranges: [{"startDate": "2024-01-01", "endDate": "2024-01-31"}]
Dimensions: ["date", "country"]
Metrics: ["activeUsers", "sessions"]

Output: {
  rows: [{
    dimensionValues: [{value: "20240101"}, {value: "US"}],
    metricValues: [{value: "1000"}, {value: "1500"}]
  }]
}`,
    tips: [
      'Get access token via OAuth2 or Service Account',
      'Property ID format: properties/123456789',
      'Use GA4 Data API for reports',
      'Measurement Protocol for event tracking',
    ],
  },

  mixpanel: {
    overview: 'Mixpanel analytics and event tracking. Track events, identify users, and query insights.',
    inputs: ['projectToken', 'apiSecret (for queries)', 'eventName', 'distinctId', 'properties'],
    outputs: ['success status', 'insights data'],
    example: `Operation: Track Event
Project Token: your-project-token
Event Name: Button Clicked
Distinct ID: user-123
Properties: {"button": "signup", "page": "home"}

Output: {
  status: 1,
  error: null
}`,
    tips: [
      'Get project token from Mixpanel → Project Settings',
      'API secret needed for query operations',
      'Distinct ID identifies the user',
      'Properties are custom event data',
    ],
  },

  segment: {
    overview: 'Segment analytics and data routing. Track events, identify users, track page views, and group users.',
    inputs: ['writeKey', 'userId', 'event', 'properties', 'traits'],
    outputs: ['success status'],
    example: `Operation: Track
Write Key: your-write-key
User ID: user-123
Event: Button Clicked
Properties: {"button": "signup", "page": "home"}

Output: {
  success: true
}`,
    tips: [
      'Get write key from Segment → Settings → API Keys',
      'User ID identifies the user across events',
      'Traits are user properties (for identify)',
      'Segment routes data to your connected destinations',
    ],
  },

  amplitude: {
    overview: 'Amplitude product analytics. Track events, identify users, and analyze product usage.',
    inputs: ['apiKey', 'secretKey (for get_event)', 'userId', 'eventType', 'eventProperties'],
    outputs: ['success status', 'event data'],
    example: `Operation: Track Event
API Key: your-api-key
User ID: user-123
Event Type: Button Clicked
Event Properties: {"button": "signup", "page": "home"}

Output: {
  code: 200,
  events_ingested: 1
}`,
    tips: [
      'Get API key from Amplitude → Settings → Projects',
      'Secret key needed for get_event operation',
      'Event type is the event name',
      'Event properties are custom data',
    ],
  },

  elasticsearch: {
    overview: 'Elasticsearch search and analytics. Search documents, index data, update records, and perform bulk operations.',
    inputs: ['nodeUrl', 'username/password (optional)', 'index', 'query', 'documentId', 'document'],
    outputs: ['search results', 'document', 'success status'],
    example: `Operation: Search
Node URL: https://localhost:9200
Index: my-index
Query: {"query": {"match": {"field": "value"}}}

Output: {
  hits: {
    total: {value: 10},
    hits: [{
      _id: "1",
      _source: {field: "value"}
    }]
  }
}`,
    tips: [
      'Node URL is your Elasticsearch cluster URL',
      'Index is the index name',
      'Query uses Elasticsearch Query DSL',
      'Bulk operations use NDJSON format',
    ],
  },
};
