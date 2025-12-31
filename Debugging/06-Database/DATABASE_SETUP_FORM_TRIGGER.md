# Database Setup for Form Trigger - Complete Guide

## 🎯 What You Need to Do in Database

Run these SQL commands in your Supabase SQL Editor to enable Form Trigger functionality.

### Step 1: Add `waiting_for_node_id` Column

```sql
-- Add column to track which node execution is waiting for
ALTER TABLE executions 
ADD COLUMN IF NOT EXISTS waiting_for_node_id TEXT;

-- Add index for faster lookups when finding waiting executions
CREATE INDEX IF NOT EXISTS idx_executions_waiting_node 
ON executions(waiting_for_node_id) 
WHERE waiting_for_node_id IS NOT NULL;

-- Add composite index for efficient waiting execution queries
CREATE INDEX IF NOT EXISTS idx_executions_waiting_status 
ON executions(workflow_id, status, trigger, waiting_for_node_id) 
WHERE status = 'waiting';
```

**What this does:**
- Allows executions to be in "waiting" state
- Tracks which form node the execution is waiting for
- Enables fast lookups when form is submitted

### Step 2: Create Form Submissions Table

```sql
-- Create table to store form submissions and prevent duplicates
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

-- Index for idempotency key lookups (prevents duplicate submissions)
CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency 
ON form_submissions(idempotency_key);

-- Index for workflow/node lookups
CREATE INDEX IF NOT EXISTS idx_form_submissions_workflow_node 
ON form_submissions(workflow_id, node_id);

-- Index for execution lookups
CREATE INDEX IF NOT EXISTS idx_form_submissions_execution 
ON form_submissions(execution_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at 
ON form_submissions(submitted_at DESC);
```

**What this does:**
- Stores all form submissions for audit trail
- Prevents duplicate submissions via unique `idempotency_key`
- Links submissions to executions and workflows
- Enables efficient queries by workflow, node, or time

### Step 3: Verify Executions Status Column

```sql
-- Check if status column accepts 'waiting' value
-- If status is TEXT (recommended), no change needed
-- If status is ENUM, you may need to alter it

-- Check current status values
SELECT DISTINCT status FROM executions;

-- If you see 'waiting' in results, you're good!
-- If status is an enum type, run:
-- ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'waiting';
```

**What this does:**
- Ensures executions can have status = 'waiting'
- Most Supabase setups use TEXT for status, which already supports 'waiting'

### Step 4: Row Level Security (Optional)

If you're using RLS, add policies for form_submissions:

```sql
-- Allow users to read their own form submissions
CREATE POLICY "Users can read their own form submissions"
ON form_submissions
FOR SELECT
USING (
  workflow_id IN (
    SELECT id FROM workflows WHERE user_id = auth.uid()
  )
);

-- Service role can do everything (handled automatically by service role key)
-- No additional policy needed for service role operations
```

**What this does:**
- Allows users to view form submissions for their workflows
- Service role (used by edge functions) has full access automatically

## ✅ Verification Queries

After running migrations, verify everything works:

```sql
-- 1. Check waiting_for_node_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'executions' 
AND column_name = 'waiting_for_node_id';
-- Expected: column_name = 'waiting_for_node_id', data_type = 'text', is_nullable = 'YES'

-- 2. Check form_submissions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'form_submissions';
-- Expected: table_name = 'form_submissions'

-- 3. Check indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('executions', 'form_submissions')
ORDER BY tablename, indexname;
-- Expected: Should see idx_executions_waiting_node, idx_executions_waiting_status,
--           idx_form_submissions_idempotency, idx_form_submissions_workflow_node, etc.

-- 4. Test insert (then delete test record)
INSERT INTO form_submissions (
  workflow_id, 
  node_id, 
  execution_id, 
  idempotency_key, 
  form_data
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test_node',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'test_key_' || NOW()::text,
  '{"test": "data"}'::jsonb
);

-- Should succeed, then delete:
DELETE FROM form_submissions WHERE idempotency_key LIKE 'test_key_%';
```

## 📊 Table Schema Summary

### `executions` Table (Modified)
- **waiting_for_node_id** (TEXT, nullable): Node ID that execution is waiting for
- **status** (TEXT): Can be 'waiting', 'running', 'success', 'failed', 'pending', 'failed'

### `form_submissions` Table (New)
- **id** (UUID): Primary key
- **workflow_id** (UUID): Foreign key to workflows
- **node_id** (TEXT): Form node ID
- **execution_id** (UUID): Foreign key to executions
- **idempotency_key** (TEXT, UNIQUE): Prevents duplicate submissions
- **form_data** (JSONB): Submitted form data
- **submitted_at** (TIMESTAMPTZ): When form was submitted
- **created_at** (TIMESTAMPTZ): When record was created

## 🔄 How It Works

1. **Workflow Activated**:
   - Execution created with `status = 'waiting'`
   - `waiting_for_node_id = form_node_id`
   - `trigger = 'form'`

2. **Form Submitted**:
   - Check `form_submissions` for duplicate (via idempotency_key)
   - Find waiting execution (oldest first)
   - Update execution: `status = 'running'`, `waiting_for_node_id = null`
   - Insert into `form_submissions` table
   - Resume workflow execution

3. **Execution Resumes**:
   - Form Trigger node receives submission data
   - Downstream nodes process form data
   - Execution completes normally

## 🚨 Important Notes

- **No Data Loss**: All migrations use `IF NOT EXISTS` - safe to run multiple times
- **Backward Compatible**: Existing workflows continue to work
- **Performance**: Indexes ensure fast lookups even with many waiting executions
- **Security**: Idempotency keys prevent duplicate submissions
- **Audit Trail**: All submissions stored in `form_submissions` table

## 🧪 Testing After Migration

1. Create a workflow with Form Trigger
2. Add form fields in the node UI
3. Activate workflow (should enter WAITING state)
4. Submit form via public URL
5. Verify execution resumes and processes data
6. Check `form_submissions` table has the submission record
7. Try submitting again - should be prevented (idempotency)

## 📝 Complete Migration Script

Copy and paste this entire script into Supabase SQL Editor:

```sql
-- ============================================
-- FORM TRIGGER DATABASE MIGRATION
-- ============================================

-- Step 1: Add waiting_for_node_id column
ALTER TABLE executions 
ADD COLUMN IF NOT EXISTS waiting_for_node_id TEXT;

CREATE INDEX IF NOT EXISTS idx_executions_waiting_node 
ON executions(waiting_for_node_id) 
WHERE waiting_for_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_executions_waiting_status 
ON executions(workflow_id, status, trigger, waiting_for_node_id) 
WHERE status = 'waiting';

-- Step 2: Create form_submissions table
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

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency 
ON form_submissions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_form_submissions_workflow_node 
ON form_submissions(workflow_id, node_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_execution 
ON form_submissions(execution_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at 
ON form_submissions(submitted_at DESC);

-- Step 4: Optional RLS policy (if using RLS)
-- Uncomment if you want users to read their own submissions
/*
CREATE POLICY "Users can read their own form submissions"
ON form_submissions
FOR SELECT
USING (
  workflow_id IN (
    SELECT id FROM workflows WHERE user_id = auth.uid()
  )
);
*/

-- Verification
SELECT 'Migration complete! ✅' AS status;
SELECT 'waiting_for_node_id column:' AS check_1, 
       EXISTS(SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'executions' AND column_name = 'waiting_for_node_id') AS exists;
SELECT 'form_submissions table:' AS check_2,
       EXISTS(SELECT 1 FROM information_schema.tables 
              WHERE table_name = 'form_submissions') AS exists;
```

## ✅ Success Indicators

After running migration, you should see:
- ✅ `waiting_for_node_id` column in `executions` table`
- ✅ `form_submissions` table created
- ✅ All indexes created successfully
- ✅ No errors in SQL execution

## 🎉 You're Done!

Once migrations are complete, the Form Trigger will:
- ✅ Enter WAITING state when workflow is activated
- ✅ Resume execution when form is submitted
- ✅ Prevent duplicate submissions
- ✅ Store submission audit trail
- ✅ Work exactly like n8n's Form Trigger

