# Database Migration for Form Trigger

## Required Database Changes

To make the Form Trigger work correctly, you need to run the following SQL migrations in your Supabase database.

### 1. Add `waiting_for_node_id` Column to Executions Table

```sql
-- Add waiting_for_node_id column to track which node execution is waiting for
ALTER TABLE executions 
ADD COLUMN IF NOT EXISTS waiting_for_node_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_executions_waiting_node 
ON executions(waiting_for_node_id) 
WHERE waiting_for_node_id IS NOT NULL;

-- Add index for waiting status lookups
CREATE INDEX IF NOT EXISTS idx_executions_waiting_status 
ON executions(workflow_id, status, trigger, waiting_for_node_id) 
WHERE status = 'waiting';
```

### 2. Update Executions Status Enum

Ensure the `status` column accepts 'waiting' as a valid value:

```sql
-- If status is an enum, you may need to alter it
-- For text columns, this is usually not needed, but verify your schema

-- Check current status values
SELECT DISTINCT status FROM executions;

-- If status is text (recommended), no change needed
-- If status is enum, you'll need to alter the enum type:
-- ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'waiting';
```

### 3. Create Form Submissions Table

```sql
-- Create form_submissions table for idempotency and audit trail
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency 
ON form_submissions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_form_submissions_workflow_node 
ON form_submissions(workflow_id, node_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_execution 
ON form_submissions(execution_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at 
ON form_submissions(submitted_at DESC);
```

### 4. Row Level Security (RLS) Policies

If you're using RLS, add policies for form_submissions:

```sql
-- Allow service role to insert/read form submissions
-- (This is handled by service role key, but you may want user-facing policies)

-- Allow authenticated users to read their own form submissions
CREATE POLICY "Users can read their own form submissions"
ON form_submissions
FOR SELECT
USING (
  workflow_id IN (
    SELECT id FROM workflows WHERE user_id = auth.uid()
  )
);

-- Service role can do everything (handled by service role key)
-- No additional policy needed for service role
```

### 5. Verify Schema

After running migrations, verify the schema:

```sql
-- Check executions table has waiting_for_node_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'executions' 
AND column_name = 'waiting_for_node_id';

-- Check form_submissions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'form_submissions';

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('executions', 'form_submissions');
```

## Migration Steps

1. **Connect to your Supabase database** (via SQL Editor or psql)

2. **Run the SQL migrations above** in order:
   - Step 1: Add `waiting_for_node_id` column
   - Step 2: Verify status column accepts 'waiting'
   - Step 3: Create `form_submissions` table
   - Step 4: Add RLS policies (if using RLS)
   - Step 5: Verify schema

3. **Test the migration**:
   ```sql
   -- Test insert into form_submissions
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
   
   -- Should succeed, then delete test record
   DELETE FROM form_submissions WHERE idempotency_key LIKE 'test_key_%';
   ```

## What Each Table/Column Does

### `executions.waiting_for_node_id`
- Stores the node ID that an execution is waiting for
- When Form Trigger runs, execution status becomes 'waiting' and this field is set
- When form is submitted, this field is cleared and execution resumes

### `form_submissions` Table
- **id**: Unique submission ID
- **workflow_id**: Which workflow this submission belongs to
- **node_id**: Which form node received the submission
- **execution_id**: Which execution was resumed by this submission
- **idempotency_key**: Prevents duplicate submissions (unique constraint)
- **form_data**: The submitted form data (JSONB)
- **submitted_at**: When the form was submitted
- **created_at**: When the record was created

## Troubleshooting

### If `waiting_for_node_id` column already exists:
- The migration will skip it (IF NOT EXISTS)
- No data loss will occur

### If `form_submissions` table already exists:
- The migration will skip it (IF NOT EXISTS)
- Existing data will be preserved

### If you get permission errors:
- Ensure you're using the service role key or have proper permissions
- Check RLS policies if using Row Level Security

## After Migration

Once migrations are complete:
1. ✅ Form Trigger nodes will enter WAITING state when workflow is activated
2. ✅ Form submissions will resume waiting executions
3. ✅ Duplicate submissions will be prevented via idempotency keys
4. ✅ Form data will be stored for audit trail

## Rollback (if needed)

If you need to rollback:

```sql
-- Remove form_submissions table (WARNING: Deletes all submission data)
DROP TABLE IF EXISTS form_submissions;

-- Remove waiting_for_node_id column (WARNING: May cause data loss if executions are waiting)
ALTER TABLE executions DROP COLUMN IF EXISTS waiting_for_node_id;
```

