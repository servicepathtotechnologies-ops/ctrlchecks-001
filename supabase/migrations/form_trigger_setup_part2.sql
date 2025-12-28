-- ============================================
-- FORM TRIGGER MIGRATION - PART 2
-- ============================================
-- Run this SECOND in Supabase SQL Editor (after Part 1)
-- This creates indexes and tables that reference the new enum values
-- ============================================

-- Index for fast lookups when finding waiting executions by node ID
CREATE INDEX IF NOT EXISTS idx_executions_waiting_node 
ON executions(waiting_for_node_id) 
WHERE waiting_for_node_id IS NOT NULL;

-- Composite index for efficient queries when finding waiting executions
-- This can now safely use 'waiting' since it was added in Part 1
CREATE INDEX IF NOT EXISTS idx_executions_waiting_status 
ON executions(workflow_id, status, trigger, waiting_for_node_id) 
WHERE status = 'waiting';

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

-- Indexes for form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_idempotency 
ON form_submissions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_form_submissions_workflow_node 
ON form_submissions(workflow_id, node_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_execution 
ON form_submissions(execution_id);

CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at 
ON form_submissions(submitted_at DESC);

SELECT 'Part 2 complete! Form trigger migration finished.' AS status;

