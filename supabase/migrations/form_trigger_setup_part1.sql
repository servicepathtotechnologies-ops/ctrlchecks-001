-- ============================================
-- FORM TRIGGER MIGRATION - PART 1
-- ============================================
-- Run this FIRST in Supabase SQL Editor
-- This adds enum values and columns
-- ============================================

-- Add 'waiting' to execution_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'waiting' 
    AND enumtypid = (
      SELECT oid 
      FROM pg_type 
      WHERE typname = 'execution_status'
    )
  ) THEN
    ALTER TYPE execution_status ADD VALUE 'waiting';
    RAISE NOTICE '✅ Added ''waiting'' to execution_status enum';
  ELSE
    RAISE NOTICE 'ℹ️ ''waiting'' already exists in execution_status enum';
  END IF;
END $$;

-- Add 'form' to execution_trigger enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'form' 
    AND enumtypid = (
      SELECT oid 
      FROM pg_type 
      WHERE typname = 'execution_trigger'
    )
  ) THEN
    ALTER TYPE execution_trigger ADD VALUE 'form';
    RAISE NOTICE '✅ Added ''form'' to execution_trigger enum';
  ELSE
    RAISE NOTICE 'ℹ️ ''form'' already exists in execution_trigger enum';
  END IF;
END $$;

-- Add waiting_for_node_id column
ALTER TABLE executions 
ADD COLUMN IF NOT EXISTS waiting_for_node_id TEXT;

SELECT 'Part 1 complete! Now run form_trigger_setup_part2.sql' AS status;

