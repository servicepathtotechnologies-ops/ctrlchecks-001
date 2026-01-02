# 🚀 Quick Fix Steps - Do These Now

## Problem 1: 406 Error (Database)

### What to Do:
1. **Open Supabase Dashboard** → Your Project
2. **Click "SQL Editor"** (left menu)
3. **Click "New Query"**
4. **Copy this code and paste:**

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

### What to Do:
1. **Open PowerShell** (terminal)
2. **Run this command:**

```powershell
cd C:\Users\User\Desktop\flow-genius-ai-main
supabase functions deploy execute-multimodal-agent
```

3. **Wait for:** "Deployed Function execute-multimodal-agent"
4. **Done!** ✅

---

## Test It

1. **Refresh your browser**
2. **Go to:** `/multimodal-builder` → "Image Processing" tab
3. **Upload an image**
4. **Click "Short Note"**
5. **Should work!** 🎉

---

## If Still Not Working

### Check 1: HuggingFace API Key
- Go to Supabase Dashboard → Edge Functions → Secrets
- Make sure `HUGGINGFACE_API_KEY` exists

### Check 2: Function Logs
```powershell
supabase functions logs execute-multimodal-agent
```

### Check 3: Browser Console
- Press **F12** → **Console** tab
- Look for red errors

---

## That's It! 🎯

Just do those 2 things above and it should work!

