# 🧪 Model Testing Suite

This folder contains comprehensive UI-based testing tools for all AI models used in the application.

## 📁 Folder Structure

```
model-testing/
├── README.md (this file)
├── test-dashboard/          # Main test dashboard UI
├── text-models/             # Text processing models
│   ├── mistral-7b/
│   ├── zephyr-7b/
│   └── llama-70b-groq/
├── image-generation/        # Image generation models
│   ├── stable-diffusion-xl/
│   └── stable-diffusion-v1-5/
├── image-understanding/      # Image-to-text models
│   ├── blip-captioning/
│   └── blip-vqa/
├── audio-processing/        # Audio models
│   ├── whisper-stt/
│   └── bark-tts/
└── code-generation/         # Code generation models
    ├── codellama-7b/
    └── deepseek-coder/
```

## 🔑 Environment Variables

Make sure these are set in your `.env` file (lines 14-17):

```env
HUGGINGFACE_API_KEY=your_huggingface_key_here
REPLICATE_API_TOKEN=your_replicate_token_here
GROQ_API_KEY=your_groq_key_here
```

**Note:** These should also be set in Supabase Edge Functions secrets for production use.

## 🚀 Quick Start

1. **Access the Test Dashboard:**
   - Navigate to `/model-testing` in your application
   - Or use the direct route: `/model-testing/dashboard`

2. **Run Individual Tests:**
   - Each test case has its own folder with a README
   - Each README contains input examples and expected outputs
   - Use the UI components to test each model interactively

3. **View Test Results:**
   - All tests show real-time results
   - Compare actual output vs expected output
   - Debug issues using the detailed logs

## 📝 Test Case Format

Each test case folder contains:

- **README.md** - Test documentation with:
  - Model information
  - Input examples
  - Expected outputs
  - Common issues and solutions
- **TestComponent.tsx** - UI component for testing
- **test-config.json** - Test configuration and test cases

## 🎯 Testing Workflow

1. **Select a model category** from the dashboard
2. **Choose a specific model** to test
3. **Review the README** for input/output expectations
4. **Run test cases** using the UI
5. **Compare results** with expected outputs
6. **Debug issues** using the provided troubleshooting guides

## 🔍 Debugging

If a test fails:

1. Check the model's README for common issues
2. Verify API keys are correctly configured
3. Review the error logs in the UI
4. Check Supabase function logs for backend errors
5. Verify API quotas/limits haven't been exceeded

## 📊 Test Coverage

- ✅ Text Processing (Q&A, Summarization, Translation)
- ✅ Image Generation (Text-to-Image)
- ✅ Image Understanding (Captioning, VQA)
- ✅ Audio Processing (Speech-to-Text, Text-to-Speech)
- ✅ Code Generation (Multi-language)

## 🔗 Related Documentation

- [API Keys Setup Guide](../Debugging/01-Setup-Configuration/API_KEYS_SETUP_GUIDE.md)
- [Multimodal Models Debug Guide](../Debugging/05-Testing-Debugging/MULTIMODAL_MODELS_DEBUG_GUIDE.md)
- [Supabase 406 Error Fix](../Debugging/01-Setup-Configuration/SUPABASE_406_ERROR_FIX.md)

