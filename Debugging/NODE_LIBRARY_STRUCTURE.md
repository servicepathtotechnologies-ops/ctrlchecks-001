# Node Library Structure

## Overview

The Node Library is the left sidebar component in the workflow builder that displays all available nodes organized by categories. Users can search, browse, and drag nodes onto the canvas to build workflows.

## File Structure

### Core Files

1. **`src/components/workflow/NodeLibrary.tsx`**
   - Main component that renders the Node Library UI
   - Handles search functionality
   - Displays nodes in accordion-style categories
   - Implements drag-and-drop functionality

2. **`src/components/workflow/nodeTypes.ts`**
   - Defines all node types and their configurations
   - Contains `NODE_CATEGORIES` array
   - Contains `NODE_TYPES` array with all node definitions
   - Exports helper functions for node lookup

## Node Categories

The Node Library is organized into **8 main categories**:

### 1. **Trigger Nodes** (`triggers`)
- **Color**: Primary theme color
- **Purpose**: Start workflow execution
- **Nodes** (7 total):
  1. Manual Trigger (`manual_trigger`)
  2. Schedule Trigger (Cron) (`schedule`)
  3. Webhook (`webhook`)
  4. Chat Trigger (`chat_trigger`)
  5. Error Trigger (`error_trigger`)
  6. Interval (`interval`)
  7. Workflow Trigger (`workflow_trigger`)

### 2. **Core Logic Nodes** (`logic`)
- **Color**: Secondary theme color
- **Purpose**: Control flow and conditional logic
- **Nodes** (10 total):
  1. If/Else (`if_else`)
  2. Switch (`switch`)
  3. Merge (`merge`)
  4. Loop (`loop`)
  5. Wait/Delay (`wait`)
  6. Error Handler (`error_handler`)
  7. Filter (`filter`)
  8. NoOp (Pass Through) (`noop`)
  9. Stop And Error (`stop_and_error`)
  10. Split In Batches (`split_in_batches`)

### 3. **Data Manipulation** (`data`)
- **Color**: Green (`hsl(142 71% 45%)`)
- **Purpose**: Transform and manipulate data
- **Nodes** (23 total):
  1. Set (`set`)
  2. Edit Fields (`edit_fields`)
  3. Rename Keys (`rename_keys`)
  4. Aggregate (`aggregate`)
  5. Limit (`limit`)
  6. Sort (`sort`)
  7. Item Lists (`item_lists`)
  8. Merge Data (`merge_data`)
  9. Set Variable (`set_variable`)
  10. JSON Parser (`json_parser`)
  11. CSV Processor (`csv_processor`)
  12. Text Formatter (`text_formatter`)
  13. JavaScript (`javascript`)
  14. Function (`function`) - Dataset-level code execution
  15. Function Item (`function_item`) - Per-item code execution
  16. Execute Command (`execute_command`) - System command execution
  17. Google Sheets (`google_sheets`)
  18. RSS Feed Read (`rss_feed_read`)
  19. Date & Time (`date_time`)
  20. Math (`math`)
  21. Crypto (`crypto`)
  22. HTML Extract (`html_extract`)
  23. XML (`xml`)

### 4️⃣ **Database Nodes** (`database`)
- **Color**: Blue (`hsl(217 91% 60%)`)
- **Purpose**: Database operations and queries
- **Nodes** (11 total):
  1. Database Read (`database_read`) - Supabase read operations ✅
  2. Database Write (`database_write`) - Supabase write operations ✅
  3. PostgreSQL (`postgresql`) - Advanced PostgreSQL operations ✅
  4. Supabase (`supabase`) - Supabase database operations (recommended) ✅
  5. MySQL (`mysql`) - MySQL database operations ⚠️
  6. MongoDB (`mongodb`) - MongoDB database operations ⚠️
  7. Microsoft SQL Server (`mssql`) - SQL Server database operations ⚠️
  8. SQLite (`sqlite`) - SQLite database operations ⚠️
  9. Redis (`redis`) - Redis cache operations ⚠️
  10. Snowflake (`snowflake`) - Snowflake data warehouse operations ⚠️
  11. TimescaleDB (`timescaledb`) - TimescaleDB time-series operations ⚠️

### 5️⃣ **File & Storage Nodes** (`storage`)
- **Color**: Purple (`hsl(262 83% 58%)`)
- **Purpose**: File operations and cloud storage
- **Nodes** (10 total):
  1. Read Binary File (`read_binary_file`) - Read files from filesystem ✅
  2. Write Binary File (`write_binary_file`) - Write files to filesystem ✅
  3. FTP (`ftp`) - File Transfer Protocol operations ⚠️
  4. SFTP (`sftp`) - Secure File Transfer Protocol operations ⚠️
  5. AWS S3 (`aws_s3`) - Amazon S3 bucket operations ⚠️
  6. Google Drive (`google_drive`) - Google Drive file operations ✅
  7. Dropbox (`dropbox`) - Dropbox file operations ✅
  8. OneDrive (`onedrive`) - Microsoft OneDrive file operations ✅
  9. Box (`box`) - Box.com file operations ✅
  10. MinIO (`minio`) - MinIO object storage operations ⚠️

### 6. **AI & ML Nodes** (`ai`)
- **Color**: Accent theme color
- **Purpose**: AI-powered operations
- **Nodes** (15 total):
  1. OpenAI GPT (`openai_gpt`) ✅
  2. Anthropic Claude (`anthropic_claude`) ✅
  3. Google Gemini (`google_gemini`) ✅
  4. Azure OpenAI (`azure_openai`) ✅
  5. Hugging Face (`hugging_face`) ✅
  6. Cohere (`cohere`) ✅
  7. Ollama (`ollama`) ✅
  8. Text Summarizer (`text_summarizer`) ✅
  9. Sentiment Analysis (`sentiment_analyzer`) ✅
  10. Memory (`memory`) - Store and retrieve conversation memory ✅
  11. LLM Chain (`llm_chain`) - Chain multiple AI prompts together ✅
  12. AI Agent (`ai_agent`) ✅
  13. Chat Model (`chat_model`) ✅
  14. Embeddings (`embeddings`) ✅
  15. Vector Store (`vector_store`) ✅

### 7. **HTTP & API** (`http_api`)
- **Color**: Blue (`hsl(221 83% 53%)`)
- **Purpose**: HTTP requests and API integrations
- **Nodes** (3 total):
  1. HTTP Request (`http_request`)
  2. GraphQL (`graphql`)
  3. Respond to Webhook (`respond_to_webhook`)

### 8. **Output/Communication** (`output`)
- **Color**: Orange (`hsl(25 95% 53%)`)
- **Purpose**: Output data and send communications
- **Nodes** (10 total):
  1. HTTP POST (`http_post`)
  2. Send Email (Resend) (`email_resend`)
  3. Slack Message (`slack_message`)
  4. Slack Incoming Webhook (`slack_webhook`)
  5. Discord Webhook (`discord_webhook`)
  6. Microsoft Teams (`microsoft_teams`)
  7. Telegram (`telegram`)
  8. WhatsApp Cloud API (`whatsapp_cloud`)
  9. Twilio SMS (`twilio`)
  10. Log Output (`log_output`)

## Node Type Definition Structure

Each node in `NODE_TYPES` follows this structure:

```typescript
interface NodeTypeDefinition {
  type: string;                    // Unique identifier (e.g., 'manual_trigger')
  label: string;                   // Display name (e.g., 'Manual Trigger')
  category: NodeCategory;          // Category ID (e.g., 'triggers')
  icon: string;                    // Icon name from lucide-react (e.g., 'Play')
  description: string;             // Short description shown in library
  defaultConfig: Record<string, unknown>;  // Default configuration values
  configFields: ConfigField[];     // Configuration fields for properties panel
  usageGuide?: NodeUsageGuide;    // Optional usage guide
}
```

### ConfigField Structure

```typescript
interface ConfigField {
  key: string;                     // Config property key
  label: string;                   // Field label
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'json' | 'cron' | 'time';
  placeholder?: string;           // Placeholder text
  options?: { label: string; value: string }[];  // For select fields
  required?: boolean;              // Is field required?
  defaultValue?: unknown;         // Default value
  helpText?: string;               // Help text shown below field
}
```

## Component Architecture

### NodeLibrary Component

```typescript
// Main structure
<div className="w-72 border-r border-border bg-card h-full flex flex-col">
  {/* Header with search */}
  <div className="p-4 border-b border-border">
    <h2>Node Library</h2>
    <Input placeholder="Search nodes..." />
  </div>

  {/* Scrollable accordion with categories */}
  <ScrollArea>
    <Accordion>
      {NODE_CATEGORIES.map(category => (
        <AccordionItem>
          <AccordionTrigger>
            {/* Category header with color dot and count */}
          </AccordionTrigger>
          <AccordionContent>
            {/* List of nodes in category */}
            {nodes.map(node => (
              <div draggable onDragStart={...}>
                {/* Node icon and description */}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </ScrollArea>
</div>
```

## Features

### 1. **Search Functionality**
- Real-time search across node labels and descriptions
- Case-insensitive matching
- Filters nodes as you type

### 2. **Category Organization**
- Accordion-style collapsible sections
- Color-coded category indicators
- Node count per category
- All categories expanded by default

### 3. **Drag and Drop**
- Each node is draggable
- `onDragStart` handler passes node definition to canvas
- Visual feedback during drag

### 4. **Visual Design**
- Category color dots
- Icon-based node identification
- Hover states for better UX
- Responsive layout

## Data Flow

```
NODE_TYPES (nodeTypes.ts)
    ↓
NodeLibrary Component
    ↓
User Interaction (search, drag)
    ↓
WorkflowCanvas (receives dragged node)
    ↓
Node added to workflow
```

## Adding New Nodes

To add a new node:

1. **Add to `NODE_TYPES` array** in `nodeTypes.ts`:
```typescript
{
  type: 'my_new_node',
  label: 'My New Node',
  category: 'data',  // Choose appropriate category
  icon: 'Box',       // Choose from lucide-react icons
  description: 'Does something useful',
  defaultConfig: {},
  configFields: [
    {
      key: 'myField',
      label: 'My Field',
      type: 'text',
      required: true
    }
  ]
}
```

2. **Add icon to iconMap** in `NodeLibrary.tsx`:
```typescript
import { MyIcon } from 'lucide-react';
const iconMap = {
  // ... existing icons
  MyIcon
};
```

3. **Implement node execution** in `supabase/functions/execute-workflow/index.ts`:
```typescript
case "my_new_node": {
  // Node execution logic
  return output;
}
```

## Category Colors

- **Triggers**: `hsl(var(--primary))` - Primary theme color
- **Logic**: `hsl(var(--secondary))` - Secondary theme color
- **Data**: `hsl(142 71% 45%)` - Green
- **Database**: `hsl(217 91% 60%)` - Blue
- **Storage**: `hsl(262 83% 58%)` - Purple
- **AI**: `hsl(var(--accent))` - Accent theme color
- **HTTP & API**: `hsl(221 83% 53%)` - Blue
- **Output**: `hsl(25 95% 53%)` - Orange

## Complete Node List by Category

### Trigger Nodes (7 nodes)
1. Manual Trigger
2. Schedule Trigger (Cron)
3. Webhook
4. Chat Trigger
5. Error Trigger
6. Interval
7. Workflow Trigger

### Core Logic Nodes (10 nodes)
1. If/Else
2. Switch
3. Merge
4. Loop
5. Wait/Delay
6. Error Handler
7. Filter
8. NoOp (Pass Through)
9. Stop And Error
10. Split In Batches

### Data Manipulation Nodes (23 nodes)

#### Core Data Operations (12 nodes)
1. Set
2. Edit Fields
3. Rename Keys
4. Aggregate
5. Limit
6. Sort
7. Item Lists
8. Merge Data
9. Set Variable
10. JSON Parser
11. CSV Processor
12. Text Formatter

#### Code & Expression Nodes (4 nodes)
13. JavaScript
14. Function (Dataset-level code execution)
15. Function Item (Per-item code execution)
16. Execute Command (System command execution - disabled by default)

#### Integration Nodes (3 nodes)
17. Google Sheets
18. RSS Feed Read
19. XML

#### Utility Nodes (4 nodes)
20. Date & Time
21. Math
22. Crypto
23. HTML Extract

### 4️⃣ Database Nodes (11 nodes)

**Fully Implemented (Supabase Database):**
1. Database Read - Supabase database read operations ✅
2. Database Write - Supabase database write operations ✅
3. PostgreSQL - Advanced PostgreSQL operations via Supabase ✅
4. Supabase - Supabase database operations (recommended over PostgreSQL) ✅

**Requires External Connection Setup:**
5. MySQL - Requires MySQL connection configuration ⚠️
6. MongoDB - Requires MongoDB connection configuration ⚠️
7. Microsoft SQL Server - Requires SQL Server connection configuration ⚠️
8. SQLite - Requires SQLite database file path configuration ⚠️
9. Redis - Requires Redis connection configuration (Note: Use Memory node for chat memory) ⚠️
10. Snowflake - Requires Snowflake account credentials ⚠️
11. TimescaleDB - Requires TimescaleDB/PostgreSQL connection configuration ⚠️

### 5️⃣ File & Storage Nodes (10 nodes)

**Fully Implemented:**
1. Read Binary File - Read files from filesystem ✅
2. Write Binary File - Write files to filesystem ✅
3. Google Drive - Google Drive file operations ✅
4. Dropbox - Dropbox file operations ✅
5. OneDrive - Microsoft OneDrive file operations ✅
6. Box - Box.com file operations ✅

**Requires External Configuration:**
7. FTP - File Transfer Protocol operations (requires FTP client library) ⚠️
8. SFTP - Secure File Transfer Protocol operations (requires SFTP client library) ⚠️
9. AWS S3 - Amazon S3 bucket operations (requires AWS SDK) ⚠️
10. MinIO - MinIO object storage operations (requires S3-compatible client) ⚠️

### AI & ML Nodes (15 nodes) ✅ **ALL FULLY FUNCTIONAL**

#### Large Language Models (LLMs) (7 nodes)
1. OpenAI GPT (`openai_gpt`) ✅
2. Anthropic Claude (`anthropic_claude`) ✅
3. Google Gemini (`google_gemini`) ✅
4. Azure OpenAI (`azure_openai`) ✅
5. Hugging Face (`hugging_face`) ✅
6. Cohere (`cohere`) ✅
7. Ollama (`ollama`) ✅

#### AI Operations & Tools (8 nodes)
8. Text Summarizer (`text_summarizer`) ✅
9. Sentiment Analysis (`sentiment_analyzer`) ✅
10. Memory (`memory`) - Store and retrieve conversation memory ✅
11. LLM Chain (`llm_chain`) - Chain multiple AI prompts together ✅
12. AI Agent (`ai_agent`) - Autonomous AI agent with tool usage ✅
13. Chat Model (`chat_model`) - Unified interface for multiple LLMs ✅
14. Embeddings (`embeddings`) - Text to vector embeddings ✅
15. Vector Store (`vector_store`) - Vector database operations for embeddings ✅

### HTTP & API Nodes (3 nodes)
1. HTTP Request
2. GraphQL
3. Respond to Webhook

### Output/Communication Nodes (10 nodes)

#### Communication & Messaging (9 nodes)
1. HTTP POST
2. Send Email (Resend)
3. Slack Message
4. Slack Incoming Webhook
5. Discord Webhook
6. Microsoft Teams
7. Telegram
8. WhatsApp Cloud API
9. Twilio SMS

#### Output & Logging (1 node)
10. Log Output

## Node Implementation Status Summary

**Quick Reference:**
- **✅ Fully Functional**: 78 nodes - Complete implementation, tested, ready to use
- **⚠️ Defined but Need Implementation**: 11 nodes - Node definitions exist in UI, execution logic requires external libraries/drivers
- **Total Nodes in Library**: 89 nodes

### ✅ Fully Implemented & Functional Nodes (78 nodes)

**Trigger Nodes (7/7):** ✅ **ALL FULLY FUNCTIONAL**
1. Manual Trigger ✅
2. Schedule Trigger ✅
3. Webhook ✅
4. Chat Trigger ✅
5. Error Trigger ✅
6. Interval ✅
7. Workflow Trigger ✅

**Status:** Complete implementation in `execute-workflow/index.ts`. All nodes tested and working.

**Core Logic Nodes (10/10):** ✅ **ALL FULLY FUNCTIONAL**
1. If/Else ✅
2. Switch ✅
3. Merge ✅
4. Loop ✅
5. Wait/Delay ✅
6. Error Handler ✅
7. Filter ✅
8. NoOp ✅
9. Stop And Error ✅
10. Split In Batches ✅

**Status:** Complete implementation in `execute-workflow/index.ts`. All nodes tested and working.

**Data Manipulation Nodes (23/23):** ✅ **ALL FULLY FUNCTIONAL**
- Core Data Operations (12/12) ✅
- Code & Expression Nodes (4/4) ✅
- Integration Nodes (3/3) ✅
- Utility Nodes (4/4) ✅

**Database Nodes (4/11 Fully Implemented):**
- Fully Implemented (4/11): Database Read ✅, Database Write ✅, PostgreSQL ✅, Supabase ✅
- Defined with Placeholders (7/11): MySQL ⚠️, MongoDB ⚠️, Microsoft SQL Server ⚠️, SQLite ⚠️, Redis ⚠️, Snowflake ⚠️, TimescaleDB ⚠️

**File & Storage Nodes (6/10 Fully Implemented):**
- Fully Implemented (6/10): Read Binary File ✅, Write Binary File ✅, Google Drive ✅, Dropbox ✅, OneDrive ✅, Box ✅
- Defined with Placeholders (4/10): FTP ⚠️, SFTP ⚠️, AWS S3 ⚠️, MinIO ⚠️

**AI & ML Nodes (15/15 Fully Implemented):** ✅ **ALL FULLY FUNCTIONAL**
- Fully Functional (15/15): OpenAI GPT ✅, Anthropic Claude ✅, Google Gemini ✅, Text Summarizer ✅, Sentiment Analysis ✅, Memory ✅, LLM Chain ✅, Azure OpenAI ✅, Hugging Face ✅, Cohere ✅, Ollama ✅, AI Agent ✅, Chat Model ✅, Embeddings ✅, Vector Store ✅

**HTTP & API Nodes (3/3):** ✅ **ALL FULLY FUNCTIONAL**
1. HTTP Request ✅
2. GraphQL ✅
3. Respond to Webhook ✅

**Status:** Complete implementation in `execute-workflow/index.ts`. All nodes tested and working.

**Output/Communication Nodes (10/10):** ✅ **ALL FULLY FUNCTIONAL**

**Communication & Messaging (9/9):**
1. HTTP POST ✅
2. Send Email (Resend) ✅
3. Slack Message ✅
4. Slack Incoming Webhook ✅
5. Discord Webhook ✅
6. Microsoft Teams ✅
7. Telegram ✅
8. WhatsApp Cloud API ✅
9. Twilio SMS ✅

**Output & Logging (1/1):**
10. Log Output ✅

**Status:** Complete implementation in `execute-workflow/index.ts`. All nodes tested and working.

### ⚠️ Nodes Requiring Additional Configuration/Implementation

#### 4️⃣ Database Nodes (7 nodes require configuration)
1. **MySQL** - Requires MySQL connection setup in environment variables
2. **MongoDB** - Requires MongoDB connection setup in environment variables
3. **Microsoft SQL Server** - Requires SQL Server connection configuration
4. **SQLite** - Requires SQLite database file path configuration
5. **Redis** - Requires Redis connection configuration (Note: Use Memory node for conversation memory)
6. **Snowflake** - Requires Snowflake account credentials (Account, Username, Password, Warehouse, Database, Schema)
7. **TimescaleDB** - Requires TimescaleDB/PostgreSQL connection configuration

#### 5️⃣ File & Storage Nodes (4 nodes require configuration)
8. **FTP** - Requires FTP server connection (Host, Port, Username, Password) and FTP client library
9. **SFTP** - Requires SFTP server connection (Host, Port, Username, Password, SSH Key) and SFTP client library
10. **AWS S3** - Requires AWS credentials (Access Key, Secret Key, Region, Bucket) and AWS SDK
11. **MinIO** - Requires MinIO server connection (Endpoint, Access Key, Secret Key, Bucket) and S3-compatible client library


### 📝 Important Notes on Database Nodes (4️⃣)

#### Database Node Organization & Usage

**For Supabase/PostgreSQL Operations (Fully Functional ✅):**
- **Database Read** - Use for simple Supabase table read operations ✅
- **Database Write** - Use for simple Supabase table write operations ✅
- **PostgreSQL** - Use for more advanced PostgreSQL operations via Supabase ✅
- **Supabase** - Same as PostgreSQL node (both use Supabase client) ✅

**Note:** `PostgreSQL` and `Supabase` nodes are functionally identical - both use the Supabase client. For clarity, use the **Supabase** node for Supabase database operations.

**For External Databases (Requires Configuration ⚠️):**
- **MySQL** ⚠️ - Requires MySQL connection setup in environment variables
- **MongoDB** ⚠️ - Requires MongoDB connection setup in environment variables
- **Microsoft SQL Server** ⚠️ - Requires SQL Server connection configuration
- **SQLite** ⚠️ - Requires SQLite database file path configuration
- **Redis** ⚠️ - Requires Redis connection configuration (Note: Use **Memory** node for conversation memory)
- **Snowflake** ⚠️ - Requires Snowflake account credentials
- **TimescaleDB** ⚠️ - Requires TimescaleDB/PostgreSQL connection configuration

#### Recommendations

1. **Use Supabase/Database Read/Write nodes** for all Supabase database operations (fully integrated, no setup required)
2. **Use Memory node** instead of Redis node for conversation/chat memory (fully functional)
3. **External database nodes** are placeholders - implement connection logic if external databases are needed

### 📝 Important Notes on File & Storage Nodes (5️⃣)

#### File & Storage Node Organization & Usage

**Fully Functional Storage Options ✅:**
- **Read Binary File** - Read files from local filesystem ✅
- **Write Binary File** - Write files to local filesystem ✅
- **Google Drive** - Read/write/list/delete files in Google Drive ✅
- **Dropbox** - Read/write/list/delete files in Dropbox ✅
- **OneDrive** - Read/write/list/delete files in Microsoft OneDrive ✅
- **Box** - Read/write/list/delete files in Box.com ✅

**Requires External Configuration ⚠️:**
- **FTP** ⚠️ - Requires FTP server connection and client library
- **SFTP** ⚠️ - Requires SFTP server connection and SSH client library
- **AWS S3** ⚠️ - Requires AWS credentials and AWS SDK
- **MinIO** ⚠️ - Requires MinIO server connection and S3-compatible client library

#### Recommendations

1. **Use Google Drive/Dropbox/OneDrive/Box nodes** for cloud storage operations (fully functional with OAuth tokens)
2. **Use Read/Write Binary File nodes** for local filesystem operations (fully functional)
3. **For FTP/SFTP/AWS S3/MinIO**, consider using HTTP Request node with appropriate APIs as an alternative, or configure the required client libraries

## Node Count Summary

- **Trigger Nodes**: 7 nodes (7 fully functional ✅)
- **Core Logic Nodes**: 10 nodes (10 fully functional ✅)
- **Data Manipulation**: 23 nodes (23 fully functional ✅)
- **Database Nodes**: 11 nodes (4 fully functional ✅, 7 with placeholders ⚠️)
- **File & Storage Nodes**: 10 nodes (6 fully functional ✅, 4 with placeholders ⚠️)
- **AI & ML Nodes**: 15 nodes (15 fully functional ✅)
- **HTTP & API**: 3 nodes (3 fully functional ✅)
- **Output/Communication**: 10 nodes (10 fully functional ✅)

**Total**: 89 nodes in library
- **✅ 78 nodes fully functional** - Ready to use, fully implemented, tested, and working
- **⚠️ 11 nodes with placeholders** - Node definitions exist, but require external libraries/drivers:
  - **Database (7)**: MySQL, MongoDB, Redis, MSSQL, SQLite, Snowflake, TimescaleDB - require database driver libraries (use Supabase/PostgreSQL nodes for Supabase database operations)
  - **Storage (4)**: FTP, SFTP, AWS S3, MinIO - require client libraries (use HTTP Request node as alternative or configure external services)

## Usage Example

```typescript
// In WorkflowBuilder.tsx
const onDragStart = useCallback((event: React.DragEvent, nodeType: NodeTypeDefinition) => {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
  event.dataTransfer.effectAllowed = 'move';
}, []);

// Pass to NodeLibrary
<NodeLibrary onDragStart={onDragStart} />
```

## Key Functions

### `getNodesByCategory(category: NodeCategory)`
Filters `NODE_TYPES` by category ID.

### `getNodeDefinition(type: string)`
Finds a node definition by its type identifier.

### `extractValue(expression: string, input: unknown)`
Used by nodes to extract values from input using expressions.

## Best Practices

1. **Consistent Naming**: Use snake_case for node types (e.g., `manual_trigger`)
2. **Clear Descriptions**: Write concise, action-oriented descriptions
3. **Icon Selection**: Choose icons that clearly represent the node's function
4. **Category Placement**: Place nodes in the most logical category
5. **Configuration Fields**: Provide helpful placeholders and help text
6. **Default Values**: Set sensible defaults for all config fields

