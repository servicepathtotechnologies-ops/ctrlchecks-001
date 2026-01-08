/**
 * Advanced Autonomous Workflow AI Agent
 * 
 * A self-correcting, learning, planning agent that converts user prompts
 * into fully working, error-free workflows with 100% functional accuracy.
 * 
 * Agent Types:
 * - Goal-Based Agent: Works towards achieving USER_GOAL
 * - Learning Agent: Learns from successful patterns and errors
 * - Planning Agent: Breaks goals into sub-tasks and plans execution
 * - Self-Healing Agent: Automatically fixes errors without human intervention
 * - Memory-Driven Agent: Uses past experiences to improve decisions
 */

import { LLMMessage, LLMResponse, LLMOptions, LLMAdapter } from "./llm-adapter.ts";
import { validateAndFixWorkflow } from "./workflow-validation.ts";

export interface AgentMemory {
  successfulPatterns: Array<{
    pattern: string;
    workflow: any;
    timestamp: number;
  }>;
  errorFixes: Array<{
    error: string;
    fix: string;
    timestamp: number;
  }>;
  nodeCombinations: Array<{
    nodes: string[];
    success: boolean;
    timestamp: number;
  }>;
}

export interface AgentState {
  phase: 'understand' | 'planning' | 'construction' | 'validation' | 'healing' | 'verification' | 'learning';
  iteration: number;
  maxIterations: number;
  goal: string;
  userConfig?: Record<string, any>;
  analysis?: any;
  plan?: any;
  workflow?: any;
  errors: Array<{ type: string; message: string; fix: string }>;
  memory: AgentMemory;
}

export interface AutonomousAgentConfig {
  apiKey: string; // Gemini API key (for fallback)
  huggingFaceApiKey?: string; // Hugging Face API key (optional, defaults to env var)
  provider?: 'huggingface' | 'gemini'; // Primary provider (defaults to 'huggingface')
  model?: string; // Model name (provider-specific)
  temperature?: number;
  maxIterations?: number;
  enableLearning?: boolean;
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface ProgressUpdate {
  status: 'generating' | 'completed' | 'error';
  estimated_time_seconds: number;
  elapsed_time_seconds: number;
  progress_percentage: number;
  current_phase: string;
}

export interface AgentQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface AnalysisResult {
  summary: string;
  questions: AgentQuestion[];
  clarifiedPromptPreview: string;
  predictedStepCount: number;
}

export interface RefinementResult {
  refinedPrompt: string;
  requirements: Array<{
    key: string;
    label: string;
    type: 'text' | 'url' | 'api_key' | 'credentials' | 'file';
    description: string;
  }>;
}

/**
 * Check if an object contains a valid workflow structure
 * Accepts multiple formats: {nodes, edges}, {workflow}, {analysis, plan}
 */
function isValidWorkflow(obj: any): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  // Format 1: Direct workflow { nodes: [...], edges: [...] }
  if (Array.isArray(obj.nodes)) {
    return true;
  }
  
  // Format 2: Nested workflow { workflow: { nodes: [...], edges: [...] } }
  if (obj.workflow && Array.isArray(obj.workflow.nodes)) {
    return true;
  }
  
  // Format 3: Analysis/Plan format (legacy, but still valid)
  if (obj.analysis && obj.plan) {
    return true;
  }
  
  return false;
}

/**
 * Extract the first valid JSON object from text
 * Handles markdown code blocks, explanations, etc.
 */
function extractFirstJSONObject(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.trim();
  
  // Try to extract from ```json blocks
  if (cleaned.includes('```json')) {
    const match = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
  } else if (cleaned.includes('```')) {
    // Try generic code blocks
    const match = cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
  }
  
  // Find first { ... } block
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('No JSON object found in response');
  }
  
  let braceCount = 0;
  let endIndex = firstBrace;
  
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++;
    if (cleaned[i] === '}') braceCount--;
    if (braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  if (braceCount !== 0) {
    throw new Error('Malformed JSON: unmatched braces');
  }
  
  return cleaned.substring(firstBrace, endIndex);
}

/**
 * Normalize workflow object to standard format { nodes, edges }
 */
function normalizeWorkflow(obj: any): { nodes: any[]; edges: any[] } {
  // Format 1: Direct workflow
  if (Array.isArray(obj.nodes)) {
    return {
      nodes: obj.nodes,
      edges: Array.isArray(obj.edges) ? obj.edges : []
    };
  }
  
  // Format 2: Nested workflow
  if (obj.workflow && Array.isArray(obj.workflow.nodes)) {
    return {
      nodes: obj.workflow.nodes,
      edges: Array.isArray(obj.workflow.edges) ? obj.workflow.edges : []
    };
  }
  
  // Format 3: Analysis/Plan (cannot be normalized to workflow, return empty)
  if (obj.analysis && obj.plan) {
    return { nodes: [], edges: [] };
  }
  
  throw new Error('Invalid workflow format: cannot normalize');
}

export class AutonomousWorkflowAgent {
  private llm: LLMAdapter;
  private config: Required<Omit<AutonomousAgentConfig, 'onProgress' | 'huggingFaceApiKey' | 'provider'>> & { 
    onProgress?: (progress: ProgressUpdate) => void;
    huggingFaceApiKey?: string;
    provider: 'huggingface' | 'gemini';
  };
  private state: AgentState;
  private nodeKnowledge: string;
  private startTime: number = 0;
  private estimatedTime: number = 0;

  constructor(config: AutonomousAgentConfig, nodeKnowledge: string) {
    this.llm = new LLMAdapter();
    this.config = {
      apiKey: config.apiKey,
      huggingFaceApiKey: config.huggingFaceApiKey || Deno.env.get('HUGGINGFACE_API_KEY'),
      provider: config.provider || 'huggingface', // Default to Hugging Face
      model: config.model || (config.provider === 'gemini' ? 'gemini-2.5-flash' : 'qwen-7b'),
      temperature: config.temperature ?? 0.3,
      maxIterations: config.maxIterations ?? 10,
      enableLearning: config.enableLearning ?? false, // Default to false for speed
      onProgress: config.onProgress,
    };
    this.nodeKnowledge = nodeKnowledge;
    this.state = {
      phase: 'understand',
      iteration: 0,
      maxIterations: this.config.maxIterations,
      goal: '',
      userConfig: {},
      errors: [],
      memory: {
        successfulPatterns: [],
        errorFixes: [],
        nodeCombinations: [],
      },
    };
  }

  /**
   * Estimate generation time based on prompt complexity
   */
  private estimateTime(userGoal: string): number {
    const goalLower = userGoal.toLowerCase();
    let baseTime = 15; // Base time in seconds

    // Complexity factors
    const hasSheets = goalLower.includes('google sheet') || goalLower.includes('sheets');
    const hasDoc = goalLower.includes('google doc') || goalLower.includes('document');
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const hasSlack = goalLower.includes('slack');
    const hasMultipleIntegrations = [hasSheets, hasDoc, hasGmail, hasSlack].filter(Boolean).length;

    // Add time for each integration
    baseTime += hasMultipleIntegrations * 3;

    // Add time for JavaScript parsing if Sheets present
    if (hasSheets) baseTime += 2;

    // Add time for merging if both Sheets and Doc
    if (hasSheets && hasDoc) baseTime += 2;

    // Add time for multiple output channels
    if (hasGmail && hasSlack) baseTime += 2;

    // Add time based on prompt length (complexity indicator)
    const promptLength = userGoal.length;
    if (promptLength > 200) baseTime += 3;
    if (promptLength > 400) baseTime += 3;

    return Math.max(12, Math.min(45, baseTime)); // Clamp between 12-45 seconds
  }

  /**
   * Get current progress percentage based on phase
   */
  private getCurrentProgressPercentage(): number {
    const phaseProgress: Record<string, number> = {
      'understand': 20,
      'planning': 50,
      'construction': 75,
      'validation': 90,
      'healing': 85,
      'verification': 95,
      'learning': 99,
    };
    return phaseProgress[this.state.phase] || 0;
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(phase: string, progressPercentage: number): void {
    if (!this.config.onProgress) return;

    const elapsed = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;

    this.config.onProgress({
      status: 'generating',
      estimated_time_seconds: this.estimatedTime,
      elapsed_time_seconds: Math.round(elapsed * 10) / 10,
      progress_percentage: Math.min(99, Math.max(0, Math.round(progressPercentage))),
      current_phase: phase,
    });
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Strip debug text, comments, stack traces, and verbose logs from text
   */
  private stripDebugText(text: string): string {
    // Remove console.log statements and their content
    text = text.replace(/console\.(log|warn|error|debug)\([^)]*\)/g, '');
    // Remove comments (single-line and multi-line)
    text = text.replace(/\/\/.*$/gm, '');
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove stack traces
    text = text.replace(/at\s+[\w\.]+\([^)]+\)/g, '');
    // Remove verbose error messages
    text = text.replace(/Error:\s*[^\n]+/g, '');
    // Remove excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  /**
   * Compress node reference to only relevant nodes based on goal
   */
  private compressNodeReference(fullReference: string, userGoal: string, requiredNodes: string[]): string {
    const goalLower = userGoal.toLowerCase();
    
    // Extract only relevant sections from node reference
    const sections: string[] = [];
    
    // Determine trigger type from goal
    let triggerType = 'manual_trigger';
    if (goalLower.includes('form') || goalLower.includes('collect data') || goalLower.includes('user data')) {
      triggerType = 'form';
    } else if (goalLower.includes('webhook') || goalLower.includes('http request')) {
      triggerType = 'webhook';
    } else if (goalLower.includes('schedule') || goalLower.includes('daily') || goalLower.includes('every')) {
      triggerType = 'schedule';
    } else if (goalLower.includes('chat') || goalLower.includes('chatbot')) {
      triggerType = 'chat_trigger';
    }
    
    sections.push(`TRIGGERS: ${triggerType} (primary), manual_trigger, webhook, schedule, form`);
    
    // Include only required node types with minimal descriptions
    const nodeDescriptions: Record<string, string> = {
      'google_sheets': 'google_sheets: read/append data (returns array-of-arrays)',
      'google_doc': 'google_doc: read document content',
      'google_gmail': 'google_gmail: send email (operation: "send")',
      'slack_webhook': 'slack_webhook/slack_message: send to Slack',
      'if_else': 'if_else: conditional logic (needs true + false edges)',
      'javascript': 'javascript: custom code (return {content, text, body})',
      'form': 'form: collect user input (data in input.data)',
      'webhook': 'webhook: receive HTTP (data in input.body)',
      'database_read': 'database_read: read from Supabase',
      'database_write': 'database_write: write to Supabase',
      'http_request': 'http_request: call external API',
    };
    
    // Add relevant node descriptions
    const addedNodes = new Set<string>();
    for (const node of requiredNodes) {
      if (nodeDescriptions[node] && !addedNodes.has(node)) {
        sections.push(nodeDescriptions[node]);
        addedNodes.add(node);
      }
    }
    
    // Add critical rules only (compressed)
    sections.push(`CRITICAL RULES:
- ${triggerType === 'form' ? 'Form: data in input.data' : triggerType === 'webhook' ? 'Webhook: data in input.body' : 'Trigger: use appropriate type'}
- Google Sheets: add javascript node after to parse arrays
- JavaScript: return {content: "text"}
- Output: use {{input.content}} or {{input.text}}
- if_else: needs both true and false edges`);
    
    return sections.join('\n');
  }

  /**
   * Trim execution history to last N steps only
   */
  private trimExecutionHistory(history: any[], maxSteps: number = 3): any[] {
    if (!Array.isArray(history) || history.length <= maxSteps) {
      return history;
    }
    return history.slice(-maxSteps);
  }

  /**
   * Compress training examples to minimal format
   */
  private compressTrainingExamples(trainingContext: string, maxTokens: number = 500): string {
    if (this.estimateTokens(trainingContext) <= maxTokens) {
      return trainingContext;
    }
    
    // Extract only the most relevant example
    const lines = trainingContext.split('\n');
    let compressed = '';
    let currentExample = '';
    let tokenCount = 0;
    
    for (const line of lines) {
      const lineTokens = this.estimateTokens(line);
      if (tokenCount + lineTokens > maxTokens) {
        break;
      }
      currentExample += line + '\n';
      tokenCount += lineTokens;
    }
    
    return currentExample.trim() || 'No training examples (token limit)';
  }

  /**
   * Actively reduce prompt size to fit within token budget
   * Returns modified messages that fit within the budget
   */
  private reducePromptToFitBudget(messages: LLMMessage[], maxTokens: number = 10500): LLMMessage[] {
    const fullText = messages.map(m => m.content).join('\n');
    let currentTokens = this.estimateTokens(fullText);
    
    if (currentTokens <= maxTokens) {
      return messages;
    }
    
    console.warn(`[TOKEN_BUDGET] Prompt too large (${currentTokens} tokens), reducing to fit ${maxTokens} token budget...`);
    
    // Clone messages to avoid mutating original
    const reducedMessages = messages.map(m => ({ ...m, content: m.content }));
    
    // Strategy 1: Strip debug text from all messages
    for (let i = 0; i < reducedMessages.length; i++) {
      reducedMessages[i].content = this.stripDebugText(reducedMessages[i].content);
    }
    
    currentTokens = this.estimateTokens(reducedMessages.map(m => m.content).join('\n'));
    if (currentTokens <= maxTokens) {
      console.log(`[TOKEN_BUDGET] Reduced to ${currentTokens} tokens by stripping debug text`);
      return reducedMessages;
    }
    
    // Strategy 2: Compress user message (contains node reference, training examples, etc.)
    const userMessage = reducedMessages.find(m => m.role === 'user');
    if (userMessage) {
      let userContent = userMessage.content;
      
      // Extract components
      const goalMatch = userContent.match(/USER GOAL:\s*"([^"]+)"/);
      const configMatch = userContent.match(/USER (?:PROVIDED )?CONFIG[^]*?(?=REQUIRED|TRAINING|NODE|RULES|$)/i);
      const requiredNodesMatch = userContent.match(/REQUIRED NODES[:\s]+(\[[^\]]+\]|[\w\s,]+)/);
      const trainingMatch = userContent.match(/(TRAINING|EXAMPLE)[^]*?(?=NODE|RULES|Return|$)/i);
      const nodeRefMatch = userContent.match(/(NODE REFERENCE|COMPREHENSIVE|SYSTEM CAPABILITIES|RULES:)[^]*?(?=RULES:|Return|$)/i);
      const rulesMatch = userContent.match(/RULES:[^]*?(?=Return|$)/);
      const jsonExampleMatch = userContent.match(/Return[^]*$/);
      
      const goal = goalMatch ? goalMatch[1] : this.state.goal || '';
      let requiredNodes: string[] = [];
      if (requiredNodesMatch) {
        try {
          requiredNodes = JSON.parse(requiredNodesMatch[1]);
        } catch {
          // If not JSON, try to extract node names
          const nodesText = requiredNodesMatch[1];
          requiredNodes = nodesText.split(',').map(n => n.trim()).filter(n => n.length > 0);
        }
      }
      
      // Rebuild with compressed components
      let compressedContent = `You are an expert workflow construction agent. Build a COMPLETE, executable workflow.\n\n`;
      compressedContent += `USER GOAL: "${goal}"\n\n`;
      
      if (configMatch) {
        const configText = configMatch[0];
        if (this.estimateTokens(configText) > 500) {
          compressedContent += `USER CONFIG: [Config provided - use values as needed]\n\n`;
        } else {
          compressedContent += configText + '\n\n';
        }
      }
      
      if (requiredNodesMatch) {
        compressedContent += `REQUIRED NODES: ${JSON.stringify(requiredNodes)}\n\n`;
      }
      
      // Compress training examples
      if (trainingMatch) {
        const trainingText = this.compressTrainingExamples(trainingMatch[0], 300);
        compressedContent += `TRAINING EXAMPLE:\n${trainingText}\n\n`;
      }
      
      // Compress node reference
      if (nodeRefMatch) {
        const nodeRefText = this.compressNodeReference(nodeRefMatch[0], goal, requiredNodes);
        compressedContent += `NODE REFERENCE:\n${nodeRefText}\n\n`;
      } else {
        // If no node reference found, add minimal one
        const minimalRef = this.compressNodeReference('', goal, requiredNodes);
        compressedContent += `NODE REFERENCE:\n${minimalRef}\n\n`;
      }
      
      // Keep rules but compress
      if (rulesMatch) {
        const rulesText = rulesMatch[0];
        // Keep only essential rules (first 8 lines)
        const essentialRules = rulesText.split('\n').slice(0, 8).join('\n');
        compressedContent += `${essentialRules}\n\n`;
      } else {
        // Add minimal rules if not found
        compressedContent += `RULES:\n1. Use correct trigger type\n2. Include all required nodes\n3. Use template variables\n4. Connect nodes properly\n\n`;
      }
      
      // Keep JSON example
      if (jsonExampleMatch) {
        compressedContent += jsonExampleMatch[0];
      }
      
      userMessage.content = compressedContent;
    }
    
    currentTokens = this.estimateTokens(reducedMessages.map(m => m.content).join('\n'));
    
    // Strategy 3: If still too large, aggressively truncate user message
    if (currentTokens > maxTokens && userMessage) {
      const systemTokens = this.estimateTokens(reducedMessages.filter(m => m.role !== 'user').map(m => m.content).join('\n'));
      const targetUserTokens = maxTokens - systemTokens - 500; // Reserve 500 tokens safety margin
      const currentUserTokens = this.estimateTokens(userMessage.content);
      
      if (currentUserTokens > targetUserTokens) {
        // Keep only essential parts: goal, required nodes, minimal rules, JSON example
        const goalMatch = userMessage.content.match(/USER GOAL:\s*"([^"]+)"/);
        const requiredNodesMatch = userMessage.content.match(/REQUIRED NODES[:\s]+(\[[^\]]+\]|[\w\s,]+)/);
        const jsonExampleMatch = userMessage.content.match(/Return[^]*$/);
        
        let minimalContent = `You are a workflow construction agent.\n\n`;
        if (goalMatch) {
          minimalContent += `USER GOAL: "${goalMatch[1]}"\n\n`;
        }
        if (requiredNodesMatch) {
          minimalContent += `REQUIRED NODES: ${requiredNodesMatch[1]}\n\n`;
        }
        minimalContent += `RULES: Use correct trigger, include all required nodes, use template variables, connect properly.\n\n`;
        if (jsonExampleMatch) {
          minimalContent += jsonExampleMatch[0];
        }
        
        // Verify it fits
        const minimalTokens = this.estimateTokens(minimalContent);
        if (minimalTokens <= targetUserTokens) {
          userMessage.content = minimalContent;
          console.warn(`[TOKEN_BUDGET] Aggressively compressed user message to minimal format`);
        } else {
          // Last resort: truncate JSON example
          const jsonPart = jsonExampleMatch ? jsonExampleMatch[0] : '';
          const jsonTokens = this.estimateTokens(jsonPart);
          const remainingTokens = targetUserTokens - this.estimateTokens(minimalContent.replace(jsonPart, ''));
          if (jsonTokens > remainingTokens) {
            const jsonRatio = remainingTokens / jsonTokens;
            const truncatedJson = jsonPart.substring(0, Math.floor(jsonPart.length * jsonRatio * 0.9));
            minimalContent = minimalContent.replace(jsonPart, truncatedJson + '...');
          }
          userMessage.content = minimalContent;
          console.warn(`[TOKEN_BUDGET] Last resort: truncated to minimal format`);
        }
      }
    }
    
    const finalTokens = this.estimateTokens(reducedMessages.map(m => m.content).join('\n'));
    console.log(`[TOKEN_BUDGET] Final prompt size: ${finalTokens} tokens (target: ${maxTokens})`);
    
    if (finalTokens > maxTokens) {
      // Last resort: return minimal prompt
      console.error(`[TOKEN_BUDGET] CRITICAL: Still exceeds budget after all compression. Using minimal prompt.`);
      const goalMatch = reducedMessages.find(m => m.role === 'user')?.content.match(/USER GOAL:\s*"([^"]+)"/);
      const goal = goalMatch ? goalMatch[1] : 'Generate workflow';
      
      reducedMessages[reducedMessages.findIndex(m => m.role === 'user')].content = 
        `USER GOAL: "${goal}"\n\nBuild workflow JSON with nodes and edges. Use appropriate trigger and required nodes.`;
      
      const emergencyTokens = this.estimateTokens(reducedMessages.map(m => m.content).join('\n'));
      if (emergencyTokens > maxTokens) {
        throw new Error(`CRITICAL: Even minimal prompt (${emergencyTokens} tokens) exceeds budget (${maxTokens}). System error.`);
      }
    }
    
    return reducedMessages;
  }

  /**
   * Check token count and actively reduce prompt if exceeds limit
   * Hugging Face Router limit: inputs + max_new_tokens <= 32769
   * We enforce: MAX_INPUT_TOKENS = 10500 (safe margin), max_new_tokens = 512
   */
  private checkTokenBudget(messages: LLMMessage[]): LLMMessage[] {
    const MAX_INPUT_TOKENS = 10500; // Safe margin below 12000
    const MAX_NEW_TOKENS = 512;
    
    // Actively reduce prompt to fit budget
    const reducedMessages = this.reducePromptToFitBudget(messages, MAX_INPUT_TOKENS);
    
    const fullText = reducedMessages.map(m => m.content).join('\n');
    const estimatedTokens = this.estimateTokens(fullText);
    
    // Final validation
    if (estimatedTokens > MAX_INPUT_TOKENS) {
      throw new Error(`Prompt exceeds Hugging Face token limit: ${estimatedTokens} tokens (max: ${MAX_INPUT_TOKENS}). Unable to reduce further.`);
    }
    
    if (estimatedTokens + MAX_NEW_TOKENS > 32769) {
      throw new Error(`Token limit violation: input tokens (${estimatedTokens}) + max_new_tokens (${MAX_NEW_TOKENS}) = ${estimatedTokens + MAX_NEW_TOKENS} > 32769.`);
    }
    
    return reducedMessages;
  }

  /**
   * Call Hugging Face Router ONLY - no fallbacks, no retries
   * 
   * CRITICAL FIXES:
   * - Hard 8s timeout protection
   * - NO fallbacks (HF Router ONLY)
   * - NO retries (single call)
   * - Observability logging
   * - Token budget check (fail fast at 12k)
   */
  private async callLLMWithFallback(
    messages: LLMMessage[],
    options: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    // HARD TOKEN BUDGET: Fail fast if exceeds 12k
    this.checkTokenBudget(messages);
    const startTime = Date.now();
    
    if (!this.config.huggingFaceApiKey) {
      throw new Error('HuggingFace API key not configured');
    }
    
    console.log(`[AGENT] Using Hugging Face Router ONLY (${this.config.model}) - no fallbacks, no retries`);
    
    // HARD TIMEOUT PROTECTION: 8 seconds max per request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);
    
    try {
      // SINGLE CALL: Hugging Face Router ONLY
      const response = await Promise.race([
        this.llm.chat('huggingface', messages, {
          model: this.config.model,
          temperature: options.temperature ?? this.config.temperature,
          maxTokens: options.maxTokens ?? 512, // Enforce HF Router limit
          apiKey: this.config.huggingFaceApiKey,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 8s')), 8000);
        })
      ]);
      
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      console.log(`[OBSERVABILITY] modelUsed=${this.config.model}, executionTimeMs=${executionTime}, provider=huggingface, retryCount=0`);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AGENT] Hugging Face Router failed: ${errorMsg}`);
      console.log(`[OBSERVABILITY] modelUsed=${this.config.model}, executionTimeMs=${executionTime}, provider=huggingface, retryCount=0, error=${errorMsg}`);
      // NO FALLBACK: Return error immediately
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * STEP 1: Analyze user request and generate clarifying questions
   */
  /**
   * STEP 1: Analyze user request and generate clarifying questions
   */
  async analyzeRequest(userGoal: string): Promise<AnalysisResult> {
    console.log('[AGENT] Analyzing request and generating questions...');

    try {
      // First, get a basic summary using the existing method
      const basicSummary = await this.phase0_SummarizeAndClarify(userGoal);

      // Now generate questions and options
      const prompt = `You are an expert workflow consultant.
      USER GOAL: "${userGoal}"
      CLARIFIED GOAL: "${basicSummary}"
      
      Your task is to:
      1. condensed the user goal into a 30-40 word summary.
      2. Generate 3-4 multiple-choice questions to clarify ambiguities or user preferences.
         - Questions should focus on: Timing (when?), Channels (Instagram/Slack/Email?), Content Type (what data?), Frequency.
         - Provide 3-4 realistic options for each question.
      
      Respond with JSON:
      {
        "summary": "30-40 word summary of the user's request",
        "questions": [
          {
            "id": "q1",
            "text": "The question text?",
            "options": ["Option 1", "Option 2", "Option 3"]
          }
        ],
        "predictedStepCount": 5
      }`;

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful workflow consultant. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ];

      const response = await this.callLLMWithFallback(messages, {
        temperature: 0.3,
      });

      let resultText = response.content.trim();
      // Safer JSON extraction
      if (resultText.includes('```json')) {
        const parts = resultText.split('```json');
        if (parts.length > 1) {
          resultText = parts[1].split('```')[0].trim();
        }
      } else if (resultText.includes('```')) {
        const parts = resultText.split('```');
        if (parts.length > 1) {
          resultText = parts[1].split('```')[0].trim();
        }
      }

      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        console.error('[AGENT] JSON Parse Error in analyzeRequest:', parseError);
        console.error('[AGENT] Raw response:', resultText);
        // Fallback
        return {
          summary: basicSummary,
          questions: [],
          clarifiedPromptPreview: basicSummary,
          predictedStepCount: 3
        };
      }

      return {
        summary: result.summary || basicSummary,
        questions: result.questions || [],
        clarifiedPromptPreview: basicSummary,
        predictedStepCount: result.predictedStepCount || 5
      };
    } catch (error) {
      console.error('[AGENT] Error in analyzeRequest:', error);
      // Fallback to prevent blocking the user
      const fallbackSummary = userGoal.substring(0, 50) + '...';
      return {
        summary: fallbackSummary,
        questions: [],
        clarifiedPromptPreview: userGoal,
        predictedStepCount: 3
      };
    }
  }

  /**
   * STEP 2: Refine prompt based on user answers and identify requirements
   */
  async refineRequest(userGoal: string, qa: Array<{ question: string, answer: string }>): Promise<RefinementResult> {
    console.log('[AGENT] Refining request based on answers...');

    try {
      const qaContext = qa.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');

      const prompt = `You are an expert workflow architect.
    ORIGINAL GOAL: "${userGoal}"
    
    USER ANSWERS TO CLARIFYING QUESTIONS:
    ${qaContext}
    
    Task 1: Rewrite the user goal into a single, highly detailed, precise prompt that incorporates all the user's answers.
            This new prompt will be used to build the automation.
            
    Task 2: Identify ALL external requirements (API Keys, URLs, Credentials) needed for this workflow.
            - If Instagram is mentioned, require "Instagram Credentials" or "Instagram API Key".
            - If Sheets, require "Spreadsheet URL".
            
    Respond with JSON:
    {
      "refinedPrompt": "The new detailed prompt...",
      "requirements": [
        {
          "key": "unique_key_name",
          "label": "Human Readable Label",
          "type": "text|url|api_key",
          "description": "What is this and where to get it?"
        }
      ]
    }`;

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an expert workflow architect. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ];

      const response = await this.callLLMWithFallback(messages, {
        temperature: 0.2,
      });

      let resultText = response.content.trim();
      if (resultText.includes('```json')) {
        resultText = resultText.split('```json')[1].split('```')[0].trim();
      } else if (resultText.includes('```')) {
        resultText = resultText.split('```')[1].split('```')[0].trim();
      }

      return JSON.parse(resultText);
    } catch (error) {
      console.error('[AGENT] Error in refineRequest:', error);
      // Fallback: return original goal and no specific requirements
      return {
        refinedPrompt: userGoal,
        requirements: []
      };
    }
  }

  /**
   * SINGLE-SHOT WORKFLOW GENERATION
   * One prompt, one model call, one JSON parse
   * Replaces multi-phase generation to prevent token explosion
   */
  async generateWorkflowOnce(userGoal: string, userConfig: Record<string, any> = {}): Promise<any> {
    console.log(`[SINGLE-SHOT] Generating workflow for: "${userGoal}"`);
    
    const goalLower = userGoal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    
    // Extract required nodes from goal
    const requiredNodes = this.extractRequiredNodes(userGoal);
    
    // Get training examples (limit to 1, will be compressed further if needed)
    const { getTrainingExampleContext } = await import('./training-examples.ts');
    let trainingContext = getTrainingExampleContext(userGoal, 1);
    
    // Check if form node is required
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];
    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));
    
    // RESET CONTEXT: Clean userConfig thoroughly - remove all large objects
    const cleanUserConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(userConfig)) {
      // Skip execution history, previous outputs, fallback workflows, logs
      if (key === 'executionHistory' || key === 'previousOutputs' || key === 'fallbackWorkflow' || 
          key === 'logs' || key === 'debug' || key === 'stackTrace') {
        continue;
      }
      // Only include simple config values (strings, numbers, booleans, small objects)
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        cleanUserConfig[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        const jsonStr = JSON.stringify(value);
        // Only include if small (< 500 chars)
        if (jsonStr.length < 500) {
          cleanUserConfig[key] = value;
        }
      }
    }

    // Compress node reference to only relevant nodes
    const compressedNodeRef = this.compressNodeReference(this.nodeKnowledge, userGoal, requiredNodes);
    
    // Compress training examples
    trainingContext = this.compressTrainingExamples(trainingContext, 400);

    const prompt = `You are an expert workflow construction agent. Build a COMPLETE, executable workflow.

USER GOAL: "${userGoal}"

${Object.keys(cleanUserConfig).length > 0 ? `USER CONFIG:\n${JSON.stringify(cleanUserConfig)}\n\n` : ''}REQUIRED NODES: ${JSON.stringify(requiredNodes)}

${trainingContext}

${compressedNodeRef}

RULES:
1. ${requiresFormNode ? '🚨 Use "form" node as FIRST node' : 'Start with trigger (manual_trigger, webhook, schedule)'}
2. Position: x spacing 300px, y spacing 150px (start x:250, y:100)
3. Use template variables: {{input.field}}
4. if_else: MUST have both true and false edges
5. ${hasGmail ? 'Email: google_gmail (operation: "send")' : ''}
6. Google Sheets: Add javascript node after to parse arrays
7. JavaScript: Return {content: "text", text: "text", body: "text"}
8. Output nodes: Use {{input.content}} or {{input.text}}

Return ONLY valid JSON (no explanations):
{
  "name": "Workflow name",
  "nodes": [{"id": "id", "type": "type", "position": {"x": 250, "y": 100}, "config": {}}],
  "edges": [{"id": "e1", "source": "id1", "target": "id2"}]
}`;

    const messages: LLMMessage[] = [
      { 
        role: 'system', 
        content: 'You are a workflow construction agent. Return ONLY valid JSON, no explanations.' 
      },
      { role: 'user', content: prompt },
    ];

    // ACTIVE TOKEN BUDGET: Reduce prompt to fit budget (returns modified messages)
    const reducedMessages = this.checkTokenBudget(messages);

    // SINGLE LLM CALL: No retries, no fallbacks, HF Router ONLY
    const response = await this.callLLMWithFallback(reducedMessages, {
      temperature: 0.4,
      maxTokens: 512, // Enforce HF Router limit: max_new_tokens = 512
    });

    // Extract JSON only
    const responseText = response.content.trim();
    const jsonText = extractFirstJSONObject(responseText);
    const parsed = JSON.parse(jsonText);

    // ACCEPT FLEXIBLE WORKFLOW JSON: Only check for nodes array
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM returned invalid workflow JSON: not an object');
    }
    
    // Check if it's a valid workflow (has nodes array)
    if (!Array.isArray(parsed.nodes)) {
      throw new Error('LLM returned invalid workflow JSON: missing nodes array');
    }

    // Normalize to standard format
    const workflow = normalizeWorkflow(parsed);
    
    // Validate nodes exist
    if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      throw new Error('LLM returned invalid workflow JSON: empty nodes array');
    }

    console.log(`[SINGLE-SHOT] Generated workflow with ${workflow.nodes.length} nodes`);
    return {
      name: parsed.name || `Workflow: ${userGoal.substring(0, 50)}`,
      nodes: workflow.nodes,
      edges: workflow.edges,
    };
  }

  /**
   * Main execution method - SINGLE LLM CALL (HF Router ONLY)
   * Replaces multi-phase agent to prevent token explosion and infinite loops
   */
  async execute(userGoal: string, userConfig: Record<string, any> = {}): Promise<any> {
    this.state.goal = userGoal;
    this.state.userConfig = userConfig;
    this.startTime = Date.now();
    this.estimatedTime = this.estimateTime(userGoal);

    console.log(`[AGENT] Starting SINGLE-SHOT workflow generation for goal: "${userGoal}"`);
    console.log(`[AGENT] Using Hugging Face Router ONLY - no fallbacks, no retries`);

    // Send initial progress
    this.updateProgress('Generating', 0);

    try {
      // RESET CONTEXT: Clear all previous outputs and history
      this.state.previousOutputs = undefined;
      this.state.fallbackWorkflow = undefined;
      this.state.executionHistory = [];
      this.state.errors = [];
      this.state.analysis = undefined;
      this.state.plan = undefined;
      this.state.workflow = undefined;

      // SINGLE LLM CALL: Generate workflow in one shot
      this.updateProgress('Generating Workflow', 50);
      const workflow = await this.generateWorkflowOnce(userGoal, userConfig);
      
      // Validate workflow structure
      if (!workflow || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
        throw new Error('LLM returned invalid workflow: missing nodes array');
      }

      this.updateProgress('Completed', 100);
      
      if (this.config.onProgress) {
        const totalTime = (Date.now() - this.startTime) / 1000;
        this.config.onProgress({
          status: 'completed',
          estimated_time_seconds: this.estimatedTime,
          elapsed_time_seconds: Math.round(totalTime * 10) / 10,
          progress_percentage: 100,
          current_phase: 'Completed',
        });
      }

      console.log(`[AGENT] Workflow generated successfully with ${workflow.nodes.length} nodes`);
      return workflow;
      
    } catch (error) {
      console.error(`[AGENT] Error in single-shot generation:`, error);
      
      // NO FALLBACK - Return error
      if (this.config.onProgress) {
        const elapsed = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;
        this.config.onProgress({
          status: 'error',
          estimated_time_seconds: this.estimatedTime,
          elapsed_time_seconds: Math.round(elapsed * 10) / 10,
          progress_percentage: 0,
          current_phase: 'Error',
        });
      }

      // Re-throw error - no emergency fallback
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * PHASE 0: SUMMARIZE & CLARIFY
   * First, create a clear, structured summary of the user's intent
   */
  private async phase0_SummarizeAndClarify(userGoal: string): Promise<string> {
    console.log('[PHASE 0] Summarizing and clarifying user goal...');

    const summaryPrompt = `You are an expert at understanding natural language workflow requests. 
Your task is to create a clear, structured summary of what the user wants.

USER REQUEST: "${userGoal}"

Create a comprehensive summary that:
1. Identifies the MAIN GOAL (what the workflow should accomplish)
2. Extracts KEY ACTIONS (what steps need to happen)
3. Identifies TRIGGER TYPE (what starts the workflow)
4. Lists REQUIRED INTEGRATIONS (which services/tools are needed)
5. Identifies OUTPUT DESTINATION (where results should go)

Respond with a JSON object:
{
  "mainGoal": "One sentence describing the primary objective",
  "keyActions": ["action 1", "action 2", "action 3"],
  "triggerType": "webhook|form|schedule|chat|manual|error|interval",
  "integrations": ["service1", "service2"],
  "outputDestination": "where the final result goes",
  "clarifiedPrompt": "A clear, structured version of the user's request that removes ambiguity"
}

Be precise. If the user says "webhook", use "webhook" trigger. If they say "form", use "form" trigger.
If they say "schedule" or "daily" or "every day", use "schedule" trigger.
If they say "chat" or "chatbot", use "chat" trigger.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a precise summarization agent. Always respond with valid JSON only.' },
      { role: 'user', content: summaryPrompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.1, // Very low temperature for precise summarization
    });

    let summaryText = response.content.trim();
    if (summaryText.includes('```json')) {
      summaryText = summaryText.split('```json')[1].split('```')[0].trim();
    } else if (summaryText.includes('```')) {
      summaryText = summaryText.split('```')[1].split('```')[0].trim();
    }

    const summary = JSON.parse(summaryText);
    console.log('[PHASE 0] Summary complete:', JSON.stringify(summary, null, 2));

    // Return the clarified prompt for use in next phase
    return summary.clarifiedPrompt || userGoal;
  }

  /**
   * PHASE 1: UNDERSTAND & SUMMARIZE
   * Deeply analyze the USER_GOAL and extract intent, inputs, outputs, constraints
   * Now enhanced with training example references
   */
  private async phase1_UnderstandAndSummarize(userGoal: string, userConfig: Record<string, any>): Promise<void> {
    console.log('[PHASE 1] Understanding and summarizing goal with training examples...');

    // First, get a clear summary
    const clarifiedGoal = await this.phase0_SummarizeAndClarify(userGoal);

    // Import training examples helper
    const { getTrainingExampleContext } = await import('./training-examples.ts');
    const trainingContext = getTrainingExampleContext(clarifiedGoal, 3);

    // Detect email/gmail keywords for special handling
    const goalLower = clarifiedGoal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const emailPreference = hasGmail ? 'google_gmail' : null;

    // 🚨 CRITICAL: Check for form keywords
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];
    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

    const prompt = `You are an expert workflow analysis agent. Analyze the user's goal and extract all critical information.

ORIGINAL USER GOAL: "${userGoal}"
CLARIFIED GOAL: "${clarifiedGoal}"

USER PROVIDED CONFIGURATION:
${JSON.stringify(userConfig, null, 2)}

${trainingContext}

${this.nodeKnowledge}

🚨🚨🚨 CRITICAL: REFERENCE TRAINING EXAMPLES ABOVE 🚨🚨🚨
If you see similar workflows in the training examples section, you MUST:
1. Use the SAME node types as shown in the examples
2. Follow the SAME data flow pattern
3. Apply the SAME structural approach
4. Match the trigger type from similar examples

🚨🚨🚨 CRITICAL TRIGGER SELECTION RULES 🚨🚨🚨
${requiresFormNode ? `
⚠️⚠️⚠️ FORM NODE DETECTED ⚠️⚠️⚠️
- User goal contains form-related keywords: "${formKeywords.filter(k => goalLower.includes(k)).join(', ')}"
- YOU MUST use "form" node as the trigger
- DO NOT use manual_trigger, webhook, or any other trigger
- Form node outputs: {data: {field1: value1, ...}, files: [], meta: {...}}
- Access form data in downstream nodes using: {{input.data.fieldName}} (NOT input.formData)
- Extract field names from user goal (e.g., "name", "email", "mobile")
` : ''}

CRITICAL EMAIL NODE SELECTION RULE:
- If user mentions "gmail", "email", or "send email" → MUST use google_gmail node (operation: "send")
- google_gmail is THE ONLY EMAIL NODE TYPE AVAILABLE
- google_gmail works with any Gmail account without verification
- DO NOT use any other email node type - ONLY google_gmail exists

Analyze this goal and respond with a JSON object containing:
{
  "intent": "Clear description of what the user wants to achieve",
  "requiredInputs": ["list of required input data/triggers"],
  "expectedOutputs": ["list of expected outputs/actions"],
  "constraints": ["any constraints, limitations, or requirements"],
  "ambiguities": ["any ambiguous aspects and your best assumptions to resolve them"],
  "summary": "Concise internal goal summary for the agent",
  "triggerType": "${requiresFormNode ? 'form' : 'manual_trigger'}",
  "emailNodeType": "${emailPreference || 'google_gmail'}",
  "similarTrainingExample": "Which training example (if any) is most similar? Reference its number and key patterns",
  "nodesToUse": ["list of node types that MUST be included based on training examples and user goal"],
  ${requiresFormNode ? `"formFields": ["extract field names from goal like name, email, mobile"],` : ''}
  ${requiresFormNode ? `"formConfig": {"fields": "JSON array of form fields with name, label, type, required, placeholder"},` : ''}
}

Be thorough and precise. Resolve ambiguities using best-practice assumptions.
CRITICAL: If a training example above matches the user's goal, explicitly reference it and use its node pattern.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a precise workflow analysis agent. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.2, // Low temperature for precise analysis
    });

    let analysisText = response.content.trim();
    // Extract JSON from markdown code blocks if present
    if (analysisText.includes('```json')) {
      analysisText = analysisText.split('```json')[1].split('```')[0].trim();
    } else if (analysisText.includes('```')) {
      analysisText = analysisText.split('```')[1].split('```')[0].trim();
    }

    this.state.analysis = JSON.parse(analysisText);
    console.log('[PHASE 1] Analysis complete:', JSON.stringify(this.state.analysis, null, 2));

    this.state.phase = 'planning';
  }

  /**
   * PHASE 2: PLANNING (GOAL DECOMPOSITION)
   * Break goal into atomic sub-tasks and map to workflow nodes
   * Enhanced with training example references
   */
  private async phase2_Planning(): Promise<void> {
    console.log('[PHASE 2] Planning workflow structure with training examples...');

    const analysisContext = this.state.analysis;
    const memoryContext = this.buildMemoryContext();
    const goalLower = this.state.goal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const requiredNodes = this.extractRequiredNodes(this.state.goal);

    // Get training examples for planning phase
    const { getTrainingExampleContext } = await import('./training-examples.ts');
    const trainingContext = getTrainingExampleContext(this.state.goal, 3);

    // 🚨 Check if form node is required
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];
    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

    // Extract form fields from goal
    const formFields: string[] = [];
    if (requiresFormNode) {
      if (goalLower.includes('name')) formFields.push('name');
      if (goalLower.includes('email')) formFields.push('email');
      if (goalLower.includes('mobile') || goalLower.includes('phone')) formFields.push('mobile');
      if (goalLower.includes('message')) formFields.push('message');
      if (formFields.length === 0) formFields.push('name', 'email', 'message');
    }

    const prompt = `You are an expert workflow planning agent. Create a detailed execution plan.

USER GOAL: "${this.state.goal}"

GOAL ANALYSIS:
${JSON.stringify(analysisContext, null, 2)}

${trainingContext}

REQUIRED NODES (MUST be included in plan):
${JSON.stringify(requiredNodes, null, 2)}

🚨🚨🚨 CRITICAL: USE TRAINING EXAMPLES ABOVE 🚨🚨🚨
If a similar training example exists above:
1. Use the EXACT same node types from that example
2. Follow the EXACT same data flow pattern
3. Match the EXACT same structure
4. Reference the example number in your plan

${requiresFormNode ? `
🚨🚨🚨 CRITICAL: FORM NODE REQUIRED 🚨🚨🚨
- User goal requires a FORM node as the trigger
- DO NOT use manual_trigger, webhook, or any other trigger
- Form node MUST be the first node in the workflow
- Form fields detected: ${formFields.join(', ')}
- Form node outputs: {formData: {${formFields.map(f => `${f}: "value"`).join(', ')}}, files: [], meta: {...}}
- Downstream nodes MUST use {{input.formData.${formFields[0] || 'fieldName'}}} to access form data
` : ''}

${memoryContext}

${this.nodeKnowledge}

CRITICAL PLANNING RULES:
1. ${requiresFormNode ? '🚨 YOU MUST use "form" node as the trigger - DO NOT use manual_trigger' : 'Start with appropriate trigger node'}
2. YOU MUST include ALL required nodes listed above - missing any node means the plan is INCOMPLETE
3. ${hasGmail ? 'For email: Use google_gmail (operation: "send")' : 'For email: Use google_gmail (operation: "send")'}
4. For Google Sheets: MUST include javascript node after google_sheets to parse data
5. Plan must cover ALL steps from trigger to final output
${requiresFormNode ? `6. Form node must have fields configured: ${formFields.map(f => `{name: "${f}", label: "${f.charAt(0).toUpperCase() + f.slice(1)}", type: "${f === 'email' ? 'email' : f === 'mobile' || f === 'phone' ? 'tel' : f === 'message' ? 'textarea' : 'text'}", required: true, placeholder: "Enter your ${f}"}`).join(', ')}` : ''}

Create a detailed execution plan as JSON:
{
  "subTasks": [
    {
      "id": "task_1",
      "description": "What this task does",
      "nodeType": "node_type_from_available_list",
      "config": {"key": "value"},
      "order": 1,
      "dependencies": [],
      "basedOnTrainingExample": "Which training example (if any) this task is based on"
    }
  ],
  "executionOrder": ["task_1", "task_2", ...],
  "errorHandling": {
    "retryLogic": "description of retry strategy",
    "fallbackPaths": ["description of fallback actions"]
  },
  "dataFlow": "Description of how data flows between nodes",
  "trainingExampleReference": "${analysisContext.similarTrainingExample || 'None'}",
  "nodesFromTrainingExample": ["list of nodes that match the training example pattern"]
}

Ensure:
- Every sub-task maps to a valid node type
- ALL required nodes from the list above are included in subTasks
- If a training example matches, use its EXACT node pattern
- Execution order is logical (DAG - no cycles)
- Error handling is included for critical nodes
- Data flow matches the training example pattern (if applicable)`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a precise workflow planning agent. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.3,
    });

    let planText = response.content.trim();
    if (planText.includes('```json')) {
      planText = planText.split('```json')[1].split('```')[0].trim();
    } else if (planText.includes('```')) {
      planText = planText.split('```')[1].split('```')[0].trim();
    }

    this.state.plan = JSON.parse(planText);
    console.log('[PHASE 2] Planning complete:', JSON.stringify(this.state.plan, null, 2));

    this.state.phase = 'construction';
  }

  /**
   * Helper to repair common JSON syntax errors from LLM output
   */
  private repairJson(text: string): string {
    let clean = text.trim();
    // Remove markdown if present
    if (clean.includes('```json')) clean = clean.split('```json')[1].split('```')[0].trim();
    else if (clean.includes('```')) clean = clean.split('```')[1].split('```')[0].trim();

    // Fix bad escaped characters (backslashes)
    // Replace backslashes that are NOT standard escapes (\", \\, \/, \b, \f, \n, \r, \t) nor unicode (\uXXXX) with double backslashes
    // This fixes paths like "C:\Users" becoming "C:\\Users"
    clean = clean.replace(/\\(?![/bfnrtu"\\{]|u[0-9a-fA-F]{4})/g, "\\\\");

    return clean;
  }

  /**
   * OPTIMIZED: COMBINED PHASE 1 & 2 (Understand + Plan)
   * When maxIterations=1, combine both phases into a single API call to save quota
   */
  private async phase1_UnderstandAndPlan_Combined(userGoal: string, userConfig: Record<string, any>): Promise<void> {
    console.log('[PHASE 1+2 COMBINED] Understanding, analyzing, and planning workflow...');

    // Detect email/gmail keywords for special handling
    const goalLower = userGoal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const emailPreference = hasGmail ? 'google_gmail' : null;

    // Check for form keywords
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];
    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

    // Extract form fields from goal
    const formFields: string[] = [];
    if (requiresFormNode) {
      if (goalLower.includes('name')) formFields.push('name');
      if (goalLower.includes('email')) formFields.push('email');
      if (goalLower.includes('mobile') || goalLower.includes('phone')) formFields.push('mobile');
      if (goalLower.includes('message')) formFields.push('message');
      if (formFields.length === 0) formFields.push('name', 'email', 'message');
    }

    const requiredNodes = this.extractRequiredNodes(userGoal);
    const memoryContext = this.buildMemoryContext();

    const prompt = `You are an expert workflow analysis and planning agent. Analyze the user's goal AND create a detailed execution plan in ONE response.

USER GOAL: "${userGoal}"

USER PROVIDED CONFIGURATION:
${JSON.stringify(userConfig, null, 2)}

${this.nodeKnowledge}

🚨🚨🚨 CRITICAL TRIGGER SELECTION RULES 🚨🚨🚨
${requiresFormNode ? `
⚠️⚠️⚠️ FORM NODE DETECTED ⚠️⚠️⚠️
- User goal contains form-related keywords: "${formKeywords.filter(k => goalLower.includes(k)).join(', ')}"
- YOU MUST use "form" node as the trigger
- DO NOT use manual_trigger, webhook, or or any other trigger
- Form node outputs: {formData: {field1: value1, ...}, files: [], meta: {...}}
- Access form data in downstream nodes using: {{input.formData.fieldName}}
- Extract field names from user goal (e.g., "name", "email", "mobile")
` : ''}

CRITICAL EMAIL NODE SELECTION RULE:
- If user mentions "gmail", "email", or "send email" → MUST use google_gmail node (operation: "send")
- google_gmail is THE ONLY EMAIL NODE TYPE AVAILABLE

REQUIRED NODES (MUST be included in plan):
${JSON.stringify(requiredNodes, null, 2)}

${memoryContext}

CRITICAL PLANNING RULES:
1. ${requiresFormNode ? '🚨 YOU MUST use "form" node as the trigger - DO NOT use manual_trigger' : 'Start with appropriate trigger node'}
2. YOU MUST include ALL required nodes listed above
3. For email: Use google_gmail (operation: "send")
4. For Google Sheets: MUST include javascript node after google_sheets to parse data
5. Plan must cover ALL steps from trigger to final output

Respond with a SINGLE JSON object containing BOTH analysis AND plan:
{
  "analysis": {
    "intent": "Clear description of what the user wants to achieve",
    "requiredInputs": ["list of required input data/triggers"],
    "expectedOutputs": ["list of expected outputs/actions"],
    "constraints": ["any constraints, limitations, or requirements"],
    "ambiguities": ["any ambiguous aspects and your best assumptions to resolve them"],
    "summary": "Concise internal goal summary for the agent",
    "triggerType": "${requiresFormNode ? 'form' : 'manual_trigger'}",
    "emailNodeType": "${emailPreference || 'google_gmail'}"
  },
  "plan": {
    "subTasks": [
      {
        "id": "task_1",
        "description": "What this task does",
        "nodeType": "node_type_from_available_list",
        "config": {"key": "value"},
        "order": 1,
        "dependencies": []
      }
    ],
    "executionOrder": ["task_1", "task_2", ...],
    "errorHandling": {
      "retryLogic": "description of retry strategy",
      "fallbackPaths": ["description of fallback actions"]
    },
    "dataFlow": "Description of how data flows between nodes"
  }
}

Ensure:
- Analysis is thorough and precise
- Plan includes ALL required nodes from the list above
- Every sub-task maps to a valid node type
- Execution order is logical (DAG - no cycles)
- Data flow is clearly defined`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a precise workflow analysis and planning agent. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.3,
    });

    let combined;
    const responseText = response.content.trim();

    try {
      // Extract JSON from response (handles markdown, explanations, etc.)
      const jsonText = extractFirstJSONObject(responseText);
      combined = JSON.parse(jsonText);

      // FIXED CONTRACT: Accept multiple formats
      if (isValidWorkflow(combined)) {
        // If LLM returned workflow directly, extract it
        if (Array.isArray(combined.nodes)) {
          // Direct workflow format - skip analysis/plan phases
          console.log('[PHASE 1+2 COMBINED] LLM returned workflow directly, skipping analysis/plan');
          this.state.workflow = {
            nodes: combined.nodes,
            edges: Array.isArray(combined.edges) ? combined.edges : []
          };
          this.state.phase = 'validation';
          return;
        } else if (combined.workflow && Array.isArray(combined.workflow.nodes)) {
          // Nested workflow format
          console.log('[PHASE 1+2 COMBINED] LLM returned nested workflow, extracting');
          this.state.workflow = {
            nodes: combined.workflow.nodes,
            edges: Array.isArray(combined.workflow.edges) ? combined.workflow.edges : []
          };
          this.state.phase = 'validation';
          return;
        }
      }

      // Legacy format: analysis + plan
      if (!combined.analysis || !combined.plan) {
        throw new Error('LLM returned invalid format: missing analysis/plan and not a valid workflow');
      }
    } catch (parseError) {
      // FAIL FAST: No fallback, throw error
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      console.error('[PHASE 1+2 COMBINED] JSON Parse failed:', errorMsg);
      console.error('[PHASE 1+2 COMBINED] Response preview:', responseText.substring(0, 500));
      throw new Error(`LLM returned invalid workflow JSON: ${errorMsg}`);
    }

    // Set both analysis and plan from the response
    this.state.analysis = combined.analysis;
    this.state.plan = combined.plan;

    console.log('[PHASE 1+2 COMBINED] Analysis and plan complete (or fallback applied)');
    this.state.phase = 'construction';
  }

  /**
   * PHASE 3: WORKFLOW CONSTRUCTION
   * Build the complete workflow with correct node configurations
   * Enhanced to use training examples for accurate node selection
   */
  private async phase3_WorkflowConstruction(): Promise<void> {
    console.log('[PHASE 3] Constructing workflow using training examples...');

    // CRITICAL FIX: Do NOT feed previous outputs back into prompt
    // Delete previous LLM outputs to prevent token explosion
    delete (this.state as any).previousLLMOutput;
    delete (this.state as any).generatedWorkflow;

    const goalLower = this.state.goal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const userConfig = this.state.userConfig || {};

    // Extract required nodes from goal for validation
    const requiredNodes = this.extractRequiredNodes(this.state.goal);

    // Get training examples for construction phase (limit to 1 to reduce tokens)
    const { getTrainingExampleContext } = await import('./training-examples.ts');
    const trainingContext = getTrainingExampleContext(this.state.goal, 1);

    // 🚨 Check if form node is required
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];
    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

    // Extract form fields
    const formFields: any[] = [];
    if (requiresFormNode) {
      const fieldNames: string[] = [];
      if (goalLower.includes('name')) fieldNames.push('name');
      if (goalLower.includes('email')) fieldNames.push('email');
      if (goalLower.includes('mobile') || goalLower.includes('phone')) fieldNames.push('mobile');
      if (goalLower.includes('message')) fieldNames.push('message');
      if (fieldNames.length === 0) fieldNames.push('name', 'email', 'message');

      formFields.push(...fieldNames.map(fn => {
        const config: any = {
          name: fn,
          label: fn.charAt(0).toUpperCase() + fn.slice(1),
          required: true,
          placeholder: `Enter your ${fn}`
        };
        if (fn === 'email') config.type = 'email';
        else if (fn === 'mobile' || fn === 'phone') config.type = 'tel';
        else if (fn === 'message') config.type = 'textarea';
        else config.type = 'text';
        return config;
      }));
    }

    const prompt = `You are an expert workflow construction agent. Build a COMPLETE, executable workflow that achieves 100% of the user's goal.

USER GOAL: "${this.state.goal}"

USER PROVIDED CONFIGURATION (USE THESE VALUES):
${JSON.stringify(userConfig, null, 2)}

${trainingContext}

REQUIRED NODES (based on goal):
${JSON.stringify(requiredNodes, null, 2)}

🚨🚨🚨 CRITICAL: FOLLOW TRAINING EXAMPLES EXACTLY 🚨🚨🚨
If a training example above matches this workflow:
1. Use the EXACT same node types in the EXACT same order
2. Follow the EXACT same data flow pattern
3. Use the EXACT same node configurations
4. Match the EXACT same structure
5. Reference the example number in your reasoning

CRITICAL: The training examples are PROVEN, PRODUCTION-READY workflows.
If your workflow matches a training example, you MUST replicate its structure exactly.

🚨🚨🚨 CRITICAL: EXPLICITLY MENTIONED NODES ARE MANDATORY 🚨🚨🚨
If the user explicitly listed nodes in a "Nodes Used:" section, those nodes MUST be included in the workflow.
The required nodes list above includes ALL nodes that MUST be present - do NOT skip any of them.

${this.nodeKnowledge}

CRITICAL CONSTRUCTION RULES:
1. ${requiresFormNode ? '🚨🚨🚨 YOU MUST use "form" node as the FIRST node - DO NOT use manual_trigger or any other trigger' : 'Start with appropriate trigger node (manual_trigger, webhook, schedule, etc.)'}
2. 🚨 YOU MUST include ALL required nodes listed above - missing any node means workflow is INCOMPLETE and WRONG
3. If "datadog" is in required nodes → YOU MUST use datadog node for monitoring/log operations
4. If "if_else" or "if" is in required nodes → YOU MUST use if_else node for conditional logic
5. If "slack" is in required nodes → YOU MUST use slack_webhook or slack_message node
3. Position nodes with x spacing of 300px, y spacing of 150px (start at x:250, y:100)
4. Include ALL required configuration fields for each node
${requiresFormNode ? `5. Form node MUST have fields configured as JSON string: ${JSON.stringify(formFields)}` : '5. Use template variables ({{input.field}}) for data passing'}
${requiresFormNode ? `6. 🚨 CRITICAL: Form nodes output data in input.data, NOT input.formData. JavaScript validation MUST use input.data.name, input.data.email, input.data.mobile` : '6. Use template variables ({{input.field}}) for data passing'}
7. For if_else nodes: MUST have both true and false output edges
8. Connect nodes in logical flow from trigger to output
9. End with output actions (gmail, slack, etc.) if user wants to send data
${requiresFormNode ? `10. For Slack output: Use text like "Name: {{input.data.name}}\\nEmail: {{input.data.email}}\\nMobile: {{input.data.mobile}}" (form nodes output in input.data, NOT input.formData)` : ''}
11. ${hasGmail ? 'FOR EMAIL: Use google_gmail node with operation: "send"' : 'For email: Use google_gmail (operation: "send")'}
12. For Google Sheets: ALWAYS add javascript node after google_sheets read to parse array-of-arrays
13. CRITICAL: JavaScript node MUST format data as readable TEXT string, not objects
14. JavaScript node MUST return {content: "formatted text", text: "formatted text", body: "formatted text"}
15. Output nodes (gmail, slack) MUST use {{input.content}} or {{input.text}} to get the formatted text
16. If combining Google Sheets + Google Doc: Use merge_data node first, then javascript to format both
17. DO NOT create minimal workflows - create COMPLETE workflows with ALL required nodes

Build the complete workflow as JSON:
{
  "name": "Workflow name",
  "nodes": [
    {
      "id": "unique_id",
      "type": "node_type",
      "position": {"x": number, "y": number},
      "config": { /* ALL required fields with proper values */ }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "sourceHandle": "optional for conditionals"
    }
  ]
}

VALIDATION BEFORE RETURNING:
- Count nodes: Must have trigger + all required nodes from goal
- 🚨 CRITICAL: Check that ALL nodes in the required nodes list are present in the workflow
- Check: If "datadog" is in required nodes → MUST have datadog node
- Check: If "if_else" or "if" is in required nodes → MUST have if_else node
- Check: If goal mentions "google sheets" → must have google_sheets node
- Check: If goal mentions "google doc" → must have google_doc node  
- Check: If goal mentions "gmail" or "email" → must have google_gmail node
- Check: If goal mentions "slack" → must have slack_webhook or slack_message node
- Check: If goal mentions "send" → must have output node(s)
- CRITICAL: If workflow has google_sheets → MUST have javascript node to parse data
- CRITICAL: JavaScript node MUST return formatted text in {content, text, body} fields
- CRITICAL: Output nodes (gmail, slack) MUST use {{input.content}} or {{input.text}} template variables
- If ANY required node is missing, the workflow is INCOMPLETE and WRONG - DO NOT return it
- USE USER PROVIDED CONFIGURATION values in node configs (e.g., documentId, spreadsheetId, webhookUrl, email addresses)

JAVASCRIPT NODE CODE EXAMPLES:

🚨🚨🚨 CRITICAL: JavaScript validation code MUST match trigger type 🚨🚨🚨
- If trigger is "form" → use input.data.name, input.data.email, input.data.mobile
- If trigger is "webhook" → use input.body.name, input.body.email, input.body.mobile
- Form nodes output: {data: {name, email, mobile}, form: {...}, meta: {...}}
- Webhook nodes output: {body: {name, email, mobile}, headers: {...}, query: {...}}

Example validation code for FORM trigger:
    const email = input.data?.email || '';
    const name = input.data?.name || '';
    const mobile = input.data?.mobile || '';
    
    // Email validation
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    const isValidEmail = email && emailRegex.test(email);
    
    // Name validation (non-empty, at least 2 chars)
    const isValidName = name && name.trim().length >= 2;
    
    // Mobile validation (numeric, 10+ digits)
    const mobileRegex = /^[0-9]{10,15}$/;
    const isValidMobile = mobile && mobileRegex.test(mobile.replace(/[^0-9]/g, ''));
    
    const isValid = isValidEmail && isValidName && isValidMobile;
    
    return {
      isValid,
      email,
      name,
      mobile,
      errors: {
        email: isValidEmail ? null : 'Invalid email format',
        name: isValidName ? null : 'Name must be at least 2 characters',
        mobile: isValidMobile ? null : 'Mobile must be 10-15 digits'
      }
    };

Example validation code for WEBHOOK trigger:
    const email = input.body?.email || '';
    const name = input.body?.name || '';
    const mobile = input.body?.mobile || input.body?.mobile_no || '';
    
    // Same validation logic as above...
    // (use input.body instead of input.data)

JAVASCRIPT NODE CODE EXAMPLES FOR DATA FORMATTING:
- For Google Sheets only:
  const sheetsData = input.data || [];
  let sheetsText = "Data from Google Sheets:\\n";
  if (sheetsData.length === 0) {
    sheetsText += "No data found in Google Sheets.\\n";
  } else {
    const headers = sheetsData[0] || [];
    const dataRows = sheetsData.slice(1);
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
  return { content: sheetsText, text: sheetsText, body: sheetsText };

- For Google Sheets + Google Doc (from merge_data):
  const sheetsInput = input.sheetsInput || input.input1 || {};
  const docInput = input.docInput || input.input2 || {};
  const sheetsData = sheetsInput.data || [];
  const docContent = docInput.content || docInput.text || '';
  let combinedText = "Data from Google Sheets:\\n";
  if (sheetsData.length === 0) {
    combinedText += "No data found in Google Sheets.\\n\\n";
  } else {
    const headers = sheetsData[0] || [];
    const dataRows = sheetsData.slice(1);
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      combinedText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
  combinedText += "\\nData from Google Document:\\n";
  combinedText += docContent || "No Google Doc content found.\\n";
  return { content: combinedText, text: combinedText, body: combinedText };`;

    const messages: LLMMessage[] = [
      { 
        role: 'system', 
        content: 'You are a precise workflow construction agent. You must return ONLY valid JSON. Do not include explanations, markdown code blocks, or any text outside the JSON object.' 
      },
      { role: 'user', content: prompt },
    ];

    // TOKEN BUDGET CHECK
    this.checkTokenBudget(messages);

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.4,
    });

    // Extract JSON only (handles markdown, explanations, etc.)
    const responseText = response.content.trim();
    const jsonText = extractFirstJSONObject(responseText);
    const parsed = JSON.parse(jsonText);
    
    // Validate workflow structure
    if (!isValidWorkflow(parsed)) {
      throw new Error('LLM returned invalid workflow JSON: missing nodes array');
    }
    
    // Normalize to standard format
    const normalized = normalizeWorkflow(parsed);
    if (!Array.isArray(normalized.nodes) || normalized.nodes.length === 0) {
      throw new Error('LLM returned invalid workflow JSON: empty nodes array');
    }

    this.state.workflow = {
      name: parsed.name || `Workflow: ${this.state.goal.substring(0, 50)}`,
      nodes: normalized.nodes,
      edges: normalized.edges,
    };

    // 🚨 CRITICAL: Check and fix form node if required
    // goalLower, formKeywords, and requiresFormNode already declared earlier in this method (lines 527, 535, 542), reuse them

    if (requiresFormNode && this.state.workflow.nodes) {
      const nodeTypes = this.state.workflow.nodes.map((n: any) => n.type || n.type);
      const hasFormNode = nodeTypes.includes('form');

      if (!hasFormNode) {
        console.log('[PHASE 3] CRITICAL: Form node required but missing - AUTO-FIXING');

        // Extract field names
        const fieldNames: string[] = [];
        if (goalLower.includes('name')) fieldNames.push('name');
        if (goalLower.includes('email')) fieldNames.push('email');
        if (goalLower.includes('mobile') || goalLower.includes('phone')) fieldNames.push('mobile');
        if (goalLower.includes('message')) fieldNames.push('message');
        if (fieldNames.length === 0) fieldNames.push('name', 'email', 'message');

        const formFields = fieldNames.map(fn => {
          const config: any = {
            name: fn,
            label: fn.charAt(0).toUpperCase() + fn.slice(1),
            required: true,
            placeholder: `Enter your ${fn}`
          };
          if (fn === 'email') config.type = 'email';
          else if (fn === 'mobile' || fn === 'phone') config.type = 'tel';
          else if (fn === 'message') config.type = 'textarea';
          else config.type = 'text';
          return config;
        });

        // Find and replace manual_trigger with form
        const triggerNode = this.state.workflow.nodes.find((n: any) =>
          (n.type || n.data?.type) === 'manual_trigger'
        );

        if (triggerNode) {
          console.log(`[PHASE 3] Replacing manual_trigger with form node at ${triggerNode.id}`);
          triggerNode.type = 'form';
          triggerNode.data = triggerNode.data || {};
          triggerNode.data.type = 'form';
          triggerNode.data.label = 'Form';
          triggerNode.config = {
            fields: JSON.stringify(formFields),
            submitButtonText: 'Submit',
            successMessage: 'Thank you for your submission!'
          };
        } else {
          // Add form node at the beginning
          console.log('[PHASE 3] Adding form node as first node');
          this.state.workflow.nodes.unshift({
            id: 'trigger_1',
            type: 'form',
            position: { x: 250, y: 100 },
            data: { type: 'form', label: 'Form' },
            config: {
              fields: JSON.stringify(formFields),
              submitButtonText: 'Submit',
              successMessage: 'Thank you for your submission!'
            }
          });

          // Connect form to first existing node
          if (this.state.workflow.nodes.length > 1) {
            this.state.workflow.edges = this.state.workflow.edges || [];
            this.state.workflow.edges.unshift({
              id: 'edge_form_1',
              source: 'trigger_1',
              target: this.state.workflow.nodes[1].id
            });
          }
        }

        // Update downstream nodes to use formData
        this.state.workflow.nodes = this.state.workflow.nodes.map((node: any) => {
          if (node.type === 'slack_webhook' || node.type === 'slack_message') {
            const config = node.config || {};
            const formDataText = fieldNames.map(fn => {
              const label = fn.charAt(0).toUpperCase() + fn.slice(1);
              return `${label}: {{input.formData.${fn}}}`;
            }).join('\\n');

            if (node.type === 'slack_webhook') {
              config.text = config.text || `New Form Submission:\\n${formDataText}`;
            } else {
              config.message = config.message || `New Form Submission:\\n${formDataText}`;
            }
            node.config = config;
          }
          return node;
        });
      }
    }

    // CRITICAL: Replace email_resend with google_gmail if user mentioned gmail/email
    // hasGmail already declared at line 528 in this method, reuse it
    if (hasGmail && this.state.workflow.nodes) {
      this.state.workflow.nodes = this.state.workflow.nodes.map((node: any) => {
        if (node.type === 'email_resend') {
          console.log(`[PHASE 3] Replacing email_resend with google_gmail for node ${node.id}`);
          return {
            ...node,
            type: 'google_gmail',
            config: {
              ...node.config,
              operation: 'send',
              to: node.config.to || '',
              subject: node.config.subject || 'Message from Workflow',
              body: node.config.body || node.config.text || '',
            },
          };
        }
        return node;
      });
    }

    // CRITICAL: Validate that all required nodes are present
    // requiredNodes already declared at line 532 in this method, reuse it
    const actualNodeTypes = this.state.workflow.nodes?.map((n: any) => n.type) || [];
    const missingNodes = requiredNodes.filter((req: string) => !actualNodeTypes.includes(req));

    if (missingNodes.length > 0) {
      console.error(`[PHASE 3] CRITICAL: Missing required nodes: ${missingNodes.join(', ')}`);
      this.state.errors.push({
        type: 'missing_required_nodes',
        message: `Workflow is missing required nodes: ${missingNodes.join(', ')}`,
        fix: `Add the following nodes: ${missingNodes.join(', ')}`,
      });
      // Don't proceed to validation - go to self-healing
      this.state.phase = 'healing';
      return;
    }

    // Apply user config values to nodes
    this.applyUserConfigToNodes();

    // CRITICAL: Fix JavaScript validation code to use correct input path based on trigger type
    this.fixJavaScriptValidationCode();

    // CRITICAL: Fix JavaScript node code to ensure proper data formatting
    this.fixJavaScriptNodeCode();

    // CRITICAL: Fix output nodes to use correct template variables
    this.fixOutputNodeTemplates();

    // Apply validation fixes immediately
    this.state.workflow = validateAndFixWorkflow(this.state.workflow);

    console.log('[PHASE 3] Construction complete');
    this.state.phase = 'validation';
  }

  /**
   * Fix JavaScript validation code to use correct input path based on trigger type
   * CRITICAL: Form nodes output data in input.data, webhook nodes output in input.body
   */
  private fixJavaScriptValidationCode(): void {
    if (!this.state.workflow?.nodes) return;

    // Detect trigger type
    const triggerNode = this.state.workflow.nodes.find((n: any) =>
      ['form', 'webhook', 'manual_trigger', 'schedule'].includes(n.type)
    );
    const isFormTrigger = triggerNode?.type === 'form';
    const isWebhookTrigger = triggerNode?.type === 'webhook';

    // Find JavaScript nodes that do validation (checking for email, name, mobile validation)
    this.state.workflow.nodes = this.state.workflow.nodes.map((node: any) => {
      if (node.type !== 'javascript') return node;

      const code = node.config?.code || '';
      const codeLower = code.toLowerCase();

      // Check if this is a validation node (has email/name/mobile validation)
      const isValidationNode = codeLower.includes('email') &&
        (codeLower.includes('name') || codeLower.includes('mobile') || codeLower.includes('phone')) &&
        (codeLower.includes('valid') || codeLower.includes('regex') || codeLower.includes('test'));

      if (!isValidationNode) return node;

      // Fix input path based on trigger type
      let fixedCode = code;

      if (isFormTrigger) {
        // Form nodes output: { data: { name, email, mobile }, form: {...}, meta: {...} }
        // Replace input.body with input.data
        // Replace input.formData with input.data
        fixedCode = fixedCode.replace(/input\.body\?\./g, 'input.data?.');
        fixedCode = fixedCode.replace(/input\.body\./g, 'input.data.');
        fixedCode = fixedCode.replace(/input\.formData\?\./g, 'input.data?.');
        fixedCode = fixedCode.replace(/input\.formData\./g, 'input.data.');

        // Also fix the fallback chain
        fixedCode = fixedCode.replace(/input\.body\s*\|\|/g, 'input.data ||');
        fixedCode = fixedCode.replace(/input\.formData\s*\|\|/g, 'input.data ||');

        console.log(`[PHASE 3] Fixed JavaScript validation code for form trigger in node ${node.id}`);
      } else if (isWebhookTrigger) {
        // Webhook nodes output: { body: { name, email, mobile }, headers: {...}, query: {...} }
        // Ensure we use input.body
        fixedCode = fixedCode.replace(/input\.formData\?\./g, 'input.body?.');
        fixedCode = fixedCode.replace(/input\.formData\./g, 'input.body.');
        fixedCode = fixedCode.replace(/input\.data\?\./g, 'input.body?.');
        fixedCode = fixedCode.replace(/input\.data\./g, 'input.body.');

        console.log(`[PHASE 3] Fixed JavaScript validation code for webhook trigger in node ${node.id}`);
      } else {
        // For other triggers, use a fallback chain that works for both
        // This handles cases where the trigger type isn't clear
        if (!code.includes('input.data') && !code.includes('input.body') && !code.includes('input.formData')) {
          // No input path specified, add fallback chain
          const emailMatch = code.match(/(const\s+email\s*=)/);
          const nameMatch = code.match(/(const\s+name\s*=)/);
          const mobileMatch = code.match(/(const\s+mobile\s*=)/);

          if (emailMatch || nameMatch || mobileMatch) {
            // Add fallback chain that works for both form and webhook
            fixedCode = code.replace(
              /(const\s+email\s*=)\s*[^;]+;/,
              '$1 input.data?.email || input.body?.email || input.formData?.email || \'\';'
            );
            fixedCode = fixedCode.replace(
              /(const\s+name\s*=)\s*[^;]+;/,
              '$1 input.data?.name || input.body?.name || input.formData?.name || \'\';'
            );
            fixedCode = fixedCode.replace(
              /(const\s+mobile\s*=)\s*[^;]+;/,
              '$1 input.data?.mobile || input.body?.mobile || input.formData?.mobile || input.body?.mobile_no || \'\';'
            );

            console.log(`[PHASE 3] Added fallback chain to JavaScript validation code in node ${node.id}`);
          }
        }
      }

      if (fixedCode !== code) {
        node.config = { ...node.config, code: fixedCode };
        console.log(`[PHASE 3] Updated JavaScript validation code in node ${node.id}`);
      }

      return node;
    });
  }

  /**
   * Fix JavaScript node code to ensure proper data formatting
   */
  private fixJavaScriptNodeCode(): void {
    if (!this.state.workflow?.nodes) return;

    const goalLower = this.state.goal.toLowerCase();
    const hasSheets = goalLower.includes('google sheet') || goalLower.includes('sheets');
    const hasDoc = goalLower.includes('google doc') || goalLower.includes('document');
    const hasBoth = hasSheets && hasDoc;

    // Detect trigger type to determine input data path
    const triggerNode = this.state.workflow.nodes.find((n: any) =>
      ['form', 'webhook', 'manual_trigger', 'schedule'].includes(n.type)
    );
    const isFormTrigger = triggerNode?.type === 'form';
    const isWebhookTrigger = triggerNode?.type === 'webhook';

    // Find JavaScript nodes that need fixing
    this.state.workflow.nodes = this.state.workflow.nodes.map((node: any) => {
      if (node.type !== 'javascript') return node;

      const code = node.config?.code || '';
      const codeLower = code.toLowerCase();

      // Check if code properly formats data as text
      const hasReturnContent = code.includes('content:') || code.includes('"content"') || code.includes("'content'");
      const hasReturnText = code.includes('text:') || code.includes('"text"') || code.includes("'text'");
      const hasReturnBody = code.includes('body:') || code.includes('"body"') || code.includes("'body'");
      const returnsText = hasReturnContent || hasReturnText || hasReturnBody;

      // If code doesn't return formatted text, fix it
      if (!returnsText || code.trim() === '' || code.includes('placeholder') || code.includes('TODO')) {
        console.log(`[PHASE 3] Fixing JavaScript node ${node.id} - generating proper data formatting code`);

        if (hasBoth) {
          // Both Sheets and Doc - need to handle merge_data input
          node.config.code = `// Parse and format data from Google Sheets and Google Document
const sheetsInput = input.sheetsInput || input.input1 || input;
const docInput = input.docInput || input.input2 || {};

// Process Google Sheets data
const sheetsData = sheetsInput.data || [];
let sheetsText = "Data from Google Sheets:\\n";
if (sheetsData.length === 0) {
  sheetsText += "No data found in Google Sheets.\\n\\n";
} else {
  const headers = sheetsData[0] || [];
  const dataRows = sheetsData.slice(1);
  if (dataRows.length === 0) {
    sheetsText += "No data rows found in Google Sheets.\\n\\n";
  } else {
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
    sheetsText += "\\n";
  }
}

// Process Google Document content
const docContent = docInput.content || docInput.text || docInput.body || '';
let docText = "Data from Google Document:\\n";
if (!docContent || docContent.trim() === '') {
  docText += "No Google Doc content found.\\n";
} else {
  docText += docContent;
}

// Combine both sources
const combinedText = sheetsText + docText;

// Return formatted text for email/Slack
return {
  content: combinedText,
  text: combinedText,
  body: combinedText,
  sheetsText: sheetsText,
  docText: docText
};`;
        } else if (hasSheets) {
          // Only Sheets
          node.config.code = `// Parse and format data from Google Sheets
const sheetsData = input.data || [];
let sheetsText = "Data from Google Sheets:\\n";
if (sheetsData.length === 0) {
  sheetsText += "No data found in Google Sheets.\\n";
} else {
  const headers = sheetsData[0] || [];
  const dataRows = sheetsData.slice(1);
  if (dataRows.length === 0) {
    sheetsText += "No data rows found in Google Sheets.\\n";
  } else {
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
}

// Return formatted text for email/Slack
return {
  content: sheetsText,
  text: sheetsText,
  body: sheetsText
};`;
        } else if (hasDoc) {
          // Only Doc - usually doesn't need JavaScript, but if present, format it
          node.config.code = `// Format data from Google Document
const docContent = input.content || input.text || input.body || '';
const docText = docContent ? \`Data from Google Document:\\n\${docContent}\` : "No Google Doc content found.\\n";

// Return formatted text for email/Slack
return {
  content: docText,
  text: docText,
  body: docText
};`;
        }
      }

      return node;
    });
  }

  /**
   * Fix output nodes to use correct template variables from JavaScript nodes
   */
  private fixOutputNodeTemplates(): void {
    if (!this.state.workflow?.nodes) return;

    // Find JavaScript nodes and output nodes
    const jsNodes = this.state.workflow.nodes.filter((n: any) => n.type === 'javascript');
    const outputNodes = this.state.workflow.nodes.filter((n: any) =>
      ['google_gmail', 'slack_webhook', 'slack_message'].includes(n.type)
    );

    // Find edges to determine which output nodes receive data from JavaScript nodes
    const edges = this.state.workflow.edges || [];

    outputNodes.forEach((outputNode: any) => {
      // Find if this output node receives data from a JavaScript node
      const incomingEdges = edges.filter((e: any) => e.target === outputNode.id);
      const hasJsInput = incomingEdges.some((e: any) => {
        const sourceNode = this.state.workflow.nodes.find((n: any) => n.id === e.source);
        return sourceNode?.type === 'javascript';
      });

      // Also check if it receives from merge_data (which might come from JS)
      const hasMergeInput = incomingEdges.some((e: any) => {
        const sourceNode = this.state.workflow.nodes.find((n: any) => n.id === e.source);
        return sourceNode?.type === 'merge_data';
      });

      if (hasJsInput || hasMergeInput) {
        // This output node should use template variables from JavaScript/merge_data
        const config = outputNode.config || {};

        if (outputNode.type === 'google_gmail' && config.operation === 'send') {
          // Gmail should use {{input.content}} or {{input.text}}
          if (!config.body || (!config.body.includes('{{input.content}}') &&
            !config.body.includes('{{input.text}}') &&
            !config.body.includes('{{input.body}}'))) {
            console.log(`[PHASE 3] Fixing Gmail node ${outputNode.id} - adding template variable`);
            config.body = config.body || '{{input.content}}';
            if (!config.body.includes('{{input')) {
              config.body = '{{input.content}}';
            }
          }
        }

        if (outputNode.type === 'slack_webhook') {
          // Slack webhook should use {{input.content}} or {{input.text}}
          if (!config.text || (!config.text.includes('{{input.content}}') &&
            !config.text.includes('{{input.text}}') &&
            !config.text.includes('{{input.body}}'))) {
            console.log(`[PHASE 3] Fixing Slack webhook node ${outputNode.id} - adding template variable`);
            config.text = config.text || '{{input.content}}';
            if (!config.text.includes('{{input')) {
              config.text = '{{input.content}}';
            }
          }
        }

        if (outputNode.type === 'slack_message') {
          // Slack message should use {{input.content}} in message field
          if (!config.message || (!config.message.includes('{{input.content}}') &&
            !config.message.includes('{{input.text}}') &&
            !config.message.includes('{{input.body}}'))) {
            console.log(`[PHASE 3] Fixing Slack message node ${outputNode.id} - adding template variable`);
            config.message = config.message || '{{input.content}}';
            if (!config.message.includes('{{input')) {
              config.message = '{{input.content}}';
            }
          }
        }

        // Update the node
        const nodeIndex = this.state.workflow.nodes.findIndex((n: any) => n.id === outputNode.id);
        if (nodeIndex >= 0) {
          this.state.workflow.nodes[nodeIndex] = { ...outputNode, config };
        }
      } else {
        // Check if it receives directly from google_doc
        const hasDocInput = incomingEdges.some((e: any) => {
          const sourceNode = this.state.workflow.nodes.find((n: any) => n.id === e.source);
          return sourceNode?.type === 'google_doc';
        });

        if (hasDocInput) {
          const config = outputNode.config || {};

          if (outputNode.type === 'google_gmail' && config.operation === 'send') {
            if (!config.body || !config.body.includes('{{input.content}}')) {
              console.log(`[PHASE 3] Fixing Gmail node ${outputNode.id} - using {{input.content}} from google_doc`);
              config.body = '{{input.content}}';
            }
          }

          if (outputNode.type === 'slack_webhook') {
            if (!config.text || !config.text.includes('{{input.content}}')) {
              console.log(`[PHASE 3] Fixing Slack webhook node ${outputNode.id} - using {{input.content}} from google_doc`);
              config.text = '{{input.content}}';
            }
          }

          const nodeIndex = this.state.workflow.nodes.findIndex((n: any) => n.id === outputNode.id);
          if (nodeIndex >= 0) {
            this.state.workflow.nodes[nodeIndex] = { ...outputNode, config };
          }
        }
      }
    });
  }

  /**
   * Apply user-provided configuration values to workflow nodes
   */
  private applyUserConfigToNodes(): void {
    const userConfig = this.state.userConfig || {};
    if (!this.state.workflow?.nodes) return;

    this.state.workflow.nodes = this.state.workflow.nodes.map((node: any) => {
      const config = node.config || {};

      // Google Doc
      if (node.type === 'google_doc' && config.operation === 'read') {
        config.documentId = config.documentId ||
          userConfig.documentId ||
          userConfig.google_doc_id ||
          userConfig.google_doc_url ||
          '';
      }

      // Google Sheets
      if (node.type === 'google_sheets' && config.operation === 'read') {
        config.spreadsheetId = config.spreadsheetId ||
          userConfig.spreadsheetId ||
          userConfig.google_sheet_id ||
          userConfig.google_sheet_url ||
          '';
        config.sheetName = config.sheetName || userConfig.sheetName || userConfig.sheet_name || 'Sheet1';
      }

      // Slack
      if (node.type === 'slack_webhook' || node.type === 'slack_message') {
        config.webhookUrl = config.webhookUrl ||
          userConfig.webhookUrl ||
          userConfig.slack_webhook ||
          '';
      }

      // Gmail
      if (node.type === 'google_gmail' && config.operation === 'send') {
        config.to = config.to || userConfig.to || userConfig.email || '';
        config.subject = config.subject || userConfig.subject || 'Message from Workflow';
        // Don't override body if it already has template variables
        if (!config.body || (!config.body.includes('{{input') && !config.body.trim())) {
          config.body = config.body || userConfig.body || '{{input.content}}';
        }
      }

      return { ...node, config };
    });
  }

  /**
   * Extract required nodes from user goal
   */
  private extractRequiredNodes(goal: string): string[] {
    const goalLower = goal.toLowerCase();
    const required: string[] = [];

    // 🚨 CRITICAL: Parse explicit "Nodes Used:" section FIRST (highest priority)
    const nodesUsedMatch = goal.match(/nodes?\s+used[:\s]+([^\n]+)/i);
    if (nodesUsedMatch) {
      const nodesUsedText = nodesUsedMatch[1].trim();
      const explicitNodes = nodesUsedText.split(/[,\n]/).map(n => n.trim()).filter(n => n.length > 0);

      console.log('[EXTRACT NODES] Found explicit "Nodes Used:" section:', explicitNodes);

      // Map common node name variations to actual node types
      const nodeNameMap: Record<string, string> = {
        'datadog': 'datadog',
        'data dog': 'datadog',
        'if': 'if_else',
        'if/else': 'if_else',
        'if else': 'if_else',
        'conditional': 'if_else',
        'slack': 'slack_webhook',
        'slack webhook': 'slack_webhook',
        'slack message': 'slack_message',
        'webhook': 'webhook',
        'form': 'form',
        'schedule': 'schedule',
        'manual': 'manual_trigger',
        'manual trigger': 'manual_trigger',
        'google sheets': 'google_sheets',
        'google sheet': 'google_sheets',
        'sheets': 'google_sheets',
        'google doc': 'google_doc',
        'google document': 'google_doc',
        'gmail': 'google_gmail',
        'email': 'google_gmail',
        'javascript': 'javascript',
        'js': 'javascript',
        'github': 'github',
        'gitlab': 'gitlab',
        'pagerduty': 'pagerduty',
        'jenkins': 'jenkins',
        'docker': 'docker',
        'kubernetes': 'kubernetes',
        'k8s': 'kubernetes',
      };

      for (const nodeName of explicitNodes) {
        const nodeNameLower = nodeName.toLowerCase().trim();
        const mappedNode = nodeNameMap[nodeNameLower];

        if (mappedNode) {
          if (!required.includes(mappedNode)) {
            required.push(mappedNode);
            console.log(`[EXTRACT NODES] Mapped "${nodeName}" → "${mappedNode}"`);
          }
        } else {
          // Try direct match (case-insensitive)
          const directMatch = Object.keys(nodeNameMap).find(key =>
            key.toLowerCase() === nodeNameLower ||
            nodeNameLower.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(nodeNameLower)
          );
          if (directMatch && !required.includes(nodeNameMap[directMatch])) {
            required.push(nodeNameMap[directMatch]);
            console.log(`[EXTRACT NODES] Direct match: "${nodeName}" → "${nodeNameMap[directMatch]}"`);
          } else {
            console.warn(`[EXTRACT NODES] Unknown node name in "Nodes Used:" section: "${nodeName}"`);
          }
        }
      }
    }

    // 🚨 CRITICAL: Check for form keywords - but only if not already specified
    if (!required.includes('form') && !required.includes('webhook') && !required.includes('schedule')) {
      const formKeywords = [
        'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
        'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
        'submission', 'user input', 'input from users', 'contact form', 'registration form',
        'feedback form', 'data collection', 'take the user data', 'user information',
        'gather data', 'collect information', 'user submission'
      ];

      const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

      if (requiresFormNode) {
        required.push('form'); // Form node is REQUIRED
        console.log('[EXTRACT NODES] Form keywords detected - form node is REQUIRED');
      }
    }

    // Add default trigger only if no trigger specified
    if (!required.some(node => ['form', 'webhook', 'schedule', 'manual_trigger', 'interval', 'chat_trigger'].includes(node))) {
      required.push('manual_trigger');
    }

    // Google Sheets (if not already added)
    if (!required.includes('google_sheets') && (goalLower.includes('google sheet') || goalLower.includes('sheets'))) {
      required.push('google_sheets');
      if (!required.includes('javascript')) {
        required.push('javascript'); // Always need JS to parse sheets data
      }
    }

    // Google Doc (if not already added)
    if (!required.includes('google_doc') && (goalLower.includes('google doc') || goalLower.includes('document'))) {
      required.push('google_doc');
    }

    // Gmail/Email (if not already added)
    if (!required.includes('google_gmail') && (goalLower.includes('gmail') || goalLower.includes('email') || goalLower.includes('send email'))) {
      required.push('google_gmail');
    }

    // Slack (if not already added)
    if (!required.includes('slack_webhook') && !required.includes('slack_message') && goalLower.includes('slack')) {
      required.push('slack_webhook'); // Default to slack_webhook
    }

    // Datadog (if not already added, check for monitoring/logs keywords)
    if (!required.includes('datadog')) {
      const datadogKeywords = ['datadog', 'data dog', 'monitor logs', 'log monitoring', 'monitoring', 'observability'];
      if (datadogKeywords.some(keyword => goalLower.includes(keyword))) {
        required.push('datadog');
        console.log('[EXTRACT NODES] Datadog keywords detected - datadog node is REQUIRED');
      }
    }

    // If/Else logic (if not already added, check for conditional keywords)
    if (!required.includes('if_else')) {
      const ifElseKeywords = ['if', 'else', 'conditional', 'check', 'validate', 'threshold', 'exceed'];
      if (ifElseKeywords.some(keyword => goalLower.includes(keyword))) {
        required.push('if_else');
        console.log('[EXTRACT NODES] Conditional logic keywords detected - if_else node is REQUIRED');
      }
    }

    console.log('[EXTRACT NODES] Final required nodes:', required);
    return required;
  }

  /**
   * PHASE 4: VALIDATION & SIMULATION
   * Simulate execution and validate the workflow
   */
  private async phase4_ValidationAndSimulation(): Promise<void> {
    console.log('[PHASE 4] Validating and simulating workflow...');

    const workflow = this.state.workflow;
    const analysis = this.state.analysis;
    const goalLower = this.state.goal.toLowerCase();
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');

    // Pre-check: Replace email_resend with google_gmail if user mentioned gmail/email
    if (hasGmail && workflow.nodes) {
      workflow.nodes = workflow.nodes.map((node: any) => {
        if (node.type === 'email_resend') {
          console.log(`[PHASE 4] Pre-validation: Replacing email_resend with google_gmail for node ${node.id}`);
          return {
            ...node,
            type: 'google_gmail',
            config: {
              ...node.config,
              operation: 'send',
              to: node.config.to || '',
              subject: node.config.subject || 'Message from Workflow',
              body: node.config.body || node.config.text || '',
            },
          };
        }
        return node;
      });
      this.state.workflow = workflow;
    }

    const prompt = `You are an expert workflow validation agent. Simulate execution and identify ALL possible errors.

WORKFLOW:
${JSON.stringify(workflow, null, 2)}

EXPECTED BEHAVIOR (from analysis):
${JSON.stringify(analysis, null, 2)}

${this.nodeKnowledge}

${hasGmail ? 'CRITICAL: User mentioned "gmail" or "email". Workflow MUST use google_gmail node (operation: "send"). Any other email node type is INVALID.' : ''}

Simulate step-by-step execution and identify ANY possible failure points. Respond with JSON:
{
  "validationStatus": "PASS" | "FAIL",
  "errors": [
    {
      "nodeId": "node_id",
      "type": "error_type",
      "message": "What's wrong",
      "severity": "critical" | "warning",
      "fix": "How to fix it"
    }
  ],
  "warnings": [
    {
      "nodeId": "node_id",
      "message": "Warning message",
      "fix": "Recommendation"
    }
  ],
  "simulationResults": {
    "canExecute": true/false,
    "dataFlowIssues": ["issues"],
    "missingConfig": ["list of missing required fields"],
    "invalidConnections": ["list of invalid node connections"]
  }
}

Be thorough. Check:
- All required config fields are present
- Node connections are valid
- Data flow is correct
- Template variables reference valid fields
- Error handling is in place
${hasGmail ? '- If any email node other than google_gmail exists, that is a CRITICAL ERROR - must be google_gmail' : ''}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a thorough validation agent. Identify ALL errors. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.2,
    });

    let validationText = response.content.trim();
    if (validationText.includes('```json')) {
      validationText = validationText.split('```json')[1].split('```')[0].trim();
    } else if (validationText.includes('```')) {
      validationText = validationText.split('```')[1].split('```')[0].trim();
    }

    const validation = JSON.parse(validationText);

    // Also run programmatic validation
    const programmaticErrors = this.validateProgrammatically(workflow);
    validation.errors = [...(validation.errors || []), ...programmaticErrors];

    if (validation.validationStatus === 'PASS' && validation.errors.length === 0) {
      console.log('[PHASE 4] Validation PASSED');
      this.state.phase = 'verification';
    } else {
      console.log(`[PHASE 4] Validation FAILED: ${validation.errors.length} errors found`);
      this.state.errors = validation.errors || [];
      this.state.phase = 'healing';
    }
  }

  /**
   * PHASE 5: ERROR HANDLING & SELF-HEALING
   * Automatically fix all detected errors
   */
  private async phase5_ErrorHandlingAndSelfHealing(): Promise<void> {
    console.log('[PHASE 5] Self-healing: Fixing errors...');

    if (this.state.errors.length === 0) {
      this.state.phase = 'verification';
      return;
    }

    const workflow = this.state.workflow;
    const errors = this.state.errors;
    const memoryFixes = this.findMemoryFixes(errors);
    const goal = this.state.goal;
    const requiredNodes = this.extractRequiredNodes(goal);

    // Check if we have missing required nodes - if so, rebuild from scratch
    const hasMissingNodes = errors.some(e =>
      e.type === 'missing_required_nodes' ||
      e.type === 'goal_mismatch' ||
      e.type === 'missing_nodes'
    );

    if (hasMissingNodes) {
      console.log('[PHASE 5] Missing required nodes detected - rebuilding workflow from scratch');
      this.state.phase = 'planning'; // Re-plan completely
      return;
    }

    // CRITICAL FIX: Do NOT feed previous outputs back into prompt
    // Only include essential information
    
    const prompt = `You are a self-healing workflow agent. Fix ALL errors automatically.

USER GOAL: "${goal}"

ERRORS TO FIX:
${JSON.stringify(errors.map(e => ({ type: e.type, message: e.message })), null, 2)}

REQUIRED NODES (must be present):
${JSON.stringify(requiredNodes, null, 2)}

${this.nodeKnowledge}

Fix ALL errors and return the corrected workflow as JSON:
{
  "name": "Workflow name",
  "nodes": [...],
  "edges": [...],
  "fixesApplied": [
    {
      "error": "error description",
      "fix": "what was fixed",
      "nodeId": "node_id"
    }
  ]
}

CRITICAL: You MUST NOT ask for help. Fix errors automatically using:
- Reconfigure nodes with correct values
- Replace nodes if needed
- Add missing nodes (if any are missing from required nodes list)
- Fix connections
- Add error handling/retries
- Add fallback logic
- Ensure ALL required nodes from the list above are present in the workflow`;

    const messages: LLMMessage[] = [
      { 
        role: 'system', 
        content: 'You are a self-healing agent. Fix ALL errors automatically. You must return ONLY valid JSON. Do not include explanations, markdown code blocks, or any text outside the JSON object.' 
      },
      { role: 'user', content: prompt },
    ];

    // TOKEN BUDGET CHECK
    this.checkTokenBudget(messages);

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.3,
    });

    // Extract JSON only
    const responseText = response.content.trim();
    const jsonText = extractFirstJSONObject(responseText);
    const fixedWorkflow = JSON.parse(jsonText);
    
    // Validate workflow structure
    if (!isValidWorkflow(fixedWorkflow)) {
      throw new Error('Self-healing returned invalid workflow JSON');
    }

    // Validate and normalize fixed workflow
    if (!isValidWorkflow(fixedWorkflow)) {
      throw new Error('Self-healing returned invalid workflow JSON');
    }
    
    const normalized = normalizeWorkflow(fixedWorkflow);
    
    // Apply programmatic fixes
    this.state.workflow = validateAndFixWorkflow({
      name: fixedWorkflow.name || workflow.name,
      nodes: normalized.nodes,
      edges: normalized.edges,
    });

    // CRITICAL: Verify required nodes are still present after fixing
    const actualNodeTypes = this.state.workflow.nodes?.map((n: any) => n.type) || [];
    const missingNodes = requiredNodes.filter((req: string) => !actualNodeTypes.includes(req));

    if (missingNodes.length > 0) {
      console.error(`[PHASE 5] After fixing, still missing nodes: ${missingNodes.join(', ')}`);
      this.state.errors.push({
        type: 'missing_required_nodes',
        message: `After self-healing, workflow still missing required nodes: ${missingNodes.join(', ')}`,
        fix: `Add the following nodes: ${missingNodes.join(', ')}`,
      });
      // Re-plan completely
      this.state.phase = 'planning';
      return;
    }

    // Clear errors and re-validate
    this.state.errors = [];
    console.log('[PHASE 5] Self-healing complete, re-validating...');
    this.state.phase = 'validation';
  }

  /**
   * PHASE 6: GOAL VERIFICATION
   * Verify final output matches USER_GOAL exactly
   */
  private async phase6_GoalVerification(): Promise<boolean> {
    console.log('[PHASE 6] Verifying goal achievement...');

    const workflow = this.state.workflow;
    const goal = this.state.goal;
    const analysis = this.state.analysis;

    // CRITICAL: Programmatic validation first - check if required nodes are present
    const programmaticCheck = this.verifyGoalProgrammatically(goal, workflow);
    if (!programmaticCheck.passed) {
      console.log(`[PHASE 6] Programmatic check FAILED: ${programmaticCheck.reason}`);
      this.state.errors.push({
        type: 'goal_mismatch',
        message: programmaticCheck.reason,
        fix: programmaticCheck.fix,
      });
      this.state.phase = 'planning'; // Re-plan
      return false;
    }

    const prompt = `You are a goal verification agent. Verify if the workflow achieves the user's goal.

USER GOAL: "${goal}"

EXPECTED (from analysis):
${JSON.stringify(analysis, null, 2)}

ACTUAL WORKFLOW:
${JSON.stringify(workflow, null, 2)}

${this.nodeKnowledge}

PROGRAMMATIC CHECK RESULTS:
${JSON.stringify(programmaticCheck, null, 2)}

Verify if the workflow achieves 100% of the goal. Respond with JSON:
{
  "goalAchieved": true/false,
  "completionPercentage": 0-100,
  "missingRequirements": ["list of unmet requirements"],
  "missingNodes": ["list of missing node types"],
  "verificationDetails": "Detailed explanation of why goal is/isn't met"
}

Goal is achieved ONLY if:
- All required inputs are handled
- All expected outputs are produced
- All constraints are satisfied
- Workflow is executable end-to-end
- No runtime errors are possible
- ALL mentioned services/tools have corresponding nodes in the workflow`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a strict goal verification agent. Be precise. If workflow is missing required nodes, goal is NOT achieved. Always respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ];

    const response = await this.callLLMWithFallback(messages, {
      temperature: 0.2,
    });

    let verificationText = response.content.trim();
    if (verificationText.includes('```json')) {
      verificationText = verificationText.split('```json')[1].split('```')[0].trim();
    } else if (verificationText.includes('```')) {
      verificationText = verificationText.split('```')[1].split('```')[0].trim();
    }

    const verification = JSON.parse(verificationText);

    // CRITICAL: If AI says goal achieved but programmatic check found missing nodes, fail
    if (verification.missingNodes && verification.missingNodes.length > 0) {
      console.log(`[PHASE 6] Goal verification FAILED: Missing nodes: ${verification.missingNodes.join(', ')}`);
      this.state.errors.push({
        type: 'missing_nodes',
        message: `Workflow is missing required nodes: ${verification.missingNodes.join(', ')}`,
        fix: `Add the following nodes: ${verification.missingNodes.join(', ')}`,
      });
      this.state.phase = 'planning';
      return false;
    }

    if (verification.goalAchieved && verification.completionPercentage >= 100) {
      console.log('[PHASE 6] Goal verification PASSED: 100% completion');
      this.state.phase = 'learning';
      return true;
    } else {
      console.log(`[PHASE 6] Goal verification FAILED: ${verification.completionPercentage}% completion`);
      console.log(`Missing: ${verification.missingRequirements?.join(', ')}`);
      this.state.errors.push({
        type: 'goal_incomplete',
        message: `Goal only ${verification.completionPercentage}% complete: ${verification.missingRequirements?.join(', ')}`,
        fix: `Address missing requirements: ${verification.missingRequirements?.join(', ')}`,
      });
      this.state.phase = 'planning'; // Re-plan to address missing requirements
      return false;
    }
  }

  /**
   * Programmatic goal verification - checks if required nodes are present
   */
  private verifyGoalProgrammatically(goal: string, workflow: any): { passed: boolean; reason: string; fix: string } {
    const goalLower = goal.toLowerCase();
    const nodeTypes = workflow.nodes?.map((n: any) => n.type || n.data?.type) || [];

    // 🚨 CRITICAL: Check for explicitly mentioned nodes in "Nodes Used:" section FIRST
    const nodesUsedMatch = goal.match(/nodes?\s+used[:\s]+([^\n]+)/i);
    if (nodesUsedMatch) {
      const nodesUsedText = nodesUsedMatch[1].trim();
      const explicitNodes = nodesUsedText.split(/[,\n]/).map(n => n.trim().toLowerCase()).filter(n => n.length > 0);

      // Check for Datadog
      if (explicitNodes.some(n => n.includes('datadog') || n.includes('data dog'))) {
        if (!nodeTypes.includes('datadog')) {
          return {
            passed: false,
            reason: 'User explicitly mentioned "Datadog" in "Nodes Used:" section but workflow has no datadog node',
            fix: 'Add datadog node with appropriate operation (query_metrics, create_event, etc.)',
          };
        }
      }

      // Check for If/Else
      if (explicitNodes.some(n => n === 'if' || n.includes('if') || n.includes('else') || n.includes('conditional'))) {
        if (!nodeTypes.includes('if_else')) {
          return {
            passed: false,
            reason: 'User explicitly mentioned "If" in "Nodes Used:" section but workflow has no if_else node',
            fix: 'Add if_else node for conditional logic with both true and false output edges',
          };
        }
      }

      // Check for Slack
      if (explicitNodes.some(n => n.includes('slack'))) {
        if (!nodeTypes.includes('slack_webhook') && !nodeTypes.includes('slack_message')) {
          return {
            passed: false,
            reason: 'User explicitly mentioned "Slack" in "Nodes Used:" section but workflow has no slack node',
            fix: 'Add slack_webhook or slack_message node',
          };
        }
      }
    }

    // 🚨 CRITICAL: Check for Form node (highest priority)
    const formKeywords = [
      'form', 'create a form', 'form data', 'user data', 'collect data', 'collect user data',
      'name', 'email', 'mobile', 'phone', 'contact', 'registration', 'survey', 'feedback',
      'submission', 'user input', 'input from users', 'contact form', 'registration form',
      'feedback form', 'data collection', 'take the user data', 'user information',
      'gather data', 'collect information', 'user submission'
    ];

    const requiresFormNode = formKeywords.some(keyword => goalLower.includes(keyword));

    if (requiresFormNode && !nodeTypes.includes('form')) {
      return {
        passed: false,
        reason: `User mentioned form-related keywords (${formKeywords.filter(k => goalLower.includes(k)).join(', ')}) but workflow has no form node. Form node is REQUIRED.`,
        fix: 'Replace manual_trigger with form node and configure form fields (name, email, mobile, etc.)',
      };
    }

    // If form node is required but manual_trigger is present, that's wrong
    if (requiresFormNode && nodeTypes.includes('manual_trigger')) {
      return {
        passed: false,
        reason: 'User requires form node but workflow uses manual_trigger. Form node must be used instead.',
        fix: 'Replace manual_trigger with form node',
      };
    }

    // Check for Google Sheets
    if (goalLower.includes('google sheet') || goalLower.includes('sheets')) {
      if (!nodeTypes.includes('google_sheets')) {
        return {
          passed: false,
          reason: 'User mentioned "google sheets" but workflow has no google_sheets node',
          fix: 'Add google_sheets node with operation: "read"',
        };
      }
    }

    // Check for Google Doc/Documents
    if (goalLower.includes('google doc') || goalLower.includes('document')) {
      if (!nodeTypes.includes('google_doc')) {
        return {
          passed: false,
          reason: 'User mentioned "google doc" or "document" but workflow has no google_doc node',
          fix: 'Add google_doc node with operation: "read"',
        };
      }
    }

    // Check for Gmail/Email
    if (goalLower.includes('gmail') || goalLower.includes('email') || goalLower.includes('send email')) {
      if (!nodeTypes.includes('google_gmail')) {
        return {
          passed: false,
          reason: 'User mentioned "gmail" or "email" but workflow has no google_gmail node',
          fix: 'Add google_gmail node with operation: "send"',
        };
      }
    }

    // Check for Slack
    if (goalLower.includes('slack')) {
      if (!nodeTypes.includes('slack_webhook') && !nodeTypes.includes('slack_message')) {
        return {
          passed: false,
          reason: 'User mentioned "slack" but workflow has no slack_webhook or slack_message node',
          fix: 'Add slack_webhook or slack_message node',
        };
      }
    }

    // Check for Datadog (monitoring/logs)
    if (goalLower.includes('datadog') || goalLower.includes('data dog') || goalLower.includes('monitor logs') || goalLower.includes('log monitoring')) {
      if (!nodeTypes.includes('datadog')) {
        return {
          passed: false,
          reason: 'User mentioned "datadog" or "monitoring logs" but workflow has no datadog node',
          fix: 'Add datadog node with appropriate operation (query_metrics, create_event, etc.)',
        };
      }
    }

    // Check for If/Else logic (conditional)
    if (goalLower.includes('if') || goalLower.includes('else') || goalLower.includes('conditional') || goalLower.includes('threshold') || goalLower.includes('exceed')) {
      if (!nodeTypes.includes('if_else')) {
        // This is a warning, not always required - but if user explicitly mentioned it, it's required
        const nodesUsedMatch = goal.match(/nodes?\s+used[:\s]+([^\n]+)/i);
        if (nodesUsedMatch) {
          const nodesUsedText = nodesUsedMatch[1].toLowerCase();
          if (nodesUsedText.includes('if') || nodesUsedText.includes('else')) {
            return {
              passed: false,
              reason: 'User explicitly mentioned "If" in "Nodes Used:" section but workflow has no if_else node',
              fix: 'Add if_else node for conditional logic with both true and false output edges',
            };
          }
        }
      }
    }

    // Check for JavaScript node when Google Sheets is present (needed to parse data)
    if (nodeTypes.includes('google_sheets') && !nodeTypes.includes('javascript')) {
      return {
        passed: false,
        reason: 'Workflow has google_sheets but missing javascript node to parse the array-of-arrays format',
        fix: 'Add javascript node after google_sheets to parse the data format',
      };
    }

    // Check if JavaScript nodes have proper code that returns formatted text
    if (nodeTypes.includes('javascript')) {
      const jsNodes = workflow.nodes?.filter((n: any) => n.type === 'javascript') || [];
      for (const jsNode of jsNodes) {
        const code = jsNode.config?.code || '';
        const hasReturnContent = code.includes('content:') || code.includes('"content"') || code.includes("'content'");
        const hasReturnText = code.includes('text:') || code.includes('"text"') || code.includes("'text'");
        if (!hasReturnContent && !hasReturnText) {
          return {
            passed: false,
            reason: `JavaScript node ${jsNode.id} does not return formatted text (content/text/body fields)`,
            fix: 'Update JavaScript code to return {content: "formatted text", text: "formatted text", body: "formatted text"}',
          };
        }
      }
    }

    // Check if output nodes use correct template variables
    const outputNodes = workflow.nodes?.filter((n: any) =>
      ['google_gmail', 'slack_webhook', 'slack_message'].includes(n.type)
    ) || [];
    for (const outputNode of outputNodes) {
      const body = outputNode.config?.body || outputNode.config?.text || '';
      const hasTemplateVar = body.includes('{{input.content}}') ||
        body.includes('{{input.content}}') ||
        body.includes('{{input.text}}') ||
        body.includes('{{input.body}}');
      if (!hasTemplateVar && body.trim() !== '') {
        // This is a warning, not a failure - but we should fix it
        console.warn(`[VERIFICATION] Output node ${outputNode.id} may not be using template variables correctly`);
      }
    }

    // Check if workflow has output nodes when user wants to "send" data
    if (goalLower.includes('send') || goalLower.includes('send to')) {
      const hasOutput = nodeTypes.some((type: string) =>
        ['google_gmail', 'slack_webhook', 'slack_message', 'discord_webhook', 'http_post'].includes(type)
      );
      if (!hasOutput) {
        return {
          passed: false,
          reason: 'User wants to "send" data but workflow has no output node (gmail, slack, etc.)',
          fix: 'Add output node (google_gmail, slack_webhook, etc.) to send the data',
        };
      }
    }

    // Check if workflow only has trigger and log (basic fallback) - this is wrong
    if (nodeTypes.length <= 2 && nodeTypes.includes('manual_trigger') && nodeTypes.includes('log_output')) {
      return {
        passed: false,
        reason: 'Workflow only has trigger and log_output - this is a fallback, not the actual workflow',
        fix: 'Generate the complete workflow with all required nodes based on user goal',
      };
    }

    return { passed: true, reason: 'All required nodes present', fix: '' };
  }


  /**
   * PHASE 7: LEARNING & MEMORY UPDATE
   * Store successful patterns and learn from the experience
   */
  private async phase7_LearningAndMemoryUpdate(): Promise<void> {
    console.log('[PHASE 7] Updating learning memory...');

    if (!this.config.enableLearning) {
      return;
    }

    const workflow = this.state.workflow;
    const goal = this.state.goal;
    const nodeTypes = workflow.nodes.map((n: any) => n.type);

    // Store successful pattern
    this.state.memory.successfulPatterns.push({
      pattern: goal,
      workflow: workflow,
      timestamp: Date.now(),
    });

    // Store node combination
    this.state.memory.nodeCombinations.push({
      nodes: nodeTypes,
      success: true,
      timestamp: Date.now(),
    });

    // Store error fixes if any were applied
    if (this.state.errors.length > 0) {
      this.state.errors.forEach(error => {
        this.state.memory.errorFixes.push({
          error: error.message,
          fix: error.fix,
          timestamp: Date.now(),
        });
      });
    }

    // Keep only recent memory (last 100 entries per category)
    this.state.memory.successfulPatterns = this.state.memory.successfulPatterns.slice(-100);
    this.state.memory.errorFixes = this.state.memory.errorFixes.slice(-100);
    this.state.memory.nodeCombinations = this.state.memory.nodeCombinations.slice(-100);

    console.log('[PHASE 7] Memory updated');
  }

  /**
   * Helper: Build memory context for planning
   */
  private buildMemoryContext(): string {
    if (!this.config.enableLearning || this.state.memory.successfulPatterns.length === 0) {
      return '';
    }

    const recentPatterns = this.state.memory.successfulPatterns.slice(-5);
    const recentFixes = this.state.memory.errorFixes.slice(-5);

    return `
LEARNING MEMORY (for reference):
Recent successful patterns:
${JSON.stringify(recentPatterns, null, 2)}

Recent error fixes:
${JSON.stringify(recentFixes, null, 2)}
`;
  }

  /**
   * Helper: Find fixes from memory for similar errors
   */
  private findMemoryFixes(errors: Array<{ type: string; message: string; fix: string }>): Array<any> {
    if (!this.config.enableLearning) {
      return [];
    }

    const fixes: Array<any> = [];
    errors.forEach(error => {
      const similarFix = this.state.memory.errorFixes.find(
        f => f.error.toLowerCase().includes(error.type.toLowerCase()) ||
          error.message.toLowerCase().includes(f.error.toLowerCase())
      );
      if (similarFix) {
        fixes.push(similarFix);
      }
    });

    return fixes;
  }

  /**
   * Helper: Programmatic validation
   */
  private validateProgrammatically(workflow: any): Array<{ type: string; message: string; fix: string }> {
    const errors: Array<{ type: string; message: string; fix: string }> = [];

    if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
      errors.push({
        type: 'structure',
        message: 'Workflow has no nodes',
        fix: 'Add at least one trigger node',
      });
    }

    if (!workflow.edges || !Array.isArray(workflow.edges)) {
      errors.push({
        type: 'structure',
        message: 'Workflow has no edges',
        fix: 'Add edges to connect nodes',
      });
    }

    // Check for trigger node
    const hasTrigger = workflow.nodes?.some((n: any) =>
      ['manual_trigger', 'webhook', 'schedule', 'chat_trigger', 'interval', 'workflow_trigger'].includes(n.type)
    );
    if (!hasTrigger) {
      errors.push({
        type: 'structure',
        message: 'Workflow missing trigger node',
        fix: 'Add a trigger node (manual_trigger, webhook, schedule, etc.)',
      });
    }

    // CRITICAL: Check for any invalid email node types - only google_gmail is valid
    workflow.nodes?.forEach((node: any) => {
      if (node.type === 'email_resend' || (node.type.includes('email') && node.type !== 'google_gmail')) {
        errors.push({
          type: 'email_node',
          message: `Node ${node.id} uses invalid email node type "${node.type}". Must use google_gmail instead.`,
          fix: 'Replace with google_gmail node (operation: send)',
        });
      }
    });

    // Check if_else nodes have both outputs
    workflow.nodes?.forEach((node: any) => {
      if (node.type === 'if_else') {
        const trueEdge = workflow.edges?.find((e: any) => e.source === node.id && e.sourceHandle === 'true');
        const falseEdge = workflow.edges?.find((e: any) => e.source === node.id && e.sourceHandle === 'false');

        if (!trueEdge) {
          errors.push({
            type: 'if_else',
            message: `If/Else node ${node.id} missing TRUE output`,
            fix: 'Add edge from TRUE output handle',
          });
        }
        if (!falseEdge) {
          errors.push({
            type: 'if_else',
            message: `If/Else node ${node.id} missing FALSE output`,
            fix: 'Add edge from FALSE output handle',
          });
        }
      }
    });

    return errors;
  }

  /**
   * Helper: Generate fallback workflow if all iterations fail
   * NOTE: This should NEVER be returned - it's only for internal error cases
   * If this is returned, it means the agent completely failed
   */
  private generateFallbackWorkflow(userGoal: string): any {
    console.error('[AGENT] CRITICAL: Generating fallback workflow - this should not happen!');
    console.error('[AGENT] This indicates a complete failure of workflow generation.');

    // Don't return fallback - throw error instead
    throw new Error(`Failed to generate workflow for: "${userGoal}". The autonomous agent was unable to create a valid workflow after all retry attempts. Please check your prompt and try again.`);
  }
}

