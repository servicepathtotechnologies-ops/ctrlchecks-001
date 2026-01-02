# 🔴 Supabase 406 Error Fix Guide

## What 406 Means in Supabase

**406 = The request is syntactically valid, but Supabase cannot return data in the format you requested**

In Supabase REST API, 406 almost always means ONE of these:

## ✅ ROOT CAUSES

### 1️⃣ Accept Header is Missing or Wrong ❌

Supabase requires this header:

```
Accept: application/json
```

**If missing → 406**

### 2️⃣ Row Level Security (RLS) is Blocking Results ❌

If RLS is ON and no row is visible, Supabase returns 406 instead of 403.

⚠️ This is confusing but expected behavior.

### 3️⃣ select= Query is Invalid or Mismatched ❌

If a column does not exist or is not accessible, Supabase returns 406.

### 4️⃣ Using Anon Key Without Permission ❌

If using anon public key but the table needs service_role, Supabase returns 406.

## 🔍 Example Problematic URLs

```
/rest/v1/executions?
select=started_at,status
&workflow_id=eq.010526fa-3554-4114-bf6a-cfbe0a2da5bd
&order=started_at.desc
&limit=1
```

**Possible problems:**

| Area | Issue |
|------|-------|
| Headers | Missing `Accept: application/json` |
| RLS | No policy allowing SELECT |
| Key | Using anon key instead of service role |
| Column | `started_at` or `status` not accessible |
| Table | `executions` table restricted |

## ✅ FIX 1: REQUIRED HEADERS (MOST IMPORTANT)

🔥 Your fetch / axios MUST include:

```javascript
headers: {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: "application/json"
}
```

⚠️ **Without Accept, Supabase returns 406**

### Example Fix:

```javascript
// ❌ WRONG - Missing Accept header
const response = await fetch(`${supabaseUrl}/functions/v1/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify(data),
});

// ✅ CORRECT - Includes Accept header
const response = await fetch(`${supabaseUrl}/functions/v1/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',  // ← REQUIRED
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify(data),
});
```

## ✅ FIX 2: CHECK RLS (VERY COMMON)

Go to Supabase Dashboard → Table Editor → [your table]

If RLS is ON:

Add this policy 👇

```sql
CREATE POLICY "Allow read [table_name]"
ON [table_name]
FOR SELECT
USING (true);
```

Or for user-specific access:

```sql
CREATE POLICY "Allow read [table_name]"
ON [table_name]
FOR SELECT
USING (auth.uid() = user_id);
```

📌 **Without this → 406**

## ✅ FIX 3: VERIFY COLUMNS EXIST

Run this in SQL Editor:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'executions';
```

Make sure:
- `started_at` ✅
- `status` ✅
- `workflow_id` ✅

**If even one column is wrong → 406**

## ✅ FIX 4: TEST RAW CURL (BEST DEBUG)

```bash
curl 'https://YOUR_PROJECT.supabase.co/rest/v1/executions?select=started_at,status&limit=1' \
-H "apikey: YOUR_KEY" \
-H "Authorization: Bearer YOUR_KEY" \
-H "Accept: application/json"
```

**If this works → frontend bug**  
**If this fails → RLS or schema issue**

## ✅ FIX 5: user_roles 406 ERROR

This query:

```
/user_roles?select=role&user_id=eq.b4edf5df...
```

**Problem:**
- `user_roles` is usually admin-only
- anon key ❌
- RLS blocks ❌

**Fix options:**

### OPTION A (Frontend safe)

Create a view:

```sql
CREATE VIEW public_user_roles AS
SELECT role FROM user_roles WHERE user_id = auth.uid();
```

Enable RLS on view.

### OPTION B (Backend only)

Use service_role key (NEVER in frontend)

## 🧠 WHY SUPABASE USES 406

Supabase (PostgREST):

- **404** → table not found
- **401** → auth missing
- **406** → query valid but result set not allowed

This is by design, not a bug.

## ✅ FINAL CHECKLIST (COPY THIS)

- [ ] Add `Accept: application/json` header
- [ ] Verify RLS policy exists
- [ ] Confirm column names
- [ ] Use correct API key
- [ ] Avoid admin tables in frontend

## 📝 Code Examples in This Project

### Fixed Files:

1. **`src/pages/FormTrigger.tsx`**
   - Added `Accept: application/json` to form submission fetch

2. **`src/pages/AIWorkflowBuilder.tsx`**
   - Added `Accept: application/json` to analyze-workflow-requirements fetch
   - Added `Accept: application/json` to generate-workflow fallback fetch

### Using Supabase Client (Recommended)

The `@supabase/supabase-js` client automatically handles headers:

```typescript
import { supabase } from '@/integrations/supabase/client';

// ✅ This automatically includes Accept header
const { data, error } = await supabase
  .from('workflows')
  .select('*')
  .eq('id', workflowId);
```

**Always prefer using the Supabase client over direct fetch when possible!**

## 🔗 Related Files

- `src/integrations/supabase/client.ts` - Supabase client configuration
- `Debugging/01-Setup-Configuration/API_KEYS_SETUP_GUIDE.md` - API keys setup

