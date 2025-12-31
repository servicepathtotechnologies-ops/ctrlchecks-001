# Supabase Edge Functions Deployment Guide

## Overview

This guide explains how to deploy Supabase Edge Functions using the PowerShell deployment script.

## What Are These Scripts?

The PowerShell (`.ps1`) scripts automate the deployment of Supabase Edge Functions to your Supabase project. Edge Functions are serverless functions that run on Supabase's infrastructure.

### What They Do:

1. **Connect to Supabase** - Login and link your local project to Supabase
2. **Deploy Functions** - Upload function code to Supabase cloud
3. **Track Results** - Show which functions deployed successfully or failed
4. **Provide Feedback** - Color-coded output showing deployment status

## Scripts Explained

### Combined Script: `deploy-functions.ps1`

This is the **main deployment script** that combines all functionality:

#### Features:
- ✅ Deploy all functions or specific function
- ✅ Automatic Supabase connection setup
- ✅ Error handling and reporting
- ✅ Deployment summary with success/failure counts
- ✅ Optional JWT verification skip (for testing)
- ✅ Help documentation

#### How It Works:

1. **Parameter Parsing**
   ```powershell
   # Reads command-line arguments:
   -Function "form-trigger"  # Deploy specific function
   -Setup                   # Run login/link first
   -NoVerifyJWT            # Skip JWT verification
   -ProjectRef "xxx"       # Link to specific project
   ```

2. **Setup Phase** (if `-Setup` is used)
   - Runs `npx supabase@latest login` - Authenticates with Supabase
   - Runs `npx supabase@latest link` - Links local project to cloud project

3. **Deployment Phase**
   - Loops through each function
   - Runs `npx supabase@latest functions deploy <function-name>`
   - Captures output and exit codes
   - Tracks success/failure

4. **Summary Phase**
   - Shows count of successful deployments
   - Lists failed functions with errors
   - Provides next steps

## Functions Being Deployed

The script deploys these 10 Edge Functions:

1. **admin-templates** - Admin template management
2. **analyze-workflow-requirements** - AI workflow analysis
3. **chat-api** - Chat API endpoints
4. **chatbot** - Chatbot functionality
5. **copy-template** - Template copying
6. **execute-agent** - AI agent execution
7. **execute-workflow** - Workflow execution engine
8. **form-trigger** - Form submission handling
9. **generate-workflow** - AI workflow generation
10. **webhook-trigger** - Webhook handling

## Usage Examples

### 1. Deploy All Functions (First Time)
```powershell
.\deploy-functions.ps1 -Setup
```
This will:
- Login to Supabase
- Link your project
- Deploy all 10 functions

### 2. Deploy All Functions (Already Linked)
```powershell
.\deploy-functions.ps1
```
Quick deployment when already connected.

### 3. Deploy Single Function
```powershell
.\deploy-functions.ps1 -Function "form-trigger"
```
Deploy only the form-trigger function.

### 4. Deploy Without JWT Verification (Testing)
```powershell
.\deploy-functions.ps1 -NoVerifyJWT
```
Useful for testing functions without authentication.

### 5. Link to Specific Project
```powershell
.\deploy-functions.ps1 -ProjectRef "nvrrqvlqnnvlihtlgmzn" -Setup
```
Link to a specific Supabase project before deploying.

### 6. Show Help
```powershell
.\deploy-functions.ps1 -Help
```
Display usage instructions.

## Step-by-Step Workflow

### First Time Setup:

1. **Open PowerShell** in project root directory
2. **Run setup and deploy:**
   ```powershell
   .\deploy-functions.ps1 -Setup
   ```
3. **Follow prompts:**
   - Enter Supabase credentials when asked
   - Select or enter project reference ID
4. **Wait for deployment** - Script will deploy all functions
5. **Check summary** - Verify all functions deployed successfully

### Subsequent Deployments:

1. **Make changes** to function code
2. **Run deployment:**
   ```powershell
   .\deploy-functions.ps1
   ```
3. **Or deploy specific function:**
   ```powershell
   .\deploy-functions.ps1 -Function "execute-workflow"
   ```

## Understanding the Output

### Success Output:
```
✅ form-trigger deployed successfully
✅ execute-workflow deployed successfully

DEPLOYMENT SUMMARY
✅ Successfully deployed: 10
🎉 All functions deployed successfully!
```

### Failure Output:
```
❌ form-trigger deployment failed
[Error details here]

DEPLOYMENT SUMMARY
✅ Successfully deployed: 9
❌ Failed to deploy: 1
   ❌ form-trigger
```

## Troubleshooting

### Error: "Not logged in"
**Solution:** Run with `-Setup` flag:
```powershell
.\deploy-functions.ps1 -Setup
```

### Error: "Project not linked"
**Solution:** Link project manually or use `-Setup`:
```powershell
npx supabase@latest link --project-ref YOUR_PROJECT_REF
```

### Error: "Function not found"
**Solution:** Check function name matches exactly (case-sensitive):
```powershell
# Correct:
.\deploy-functions.ps1 -Function "form-trigger"

# Wrong:
.\deploy-functions.ps1 -Function "form_trigger"  # Wrong separator
```

### Error: "Deployment failed"
**Solution:** 
1. Check function code for syntax errors
2. Verify Supabase project is active
3. Check function dependencies are correct
4. Review error message for specific issue

## What Happens During Deployment?

1. **Code Upload** - Function code is uploaded to Supabase
2. **Build Process** - Supabase builds the function
3. **Deployment** - Function is deployed to edge network
4. **Verification** - Script checks if deployment succeeded
5. **Reporting** - Results are displayed

## Function Locations

Functions are located in:
```
supabase/functions/
├── admin-templates/
├── analyze-workflow-requirements/
├── chat-api/
├── chatbot/
├── copy-template/
├── execute-agent/
├── execute-workflow/
├── form-trigger/
├── generate-workflow/
└── webhook-trigger/
```

## Best Practices

1. **Deploy after code changes** - Always deploy after modifying functions
2. **Test single function first** - Deploy one function to test before all
3. **Check logs** - Review Supabase dashboard logs after deployment
4. **Version control** - Commit function code before deploying
5. **Use -Setup once** - Only needed for first-time setup

## Related Files

- `deploy-functions.ps1` - Main deployment script (USE THIS)
- `DEPLOY_ALL_FUNCTIONS.ps1` - Old version (replaced)
- `DEPLOY_NOW.ps1` - Old form-trigger specific (replaced)
- `supabase/functions/` - Function source code

## Summary

The deployment script automates the process of:
1. ✅ Connecting to Supabase
2. ✅ Uploading function code
3. ✅ Building and deploying functions
4. ✅ Reporting results

**Use `deploy-functions.ps1` for all deployments** - it's the most comprehensive and up-to-date script.

