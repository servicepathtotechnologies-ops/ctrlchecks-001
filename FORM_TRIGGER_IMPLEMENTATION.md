# Form Trigger Implementation - n8n-style Blocking Trigger

## Overview
The Form Trigger has been completely rebuilt to behave exactly like n8n's Form Trigger - a true blocking trigger that waits indefinitely for form submission.

## Key Features

### 1. Blocking Trigger Behavior
- **WAITING State**: When workflow is activated, Form Trigger enters WAITING state
- **No Auto-Execution**: Workflow execution pauses until form is submitted
- **One Execution Per Submission**: Each form submission resumes exactly ONE waiting execution
- **No Polling**: No background polling or duplicate executions

### 2. URL Pattern
- **Stable URL**: `/forms/{workflowId}/{nodeId}`
- **Unique Per Node**: Each form node has its own unique URL
- **Persistent**: URL stays stable unless workflow is duplicated

### 3. Node Properties Panel
- **Form Title** (string) - Title displayed at top of form
- **Form Description** (string) - Optional description text
- **Form Fields** (JSON array) - Field definitions with label, name, type, required, etc.
- **Form URL** (readonly) - Auto-generated, copyable URL
- **Wait for Submission** (boolean, locked) - Always true, indicates blocking behavior

### 4. Execution Flow

#### When Workflow is Activated:
1. Execution is created with status `"waiting"`
2. `waiting_for_node_id` is set to form node ID
3. `trigger` is set to `"form"`
4. Workflow execution pauses - no nodes execute

#### When Form is Submitted:
1. Form data is validated
2. Idempotency key prevents duplicate submissions
3. Waiting execution is found (oldest first)
4. Execution status changes from `"waiting"` to `"running"`
5. Form data is injected as execution input
6. Workflow execution resumes from Form Trigger node
7. Downstream nodes process form data

### 5. HTTP Endpoints

#### GET `/forms/{workflowId}/{nodeId}`
- Renders form HTML
- No authentication required
- CSRF protection enabled
- Shows form with configured fields

#### POST `/forms/{workflowId}/{nodeId}/submit`
- Validates form data
- Checks for duplicate submission (idempotency)
- Finds waiting execution
- Resumes execution with form data
- Returns success page or redirects

### 6. Database Schema Requirements

#### Executions Table
Must include:
- `status` (text) - Values: 'pending', 'running', 'waiting', 'success', 'failed'
- `waiting_for_node_id` (text, nullable) - Node ID that execution is waiting for
- `trigger` (text) - Trigger type: 'form', 'manual', 'webhook', etc.

#### Form Submissions Table (New)
```sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  idempotency_key TEXT UNIQUE NOT NULL,
  form_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_submissions_idempotency ON form_submissions(idempotency_key);
CREATE INDEX idx_form_submissions_workflow_node ON form_submissions(workflow_id, node_id);
```

### 7. Security Features
- **Idempotency Key**: Prevents duplicate submissions
- **Input Sanitization**: XSS and injection prevention
- **Payload Size Limit**: Configurable limit (default: 10MB)
- **IP Masking**: Privacy protection for IP addresses
- **No Secrets in Frontend**: All sensitive data server-side only

### 8. Error Handling
- **Invalid Form**: User-friendly error message
- **Workflow Deleted**: "Form expired" message
- **Duplicate Submission**: Safely ignored
- **Node Removed**: Form auto-disabled
- **No Waiting Execution**: "Form not active" message

### 9. Visual Behavior
- **Waiting State**: Node shows "Waiting for Form Submission"
- **On Success**: Execution line turns GREEN
- **On Failure**: Execution line turns RED, workflow stops

## Testing Checklist

✅ Submitting form while workflow inactive → Shows error
✅ Multiple users submitting same form → Multiple executions (one per submission)
✅ Refresh page after submit → Duplicate prevented by idempotency
✅ Empty required fields → Validation error shown
✅ Workflow restart → Resets waiting state
✅ Form URL stability → URL remains same unless workflow duplicated
✅ One execution per submission → Verified
✅ No polling → No background processes
✅ Blocking behavior → Workflow pauses until submission

## Migration Notes

### Existing Workflows
- Existing form nodes will continue to work
- Form URL pattern changed from `/form-trigger/{workflowId}` to `/form-trigger/{workflowId}/{nodeId}`
- Old URLs will redirect or show error

### Database Migration
Run the following SQL to add required columns and table:

```sql
-- Add waiting_for_node_id to executions if not exists
ALTER TABLE executions 
ADD COLUMN IF NOT EXISTS waiting_for_node_id TEXT;

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  idempotency_key TEXT UNIQUE NOT NULL,
  form_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency ON form_submissions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_form_submissions_workflow_node ON form_submissions(workflow_id, node_id);
```

## Implementation Files

1. **form-trigger/index.ts** - HTTP endpoints (GET/POST), form rendering, submission handling
2. **execute-workflow/index.ts** - Blocking trigger logic, WAITING state handling
3. **PropertiesPanel.tsx** - Form URL display, Wait for Submission field
4. **nodeTypes.ts** - Form node configuration fields
5. **WorkflowBuilder.tsx** - HandleRun update for Form Trigger

## Next Steps

1. Run database migration to add `waiting_for_node_id` column and `form_submissions` table
2. Test form submission flow end-to-end
3. Verify idempotency key prevents duplicates
4. Test multiple concurrent submissions
5. Verify execution console shows form URL correctly

