# SQL Migrations - Organized Database Setup

This folder contains all SQL migration files organized in execution order without duplicates.

## Execution Order

Run these files in order (01 through 08) for a complete database setup:

### 1. `01_database_setup.sql` ⭐ **REQUIRED FIRST**
- **Purpose**: Complete database schema setup
- **Contains**: 
  - All enum types (app_role, workflow_status, execution_status, etc.)
  - Core tables (profiles, user_roles, teams, workflows, executions, templates, etc.)
  - Row Level Security (RLS) policies
  - Helper functions (has_role, is_team_member, etc.)
  - Triggers (handle_new_user, update timestamps, etc.)
- **Run this FIRST** before any other migration

### 2. `02_agent_memory_tables.sql`
- **Purpose**: Add agent and memory system support
- **Contains**:
  - Memory sessions and messages tables
  - Agent executions table
  - Vector embeddings support (pgvector)
  - Workflow type and configuration columns
- **Requires**: `01_database_setup.sql`

### 3. `03_google_oauth_tokens.sql`
- **Purpose**: Add Google OAuth token storage
- **Contains**:
  - google_oauth_tokens table
  - RLS policies for token access
  - Token update triggers
- **Requires**: `01_database_setup.sql`

### 4. `04_form_trigger_setup.sql`
- **Purpose**: Add form trigger functionality
- **Contains**:
  - Add 'waiting' to execution_status enum
  - Add 'form' to execution_trigger enum
  - waiting_for_node_id column
  - form_submissions table
  - Indexes for performance
- **Requires**: `01_database_setup.sql`

### 5. `05_role_based_templates.sql`
- **Purpose**: Add role-based template system
- **Contains**:
  - Template versioning
  - Active/inactive status
  - Template tracking in workflows
  - Template metadata functions
- **Requires**: `01_database_setup.sql`

### 6. `06_update_signup_role_handling.sql`
- **Purpose**: Update signup to handle roles from metadata
- **Contains**:
  - Updated handle_new_user() function
  - Role assignment from signup metadata
- **Requires**: `01_database_setup.sql`

### 7. `07_sample_data.sql` (Optional)
- **Purpose**: Insert sample workflow templates
- **Contains**: Pre-built workflow templates for users
- **Optional**: Only run if you want sample templates
- **Requires**: `01_database_setup.sql`, `05_role_based_templates.sql`

### 8. `08_admin_setup.sql` (Utility Script)
- **Purpose**: Helper script to set up admin users
- **Contains**: Queries to find users and assign admin roles
- **Usage**: Run after creating user accounts via signup
- **Not a migration**: Utility script for manual admin setup

## Quick Start

### Fresh Database Setup
```sql
-- Run in Supabase SQL Editor in this order:
1. 01_database_setup.sql
2. 02_agent_memory_tables.sql
3. 03_google_oauth_tokens.sql
4. 04_form_trigger_setup.sql
5. 05_role_based_templates.sql
6. 06_update_signup_role_handling.sql
7. 07_sample_data.sql (optional)
```

### After Setup
```sql
-- Set up admin user (replace email):
-- Run: 08_admin_setup.sql
-- Replace 'your-email@example.com' with actual email
```

## Removed Duplicates

The following duplicate files were removed:
- ❌ `APPLY_GOOGLE_SHEETS_MIGRATION.sql` (duplicate of `03_google_oauth_tokens.sql`)
- ❌ `form_trigger_setup_part1.sql` (merged into `04_form_trigger_setup.sql`)
- ❌ `form_trigger_setup_part2.sql` (merged into `04_form_trigger_setup.sql`)
- ❌ `20251207070215_6d88d90b-5112-413a-bf41-753c414177a5.sql` (duplicate of `01_database_setup.sql`)

## Notes

- All files use `IF NOT EXISTS` where possible for safe re-running
- Enum additions are handled safely with existence checks
- RLS policies are created with `DROP POLICY IF EXISTS` for safety
- Functions and triggers use `CREATE OR REPLACE` for updates

## Verification

After running migrations, verify setup:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'execution_status');

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public';
```

