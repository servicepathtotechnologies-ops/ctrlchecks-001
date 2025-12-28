# Deploy Form Trigger Function via Supabase Dashboard

Since the CLI installation has issues, use the **Supabase Dashboard** method (easiest and fastest).

## 🚀 Step-by-Step Instructions

### Step 1: Prepare Function Files

1. **Navigate to the function folder**:
   - Open File Explorer
   - Go to: `C:\Users\mps\Desktop\ctrl\ctrlchecks-001\supabase\functions\form-trigger\`

2. **Select all files**:
   - Press `Ctrl + A` to select all files
   - You should see: `index.ts` and any other files

3. **Create a ZIP file**:
   - Right-click on the selected files
   - Choose **"Send to"** → **"Compressed (zipped) folder"**
   - Name it: `form-trigger.zip`
   - **IMPORTANT:** Make sure the ZIP contains the files directly, not a folder

### Step 2: Deploy via Dashboard

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard
   - Login with your Supabase account

2. **Select Your Project**:
   - Click on project: `nvrrqvlqnnvlihtlgmzn`
   - Or go directly to: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn

3. **Navigate to Edge Functions**:
   - In the left sidebar, click **"Edge Functions"**
   - Or go directly to: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn/functions

4. **Deploy the Function**:
   - Click **"Create a new function"** or **"Deploy function"** button
   - Function name: `form-trigger` (must match exactly)
   - Upload the `form-trigger.zip` file you created
   - Click **"Deploy"** or **"Save"**

5. **Wait for Deployment**:
   - You'll see a deployment progress indicator
   - Wait until it shows "Deployed" or "Active"

### Step 3: Verify Deployment

1. **Check Function Status**:
   - You should see `form-trigger` in the functions list
   - Status should be "Active" or "Deployed"

2. **Test the Function**:
   - Open this URL in your browser:
   ```
   https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
   ```

3. **Expected Results**:
   - ✅ **If workflow is active**: You'll see an HTML form page
   - ✅ **If workflow not found**: You'll see `{"error": "Workflow not found"}`
   - ❌ **If function not deployed**: You'll see `{"code":"NOT_FOUND", "message": "Requested function was not found"}`

---

## 🔧 Alternative: Use Supabase CLI via npx (No Installation)

If you prefer CLI but don't want to install globally:

```powershell
# Navigate to project
cd C:\Users\mps\Desktop\ctrl\ctrlchecks-001

# Use npx to run Supabase CLI without installation
npx supabase@latest functions deploy form-trigger --project-ref nvrrqvlqnnvlihtlgmzn
```

**Note:** You'll need to login first:
```powershell
npx supabase@latest login
```

---

## ✅ Quick Checklist

- [ ] Created `form-trigger.zip` with function files
- [ ] Logged into Supabase Dashboard
- [ ] Navigated to Edge Functions
- [ ] Deployed `form-trigger` function
- [ ] Tested the form URL
- [ ] Form page loads correctly

---

## 🐛 Troubleshooting

### "Function not found" after deployment
- **Check:** Function name must be exactly `form-trigger` (lowercase, with hyphen)
- **Check:** Wait a few seconds for deployment to complete
- **Check:** Refresh the browser and try again

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

## 📝 Next Steps After Deployment

1. **Test the form URL** in your browser
2. **Fill out the form** with test data
3. **Submit the form**
4. **Check the execution console** in your workflow builder
5. **Verify the workflow continues** to the next node

---

**Recommended Method:** Use the **Dashboard method** (Step 1-2 above) - it's the fastest and doesn't require any CLI installation.

