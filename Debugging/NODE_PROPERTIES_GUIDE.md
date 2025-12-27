# Node Properties Guide

This guide explains all the properties (config fields) for each node type in Flow Genius AI.

## Table of Contents
1. [Trigger Nodes](#trigger-nodes)
2. [Core Logic Nodes](#core-logic-nodes)
3. [Data Manipulation Nodes](#data-manipulation-nodes)
4. [Code & Expression Nodes](#code--expression-nodes)
5. [AI & ML Nodes](#ai--ml-nodes)
6. [HTTP & API Nodes](#http--api-nodes)
7. [Output/Communication Nodes](#outputcommunication-nodes)
8. [Database Nodes](#database-nodes)
9. [File Operations](#file-operations)
10. [Utility Nodes](#utility-nodes)

---

## Trigger Nodes

### 1. Manual Trigger
**Purpose**: Start workflow manually for testing
- **Properties**: None (no configuration needed)

### 2. Schedule Trigger (Cron)
**Purpose**: Execute workflows on a schedule
- **Time** (required): Time in 24-hour format (e.g., `09:00`, `14:30`)
- **Timezone** (required): Select from dropdown (IST, UTC, US timezones, etc.)

### 3. Webhook
**Purpose**: Trigger workflow from HTTP requests
- **Method** (required): `GET`, `POST`, or `PUT`

### 4. Chat Trigger
**Purpose**: Trigger from chat/AI/UI messages
- **Properties**: None

### 5. Error Trigger
**Purpose**: Automatically fire when any node fails
- **Properties**: None

### 6. Interval
**Purpose**: Run workflow repeatedly at fixed intervals
- **Interval** (required): Format like `30s`, `5m`, `1h` (seconds, minutes, hours)

### 7. Workflow Trigger
**Purpose**: Trigger one workflow from another
- **Source Workflow ID** (required): ID of the workflow that will trigger this one

---

## Core Logic Nodes

### 1. If/Else
**Purpose**: Conditional branching
- **Condition** (required): Expression like `{{input.value}} > 10`

### 2. Switch
**Purpose**: Multiple case branching
- **Expression** (required): Expression to evaluate (e.g., `{{input.status}}`)
- **Cases** (JSON, required): Array of cases `[{"value": "active", "label": "Active"}]`

### 3. Merge
**Purpose**: Merge multiple inputs
- **Mode**: 
  - `merge`: Merge Objects
  - `append`: Append to Array
  - `key_based`: Key-based Merge
  - `wait_all`: Wait All
  - `concat`: Concatenate Arrays
- **Merge Key**: For key-based merge mode (e.g., `id`)

### 4. Loop
**Purpose**: Iterate over items
- **Array Expression** (required): Expression like `{{input.items}}`
- **Max Iterations**: Maximum number of iterations (default: 100)

### 5. Wait/Delay
**Purpose**: Pause execution
- **Duration (ms)** (required): Delay in milliseconds (default: 1000)

### 6. Error Handler
**Purpose**: Handle errors gracefully
- **Max Retries**: Number of retry attempts (default: 3)
- **Retry Delay (ms)**: Delay between retries (default: 1000)
- **Fallback Value** (JSON): Value to return if all retries fail

### 7. Filter
**Purpose**: Filter array items
- **Array Expression** (required): Expression like `{{input.items}}`
- **Filter Condition** (required): Condition like `item.active === true`

### 8. NoOp (Pass Through)
**Purpose**: Pass input through unchanged
- **Properties**: None

### 9. Stop And Error
**Purpose**: Stop workflow and trigger error
- **Error Message** (required): Message to display
- **Error Code**: Error code (e.g., `STOPPED`)

### 10. Split In Batches
**Purpose**: Split array into batches
- **Array Expression** (required): Expression like `{{input.items}}`
- **Batch Size** (required): Number of items per batch (default: 10)

---

## Data Manipulation Nodes

### 1. Set
**Purpose**: Set field values in object
- **Fields (JSON)** (required): Object like `{"name": "{{input.name}}", "age": 25}`

### 2. Edit Fields
**Purpose**: Edit fields with operations
- **Operations (JSON)** (required): Array like `[{"operation": "set", "field": "name", "value": "John"}]`
  - Operations: `set`, `delete`, `rename`

### 3. Rename Keys
**Purpose**: Rename object keys
- **Key Mappings (JSON)** (required): Object like `{"oldName": "newName"}`

### 4. Aggregate
**Purpose**: Aggregate operations on arrays
- **Operation**: `sum`, `avg`, `count`, `min`, `max`
- **Field** (optional): Field to aggregate (leave empty to aggregate items directly)
- **Group By** (optional): Field to group by

### 5. Limit
**Purpose**: Limit array size
- **Limit** (required): Maximum number of items (default: 10)

### 6. Sort
**Purpose**: Sort array items
- **Field** (optional): Field to sort by
- **Direction**: `asc` (Ascending) or `desc` (Descending)
- **Type**: `auto`, `string`, `number`, or `date`

### 7. Item Lists
**Purpose**: Convert object to list of key-value items
- **Properties**: None

### 8. Merge Data
**Purpose**: Combine multiple inputs
- **Mode**: `merge`, `append`, or `concat`

### 9. Set Variable
**Purpose**: Store value in variable
- **Variable Name** (required): Name of the variable (e.g., `myVariable`)
- **Value** (required): Value expression like `{{input.data}}`

### 10. JSON Parser
**Purpose**: Parse/transform JSON
- **JSONPath Expression**: Expression like `$.data.items[*]`

### 11. CSV Processor
**Purpose**: Process CSV data
- **Delimiter**: Character used to separate values (default: `,`)
- **Has Header Row**: Boolean (default: `true`)

### 12. Text Formatter
**Purpose**: Format text content
- **Template** (required): Template like `Hello {{name}}!`

### 13. Google Sheets
**Purpose**: Read or write data from Google Sheets
- **Operation**: `read`, `write`, `append`, or `update`
- **Spreadsheet ID** (required): ID from Google Sheets URL
- **Sheet Name (Tab)**: Name of the sheet (leave empty for first sheet)
- **Range**: Range like `A1:D100` (leave empty to read all)
- **Output Format**: `json`, `keyvalue`, or `text`
- **Read Direction**: `rows` or `columns`
- **Allow Write Access**: Boolean (admin only)
- **Data to Write (JSON)**: Required for write operations, format: `[["Name", "Email"], ["John", "john@example.com"]]`

---

## Code & Expression Nodes

### 1. JavaScript
**Purpose**: Run custom JavaScript code
- **JavaScript Code** (required): Code like `return input;`
- **Timeout (ms)**: Maximum execution time (default: 5000)

### 2. Function
**Purpose**: Dataset-level code execution
- **Function Code** (required): Code receives `input`, `data`
- **Timeout (ms)**: Default: 10000

### 3. Function Item
**Purpose**: Per-item code execution
- **Function Code** (required): Code receives `item`, `index`, `input`
- **Timeout (ms)**: Default: 5000

### 4. Execute Command
**Purpose**: Execute system command (disabled by default)
- **Command** (required): Command like `echo "Hello"`
- **Enable Execution**: Boolean (default: `false` - WARNING: disabled for security)
- **Timeout (ms)**: Default: 30000

---

## AI & ML Nodes

### 1. OpenAI GPT
**Purpose**: Process with GPT models
- **API Key** (required): OpenAI API key (starts with `sk-`)
- **Model**: `gpt-4o`, `gpt-4o-mini`, or `gpt-4-turbo`
- **System Prompt** (required): Prompt like `You are a helpful assistant...`
- **Temperature**: Number (default: 0.7)
- **Memory**: Number of conversation turns to remember (default: 10)

### 2. Anthropic Claude
**Purpose**: Process with Claude models
- **API Key** (required): Anthropic API key (starts with `sk-ant-`)
- **Model**: `claude-3-5-sonnet`, `claude-3-opus`, or `claude-3-haiku`
- **System Prompt** (required)
- **Temperature**: Default: 0.7
- **Memory**: Default: 10

### 3. Google Gemini
**Purpose**: Process with Gemini models
- **API Key** (required): Google API key (starts with `AIza`)
- **Model**: `gemini-2.5-flash`, `gemini-2.5-pro`, or `gemini-2.5-flash-lite`
- **System Prompt** (required)
- **Temperature**: Default: 0.7
- **Memory**: Default: 10

### 4. Text Summarizer
**Purpose**: Summarize text using AI
- **API Key** (required): OpenAI API key
- **Memory**: Default: 10

### 5. Sentiment Analysis
**Purpose**: Analyze text sentiment
- **API Key** (required): OpenAI API key
- **Memory**: Default: 10

### 6. Memory
**Purpose**: Store and retrieve conversation memory
- **Operation**: `store`, `retrieve`, `clear`, or `search`
- **Memory Type**: `short` (Redis), `long` (Vector), or `both` (Hybrid)
- **TTL (seconds)**: Time to live for short-term memory (default: 3600)
- **Max Messages**: Maximum messages to retrieve (default: 100)

### 7. LLM Chain
**Purpose**: Chain multiple AI prompts together
- **API Key** (required): OpenAI API key
- **Default Model**: `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet`, or `gemini-2.5-flash`
- **Chain Steps (JSON)** (required): Array like `[{"prompt": "Step 1 prompt"}, {"prompt": "Step 2 prompt"}]`

---

## HTTP & API Nodes

### 1. HTTP Request
**Purpose**: Make HTTP API call
- **URL** (required): Full URL like `https://api.example.com/data`
- **Method**: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`
- **Headers (JSON)**: Object like `{"Authorization": "Bearer token"}`
- **Body (JSON)**: Request body
- **Timeout (ms)**: Default: 30000

### 2. GraphQL
**Purpose**: Execute GraphQL query
- **GraphQL Endpoint** (required): URL like `https://api.example.com/graphql`
- **Query** (required): GraphQL query string
- **Operation Name**: Optional operation name
- **Variables (JSON)**: Object like `{"id": 1}`
- **Headers (JSON)**: Authentication headers
- **Timeout (ms)**: Default: 30000

### 3. Respond to Webhook
**Purpose**: Send response to webhook caller
- **Status Code** (required): HTTP status code (default: 200)
- **Response Body (JSON)**: Response data
- **Custom Headers (JSON)**: Additional headers

---

## Output/Communication Nodes

### 1. HTTP POST
**Purpose**: Send HTTP POST request
- **URL** (required): Target URL
- **Headers (JSON)**: Request headers
- **Body Template**: Template like `{"data": "{{input}}"}`

### 2. Send Email (Resend)
**Purpose**: Send email via Resend
- **To** (required): Recipient email
- **From** (required): Sender email
- **Subject** (required): Email subject
- **Body (HTML allowed)** (required): Email body (can include HTML)
- **Reply-To**: Reply-to email address

### 3. Slack Message
**Purpose**: Send Slack notification
- **Webhook URL** (required): Slack webhook URL
- **Channel** (optional): Channel like `#general`
- **Bot Name**: Default: `CtrlChecks Bot`
- **Icon Emoji**: Default: `:zap:`
- **Message** (required): Message text
- **Blocks (JSON, optional)**: Slack blocks for rich formatting

### 4. Slack Incoming Webhook
**Purpose**: Simple Slack webhook
- **Webhook URL** (required)
- **Message Text** (required)

### 5. Discord Webhook
**Purpose**: Send Discord message
- **Webhook URL** (required): Discord webhook URL
- **Message** (required): Message content
- **Username**: Bot username
- **Avatar URL**: Avatar image URL

### 6. Microsoft Teams
**Purpose**: Send message to Microsoft Teams
- **Webhook URL** (required): Teams webhook URL
- **Title**: Message title (default: `Workflow Notification`)
- **Message** (required): Message content

### 7. Telegram
**Purpose**: Send message via Telegram Bot
- **Bot Token** (required): Get from @BotFather
- **Chat ID** (required): User or group chat ID
- **Message** (required): Message text

### 8. WhatsApp Cloud API
**Purpose**: Send message via WhatsApp Business API
- **Phone Number ID** (required): WhatsApp phone number ID
- **Access Token** (required): WhatsApp access token
- **Recipient Number** (required): Phone number with country code (no +)
- **Message** (required): Message text

### 9. Twilio SMS
**Purpose**: Send SMS via Twilio
- **Account SID** (required): Twilio account SID
- **Auth Token** (required): Twilio auth token
- **From Number** (required): Twilio phone number
- **To Number** (required): Recipient phone number
- **Message** (required): SMS text

### 10. Database Write
**Purpose**: Write to database
- **Table Name** (required): Target table
- **Operation**: `insert`, `update`, `upsert`, or `delete`
- **Data Template** (JSON): Data to write
- **Match Column**: For update/upsert operations (e.g., `id`)

### 11. Log Output
**Purpose**: Log data for debugging
- **Log Message** (required): Message like `Debug: {{input}}`
- **Log Level**: `info`, `warn`, `error`, or `debug`

---

## Database Nodes

### 1. Database Read
**Purpose**: Read from database
- **Table Name** (required): Source table
- **Columns**: Column names or `*` for all (default: `*`)
- **Filters (JSON)**: Filter conditions like `{"column": "value"}`
- **Limit**: Maximum rows (default: 100)
- **Order By**: Column to sort by
- **Ascending**: Boolean (default: `false`)

### 2. PostgreSQL
**Purpose**: Query PostgreSQL database
- **Operation**: `select` or `query` (raw SQL)
- **Table Name**: Required for select operation
- **SQL Query**: Required for raw SQL operation
- **Filters (JSON)**: For select operation
- **Limit**: Default: 100
- **Order By**: Column name
- **Ascending**: Boolean (default: `true`)

### 3. Supabase
**Purpose**: Query Supabase database (PostgreSQL)
- Same properties as PostgreSQL node

### 4. MySQL
**Purpose**: Query MySQL database
- **Operation**: `select`
- **Table Name** (required)
- **Filters (JSON)**
- **Limit**: Default: 100

### 5. MongoDB
**Purpose**: Query MongoDB database
- **Operation**: `find`
- **Collection Name** (required)
- **Query (JSON)**: MongoDB query like `{"field": "value"}`
- **Limit**: Default: 100

### 6. Redis
**Purpose**: Redis operations
- **Operation**: `get`, `set`, or `delete`
- **Key** (required): Redis key
- **Value**: For set operation
- **TTL (seconds)**: For set operation

---

## File Operations

### 1. Read Binary File
**Purpose**: Read file from filesystem
- **File Path** (required): Path like `/tmp/test-file.txt` (supports template variables like `{{path}}`)
- **Max Size (bytes)**: Maximum file size (default: 10485760 = 10MB)

### 2. Write Binary File
**Purpose**: Write file to filesystem
- **File Path** (required): Path like `/tmp/test-file.txt` (will be normalized to `/tmp/` in Supabase Edge Functions)
- **Content (Base64)** (required): Base64 encoded content

### 3. RSS Feed Read
**Purpose**: Read and parse RSS feed
- **Feed URL** (required): RSS feed URL
- **Max Items**: Maximum items to return (default: 10)

---

## Utility Nodes

### 1. Date & Time
**Purpose**: Manipulate dates and times
- **Operation**: `format`, `add`, `subtract`, `diff`, or `now`
- **Date (ISO)**: Date string (leave empty for current date)
- **Format**: `ISO`, `timestamp`, or `custom`
- **Value**: Number for add/subtract operations
- **Unit**: `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, or `years`

### 2. Math
**Purpose**: Mathematical operations
- **Operation**: `add`, `subtract`, `multiply`, `divide`, `modulo`, `power`, `sqrt`, `abs`, `round`, `floor`, `ceil`, `min`, `max`
- **Value 1**: Number or template expression like `{{value1}}`
- **Value 2**: Number or template expression (not needed for single-value operations)

### 3. Crypto
**Purpose**: Cryptographic operations
- **Operation**: `hash`, `encode_base64`, `decode_base64`, `uuid`, `random_string`
- **Hash Algorithm**: `sha256`, `sha512`, or `sha1` (for hash operation)
- **Length**: For random string (default: 16)
- **Character Set**: For random string (default: alphanumeric)

### 4. HTML Extract
**Purpose**: Extract content from HTML
- **HTML Content**: HTML string (leave empty to use input)
- **CSS Selector/Tag**: Selector or tag name like `div`, `p`, `h1`

### 5. XML
**Purpose**: Parse and extract from XML
- **Operation**: `parse` or `extract`
- **XML Content**: XML string (leave empty to use input)
- **XPath Expression**: For extract operation (e.g., `/root/item`)

---

## Template Variables

Most nodes support template variables using `{{variable}}` syntax:

- `{{input}}` - The entire input object
- `{{input.field}}` - Access a field from input
- `{{field}}` - Direct property access (shorthand)
- `{{path}}` - Access output from previous node (e.g., from Write Binary File)

**Example**: In Read Binary File, you can use `{{path}}` to read the file path from the previous Write Binary File node's output.

---

## Notes

1. **Required Fields**: Fields marked as "required" must be filled for the node to work
2. **JSON Fields**: Fields marked as "JSON" expect valid JSON format
3. **Template Variables**: Most text fields support template variables using `{{...}}` syntax
4. **Defaults**: Default values are shown in parentheses
5. **Help Text**: Many fields have help text explaining their purpose

