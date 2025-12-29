# Deploy Form Trigger Function

The "NOT_FOUND" error means the `form-trigger` edge function is not deployed to Supabase.

## 🚀 Quick Deployment Steps

### Option 1: Using Supabase CLI (Recommended)

1. **Open Terminal** in your project root:
   ```bash
   cd ctrlchecks-001
   ```

2. **Login to Supabase** (if not already):
   ```bash
   supabase login
   ```

3. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref nvrrqvlqnnvlihtlgmzn
   ```

4. **Deploy the form-trigger function**:
   ```bash
   supabase functions deploy form-trigger
   ```

5. **Verify deployment**:
   ```bash
   supabase functions list
   ```

### Option 2: Using Supabase Dashboard

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard
   - Select your project: `nvrrqvlqnnvlihtlgmzn`

2. **Navigate to Edge Functions**:
   - Click **Edge Functions** in the left sidebar
   - Or go to: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn/functions

3. **Deploy the function**:
   - Click **"Deploy a new function"** or **"Create function"**
   - Function name: `form-trigger`
   - Upload the folder: `supabase/functions/form-trigger/`
   - Or use the CLI command shown above

### Option 3: Using GitHub Actions / CI/CD

If you have CI/CD set up, the function should deploy automatically when you push to your repository.

---

## ✅ Verify Deployment

After deployment, test the function:

```bash
curl https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
```

**Expected Response:**
- If workflow is active: HTML form page
- If workflow not found: `{"error": "Workflow not found"}`
- If function not deployed: `{"code":"NOT_FOUND", "message": "Requested function was not found"}`

---

## 🔧 Configuration Check

Make sure `supabase/config.toml` includes:

```toml
[functions.form-trigger]
verify_jwt = false
```

This allows public access to the form (no authentication required).

---

## 🐛 Troubleshooting

### Error: "Function not found
- **Solution:** Deploy the function using one of the methods above

### Error: "Permission denied"
- **Solution:** Make sure you're logged in: `supabase login`

### Error: "Project not linked"
- **Solution:** Link your project: `supabase link --project-ref nvrrqvlqnnvlihtlgmzn`

### Error: "Function exists but returns 404"
- **Solution:** 
  1. Check the function logs in Supabase Dashboard
  2. Verify the URL pattern matches: `/functions/v1/form-trigger/{workflowId}/{nodeId}`
  3. Make sure the workflow exists and is active

---

## 📝 After Deployment

Once deployed, your form URL should work:
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
```

You should see:
- ✅ HTML form page (if workflow is active)
- ✅ Form fields rendered correctly
- ✅ Submit button works

---

## 🔍 Check Function Logs

To debug issues, check the function logs:

```bash
supabase functions logs form-trigger
```

Or in Supabase Dashboard:
- Go to **Edge Functions** → **form-trigger** → **Logs**

---

**Next Steps:**
1. Deploy the function
2. Test the form URL in your browser
3. Submit a test form
4. Check the execution console in your workflow builder

