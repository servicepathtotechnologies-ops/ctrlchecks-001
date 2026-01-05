# AI Workflow Creation System - Complete Explanation

## Overview

Flow Genius AI uses an **AI-powered autonomous agent system** to automatically generate workflows from natural language descriptions. The system converts user prompts like "Create a workflow that sends email when form is submitted" into complete, executable workflow structures with nodes and connections.

---

## 🤖 Core Technology & API

### Primary AI Model
- **API Provider**: **Google Gemini API**
- **Model Used**: `gemini-2.5-flash` (default)
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- **Authentication**: API Key stored in Supabase Edge Functions secrets (`GEMINI_API_KEY`)

### Key Implementation Files
- **LLM Adapter**: `supabase/functions/generate-workflow/llm-adapter.ts`
- **Autonomous Agent**: `supabase/functions/generate-workflow/autonomous-agent.ts`
- **Main Handler**: `supabase/functions/generate-workflow/index.ts`
- **Training Examples**: `supabase/functions/generate-workflow/training-examples.ts`

---

## 🔄 How AI Workflow Generation Works

### Process Flow

```
User Prompt → Analysis → Planning → Construction → Validation → Generated Workflow
     ↓            ↓          ↓           ↓            ↓              ↓
  Natural    Understand  Break into  Build nodes  Check for    JSON with
  Language   intent      sub-tasks   & edges      errors       nodes/edges
```

### 1. **User Input Processing**
- User provides natural language description (e.g., "Create a workflow that reads Google Sheets and sends email")
- Frontend sends request to `generate-workflow` Edge Function
- System analyzes prompt for keywords and requirements

### 2. **Autonomous Agent Execution** (7-Phase Process)

The system uses an **Autonomous Workflow Agent** that follows these phases:

#### Phase 1: **Understanding & Analysis**
- Analyzes user prompt to extract:
  - Goal/Intent
  - Required nodes
  - Data flow requirements
  - Missing information

#### Phase 2: **Planning (Goal Decomposition)**
- Breaks user goal into sub-tasks
- Plans execution order
- Identifies node dependencies
- Creates execution plan

#### Phase 3: **Workflow Construction**
- **Key Feature**: Uses **training examples** as reference patterns
- Matches user prompt to similar training examples
- Generates workflow structure following learned patterns
- Creates nodes with proper configuration
- Connects nodes with edges

#### Phase 4: **Validation & Simulation**
- Validates all node types exist
- Checks required configuration fields
- Verifies edge connections
- Ensures data flow is correct

#### Phase 5: **Error Handling & Self-Healing**
- Automatically fixes common errors:
  - Missing node IDs → Auto-generates
  - Missing positions → Auto-calculates
  - Invalid node types → Replaces with valid types
  - Orphaned nodes → Auto-wires to trigger

#### Phase 6: **Optimization**
- Removes redundant nodes
- Optimizes data flow
- Ensures efficiency

#### Phase 7: **Final Generation**
- Returns complete workflow JSON
- Includes nodes, edges, configurations
- Ready for execution

---

## 📚 Training System (Not Traditional ML Training)

### Important Note: **No Machine Learning Training**

The system does **NOT** use traditional machine learning training (no model fine-tuning, no neural network training). Instead, it uses:

### **In-Context Learning (Few-Shot Learning)**

The system uses **25 training examples** as reference patterns:

1. **Training Examples File**: `training-examples.ts`
2. **Purpose**: Provides the LLM with examples of successful workflows
3. **How It Works**:
   - Training examples are embedded in the system prompt
   - When generating workflows, the LLM sees these examples
   - The LLM learns patterns from examples through the prompt
   - Similar prompts match to similar training examples

### Training Examples Include:
1. Webhook → Database → Slack Notification
2. Scheduled API Polling → Google Sheets
3. Form Submission → Email Confirmation
4. Chatbot Using Gemini + Memory
5. Error Monitoring → PagerDuty Alert
6. GitHub Issue → Slack Notification
7. API → AI Summarization → Email
8. Conditional Routing Workflows
9. File Upload → Cloud Storage
10. And 15 more examples...

### What Training Examples Teach:
- **Node Selection**: Which nodes to use for common patterns
- **Data Flow Patterns**: How data moves between nodes
- **Configuration Patterns**: Proper node configurations
- **Trigger Selection**: When to use webhook, form, schedule, etc.
- **Integration Patterns**: How to connect different services

### Example Training Pattern:
```typescript
{
  prompt: "Create a workflow that receives user data from a webhook, stores it in a database, and sends a confirmation message to Slack.",
  nodesUsed: ["Webhook", "PostgreSQL", "Slack"],
  dataFlow: "Webhook receives JSON → PostgreSQL stores data → Slack sends notification"
}
```

When a user provides a similar prompt, the agent uses this pattern to generate the workflow.

---

## 🔧 Technical Implementation Details

### API Call Structure

When generating a workflow, the system:

1. **Builds System Prompt** (~4000+ lines) containing:
   - Available node types and descriptions
   - Training examples (25 workflows)
   - Node configuration rules
   - Data flow patterns
   - Validation rules
   - Error prevention guidelines

2. **Calls Gemini API**:
   ```typescript
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
   Headers: {
     Content-Type: application/json
   }
   Body: {
     contents: [conversation messages],
     systemInstruction: {system prompt},
     generationConfig: {
       temperature: 0.3-0.7,
       maxOutputTokens: 8192
     }
   }
   ```

3. **Receives JSON Response**:
   - Gemini returns workflow structure as JSON
   - System validates and fixes errors
   - Returns complete workflow to frontend

### System Prompt Components

The system prompt includes:

1. **Node Library**: All 89+ available node types
2. **Training Examples**: 25 proven workflow patterns
3. **Configuration Rules**: Required fields for each node type
4. **Data Flow Patterns**: Template variable syntax (`{{input.property}}`)
5. **Error Prevention**: Common mistakes to avoid
6. **Validation Rules**: How to ensure workflows work

### Example System Prompt Structure:
```
MASTER SYSTEM PROMPT — GOAL-BASED AI WORKFLOW AGENT

AVAILABLE NODES:
- Triggers: manual_trigger, webhook, schedule, form, chat_trigger...
- AI: openai_gpt, anthropic_claude, google_gemini...
- Logic: if_else, switch, loop, wait...
- Data: javascript, json_parser, csv_processor...
[... hundreds of nodes ...]

TRAINING EXAMPLES (25 PRODUCTION WORKFLOWS):
1. Webhook → Database → Slack
2. Schedule → HTTP Request → Google Sheets
[... 25 examples ...]

CRITICAL RULES:
- Use form trigger for user data collection
- Use webhook for external API calls
- Connect nodes in logical order
[... rules ...]
```

---

## 🎯 Key Features

### 1. **Intelligent Prompt Understanding**
- Parses natural language
- Extracts implicit requirements
- Handles ambiguous requests

### 2. **Pattern Recognition**
- Matches user prompts to training examples
- Uses proven patterns for reliability
- Adapts patterns to user requirements

### 3. **Error Prevention**
- Validates before generation
- Auto-fixes common issues
- Ensures workflows are executable

### 4. **Self-Healing**
- Automatically fixes errors
- Retries with corrections
- Improves output quality

### 5. **Template-Based Optimization**
- Some common workflows (like chat) use templates
- Reduces API calls (0 API calls for simple chat workflows)
- Faster generation for common patterns

---

## 📊 Training Examples vs. Traditional Training

| Aspect | This System | Traditional ML Training |
|--------|------------|------------------------|
| **Training Method** | In-context learning (few-shot) | Fine-tuning on dataset |
| **Model Updates** | None (uses pre-trained Gemini) | Retrain model weights |
| **Data Storage** | 25 examples in code | Thousands of examples in dataset |
| **Learning** | Pattern matching via prompt | Pattern learning via weights |
| **Updates** | Add examples to code | Retrain entire model |
| **Flexibility** | High (easy to add examples) | Low (requires retraining) |

---

## 🔄 Workflow Generation Example

### User Input:
```
"Create a workflow that receives form data with name and email, 
stores it in a database, and sends a confirmation email"
```

### Agent Process:

1. **Analysis**:
   - Identifies: Form trigger, Database write, Email send
   - Matches to Training Example #3 (Form → Email)

2. **Planning**:
   - Form trigger → Database write → Email send
   - Data flow: `input.data.name`, `input.data.email`

3. **Construction**:
   ```json
   {
     "nodes": [
       {"id": "form_1", "type": "form", "config": {...}},
       {"id": "db_1", "type": "database_write", "config": {...}},
       {"id": "email_1", "type": "google_gmail", "config": {...}}
     ],
     "edges": [
       {"source": "form_1", "target": "db_1"},
       {"source": "db_1", "target": "email_1"}
     ]
   }
   ```

4. **Validation**:
   - All node types valid ✓
   - All required fields present ✓
   - Edges connect properly ✓

5. **Output**: Complete workflow JSON

---

## 🚀 Advantages of This Approach

1. **No Training Required**: Uses pre-trained Gemini model
2. **Easy to Update**: Add training examples to improve
3. **Fast Development**: No model training time
4. **Flexible**: Can adapt to new node types quickly
5. **Cost-Effective**: Uses API calls, no training infrastructure
6. **Interpretable**: Training examples are human-readable

---

## 📝 Summary

**How AI Workflow Creation Works:**
1. User provides natural language prompt
2. System builds comprehensive system prompt with training examples
3. Calls Google Gemini API with the prompt
4. Gemini generates workflow JSON structure
5. System validates and fixes errors
6. Returns complete, executable workflow

**Which API is Used:**
- **Google Gemini API** (`gemini-2.5-flash` model)
- Endpoint: `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

**How It's "Trained":**
- **NOT traditional ML training**
- Uses **in-context learning** with 25 training examples
- Examples are embedded in system prompt
- Gemini learns patterns from examples in the prompt
- Similar to few-shot learning

**Training Examples:**
- 25 proven workflow patterns
- Stored in `training-examples.ts`
- Used as reference for workflow generation
- Easy to add more examples for better results

---

## 🔍 Key Files Reference

- **API Integration**: `supabase/functions/generate-workflow/llm-adapter.ts`
- **Agent Logic**: `supabase/functions/generate-workflow/autonomous-agent.ts`
- **Main Handler**: `supabase/functions/generate-workflow/index.ts`
- **Training Data**: `supabase/functions/generate-workflow/training-examples.ts`
- **Validation**: `supabase/functions/generate-workflow/workflow-validation.ts`
- **Frontend**: `src/components/workflow/AutonomousAgentWizard.tsx`

---

## 📚 Complete Node Library Documentation

The Flow Genius AI workflow system includes **89+ nodes** organized into **17 categories**. Each node has specific properties (configuration fields) that can be set when building workflows. This section documents all available nodes with their properties and explanations.

### Node Categories Overview

1. **Trigger Nodes** (8 nodes) - Start workflow execution
2. **Core Logic Nodes** (10 nodes) - Control flow and conditional logic
3. **Data Manipulation Nodes** (23+ nodes) - Transform and manipulate data
4. **Database Nodes** (11 nodes) - Database operations
5. **File & Storage Nodes** (10 nodes) - File operations and cloud storage
6. **AI & ML Nodes** (15 nodes) - AI/ML processing
7. **HTTP & API Nodes** (3 nodes) - HTTP operations
8. **Communication Nodes** (10 nodes) - Send data and communications
9. **Google Nodes** - Google service integrations
10. **DevOps Nodes** - DevOps and infrastructure operations
11. **CRM & Marketing Nodes** - CRM and marketing integrations
12. **Social Media Nodes** - Social media platform integrations
13. **Authentication Nodes** - Authentication and security
14. **Payment Nodes** - Payment processing
15. **E-commerce Nodes** - E-commerce integrations
16. **Analytics Nodes** - Data analytics
17. **Utility Nodes** - Utility and miscellaneous operations

---

## 1. Trigger Nodes Library

**Purpose**: Start workflow execution. These nodes initiate workflows based on various events or conditions.

**Category ID**: `triggers`

**Total Nodes**: 8 nodes

### 1.1 Chat Trigger (`chat_trigger`)

**Description**: Trigger from chat / AI / UI

**Purpose**: Starts a workflow when triggered from a chat interface, AI interaction, or UI component. Used for conversational workflows and interactive applications.

**Properties**: None (no configuration required)

**Usage**: Place at the start of workflows that respond to user chat messages or UI interactions.

---

### 1.2 Error Trigger (`error_trigger`)

**Description**: Automatically fire when any node fails

**Purpose**: Acts as an error handler that triggers when any node in the workflow fails. Useful for error logging, notification, or recovery workflows.

**Properties**: None (no configuration required)

**Usage**: Place at the start of error handling workflows. Automatically receives error information from failed nodes.

---

### 1.3 Interval (`interval`)

**Description**: Run workflow at fixed intervals

**Purpose**: Executes a workflow repeatedly at specified time intervals. Useful for periodic tasks, polling, scheduled maintenance, and recurring operations.

**Properties**:
- **Interval** (required, text): Time interval in seconds (s), minutes (m), or hours (h)
  - Examples: `30s`, `5m`, `1h`
  - Default: `10m`
  - Help Text: "Interval in seconds (s), minutes (m), or hours (h). Examples: 30s, 5m, 1h"

**Usage**: Set the interval format (e.g., `30s` for 30 seconds, `1h` for 1 hour). The workflow will execute at the specified interval continuously.

---

### 1.4 Manual Trigger (`manual_trigger`)

**Description**: Start workflow manually

**Purpose**: Allows manual execution of workflows for testing, debugging, or one-time operations. Users can trigger the workflow on demand from the UI.

**Properties**: None (no configuration required)

**Usage**: Place at the start of workflows that need manual execution. Useful for testing and debugging workflows.

---

### 1.5 Schedule Trigger (`schedule`)

**Description**: Execute workflows on cron schedules

**Purpose**: Executes workflows at specific times based on a schedule. More precise than Interval trigger, allows scheduling at specific times of day.

**Properties**:
- **Time (HH:MM)** (required, time): Time in 24-hour format
  - Format: `HH:MM` (e.g., `09:00` for 9 AM, `14:30` for 2:30 PM)
  - Default: `09:00`
  - Help Text: "Time in 24-hour format (e.g., 09:00 for 9 AM, 14:30 for 2:30 PM)"

- **Timezone** (required, select): Timezone for schedule execution
  - Options:
    - Indian Standard Time (IST) - `Asia/Kolkata`
    - UTC (Coordinated Universal Time) - `UTC`
    - Eastern Time (US) - `America/New_York`
    - Central Time (US) - `America/Chicago`
    - Mountain Time (US) - `America/Denver`
    - Pacific Time (US) - `America/Los_Angeles`
    - London (GMT/BST) - `Europe/London`
    - Paris (CET/CEST) - `Europe/Paris`
    - Berlin (CET/CEST) - `Europe/Berlin`
    - Tokyo (JST) - `Asia/Tokyo`
    - Shanghai (CST) - `Asia/Shanghai`
    - Singapore (SGT) - `Asia/Singapore`
    - Sydney (AEDT/AEST) - `Australia/Sydney`
    - Melbourne (AEDT/AEST) - `Australia/Melbourne`
    - Dubai (GST) - `Asia/Dubai`
    - Mumbai (IST) - `Asia/Kolkata`
    - New Delhi (IST) - `Asia/Kolkata`
    - Bangalore (IST) - `Asia/Kolkata`
  - Default: `Asia/Kolkata`
  - Help Text: "Select your timezone for schedule execution"

**Usage**: Set the time and timezone for when the workflow should execute daily. The workflow runs once per day at the specified time.

---

### 1.6 Webhook (`webhook`)

**Description**: Trigger workflow from HTTP requests

**Purpose**: Receives HTTP requests from external services and triggers the workflow. The webhook URL can be shared with external systems to trigger workflows on events.

**Properties**:
- **Method** (required, select): HTTP method for the webhook
  - Options:
    - GET
    - POST
    - PUT
  - Default: `POST`
  - Required: Yes

**Usage**: 
- Set the HTTP method (GET, POST, or PUT)
- The workflow will receive data from the webhook request
- Access webhook data using `{{input.body}}` for request body, `{{input.query}}` for query parameters
- GET requests: data available in `{{input.query}}`
- POST/PUT requests: data available in `{{input.body}}`

---

### 1.7 Workflow Trigger (`workflow_trigger`)

**Description**: Trigger workflow from another

**Purpose**: Allows one workflow to trigger another workflow. Enables workflow composition and modular workflow design.

**Properties**:
- **Source Workflow ID** (required, text): ID of the workflow that will trigger this workflow
  - Help Text: "ID of the workflow that will trigger this workflow"
  - Required: Yes

**Usage**: 
- Set the Source Workflow ID to the ID of the workflow that should trigger this workflow
- When the source workflow completes, this workflow will be triggered automatically
- Data from the source workflow can be passed to this workflow

---

### 1.8 Form (`form`)

**Description**: Trigger workflow from form submissions (blocks until submission)

**Purpose**: Creates a form that users can fill out. The workflow blocks until the form is submitted, then continues execution with the form data.

**Properties**:
- **Allow Multiple Submissions** (boolean): Allow the same user to submit the form multiple times
  - Default: `true`
  - Required: No
  - Help Text: "Allow the same user to submit the form multiple times"

- **Require Authentication** (boolean): Require users to be authenticated before submitting the form
  - Default: `false`
  - Required: No
  - Help Text: "Require users to be authenticated before submitting the form"

- **Enable CAPTCHA** (boolean): Enable CAPTCHA verification for form submissions
  - Default: `false`
  - Required: No
  - Help Text: "Enable CAPTCHA verification for form submissions"

**Additional Configuration** (configured via UI, not in properties panel):
- Form Title
- Form Description
- Form Fields (array of field definitions)
- Submit Button Text
- Success Message
- Redirect URL
- Wait for Submission (always true for form trigger)

**Usage**: 
- Configure form fields, title, and appearance through the workflow builder UI
- Form data is available in `{{input.data}}` after submission
- The workflow pauses and waits for form submission before continuing
- Form URL is automatically generated and displayed in the properties panel

---

**Trigger Nodes Summary**: 8 nodes for starting workflows via manual triggers, schedules, webhooks, forms, intervals, chat interactions, errors, and workflow chaining.

---

## 2. Core Logic Nodes Library

**Purpose**: Control flow and conditional logic. These nodes manage workflow execution flow, branching, looping, error handling, and data merging.

**Category ID**: `logic`

**Total Nodes**: 10 nodes

### 2.1 Error Handler (`error_handler`)

**Description**: Handle errors gracefully

**Purpose**: Automatically retries failed operations with configurable retry logic. If all retries fail, returns a fallback value instead of stopping the workflow.

**Properties**:
- **Max Retries** (number): Maximum number of retry attempts
  - Default: `3`
  - Help Text: Number of times to retry the operation before giving up

- **Retry Delay (ms)** (number): Delay between retry attempts in milliseconds
  - Default: `1000` (1 second)
  - Help Text: Time to wait between retry attempts

- **Fallback Value** (JSON): Value to return if all retries fail
  - Type: JSON
  - Placeholder: `null`
  - Help Text: This value will be returned if all retry attempts fail

**Usage**: 
- Wrap nodes that might fail (API calls, database operations) with Error Handler
- Set retry count and delay based on the operation's reliability
- Provide a fallback value to prevent workflow failure
- Example: Retry API call 3 times with 2-second delay, return empty object if all fail

---

### 2.2 Filter (`filter`)

**Description**: Filter array items

**Purpose**: Filters an array based on a condition, keeping only items that match the filter criteria. Useful for data processing and conditional data selection.

**Properties**:
- **Array Expression** (required, text): Expression that evaluates to an array
  - Placeholder: `{{input.items}}`
  - Required: Yes
  - Help Text: Expression that returns an array to filter

- **Filter Condition** (required, text): JavaScript condition to filter items
  - Placeholder: `item.active === true`
  - Required: Yes
  - Help Text: Condition that each item must satisfy. Use `item` to reference the current array item.

**Usage**: 
- Set Array Expression to the array you want to filter (e.g., `{{input.users}}`)
- Write a condition using `item` to reference each array element
- Examples:
  - `item.status === 'active'` - Keep only active items
  - `item.age > 18` - Keep only items where age is greater than 18
  - `item.email.includes('@')` - Keep only items with valid email format

---

### 2.3 If/Else (`if_else`)

**Description**: Conditional branching

**Purpose**: Routes workflow execution based on a condition. If the condition is true, execution follows the "true" path; otherwise, it follows the "false" path.

**Properties**:
- **Condition** (required, text): JavaScript expression that evaluates to true or false
  - Placeholder: `{{input.value}} > 10`
  - Required: Yes
  - Help Text: Expression that evaluates to a boolean value

**Usage**: 
- Write a condition that evaluates to true or false
- Connect two output edges: one for true path, one for false path
- Examples:
  - `{{input.count}} > 100` - Check if count is greater than 100
  - `{{input.status}} === 'active'` - Check if status equals 'active'
  - `{{input.user}} && {{input.user.verified}}` - Check if user exists and is verified

---

### 2.4 Loop (`loop`)

**Description**: Iterate over items

**Purpose**: Iterates over an array, executing subsequent nodes for each item. Useful for batch processing, data transformation, and repetitive operations.

**Properties**:
- **Array Expression** (required, text): Expression that evaluates to an array
  - Placeholder: `{{input.items}}`
  - Required: Yes
  - Help Text: Expression that returns an array to iterate over

- **Max Iterations** (number): Maximum number of iterations to prevent infinite loops
  - Default: `100`
  - Help Text: Safety limit to prevent infinite loops

**Usage**: 
- Set Array Expression to the array you want to iterate over
- Nodes connected after the Loop node will execute once for each array item
- Access current item using `{{input.item}}` or `{{item}}` in subsequent nodes
- Access current index using `{{input.index}}` or `{{index}}`
- Set Max Iterations to prevent processing too many items (safety limit)

---

### 2.5 Merge (`merge`)

**Description**: Merge multiple inputs

**Purpose**: Combines data from multiple input paths into a single output. Supports various merge modes for different use cases.

**Properties**:
- **Mode** (select): Merge operation mode
  - Options:
    - **Merge Objects** (`merge`) - Merges object properties from all inputs
    - **Append to Array** (`append`) - Appends all inputs as array elements
    - **Key-based Merge** (`key_based`) - Merges objects based on a common key
    - **Wait All** (`wait_all`) - Waits for all inputs, then merges
    - **Concatenate Arrays** (`concat`) - Concatenates arrays from all inputs
  - Default: `merge`
  - Help Text: Select how to combine the inputs

- **Merge Key** (text): Key field for key-based merge mode
  - Placeholder: `id`
  - Help Text: For key-based merge mode, specify the field name to match objects

**Usage**: 
- **Merge Objects**: Combines properties from multiple objects (e.g., `{a: 1}` + `{b: 2}` = `{a: 1, b: 2}`)
- **Append to Array**: Adds each input as an array element
- **Key-based Merge**: Merges objects that share the same value for the merge key
- **Wait All**: Waits for all connected inputs before proceeding
- **Concatenate Arrays**: Combines arrays from all inputs into one array

---

### 2.6 NoOp (Pass Through) (`noop`)

**Description**: Pass input through unchanged

**Purpose**: A pass-through node that outputs the input unchanged. Useful for debugging, workflow organization, and temporary placeholder nodes.

**Properties**: None (no configuration required)

**Usage**: 
- Place in workflows where you need a node but don't need any transformation
- Useful for debugging to inspect data at specific points
- Can be used as a placeholder during workflow design

---

### 2.7 Split In Batches (`split_in_batches`)

**Description**: Split array into batches

**Purpose**: Divides an array into smaller batches of a specified size. Useful for processing large datasets in chunks, API rate limiting, and batch operations.

**Properties**:
- **Array Expression** (required, text): Expression that evaluates to an array
  - Placeholder: `{{input.items}}`
  - Required: Yes
  - Help Text: Expression that returns an array to split into batches

- **Batch Size** (required, number): Number of items per batch
  - Default: `10`
  - Required: Yes
  - Help Text: Maximum number of items in each batch

**Usage**: 
- Set Array Expression to the array you want to split
- Set Batch Size to the desired number of items per batch
- Subsequent nodes will receive batches instead of the full array
- Each batch is an array containing up to Batch Size items
- Useful for:
  - Processing large datasets in manageable chunks
  - Respecting API rate limits
  - Batch database operations

---

### 2.8 Stop And Error (`stop_and_error`)

**Description**: Stop workflow and trigger error

**Purpose**: Intentionally stops workflow execution and triggers an error. Useful for validation failures, business rule violations, and controlled workflow termination.

**Properties**:
- **Error Message** (required, text): Error message to display
  - Placeholder: `Workflow stopped`
  - Required: Yes
  - Help Text: Message that will be shown when the workflow stops

- **Error Code** (text): Error code identifier
  - Placeholder: `STOPPED`
  - Help Text: Optional error code for programmatic error handling

**Usage**: 
- Use after validation nodes to stop workflow if conditions aren't met
- Set a descriptive error message explaining why the workflow stopped
- Optional error code can be used for error handling logic
- Example: Stop workflow if payment amount exceeds limit with message "Payment amount exceeds maximum limit"

---

### 2.9 Switch (`switch`)

**Description**: Multiple case branching

**Purpose**: Routes workflow execution to different paths based on the value of an expression. Similar to a switch/case statement in programming, allowing multiple conditional branches.

**Properties**:
- **Expression** (required, text): Expression to evaluate
  - Placeholder: `{{input.status}}`
  - Required: Yes
  - Help Text: Expression whose value will be matched against cases

- **Cases (JSON)** (JSON): Array of case definitions
  - Placeholder: `[{"value": "active", "label": "Active"}]`
  - Help Text: Array of case objects with "value" and "label" properties
  - Format: `[{"value": "case1", "label": "Case 1 Label"}, {"value": "case2", "label": "Case 2 Label"}]`

**Usage**: 
- Set Expression to the value you want to match (e.g., `{{input.status}}`)
- Define cases as JSON array with value and label for each case
- Connect output edges for each case (one edge per case)
- Example cases: `[{"value": "active", "label": "Active"}, {"value": "inactive", "label": "Inactive"}, {"value": "pending", "label": "Pending"}]`
- If no case matches, workflow continues without branching

---

### 2.10 Wait/Delay (`wait`)

**Description**: Pause execution

**Purpose**: Pauses workflow execution for a specified duration. Useful for rate limiting, waiting for external processes, and adding delays between operations.

**Properties**:
- **Duration (ms)** (required, number): Delay duration in milliseconds
  - Default: `1000` (1 second)
  - Required: Yes
  - Help Text: Time to wait before continuing workflow execution

**Usage**: 
- Set Duration in milliseconds (1000 = 1 second, 60000 = 1 minute)
- Use for:
  - Rate limiting between API calls
  - Waiting for external processes to complete
  - Adding delays for testing or debugging
  - Preventing too-frequent operations

---

**Core Logic Nodes Summary**: 10 nodes for controlling workflow execution flow, including conditional branching (If/Else, Switch), iteration (Loop), error handling (Error Handler, Stop And Error), data merging (Merge), filtering (Filter), batching (Split In Batches), delays (Wait), and pass-through (NoOp).

---

## 3. Data Manipulation Nodes Library

**Purpose**: Transform and manipulate data. These nodes handle data operations, transformations, code execution, and data format conversions.

**Category ID**: `data`

**Total Nodes**: 16 nodes

### 3.1 Aggregate (`aggregate`)

**Description**: Aggregate operations on arrays

**Purpose**: Performs aggregation operations (sum, average, count, min, max) on array data. Can aggregate a specific field or the items directly. Supports grouping by a field.

**Properties**:
- **Operation** (required, select): Aggregation operation to perform
  - Options:
    - **Sum** (`sum`) - Calculate sum of values
    - **Average** (`avg`) - Calculate average of values
    - **Count** (`count`) - Count number of items
    - **Min** (`min`) - Find minimum value
    - **Max** (`max`) - Find maximum value
  - Default: `sum`
  - Required: Yes

- **Field (optional)** (text): Field name to aggregate
  - Placeholder: `price`
  - Help Text: Field to aggregate (leave empty to aggregate items directly)
  - Example: If array items are `{price: 10, quantity: 2}`, use `price` to sum prices

- **Group By (optional)** (text): Field to group by before aggregating
  - Placeholder: `category`
  - Help Text: Field to group by for grouped aggregation
  - Example: Group by `category` to get sum per category

**Usage**: 
- Set Operation to the desired aggregation function
- If items have a numeric field, specify Field name (e.g., `price`, `quantity`)
- Leave Field empty to aggregate items directly (for arrays of numbers)
- Use Group By to aggregate by category (e.g., sum prices per product category)
- Example: Sum prices: Operation=`sum`, Field=`price`
- Example: Count items: Operation=`count` (Field not needed)

---

### 3.2 CSV Processor (`csv_processor`)

**Description**: Process CSV data

**Purpose**: Parses CSV (Comma-Separated Values) data into structured format. Converts CSV text into arrays or objects based on header rows.

**Properties**:
- **Delimiter** (text): Character used to separate values
  - Default: `,` (comma)
  - Help Text: Delimiter character (e.g., `,` for comma, `;` for semicolon, `\t` for tab)

- **Has Header Row** (boolean): Whether the CSV has a header row
  - Default: `true`
  - Help Text: If true, first row is treated as column names

**Usage**: 
- Set Delimiter to the character separating values (usually `,`)
- Enable Has Header Row if the first line contains column names
- Input should be CSV text (string)
- Output will be array of objects (if header row) or array of arrays (if no header)
- Example: Parse CSV with headers: `Name,Email,Age\nJohn,john@example.com,30`

---

### 3.3 Edit Fields (`edit_fields`)

**Description**: Edit fields with operations

**Purpose**: Performs multiple field operations (set, delete, rename) on objects in a single node. More powerful than Set node for complex transformations.

**Properties**:
- **Operations (JSON)** (required, JSON): Array of field operations
  - Placeholder: `[{"operation": "set", "field": "name", "value": "John"}]`
  - Required: Yes
  - Help Text: Array of operations: set, delete, rename
  - Format: `[{"operation": "set", "field": "fieldName", "value": "newValue"}, {"operation": "delete", "field": "oldField"}, {"operation": "rename", "field": "oldName", "newName": "newName"}]`

**Operations**:
- **set**: Set or update a field value
  - Format: `{"operation": "set", "field": "fieldName", "value": "newValue"}`
- **delete**: Delete a field
  - Format: `{"operation": "delete", "field": "fieldName"}`
- **rename**: Rename a field
  - Format: `{"operation": "rename", "field": "oldName", "newName": "newName"}`

**Usage**: 
- Define operations as JSON array
- Operations execute in order
- Use set to add/update fields, delete to remove fields, rename to change field names
- Value supports template variables (e.g., `{{input.name}}`)
- Example: `[{"operation": "set", "field": "fullName", "value": "{{input.firstName}} {{input.lastName}}"}, {"operation": "delete", "field": "tempField"}, {"operation": "rename", "field": "email", "newName": "emailAddress"}]`

---

### 3.4 Execute Command (`execute_command`)

**Description**: Execute system command

**Purpose**: Executes shell/system commands. **⚠️ WARNING: Disabled by default for security. Use with extreme caution.**

**Properties**:
- **Command** (required, text): System command to execute
  - Placeholder: `echo "Hello"`
  - Required: Yes
  - Help Text: Command to execute in system shell

- **Enable Execution** (boolean): Enable command execution
  - Default: `false`
  - Required: Yes
  - Help Text: ⚠️ WARNING: Command execution is disabled by default for security
  - **⚠️ Security Warning**: Only enable in trusted environments

- **Timeout (ms)** (number): Maximum execution time in milliseconds
  - Default: `30000` (30 seconds)

**Usage**: 
- **⚠️ SECURITY WARNING**: Command execution is disabled by default
- Only enable in secure, trusted environments
- Use for system administration, file operations, or custom scripts
- Set appropriate timeout to prevent hanging
- Prefer JavaScript node for data processing instead
- Example commands: `echo "Hello"`, `ls -la`, `python script.py`

---

### 3.5 Function (`function`)

**Description**: Dataset-level code execution

**Purpose**: Executes JavaScript code at the dataset level. Receives the entire input and data object. Useful for complex data transformations and operations on complete datasets.

**Properties**:
- **Function Code** (required, textarea): JavaScript code to execute
  - Placeholder: `return input;`
  - Required: Yes
  - Help Text: Code receives: input, data
  - Code should return the transformed data

- **Timeout (ms)** (number): Maximum execution time in milliseconds
  - Default: `10000` (10 seconds)

**Usage**: 
- Write JavaScript code that receives `input` and `data` parameters
- Code executes once for the entire dataset
- Return the transformed data
- Use for dataset-level transformations, filtering, mapping
- Example: `return input.map(item => ({...item, processed: true}));`

---

### 3.6 Function Item (`function_item`)

**Description**: Per-item code execution

**Purpose**: Executes JavaScript code for each item in an array. Receives current item, index, and input. Useful for item-level transformations in loops.

**Properties**:
- **Function Code** (required, textarea): JavaScript code to execute per item
  - Placeholder: `return item;`
  - Required: Yes
  - Help Text: Code receives: item, index, input
  - Code should return the transformed item

- **Timeout (ms)** (number): Maximum execution time per item in milliseconds
  - Default: `5000` (5 seconds)

**Usage**: 
- Write JavaScript code that receives `item`, `index`, and `input` parameters
- Code executes once for each array item
- Return the transformed item
- Use for item-level transformations (e.g., formatting, validation, enrichment)
- Example: `return {...item, formattedName: item.name.toUpperCase()};`

---

### 3.7 Item Lists (`item_lists`)

**Description**: Convert object to key-value list

**Purpose**: Converts an object into an array of key-value pairs. Useful for iterating over object properties or transforming objects into lists.

**Properties**: None (no configuration required)

**Usage**: 
- Input: Object (e.g., `{name: "John", age: 30, city: "NYC"}`)
- Output: Array of key-value objects (e.g., `[{key: "name", value: "John"}, {key: "age", value: 30}, {key: "city", value: "NYC"}]`)
- Useful for iterating over object properties
- Example use case: Convert configuration object to list for display or processing

---

### 3.8 JavaScript (`javascript`)

**Description**: Run custom code

**Purpose**: Executes custom JavaScript code for data transformation, validation, and custom logic. Most flexible node for data manipulation.

**Properties**:
- **JavaScript Code** (required, textarea): JavaScript code to execute
  - Placeholder: `return input;`
  - Required: Yes
  - Help Text: Write JavaScript code to transform or process data

- **Timeout (ms)** (number): Maximum execution time in milliseconds
  - Default: `5000` (5 seconds)
  - Help Text: Maximum execution time

**Usage**: 
- Write JavaScript code to process input data
- Code has access to `input` object
- Return the transformed data
- Use for complex transformations, calculations, validations
- Helper functions available: `helpers.getData()`, `helpers.toArray()`, `helpers.toSheetsRows()`, etc.
- Example: `const result = input.items.map(item => item.name); return {names: result};`

---

### 3.9 JSON Parser (`json_parser`)

**Description**: Parse/transform JSON

**Purpose**: Parses and extracts data from JSON using JSONPath expressions. Useful for extracting nested data from complex JSON structures.

**Properties**:
- **JSONPath Expression** (text): JSONPath expression to extract data
  - Placeholder: `$.data.items[*]`
  - Help Text: JSONPath expression for data extraction
  - Examples:
    - `$.data.items[*]` - Extract all items from data.items array
    - `$.users[0].name` - Extract name of first user
    - `$..email` - Extract all email fields recursively

**Usage**: 
- Use JSONPath syntax to extract data from JSON
- Leave empty to parse entire JSON
- JSONPath expressions use `$` for root, `[*]` for array iteration, `.` for object access
- Example: Extract all emails: `$..email`
- Example: Extract first item: `$.items[0]`

---

### 3.10 Limit (`limit`)

**Description**: Limit array size

**Purpose**: Limits the number of items in an array to a specified maximum. Useful for pagination, sampling, and preventing processing of too many items.

**Properties**:
- **Limit** (required, number): Maximum number of items to return
  - Default: `10`
  - Required: Yes
  - Help Text: Maximum number of items to return

**Usage**: 
- Set Limit to the maximum number of items to keep
- Input should be an array
- Output will be array with at most Limit items (first N items)
- Useful for pagination, sampling, or limiting large datasets
- Example: Limit to 10 items from a large array

---

### 3.11 Merge Data (`merge_data`)

**Description**: Combine multiple inputs

**Purpose**: Combines data from multiple input paths into a single output. Similar to Merge logic node but focused on data combination.

**Properties**:
- **Mode** (select): Merge operation mode
  - Options:
    - **Merge Objects** (`merge`) - Merges object properties
    - **Append to Array** (`append`) - Appends inputs as array elements
    - **Concatenate Arrays** (`concat`) - Concatenates arrays
  - Default: `merge`
  - Help Text: Select how to combine the inputs

**Usage**: 
- **Merge Objects**: Combines properties from multiple objects
- **Append to Array**: Adds each input as an array element
- **Concatenate Arrays**: Combines arrays into one array
- Use when multiple nodes need to combine their outputs
- Example: Merge user data from multiple sources into one object

---

### 3.12 Rename Keys (`rename_keys`)

**Description**: Rename object keys

**Purpose**: Renames keys in an object based on a mapping. Useful for standardizing field names, API compatibility, and data normalization.

**Properties**:
- **Key Mappings (JSON)** (required, JSON): Object mapping old keys to new keys
  - Placeholder: `{"oldName": "newName"}`
  - Required: Yes
  - Help Text: JSON object mapping old keys to new keys
  - Format: `{"oldKey1": "newKey1", "oldKey2": "newKey2"}`

**Usage**: 
- Define mappings as JSON object with old key names as keys and new key names as values
- Keys not in mapping remain unchanged
- Useful for API compatibility, data normalization, field renaming
- Example: `{"firstName": "first_name", "lastName": "last_name", "emailAddress": "email"}`

---

### 3.13 Set (`set`)

**Description**: Set field values in object

**Purpose**: Sets or updates field values in objects. Creates new fields or updates existing ones. Supports template variables for dynamic values.

**Properties**:
- **Fields (JSON)** (required, JSON): Object with field names and values
  - Placeholder: `{"name": "{{input.name}}", "age": 25}`
  - Required: Yes
  - Help Text: JSON object with field names and values (supports templates)
  - Format: `{"fieldName": "value", "anotherField": "{{input.field}}"}`

**Usage**: 
- Define fields as JSON object with field names and values
- Values support template variables (e.g., `{{input.name}}`)
- Creates new fields or updates existing ones
- Useful for data enrichment, field addition, value transformation
- Example: `{"fullName": "{{input.firstName}} {{input.lastName}}", "timestamp": "{{$now}}"}`

---

### 3.14 Set Variable (`set_variable`)

**Description**: Store value in variable

**Purpose**: Stores a value in a variable that can be accessed later in the workflow using `{{variables.variableName}}`. Useful for storing intermediate values and sharing data across nodes.

**Properties**:
- **Variable Name** (required, text): Name of the variable
  - Placeholder: `myVariable`
  - Required: Yes
  - Help Text: Variable name (alphanumeric and underscore only)

- **Value** (required, textarea): Value to store
  - Placeholder: `{{input.data}}`
  - Required: Yes
  - Help Text: Value expression or template

**Usage**: 
- Set Variable Name to a unique identifier (e.g., `userId`, `totalAmount`)
- Set Value to the value to store (supports templates)
- Access stored variable in subsequent nodes using `{{variables.variableName}}`
- Variables are workflow-scoped (available to all nodes in the workflow)
- Example: Store user ID from form: Name=`userId`, Value=`{{input.data.userId}}`
- Access later: `{{variables.userId}}`

---

### 3.15 Sort (`sort`)

**Description**: Sort array items

**Purpose**: Sorts an array of items by a field or directly. Supports ascending/descending order and different data types (string, number, date).

**Properties**:
- **Field (optional)** (text): Field name to sort by
  - Placeholder: `name`
  - Help Text: Field to sort by (leave empty to sort items directly)

- **Direction** (select): Sort order
  - Options:
    - **Ascending** (`asc`) - Smallest to largest (A-Z, 1-9)
    - **Descending** (`desc`) - Largest to smallest (Z-A, 9-1)
  - Default: `asc`

- **Type** (select): Data type for sorting
  - Options:
    - **Auto** (`auto`) - Auto-detect type
    - **String** (`string`) - String comparison
    - **Number** (`number`) - Numeric comparison
    - **Date** (`date`) - Date comparison
  - Default: `auto`
  - Help Text: Data type for sorting comparison

**Usage**: 
- Set Field to the property name to sort by (e.g., `price`, `name`, `date`)
- Leave Field empty to sort items directly (for arrays of primitives)
- Choose Direction (ascending or descending)
- Select Type for proper comparison (auto usually works)
- Example: Sort by price descending: Field=`price`, Direction=`desc`, Type=`number`

---

### 3.16 Text Formatter (`text_formatter`)

**Description**: Format text content

**Purpose**: Formats text using templates with variable substitution. Supports template syntax `{{variable}}` for dynamic content. Useful for generating emails, messages, reports, and formatted output.

**Properties**:
- **Template** (required, textarea): Text template with variables
  - Placeholder: `Hello {{name}}!`
  - Required: Yes
  - Help Text: Template text with {{variable}} placeholders

**Usage**: 
- Write template text with `{{variable}}` placeholders
- Variables are replaced with actual values from input
- Supports nested properties: `{{input.user.name}}`
- Useful for email templates, notifications, formatted messages
- Example: `Hello {{input.name}}, your order #{{input.orderId}} has been shipped!`
- Example: `Total: ${{input.total}} ({{input.items.length}} items)`

---

**Data Manipulation Nodes Summary**: 16 nodes for data transformation and manipulation, including field operations (Set, Edit Fields, Rename Keys), array operations (Aggregate, Limit, Sort, Item Lists), code execution (JavaScript, Function, Function Item, Execute Command), data parsing (JSON Parser, CSV Processor), formatting (Text Formatter), and data combination (Merge Data, Set Variable).

---

## 4. Database Nodes Library

**Purpose**: Database operations and queries. These nodes provide access to various database systems for reading, writing, and querying data.

**Category ID**: `database`

**Total Nodes**: 11 nodes

**Note**: Some database nodes (MySQL, MongoDB, Redis, MSSQL, SQLite, Snowflake, TimescaleDB) may require additional database driver libraries. For Supabase projects, use `database_read`, `database_write`, or `supabase` nodes which are fully integrated.

### 4.1 Database Read (`database_read`)

**Description**: Read from database

**Purpose**: Reads data from Supabase database tables. Fully integrated with Supabase and recommended for Supabase projects. Supports filtering, sorting, and limiting results.

**Properties**:
- **Table Name** (required, text): Name of the database table
  - Placeholder: `my_table`
  - Required: Yes
  - Help Text: Name of the table to read from

- **Columns** (text): Column names to select
  - Default: `*` (all columns)
  - Placeholder: `*`
  - Help Text: Comma-separated column names or `*` for all columns
  - Example: `id, name, email` or `*`

- **Filters (JSON)** (JSON): Filter conditions
  - Placeholder: `{"column": "value"}`
  - Help Text: JSON object with column names and values to filter by
  - Format: `{"column1": "value1", "column2": "value2"}`
  - Example: `{"status": "active", "role": "user"}`

- **Limit** (number): Maximum number of rows to return
  - Default: `100`
  - Help Text: Maximum number of rows to return

- **Order By** (text): Column name to sort by
  - Placeholder: `created_at`
  - Help Text: Column name for sorting results

- **Ascending** (boolean): Sort order
  - Default: `false` (descending)
  - Help Text: If true, sort ascending (A-Z, 1-9); if false, sort descending (Z-A, 9-1)

**Usage**: 
- Set Table Name to the table you want to read from
- Use Columns to select specific fields (use `*` for all)
- Use Filters to filter rows (e.g., `{"status": "active"}`)
- Set Limit to control maximum rows returned
- Use Order By and Ascending to sort results
- Returns array of objects with selected columns

---

### 4.2 Database Write (`database_write`)

**Description**: Write to database

**Purpose**: Writes data to Supabase database tables. Supports insert, update, upsert, and delete operations. Fully integrated with Supabase.

**Properties**:
- **Table Name** (required, text): Name of the database table
  - Placeholder: `my_table`
  - Required: Yes
  - Help Text: Name of the table to write to

- **Operation** (select): Database operation to perform
  - Options:
    - **Insert** (`insert`) - Insert new row(s)
    - **Update** (`update`) - Update existing row(s)
    - **Upsert** (`upsert`) - Insert or update (insert if not exists, update if exists)
    - **Delete** (`delete`) - Delete row(s)
  - Default: `insert`
  - Help Text: Type of database operation

- **Data Template** (JSON): Data to write
  - Placeholder: `{"column": "{{input.value}}"}`
  - Help Text: JSON object with column names and values (supports templates)
  - Format: `{"column1": "value1", "column2": "value2"}`
  - Example: `{"name": "{{input.name}}", "email": "{{input.email}}"}`

- **Match Column (for update/upsert)** (text): Column name for matching rows
  - Placeholder: `id`
  - Help Text: Column name used to identify rows for update/upsert operations
  - Example: `id` - matches rows where id equals the value in Data Template

**Usage**: 
- Set Table Name to the target table
- Choose Operation (insert, update, upsert, or delete)
- For Insert: Provide data object with all required columns
- For Update/Upsert: Provide Match Column (e.g., `id`) and data to update
- For Delete: Provide Match Column and value to identify rows to delete
- Data Template supports template variables (e.g., `{{input.name}}`)
- Returns the written/updated/deleted data

---

### 4.3 PostgreSQL (`postgresql`)

**Description**: Query PostgreSQL database

**Purpose**: Advanced PostgreSQL database operations. Supports both structured queries and raw SQL. Useful for complex PostgreSQL-specific queries.

**Properties**:
- **Operation** (required, select): Query operation type
  - Options:
    - **Select** (`select`) - Structured SELECT query
    - **Raw SQL** (`query`) - Execute raw SQL query
  - Default: `select`
  - Required: Yes

- **Table Name** (text): Name of the table (for select operation)
  - Placeholder: `my_table`
  - Help Text: Required for select operation

- **SQL Query** (textarea): Raw SQL query (for raw SQL operation)
  - Placeholder: `SELECT * FROM table WHERE id = 1`
  - Help Text: Required for raw SQL operation
  - Example: `SELECT * FROM users WHERE status = 'active'`

- **Filters (JSON)** (JSON): Filter conditions (for select operation)
  - Placeholder: `{"column": "value"}`
  - Help Text: JSON object with column names and values

- **Limit** (number): Maximum number of rows
  - Default: `100`

- **Order By** (text): Column name to sort by
  - Placeholder: `created_at`

- **Ascending** (boolean): Sort order
  - Default: `true` (ascending)

**Usage**: 
- Use Select operation for structured queries with table name, filters, sorting
- Use Raw SQL operation for complex queries, joins, stored procedures
- For Select: Set Table Name, Filters, Limit, Order By
- For Raw SQL: Write complete SQL query in SQL Query field
- Returns query results as array of objects

---

### 4.4 Supabase (`supabase`)

**Description**: Query Supabase database

**Purpose**: Supabase database operations (recommended for Supabase projects). Similar to PostgreSQL node but optimized for Supabase. Supports structured queries and raw SQL.

**Properties**: Same as PostgreSQL node
- **Operation** (required, select): `select` or `query`
- **Table Name** (text): Required for select operation
- **SQL Query** (textarea): Required for raw SQL operation
- **Filters (JSON)** (JSON): For select operation
- **Limit** (number): Default `100`
- **Order By** (text): Column name
- **Ascending** (boolean): Default `true`

**Usage**: 
- Recommended node for Supabase projects
- Uses Supabase connection automatically (no credentials needed)
- Same usage as PostgreSQL node
- Prefer this node over PostgreSQL for Supabase databases

---

### 4.5 MySQL (`mysql`)

**Description**: Query MySQL database

**Purpose**: MySQL database operations. Supports structured SELECT queries. **⚠️ Note: May require MySQL driver library configuration.**

**Properties**:
- **Operation** (select): Query operation
  - Options:
    - **Select** (`select`) - Structured SELECT query
  - Default: `select`

- **Table Name** (required, text): Name of the table
  - Placeholder: `my_table`
  - Required: Yes

- **Filters (JSON)** (JSON): Filter conditions
  - Placeholder: `{"column": "value"}`

- **Limit** (number): Maximum number of rows
  - Default: `100`

**Usage**: 
- Set Table Name to query
- Use Filters to filter rows
- Set Limit to control results
- **⚠️ Note**: May require MySQL database driver configuration

---

### 4.6 MongoDB (`mongodb`)

**Description**: Query MongoDB database

**Purpose**: MongoDB database operations. Supports Find queries on MongoDB collections. **⚠️ Note: May require MongoDB driver library configuration.**

**Properties**:
- **Operation** (select): MongoDB operation
  - Options:
    - **Find** (`find`) - Find documents in collection
  - Default: `find`

- **Collection Name** (required, text): Name of the MongoDB collection
  - Placeholder: `my_collection`
  - Required: Yes
  - Help Text: Name of the collection to query

- **Query (JSON)** (JSON): MongoDB query filter
  - Placeholder: `{"field": "value"}`
  - Help Text: MongoDB query filter object
  - Example: `{"status": "active", "age": {"$gt": 18}}`

- **Limit** (number): Maximum number of documents
  - Default: `100`

**Usage**: 
- Set Collection Name to the MongoDB collection
- Use Query to filter documents (MongoDB query syntax)
- Set Limit to control results
- Returns array of documents
- **⚠️ Note**: May require MongoDB driver library configuration

---

### 4.7 Redis (`redis`)

**Description**: Redis operations

**Purpose**: Redis cache operations. Supports Get, Set, and Delete operations on Redis keys. **⚠️ Note: May require Redis driver library configuration.**

**Properties**:
- **Operation** (select): Redis operation
  - Options:
    - **Get** (`get`) - Get value by key
    - **Set** (`set`) - Set value for key
    - **Delete** (`delete`) - Delete key
  - Default: `get`

- **Key** (required, text): Redis key
  - Placeholder: `mykey`
  - Required: Yes
  - Help Text: Redis key name

- **Value** (text): Value to store (for set operation)
  - Placeholder: `myvalue`
  - Help Text: Value to store for set operation

- **TTL (seconds)** (number): Time to live in seconds (for set operation)
  - Placeholder: `3600`
  - Help Text: Expiration time in seconds for set operation

**Usage**: 
- Set Operation (get, set, or delete)
- Set Key name
- For Set: Provide Value and optional TTL (expiration)
- For Get: Returns the value for the key
- For Delete: Removes the key
- **⚠️ Note**: May require Redis driver library configuration

---

### 4.8 Microsoft SQL Server (`mssql`)

**Description**: Query SQL Server database

**Purpose**: Microsoft SQL Server database operations. Supports SELECT queries and raw SQL. **⚠️ Note: May require SQL Server driver library configuration.**

**Properties**:
- **Server** (required, text): SQL Server hostname
  - Placeholder: `server.database.windows.net`
  - Required: Yes

- **Database** (required, text): Database name
  - Placeholder: `mydb`
  - Required: Yes

- **Username** (required, text): Database username
  - Placeholder: `username`
  - Required: Yes

- **Password** (required, text): Database password
  - Placeholder: `password`
  - Required: Yes

- **Operation** (select): `select` or `query`
  - Default: `select`

- **Table Name** (text): Required for select operation

- **SQL Query** (textarea): Required for raw SQL operation

- **Filters (JSON)** (JSON): For select operation

- **Limit** (number): Default `100`

**Usage**: 
- Provide Server, Database, Username, Password credentials
- Use Select operation for structured queries
- Use Raw SQL operation for complex queries
- **⚠️ Note**: May require SQL Server driver library configuration

---

### 4.9 SQLite (`sqlite`)

**Description**: Query SQLite database

**Purpose**: SQLite database operations. Supports SELECT queries and raw SQL. **⚠️ Note: May require SQLite driver library configuration.**

**Properties**:
- **Database Path** (required, text): Path to SQLite database file
  - Placeholder: `/path/to/database.db`
  - Required: Yes
  - Help Text: File path to SQLite database

- **Operation** (select): `select` or `query`
  - Default: `select`

- **Table Name** (text): Required for select operation

- **SQL Query** (textarea): Required for raw SQL operation

- **Filters (JSON)** (JSON): For select operation

- **Limit** (number): Default `100`

**Usage**: 
- Set Database Path to SQLite database file path
- Use Select operation for structured queries
- Use Raw SQL operation for custom queries
- **⚠️ Note**: May require SQLite driver library configuration

---

### 4.10 Snowflake (`snowflake`)

**Description**: Query Snowflake warehouse

**Purpose**: Snowflake data warehouse operations. Supports SELECT queries and raw SQL for analytics and data warehousing. **⚠️ Note: May require Snowflake driver library configuration.**

**Properties**:
- **Account** (required, text): Snowflake account identifier
  - Placeholder: `xy12345`
  - Required: Yes
  - Help Text: Snowflake account identifier

- **Username** (required, text): Snowflake username
  - Placeholder: `username`
  - Required: Yes

- **Password** (required, text): Snowflake password
  - Placeholder: `password`
  - Required: Yes

- **Warehouse** (required, text): Snowflake warehouse name
  - Placeholder: `COMPUTE_WH`
  - Required: Yes

- **Database** (required, text): Database name
  - Placeholder: `SNOWFLAKE_SAMPLE_DATA`
  - Required: Yes

- **Schema** (text): Schema name
  - Placeholder: `PUBLIC`
  - Default: `PUBLIC`

- **Operation** (select): `select` or `query`
  - Default: `select`

- **Table Name** (text): Required for select operation

- **SQL Query** (textarea): Required for raw SQL operation

- **Limit** (number): Default `100`

**Usage**: 
- Provide Account, Username, Password, Warehouse, Database, Schema
- Use Select operation for structured queries
- Use Raw SQL operation for complex analytics queries
- **⚠️ Note**: May require Snowflake driver library configuration

---

### 4.11 TimescaleDB (`timescaledb`)

**Description**: Query TimescaleDB

**Purpose**: TimescaleDB time-series database operations. Supports SELECT queries and raw SQL for time-series data. **⚠️ Note: May require TimescaleDB driver library configuration.**

**Properties**:
- **Host** (required, text): Database hostname
  - Placeholder: `localhost`
  - Required: Yes

- **Port** (number): Database port
  - Default: `5432`

- **Database** (required, text): Database name
  - Placeholder: `mydb`
  - Required: Yes

- **Username** (required, text): Database username
  - Placeholder: `postgres`
  - Required: Yes

- **Password** (required, text): Database password
  - Placeholder: `password`
  - Required: Yes

- **Operation** (select): `select` or `query`
  - Default: `select`

- **Table Name** (text): Required for select operation

- **SQL Query** (textarea): Required for raw SQL operation

- **Filters (JSON)** (JSON): For select operation

- **Limit** (number): Default `100`

**Usage**: 
- Provide Host, Port, Database, Username, Password
- Use Select operation for structured queries
- Use Raw SQL operation for time-series specific queries
- Optimized for time-series data operations
- **⚠️ Note**: May require TimescaleDB driver library configuration

---

**Database Nodes Summary**: 11 nodes for database operations across various database systems. Fully functional nodes for Supabase (Database Read, Database Write, Supabase, PostgreSQL). Additional nodes available for MySQL, MongoDB, Redis, Microsoft SQL Server, SQLite, Snowflake, and TimescaleDB (may require driver library configuration). All nodes support structured queries and/or raw SQL operations.

---

## 5. File & Storage Nodes Library

**Purpose**: File operations and cloud storage. These nodes handle file system operations and cloud storage integrations for reading, writing, and managing files.

**Category ID**: `storage`

**Total Nodes**: 9 nodes (Note: Google Drive is in the Google category)

**Note**: Some storage nodes (FTP, SFTP, AWS S3, MinIO) may require additional client libraries. For cloud storage, Google Drive, Dropbox, OneDrive, and Box nodes are fully functional with OAuth tokens.

### 5.1 Read Binary File (`read_binary_file`)

**Description**: Read file from filesystem

**Purpose**: Reads binary or text files from the local filesystem. Useful for reading configuration files, data files, or any file stored on the server.

**Properties**:
- **File Path** (required, text): Path to the file to read
  - Placeholder: `/path/to/file.txt`
  - Required: Yes
  - Help Text: Absolute or relative path to the file
  - Supports template variables (e.g., `{{input.path}}`)

- **Max Size (bytes)** (number): Maximum file size to read
  - Default: `10485760` (10 MB)
  - Help Text: Maximum file size in bytes (10MB default)
  - Prevents reading extremely large files

**Usage**: 
- Set File Path to the file location (supports template variables)
- Set Max Size to limit file size (prevents memory issues)
- Returns file content as base64-encoded string or text
- Use for reading configuration files, data files, or uploaded files
- Example: Read a file: Path=`/tmp/data.json`, Max Size=`10485760`

---

### 5.2 Write Binary File (`write_binary_file`)

**Description**: Write file to filesystem

**Purpose**: Writes binary or text data to a file on the local filesystem. Useful for saving data, generating reports, or creating temporary files.

**Properties**:
- **File Path** (required, text): Path where the file should be written
  - Placeholder: `/path/to/file.txt`
  - Required: Yes
  - Help Text: File path where content will be written
  - Note: In Supabase Edge Functions, paths are normalized to `/tmp/`

- **Content (Base64)** (required, textarea): File content as base64-encoded string
  - Placeholder: `SGVsbG8gV29ybGQ=`
  - Required: Yes
  - Help Text: Base64 encoded content
  - Example: For text "Hello World", use base64: `SGVsbG8gV29ybGQ=`

**Usage**: 
- Set File Path to the destination file location
- Provide Content as base64-encoded string
- Use for saving data, generating files, or creating temporary files
- Content must be base64-encoded
- Returns the file path where the file was written
- Example: Write file: Path=`/tmp/output.txt`, Content=`SGVsbG8gV29ybGQ=`

---

### 5.3 AWS S3 (`aws_s3`)

**Description**: Read/write files to/from AWS S3

**Purpose**: Amazon S3 bucket operations for storing and retrieving files. Supports Get, Put, List, and Delete operations. **⚠️ Note: May require AWS SDK configuration.**

**Properties**:
- **Access Key ID** (required, text): AWS access key ID
  - Placeholder: `AKIA...`
  - Required: Yes
  - Help Text: AWS access key ID

- **Secret Access Key** (required, text): AWS secret access key
  - Placeholder: `Your secret key`
  - Required: Yes
  - Help Text: AWS secret access key

- **Region** (required, text): AWS region
  - Placeholder: `us-east-1`
  - Default: `us-east-1`
  - Required: Yes
  - Help Text: AWS region where the bucket is located

- **Bucket Name** (required, text): S3 bucket name
  - Placeholder: `my-bucket`
  - Required: Yes
  - Help Text: Name of the S3 bucket

- **Operation** (required, select): S3 operation to perform
  - Options:
    - **Get Object** (`get`) - Download file from S3
    - **Put Object** (`put`) - Upload file to S3
    - **List Objects** (`list`) - List files in bucket/folder
    - **Delete Object** (`delete`) - Delete file from S3
  - Default: `get`
  - Required: Yes

- **Object Key (Path)** (text): S3 object key (path)
  - Placeholder: `path/to/file.txt`
  - Help Text: Required for get/put/delete operations
  - Example: `folder/subfolder/file.txt`

- **Content (for Put)** (textarea): File content to upload
  - Placeholder: `File content or base64`
  - Help Text: Required for put operation
  - Can be text or base64-encoded

- **Prefix (for List)** (text): Prefix for listing objects
  - Placeholder: `folder/`
  - Help Text: Optional prefix for list operation
  - Example: `documents/` to list only files in documents folder

**Usage**: 
- Provide AWS credentials (Access Key ID, Secret Access Key)
- Set Region and Bucket Name
- Choose Operation (get, put, list, or delete)
- For Get/Put/Delete: Set Object Key (file path in S3)
- For Put: Provide Content to upload
- For List: Optionally set Prefix to filter objects
- **⚠️ Note**: May require AWS SDK configuration

---

### 5.4 FTP (`ftp`)

**Description**: FTP file operations

**Purpose**: File Transfer Protocol operations for transferring files to/from FTP servers. Supports Get, Put, List, and Delete operations. **⚠️ Note: May require FTP client library configuration.**

**Properties**:
- **Host** (required, text): FTP server hostname
  - Placeholder: `ftp.example.com`
  - Required: Yes
  - Help Text: FTP server hostname or IP address

- **Port** (number): FTP server port
  - Default: `21`
  - Help Text: FTP server port (default: 21)

- **Username** (required, text): FTP username
  - Placeholder: `username`
  - Required: Yes

- **Password** (required, text): FTP password
  - Placeholder: `password`
  - Required: Yes

- **Operation** (required, select): FTP operation
  - Options:
    - **Get File** (`get`) - Download file from FTP server
    - **Put File** (`put`) - Upload file to FTP server
    - **List Files** (`list`) - List files in directory
    - **Delete File** (`delete`) - Delete file from FTP server
  - Default: `get`
  - Required: Yes

- **Remote Path** (required, text): File path on FTP server
  - Placeholder: `/path/to/file.txt`
  - Required: Yes
  - Help Text: Path to file on FTP server

- **Content (for Put)** (textarea): File content to upload
  - Placeholder: `File content`
  - Help Text: Required for put operation

**Usage**: 
- Provide FTP server credentials (Host, Port, Username, Password)
- Choose Operation (get, put, list, or delete)
- Set Remote Path to the file path on the server
- For Put: Provide Content to upload
- **⚠️ Note**: May require FTP client library configuration

---

### 5.5 SFTP (`sftp`)

**Description**: SFTP secure file operations

**Purpose**: Secure File Transfer Protocol (SSH File Transfer Protocol) operations. More secure than FTP, uses SSH encryption. Supports Get, Put, List, and Delete operations. **⚠️ Note: May require SFTP client library configuration.**

**Properties**:
- **Host** (required, text): SFTP server hostname
  - Placeholder: `sftp.example.com`
  - Required: Yes
  - Help Text: SFTP server hostname or IP address

- **Port** (number): SFTP server port
  - Default: `22`
  - Help Text: SFTP server port (default: 22, SSH port)

- **Username** (required, text): SFTP username
  - Placeholder: `username`
  - Required: Yes

- **Password** (text): SFTP password
  - Placeholder: `password`
  - Help Text: Use password or private key for authentication

- **Private Key (SSH)** (textarea): SSH private key for authentication
  - Placeholder: `-----BEGIN RSA PRIVATE KEY-----`
  - Help Text: SSH private key (alternative to password)
  - Use either Password or Private Key (private key is more secure)

- **Operation** (required, select): SFTP operation
  - Options:
    - **Get File** (`get`) - Download file from SFTP server
    - **Put File** (`put`) - Upload file to SFTP server
    - **List Files** (`list`) - List files in directory
    - **Delete File** (`delete`) - Delete file from SFTP server
  - Default: `get`
  - Required: Yes

- **Remote Path** (required, text): File path on SFTP server
  - Placeholder: `/path/to/file.txt`
  - Required: Yes
  - Help Text: Path to file on SFTP server

- **Content (for Put)** (textarea): File content to upload
  - Placeholder: `File content`
  - Help Text: Required for put operation

**Usage**: 
- Provide SFTP server connection details (Host, Port, Username)
- Use Password or Private Key for authentication (private key recommended)
- Choose Operation (get, put, list, or delete)
- Set Remote Path to the file path on the server
- For Put: Provide Content to upload
- **⚠️ Note**: May require SFTP/SSH client library configuration

---

### 5.6 Dropbox (`dropbox`)

**Description**: Read/write files to/from Dropbox

**Purpose**: Dropbox cloud storage operations. Supports Download, Upload, List, and Delete operations. Fully functional with OAuth access tokens.

**Properties**:
- **Access Token** (required, text): Dropbox OAuth access token
  - Placeholder: `Your Dropbox access token`
  - Required: Yes
  - Help Text: How to get Dropbox Access Token: 1) Go to dropbox.com/developers 2) Sign in and go to App Console 3) Create a new app or select existing 4) Go to Permissions tab and set required scopes 5) Go to Settings → OAuth 2 → Generate access token 6) Copy the token 7) Paste it here securely

- **Operation** (required, select): Dropbox operation
  - Options:
    - **Download File** (`read`) - Download file from Dropbox
    - **Upload File** (`upload`) - Upload file to Dropbox
    - **List Files** (`list`) - List files in folder
    - **Delete File** (`delete`) - Delete file from Dropbox
  - Default: `read`
  - Required: Yes

- **File Path** (required, text): Dropbox file path
  - Placeholder: `/path/to/file.txt`
  - Required: Yes
  - Help Text: Dropbox file path (e.g., `/Documents/file.txt`)

- **Content (for Upload)** (textarea): File content to upload
  - Placeholder: `File content`
  - Help Text: Required for upload operation

**Usage**: 
- Get Dropbox access token from dropbox.com/developers
- Set Access Token (keep secure)
- Choose Operation (read, upload, list, or delete)
- Set File Path to the Dropbox file/folder path
- For Upload: Provide Content to upload
- Returns file content (read), file info (upload/list), or success status (delete)
- ✅ Fully functional - no additional configuration needed

---

### 5.7 OneDrive (`onedrive`)

**Description**: Read/write files to/from OneDrive

**Purpose**: Microsoft OneDrive cloud storage operations. Supports Download, Upload, List, and Delete operations. Fully functional with Microsoft Graph API access tokens.

**Properties**:
- **Access Token** (required, text): Microsoft Graph API access token
  - Placeholder: `Your Microsoft access token`
  - Required: Yes
  - Help Text: How to get Microsoft OneDrive Access Token: 1) Go to portal.azure.com 2) Register an app in Azure Active Directory 3) Add Microsoft Graph API permissions (Files.ReadWrite) 4) Use OAuth 2.0 flow to get access token 5) Or use Microsoft Graph Explorer to generate token 6) Copy the token 7) Paste it here securely

- **Operation** (required, select): OneDrive operation
  - Options:
    - **Download File** (`read`) - Download file from OneDrive
    - **Upload File** (`upload`) - Upload file to OneDrive
    - **List Files** (`list`) - List files in folder
    - **Delete File** (`delete`) - Delete file from OneDrive
  - Default: `read`
  - Required: Yes

- **File ID** (text): OneDrive file ID
  - Placeholder: `File ID`
  - Help Text: OneDrive file ID (for read/delete operations)
  - Alternative to File Path

- **File Path** (text): OneDrive file path
  - Placeholder: `/path/to/file.txt`
  - Help Text: OneDrive file path (alternative to file ID)

- **File Name (for Upload)** (text): Name for the uploaded file
  - Placeholder: `document.txt`
  - Help Text: Required for upload operation

- **Content (for Upload)** (textarea): File content to upload
  - Placeholder: `File content`
  - Help Text: Required for upload operation

**Usage**: 
- Get Microsoft Graph API access token from Azure portal
- Set Access Token (keep secure)
- Choose Operation (read, upload, list, or delete)
- For Read/Delete: Use File ID or File Path
- For Upload: Provide File Name and Content
- Returns file content (read), file info (upload/list), or success status (delete)
- ✅ Fully functional - no additional configuration needed

---

### 5.8 Box (`box`)

**Description**: Read/write files to/from Box

**Purpose**: Box.com cloud storage operations. Supports Download, Upload, List, and Delete operations. Fully functional with Box OAuth access tokens.

**Properties**:
- **Access Token** (required, text): Box OAuth access token
  - Placeholder: `Your Box access token`
  - Required: Yes
  - Help Text: How to get Box Access Token: 1) Go to developer.box.com 2) Sign in and create a new app 3) Configure OAuth 2.0 settings 4) Use OAuth 2.0 flow to authorize 5) Get access token from response 6) Copy the token 7) Paste it here securely

- **Operation** (required, select): Box operation
  - Options:
    - **Download File** (`read`) - Download file from Box
    - **Upload File** (`upload`) - Upload file to Box
    - **List Files** (`list`) - List files in folder
    - **Delete File** (`delete`) - Delete file from Box
  - Default: `read`
  - Required: Yes

- **File ID** (text): Box file ID
  - Placeholder: `File ID`
  - Help Text: Box file ID (for read/delete operations)

- **File Name (for Upload)** (text): Name for the uploaded file
  - Placeholder: `document.txt`
  - Help Text: Required for upload operation

- **Content (for Upload)** (textarea): File content to upload
  - Placeholder: `File content`
  - Help Text: Required for upload operation

- **Folder ID** (text): Folder ID for upload/list operations
  - Placeholder: `0`
  - Default: `0`
  - Help Text: Folder ID for upload/list operations (0 = root folder)

**Usage**: 
- Get Box access token from developer.box.com
- Set Access Token (keep secure)
- Choose Operation (read, upload, list, or delete)
- For Read/Delete: Use File ID
- For Upload: Provide File Name, Content, and Folder ID (0 for root)
- For List: Set Folder ID to list files in that folder
- Returns file content (read), file info (upload/list), or success status (delete)
- ✅ Fully functional - no additional configuration needed

---

### 5.9 MinIO (`minio`)

**Description**: Read/write files to/from MinIO

**Purpose**: MinIO object storage operations (S3-compatible). Supports Get, Put, List, and Delete operations. Useful for self-hosted object storage. **⚠️ Note: May require S3-compatible client library configuration.**

**Properties**:
- **Endpoint** (required, text): MinIO server endpoint
  - Placeholder: `localhost:9000`
  - Required: Yes
  - Help Text: MinIO server endpoint (hostname:port)

- **Access Key** (required, text): MinIO access key
  - Placeholder: `minioadmin`
  - Required: Yes
  - Help Text: MinIO access key

- **Secret Key** (required, text): MinIO secret key
  - Placeholder: `minioadmin`
  - Required: Yes
  - Help Text: MinIO secret key

- **Bucket Name** (required, text): MinIO bucket name
  - Placeholder: `my-bucket`
  - Required: Yes
  - Help Text: Name of the MinIO bucket

- **Operation** (required, select): MinIO operation
  - Options:
    - **Get Object** (`get`) - Download object from MinIO
    - **Put Object** (`put`) - Upload object to MinIO
    - **List Objects** (`list`) - List objects in bucket
    - **Delete Object** (`delete`) - Delete object from MinIO
  - Default: `get`
  - Required: Yes

- **Object Key (Path)** (text): Object key (path) in bucket
  - Placeholder: `path/to/file.txt`
  - Help Text: Required for get/put/delete operations

- **Content (for Put)** (textarea): Object content to upload
  - Placeholder: `File content or base64`
  - Help Text: Required for put operation

- **Use SSL** (boolean): Enable SSL/TLS
  - Default: `false`
  - Help Text: Enable SSL/TLS for secure connection

**Usage**: 
- Provide MinIO server credentials (Endpoint, Access Key, Secret Key)
- Set Bucket Name
- Choose Operation (get, put, list, or delete)
- For Get/Put/Delete: Set Object Key (file path in bucket)
- For Put: Provide Content to upload
- Enable Use SSL if MinIO server uses HTTPS
- **⚠️ Note**: May require S3-compatible client library configuration

---

**File & Storage Nodes Summary**: 9 nodes for file operations and cloud storage. Fully functional nodes for local filesystem (Read/Write Binary File) and cloud storage (Dropbox, OneDrive, Box). Additional nodes available for FTP, SFTP, AWS S3, and MinIO (may require client library configuration). Note: Google Drive is in the Google category.

---

## 6. AI & ML Nodes Library

**Purpose**: AI-powered operations and machine learning capabilities. These nodes provide access to various AI models, LLMs, embeddings, vector stores, and AI-powered tools for processing text, generating content, analyzing sentiment, and more.

**Category ID**: `ai`

**Total Nodes**: 15 nodes

**Note**: All AI & ML nodes are fully functional. Most nodes require API keys from their respective providers (OpenAI, Anthropic, Google, etc.).

### 6.1 OpenAI GPT (`openai_gpt`)

**Description**: Process with GPT models

**Purpose**: Uses OpenAI GPT models (GPT-4o, GPT-4o Mini, GPT-4 Turbo) for text generation, conversation, and AI processing. Supports conversation memory for multi-turn conversations.

**Properties**:
- **API Key** (required, text): OpenAI API key
  - Placeholder: `sk-... (required)`
  - Required: Yes
  - Help Text: Get from platform.openai.com/api-keys (starts with `sk-`)

- **Model** (select): GPT model to use
  - Options: GPT-4o, GPT-4o Mini, GPT-4 Turbo
  - Default: `gpt-4o`

- **System Prompt** (required, textarea): System prompt/instructions
  - Placeholder: `You are a helpful assistant...`
  - Required: Yes

- **Temperature** (number): Response randomness (0-2)
  - Default: `0.7`

- **Memory** (number): Conversation turns to remember
  - Default: `10`
  - Help Text: Number of conversation turns to remember (each turn = 1 user + 1 AI message)

**Usage**: Set API Key, choose Model, write System Prompt, adjust Temperature for creativity, set Memory for conversation context.

---

### 6.2 Anthropic Claude (`anthropic_claude`)

**Description**: Process with Claude models

**Purpose**: Uses Anthropic Claude models (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku) for text generation and AI processing. Supports conversation memory.

**Properties**:
- **API Key** (required, text): Anthropic API key (starts with `sk-ant-`)
  - Required: Yes
  - Help Text: Get from console.anthropic.com/settings/keys

- **Model** (select): Claude model
  - Options: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku

- **System Prompt** (required, textarea): System prompt
  - Required: Yes

- **Temperature** (number): Default `0.7`

- **Memory** (number): Default `10`

**Usage**: Similar to OpenAI GPT - set API Key, choose Model, write System Prompt, configure Temperature and Memory.

---

### 6.3 Google Gemini (`google_gemini`)

**Description**: Process with Gemini models

**Purpose**: Uses Google Gemini models (Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite) for text generation and AI processing. Supports conversation memory.

**Properties**:
- **API Key** (required, text): Google API key (starts with `AIza`)
  - Required: Yes
  - Help Text: Get from aistudio.google.com/apikey

- **Model** (select): Gemini model
  - Options: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite

- **System Prompt** (required, textarea): Required

- **Temperature** (number): Default `0.7`

- **Memory** (number): Default `10`

**Usage**: Set API Key, choose Model, write System Prompt, configure Temperature and Memory.

---

### 6.4 Azure OpenAI (`azure_openai`)

**Description**: Process with Azure OpenAI models

**Purpose**: Uses Azure OpenAI Service for GPT models. Requires Azure OpenAI resource with endpoint and deployment name.

**Properties**:
- **Azure Endpoint** (required, text): Azure OpenAI endpoint URL
  - Placeholder: `https://your-resource.openai.azure.com`
  - Required: Yes

- **API Key** (required, text): Azure API key
  - Required: Yes
  - Help Text: Get from Azure portal Keys section

- **Deployment Name** (required, text): Deployment name in Azure
  - Placeholder: `gpt-4`
  - Required: Yes

- **API Version** (text): Default `2024-02-15-preview`

- **System Prompt** (required, textarea): Required

- **Temperature** (number): Default `0.7`

- **Memory** (number): Default `10`

**Usage**: Provide Azure Endpoint, API Key, Deployment Name, write System Prompt, configure Temperature and Memory.

---

### 6.5 Hugging Face (`hugging_face`)

**Description**: Hugging Face Inference API

**Purpose**: Uses Hugging Face models for various AI tasks (text generation, classification, question answering, summarization, translation). Access to thousands of open-source models.

**Properties**:
- **API Key (Hugging Face Token)** (required, text): Hugging Face token (starts with `hf_`)
  - Required: Yes
  - Help Text: Get from huggingface.co/settings/tokens

- **Model ID** (required, text): Hugging Face model ID
  - Placeholder: `gpt2`
  - Required: Yes
  - Example: `gpt2`, `meta-llama/Llama-2-7b-chat-hf`

- **Task** (select): AI task type
  - Options: Text Generation, Text Classification, Question Answering, Summarization, Translation
  - Default: `text-generation`

- **Parameters (JSON)** (JSON): Model parameters
  - Placeholder: `{"max_length": 100, "temperature": 0.7}`

**Usage**: Set API Token, choose Model ID, select Task, optionally configure Parameters.

---

### 6.6 Cohere (`cohere`)

**Description**: Process with Cohere language models

**Purpose**: Uses Cohere language models (Command, Command Light, Command R, Command R+) for text generation and processing.

**Properties**:
- **API Key** (required, text): Cohere API key
  - Required: Yes
  - Help Text: Get from dashboard.cohere.com

- **Model** (select): Cohere model
  - Options: Command, Command Light, Command R, Command R+
  - Default: `command`

- **Prompt** (required, textarea): Prompt text
  - Required: Yes

- **Temperature** (number): Default `0.7`

**Usage**: Set API Key, choose Model, write Prompt, adjust Temperature.

---

### 6.7 Ollama (`ollama`)

**Description**: Run local LLMs via Ollama

**Purpose**: Runs local LLMs using Ollama (self-hosted). Useful for privacy-sensitive applications or when you want to run models locally.

**Properties**:
- **Ollama Server URL** (required, text): Ollama server URL
  - Default: `http://localhost:11434`
  - Required: Yes

- **Model Name** (required, text): Ollama model name
  - Placeholder: `llama2`
  - Default: `llama2`
  - Required: Yes
  - Examples: `llama2`, `mistral`, `codellama`

- **Prompt** (required, textarea): Required

- **Temperature** (number): Default `0.7`

**Usage**: Set Server URL, choose Model Name, write Prompt, adjust Temperature. Requires Ollama server running.

---

### 6.8 Text Summarizer (`text_summarizer`)

**Description**: Summarize text using AI

**Purpose**: Automatically summarizes long text using AI. Useful for condensing articles, documents, or conversations.

**Properties**:
- **API Key** (required, text): OpenAI API key (starts with `sk-`)
  - Required: Yes
  - Help Text: Get from platform.openai.com/api-keys

- **Memory** (number): Conversation turns to remember
  - Default: `10`

**Usage**: Set API Key, input text to summarize, configure Memory. Returns summarized text.

---

### 6.9 Sentiment Analyzer (`sentiment_analyzer`)

**Description**: Analyze text sentiment

**Purpose**: Analyzes text sentiment (positive, negative, neutral) using AI. Useful for social media monitoring, feedback analysis, and customer sentiment tracking.

**Properties**:
- **API Key** (required, text): OpenAI API key (starts with `sk-`)
  - Required: Yes

- **Memory** (number): Default `10`

**Usage**: Set API Key, input text to analyze, configure Memory. Returns sentiment analysis results.

---

### 6.10 Memory (`memory`)

**Description**: Store/retrieve conversation memory

**Purpose**: Stores and retrieves conversation memory for chatbots and AI applications. Supports short-term (Redis), long-term (Vector), or hybrid storage.

**Properties**:
- **Operation** (required, select): Memory operation
  - Options: Store, Retrieve, Clear, Search
  - Required: Yes

- **Memory Type** (select): Storage type
  - Options: Short-term (Redis), Long-term (Vector), Both (Hybrid)
  - Default: `both`

- **TTL (seconds)** (number): Time to live for short-term memory
  - Default: `3600` (1 hour)

- **Max Messages** (number): Maximum messages to retrieve
  - Default: `100`

**Usage**: 
- Store: Save conversation messages to memory
- Retrieve: Get conversation history
- Clear: Clear stored memory
- Search: Search memory by query
- Choose Memory Type (short/long/both), set TTL and Max Messages

---

### 6.11 LLM Chain (`llm_chain`)

**Description**: Chain multiple AI prompts together

**Purpose**: Chains multiple AI prompts in sequence, where each step's output becomes input for the next. Useful for multi-step reasoning and complex workflows.

**Properties**:
- **API Key** (required, text): OpenAI API key
  - Required: Yes

- **Default Model** (select): Default model for steps
  - Options: GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet, Gemini 2.5 Flash
  - Default: `gpt-4o`

- **Chain Steps (JSON)** (required, JSON): Array of chain steps
  - Placeholder: `[{"prompt": "Step 1"}, {"prompt": "Step 2"}]`
  - Required: Yes
  - Format: `[{"prompt": "Step 1 prompt"}, {"prompt": "Step 2 prompt", "model": "optional-model"}]`

**Usage**: Set API Key, choose Default Model, define Chain Steps as JSON array. Each step executes sequentially with previous output as input.

---

### 6.12 AI Agent (`ai_agent`)

**Description**: Autonomous AI agent with tool usage

**Purpose**: Creates an autonomous AI agent that can use tools and make decisions. Supports multiple iterations and tool calling for complex tasks.

**Properties**:
- **API Key** (required, text): API key (OpenAI, Anthropic, or Gemini)
  - Required: Yes

- **Model** (required, select): Agent model
  - Options: GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite, Gemini Pro
  - Default: `gpt-4o`
  - Required: Yes

- **Agent Prompt** (required, textarea): Instructions for the agent
  - Required: Yes

- **Tools (JSON)** (JSON): Available tools for the agent
  - Placeholder: `[{"name": "search", "description": "..."}]`
  - Format: Array of tool definitions with name and description

- **Max Iterations** (number): Maximum reasoning steps
  - Default: `5`

- **Temperature** (number): Default `0.7`

**Usage**: Set API Key, choose Model, write Agent Prompt, define Tools (optional), set Max Iterations, adjust Temperature. Agent autonomously executes tasks using available tools.

---

### 6.13 Chat Model (`chat_model`)

**Description**: Unified LLM provider interface

**Purpose**: Unified interface for multiple LLM providers (OpenAI, Anthropic, Gemini, Azure OpenAI). Switch between providers without changing workflow logic.

**Properties**:
- **Provider** (required, select): LLM provider
  - Options: OpenAI, Anthropic Claude, Google Gemini, Azure OpenAI
  - Default: `openai`
  - Required: Yes

- **API Key** (required, text): Provider API key
  - Required: Yes

- **Model** (required, text): Model name
  - Default: `gpt-4o`
  - Required: Yes

- **Endpoint (Azure only)** (text): Azure endpoint URL
  - Help Text: Required for Azure provider

- **Deployment Name (Azure only)** (text): Azure deployment name
  - Help Text: Required for Azure provider

- **System Prompt** (required, textarea): Required

- **Temperature** (number): Default `0.7`

**Usage**: Choose Provider, set API Key, specify Model, write System Prompt, adjust Temperature. For Azure: also set Endpoint and Deployment Name.

---

### 6.14 Embeddings (`embeddings`)

**Description**: Generate text embeddings/vectors

**Purpose**: Converts text into vector embeddings for semantic search, similarity matching, and vector databases. Supports OpenAI and Google Gemini providers.

**Properties**:
- **Provider** (required, select): Embedding provider
  - Options: OpenAI, Google (Gemini)
  - Default: `openai`
  - Required: Yes

- **API Key** (required, text): Provider API key
  - Required: Yes

- **Model** (text): Embedding model
  - Default: `text-embedding-ada-002`
  - Help Text: OpenAI: text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large

- **Text to Embed** (textarea): Text to convert to embeddings
  - Help Text: Leave empty to use input from previous node

- **Dimensions (OpenAI)** (number): Vector dimensions (for text-embedding-3 models)
  - Help Text: Optional: 256, 512, 1024, etc.

**Usage**: Choose Provider, set API Key, select Model, provide Text (or use input), set Dimensions (for text-embedding-3). Returns vector embeddings.

---

### 6.15 Vector Store (`vector_store`)

**Description**: Store and search vectors (embeddings)

**Purpose**: Stores and searches vector embeddings in vector databases. Supports Pinecone and Supabase (pgvector). Useful for semantic search and RAG applications.

**Properties**:
- **Provider** (required, select): Vector database provider
  - Options: Pinecone, Supabase (pgvector)
  - Default: `pinecone`
  - Required: Yes

- **API Key** (required, text): Provider API key
  - Required: Yes
  - Help Text: Pinecone API key or Supabase project API key

- **Index Name** (required, text): Vector index/database name
  - Placeholder: `my-index`
  - Required: Yes

- **Operation** (required, select): Vector store operation
  - Options: Upsert, Query, Delete
  - Default: `upsert`
  - Required: Yes

- **Vectors (JSON)** (JSON): Vectors to store (for upsert)
  - Placeholder: `[{"id": "1", "values": [...]}]`
  - Help Text: Required for upsert operation

- **Query Vector (JSON)** (JSON): Query vector and parameters (for query)
  - Placeholder: `{"vector": [0.1, 0.2, ...], "topK": 5}`
  - Help Text: Required for query operation

- **IDs (JSON array)** (JSON): Vector IDs to delete (for delete)
  - Placeholder: `["id1", "id2"]`
  - Help Text: Required for delete operation

**Usage**: 
- Upsert: Store vectors with IDs and values
- Query: Search for similar vectors using query vector
- Delete: Remove vectors by ID
- Set Provider, API Key, Index Name, choose Operation, provide operation-specific data

---

**AI & ML Nodes Summary**: 15 nodes for AI and machine learning operations. Includes LLM providers (OpenAI GPT, Anthropic Claude, Google Gemini, Azure OpenAI, Hugging Face, Cohere, Ollama), specialized tools (Text Summarizer, Sentiment Analyzer, AI Agent, LLM Chain, Chat Model), and vector operations (Embeddings, Vector Store, Memory). All nodes are fully functional and require API keys from their respective providers.

---

## 7. HTTP & API Nodes Library

**Purpose**: HTTP requests and API integrations. These nodes handle HTTP operations, GraphQL queries, and webhook responses for integrating with external APIs and services.

**Category ID**: `http_api`

**Total Nodes**: 3 nodes

### 7.1 HTTP Request (`http_request`)

**Description**: Make HTTP API call

**Purpose**: Makes HTTP requests to external APIs. Supports GET, POST, PUT, PATCH, and DELETE methods. Returns API response data directly (not wrapped in a body property).

**Properties**:
- **URL** (required, text): Full API endpoint URL
  - Placeholder: `https://api.example.com/data`
  - Required: Yes
  - Help Text: Complete URL including protocol (http:// or https://)

- **Method** (select): HTTP method
  - Options: GET, POST, PUT, PATCH, DELETE
  - Default: `GET`
  - Help Text: HTTP request method

- **Headers (JSON)** (JSON): Request headers
  - Placeholder: `{"Authorization": "Bearer token"}`
  - Help Text: JSON object with header names and values
  - Example: `{"Authorization": "Bearer token", "Content-Type": "application/json"}`

- **Body (JSON)** (JSON): Request body for POST/PUT/PATCH
  - Placeholder: `{}`
  - Help Text: JSON object for request body (only for POST, PUT, PATCH methods)

- **Timeout (ms)** (number): Request timeout in milliseconds
  - Default: `30000` (30 seconds)
  - Help Text: Maximum time to wait for response

**Usage**: 
- Set URL to the API endpoint
- Choose Method (GET for retrieving data, POST/PUT/PATCH for sending data, DELETE for deleting)
- Add Headers for authentication or custom headers (e.g., Authorization, Content-Type)
- For POST/PUT/PATCH: Provide Body as JSON object
- Set Timeout to prevent hanging requests
- **⚠️ IMPORTANT**: HTTP Request returns data DIRECTLY at the root level, NOT in `input.body`
  - If API returns `{"products": [...]}`, access as `input.products` (NOT `input.body.products`)
  - Use `{{input.field}}` in templates, NOT `{{input.body.field}}`
- Returns API response data directly (for JSON) or `{text: "...", status: 200}` (for non-JSON)

---

### 7.2 GraphQL (`graphql`)

**Description**: Execute GraphQL query

**Purpose**: Executes GraphQL queries and mutations against GraphQL APIs. Supports queries, mutations, variables, and operation names.

**Properties**:
- **GraphQL Endpoint** (required, text): GraphQL API endpoint URL
  - Placeholder: `https://api.example.com/graphql`
  - Required: Yes
  - Help Text: URL of the GraphQL endpoint

- **Query** (required, textarea): GraphQL query or mutation
  - Placeholder: `query { user(id: 1) { name } }`
  - Required: Yes
  - Help Text: GraphQL query/mutation string
  - Example: `query GetUser { user(id: $id) { id name email } }`

- **Operation Name** (text): GraphQL operation name
  - Placeholder: `GetUser`
  - Help Text: Optional operation name for named queries

- **Variables (JSON)** (JSON): GraphQL variables
  - Placeholder: `{"id": 1}`
  - Help Text: JSON object with variables for the query
  - Example: `{"id": 1, "limit": 10}`

- **Headers (JSON)** (JSON): Request headers
  - Placeholder: `{"Authorization": "Bearer token"}`
  - Help Text: Headers for authentication or custom headers

- **Timeout (ms)** (number): Request timeout
  - Default: `30000` (30 seconds)

**Usage**: 
- Set GraphQL Endpoint to the API URL
- Write Query as GraphQL query/mutation syntax
- Set Operation Name if using named operations
- Provide Variables as JSON object for query variables
- Add Headers for authentication (e.g., Authorization header)
- Set Timeout as needed
- Returns GraphQL response data (typically `{data: {...}, errors: [...]}`)

---

### 7.3 Respond to Webhook (`respond_to_webhook`)

**Description**: Send response to webhook caller

**Purpose**: Sends a custom HTTP response to the webhook caller. Used to return custom status codes, response bodies, and headers to the webhook requestor.

**Properties**:
- **Status Code** (required, number): HTTP status code
  - Default: `200`
  - Required: Yes
  - Help Text: HTTP status code (200 = OK, 201 = Created, 400 = Bad Request, 404 = Not Found, 500 = Server Error, etc.)

- **Response Body (JSON)** (JSON): Response data
  - Placeholder: `{"message": "success"}`
  - Help Text: JSON object for response body
  - Example: `{"status": "success", "data": {...}}`

- **Custom Headers (JSON)** (JSON): Additional response headers
  - Placeholder: `{"Content-Type": "application/json"}`
  - Help Text: Custom headers to include in response
  - Example: `{"Content-Type": "application/json", "X-Custom-Header": "value"}`

**Usage**: 
- Set Status Code to the desired HTTP status code
- Provide Response Body as JSON object (will be serialized to JSON)
- Add Custom Headers if needed (Content-Type is usually set automatically)
- Use at the end of webhook-triggered workflows to send responses
- Returns the response to the webhook caller
- If not used, webhook returns default 200 OK with empty body

---

**HTTP & API Nodes Summary**: 3 nodes for HTTP operations and API integrations. HTTP Request for general API calls (returns data directly, not in body property), GraphQL for GraphQL queries/mutations, and Respond to Webhook for custom webhook responses. All nodes support custom headers, authentication, and timeouts.

---

## 8. Communication Nodes Library

**Purpose**: Output data and send communications. These nodes handle sending messages, notifications, and data to various communication platforms and services.

**Category ID**: `output`

**Total Nodes**: 9 nodes

**Note**: Email sending is handled by Google Gmail node in the Google category, not in the Communication category.

### 8.1 HTTP POST (`http_post`)

**Description**: Send HTTP POST request

**Purpose**: Sends HTTP POST requests to external webhooks or APIs. Useful for triggering external services, sending data to webhooks, and API integrations.

**Properties**:
- **URL** (required, text): Target URL for POST request
  - Placeholder: `https://api.example.com/webhook`
  - Required: Yes
  - Help Text: Complete URL including protocol

- **Headers (JSON)** (JSON): Request headers
  - Placeholder: `{}`
  - Help Text: JSON object with header names and values
  - Example: `{"Authorization": "Bearer token", "Content-Type": "application/json"}`

- **Body Template** (textarea): Request body template
  - Placeholder: `{"data": "{{input}}"}`
  - Help Text: Body content with template variables
  - Supports template syntax (e.g., `{{input.field}}`)

**Usage**: 
- Set URL to the target endpoint
- Add Headers for authentication or custom headers
- Provide Body Template with template variables
- Use for triggering webhooks, sending data to APIs, or external service integrations
- Returns response from the API

---

### 8.2 Slack Message (`slack_message`)

**Description**: Send Slack notification

**Purpose**: Sends rich-formatted messages to Slack channels using webhooks. Supports custom bot names, emojis, and Slack Blocks for rich formatting.

**Properties**:
- **Webhook URL** (required, text): Slack webhook URL
  - Placeholder: `https://hooks.slack.com/services/...`
  - Required: Yes
  - Help Text: Get from Slack App → Incoming Webhooks

- **Channel (optional)** (text): Slack channel
  - Placeholder: `#general`
  - Help Text: Channel name (optional, defaults to webhook channel)

- **Bot Name** (text): Bot display name
  - Default: `CtrlChecks Bot`
  - Placeholder: `Workflow Bot`

- **Icon Emoji** (text): Bot icon emoji
  - Default: `:zap:`
  - Placeholder: `:robot_face:`
  - Help Text: Emoji code (e.g., `:zap:`, `:robot_face:`)

- **Message** (required, textarea): Message text
  - Placeholder: `Workflow completed successfully!`
  - Required: Yes
  - Supports template variables (e.g., `{{input.field}}`)

- **Blocks (JSON, optional)** (JSON): Slack Blocks for rich formatting
  - Placeholder: `[]`
  - Help Text: Slack Blocks JSON array for rich formatting (buttons, images, sections, etc.)

**Usage**: 
- Get Webhook URL from Slack App → Incoming Webhooks
- Set Webhook URL (keep secure)
- Optionally set Channel, Bot Name, Icon Emoji
- Write Message with template variables (e.g., `{{input.body.name}}`)
- Optionally add Blocks for rich formatting
- Use for notifications, alerts, and workflow status updates
- Returns success status

---

### 8.3 Slack Incoming Webhook (`slack_webhook`)

**Description**: Simple Slack webhook

**Purpose**: Sends simple text messages to Slack using incoming webhooks. Simpler than Slack Message node, good for basic notifications.

**Properties**:
- **Webhook URL** (required, text): Slack webhook URL
  - Placeholder: `https://hooks.slack.com/services/...`
  - Required: Yes
  - Help Text: Get from Slack App → Incoming Webhooks

- **Message Text** (required, textarea): Message content
  - Placeholder: `Hello from CtrlChecks!`
  - Required: Yes
  - Supports template variables (e.g., `{{input.body.email}}`, `{{input.data.name}}`)

**Usage**: 
- Get Webhook URL from Slack App → Incoming Webhooks
- Set Webhook URL (keep secure)
- Write Message Text with template variables
- Use for simple notifications without formatting
- **⚠️ IMPORTANT**: Use `{{input.body.field}}` for webhook data, `{{input.data.field}}` for form data
- Example: `New submission:\nName: {{input.body.name}}\nEmail: {{input.body.email}}`
- Returns success status

---

### 8.4 Discord Webhook (`discord_webhook`)

**Description**: Send Discord message

**Purpose**: Sends messages to Discord channels using webhooks. Supports custom usernames and avatar URLs.

**Properties**:
- **Webhook URL** (required, text): Discord webhook URL
  - Placeholder: `https://discord.com/api/webhooks/...`
  - Required: Yes
  - Help Text: Get from Discord channel → Integrations → Webhooks

- **Message** (required, textarea): Message content
  - Placeholder: `Hello from CtrlChecks!`
  - Required: Yes
  - Supports template variables

- **Username** (text): Bot username
  - Placeholder: `CtrlChecks Bot`
  - Help Text: Display name for the bot

- **Avatar URL** (text): Avatar image URL
  - Placeholder: `https://example.com/avatar.png`
  - Help Text: URL to avatar image for the bot

**Usage**: 
- Get Webhook URL from Discord channel → Integrations → Webhooks → New Webhook
- Set Webhook URL (keep secure)
- Write Message with template variables
- Optionally set Username and Avatar URL
- Use for notifications and alerts in Discord
- Returns success status

---

### 8.5 Microsoft Teams (`microsoft_teams`)

**Description**: Send message to Microsoft Teams

**Purpose**: Sends messages to Microsoft Teams channels using incoming webhooks. Useful for enterprise notifications.

**Properties**:
- **Webhook URL** (required, text): Teams webhook URL
  - Placeholder: `https://outlook.office.com/webhook/...`
  - Required: Yes
  - Help Text: Get from Teams channel Connectors → Incoming Webhook

- **Title** (text): Message title
  - Default: `Workflow Notification`
  - Placeholder: `Workflow Notification`

- **Message** (required, textarea): Message content
  - Placeholder: `Your workflow completed successfully!`
  - Required: Yes
  - Supports template variables

**Usage**: 
- Get Webhook URL from Teams channel → Connectors → Incoming Webhook
- Set Webhook URL (keep secure)
- Set Title for the message
- Write Message with template variables
- Use for enterprise notifications and workflow alerts
- Returns success status

---

### 8.6 Telegram (`telegram`)

**Description**: Send message via Telegram Bot

**Purpose**: Sends messages via Telegram Bot API. Supports direct messages to users or messages to groups.

**Properties**:
- **Bot Token** (required, text): Telegram bot token
  - Placeholder: `123456:ABC-DEF...`
  - Required: Yes
  - Help Text: Get from @BotFather on Telegram
  - Steps: 1) Message @BotFather on Telegram 2) Use /newbot command 3) Follow instructions 4) Copy the bot token

- **Chat ID** (required, text): User or group chat ID
  - Placeholder: `123456789`
  - Required: Yes
  - Help Text: User or group chat ID (get from @userinfobot or bot API)

- **Message** (required, textarea): Message text
  - Placeholder: `Hello from CtrlChecks!`
  - Required: Yes
  - Supports template variables

**Usage**: 
- Create bot with @BotFather on Telegram and get Bot Token
- Get Chat ID from @userinfobot or bot API
- Set Bot Token and Chat ID (keep secure)
- Write Message with template variables
- Use for personal notifications or group alerts
- Returns success status

---

### 8.7 WhatsApp Cloud API (`whatsapp_cloud`)

**Description**: Send WhatsApp Business message

**Purpose**: Sends messages via WhatsApp Business Cloud API. Requires Meta App and WhatsApp Business API setup.

**Properties**:
- **Phone Number ID** (required, text): WhatsApp phone number ID
  - Placeholder: `123456789012345`
  - Required: Yes
  - Help Text: How to get Phone Number ID: 1) Go to developers.facebook.com 2) Create or select a Meta App 3) Go to WhatsApp Business API 4) Find your Phone Number ID in the app dashboard 5) Copy and paste it here

- **Access Token** (required, text): WhatsApp access token
  - Placeholder: `EAAG...`
  - Required: Yes
  - Help Text: How to get WhatsApp Access Token: 1) Go to developers.facebook.com 2) Create or select a Meta App 3) Add WhatsApp product to your app 4) Go to WhatsApp → API Setup 5) Generate a temporary token or use a permanent token from Business Manager 6) Copy the token (starts with EAAG) 7) Paste it here securely

- **Recipient Number** (required, text): Recipient phone number
  - Placeholder: `1234567890`
  - Required: Yes
  - Help Text: With country code, no + (e.g., `1234567890` not `+1234567890`)

- **Message** (required, textarea): Message text
  - Placeholder: `Hello from CtrlChecks!`
  - Required: Yes
  - Supports template variables

**Usage**: 
- Set up Meta App and WhatsApp Business API
- Get Phone Number ID and Access Token from Meta Developer Console
- Set Phone Number ID and Access Token (keep secure)
- Provide Recipient Number (with country code, no +)
- Write Message with template variables
- Use for business messaging and customer notifications
- Returns success status

---

### 8.8 Twilio SMS (`twilio`)

**Description**: Send SMS via Twilio

**Purpose**: Sends SMS messages via Twilio. Requires Twilio account with phone number.

**Properties**:
- **Account SID** (required, text): Twilio account SID
  - Placeholder: `AC...`
  - Required: Yes
  - Help Text: How to get Twilio Account SID: 1) Go to console.twilio.com 2) Sign in or create an account 3) Your Account SID is displayed on the dashboard (starts with AC) 4) Copy and paste it here

- **Auth Token** (required, text): Twilio auth token
  - Placeholder: `...`
  - Required: Yes
  - Help Text: How to get Twilio Auth Token: 1) In Twilio Console dashboard 2) Your Auth Token is displayed (click "show" to reveal) 3) Copy the token immediately - you won't see it again! 4) Paste it here securely

- **From Number** (required, text): Twilio phone number
  - Placeholder: `+1234567890`
  - Required: Yes
  - Help Text: Your Twilio phone number (with + and country code)

- **To Number** (required, text): Recipient phone number
  - Placeholder: `+1234567890`
  - Required: Yes
  - Help Text: Recipient phone number (with + and country code)

- **Message** (required, textarea): SMS text
  - Placeholder: `Hello from CtrlChecks!`
  - Required: Yes
  - Supports template variables

**Usage**: 
- Create Twilio account and get phone number
- Get Account SID and Auth Token from Twilio Console
- Set Account SID and Auth Token (keep secure)
- Provide From Number (your Twilio number) and To Number (recipient)
- Write Message with template variables
- Use for SMS notifications and alerts
- Returns success status

---

### 8.9 Log Output (`log_output`)

**Description**: Log data for debugging

**Purpose**: Logs data to workflow execution logs for debugging and monitoring. Supports different log levels.

**Properties**:
- **Log Message** (required, textarea): Message to log
  - Placeholder: `Debug: {{input}}`
  - Required: Yes
  - Supports template variables (e.g., `{{input.field}}`)

- **Log Level** (select): Log severity level
  - Options:
    - **Info** (`info`) - Informational messages
    - **Warning** (`warn`) - Warning messages
    - **Error** (`error`) - Error messages
    - **Debug** (`debug`) - Debug messages
  - Default: `info`
  - Help Text: Log level for filtering and monitoring

**Usage**: 
- Write Log Message with template variables
- Choose Log Level (info, warn, error, debug)
- Use for debugging workflows, monitoring execution, and logging intermediate values
- Logs appear in workflow execution logs
- Returns logged data

---

**Communication Nodes Summary**: 9 nodes for sending communications and outputting data. Includes messaging platforms (Slack, Discord, Microsoft Teams, Telegram, WhatsApp, Twilio), HTTP POST for webhooks, and Log Output for debugging. All nodes support template variables for dynamic content. Note: Email sending is handled by Google Gmail node in the Google category.

---

## 9. Google Nodes Library

**Purpose**: Google Workspace and Cloud integrations. These nodes provide access to Google services including Gmail, Sheets, Drive, Calendar, Contacts, Docs, Tasks, and BigQuery.

**Category ID**: `google`

**Total Nodes**: 8 nodes

**Note**: All Google nodes require OAuth2 authentication. Users must authenticate with their Google account before using these nodes. Authentication is handled through the platform's OAuth integration.

### 9.1 Google Gmail (`google_gmail`)

**Description**: Send/search Gmail

**Purpose**: Sends and searches Gmail messages. Supports sending emails, listing messages, getting specific messages, and searching emails using Gmail search syntax.

**Properties**:
- **Operation** (required, select): Gmail operation
  - Options: Send Email, List Messages, Get Message, Search Messages
  - Default: `send`
  - Required: Yes

- **To** (text): Recipient email address
  - Placeholder: `recipient@example.com`
  - Help Text: Required for send operation
  - Supports template variables (e.g., `{{input.body.email}}`)

- **Subject** (text): Email subject
  - Placeholder: `Email Subject`
  - Help Text: Required for send operation
  - Supports template variables

- **Body** (textarea): Email body content
  - Placeholder: `Email body content...`
  - Help Text: Required for send operation
  - Supports HTML and template variables (e.g., `{{input.content}}` for Google Doc content)

- **Message ID** (text): Gmail message ID
  - Placeholder: `abc123def456`
  - Help Text: Required for get operation

- **Search Query** (text): Gmail search query
  - Placeholder: `from:example@gmail.com`
  - Help Text: Gmail search query for list/search operations
  - Search syntax: `from:email`, `subject:text`, `is:unread`, `has:attachment`, etc.

- **Max Results** (number): Maximum number of messages to return
  - Default: `10`
  - Help Text: Maximum number of messages to return for list/search operations

**Usage**: 
- **Send Email**: Set Operation to "Send Email", provide To, Subject, and Body. Use template variables for dynamic content (e.g., `{{input.body.email}}`, `{{input.content}}`).
- **List Messages**: Set Operation to "List Messages", optionally set Search Query, set Max Results. Returns array of messages.
- **Get Message**: Set Operation to "Get Message", provide Message ID. Returns message details.
- **Search Messages**: Set Operation to "Search Messages", provide Search Query, set Max Results. Returns matching messages.
- Returns message data or success status

---

### 9.2 Google Sheets (`google_sheets`)

**Description**: Read/write Google Sheets

**Purpose**: Reads and writes data to Google Sheets spreadsheets. Supports reading data, writing data, appending rows, and updating ranges.

**Properties**:
- **Operation** (required, select): Sheets operation
  - Options: Read, Write, Append, Update
  - Default: `read`
  - Required: Yes

- **Spreadsheet ID** (required, text): Google Sheets spreadsheet ID
  - Placeholder: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
  - Required: Yes
  - Help Text: The ID from the Google Sheets URL (the long string between /d/ and /edit)
  - Example: From URL `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`, the ID is `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

- **Sheet Name (Tab)** (text): Sheet/tab name
  - Placeholder: `Sheet1`
  - Help Text: Leave empty to use the first sheet

- **Range (e.g., A1:D100)** (text): Cell range
  - Placeholder: `A1:D100`
  - Help Text: Leave empty to read all used cells. For write/update, specify the target range.

- **Output Format** (select): Data format for read operation
  - Options: JSON Array, Key-Value Pairs, Plain Text Table
  - Default: `json`
  - Help Text: How to format the extracted data

- **Read Direction** (select): Data reading direction
  - Options: Row-wise (default), Column-wise
  - Default: `rows`
  - Help Text: How to read the data

- **Allow Write Access** (boolean): Enable write operations
  - Default: `false`
  - Help Text: ⚠️ Admin only: Enable write/update operations

- **Data** (textarea/JSON): Data to write/append/update
  - Help Text: Required for write/append/update operations. Use JSON array format. Leave empty to use input from previous node (e.g., from JavaScript node with `{values: [[...], [...]]}`).

**Usage**: 
- **Read**: Set Operation to "Read", provide Spreadsheet ID, optionally set Sheet Name and Range, choose Output Format. Returns `{data: [[headers], [row1], [row2], ...], rows: N, columns: [...]}`. Use JavaScript to parse array-of-arrays format.
- **Write**: Set Operation to "Write", provide Spreadsheet ID, Sheet Name, Range, and Data (JSON array or leave empty to use `input.values` from JavaScript). Overwrites cells in the range.
- **Append**: Set Operation to "Append", provide Spreadsheet ID, Sheet Name, and Data (or leave empty to use `input.values` from JavaScript). Adds new rows to the end of the sheet. **⚠️ IMPORTANT**: Use append (not write) when user says "append", "add to", "store in", "save to".
- **Update**: Set Operation to "Update", provide Spreadsheet ID, Sheet Name, Range, and Data. Updates cells in the range.
- **Data Format for Write/Append/Update**: JavaScript node should return `{values: [[row1], [row2], ...]}` (2D array). Google Sheets automatically extracts `input.values`, `input.data`, or `input.rows`. Leave Data field empty to use input from previous node.
- **⚠️ CRITICAL**: Read operation returns data in array-of-arrays format (`[[headers], [row1], ...]`). Use JavaScript to parse: `const headers = input.data[0]; const rows = input.data.slice(1);`

---

### 9.3 Google Drive (`google_drive`)

**Description**: Manage Drive files

**Purpose**: Lists, uploads, downloads, and deletes files in Google Drive. Supports file operations and folder navigation.

**Properties**:
- **Operation** (required, select): Drive operation
  - Options: List Files, Upload File, Download File, Delete File
  - Default: `list`
  - Required: Yes

- **Folder ID** (text): Google Drive folder ID
  - Placeholder: `1a2b3c4d5e6f7g8h9i0j`
  - Help Text: Folder ID for list operation. Leave empty for root folder.
  - Get from URL: `/folder/d/FOLDER_ID/view` or `/file/d/FILE_ID/view`

- **File ID** (text): Google Drive file ID
  - Placeholder: `1a2b3c4d5e6f7g8h9i0j`
  - Help Text: File ID for download/delete operations
  - Get from URL: `/file/d/FILE_ID/view`

- **File Name** (text): File name for upload
  - Placeholder: `document.pdf`
  - Help Text: Required for upload operation

- **File Content (Base64)** (textarea): Base64 encoded file content
  - Placeholder: `Base64 encoded content...`
  - Help Text: Required for upload operation. File content must be Base64 encoded.

**Usage**: 
- **List Files**: Set Operation to "List Files", optionally set Folder ID (empty for root). Returns array of files with metadata.
- **Upload File**: Set Operation to "Upload File", provide File Name and File Content (Base64 encoded). Optionally set Folder ID to upload to specific folder. Returns file metadata.
- **Download File**: Set Operation to "Download File", provide File ID. Returns file content (Base64 encoded).
- **Delete File**: Set Operation to "Delete File", provide File ID. Returns success status.

---

### 9.4 Google Calendar (`google_calendar`)

**Description**: Manage calendar events

**Purpose**: Lists, creates, updates, and deletes calendar events in Google Calendar. Supports event management and scheduling.

**Properties**:
- **Operation** (required, select): Calendar operation
  - Options: List Events, Create Event, Update Event, Delete Event
  - Default: `list`
  - Required: Yes

- **Calendar ID** (text): Google Calendar ID
  - Placeholder: `primary`
  - Default: `primary`
  - Help Text: Calendar ID. Use "primary" for main calendar.

- **Event ID** (text): Calendar event ID
  - Placeholder: `abc123def456`
  - Help Text: Required for update/delete operations

- **Event Title** (text): Event title/summary
  - Placeholder: `Meeting with Team`
  - Help Text: Required for create/update operations
  - Supports template variables

- **Start Time (ISO 8601)** (text): Event start time
  - Placeholder: `2024-01-15T10:00:00Z`
  - Help Text: Required for create/update. Format: YYYY-MM-DDTHH:mm:ssZ (UTC)
  - Example: `2024-01-15T10:00:00Z` (UTC) or `2024-01-15T14:00:00+04:00` (with timezone)

- **End Time (ISO 8601)** (text): Event end time
  - Placeholder: `2024-01-15T11:00:00Z`
  - Help Text: Required for create/update. Format: YYYY-MM-DDTHH:mm:ssZ (UTC)
  - Example: `2024-01-15T11:00:00Z` (UTC)

**Usage**: 
- **List Events**: Set Operation to "List Events", optionally set Calendar ID (default: "primary"). Returns array of events.
- **Create Event**: Set Operation to "Create Event", provide Event Title, Start Time, and End Time (ISO 8601 format). Optionally set Calendar ID. Returns event data with Event ID.
- **Update Event**: Set Operation to "Update Event", provide Event ID, Event Title, Start Time, and End Time. Returns updated event data.
- **Delete Event**: Set Operation to "Delete Event", provide Event ID. Returns success status.
- **⚠️ IMPORTANT**: Times must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ for UTC, or with timezone offset).

---

### 9.5 Google Contacts (`google_contacts`)

**Description**: Manage contacts

**Purpose**: Lists, creates, updates, and deletes contacts in Google Contacts. Supports contact management and synchronization.

**Properties**:
- **Operation** (required, select): Contacts operation
  - Options: List Contacts, Create Contact, Update Contact, Delete Contact
  - Default: `list`
  - Required: Yes

- **Contact ID** (text): Google Contacts contact ID (resourceName)
  - Placeholder: `c1234567890`
  - Help Text: Required for update/delete operations. Contact ID is the resourceName field (e.g., `people/c1234567890`).

- **Name** (text): Contact name
  - Placeholder: `John Doe`
  - Help Text: Required for create/update operations

- **Email** (text): Contact email address
  - Placeholder: `john@example.com`
  - Help Text: Required for create/update operations

- **Phone** (text): Contact phone number
  - Placeholder: `+1234567890`
  - Help Text: Include country code (e.g., `+1234567890`)

- **Max Results** (number): Maximum number of contacts to return
  - Default: `100`
  - Help Text: Maximum number of contacts to return for list operation

**Usage**: 
- **List Contacts**: Set Operation to "List Contacts", optionally set Max Results. Returns array of contacts.
- **Create Contact**: Set Operation to "Create Contact", provide Name and Email (required), optionally set Phone. Returns contact data with Contact ID (resourceName).
- **Update Contact**: Set Operation to "Update Contact", provide Contact ID (resourceName), Name, and Email. Optionally set Phone. Returns updated contact data.
- **Delete Contact**: Set Operation to "Delete Contact", provide Contact ID (resourceName). Returns success status.
- **⚠️ IMPORTANT**: Contact ID is the resourceName field (format: `people/c1234567890`). Use the full resourceName or just the ID part.

---

### 9.6 Google Doc (`google_doc`)

**Description**: Read/create/update Docs

**Purpose**: Reads, creates, and updates Google Docs documents. Supports text extraction, document creation, and content updates.

**Properties**:
- **Operation** (required, select): Docs operation
  - Options: Read, Create, Update
  - Default: `read`
  - Required: Yes

- **Document ID or URL** (text): Google Docs document ID or full URL
  - Placeholder: `Doc URL or ID`
  - Help Text: Paste the full Google Docs URL (`https://docs.google.com/document/d/DOCUMENT_ID/edit`) or just the Document ID. Get it from the document URL. Leave empty for create operation.
  - Example: From URL `https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit`, the ID is `1a2b3c4d5e6f7g8h9i0j`

- **Document Title** (text): Document title
  - Placeholder: `My Document`
  - Help Text: Required for create operation

- **Content** (textarea): Document content
  - Placeholder: `Document content...`
  - Help Text: Required for create/update operations
  - Supports template variables (e.g., `{{input.body.content}}`)

**Usage**: 
- **Read**: Set Operation to "Read", provide Document ID or URL (full URL or just ID). Returns `{documentId, title, content: "extracted text", text: "same as content", body: "same as content", contentLength, hasContent, documentUrl}`. Use `{{input.content}}`, `{{input.text}}`, or `{{input.body}}` in templates (all contain the same extracted text).
- **Create**: Set Operation to "Create", provide Document Title, optionally set Content. Creates new document and inserts content if provided. Returns `{documentId, title, documentUrl}`.
- **Update**: Set Operation to "Update", provide Document ID and Content. Appends content to the beginning of the document. Returns updated document data.
- **⚠️ IMPORTANT**: Read operation extracts ALL text from the document. Content/text/body fields all contain the same extracted text. Use directly in output nodes (e.g., Gmail body: `{{input.content}}`).

---

### 9.7 Google Tasks (`google_tasks`)

**Description**: Manage tasks

**Purpose**: Lists, creates, updates, and completes tasks in Google Tasks. Supports task management and to-do lists.

**Properties**:
- **Operation** (required, select): Tasks operation
  - Options: List Tasks, Create Task, Update Task, Complete Task
  - Default: `list`
  - Required: Yes

- **Task List ID** (text): Google Tasks task list ID
  - Placeholder: `@default`
  - Default: `@default`
  - Help Text: Task list ID. Use "@default" for default list.

- **Task ID** (text): Task ID
  - Placeholder: `abc123def456`
  - Help Text: Required for update/complete operations

- **Task Title** (text): Task title
  - Placeholder: `Complete project report`
  - Help Text: Required for create/update operations
  - Supports template variables

- **Notes** (textarea): Task notes
  - Placeholder: `Task notes...`
  - Supports template variables

- **Due Date (ISO 8601)** (text): Task due date
  - Placeholder: `2024-01-15T23:59:59Z`
  - Help Text: Due date in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)

**Usage**: 
- **List Tasks**: Set Operation to "List Tasks", optionally set Task List ID (default: "@default"). Returns array of tasks.
- **Create Task**: Set Operation to "Create Task", provide Task Title (required), optionally set Notes, Due Date, and Task List ID. Returns task data with Task ID.
- **Update Task**: Set Operation to "Update Task", provide Task ID and Task Title. Optionally set Notes, Due Date. Returns updated task data.
- **Complete Task**: Set Operation to "Complete Task", provide Task ID. Marks task as completed. Returns success status.

---

### 9.8 Google BigQuery (`google_bigquery`)

**Description**: Execute SQL queries

**Purpose**: Executes SQL queries on Google BigQuery datasets. Supports data analysis, reporting, and data warehousing operations.

**Properties**:
- **Project ID** (required, text): Google Cloud Project ID
  - Placeholder: `my-project-id`
  - Required: Yes
  - Help Text: Google Cloud Project ID

- **Dataset ID** (required, text): BigQuery Dataset ID
  - Placeholder: `my_dataset`
  - Required: Yes
  - Help Text: BigQuery Dataset ID

- **SQL Query** (required, textarea): SQL query to execute
  - Placeholder: `SELECT * FROM \`project.dataset.table\` LIMIT 10`
  - Required: Yes
  - Help Text: SQL query to execute. Use backticks for table names: `` `project.dataset.table` ``
  - Example: `SELECT * FROM \`my-project.my_dataset.my_table\` LIMIT 100`

- **Use Legacy SQL** (boolean): Enable legacy SQL syntax
  - Default: `false`
  - Help Text: Enable for legacy SQL syntax (default: Standard SQL)

**Usage**: 
- Set Project ID to your Google Cloud Project ID
- Set Dataset ID to your BigQuery Dataset ID
- Write SQL Query using Standard SQL syntax (default) or Legacy SQL (if enabled)
- Use backticks for table names: `` `project.dataset.table` ``
- Returns query results as array of objects (rows with column values)
- Use for data analysis, reporting, and data extraction from BigQuery

---

**Google Nodes Summary**: 8 nodes for Google Workspace and Cloud integrations. Includes communication (Gmail), productivity (Sheets, Drive, Docs, Calendar, Tasks, Contacts), and data analytics (BigQuery). All nodes require OAuth2 authentication with Google account. Fully functional nodes for reading/writing data, managing files, events, contacts, and executing SQL queries.

---

## 10. CRM Nodes Library

**Purpose**: Customer Relationship Management and marketing integrations. These nodes provide access to popular CRM platforms and marketing automation tools for managing contacts, deals, tickets, campaigns, and customer communications.

**Category ID**: `crm`

**Total Nodes**: 8 nodes

**Note**: All CRM nodes require API keys or OAuth2 tokens from their respective providers. Authentication credentials must be configured before using these nodes.

### 10.1 HubSpot (`hubspot`)

**Description**: HubSpot CRM operations

**Purpose**: Integrates with HubSpot CRM for managing contacts, companies, deals, tickets, products, and other CRM resources. Supports comprehensive CRM operations with batch processing capabilities.

**Properties**:
- **Authentication Type** (required, select): Authentication method
  - Options: API Key, OAuth2 Access Token
  - Default: `apikey`
  - Required: Yes

- **API Key** (text): HubSpot API key
  - Placeholder: `your-hubspot-api-key`
  - Help Text: Required if using API Key authentication
  - Get from: HubSpot Settings → Integrations → Private Apps

- **OAuth2 Access Token** (text): OAuth2 access token
  - Placeholder: `your-oauth-access-token`
  - Help Text: Required if using OAuth2 authentication

- **Resource** (required, select): HubSpot resource type
  - Options: Contact, Company, Deal, Ticket, Product, Line Item, Quote, Call, Email, Meeting, Note, Task, Owner, Pipeline
  - Default: `contact`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: Get, Get Many, Create, Update, Delete, Search, Batch Create, Batch Update, Batch Delete
  - Default: `get`
  - Required: Yes

- **Resource ID** (text): Resource ID
  - Placeholder: `12345`
  - Help Text: Required for get, update, delete operations

- **Properties (JSON)** (JSON): Resource properties
  - Placeholder: `{"email": "test@example.com", "firstname": "John"}`
  - Help Text: Required for create/update operations
  - Example: `{"email": "test@example.com", "firstname": "John", "lastname": "Doe"}`

- **Search Query** (text): Search query
  - Placeholder: `email:test@example.com`
  - Help Text: Required for search operation

- **Limit** (number): Maximum number of records to return
  - Default: `100`
  - Help Text: Maximum number of records to return

- **After (Pagination)** (text): Pagination token
  - Placeholder: `paging_token`
  - Help Text: Pagination token for next page

**Usage**: Set Authentication Type, provide API Key or OAuth2 Access Token, choose Resource and Operation, configure operation-specific fields. Returns resource data or success status.

---

### 10.2 Salesforce (`salesforce`)

**Description**: Salesforce CRM operations

**Purpose**: Integrates with Salesforce for managing accounts, contacts, leads, opportunities, cases, and custom objects. Supports SOQL queries, SOSL search, and bulk operations.

**Properties**:
- **Instance URL** (required, text): Salesforce instance URL
  - Placeholder: `https://yourinstance.salesforce.com`
  - Required: Yes
  - Help Text: Your Salesforce instance URL

- **OAuth2 Access Token** (required, text): OAuth2 access token
  - Placeholder: `your-oauth-access-token`
  - Required: Yes
  - Help Text: OAuth2 access token for authentication

- **Resource/Object** (required, select): Salesforce object type
  - Options: Account, Contact, Lead, Opportunity, Case, Campaign, Product (Product2), Task, Event, Custom Object
  - Default: `Contact`
  - Required: Yes

- **Custom Object API Name** (text): Custom object API name
  - Placeholder: `CustomObject__c`
  - Help Text: Required if Resource is set to Custom Object

- **Operation** (required, select): Operation to perform
  - Options: Query (SOQL), Search (SOSL), Get, Create, Update, Delete, Upsert, Bulk Create, Bulk Update, Bulk Delete, Bulk Upsert
  - Default: `query`
  - Required: Yes

- **SOQL Query** (textarea): SOQL query
  - Placeholder: `SELECT Id, Name, Email FROM Contact LIMIT 10`
  - Help Text: Required for query operation

- **SOSL Search Query** (text): SOSL search query
  - Placeholder: `FIND {test@example.com} IN EMAIL FIELDS RETURNING Contact(Id, Name)`
  - Help Text: Required for search operation

- **Record ID** (text): Salesforce record ID
  - Placeholder: `003xx000004TmiQAAS`
  - Help Text: Required for get, update, delete operations

- **External ID Field** (text): External ID field name
  - Placeholder: `CustomId__c`
  - Help Text: Required for upsert operation

- **External ID Value** (text): External ID value
  - Placeholder: `EXT-12345`
  - Help Text: Required for upsert operation

- **Fields (JSON)** (JSON): Object fields
  - Placeholder: `{"LastName": "Doe", "Email": "test@example.com"}`
  - Help Text: Required for create/update operations

- **Records Array (JSON)** (JSON): Array of records for bulk operations
  - Placeholder: `[{"LastName": "Doe", "Email": "test1@example.com"}, {"LastName": "Smith", "Email": "test2@example.com"}]`
  - Help Text: Required for bulk operations

**Usage**: Set Instance URL and OAuth2 Access Token, choose Resource/Object and Operation, configure operation-specific fields (SOQL/SOSL queries, fields, records). Returns query results, record data, or success status.

---

### 10.3 Zoho CRM (`zoho_crm`)

**Description**: Zoho CRM operations

**Purpose**: Integrates with Zoho CRM for managing contacts, leads, accounts, deals, campaigns, and other CRM modules. Supports multiple API domains for different regions.

**Properties**:
- **OAuth2 Access Token** (required, text): OAuth2 access token
  - Placeholder: `your-oauth-access-token`
  - Required: Yes
  - Help Text: OAuth2 access token for authentication

- **API Domain** (required, select): Zoho API domain
  - Options: US, EU, IN, CN, AU, JP
  - Default: `https://www.zohoapis.com`
  - Required: Yes
  - Help Text: Select your Zoho CRM region

- **Module** (required, select): Zoho CRM module
  - Options: Contacts, Leads, Accounts, Deals, Campaigns, Tasks, Events, Calls, Products, Quotes, Sales Orders, Invoices, Custom Module
  - Default: `Contacts`
  - Required: Yes

- **Custom Module API Name** (text): Custom module API name
  - Placeholder: `CustomModule1`
  - Help Text: Required if Module is set to Custom Module

- **Operation** (required, select): Operation to perform
  - Options: Get, Get Many, Create, Update, Delete, Search, Upsert, Bulk Create, Bulk Update
  - Default: `get`
  - Required: Yes

- **Record ID** (text): Record ID
  - Placeholder: `1234567890123456789`
  - Help Text: Required for get, update, delete operations

- **Data (JSON)** (JSON): Record data
  - Placeholder: `{"First_Name": "John", "Last_Name": "Doe", "Email": "test@example.com"}`
  - Help Text: Required for create/update operations

- **Search Criteria** (text): Search criteria
  - Placeholder: `(Email:equals:test@example.com)`
  - Help Text: Required for search operation

- **Fields (comma-separated)** (text): Fields to retrieve
  - Placeholder: `id,First_Name,Last_Name,Email`
  - Help Text: Fields to retrieve for get/getMany operations

- **Page Number** (number): Page number for pagination
  - Default: `1`

- **Records Per Page** (number): Number of records per page
  - Default: `200`
  - Help Text: Number of records per page (max 200)

**Usage**: Set OAuth2 Access Token and API Domain, choose Module and Operation, configure operation-specific fields. Returns module data or success status.

---

### 10.4 Pipedrive (`pipedrive`)

**Description**: Pipedrive CRM operations

**Purpose**: Integrates with Pipedrive for managing persons, organizations, deals, notes, activities, products, and pipelines. Focuses on sales pipeline management.

**Properties**:
- **API Token** (required, text): Pipedrive API token
  - Placeholder: `your-api-token`
  - Required: Yes
  - Help Text: Pipedrive API token

- **Company Domain** (required, text): Pipedrive company domain
  - Placeholder: `yourcompany`
  - Required: Yes
  - Help Text: Your Pipedrive company domain (without .pipedrive.com)

- **Resource** (required, select): Pipedrive resource type
  - Options: Person, Organization, Deal, Note, Activity, Product, Pipeline, Stage, User
  - Default: `person`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: Get, Get Many, Create, Update, Delete, Search
  - Default: `get`
  - Required: Yes

- **ID** (text): Resource ID
  - Placeholder: `123`
  - Help Text: Required for get, update, delete operations

- **Data (JSON)** (JSON): Resource data
  - Placeholder: `{"name": "John Doe", "email": "test@example.com"}`
  - Help Text: Required for create/update operations

- **Search Query** (text): Search query
  - Placeholder: `John Doe`
  - Help Text: Required for search operation

- **Limit** (number): Maximum number of records to return
  - Default: `100`

- **Start (Pagination)** (number): Starting offset for pagination
  - Default: `0`

**Usage**: Set API Token and Company Domain, choose Resource and Operation, configure operation-specific fields. Returns resource data or success status.

---

### 10.5 Freshdesk (`freshdesk`)

**Description**: Freshdesk support operations

**Purpose**: Integrates with Freshdesk for managing tickets, contacts, companies, agents, groups, and time entries. Focuses on customer support and helpdesk operations.

**Properties**:
- **API Key** (required, text): Freshdesk API key
  - Placeholder: `your-api-key`
  - Required: Yes
  - Help Text: Freshdesk API key

- **Domain** (required, text): Freshdesk domain
  - Placeholder: `yourcompany`
  - Required: Yes
  - Help Text: Your Freshdesk domain (without .freshdesk.com)

- **Resource** (required, select): Freshdesk resource type
  - Options: Ticket, Contact, Company, Agent, Group, Time Entry
  - Default: `ticket`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: List, Get, Create, Update, Delete, Search
  - Default: `list`
  - Required: Yes

- **Resource ID** (text): Resource ID
  - Placeholder: `123`
  - Help Text: Required for get, update, delete operations

- **Data (JSON)** (JSON): Resource data
  - Placeholder: `{"subject": "Ticket Subject", "description": "Description", "email": "test@example.com", "priority": 1, "status": 2}`
  - Help Text: Required for create/update operations

- **Search Query** (text): Search query
  - Placeholder: `email:test@example.com`
  - Help Text: Required for search operation

- **Page Number** (number): Page number for pagination
  - Default: `1`

- **Records Per Page** (number): Number of records per page
  - Default: `30`

**Usage**: Set API Key and Domain, choose Resource and Operation, configure operation-specific fields. Returns resource data or success status.

---

### 10.6 Intercom (`intercom`)

**Description**: Intercom conversational CRM

**Purpose**: Integrates with Intercom for managing contacts, conversations, messages, tags, segments, companies, and events. Focuses on customer communication and engagement.

**Properties**:
- **Access Token** (required, text): Intercom access token
  - Placeholder: `your-access-token`
  - Required: Yes
  - Help Text: Intercom access token

- **Resource** (required, select): Intercom resource type
  - Options: Contact, Conversation, Message, Tag, Segment, Company, Event
  - Default: `contact`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: Get, List, Create, Update, Delete, Search
  - Default: `get`
  - Required: Yes

- **Resource ID** (text): Resource ID
  - Placeholder: `123456`
  - Help Text: Required for get, update, delete operations

- **Data (JSON)** (JSON): Resource data
  - Placeholder: `{"email": "test@example.com", "name": "John Doe"}`
  - Help Text: Required for create/update operations

- **Search Query** (text): Search query
  - Placeholder: `email:test@example.com`
  - Help Text: Required for search operation

- **Records Per Page** (number): Number of records per page
  - Default: `50`

- **Starting After (Pagination)** (text): Pagination token
  - Placeholder: `paging_token`
  - Help Text: Pagination token for next page

**Usage**: Set Access Token, choose Resource and Operation, configure operation-specific fields. Returns resource data or success status.

---

### 10.7 Mailchimp (`mailchimp`)

**Description**: Mailchimp email marketing

**Purpose**: Integrates with Mailchimp for managing audiences/lists, members, campaigns, automations, and segments. Focuses on email marketing and audience management.

**Properties**:
- **API Key** (required, text): Mailchimp API key
  - Placeholder: `your-api-key`
  - Required: Yes
  - Help Text: Mailchimp API key

- **Data Center** (required, text): Mailchimp data center
  - Placeholder: `us1`
  - Required: Yes
  - Help Text: Your Mailchimp data center (e.g., us1, us2, eu1)

- **Resource** (required, select): Mailchimp resource type
  - Options: Audience/List, Member, Campaign, Automation, Segment
  - Default: `audience`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: List, Get, Create, Update, Delete, Add Member, Update Member, Delete Member
  - Default: `list`
  - Required: Yes

- **List/Audience ID** (text): List/Audience ID
  - Placeholder: `a1b2c3d4e5`
  - Help Text: Required for member operations and get/update/delete audience

- **Member Email** (text): Member email address
  - Placeholder: `test@example.com`
  - Help Text: Required for member operations

- **Data (JSON)** (JSON): Resource data
  - Placeholder: `{"name": "My List", "contact": {"company": "Company", "address1": "Address"}}`
  - Help Text: Required for create/update operations

- **Member Data (JSON)** (JSON): Member data
  - Placeholder: `{"email_address": "test@example.com", "status": "subscribed", "merge_fields": {"FNAME": "John", "LNAME": "Doe"}}`
  - Help Text: Required for add/update member operations

- **Count** (number): Number of records to return
  - Default: `10`

- **Offset** (number): Offset for pagination
  - Default: `0`

**Usage**: Set API Key and Data Center, choose Resource and Operation, configure operation-specific fields. For member operations, provide List ID and Member Email. Returns resource data or success status.

---

### 10.8 ActiveCampaign (`activecampaign`)

**Description**: ActiveCampaign automation CRM

**Purpose**: Integrates with ActiveCampaign for managing contacts, lists, automations, campaigns, deals, tags, and custom fields. Focuses on marketing automation and CRM.

**Properties**:
- **API Key** (required, text): ActiveCampaign API key
  - Placeholder: `your-api-key`
  - Required: Yes
  - Help Text: ActiveCampaign API key

- **API URL** (required, text): ActiveCampaign API URL
  - Placeholder: `https://youraccount.api-us1.com`
  - Required: Yes
  - Help Text: Your ActiveCampaign API URL

- **Resource** (required, select): ActiveCampaign resource type
  - Options: Contact, List, Automation, Campaign, Deal, Tag, Custom Field
  - Default: `contact`
  - Required: Yes

- **Operation** (required, select): Operation to perform
  - Options: Get, List, Create, Update, Delete, Sync, Tag Contact, Untag Contact
  - Default: `get`
  - Required: Yes

- **Resource ID** (text): Resource ID
  - Placeholder: `123`
  - Help Text: Required for get, update, delete operations

- **Email** (text): Contact email address
  - Placeholder: `test@example.com`
  - Help Text: Required for contact sync and tag operations

- **Data (JSON)** (JSON): Resource data
  - Placeholder: `{"email": "test@example.com", "firstName": "John", "lastName": "Doe"}`
  - Help Text: Required for create/update operations

- **Tag ID** (text): Tag ID
  - Placeholder: `5`
  - Help Text: Required for tag/untag operations

- **Limit** (number): Maximum number of records to return
  - Default: `100`

- **Offset** (number): Offset for pagination
  - Default: `0`

**Usage**: Set API Key and API URL, choose Resource and Operation, configure operation-specific fields. For contact sync/tag operations, provide Email. For tag/untag operations, provide Tag ID. Returns resource data or success status.

---

**CRM Nodes Summary**: 8 nodes for CRM and marketing integrations. Includes enterprise CRM platforms (HubSpot, Salesforce, Zoho CRM, Pipedrive), customer support tools (Freshdesk, Intercom), and email marketing platforms (Mailchimp, ActiveCampaign). All nodes require API keys or OAuth2 tokens from their respective providers. Supports comprehensive CRM operations including contacts, deals, tickets, campaigns, and automation.

---

## 11. DevOps Nodes Library

**Purpose**: Development operations and infrastructure management integrations. These nodes provide access to version control systems, CI/CD tools, container orchestration, and monitoring platforms for automating development workflows.

**Category ID**: `devops`

**Total Nodes**: 8 nodes

**Note**: All DevOps nodes require authentication credentials (tokens, API keys, or certificates) from their respective providers. Some nodes require specific network access or permissions to function properly.

### 11.1 GitHub (`github`)

**Description**: GitHub API integration

**Purpose**: Integrates with GitHub for managing repositories, issues, pull requests, branches, commits, releases, and workflows. Comprehensive GitHub automation capabilities.

**Properties**:
- **GitHub Token** (required, text): GitHub personal access token
  - Placeholder: `ghp_...`
  - Required: Yes
  - Help Text: Get from GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic). Copy token (starts with `ghp_`) and paste here. Keep it secure!

- **Operation** (required, select): GitHub operation (25+ operations)
  - Options: Get Repository, List Repositories, Create Issue, Update Issue, Close Issue, List Issues, Get Issue, Add Issue Comment, Create Pull Request, Update Pull Request, Merge Pull Request, List Pull Requests, Get Pull Request, Add PR Comment, Create Branch, List Branches, Get Branch, Delete Branch, Create Commit, List Commits, Get Commit, Create Release, List Releases, Get Release, Get Workflow Runs, Trigger Workflow, List Contributors
  - Default: `get_repo`
  - Required: Yes

- **Owner/Organization** (text): GitHub username or organization
  - Placeholder: `octocat`
  - Help Text: Get from repository URL: github.com/OWNER/repo-name. OWNER is the username or organization name.

- **Repository** (text): Repository name
  - Placeholder: `Hello-World`
  - Help Text: Get from repository URL: github.com/owner/REPO-NAME. Repository name without .git extension.

- **Title** (text): Issue/PR title
  - Help Text: Required for create_issue and create_pr operations

- **Body** (textarea): Issue/PR description
  - Help Text: Required for create_issue and create_pr operations

- **Workflow ID** (text): GitHub Actions workflow filename
  - Placeholder: `workflow.yml`
  - Help Text: Get from .github/workflows/ folder. Filename is the Workflow ID.

- **Branch/Ref** (text): Branch name
  - Default: `main`
  - Help Text: Branch name for workflow trigger, branch operations, or commit

- **Issue Number** (number): GitHub issue number
  - Help Text: Get from repository → Issues → Open issue. URL shows /issues/123 where 123 is the issue number.

- **Pull Request Number** (number): GitHub PR number
  - Help Text: Get from repository → Pull requests → Open PR. URL shows /pull/123 where 123 is the PR number.

- **State** (select): Issue state
  - Options: Open, Closed
  - Default: `open`

- **Comment** (textarea): Comment text
  - Help Text: Required for add_issue_comment and add_pr_comment operations

- **Merge Method** (select): PR merge method
  - Options: Merge, Squash, Rebase
  - Default: `merge`

- **Branch Name** (text): Branch name for branch operations
  - Placeholder: `feature-branch`

- **SHA/Commit Hash** (text): Git commit SHA
  - Placeholder: `abc123def456`
  - Help Text: Get from repository → Commits → Click commit → SHA shown at top (40 characters).

- **Commit Message** (textarea): Commit message
  - Help Text: Required for create_commit operation

- **File Path** (text): File path
  - Placeholder: `src/file.js`
  - Help Text: File path for create_commit operation

- **File Content** (textarea): File content
  - Help Text: File content for create_commit operation

- **Tag Name** (text): Git tag name
  - Placeholder: `v1.0.0`

- **Release Name** (text): Release title
  - Placeholder: `Release v1.0.0`

- **Release Body** (textarea): Release description

- **Release ID** (number): Release ID

**Usage**: Set GitHub Token, choose Operation, configure operation-specific fields (Owner, Repository, Issue/PR numbers, etc.). Returns repository data, issue/PR data, commit data, release data, or success status.

---

### 11.2 GitLab (`gitlab`)

**Description**: GitLab API integration

**Purpose**: Integrates with GitLab for managing projects, issues, merge requests, pipelines, branches, files, and CI/CD. Comprehensive GitLab automation capabilities.

**Properties**:
- **GitLab Token** (required, text): GitLab personal access token
  - Placeholder: `glpat-...`
  - Required: Yes
  - Help Text: Get from GitLab.com → User Settings → Access Tokens → Add new token. Copy token (starts with `glpat-`) and paste here. Save it immediately - you won't see it again!

- **GitLab URL** (text): GitLab instance URL
  - Default: `https://gitlab.com`
  - Help Text: GitLab instance URL (use https://gitlab.com for GitLab.com)

- **Operation** (required, select): GitLab operation (20+ operations)
  - Options: Get Project, List Projects, Create Issue, Update Issue, Close Issue, List Issues, Get Issue, Create Merge Request, Update Merge Request, Approve Merge Request, Merge Merge Request, List Merge Requests, Get Merge Request, Trigger Pipeline, Get Pipeline, List Pipelines, Get Pipeline Jobs, Get Job Log, Create Branch, List Branches, Delete Branch, Get File, Create File, Update File, Delete File
  - Default: `get_project`
  - Required: Yes

- **Project ID** (text): GitLab project ID or path
  - Placeholder: `12345 or group/project`
  - Help Text: Use numeric ID (e.g., 12345) or path format (group/project-name)

- **Title** (text): Issue/MR title
  - Help Text: Required for create_issue and create_mr operations

- **Description** (textarea): Issue/MR description
  - Help Text: Required for create_issue and create_mr operations

- **Source Branch** (text): Source branch for merge request
  - Placeholder: `feature-branch`
  - Help Text: Required for create_mr operation

- **Target Branch** (text): Target branch for merge request
  - Default: `main`
  - Help Text: Required for create_mr operation

- **Trigger Token** (text): Pipeline trigger token
  - Help Text: Get from project → Settings → CI/CD → Pipeline triggers → Add trigger → Copy trigger token

- **Branch/Ref** (text): Branch name
  - Default: `main`

- **Pipeline ID** (text): Pipeline ID
  - Placeholder: `12345`

- **Issue IID** (number): Issue internal ID
  - Help Text: Get from project → Issues → Open issue. URL shows /issues/123 where 123 is the IID.

- **Merge Request IID** (number): Merge request internal ID
  - Help Text: Get from project → Merge Requests → Open MR. URL shows /merge_requests/456 where 456 is the IID.

- **State Event** (select): State event
  - Options: Close, Reopen
  - Default: `close`

- **Merge Commit Message** (textarea): Merge commit message

- **Job ID** (number): CI/CD job ID
  - Help Text: Get from project → CI/CD → Pipelines → Click pipeline → Click job → URL shows /jobs/789

- **Branch Name** (text): Branch name
  - Placeholder: `feature-branch`

- **File Path** (text): File path
  - Placeholder: `src/file.js`

- **File Content** (textarea): File content

- **Commit Message** (textarea): Commit message

**Usage**: Set GitLab Token and URL, choose Operation, configure operation-specific fields. Returns project data, issue/MR data, pipeline data, or success status.

---

### 11.3 Bitbucket (`bitbucket`)

**Description**: Bitbucket API integration

**Purpose**: Integrates with Bitbucket for managing repositories, pull requests, branches, commits, pipelines, and code. Bitbucket automation capabilities.

**Properties**:
- **Username** (required, text): Bitbucket username
  - Placeholder: `your-username`
  - Required: Yes
  - Help Text: Get from bitbucket.org → Profile picture → Personal settings → Account settings. Use username (not email).

- **App Password** (required, text): Bitbucket app password
  - Placeholder: `Your app password`
  - Required: Yes
  - Help Text: Get from bitbucket.org → Personal settings → App passwords → Create app password. Copy password immediately - you won't see it again! This is NOT your account password.

- **Operation** (required, select): Bitbucket operation (15+ operations)
  - Options: Get Repository, List Repositories, Create Pull Request, Update Pull Request, Merge Pull Request, List Pull Requests, Get Pull Request, Add PR Comment, List PR Comments, Create Branch, List Branches, Get Branch, Delete Branch, List Commits, Get Commit, Get Commit Status, Get Pipeline, List Pipelines
  - Default: `get_repo`
  - Required: Yes

- **Workspace** (text): Bitbucket workspace
  - Placeholder: `workspace-name`
  - Help Text: Get from repository URL: bitbucket.org/WORKSPACE/repo-name

- **Repository** (text): Repository name
  - Placeholder: `repo-name`

- **Pull Request ID** (number): PR ID
  - Help Text: Get from repository → Pull requests → Open PR → URL shows /pull-requests/123

- **Branch Name** (text): Branch name
  - Placeholder: `feature-branch`

- **Title** (text): PR title
  - Help Text: Required for create_pr operation

- **Description** (textarea): PR description
  - Help Text: Required for create_pr operation

- **Source Branch** (text): Source branch
  - Placeholder: `feature-branch`

- **Destination Branch** (text): Destination branch
  - Default: `main`

- **Comment** (textarea): Comment text

- **Commit SHA** (text): Commit hash

**Usage**: Set Username and App Password, choose Operation, configure operation-specific fields. Returns repository data, PR data, commit data, pipeline data, or success status.

---

### 11.4 Jenkins (`jenkins`)

**Description**: Jenkins CI/CD operations

**Purpose**: Integrates with Jenkins for managing jobs, builds, and CI/CD pipelines. Jenkins automation and build management.

**Properties**:
- **Jenkins URL** (required, text): Jenkins server URL
  - Placeholder: `https://jenkins.example.com`
  - Required: Yes

- **Username** (required, text): Jenkins username
  - Placeholder: `jenkins-user`
  - Required: Yes

- **API Token** (required, text): Jenkins API token
  - Placeholder: `Your API token`
  - Required: Yes
  - Help Text: Get from Jenkins → Click username (top right) → Configure → API Token section → Add new Token → Generate → Copy token immediately - you won't see it again!

- **Operation** (required, select): Jenkins operation
  - Options: Get Job, List Jobs, Build Job, Stop Build, Get Build, Get Build Log, Get Build Status, Poll Build Status
  - Default: `get_job`
  - Required: Yes

- **Job Name** (text): Jenkins job name
  - Placeholder: `my-job`
  - Help Text: Get from Jenkins dashboard. Job names are shown in the job list.

- **Build Number** (number): Build number
  - Help Text: Get from job → Build History → Build number shown (e.g., #123)

- **Build Parameters (JSON)** (JSON): Build parameters
  - Placeholder: `{"param1": "value1"}`
  - Help Text: Optional parameters for build_job operation

- **Poll Interval (seconds)** (number): Polling interval
  - Default: `5`
  - Help Text: Polling interval in seconds for poll_build_status operation

- **Max Poll Attempts** (number): Maximum polling attempts
  - Default: `60`
  - Help Text: Maximum polling attempts for poll_build_status operation

**Usage**: Set Jenkins URL, Username, and API Token, choose Operation, configure operation-specific fields. Returns job data, build data, build logs, or success status.

---

### 11.5 Docker (`docker`)

**Description**: Docker container management

**Purpose**: Integrates with Docker daemon for managing containers, images, builds, and registry operations. Docker container automation.

**Properties**:
- **Docker Host** (required, text): Docker daemon host or Unix socket
  - Default: `localhost`
  - Placeholder: `localhost or unix:///var/run/docker.sock`
  - Required: Yes
  - Help Text: Docker daemon host or Unix socket path

- **Port** (number): Docker daemon port
  - Default: `2375`
  - Help Text: Docker daemon port (2375 for TCP, 2376 for TLS)

- **Operation** (required, select): Docker operation
  - Options: List Containers, List Images, Build Image, Tag Image, Push Image, Pull Image, Remove Image, Start Container, Stop Container, Get Container Logs, Inspect Container
  - Default: `list_containers`
  - Required: Yes

- **Container ID/Name** (text): Container ID or name
  - Placeholder: `container-name`
  - Help Text: Get from `docker ps` command. Use container name (NAMES column) or ID (CONTAINER ID column).

- **Image Name** (text): Docker image name
  - Placeholder: `nginx:latest`
  - Help Text: Get from `docker images` command. Format: REPOSITORY:TAG (e.g., nginx:latest).

- **Dockerfile Path** (text): Path to Dockerfile
  - Default: `./Dockerfile`

- **Build Context** (text): Build context path
  - Default: `.`

- **Tag** (text): Image tag
  - Placeholder: `myimage:v1.0.0`

- **Source Tag** (text): Source image tag
  - Placeholder: `myimage:latest`

- **Registry** (text): Docker registry URL
  - Default: `docker.io`
  - Placeholder: `docker.io or registry.example.com`

- **Registry Username** (text): Registry username

- **Registry Password** (text): Registry password

**Usage**: Set Docker Host and Port, choose Operation, configure operation-specific fields. Returns container data, image data, logs, or success status.

---

### 11.6 Kubernetes (`kubernetes`)

**Description**: Kubernetes orchestration

**Purpose**: Integrates with Kubernetes API for managing pods, deployments, services, and cluster operations. Kubernetes automation and orchestration.

**Properties**:
- **API Server URL** (required, text): Kubernetes API server URL
  - Placeholder: `https://your-cluster.example.com:6443`
  - Required: Yes
  - Help Text: Get from kubeconfig file (~/.kube/config) → "server" field under "clusters" section. Or run `kubectl cluster-info`.

- **Bearer Token** (required, text): Kubernetes bearer token
  - Placeholder: `Your Kubernetes bearer token`
  - Required: Yes
  - Help Text: Get from kubeconfig file → user section with "token" field. Or create service account and get token.

- **Operation** (required, select): Kubernetes operation
  - Options: List Pods, Get Pod, List Deployments, Get Deployment, Create Deployment, Update Deployment, Scale Deployment, Restart Deployment, List Services, Get Service, Get Pod Logs
  - Default: `list_pods`
  - Required: Yes

- **Namespace** (text): Kubernetes namespace
  - Default: `default`

- **Pod Name** (text): Pod name
  - Placeholder: `my-pod`

- **Deployment Name** (text): Deployment name
  - Placeholder: `my-deployment`

- **Service Name** (text): Service name
  - Placeholder: `my-service`

- **Deployment Manifest (JSON)** (JSON): Deployment manifest
  - Help Text: Required for create_deployment operation. Kubernetes deployment YAML/JSON.

- **Replicas** (number): Number of replicas
  - Help Text: Number of replicas for scale_deployment operation

**Usage**: Set API Server URL and Bearer Token, choose Operation, configure operation-specific fields. Returns pod data, deployment data, service data, logs, or success status.

---

### 11.7 PagerDuty (`pagerduty`)

**Description**: PagerDuty incident management

**Purpose**: Integrates with PagerDuty for managing incidents, on-calls, schedules, and alerting. Incident response and on-call management.

**Properties**:
- **API Key** (required, text): PagerDuty API key
  - Placeholder: `Your PagerDuty API key`
  - Required: Yes
  - Help Text: Get from PagerDuty → Configuration → API → API Access Keys → Create New API Key → Copy key immediately - you won't see it again!

- **Operation** (required, select): PagerDuty operation
  - Options: List Incidents, Get Incident, Create Incident, Update Incident, Acknowledge Incident, Resolve Incident, List On-Calls, Get On-Call, List Schedules, Get Schedule
  - Default: `list_incidents`
  - Required: Yes

- **Incident ID** (text): Incident ID
  - Placeholder: `P123456`
  - Help Text: Get from PagerDuty → Incidents → Open incident → URL shows /incidents/INCIDENT_ID

- **Title** (text): Incident title
  - Help Text: Required for create_incident operation

- **Service ID** (text): Service ID
  - Help Text: Required for create_incident operation

- **Urgency** (select): Incident urgency
  - Options: Low, High

- **Priority ID** (text): Priority ID

- **On-Call ID** (text): On-call ID

- **Schedule ID** (text): Schedule ID
  - Help Text: Get from PagerDuty → Configuration → Schedules → Open schedule → URL shows /schedules/SCHEDULE_ID

**Usage**: Set API Key, choose Operation, configure operation-specific fields. Returns incident data, on-call data, schedule data, or success status.

---

### 11.8 Datadog (`datadog`)

**Description**: Datadog monitoring & metrics

**Purpose**: Integrates with Datadog for querying metrics, sending custom metrics, posting events, and managing monitors. Infrastructure monitoring and observability.

**Properties**:
- **API Key** (required, text): Datadog API key
  - Placeholder: `Your Datadog API key`
  - Required: Yes
  - Help Text: Get from Datadog → Profile icon → Organization Settings → API Keys → New Key → Create Key → Copy key immediately - you won't see it again!

- **Application Key** (required, text): Datadog application key
  - Placeholder: `Your Datadog app key`
  - Required: Yes
  - Help Text: Get from Datadog → Profile icon → Organization Settings → Application Keys → New Key → Create Key → Copy key immediately - you won't see it again! Note: Different from API Key - you need BOTH.

- **Datadog Site** (select): Datadog site/region
  - Options: US (datadoghq.com), EU (datadoghq.eu), US3 (us3.datadoghq.com), US5 (us5.datadoghq.com)
  - Default: `datadoghq.com`
  - Help Text: Check your login URL to determine your site.

- **Operation** (required, select): Datadog operation
  - Options: Query Metrics, Send Custom Metric, Post Event, List Monitors, Get Monitor, Create Monitor, Update Monitor, Delete Monitor, Mute Monitor, Unmute Monitor
  - Default: `query_metrics`
  - Required: Yes

- **Query** (text): Metrics query
  - Help Text: Required for query_metrics operation. Datadog query syntax.

- **Metric Name** (text): Metric name
  - Help Text: Required for send_metric operation

- **Metric Value** (number): Metric value
  - Help Text: Required for send_metric operation

- **Tags (JSON)** (JSON): Metric tags
  - Placeholder: `["env:production", "service:api"]`

- **Title** (text): Event/monitor title
  - Help Text: Required for post_event and create_monitor operations

- **Text** (textarea): Event text
  - Help Text: Required for post_event operation

- **Monitor ID** (text): Monitor ID
  - Help Text: Required for get_monitor, update_monitor, delete_monitor operations

- **Monitor Query** (text): Monitor query
  - Help Text: Required for create_monitor operation

- **Monitor Type** (select): Monitor type
  - Options: Metric Alert, Service Check, Event Alert, Log Alert, Process Alert, APM Alert, Composite, Watchdog

**Usage**: Set API Key, Application Key, and Site, choose Operation, configure operation-specific fields. Returns metrics data, event data, monitor data, or success status.

---

**DevOps Nodes Summary**: 8 nodes for development operations and infrastructure management. Includes version control systems (GitHub, GitLab, Bitbucket), CI/CD tools (Jenkins), container platforms (Docker, Kubernetes), and monitoring tools (PagerDuty, Datadog). All nodes require authentication credentials from their respective providers. Supports comprehensive DevOps automation including repositories, builds, deployments, containers, and monitoring.

---

## 12. E-commerce Nodes Library

**Purpose**: E-commerce platform and payment processing integrations. These nodes provide access to popular e-commerce platforms and payment processors for managing products, orders, customers, and payments.

**Category ID**: `ecommerce`

**Total Nodes**: 5 nodes

**Note**: All e-commerce nodes require API keys or authentication credentials from their respective providers. Payment nodes (Stripe, PayPal) handle payment processing, while e-commerce platform nodes (Shopify, WooCommerce, BigCommerce) manage store operations.

### 12.1 Shopify (`shopify`)

**Description**: Shopify e-commerce operations

**Purpose**: Integrates with Shopify for managing products, orders, customers, and inventory. Comprehensive Shopify store management and automation.

**Properties**:
- **Operation** (required, select): Shopify operation
  - Options: Get Product, List Products, Create Product, Update Product, Get Order, List Orders, Create Order, Get Customer, List Customers
  - Default: `get_product`
  - Required: Yes

- **Shop Domain** (required, text): Shopify store domain
  - Placeholder: `your-shop.myshopify.com`
  - Required: Yes
  - Help Text: Get from Shopify Admin → Settings → General → Store details. Copy domain (e.g., "mystore.myshopify.com") - do NOT include "https://" or "www".

- **Access Token** (required, text): Shopify Admin API access token
  - Placeholder: `shpat_...`
  - Required: Yes
  - Help Text: Get from Shopify Admin → Settings → Apps → Develop apps → Create app → Configure Admin API scopes → API credentials → Install app → Reveal token. Copy token (starts with `shpat_`) immediately - you won't see it again!

- **Product ID** (text): Shopify product ID
  - Help Text: Required for get_product, update_product operations

- **Order ID** (text): Shopify order ID
  - Help Text: Required for get_order operation

- **Customer ID** (text): Shopify customer ID
  - Help Text: Required for get_customer operation

- **Data (JSON)** (JSON): Product/Order/Customer data
  - Placeholder: `{"title": "Product Name", "price": "29.99"}`
  - Help Text: Required for create/update operations

- **Limit** (number): Maximum number of results to return
  - Default: `250`

**Usage**: Set Shop Domain and Access Token, choose Operation, configure operation-specific fields. Returns product data, order data, customer data, or success status.

---

### 12.2 WooCommerce (`woocommerce`)

**Description**: WooCommerce store operations

**Purpose**: Integrates with WooCommerce (WordPress) for managing products, orders, customers, and store data. WordPress-based e-commerce automation.

**Properties**:
- **Operation** (required, select): WooCommerce operation
  - Options: Get Product, List Products, Create Product, Update Product, Get Order, List Orders, Create Order, Get Customer
  - Default: `get_product`
  - Required: Yes

- **Store URL** (required, text): WooCommerce store URL
  - Placeholder: `https://yourstore.com`
  - Required: Yes
  - Help Text: Your WooCommerce store URL without trailing slash (e.g., https://yourstore.com)

- **Consumer Key** (required, text): WooCommerce consumer key
  - Placeholder: `ck_...`
  - Required: Yes
  - Help Text: Get from WooCommerce → Settings → Advanced → REST API → Add key → Copy Consumer key (starts with `ck_`)

- **Consumer Secret** (required, text): WooCommerce consumer secret
  - Placeholder: `cs_...`
  - Required: Yes
  - Help Text: Get from same API key settings → Copy Consumer secret (starts with `cs_`)

- **Product ID** (text): Product ID
  - Help Text: Required for get_product, update_product operations

- **Order ID** (text): Order ID
  - Help Text: Required for get_order operation

- **Customer ID** (text): Customer ID
  - Help Text: Required for get_customer operation

- **Data (JSON)** (JSON): Product/Order/Customer data
  - Placeholder: `{"name": "Product Name", "regular_price": "29.99"}`
  - Help Text: Required for create/update operations

- **Per Page** (number): Number of results per page
  - Default: `10`

**Usage**: Set Store URL, Consumer Key, and Consumer Secret, choose Operation, configure operation-specific fields. Returns product data, order data, customer data, or success status.

---

### 12.3 Stripe (`stripe`)

**Description**: Stripe payment processing

**Purpose**: Integrates with Stripe for processing payments, managing customers, creating subscriptions, and handling invoices. Payment processing automation.

**Properties**:
- **Operation** (required, select): Stripe operation
  - Options: Create Payment, Create Payment Intent, Get Payment, List Payments, Create Refund, Create Customer, Create Subscription, Create Invoice
  - Default: `create_payment`
  - Required: Yes

- **API Key** (required, text): Stripe API key
  - Placeholder: `sk_test_...`
  - Required: Yes
  - Help Text: Get from Stripe Dashboard → Developers → API keys → Copy Secret key (starts with `sk_test_` for test, `sk_live_` for live)

- **Amount (cents)** (number): Payment amount in smallest currency unit
  - Placeholder: `1000`
  - Help Text: Amount in smallest currency unit. For USD: $10.00 = 1000 cents. For EUR: €10.00 = 1000 cents.

- **Currency** (text): ISO currency code
  - Default: `usd`
  - Placeholder: `usd`
  - Help Text: ISO currency code (3 letters). Examples: usd, eur, gbp, inr, jpy

- **Payment Method ID** (text): Stripe payment method ID
  - Placeholder: `pm_...`
  - Help Text: Payment method ID for payment operations

- **Customer ID** (text): Stripe customer ID
  - Placeholder: `cus_...`
  - Help Text: Customer ID for customer-related operations

- **Payment Intent ID** (text): Payment Intent ID
  - Placeholder: `pi_...`
  - Help Text: Payment Intent ID for get operations

- **Metadata (JSON)** (JSON): Additional metadata
  - Placeholder: `{"order_id": "12345"}`
  - Help Text: Additional metadata as JSON object

**Usage**: Set API Key, choose Operation, configure operation-specific fields (Amount, Currency, Payment Method ID, Customer ID, etc.). Returns payment data, customer data, subscription data, invoice data, or success status.

---

### 12.4 PayPal (`paypal`)

**Description**: PayPal payment processing

**Purpose**: Integrates with PayPal for creating orders, capturing payments, processing refunds, and managing transactions. PayPal payment automation.

**Properties**:
- **Operation** (required, select): PayPal operation
  - Options: Create Order, Get Order, Capture Order, Create Refund, Get Access Token
  - Default: `create_order`
  - Required: Yes

- **Client ID** (required, text): PayPal client ID
  - Placeholder: `your-client-id`
  - Required: Yes
  - Help Text: Get from PayPal Developer Dashboard → Create/select app → Copy Client ID from app credentials

- **Client Secret** (required, text): PayPal client secret
  - Placeholder: `your-client-secret`
  - Required: Yes
  - Help Text: Get from same app credentials → Click "Show" next to Client Secret → Copy secret

- **Environment** (required, select): PayPal environment
  - Options: Sandbox, Production
  - Default: `sandbox`
  - Required: Yes
  - Help Text: Use Sandbox for testing, Production for live payments

- **Amount** (text): Order amount as decimal string
  - Placeholder: `10.00`
  - Help Text: Order amount as decimal string (e.g., "10.00" for $10.00)

- **Currency** (text): ISO currency code
  - Default: `USD`
  - Placeholder: `USD`
  - Help Text: Three-letter ISO currency code

- **Order ID** (text): PayPal order ID
  - Placeholder: `ORDER-ID`
  - Help Text: Order ID for get and capture operations

**Usage**: Set Client ID, Client Secret, and Environment, choose Operation, configure operation-specific fields (Amount, Currency, Order ID). Returns order data, payment data, or success status.

---

### 12.5 BigCommerce (`bigcommerce`)

**Description**: BigCommerce store operations

**Purpose**: Integrates with BigCommerce for managing products, orders, customers, and store data. BigCommerce e-commerce automation.

**Properties**:
- **Operation** (required, select): BigCommerce operation
  - Options: Get Product, List Products, Create Product, Update Product, Get Order, List Orders, Get Customer
  - Default: `get_product`
  - Required: Yes

- **Store Hash** (required, text): BigCommerce store hash
  - Placeholder: `your-store-hash`
  - Required: Yes
  - Help Text: Store hash from BigCommerce API credentials

- **Access Token** (required, text): BigCommerce access token
  - Placeholder: `access-token`
  - Required: Yes
  - Help Text: BigCommerce API access token

- **Product ID** (text): Product ID
  - Help Text: Required for get_product, update_product operations

- **Order ID** (text): Order ID
  - Help Text: Required for get_order operation

- **Customer ID** (text): Customer ID
  - Help Text: Required for get_customer operation

- **Data (JSON)** (JSON): Product/Order/Customer data
  - Placeholder: `{"name": "Product Name", "price": "29.99"}`
  - Help Text: Required for create/update operations

- **Limit** (number): Maximum number of results to return
  - Default: `250`

**Usage**: Set Store Hash and Access Token, choose Operation, configure operation-specific fields. Returns product data, order data, customer data, or success status.

---

**E-commerce Nodes Summary**: 5 nodes for e-commerce platforms and payment processing. Includes e-commerce platforms (Shopify, WooCommerce, BigCommerce) for managing products, orders, and customers, and payment processors (Stripe, PayPal) for processing payments, subscriptions, and refunds. All nodes require API keys or authentication credentials from their respective providers. Supports comprehensive e-commerce automation including product management, order processing, customer management, and payment handling.

---

## 13. Analytics Nodes Library

**Purpose**: Data analytics and event tracking integrations. These nodes provide access to analytics platforms for tracking events, analyzing user behavior, querying insights, and managing data routing.

**Category ID**: `analytics`

**Total Nodes**: 4 nodes

**Note**: All analytics nodes require API keys, tokens, or authentication credentials from their respective providers. Used for tracking user events, analyzing behavior, and querying analytics data.

### 13.1 Google Analytics (`google_analytics`)

**Description**: Google Analytics data and reporting

**Purpose**: Integrates with Google Analytics (GA4) for retrieving reports, listing properties, and tracking events. Web and app analytics automation.

**Properties**:
- **Operation** (required, select): Google Analytics operation
  - Options: Get Report, List Properties, Track Event
  - Default: `get_report`
  - Required: Yes

- **Access Token** (required, text): Google Analytics access token
  - Placeholder: `access-token`
  - Required: Yes
  - Help Text: Get from Google Cloud Console → Create OAuth 2.0 credentials → Use OAuth2 flow to get access token → Or use Service Account JSON key → Copy token

- **Property ID** (text): Google Analytics property ID
  - Placeholder: `property-id`
  - Help Text: Get from Google Analytics → Admin → Select property → Property Settings → Copy Property ID (numeric, e.g., 123456789) → Use format: properties/123456789

- **Date Ranges (JSON)** (JSON): Date range array
  - Placeholder: `[{"startDate": "2024-01-01", "endDate": "2024-01-31"}]`
  - Help Text: Array of date range objects for reports

- **Dimensions (JSON)** (JSON): Dimension array
  - Placeholder: `["date", "country", "city"]`
  - Help Text: Array of dimension names

- **Metrics (JSON)** (JSON): Metric array
  - Placeholder: `["activeUsers", "sessions", "screenPageViews"]`
  - Help Text: Array of metric names

- **Event Name** (text): Event name
  - Placeholder: `purchase`
  - Help Text: Event name for track_event operation

- **Event Parameters (JSON)** (JSON): Event parameters
  - Placeholder: `{"value": 29.99, "currency": "USD"}`
  - Help Text: Event parameters as JSON object for track_event operation

**Usage**: Set Access Token, choose Operation, configure operation-specific fields. For Get Report: provide Property ID, Date Ranges, Dimensions, Metrics. For Track Event: provide Event Name and Event Parameters. Returns report data, properties array, or success status.

---

### 13.2 Mixpanel (`mixpanel`)

**Description**: Mixpanel analytics and event tracking

**Purpose**: Integrates with Mixpanel for tracking events, identifying users, and querying insights. Product analytics and user behavior tracking.

**Properties**:
- **Operation** (required, select): Mixpanel operation
  - Options: Track Event, Track User, Get Event, Query Insights
  - Default: `track_event`
  - Required: Yes

- **Project Token** (required, text): Mixpanel project token
  - Placeholder: `project-token`
  - Required: Yes
  - Help Text: Get from Mixpanel → Project Settings → Copy project token

- **API Secret** (required, text): Mixpanel API secret
  - Placeholder: `api-secret`
  - Required: Yes
  - Help Text: Required for query operations. Get from Mixpanel → Project Settings → API Secret

- **Event Name** (text): Event name
  - Placeholder: `Button Click`
  - Help Text: Event name for track_event operation

- **Distinct ID** (text): User identifier
  - Placeholder: `user-id`
  - Help Text: User identifier for tracking (user ID or distinct ID)

- **Properties (JSON)** (JSON): Event or user properties
  - Placeholder: `{"button": "signup", "page": "home"}`
  - Help Text: Event or user properties as JSON object

- **Query (JSON)** (JSON): Insights query
  - Placeholder: `{"event": "Purchase", "from_date": "2024-01-01", "to_date": "2024-01-31"}`
  - Help Text: Query object for query_insights operation

**Usage**: Set Project Token and API Secret, choose Operation, configure operation-specific fields. For Track Event: provide Event Name, Distinct ID, Properties. For Query Insights: provide Query object. Returns success status or insights data.

---

### 13.3 Segment (`segment`)

**Description**: Segment analytics and data routing

**Purpose**: Integrates with Segment for tracking events, identifying users, tracking page views, and grouping users. Customer data platform and event routing.

**Properties**:
- **Operation** (required, select): Segment operation
  - Options: Track, Identify, Page, Group
  - Default: `track`
  - Required: Yes

- **Write Key** (required, text): Segment write key
  - Placeholder: `write-key`
  - Required: Yes
  - Help Text: Get from Segment → Settings → API Keys → Copy write key

- **User ID** (text): User identifier
  - Placeholder: `user-id`
  - Help Text: User identifier for identify and track operations

- **Event Name** (text): Event name
  - Placeholder: `Button Clicked`
  - Help Text: Event name for track operation

- **Properties (JSON)** (JSON): Event properties
  - Placeholder: `{"button": "signup", "page": "home"}`
  - Help Text: Event properties as JSON object

- **Traits (JSON)** (JSON): User traits
  - Placeholder: `{"email": "user@example.com", "name": "John Doe"}`
  - Help Text: User traits for identify operation

- **Page Name** (text): Page name
  - Placeholder: `Home`
  - Help Text: Page name for page operation

- **Group ID** (text): Group identifier
  - Placeholder: `group-id`
  - Help Text: Group identifier for group operation

**Usage**: Set Write Key, choose Operation, configure operation-specific fields. For Track: provide User ID, Event Name, Properties. For Identify: provide User ID, Traits. For Page: provide User ID, Page Name. For Group: provide User ID, Group ID. Returns success status.

---

### 13.4 Amplitude (`amplitude`)

**Description**: Amplitude analytics and product analytics

**Purpose**: Integrates with Amplitude for tracking events, identifying users, and retrieving event data. Product analytics and user behavior analysis.

**Properties**:
- **Operation** (required, select): Amplitude operation
  - Options: Track Event, Identify User, Get Event
  - Default: `track`
  - Required: Yes

- **API Key** (required, text): Amplitude API key
  - Placeholder: `api-key`
  - Required: Yes
  - Help Text: Get from Amplitude → Settings → Projects → Copy API key

- **Secret Key** (required, text): Amplitude secret key
  - Placeholder: `secret-key`
  - Required: Yes
  - Help Text: Required for get_event operation. Get from Amplitude → Settings → Projects → Copy Secret key

- **User ID** (text): User identifier
  - Placeholder: `user-id`
  - Help Text: User identifier

- **Event Type** (text): Event type/name
  - Placeholder: `Button Clicked`
  - Help Text: Event type/name for track operation

- **Event Properties (JSON)** (JSON): Event properties
  - Placeholder: `{"button": "signup", "page": "home"}`
  - Help Text: Event properties as JSON object

- **User Properties (JSON)** (JSON): User properties
  - Placeholder: `{"email": "user@example.com", "name": "John Doe"}`
  - Help Text: User properties for identify operation

**Usage**: Set API Key and Secret Key, choose Operation, configure operation-specific fields. For Track Event: provide User ID, Event Type, Event Properties. For Identify User: provide User ID, User Properties. Returns success status or event data.

---

**Analytics Nodes Summary**: 4 nodes for data analytics and event tracking. Includes analytics platforms (Google Analytics, Mixpanel, Segment, Amplitude) for tracking events, analyzing user behavior, querying insights, and routing customer data. All nodes require API keys or authentication credentials from their respective providers. Supports comprehensive analytics automation including event tracking, user identification, report generation, and data routing.

**Continue to next category?** We have completed documenting all major node libraries! The documentation now covers 12 comprehensive libraries with detailed node properties and explanations. Should I create a summary or help with anything else?

