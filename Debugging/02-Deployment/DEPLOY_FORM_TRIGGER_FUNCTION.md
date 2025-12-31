# Deploy Form Trigger Function

The "NOT_FOUND" error means the `form-trigger` edge function is not deployed to Supabase.

## 🚀 Quick Deployment Steps

### Option 1: Using Supabase Dashboard (Recommended - Easiest)

This method doesn't require CLI installation.

#### Step 1: Prepare Function Files

1. **Navigate to the function folder**:
   - Open File Explorer
   - Go to: `supabase/functions/form-trigger/`

2. **Select all files**:
   - Press `Ctrl + A` to select all files
   - You should see: `index.ts` and any other files

3. **Create a ZIP file**:
   - Right-click on the selected files
   - Choose **"Send to"** → **"Compressed (zipped) folder"**
   - Name it: `form-trigger.zip`
   - **IMPORTANT:** Make sure the ZIP contains the files directly, not a folder

#### Step 2: Deploy via Dashboard

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard
   - Login with your Supabase account

2. **Select Your Project**:
   - Click on your project
   - Or go directly to: https://supabase.com/dashboard/project/YOUR_PROJECT_REF

3. **Navigate to Edge Functions**:
   - In the left sidebar, click **"Edge Functions"**
   - Or go directly to: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions

4. **Deploy the Function**:
   - Click **"Create a new function"** or **"Deploy function"** button
   - Function name: `form-trigger` (must match exactly - lowercase, with hyphen)
   - Upload the `form-trigger.zip` file you created
   - Click **"Deploy"** or **"Save"**

5. **Wait for Deployment**:
   - You'll see a deployment progress indicator
   - Wait until it shows "Deployed" or "Active"

### Option 2: Using Supabase CLI

1. **Open Terminal** in your project root

2. **Login to Supabase** (if not already):
   ```bash
   npx supabase@latest login
   ```

3. **Link your project** (if not already linked):
   ```bash
   npx supabase@latest link --project-ref YOUR_PROJECT_REF
   ```
   
   To find your Project Ref:
   - Go to Supabase Dashboard → Project Settings → General
   - Look for "Reference ID"

4. **Deploy the form-trigger function**:
   ```bash
   npx supabase@latest functions deploy form-trigger
   ```

5. **Verify deployment**:
   ```bash
   npx supabase@latest functions list
   ```

### Option 3: Using GitHub Actions / CI/CD

If you have CI/CD set up, the function should deploy automatically when you push to your repository.

---

## ✅ Verify Deployment

After deployment, test the function:

1. **Check Function Status**:
   - Go to Supabase Dashboard → Edge Functions
   - You should see `form-trigger` in the functions list
   - Status should be "Active" or "Deployed"

2. **Test the Function URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/form-trigger/WORKFLOW_ID/NODE_ID
   ```

   **Expected Response:**
   - ✅ **If workflow is active**: HTML form page
   - ✅ **If workflow not found**: `{"error": "Workflow not found"}`
   - ❌ **If function not deployed**: `{"code":"NOT_FOUND", "message": "Requested function was not found"}`

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

### Error: "Function not found"
- **Solution:** Deploy the function using one of the methods above
- **Check:** Function name must be exactly `form-trigger` (lowercase, with hyphen)
- **Check:** Wait a few seconds for deployment to complete

### Error: "Permission denied"
- **Solution:** Make sure you're logged in: `npx supabase@latest login`

### Error: "Project not linked"
- **Solution:** Link your project: `npx supabase@latest link --project-ref YOUR_PROJECT_REF`

### Error: "Function exists but returns 404"
- **Solution:** 
  1. Check the function logs in Supabase Dashboard
  2. Verify the URL pattern matches: `/functions/v1/form-trigger/{workflowId}/{nodeId}`
  3. Make sure the workflow exists and is active

### "Workflow not found" error
- **Check:** Make sure the workflow ID in the URL is correct
- **Check:** The workflow exists in your database
- **Check:** The workflow is saved

### "Form is not active" error
- **Check:** Activate your workflow (status should be "active")
- **Check:** Go to workflow builder and click "Activate" or "Save & Activate"

### ZIP file structure issue
- **Make sure:** The ZIP contains `index.ts` directly, not in a subfolder
- **Correct structure:**
  ```
  form-trigger.zip
  ├── index.ts
  └── (other files if any)
  ```
- **Wrong structure:**
  ```
  form-trigger.zip
  └── form-trigger/
      └── index.ts
  ```

---

## 📝 After Deployment

Once deployed, your form URL should work. You should see:
- ✅ HTML form page (if workflow is active)
- ✅ Form fields rendered correctly
- ✅ Submit button works

---

## 🔍 Check Function Logs

To debug issues, check the function logs:

**Via CLI:**
```bash
npx supabase@latest functions logs form-trigger
```

**Via Dashboard:**
- Go to **Edge Functions** → **form-trigger** → **Logs**

---

## ✅ Quick Checklist

- [ ] Created `form-trigger.zip` with function files (if using Dashboard method)
- [ ] Logged into Supabase (Dashboard or CLI)
- [ ] Deployed `form-trigger` function
- [ ] Function shows as "Active" in dashboard
- [ ] Tested the form URL
- [ ] Form page loads correctly

---

**Next Steps:**
1. Deploy the function
2. Test the form URL in your browser
3. Submit a test form
4. Check the execution console in your workflow builder

**Recommended Method:** Use the **Dashboard method** (Option 1) - it's the fastest and doesn't require any CLI installation.
