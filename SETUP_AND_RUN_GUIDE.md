# 🚀 How to Run the Project - Complete Guide

## 📋 Prerequisites

Before running the project, make sure you have:

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **npm** or **yarn** (comes with Node.js)
3. **Supabase Account** - [Sign up](https://supabase.com/)
4. **HuggingFace API Key** - [Get it here](https://huggingface.co/settings/tokens)

## 🏗️ Project Structure

```
flow-genius-ai-main/
├── src/                    # React frontend (TypeScript)
├── supabase/
│   └── functions/          # Edge Functions (TypeScript/Deno)
│       └── execute-multimodal-agent/
└── package.json           # Frontend dependencies
```

## 📝 Step-by-Step Setup

### Step 1: Clone/Download the Project

If you haven't already:
```bash
cd C:\Users\User\Desktop\flow-genius-ai-main
```

### Step 2: Install Frontend Dependencies

```bash
npm install
```

This installs all React/TypeScript dependencies.

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory (if it doesn't exist):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Where to find these:**
1. Go to your Supabase Dashboard
2. Click on your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### Step 4: Set Up Supabase Edge Function Secrets

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Edge Functions** → **Secrets**
3. Add the following secret:
   - **Name**: `HUGGINGFACE_API_KEY`
   - **Value**: Your HuggingFace API token

**To get HuggingFace API Key:**
1. Go to [HuggingFace Settings](https://huggingface.co/settings/tokens)
2. Create a new token (read access is enough)
3. Copy the token

### Step 5: Install Supabase CLI (if not installed)

```bash
# Windows (PowerShell)
winget install --id=Supabase.CLI

# Or using npm
npm install -g supabase
```

**Verify installation:**
```bash
supabase --version
```

### Step 6: Login to Supabase CLI

```bash
supabase login
```

This will open your browser to authenticate.

### Step 7: Link Your Project (if needed)

```bash
supabase link --project-ref your-project-ref
```

**Find your project ref:**
- Go to Supabase Dashboard → Your Project → Settings → General
- Copy the **Reference ID**

### Step 8: Deploy Edge Function

```bash
supabase functions deploy execute-multimodal-agent
```

This deploys the Edge Function that handles all AI processing.

**Verify deployment:**
- Go to Supabase Dashboard → Edge Functions
- You should see `execute-multimodal-agent` listed

### Step 9: Run the Frontend Development Server

```bash
npm run dev
```

This starts the React development server, usually at:
- **URL**: `http://localhost:8080` or `http://localhost:5173`
- Check the terminal output for the exact URL

### Step 10: Open in Browser

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:8080`)

## ✅ Verification Checklist

After setup, verify everything works:

### 1. Frontend is Running
- ✅ Browser opens without errors
- ✅ You can see the login/signup page

### 2. Edge Function is Deployed
- ✅ Go to Supabase Dashboard → Edge Functions
- ✅ `execute-multimodal-agent` is listed
- ✅ Status shows "Active"

### 3. Secrets are Set
- ✅ Go to Supabase Dashboard → Edge Functions → Secrets
- ✅ `HUGGINGFACE_API_KEY` is present

### 4. Test AI Functionality
- ✅ Navigate to `/multimodal-builder` in your app
- ✅ Try uploading an image and clicking "Short Note"
- ✅ Should process without errors

## 🎯 Quick Start Commands

Here's a quick reference for daily development:

```bash
# Start development server
npm run dev

# Deploy Edge Function (after making changes)
supabase functions deploy execute-multimodal-agent

# View Edge Function logs
supabase functions logs execute-multimodal-agent

# Test Edge Function locally (optional)
supabase functions serve execute-multimodal-agent
```

## 🐛 Troubleshooting

### Issue: "Module not found" errors

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Issue: "HUGGINGFACE_API_KEY not configured"

**Solution:**
1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add `HUGGINGFACE_API_KEY` with your token
3. Redeploy the function:
   ```bash
   supabase functions deploy execute-multimodal-agent
   ```

### Issue: "Failed to connect to Supabase"

**Solution:**
1. Check `.env` file exists and has correct values
2. Verify Supabase project is active
3. Check network connection

### Issue: Edge Function returns 500 error

**Solution:**
1. Check Edge Function logs:
   ```bash
   supabase functions logs execute-multimodal-agent
   ```
2. Verify `HUGGINGFACE_API_KEY` is set correctly
3. Check HuggingFace API status

### Issue: "Cannot find module" in Edge Function

**Solution:**
- Edge Functions use Deno imports, not npm packages
- All imports should use `https://` URLs
- Check the function code uses correct import paths

## 📱 Running in Production

### Frontend Deployment

The frontend can be deployed to:
- **Vercel** (recommended)
- **Netlify**
- **Any static hosting**

**Build command:**
```bash
npm run build
```

**Output:** `dist/` folder (upload this to your hosting)

### Edge Functions

Edge Functions are automatically hosted by Supabase - no separate deployment needed!

Just deploy with:
```bash
supabase functions deploy execute-multimodal-agent
```

## 🔄 Development Workflow

### Daily Development

1. **Start frontend:**
   ```bash
   npm run dev
   ```

2. **Make changes** to React components in `src/`

3. **Test changes** in browser (auto-reloads)

### When Changing Edge Functions

1. **Edit** function in `supabase/functions/execute-multimodal-agent/index.ts`

2. **Deploy:**
   ```bash
   supabase functions deploy execute-multimodal-agent
   ```

3. **Check logs** if issues:
   ```bash
   supabase functions logs execute-multimodal-agent
   ```

## 📊 Project URLs

After setup, you'll have:

- **Frontend (Local)**: `http://localhost:8080`
- **Frontend (Production)**: Your deployed URL
- **Edge Function**: `https://your-project.supabase.co/functions/v1/execute-multimodal-agent`
- **Supabase Dashboard**: `https://supabase.com/dashboard/project/your-project`

## 🎓 Key Points

1. **No Python needed** - Everything is TypeScript/React
2. **Edge Functions handle AI** - All processing in Supabase Edge Functions
3. **HuggingFace API** - Used directly from Edge Functions
4. **Simple deployment** - Just deploy Edge Function, frontend is static

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Edge Functions Docs**: https://supabase.com/docs/guides/functions
- **React Docs**: https://react.dev
- **HuggingFace API**: https://huggingface.co/docs/api-inference

## ✅ Success Indicators

You know everything is working when:

1. ✅ Frontend loads without errors
2. ✅ You can sign up/login
3. ✅ You can navigate to `/multimodal-builder`
4. ✅ Image processing works (upload image → get caption)
5. ✅ Text tasks work (summarize, translate, etc.)
6. ✅ No 500 errors in browser console

---

**Need help?** Check the logs:
- Browser console (F12) for frontend errors
- Supabase logs for backend errors
- Edge Function logs for AI processing errors

