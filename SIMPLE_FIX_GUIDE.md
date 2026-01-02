# 🔧 Simple Fix Guide - What You Need to Do

## 🎯 Two Problems, Two Simple Fixes

### Problem 1: 406 Error (user_roles table)
**What it means:** Your app can't read user roles from the database.

**Why:** The database security (RLS) is blocking it.

### Problem 2: 400 Error (Edge Function)
**What it means:** The Edge Function is rejecting your request.

**Why:** The request format might not match exactly what the function expects.

---

## ✅ Fix 1: Fix the 406 Error (Database)

### Step 1: Go to Supabase Dashboard
1. Open your browser
2. Go to [supabase.com](https://supabase.com)
3. Login and select your project

### Step 2: Open SQL Editor
1. Click **SQL Editor** in the left menu
2. Click **New Query**

### Step 3: Copy and Paste This Code

```sql
-- Enable security on user_roles table
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policy so users can see their own role
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

### Step 4: Run It
1. Click **Run** button (or press Ctrl+Enter)
2. You should see "Success. No rows returned"

**✅ Done!** The 406 error should be fixed.

---

## ✅ Fix 2: Fix the 400 Error (Edge Function)

### Step 1: Deploy the Updated Edge Function

Open your terminal (PowerShell) and run:

```powershell
cd C:\Users\User\Desktop\flow-genius-ai-main
supabase functions deploy execute-multimodal-agent
```

**Wait for:** "Deployed Function execute-multimodal-agent"

### Step 2: Test It

1. Go back to your app in the browser
2. Try uploading an image again
3. Click "Short Note"

**✅ Done!** The 400 error should be fixed.

---

## 🧪 How to Test if It Works

### Test 1: Check 406 is Fixed
1. Refresh your browser
2. Login to your app
3. Check browser console (F12)
4. **Should NOT see:** `406` errors for `user_roles`

### Test 2: Check 400 is Fixed
1. Go to `/multimodal-builder` page
2. Click "Image Processing" tab
3. Upload an image
4. Click "Short Note" button
5. **Should see:** Image caption appears (not an error)

---

## 📋 Quick Checklist

Before testing, make sure:

- [ ] ✅ You ran the SQL code in Supabase Dashboard
- [ ] ✅ You deployed the Edge Function
- [ ] ✅ `HUGGINGFACE_API_KEY` is set in Supabase Secrets
- [ ] ✅ You're logged into your app

---

## 🚨 If It Still Doesn't Work

### Check Edge Function Logs

```powershell
supabase functions logs execute-multimodal-agent
```

Look for error messages - they will tell you exactly what's wrong.

### Check Browser Console

1. Press **F12** in your browser
2. Click **Console** tab
3. Look for red error messages
4. Copy the error and check what it says

---

## 💡 What Each Fix Does (Simple Explanation)

### Fix 1 (SQL Code)
**What it does:** Tells the database "It's okay for users to see their own role"

**Why needed:** By default, databases block everything for security. We need to tell it this is safe.

### Fix 2 (Deploy Function)
**What it does:** Updates the Edge Function to accept image requests properly

**Why needed:** The function was updated to work with the new HuggingFace Router API, but it needs to be deployed to take effect.

---

## 🎉 After Both Fixes

Your app should:
- ✅ Load without 406 errors
- ✅ Process images without 400 errors
- ✅ Show image captions successfully

---

## 📞 Still Having Issues?

1. **Check Supabase Secrets:**
   - Go to Dashboard → Edge Functions → Secrets
   - Make sure `HUGGINGFACE_API_KEY` exists

2. **Check Function Logs:**
   ```powershell
   supabase functions logs execute-multimodal-agent --tail
   ```

3. **Check Browser Console:**
   - Press F12
   - Look for any red errors

4. **Verify SQL Ran:**
   - Go to Dashboard → Table Editor → user_roles
   - Check if RLS is enabled (should show a lock icon)

---

## 🎯 Summary

**Do these 2 things:**
1. Run SQL code in Supabase Dashboard (fixes 406)
2. Deploy Edge Function (fixes 400)

**Then test:**
- Upload image → Click "Short Note" → Should work!

That's it! 🎉

