/**
 * Multimodal Models Debugging Script
 * 
 * This script tests whether the multimodal models are working correctly
 * and can retrieve information according to user requirements.
 * 
 * Usage:
 *   deno run --allow-net --allow-env scripts/test-multimodal-models.ts
 */

import { HuggingFaceClient } from "../supabase/functions/_shared/huggingface-client.ts";
import { FREE_MODELS } from "../supabase/functions/build-multimodal-agent/services/FreeModelRegistry.ts";

interface TestResult {
  testName: string;
  success: boolean;
  error?: string;
  output?: string;
  duration?: number;
  isFallback?: boolean;
}

const results: TestResult[] = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runTest(
  testName: string,
  testFn: () => Promise<string>
): Promise<TestResult> {
  log(`\n🧪 Testing: ${testName}`, 'cyan');
  const startTime = Date.now();
  
  try {
    const output = await testFn();
    const duration = Date.now() - startTime;
    const isFallback = output.startsWith("Processed:") || 
                      output.startsWith("[AI Processing]") ||
                      output.length < 20;
    
    if (isFallback) {
      log(`⚠️  WARNING: Test returned fallback response`, 'yellow');
      log(`   Output: ${output.substring(0, 100)}...`, 'yellow');
    } else {
      log(`✅ Test passed!`, 'green');
      log(`   Output: ${output.substring(0, 150)}...`, 'green');
    }
    
    return {
      testName,
      success: !isFallback,
      output,
      duration,
      isFallback,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Test failed: ${errorMsg}`, 'red');
    
    return {
      testName,
      success: false,
      error: errorMsg,
      duration,
    };
  }
}

async function testAPIKey(): Promise<boolean> {
  log(`\n🔑 Checking API Key Configuration...`, 'blue');
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  
  if (!apiKey) {
    log(`❌ HUGGINGFACE_API_KEY is not set!`, 'red');
    log(`   Please set it using: export HUGGINGFACE_API_KEY=your_key_here`, 'yellow');
    return false;
  }
  
  if (!apiKey.startsWith("hf_")) {
    log(`⚠️  API key doesn't start with 'hf_' - may be invalid`, 'yellow');
  }
  
  log(`✅ API Key found (${apiKey.substring(0, 10)}...)`, 'green');
  return true;
}

async function testTextModel(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.text_models.mistral_7b;
  
  const prompt = "What is artificial intelligence? Provide a brief explanation in 2-3 sentences.";
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 150,
    return_full_text: false,
    temperature: 0.7,
  });
}

async function testSummarization(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.text_models.mistral_7b;
  
  const longText = `
    Artificial intelligence (AI) is transforming the way we work and live. 
    Machine learning algorithms can now process vast amounts of data to identify patterns 
    and make predictions. Natural language processing enables computers to understand and 
    generate human language. Computer vision allows machines to interpret visual information. 
    These technologies are being applied across industries from healthcare to finance to transportation.
  `;
  
  const prompt = `Please provide a concise summary of the following text:\n\n${longText}`;
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 100,
    return_full_text: false,
    temperature: 0.5,
  });
}

async function testInformationExtraction(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.text_models.mistral_7b;
  
  const text = `
    Meeting Details:
    - Date: March 15, 2024
    - Time: 2:00 PM
    - Location: Conference Room A
    - Attendees: John Smith, Jane Doe, Bob Johnson
    - Topic: Q1 Product Launch Planning
  `;
  
  const prompt = `Extract the key information from the following text. List the date, time, location, and attendees:\n\n${text}`;
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 150,
    return_full_text: false,
    temperature: 0.3,
  });
}

async function testTranslation(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.text_models.mistral_7b;
  
  const text = "Bonjour, comment allez-vous? Je m'appelle Marie.";
  const prompt = `Translate the following French text to English:\n\n${text}`;
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 50,
    return_full_text: false,
    temperature: 0.3,
  });
}

async function testAnalysis(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.text_models.mistral_7b;
  
  const data = `
    Sales Report Q1 2024:
    - January: $50,000
    - February: $65,000
    - March: $80,000
    - Total: $195,000
  `;
  
  const prompt = `Analyze the following sales data and provide insights about the trend:\n\n${data}`;
  const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 150,
    return_full_text: false,
    temperature: 0.7,
  });
}

async function testCodeGeneration(): Promise<string> {
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) throw new Error("API key not set");
  
  const client = new HuggingFaceClient(apiKey);
  const model = FREE_MODELS.code_generation.codellama_7b;
  
  const prompt = "Write a Python function to calculate the factorial of a number.";
  // CodeLlama uses different prompt format
  const formattedPrompt = `[INST] ${prompt} [/INST]`;
  
  return await client.generateText(model.name, formattedPrompt, {
    max_new_tokens: 200,
    return_full_text: false,
    temperature: 0.2,
  });
}

async function testModelConnectivity(): Promise<boolean> {
  log(`\n🌐 Testing Model Connectivity...`, 'blue');
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) return false;
  
  try {
    const client = new HuggingFaceClient(apiKey);
    const model = FREE_MODELS.text_models.mistral_7b;
    
    // Simple connectivity test
    const testPrompt = "Say hello";
    const formattedPrompt = `<s>[INST] ${testPrompt} [/INST]`;
    
    const result = await client.generateText(model.name, formattedPrompt, {
      max_new_tokens: 10,
      return_full_text: false,
    });
    
    if (result && result.length > 0) {
      log(`✅ Model connectivity test passed`, 'green');
      return true;
    }
    
    log(`⚠️  Model connectivity test returned empty result`, 'yellow');
    return false;
  } catch (error) {
    log(`❌ Model connectivity test failed: ${error}`, 'red');
    return false;
  }
}

function generateReport() {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`📊 TEST REPORT`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = results.filter(r => !r.success).length;
  const fallbackTests = results.filter(r => r.isFallback).length;
  
  log(`\n📈 Summary:`, 'cyan');
  log(`   Total Tests: ${totalTests}`, 'reset');
  log(`   ✅ Passed: ${passedTests}`, 'green');
  log(`   ❌ Failed: ${failedTests}`, 'red');
  log(`   ⚠️  Fallback: ${fallbackTests}`, 'yellow');
  
  log(`\n📋 Detailed Results:`, 'cyan');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`\n${index + 1}. ${status} ${result.testName}`, color);
    
    if (result.duration) {
      log(`   Duration: ${result.duration}ms`, 'reset');
    }
    
    if (result.isFallback) {
      log(`   ⚠️  Using fallback response (model may not be working)`, 'yellow');
    }
    
    if (result.error) {
      log(`   Error: ${result.error}`, 'red');
    }
    
    if (result.output && result.output.length < 200) {
      log(`   Output: ${result.output}`, 'reset');
    } else if (result.output) {
      log(`   Output: ${result.output.substring(0, 200)}...`, 'reset');
    }
  });
  
  log(`\n${'='.repeat(60)}`, 'blue');
  
  // Recommendations
  if (fallbackTests > 0 || failedTests > 0) {
    log(`\n💡 Recommendations:`, 'yellow');
    
    if (fallbackTests > 0) {
      log(`   1. Check HUGGINGFACE_API_KEY is set correctly`, 'yellow');
      log(`   2. Verify API key has sufficient credits/quota`, 'yellow');
      log(`   3. Check Supabase function logs for detailed errors`, 'yellow');
      log(`   4. Ensure models are available on HuggingFace`, 'yellow');
    }
    
    if (failedTests > 0) {
      log(`   5. Review error messages above for specific issues`, 'yellow');
      log(`   6. Test API key directly with HuggingFace API`, 'yellow');
    }
  } else {
    log(`\n🎉 All tests passed! Models are working correctly.`, 'green');
  }
  
  log(`\n`, 'reset');
}

async function main() {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`🚀 MULTIMODAL MODELS DEBUGGING SCRIPT`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
  
  // Check API key first
  const hasApiKey = await testAPIKey();
  if (!hasApiKey) {
    log(`\n❌ Cannot proceed without API key. Exiting.`, 'red');
    Deno.exit(1);
  }
  
  // Test model connectivity
  const isConnected = await testModelConnectivity();
  if (!isConnected) {
    log(`\n⚠️  Model connectivity test failed, but continuing with other tests...`, 'yellow');
  }
  
  // Run all tests
  results.push(await runTest("Text Generation (Q&A)", testTextModel));
  results.push(await runTest("Text Summarization", testSummarization));
  results.push(await runTest("Information Extraction", testInformationExtraction));
  results.push(await runTest("Translation", testTranslation));
  results.push(await runTest("Data Analysis", testAnalysis));
  results.push(await runTest("Code Generation", testCodeGeneration));
  
  // Generate report
  generateReport();
}

// Run the tests
if (import.meta.main) {
  main().catch(error => {
    log(`\n❌ Fatal error: ${error}`, 'red');
    Deno.exit(1);
  });
}

