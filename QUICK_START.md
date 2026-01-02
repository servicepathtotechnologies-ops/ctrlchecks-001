# ⚡ Quick Start - Local Development

## 🎯 The Simplest Way to Run (2 Steps)

### Step 1: Start Python Backend

```powershell
cd AI_Agent\multimodal_backend
python main.py
```

**Wait for:** `Uvicorn running on http://0.0.0.0:8501`

### Step 2: Start Frontend

```powershell
# In a NEW terminal (keep Python backend running!)
npm run dev
```

**Open:** `http://localhost:5173/multimodal-builder`

---

## ✅ That's It!

The frontend **automatically calls the Python backend directly** - no Edge Functions, no configuration needed!

**Test it:**
1. Go to "Image Processing" tab
2. Upload an image
3. Click "Short Note"
4. **Works immediately!** 🎉

---

## 🔧 How It Works

**Local Development:**
```
Frontend → Direct call to localhost:8501 → Python Backend → BLIP/FLAN-T5
```

**No Edge Functions involved!**

---

## ❓ Troubleshooting

### "Failed to connect to Python backend"
- ✅ Make sure Python backend is running (`python main.py`)
- ✅ Check terminal shows "Uvicorn running on http://0.0.0.0:8501"
- ✅ Try: `http://localhost:8501/health` in browser

### Still seeing Edge Function errors?
- ✅ That's normal - Edge Functions aren't used in local dev
- ✅ Ignore those errors, they don't affect functionality

---

## 📚 More Info

See `LOCAL_DEV_SETUP.md` for detailed documentation.

