# 🚀 Quick Fix Guide - Common Errors

This guide provides quick fixes for the most common errors you might encounter.

---

## Problem 1: 406 Error (Database - user_roles table)

**What it means:** Your app can't read user roles from the database.

**Why:** The database security (RLS - Row Level Security) is blocking it.

### Fix Steps:

1. **Open Supabase Dashboard** → Your Project
2. **Click "SQL Editor"** (left menu)
3. **Click "New Query"**
4. **Copy and paste this code:**

```sql
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

5. **Click "Run"** (or press Ctrl+Enter)
6. **Done!** ✅

---

## Problem 2: 400 Error (Edge Function)

**What it means:** The Edge Function is rejecting your request.

**Why:** The request format might not match exactly what the function expects.

### Fix Steps:

1. **Open PowerShell** (terminal)
2. **Navigate to project folder:**
   ```powershell
   cd path\to\your\project
   ```

3. **Redeploy the Edge Function:**
   ```powershell
   npx supabase functions deploy your-function-name
   ```

   Or deploy all functions:
   ```powershell
   npx supabase functions deploy --all
   ```

4. **Check the function logs** in Supabase Dashboard:
   - Go to Edge Functions → Your Function → Logs
   - Look for error messages that tell you what's wrong

5. **Verify request format** matches what the function expects (check function documentation)

---

## Problem 3: 401 Error (API Key)

**What it means:** Missing or invalid API key.

**Solution:** See [HuggingFace API Key Fix](../01-Setup-Configuration/HUGGINGFACE_API_KEY_FIX.md)

---

## Problem 4: Timeout Errors

**What it means:** Request took too long to complete.

### Fix Steps:

1. **Check function timeout settings** in Supabase Dashboard
2. **Optimize your workflow** - break down complex operations
3. **Check external API response times**
4. **Review function logs** for slow operations

---

## Still Having Issues?

1. **Check Supabase Logs:**
   - Edge Functions → Your Function → Logs
   - Database → Logs

2. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Look for error messages

3. **Check Network Tab:**
   - See the actual request/response
   - Check status codes and error messages

4. **Review Documentation:**
   - [Workflow Error Fixes](./WORKFLOW_ERROR_FIXES.md)
   - [Check Supabase Logs](./CHECK_SUPABASE_LOGS.md)
   - [Workflow Verification Guide](./WORKFLOW_VERIFICATION_GUIDE.md)

---

## Quick Reference

| Error Code | Meaning | Quick Fix |
|------------|---------|-----------|
| 400 | Bad Request | Check request format, redeploy function |
| 401 | Unauthorized | Set API key in Supabase secrets or environment |
| 406 | Not Acceptable | Fix RLS policies (see Problem 1 above) |
| 500 | Server Error | Check function logs, review code |
| Timeout | Too Slow | Optimize workflow, check external APIs |

