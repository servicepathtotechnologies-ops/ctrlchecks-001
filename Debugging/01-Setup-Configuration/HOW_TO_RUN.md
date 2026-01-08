# 🚀 How to Run Flow Genius AI Project

This guide explains how to run the project locally for development.

---

## 📋 Prerequisites

Before running, ensure you have:

1. **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
2. **Python 3.8+** - [Download here](https://www.python.org/downloads/)
3. **npm** (comes with Node.js)
4. **Supabase Account** (optional for local dev) - [Sign up here](https://supabase.com/)
5. **Hugging Face API Key** (optional) - [Get it here](https://huggingface.co/settings/tokens)

---

## 🎯 Quick Start (Simplest Method)

### Method 1: Using the Batch Script (Windows)

1. **Run the launcher:**
   ```powershell
   .\start_project.bat
   ```

2. **Select option 3** to start both Frontend and Backend

3. **Wait for both services to start:**
   - Backend: `Uvicorn running on http://0.0.0.0:8501`
   - Frontend: `Local: http://localhost:5173`

4. **Open browser:** `http://localhost:5173`

---

## 📝 Step-by-Step Setup (Manual Method)

### Step 1: Install Frontend Dependencies

```powershell
npm install
```

This installs all React/TypeScript dependencies.

---

### Step 2: Set Up Environment Variables (Optional)

#### For Frontend (Supabase):

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_PUBLISHABLE_KEY`

#### For Python Backend (Hugging Face):

**Option A: Using .env file (Recommended)**

1. Create `.env` file in `AI_Agent/multimodal_backend/`:
   ```env
   HUGGINGFACE_API_KEY=your_huggingface_api_key_here
   HF_API_KEY=your_huggingface_api_key_here
   HUGGING_FACE_TOKEN=your_huggingface_api_key_here
   ```

2. Install python-dotenv:
   ```powershell
   cd AI_Agent\multimodal_backend
   pip install python-dotenv
   ```

**Option B: System Environment Variables**

```powershell
# Windows PowerShell
$env:HUGGINGFACE_API_KEY="your_huggingface_api_key_here"
```

---

### Step 3: Install Python Backend Dependencies

```powershell
cd AI_Agent\multimodal_backend
pip install -r requirements.txt
```

---

### Step 4: Start Python Backend

```powershell
cd AI_Agent\multimodal_backend
python main.py
```

**Wait for:** `Uvicorn running on http://0.0.0.0:8501`

**Keep this terminal open!** ⚠️

---

### Step 5: Start Frontend (In a NEW Terminal)

```powershell
# From the root directory
npm run dev
```

**Wait for:** `Local: http://localhost:5173`

---

### Step 6: Open in Browser

Open: **http://localhost:5173**

---

## ✅ Verification

### Check Backend is Running:

1. **Test health endpoint:**
   - Open: `http://localhost:8501/health`
   - Should return: `{"status": "ok"}`

2. **Check terminal output:**
   - Should show: `Uvicorn running on http://0.0.0.0:8501`

### Check Frontend is Running:

1. **Open browser:** `http://localhost:5173`
2. **Should see:** The Flow Genius AI login/signup page
3. **Check console:** No critical errors

### Test AI Functionality:

1. Navigate to `/multimodal-builder`
2. Go to "Image Processing" tab
3. Upload an image
4. Click "Short Note"
5. Should process successfully! 🎉

---

## 🔧 How It Works

### Local Development Architecture:

```
React Frontend (localhost:5173)
    ↓ (direct HTTP calls)
Python Backend (localhost:8501)
    ↓
Hugging Face API / Local Models
```

**Note:** For local development, the frontend calls the Python backend directly - **no Supabase Edge Functions needed!**

---

## 📁 Project Structure

```
flow-genius-ai-main/
├── src/                          # React frontend (TypeScript)
│   ├── components/              # UI components
│   ├── pages/                   # Page components
│   └── ...
├── AI_Agent/
│   └── multimodal_backend/      # Python FastAPI backend
│       ├── main.py              # Backend entry point
│       ├── requirements.txt     # Python dependencies
│       └── services/            # AI services
├── supabase/
│   ├── functions/               # Edge Functions (TypeScript/Deno)
│   │   ├── generate-workflow/  # Workflow generation
│   │   ├── execute-workflow/   # Workflow execution
│   │   └── ...
│   └── config.toml             # Supabase config
└── package.json                # Frontend dependencies
```

---

## 🚀 Available Scripts

### Frontend:

```powershell
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Deploy Functions (Optional):

```powershell
npm run deploy:all              # Deploy all Edge Functions
npm run deploy:generate-workflow  # Deploy workflow generation
npm run deploy:execute-workflow   # Deploy workflow execution
```

---

## ❓ Troubleshooting

### Backend Issues:

**"Module not found" or "No module named X":**
```powershell
cd AI_Agent\multimodal_backend
pip install -r requirements.txt
```

**"Port 8501 already in use":**
- Find and stop the process using port 8501
- Or change the port in `AI_Agent/multimodal_backend/main.py`

**"HUGGINGFACE_API_KEY not found":**
- Make sure you've set the environment variable (see Step 2)
- Or create `.env` file in `AI_Agent/multimodal_backend/`

### Frontend Issues:

**"Port 5173 already in use":**
- Vite will automatically use the next available port
- Check terminal for the actual port number

**"Cannot connect to backend":**
- Make sure Python backend is running (`python main.py`)
- Check backend URL: `http://localhost:8501/health`
- Check browser console for errors

**"Supabase connection errors":**
- These are normal in local dev mode (backend calls are direct)
- Ignore Edge Function errors - they don't affect local development

### General Issues:

**"npm install fails":**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**"Python dependencies fail":**
- Use Python virtual environment:
  ```powershell
  python -m venv .venv
  .venv\Scripts\activate
  pip install -r requirements.txt
  ```

---

## 🎯 Development Modes

### Local Development (Current Setup):
- Frontend → Direct Python Backend
- No Edge Functions needed
- Fastest for development

### Production Mode:
- Frontend → Supabase Edge Functions → Python Backend
- Requires Supabase setup
- For deployment

---

## 📚 Additional Resources

- **Quick Start Guide:** `Debugging/01-Setup-Configuration/QUICK_START.md`
- **Local Dev Setup:** `Debugging/01-Setup-Configuration/LOCAL_DEV_SETUP.md`
- **Environment Setup:** `ENV_SETUP_GUIDE.md`
- **Deployment Guide:** `Debugging/02-Deployment/DEPLOYMENT_GUIDE.md`

---

## ✅ Summary

**To run the project:**

1. ✅ Install dependencies: `npm install` (frontend) + `pip install -r requirements.txt` (backend)
2. ✅ (Optional) Set environment variables
3. ✅ Start backend: `cd AI_Agent\multimodal_backend && python main.py`
4. ✅ Start frontend: `npm run dev` (in new terminal)
5. ✅ Open browser: `http://localhost:5173`

**That's it!** 🎉

---

## 🔄 Daily Development

Once set up, just run:

```powershell
# Terminal 1: Backend
cd AI_Agent\multimodal_backend
python main.py

# Terminal 2: Frontend
npm run dev
```

Or use the batch script: `.\start_project.bat`

