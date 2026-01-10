# Supabase Security Fixes Guide

This guide addresses all security warnings from Supabase's security audit.

## ✅ Automated Fixes (SQL Migration)

Run the migration file: `sql_migrations/11_fix_security_issues.sql`

This migration automatically fixes:
- ✅ Enables RLS on `form_submissions` table
- ✅ Enables RLS on `test_records` table (if exists)
- ✅ Fixes RLS policy performance issues on `agent_executions`
- ✅ Fixes function `search_path` security issues

## 🔧 Manual Steps Required

### 1. Enable HaveIBeenPwned Password Protection

**This cannot be done via SQL** - must be done in Supabase Dashboard:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Policies**
3. Find **"Leaked Password Protection"** or **"Password Security"**
4. Enable **"Check passwords against HaveIBeenPwned database"**
5. Save changes

This protects users from using compromised passwords.

### 2. Extension Migration (Optional - Advanced)

The warnings about `pg_net` and `vector` extensions being in the public schema are **informational**. Moving them is **optional** but recommended for production.

⚠️ **WARNING**: Moving extensions is **destructive** and will:
- Drop all columns/indexes using those extensions
- Require data migration
- Potentially break your application temporarily

#### If you decide to move extensions:

**For pg_net:**
```sql
-- 1. Backup your data first!
-- 2. Drop extension
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- 3. Create extensions schema (if not exists)
CREATE SCHEMA IF NOT EXISTS extensions;

-- 4. Recreate in extensions schema
CREATE EXTENSION pg_net SCHEMA extensions;
```

**For vector:**
```sql
-- 1. BACKUP YOUR DATA FIRST! This will drop all vector columns!
-- 2. Drop extension
DROP EXTENSION IF EXISTS vector CASCADE;

-- 3. Create extensions schema (if not exists)
CREATE SCHEMA IF NOT EXISTS extensions;

-- 4. Recreate in extensions schema
CREATE EXTENSION vector SCHEMA extensions;

-- 5. Recreate all vector columns and indexes
-- (You'll need to restore from backup or recreate manually)
```

**Recommendation**: Only do this during a maintenance window with full backups.

### 3. Fix invoke_scheduled_workflows Function (If Exists)

If you have a function called `invoke_scheduled_workflows`, you need to update it manually:

```sql
-- Find the current function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'invoke_scheduled_workflows';

-- Then recreate it with SET search_path = public
CREATE OR REPLACE FUNCTION public.invoke_scheduled_workflows()
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Your function body here
$$;
```

## 📋 Verification Checklist

After running the migration, verify:

- [ ] `form_submissions` table has RLS enabled
- [ ] `test_records` table has RLS enabled (if it exists)
- [ ] `agent_executions` RLS policies use `(SELECT auth.uid())` instead of `auth.uid()`
- [ ] All functions have `SET search_path = public` or `SET search_path = ''`
- [ ] HaveIBeenPwned is enabled in dashboard
- [ ] Application still works correctly (test workflows, form submissions, etc.)

## 🔍 How to Verify RLS is Enabled

```sql
-- Check if RLS is enabled on tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
AND tablename IN ('form_submissions', 'test_records')
ORDER BY tablename;
```

## 🔍 How to Verify Function search_path

```sql
-- Check function search_path settings
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'update_updated_at_column',
  'update_google_tokens_updated_at',
  'update_template_updated_at',
  'invoke_scheduled_workflows'
)
ORDER BY p.proname;
```

Look for `SET search_path = public` or `SET search_path = ''` in the definitions.

## 🐛 Troubleshooting

### Issue: "RLS policy prevents access"
- Check that your policies allow the operation you're trying to perform
- Verify `auth.uid()` is available (user is authenticated)
- Check policy conditions match your use case

### Issue: "Function not found"
- Some functions may not exist in your database
- The migration handles this gracefully with IF EXISTS checks
- Check the migration output for notices

### Issue: "Extension migration broke my app"
- Restore from backup
- Recreate vector columns and indexes manually
- Consider leaving extensions in public schema if migration is too risky

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL search_path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)

## ✅ Summary

Most fixes are automated via the SQL migration. The only manual steps are:
1. Enable HaveIBeenPwned in dashboard (5 minutes)
2. Optionally move extensions (advanced, risky, optional)

After completing these steps, all security warnings should be resolved!

