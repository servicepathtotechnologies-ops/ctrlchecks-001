# AI Editor Documentation

## Overview
The AI Editor is an intelligent workflow editing assistant that helps users modify workflows using natural language prompts. It uses Google Gemini AI to understand user intent and automatically update workflow nodes and connections.

## Current Configuration

### AI Model & API
- **Provider**: Google Gemini
- **Model**: `gemini-2.5-flash` (default)
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **API Key**: Stored in Supabase Edge Function secrets as `GEMINI_API_KEY`
- **Temperature**: 0.7 (for edit mode)
- **Max Tokens**: Not specified (uses API defaults)

### API Configuration Location
- **File**: `ctrlchecks-001/supabase/functions/generate-workflow/llm-adapter.ts`
- **Function**: `LLMAdapter.chatGemini()`
- **Environment Variable**: `GEMINI_API_KEY` (set in Supabase Dashboard → Edge Functions → Secrets)

### How It Works

1. **Frontend (AIAssistant.tsx)**
   - User types a prompt in the AI Editor panel
   - Component sends request to `generate-workflow` Edge Function with:
     - `prompt`: User's instruction
     - `mode`: `'edit'`
     - `currentWorkflow`: Current workflow structure (nodes + edges)
     - `executionHistory`: Last 3 failed executions (for debugging)

2. **Backend (generate-workflow/index.ts)**
   - Receives edit request
   - Builds system prompt with:
     - Current workflow structure
     - Execution history (if available)
     - Editing rules and constraints
   - Calls Gemini API via `LLMAdapter`
   - Parses response and returns updated workflow

3. **Response Processing**
   - Validates returned workflow
   - Applies fixes (e.g., replaces invalid node types)
   - Returns updated nodes and edges to frontend

## Features

### 1. Context-Aware Editing
- Understands current workflow structure
- Preserves existing nodes and connections
- Only modifies what user requests

### 2. Execution History Integration (NEW)
- Automatically fetches last 3 failed executions
- Includes error messages, logs, and outputs
- Uses this context to fix node properties based on actual execution results
- Helps AI understand what went wrong and how to fix it

### 3. Smart Property Adjustment
- Analyzes execution outputs to determine correct node configurations
- Adjusts JavaScript code to match actual data formats
- Fixes data access patterns (e.g., `input.property` vs `input.body.property`)

### 4. Debugging Capabilities
When user asks to "fix" or "debug":
- Analyzes execution history
- Identifies root cause from error messages
- Updates node configurations to match expected data formats
- Fixes JavaScript code based on actual execution outputs

## Example Usage

### Basic Edit
```
User: "Add a Slack node after the HTTP Request node"
AI: Adds slack_webhook node and connects it after http_request
```

### Debugging with Execution History
```
User: "Fix the Google Sheets error"
AI: 
1. Reads execution history showing: "No data provided for write operation"
2. Identifies JavaScript node returns empty values
3. Checks execution output shows HTTP Request returns single object
4. Updates JavaScript code to use helpers.toArray(input)
5. Ensures Google Sheets node uses operation: "append"
```

### Property Adjustment
```
User: "The data is not appending to Google Sheets"
AI:
1. Checks execution history
2. Sees JavaScript returns { values: [] }
3. Identifies HTTP Request returns single object, not array
4. Updates JavaScript to handle single object: return { values: [row] }
5. Verifies Google Sheets uses operation: "append"
```

## System Prompt Structure

The edit mode system prompt includes:

1. **Role Definition**: Embedded AI workflow editor assistant
2. **Context Awareness Rules**: How to read and understand current workflow
3. **Editing Rules**: Safe editing practices
4. **Execution History Context** (if available):
   - Recent failures
   - Error messages
   - Execution logs
   - Output data
5. **Debugging Rules**: How to fix errors based on execution history
6. **Current Workflow**: Full workflow structure (JSON)
7. **User Instruction**: What the user wants to change

## API Call Flow

```
Frontend (AIAssistant.tsx)
  ↓
  Fetch execution history (if workflowId exists)
  ↓
  POST to generate-workflow Edge Function
  {
    prompt: "Fix the error",
    mode: "edit",
    currentWorkflow: { nodes: [...], edges: [...] },
    executionHistory: [{ error: "...", logs: [...] }]
  }
  ↓
Backend (generate-workflow/index.ts)
  ↓
  Build system prompt with workflow + execution history
  ↓
  Call LLMAdapter.chatGemini()
  ↓
  POST to Google Gemini API
  https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
  ↓
  Parse JSON response
  ↓
  Validate and fix workflow
  ↓
  Return updated workflow to frontend
```

## Model Selection

The system uses `gemini-2.5-flash` by default because:
- Fast response times
- Good for structured JSON output
- Cost-effective
- Reliable for workflow generation

If the model is not available, the system automatically falls back to:
1. `gemini-2.0-flash-exp`
2. `gemini-1.5-flash`
3. `gemini-1.5-pro`

## Error Handling

1. **API Key Missing**: Returns error asking to configure `GEMINI_API_KEY`
2. **Quota Exceeded**: Returns specific quota error message
3. **Invalid JSON Response**: Attempts to extract JSON from markdown code blocks
4. **Parse Errors**: Falls back to smart pattern detection for common workflows

## Learning from Execution History

The AI editor now learns from execution history:

1. **Error Pattern Recognition**: Identifies common error patterns
2. **Data Format Learning**: Understands actual data structures from execution outputs
3. **Property Adjustment**: Updates node configs based on what worked/failed
4. **Code Fixes**: Adjusts JavaScript code to match execution results

## Future Enhancements

- [ ] Support for successful execution history (learn from what worked)
- [ ] Multi-turn conversation context
- [ ] Visual diff preview before applying changes
- [ ] Rollback capability
- [ ] Learning from user corrections

## Configuration

To change the model or API settings, edit:
- `ctrlchecks-001/supabase/functions/generate-workflow/index.ts` (line ~2430)
- `ctrlchecks-001/supabase/functions/generate-workflow/llm-adapter.ts` (model mapping)

## Troubleshooting

### AI Editor not responding
1. Check `GEMINI_API_KEY` is set in Supabase secrets
2. Check browser console for errors
3. Verify Edge Function logs in Supabase Dashboard

### AI makes incorrect changes
1. Check execution history is being sent (browser network tab)
2. Verify workflow structure is correct
3. Check system prompt includes execution history context

### Quota errors
1. Check Google Cloud Console for API quota limits
2. Consider upgrading API tier
3. Reduce number of requests

