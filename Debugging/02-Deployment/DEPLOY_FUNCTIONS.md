# Deploy All Supabase Edge Functions

This guide explains how to deploy all edge functions to your Supabase project.

## 🚀 Quick Deploy (Recommended)

### Using npm script (Cross-platform):
```bash
npm run deploy:all
```

This will deploy all 10 edge functions in sequence.

## 📋 Individual Function Deployment

You can also deploy functions individually:

```bash
# Deploy specific function
npm run deploy:admin-templates
npm run deploy:analyze-workflow-requirements
npm run deploy:chat-api
npm run deploy:chatbot
npm run deploy:copy-template
npm run deploy:execute-agent
npm run deploy:execute-workflow
npm run deploy:form-trigger
npm run deploy:generate-workflow
npm run deploy:webhook-trigger
```

## 🖥️ Using Shell Scripts

### For Linux/Mac:
```bash
chmod +x deploy-all-functions.sh
./deploy-all-functions.sh
```

### For Windows (PowerShell):
```powershell
.\deploy-all-functions.ps1
```

## 📦 List of Functions

The following edge functions will be deployed:

1. **admin-templates** - Admin template management
2. **analyze-workflow-requirements** - Analyzes workflow requirements from user prompts
3. **chat-api** - Chat API endpoint
4. **chatbot** - Website chatbot functionality
5. **copy-template** - Template copying functionality
6. **execute-agent** - Executes autonomous AI agents
7. **execute-workflow** - Executes workflow nodes
8. **form-trigger** - Handles form submissions
9. **generate-workflow** - Generates workflows using AI
10. **webhook-trigger** - Handles webhook requests

## ⚙️ Prerequisites

1. **Supabase CLI installed**:
   ```bash
   npm install -g supabase
   ```

2. **Authenticated with Supabase**:
   ```bash
   npx supabase login
   ```

3. **Project Reference**: The project ref is configured in `package.json` and scripts as `nvrrqvlqnnvlihtlgmzn`

## 🔧 Manual Deployment

If you prefer to deploy manually, use:

```bash
npx supabase functions deploy <function-name> --project-ref nvrrqvlqnnvlihtlgmzn
```

Replace `<function-name>` with one of the function names listed above.

## ✅ Verification

After deployment, verify functions are deployed:

```bash
npx supabase functions list --project-ref nvrrqvlqnnvlihtlgmzn
```

## 🔐 Environment Variables

Make sure you have set the required environment variables/secrets in Supabase:

- Go to Supabase Dashboard → Edge Functions → Secrets
- Add required secrets like:
  - `GEMINI_API_KEY` (for AI functions)
  - `LOVABLE_API_KEY` (for workflow execution)
  - `CHATBOT_API_KEY` (for chatbot)
  - Any other API keys your functions need

## 🐛 Troubleshooting

### Function deployment fails:
1. Check you're logged in: `npx supabase login`
2. Verify project ref is correct
3. Check function code for syntax errors
4. Ensure all dependencies are available

### Functions not working after deployment:
1. Check function logs in Supabase Dashboard
2. Verify environment variables/secrets are set
3. Check function configuration in `supabase/config.toml`

## 📝 Notes

- Deployment may take a few minutes for all functions
- Functions are deployed sequentially to avoid rate limits
- Each function deployment will show success/failure status
- If one function fails, the script will stop (you can continue manually)

