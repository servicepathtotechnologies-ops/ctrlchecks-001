# 🚀 Local Development Setup (Simple & Fast)

## ✅ What Changed

**For local development, the frontend now calls the Python backend DIRECTLY** - no Edge Functions needed!

This eliminates:
- ❌ ECONNREFUSED errors
- ❌ Edge Function proxy complexity
- ❌ ngrok/tunneling requirements
- ❌ Deployment needed for testing

## 📋 Quick Start (3 Steps)

### Step 1: Start Python Backend

```powershell
cd AI_Agent\multimodal_backend
python main.py
```

**Wait for:** "Uvicorn running on http://0.0.0.0:8501"

**Keep this terminal open!**

### Step 2: Start Frontend

```powershell
# In a NEW terminal
npm run dev
```

### Step 3: Test It!

1. Open browser: `http://localhost:5173`
2. Go to `/multimodal-builder` → "Image Processing" tab
3. Upload an image
4. Click "Short Note"
5. **Should work immediately!** 🎉

---

## 🔧 How It Works

### Local Development (Automatic)
```
React Frontend
    ↓ (direct fetch)
Python Backend (localhost:8501)
    ↓
BLIP + FLAN-T5 (local models)
```

**No Edge Functions involved!**

### Production (When Deployed)
```
React Frontend
    ↓ (Supabase Edge Function)
Edge Function (proxy)
    ↓
Python Backend (deployed)
    ↓
BLIP + FLAN-T5
```

---

## ⚙️ Configuration

The frontend automatically detects local dev mode using:

1. **Environment Variable** (optional):
   ```env
   VITE_USE_DIRECT_BACKEND=true
   VITE_PYTHON_BACKEND_URL=http://localhost:8501
   ```

2. **Auto-Detection** (default):
   - If `VITE_USE_DIRECT_BACKEND` is not set, it checks:
     - Is Vite in dev mode? (`import.meta.env.DEV`)
     - Is Supabase configured? (if not, use direct backend)

**You don't need to configure anything!** It just works in local dev.

---

## 🎯 Why This Works

### Before (Broken):
```
Frontend → Edge Function → ❌ Can't reach localhost:8501 → Error
```

### Now (Works):
```
Frontend → ✅ Direct call to localhost:8501 → Success
```

**Key difference:** Frontend calls Python backend directly, no proxy needed.

---

## 📝 Environment Variables (Optional)

Add to `.env` if you want explicit control:

```env
# Use direct Python backend (bypass Edge Function)
VITE_USE_DIRECT_BACKEND=true

# Python backend URL (default: http://localhost:8501)
VITE_PYTHON_BACKEND_URL=http://localhost:8501
```

**Note:** These are optional. The code auto-detects local dev mode.

---

## 🐛 Troubleshooting

### Issue: "Failed to connect to Python backend"

**Solution:**
1. Make sure Python backend is running: `python main.py`
2. Check terminal shows: "Uvicorn running on http://0.0.0.0:8501"
3. Try accessing: `http://localhost:8501/health` in browser

### Issue: "CORS error"

**Solution:** Python backend already has CORS enabled. If you see CORS errors:
1. Check Python backend is running
2. Check browser console for exact error
3. Make sure you're accessing frontend on `localhost` (not `127.0.0.1`)

### Issue: Still using Edge Function

**Solution:** 
1. Check `.env` - make sure `VITE_USE_DIRECT_BACKEND=true` is set
2. Or just rely on auto-detection (works in Vite dev mode)

---

## ✅ Benefits

1. **✅ No Edge Function needed locally** - Faster development
2. **✅ No deployment needed** - Test immediately
3. **✅ No tunneling** - No ngrok, no hassle
4. **✅ Same backend code** - Works in production too
5. **✅ Immediate feedback** - See errors instantly

---

## 🚀 Production Deployment

When you deploy to production:

1. **Deploy Python backend** to Railway/Render/Fly.io/etc.
2. **Set Supabase secret**: `PYTHON_BACKEND_URL=https://your-backend.com`
3. **Deploy Edge Function**: `supabase functions deploy execute-multimodal-agent`
4. **Set environment variable**: `VITE_USE_DIRECT_BACKEND=false` (or remove it)

The frontend will automatically use Edge Functions in production.

---

## 🎉 That's It!

**For local development:**
1. ✅ Start Python backend
2. ✅ Start frontend
3. ✅ Test immediately

**No Edge Functions, no proxies, no complexity!** 🚀

