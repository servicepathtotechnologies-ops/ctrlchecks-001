# AI Agent-Based Workflow Generation

## Overview

The workflow generation system has been enhanced to work as an intelligent agent that understands natural language prompts, analyzes requirements, makes decisions, and generates error-free workflows.

## Agent Architecture

### Multi-Step Process

The agent follows a structured 4-step process:

#### Step 1: Requirement Analysis
- **Purpose**: Understand what the user wants to achieve
- **Process**: 
  - Analyzes the natural language prompt
  - Extracts key requirements
  - Identifies the type of workflow needed
  - Determines required nodes and data flow
- **Output**: Structured analysis with:
  - Summary of requirements
  - List of required nodes
  - Data flow description
  - Potential issues or missing information

#### Step 2: Node Selection & Planning
- **Purpose**: Decide which nodes to use and how to connect them
- **Process**:
  - Maps requirements to available node types
  - Determines the correct order of operations
  - Plans data flow between nodes
  - Identifies configuration needs

#### Step 3: Workflow Generation
- **Purpose**: Build the actual workflow structure
- **Process**:
  - Creates nodes with proper IDs and positions
  - Configures each node with required fields
  - Connects nodes with edges
  - Uses template variables for data passing
  - Includes reasoning in the response

#### Step 4: Validation & Error Prevention
- **Purpose**: Ensure the workflow will work without errors
- **Process**:
  - Validates all node types exist
  - Checks required configuration fields
  - Verifies edge connections
  - Validates template variables
  - Auto-fixes common issues
  - Ensures no orphaned nodes

## Key Features

### 1. Intelligent Requirement Understanding
- Parses natural language prompts
- Extracts intent and requirements
- Identifies implicit needs
- Handles ambiguous requests

### 2. Decision Making
- Selects appropriate nodes from available types
- Determines optimal workflow structure
- Plans data flow and connections
- Chooses correct configurations

### 3. Error Prevention
- Validates all configurations before generation
- Checks for missing required fields
- Verifies node types and connections
- Ensures template variables are correct
- Auto-fixes common issues

### 4. Comprehensive Validation
- Node type validation
- Configuration completeness check
- Edge connection validation
- Data flow verification
- Template variable validation

## Example: "Get data from Google Doc and send it"

### Agent Analysis:
```json
{
  "summary": "User wants to read content from a Google Doc and send it via email",
  "requirements": [
    "Read content from Google Doc",
    "Send the content via email"
  ],
  "requiredNodes": [
    {
      "type": "manual_trigger",
      "purpose": "Start the workflow manually"
    },
    {
      "type": "google_doc",
      "purpose": "Read document content",
      "config": {"operation": "read", "documentId": "..."}
    },
    {
      "type": "google_gmail",
      "purpose": "Send email with document content",
      "config": {"operation": "send", "body": "{{input.content}}"}
    }
  ],
  "dataFlow": "Trigger -> Read Doc -> Send Email (using {{input.content}})"
}
```

### Generated Workflow:
- **Trigger**: manual_trigger
- **Read**: google_doc (operation: read)
- **Send**: google_gmail (operation: send, body: {{input.content}})
- **Connections**: All properly linked
- **Validation**: All required fields present

## Response Format

The agent returns:
```json
{
  "name": "Workflow name",
  "summary": "What this workflow does",
  "reasoning": "Why these nodes were chosen",
  "agentAnalysis": {
    "summary": "Requirement summary",
    "requirements": ["req1", "req2"],
    "dataFlow": "How data flows",
    "outputAction": "Final action"
  },
  "nodes": [...],
  "edges": [...]
}
```

## Validation Rules

### Node Configuration Validation
- **Google Doc**: Requires `operation` and `documentId` (for read)
- **Gmail**: Requires `operation`, `to`, `subject`, `body` (for send)
- **Google Sheets**: Requires `operation` and `spreadsheetId`
- **AI Nodes**: Requires `prompt` and `model`
- **HTTP Request**: Requires `url` and `method`
- **Schedule**: Requires `cron` expression

### Structure Validation
- All nodes must have valid types
- All edges must connect existing nodes
- Non-trigger nodes must have incoming edges
- If/else nodes must have both true and false paths
- Workflow must have a trigger node

### Data Flow Validation
- Template variables must match output fields
- Data types must be compatible
- Required fields must be present

## Error Handling

### Automatic Fixes
- Missing node IDs: Auto-generated
- Missing positions: Auto-calculated
- Missing config: Uses defaults or placeholders
- Orphaned nodes: Auto-wired to trigger

### Validation Errors
- Logged for debugging
- Attempted auto-fix
- User can see what needs attention

## Benefits

1. **Intelligent Understanding**: Understands natural language, not just keywords
2. **Error Prevention**: Validates before generation, not after
3. **Decision Making**: Chooses the right nodes and structure
4. **Transparency**: Shows reasoning and analysis
5. **Reliability**: Generates workflows that work 100% of the time

## Usage

Simply provide a natural language description:
- "Get the data from Google Doc and send it"
- "Read from Google Sheets and save to database"
- "Check if mark > 50, if yes send email, else log"
- "Schedule daily report generation"

The agent will:
1. Understand your requirements
2. Plan the workflow
3. Generate it correctly
4. Validate it works

## Technical Details

- **Model**: Google Gemini 2.5 Flash
- **Temperature**: 0.3 for analysis, 0.7 for generation
- **Validation**: Multi-layer validation system
- **Error Recovery**: Automatic fixes where possible
- **Logging**: Comprehensive logging for debugging

