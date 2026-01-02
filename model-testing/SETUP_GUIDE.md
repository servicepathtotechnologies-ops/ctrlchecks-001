# 🚀 Model Testing Suite Setup Guide

## Quick Start

1. **Set Environment Variables**

   Add these to your `.env` file (lines 14-17 as mentioned):
   ```env
   HUGGINGFACE_API_KEY=your_huggingface_key_here
   REPLICATE_API_TOKEN=your_replicate_token_here
   GROQ_API_KEY=your_groq_key_here
   ```

2. **Set Supabase Secrets**

   These should also be set in Supabase Edge Functions secrets:
   - Go to Supabase Dashboard → Edge Functions → Secrets
   - Add: `HUGGINGFACE_API_KEY`, `REPLICATE_API_TOKEN`, `GROQ_API_KEY`

3. **Access the Dashboard**

   Navigate to: `http://localhost:5173/model-testing` (or your app URL)

## Folder Structure

```
model-testing/
├── README.md                    # Main documentation
├── SETUP_GUIDE.md              # This file
├── test-dashboard/             # Main dashboard component
│   └── TestDashboard.tsx
├── text-models/                # Text processing models
│   ├── README.md
│   ├── mistral-7b/
│   │   ├── README.md           # Test cases with input/expected output
│   │   ├── test-config.json    # Test configuration
│   │   └── TestComponent.tsx    # UI component
│   ├── zephyr-7b/
│   │   └── README.md
│   └── llama-70b-groq/
│       └── README.md
├── image-generation/           # Image generation models
│   ├── stable-diffusion-xl/
│   │   └── README.md
│   └── stable-diffusion-v1-5/
│       └── README.md
├── image-understanding/         # Image-to-text models
│   ├── blip-captioning/
│   │   └── README.md
│   └── blip-vqa/
│       └── README.md
├── audio-processing/           # Audio models
│   ├── whisper-stt/
│   │   └── README.md
│   └── bark-tts/
│       └── README.md
└── code-generation/             # Code generation models
    ├── codellama-7b/
    │   └── README.md
    └── deepseek-coder/
        └── README.md
```

## Adding New Test Cases

### Step 1: Create Folder Structure

```bash
mkdir -p model-testing/[category]/[model-name]
```

### Step 2: Create README.md

Each README should include:
- Model information (name, provider, endpoint, limits)
- Test cases with:
  - Input examples
  - Expected outputs
  - Success criteria
- Debugging guide
- Common errors and solutions

### Step 3: Create test-config.json

```json
{
  "model": {
    "name": "model-name",
    "provider": "huggingface|replicate|groq",
    "endpoint": "https://..."
  },
  "testCases": [
    {
      "id": "test-1",
      "name": "Test Name",
      "input": "Test input",
      "expectedOutput": "Expected output description",
      "expectedKeywords": ["keyword1", "keyword2"],
      "maxDuration": 15000
    }
  ]
}
```

### Step 4: Create TestComponent.tsx

Use `Mistral7BTestComponent.tsx` as a template. Key features:
- Load test cases from `test-config.json`
- Run individual or all tests
- Display results with success/failure indicators
- Show expected vs actual output
- Handle custom input testing

### Step 5: Register Component

Add to `src/pages/ModelTestPage.tsx`:
```typescript
import YourTestComponent from '../../../model-testing/[category]/[model]/TestComponent';

const testComponents: Record<string, React.ComponentType> = {
  // ... existing
  '[category]/[model]': YourTestComponent,
};
```

## Testing Workflow

1. **Select Category** from dashboard
2. **Choose Model** to test
3. **Review README** for test cases
4. **Run Tests** using UI
5. **Compare Results** with expected outputs
6. **Debug Issues** using troubleshooting guides

## Troubleshooting

### Tests Not Loading
- Check import paths in `ModelTestPage.tsx`
- Verify component is exported correctly
- Check browser console for errors

### API Errors
- Verify API keys are set correctly
- Check Supabase function logs
- Verify API quotas haven't been exceeded

### Component Errors
- Check TypeScript errors
- Verify all imports are correct
- Ensure test-config.json is valid JSON

## Next Steps

1. Complete remaining test components for all models
2. Add more test cases to existing models
3. Add automated test reporting
4. Add test result history/storage
5. Add comparison between model outputs

