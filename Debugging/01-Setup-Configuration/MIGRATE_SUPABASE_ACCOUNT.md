# 🔄 Migrating to a New Supabase Account - Complete Guide

This guide walks you through migrating your entire database setup from one Supabase account to another.

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ Access to your **old Supabase account** (source)
- ✅ Access to your **new Supabase account** (destination)
- ✅ Supabase CLI installed (optional, but recommended)
- ✅ Backup of your data (if you want to migrate data)

---

## 🎯 Migration Overview

You'll be migrating:
1. ✅ Database schema (tables, functions, triggers, RLS policies)
2. ✅ Edge Functions (all TypeScript functions)
3. ✅ Storage buckets (if any)
4. ✅ Environment variables/secrets
5. ✅ Data (optional - if you want to copy existing data)

---

## 📦 Step 1: Export from Old Account

### Option A: Using Supabase CLI (Recommended)

#### 1.1 Install Supabase CLI (if not installed)

```bash
# Windows (PowerShell)
winget install --id=Supabase.CLI

# Or using npm
npm install -g supabase
```

#### 1.2 Link to Old Account

```bash
# Login to Supabase
supabase login

# Link to your old project
supabase link --project-ref YOUR_OLD_PROJECT_REF
```

**To find your project ref:**
- Go to old Supabase Dashboard → Settings → General
- Copy the "Reference ID"

#### 1.3 Export Database Schema

```bash
# Export schema to SQL file
supabase db dump --schema public -f old_database_schema.sql

# Export all migrations
supabase db dump --schema public --data-only=false -f old_database_complete.sql
```

#### 1.4 Export Edge Functions

```bash
# If you have functions deployed, download them
# (Your functions are already in the codebase, so this is optional)
supabase functions list
```

#### 1.5 Export Storage (if any)

```bash
# List storage buckets
supabase storage list

# Download storage files (if needed)
# Note: You'll need to manually download files from dashboard if needed
```

### Option B: Manual Export (No CLI)

#### 1.1 Export Database Schema

1. Go to **Old Supabase Dashboard** → **SQL Editor**
2. Run this query to get all table definitions:

```sql
-- Export all table schemas
SELECT 
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
  string_agg(column_name || ' ' || data_type || 
    CASE 
      WHEN character_maximum_length IS NOT NULL 
      THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename;
```

3. Copy the results and save to `old_database_schema.sql`

#### 1.2 Export Functions and Triggers

In SQL Editor, run:

```sql
-- Export all functions
SELECT pg_get_functiondef(oid) 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- Export all triggers
SELECT 
  'CREATE TRIGGER ' || trigger_name || 
  ' ON ' || event_object_table ||
  ' FOR EACH ' || action_timing || ' ' || event_manipulation ||
  ' EXECUTE FUNCTION ' || action_statement || ';' as trigger_def
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

#### 1.3 Export RLS Policies

```sql
-- Export RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 🆕 Step 2: Set Up New Account

### 2.1 Create New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: Your project name
   - **Database Password**: Save this securely!
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Select appropriate plan

4. Wait for project to be created (2-3 minutes)

### 2.2 Get New Project Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **service_role** key → Save securely (for admin operations)

### 2.3 Link to New Account (if using CLI)

```bash
# Link to new project
supabase link --project-ref YOUR_NEW_PROJECT_REF
```

---

## 📥 Step 3: Import to New Account

### 3.1 Import Database Schema

**Method 1: Using Migration Files (Recommended)**

Your project already has all migrations in `sql_migrations/` folder. Run them in order:

1. Go to **New Supabase Dashboard** → **SQL Editor**
2. Run migrations in this order:

```sql
-- Run these files in order:
1. sql_migrations/01_database_setup.sql
2. sql_migrations/02_agent_memory_tables.sql
3. sql_migrations/03_google_oauth_tokens.sql
4. sql_migrations/04_form_trigger_setup.sql
5. sql_migrations/05_role_based_templates.sql
6. sql_migrations/06_update_signup_role_handling.sql
7. sql_migrations/10_fix_user_roles_rls.sql
8. sql_migrations/11_fix_security_issues.sql
9. sql_migrations/07_sample_data.sql (optional)
```

**Method 2: Using Exported SQL**

If you exported from old account:

1. Go to **New Supabase Dashboard** → **SQL Editor**
2. Paste the exported SQL from Step 1
3. Click **Run**

### 3.2 Deploy Edge Functions

#### Option A: Using Supabase CLI

```bash
# Make sure you're linked to new project
supabase link --project-ref YOUR_NEW_PROJECT_REF

# Deploy all functions
cd supabase/functions
for dir in */; do
  if [ -f "$dir/index.ts" ]; then
    supabase functions deploy "${dir%/}"
  fi
done
```

#### Option B: Using Deployment Scripts

```bash
# Windows (PowerShell)
.\deploy-functions.ps1

# Linux/Mac
./deploy-functions.sh
```

#### Option C: Manual Deployment

1. Go to **New Supabase Dashboard** → **Edge Functions**
2. For each function in `supabase/functions/`:
   - Click **"Create Function"**
   - Copy code from `index.ts`
   - Set function name
   - Deploy

**Functions to deploy:**
- `execute-workflow`
- `execute-agent`
- `execute-multimodal-agent`
- `generate-workflow`
- `chat-api`
- `chatbot`
- `form-trigger`
- `webhook-trigger`
- `admin-templates`
- `copy-template`
- `analyze-workflow-requirements`
- `build-multimodal-agent`

### 3.3 Set Up Edge Function Secrets

1. Go to **New Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Add secrets:
   - `HUGGINGFACE_API_KEY` = Your HuggingFace API key
   - Any other API keys your functions need

### 3.4 Set Up Storage (if needed)

1. Go to **New Supabase Dashboard** → **Storage**
2. Create buckets (if you had any in old account)
3. Set up bucket policies (RLS)

---

## 🔧 Step 4: Update Environment Variables

### 4.1 Update Local `.env` File

Create or update `.env` in project root:

```env
# New Supabase credentials
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-new-anon-key
```

### 4.2 Update Deployment Environment Variables

If you have the app deployed:

**Vercel:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Update:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

**Netlify:**
1. Go to Netlify Dashboard → Site → Site Settings → Environment Variables
2. Update the same variables

**Other platforms:** Update in their respective environment variable settings

### 4.3 Update Frontend Code (if hardcoded)

Check these files for hardcoded URLs:
- `src/integrations/supabase/client.ts` (should use env vars ✅)
- Any other files referencing old Supabase URL

---

## 📊 Step 5: Migrate Data (Optional)

**⚠️ Important:** Only migrate data if you need existing user data, workflows, etc.

### 5.1 Export Data from Old Account

```sql
-- In old account SQL Editor, export data
-- Example for workflows table:
COPY (SELECT * FROM workflows) TO STDOUT WITH CSV HEADER;
```

Or use Supabase Dashboard:
1. Go to **Table Editor**
2. Select table
3. Click **Export** → **CSV**

### 5.2 Import Data to New Account

**Method 1: Using SQL**

```sql
-- In new account SQL Editor
-- Example for workflows:
COPY workflows FROM STDIN WITH CSV HEADER;
-- Paste CSV data here
```

**Method 2: Using Dashboard**

1. Go to **Table Editor**
2. Select table
3. Click **Insert** → **Import from CSV**
4. Upload exported CSV

**⚠️ Notes:**
- User IDs will be different (auth.users table)
- You may need to update foreign key references
- Consider if you really need to migrate data or start fresh

---

## ✅ Step 6: Verification & Testing

### 6.1 Verify Database Schema

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 6.2 Test Edge Functions

1. Go to **Edge Functions** → Test each function
2. Or use your frontend to trigger workflows
3. Check function logs for errors

### 6.3 Test Application

1. Start local development:
   ```bash
   npm install
   npm run dev
   ```

2. Test:
   - ✅ User signup/login
   - ✅ Creating workflows
   - ✅ Executing workflows
   - ✅ Form triggers
   - ✅ Webhook triggers
   - ✅ AI agent features

### 6.4 Verify Environment Variables

```bash
# Check env vars are loaded
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_PUBLISHABLE_KEY
```

---

## 🔐 Step 7: Security Checklist

After migration, verify:

- [ ] RLS policies are enabled on all tables
- [ ] Edge Functions have correct secrets
- [ ] Old account credentials are removed from code
- [ ] New account credentials are in `.env` (not committed)
- [ ] `.env` is in `.gitignore`
- [ ] All functions deployed successfully
- [ ] Test authentication works
- [ ] Test workflows execute correctly

---

## 🐛 Troubleshooting

### Issue: "Function not found" errors

**Solution:**
- Make sure all Edge Functions are deployed
- Check function names match exactly
- Verify secrets are set

### Issue: "RLS policy violation"

**Solution:**
- Check RLS policies are created
- Verify user authentication
- Check policy conditions

### Issue: "Foreign key constraint violation" when importing data

**Solution:**
- Import tables in dependency order
- Or temporarily disable foreign key checks:
  ```sql
  SET session_replication_role = 'replica';
  -- Import data
  SET session_replication_role = 'origin';
  ```

### Issue: "Extension not found" (vector, pg_net)

**Solution:**
- Enable extensions in new account:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  ```

### Issue: Environment variables not loading

**Solution:**
- Restart development server
- Check `.env` file is in root directory
- Verify variable names match exactly (case-sensitive)

---

## 📝 Quick Migration Checklist

Use this checklist to track your migration:

- [ ] Exported database schema from old account
- [ ] Created new Supabase project
- [ ] Got new project credentials
- [ ] Ran all migration files in order
- [ ] Deployed all Edge Functions
- [ ] Set up Edge Function secrets
- [ ] Updated `.env` file with new credentials
- [ ] Updated deployment environment variables
- [ ] Tested user authentication
- [ ] Tested workflow creation
- [ ] Tested workflow execution
- [ ] Tested form triggers
- [ ] Tested webhook triggers
- [ ] Verified RLS policies
- [ ] Removed old credentials from code
- [ ] Updated documentation (if any)

---

## 🎯 Recommended Approach

**For Fresh Start (No Data Migration):**
1. ✅ Use migration files from `sql_migrations/` (fastest)
2. ✅ Deploy Edge Functions
3. ✅ Set up secrets
4. ✅ Update environment variables
5. ✅ Test everything

**For Data Migration:**
1. ✅ Export data from old account
2. ✅ Set up new account with migrations
3. ✅ Import data (adjust for new user IDs)
4. ✅ Deploy functions
5. ✅ Test thoroughly

---

## 📚 Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Supabase Migration Guide](https://supabase.com/docs/guides/database/migrations)
- [Edge Functions Deployment](https://supabase.com/docs/guides/functions)

---

## ✅ Summary

**Quick Migration Steps:**
1. Create new Supabase project
2. Run migration files from `sql_migrations/` in order
3. Deploy Edge Functions
4. Set up secrets
5. Update `.env` file
6. Test everything

**Time Estimate:** 30-60 minutes (depending on data migration)

**Difficulty:** Medium (easier if you don't migrate data)

---

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase logs in dashboard
3. Check Edge Function logs
4. Verify all environment variables are set correctly

Good luck with your migration! 🚀

