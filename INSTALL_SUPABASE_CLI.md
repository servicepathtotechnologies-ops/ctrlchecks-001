# Install Supabase CLI on Windows

## 🚀 Quick Installation (PowerShell)

### Method 1: Using Scoop (Recommended for Windows)

1. **Install Scoop** (if not already installed):
   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod get.scoop.sh | Invoke-Expression
   ```

2. **Install Supabase CLI**:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

3. **Verify installation**:
   ```powershell
   supabase --version
   ```

### Method 2: Using npm (If you have Node.js)

1. **Install via npm**:
   ```powershell
   npm install -g supabase
   ```

2. **Verify installation**:
   ```powershell
   supabase --version
   ```

### Method 3: Using Chocolatey (If you have Chocolatey)

1. **Install via Chocolatey**:
   ```powershell
   choco install supabase
   ```

2. **Verify installation**:
   ```powershell
   supabase --version
   ```

### Method 4: Manual Installation

1. **Download the latest release**:
   - Go to: https://github.com/supabase/cli/releases
   - Download: `supabase_windows_amd64.zip` (or appropriate for your system)

2. **Extract and add to PATH**:
   - Extract the ZIP file
   - Add the extracted folder to your system PATH
   - Or copy `supabase.exe` to a folder already in PATH (like `C:\Windows\System32`)

---

## 🔐 After Installation: Login

1. **Login to Supabase**:
   ```powershell
   supabase login
   ```
   - This will open your browser to authenticate
   - Copy the access token and paste it in the terminal

2. **Link your project**:
   ```powershell
   cd ctrlchecks-001
   supabase link --project-ref nvrrqvlqnnvlihtlgmzn
   ```

3. **Deploy the function**:
   ```powershell
   supabase functions deploy form-trigger
   ```

---

## 🌐 Alternative: Use Supabase Dashboard (No CLI Needed)

If you don't want to install the CLI, you can deploy via the dashboard:

### Step 1: Prepare the Function Files

1. **Zip the function folder**:
   - Navigate to: `ctrlchecks-001\supabase\functions\form-trigger\`
   - Select all files (Ctrl+A)
   - Right-click → Send to → Compressed (zipped) folder
   - Name it: `form-trigger.zip`

### Step 2: Deploy via Dashboard

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard
   - Login to your account
   - Select project: `nvrrqvlqnnvlihtlgmzn`

2. **Navigate to Edge Functions**:
   - Click **Edge Functions** in the left sidebar
   - Or go directly to: https://supabase.com/dashboard/project/nvrrqvlqnnvlihtlgmzn/functions

3. **Create/Deploy Function**:
   - Click **"Create a new function"** or **"Deploy function"**
   - Function name: `form-trigger`
   - Upload the `form-trigger.zip` file you created
   - Click **Deploy**

### Step 3: Verify Deployment

After deployment, test the function:
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
```

---

## ✅ Quick Test After Installation

Once CLI is installed and you're logged in:

```powershell
# Navigate to project
cd ctrlchecks-001

# Link project (first time only)
supabase link --project-ref nvrrqvlqnnvlihtlgmzn

# Deploy function
supabase functions deploy form-trigger

# Check deployment status
supabase functions list
```

---

## 🐛 Troubleshooting

### "supabase: command not found"
- **Solution:** Make sure Supabase CLI is installed and added to PATH
- **Verify:** Run `supabase --version` in a new PowerShell window

### "Project not linked"
- **Solution:** Run `supabase link --project-ref nvrrqvlqnnvlihtlgmzn`

### "Permission denied"
- **Solution:** Run `supabase login` first

### "Function already exists"
- **Solution:** This is fine - it will update the existing function

---

## 📝 Recommended: Use Dashboard Method

For quick deployment without CLI installation, use the **Supabase Dashboard method** (Method 2 above). It's faster and doesn't require any installation.

