# 🎯 MASTER PROMPT: Enterprise-Grade Node Implementation

## Context & Mission
You are implementing nodes for **Flow Genius AI** (Ctrl Checks), a superior n8n alternative. Every node must be production-ready, error-free, and outperform n8n in reliability, performance, and developer experience.

## 🏗️ CODEBASE ARCHITECTURE

### Current Structure
- **Node Definitions**: `src/components/workflow/nodeTypes.ts` - UI metadata, config fields, categories
- **Execution Engine**: `supabase/functions/execute-workflow/index.ts` - Runtime execution logic
- **Usage Guides**: `src/components/workflow/nodeUsageGuides.ts` - User documentation
- **Node Interface**: Uses `NodeTypeDefinition` interface with `type`, `label`, `category`, `icon`, `description`, `defaultConfig`, `configFields`
- **Execution Pattern**: Switch statement in `executeNode()` function that handles each node type

### Execution Flow
1. Workflow execution starts in `execute-workflow/index.ts`
2. Nodes execute in topological order (dependencies resolved)
3. Each node receives input from previous nodes
4. Node output stored in `nodeOutputs` map
5. Logs tracked in `logs` array for execution history

## 📋 IMPLEMENTATION REQUIREMENTS

### RULE 1: CODE QUALITY STANDARDS (NON-NEGOTIABLE)
```typescript
✅ 100% TypeScript with strict mode enabled
✅ Zero 'any' types - use proper interfaces and types
✅ Complete error handling with actionable messages
✅ Input validation with schema validation
✅ Memory leak prevention (cleanup resources)
✅ Async/await with proper error catching
✅ Rate limiting for external APIs
✅ Retry logic for transient failures
✅ Circuit breaker pattern for external services
✅ Timeout handling for all external calls
```

### RULE 2: IMPLEMENTATION PATTERN

For **each new node**, you must implement **THREE components**:

#### Component 1: Node Type Definition (`src/components/workflow/nodeTypes.ts`)
Add to `NODE_TYPES` array:
```typescript
{
  type: 'node_type_name',           // Unique identifier (snake_case)
  label: 'Display Name',            // Human-readable label
  category: 'category',             // 'triggers' | 'ai' | 'logic' | 'data' | 'output' | 'http_api'
  icon: 'IconName',                 // Lucide icon name (must be imported)
  description: 'Brief description', // One-line description
  defaultConfig: {                  // Default configuration values
    key: 'default_value'
  },
  configFields: [                   // UI configuration fields
    {
      key: 'param_name',
      label: 'Parameter Label',
      type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'time',
      placeholder: 'Placeholder text',
      defaultValue: 'default',
      required: true | false,
      helpText: 'Help text shown to users',
      options: [                     // For 'select' type only
        { label: 'Option 1', value: 'value1' }
      ]
    }
  ]
}
```

#### Component 2: Execution Logic (`supabase/functions/execute-workflow/index.ts`)
Add case to `executeNode()` function:
```typescript
case "node_type_name": {
  // 1. Extract configuration
  const param1 = config.param1 as string;
  const param2 = config.param2 as number;
  
  // 2. Validate input
  if (!input || typeof input !== 'object') {
    throw new Error('Node Type: Input must be an object');
  }
  
  // 3. Validate required parameters
  if (!param1) {
    throw new Error('Node Type: param1 is required');
  }
  
  // 4. Extract data from input (handle various input formats)
  const inputObj = input as Record<string, unknown>;
  const data = inputObj.data || inputObj.input || inputObj;
  
  // 5. Implement business logic with error handling
  try {
    // Use try-catch for external API calls
    const result = await performOperation(data, param1, param2);
    
    // 6. Return standardized output
    return {
      success: true,
      result: result,
      // Pass through original input for downstream nodes
      ...(typeof input === 'object' && input !== null ? input : {})
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Node Type failed: ${errorMessage}`);
  }
}
```

#### Component 3: Usage Guide (`src/components/workflow/nodeUsageGuides.ts`)
Add to `NODE_USAGE_GUIDES` object:
```typescript
node_type_name: {
  overview: 'Clear explanation of what this node does and when to use it.',
  inputs: ['List of expected input fields or data'],
  outputs: ['List of output fields'],
  example: `Example workflow:
Input: { data: "example" }
Config: { param: "value" }
Output: { result: "processed data" }`,
  tips: [
    'Pro tip 1 for users',
    'Pro tip 2 for users',
    'Common gotcha to avoid'
  ]
}
```

### RULE 3: CATEGORY-SPECIFIC REQUIREMENTS

#### AI/ML Nodes
```typescript
// Must include:
✅ Token counting and cost estimation
✅ Context window management
✅ Temperature/parameter controls
✅ Model selection with fallback
✅ Streaming support (if applicable)
✅ Conversation memory/history integration
✅ Rate limiting per API key
✅ Error retry with exponential backoff
✅ Usage metrics tracking

// Example pattern:
case "openai_gpt": {
  const apiKey = (config.apiKey as string) || lovableApiKey;
  const model = (config.model as string) || 'gpt-4o';
  const prompt = config.prompt as string;
  const temperature = (config.temperature as number) ?? 0.7;
  const memoryLimit = (config.memory as number) ?? 10;
  
  if (!prompt) throw new Error('OpenAI GPT: System prompt is required');
  
  // Use LLMAdapter for unified interface
  const llmAdapter = new LLMAdapter();
  // ... implementation
}
```

#### Database Nodes
```typescript
// Must include:
✅ Connection pooling (reuse connections)
✅ Query parameterization (prevent SQL injection)
✅ Transaction support
✅ Connection retry logic
✅ Query timeout (30s default)
✅ Connection limit enforcement
✅ SSL/TLS support
✅ Connection testing before use
✅ Bulk operations optimization
✅ Pagination for large results

// Example pattern:
case "database_read": {
  const table = config.table as string;
  const filters = config.filters as Record<string, unknown>;
  const limit = (config.limit as number) || 100;
  
  if (!table) throw new Error('Database Read: Table name is required');
  
  // Use parameterized queries
  const query = supabase.from(table).select('*');
  
  // Apply filters safely
  Object.entries(filters || {}).forEach(([key, value]) => {
    query.eq(key, value);
  });
  
  const { data, error } = await query.limit(limit);
  
  if (error) throw new Error(`Database Read failed: ${error.message}`);
  
  return { rows: data || [], count: data?.length || 0 };
}
```

#### HTTP/API Nodes
```typescript
// Must include:
✅ Request timeout (10s default, configurable)
✅ Retry logic (3 attempts with exponential backoff)
✅ Rate limiting
✅ Proper error handling (4xx vs 5xx)
✅ Header sanitization
✅ URL validation
✅ Response size limits
✅ Content-Type handling
✅ Authentication support (Bearer, Basic, API Key)

// Example pattern:
case "http_request": {
  const url = config.url as string;
  const method = (config.method as string) || 'GET';
  const headers = (config.headers as Record<string, string>) || {};
  const body = config.body;
  const timeout = (config.timeout as number) || 10000;
  
  if (!url) throw new Error('HTTP Request: URL is required');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { response: data, status: response.status, headers: Object.fromEntries(response.headers) };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('HTTP Request: Request timeout');
    }
    throw error;
  }
}
```

#### File Operation Nodes
```typescript
// Must include:
✅ Stream-based operations (avoid loading entire file in memory)
✅ Chunked uploads/downloads (for large files)
✅ Progress reporting (if applicable)
✅ Resume capabilities (if applicable)
✅ File size limits
✅ MIME type detection
✅ Path sanitization (prevent directory traversal)
✅ Permission checks
✅ Error handling for file not found, permission denied, etc.

// Example pattern:
case "file_read": {
  const filePath = config.path as string;
  const maxSize = (config.maxSize as number) || 10 * 1024 * 1024; // 10MB default
  
  if (!filePath) throw new Error('File Read: File path is required');
  
  // Sanitize path (prevent directory traversal)
  const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');
  
  try {
    const stats = await Deno.stat(sanitizedPath);
    if (stats.size > maxSize) {
      throw new Error(`File size ${stats.size} exceeds limit ${maxSize}`);
    }
    
    const content = await Deno.readTextFile(sanitizedPath);
    return { content, size: stats.size, path: sanitizedPath };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}
```

#### Logic Nodes (If/Else, Switch, Loop)
```typescript
// Must include:
✅ Safe expression evaluation
✅ Type coercion handling
✅ Edge case handling (null, undefined, empty strings)
✅ Clear error messages for invalid expressions
✅ Performance optimization for large datasets

// Example pattern (If/Else):
case "if_else": {
  const condition = config.condition as string;
  if (!condition) throw new Error('If/Else: Condition is required');
  
  // Safe expression evaluation
  const inputObj = input as Record<string, unknown>;
  
  try {
    // Replace template variables {{input.field}} with actual values
    const evaluatedCondition = evaluateCondition(condition, inputObj);
    
    return {
      condition: evaluatedCondition,
      input: input, // Pass through for downstream nodes
      // This allows downstream nodes to access original input
    };
  } catch (error) {
    throw new Error(`If/Else condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### RULE 4: ERROR HANDLING PATTERN
```typescript
// Standard error handling approach:
try {
  // Node logic
  const result = await performOperation();
  return result;
} catch (error) {
  // Provide actionable error messages
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Include context in error message
  throw new Error(`Node Name failed: ${errorMessage}. Check your configuration and try again.`);
}
```

### RULE 5: INPUT/OUTPUT STANDARDS

#### Input Handling
```typescript
// Always handle multiple input formats gracefully:
const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};

// Try common field names:
const data = inputObj.data || inputObj.input || inputObj.text || inputObj.body || inputObj;
```

#### Output Formatting
```typescript
// Always return structured output:
return {
  // Node-specific result
  result: processedData,
  // Metadata
  success: true,
  // Pass through original input for chaining
  ...(typeof input === 'object' && input !== null ? input : {})
};
```

### RULE 6: CONFIGURATION VALIDATION
```typescript
// Always validate required fields:
const requiredParam = config.requiredParam as string;
if (!requiredParam || requiredParam.trim() === '') {
  throw new Error('Node Name: requiredParam is required');
}

// Validate types:
const numericParam = config.numericParam;
if (numericParam !== undefined && typeof numericParam !== 'number') {
  throw new Error('Node Name: numericParam must be a number');
}

// Validate ranges:
const percentage = config.percentage as number;
if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
  throw new Error('Node Name: percentage must be between 0 and 100');
}
```

## 🚀 IMPLEMENTATION WORKFLOW

### Step 1: Plan the Node
1. Determine node category (`triggers`, `ai`, `logic`, `data`, `output`, `http_api`)
2. Define required configuration parameters
3. Define input/output schema
4. Identify dependencies (external APIs, libraries)
5. Plan error scenarios

### Step 2: Implement Node Definition
- Add entry to `NODE_TYPES` array in `src/components/workflow/nodeTypes.ts`
- Choose appropriate Lucide icon (must be imported in `NodeLibrary.tsx`)
- Define all config fields with proper types and validation
- Set sensible defaults

### Step 3: Implement Execution Logic
- Add case to `executeNode()` function in `supabase/functions/execute-workflow/index.ts`
- Follow error handling patterns
- Implement retry logic for external APIs
- Add timeout handling
- Validate all inputs and configs

### Step 4: Add Usage Guide
- Add entry to `NODE_USAGE_GUIDES` in `src/components/workflow/nodeUsageGuides.ts`
- Write clear overview
- Document inputs/outputs
- Provide practical example
- Add helpful tips

### Step 5: Test the Node
1. Test happy path with valid inputs
2. Test error cases (missing config, invalid input, network failures)
3. Test edge cases (empty strings, null values, large inputs)
4. Test integration with other nodes
5. Verify execution logs are correct

## 📝 TEMPLATE: Complete Node Implementation

```typescript
// ============================================
// STEP 1: Add to src/components/workflow/nodeTypes.ts
// ============================================
{
  type: 'example_node',
  label: 'Example Node',
  category: 'data', // Choose appropriate category
  icon: 'IconName', // Must match Lucide icon name
  description: 'What this node does in one sentence',
  defaultConfig: {
    param1: 'default_value',
    param2: 100
  },
  configFields: [
    {
      key: 'param1',
      label: 'Parameter 1',
      type: 'text',
      placeholder: 'Enter value',
      defaultValue: 'default_value',
      required: true,
      helpText: 'Helpful description of this parameter'
    },
    {
      key: 'param2',
      label: 'Parameter 2',
      type: 'number',
      defaultValue: 100,
      required: false,
      helpText: 'Optional numeric parameter'
    }
  ]
}

// ============================================
// STEP 2: Add to supabase/functions/execute-workflow/index.ts
// ============================================
case "example_node": {
  // Extract configuration
  const param1 = config.param1 as string;
  const param2 = (config.param2 as number) ?? 100;
  
  // Validate required parameters
  if (!param1 || param1.trim() === '') {
    throw new Error('Example Node: param1 is required');
  }
  
  // Extract and normalize input
  const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const data = inputObj.data || inputObj.input || inputObj;
  
  try {
    // Implement business logic
    const result = await performOperation(data, param1, param2);
    
    // Return standardized output
    return {
      success: true,
      result: result,
      ...(typeof input === 'object' && input !== null ? input : {})
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Example Node failed: ${errorMessage}`);
  }
}

// ============================================
// STEP 3: Add to src/components/workflow/nodeUsageGuides.ts
// ============================================
example_node: {
  overview: 'Clear explanation of what this node does and when to use it. Describe the use case and benefits.',
  inputs: ['data (required)', 'optional_field (optional)'],
  outputs: ['result', 'status'],
  example: `Configuration:
  - param1: "value"
  - param2: 100

Input: { data: "example input" }

Output: {
  success: true,
  result: "processed output",
  data: "example input"
}

Connect: Webhook → Example Node → Slack Message`,
  tips: [
    'Tip 1: How to use this effectively',
    'Tip 2: Common configuration patterns',
    'Tip 3: Performance considerations',
    'Warning: Common pitfall to avoid'
  ]
}
```

## 🎯 PRIORITY NODES TO IMPLEMENT

### Phase 1: Core Logic Nodes
- [ ] Switch node (multi-branch routing)
- [ ] Merge node (combine multiple inputs)
- [ ] Split node (divide data into multiple outputs)
- [ ] Set/Edit Fields (data transformation)
- [ ] Function node (sandboxed code execution)

### Phase 2: Database Nodes
- [ ] PostgreSQL full CRUD
- [ ] MySQL full CRUD
- [ ] MongoDB operations
- [ ] Redis operations
- [ ] Snowflake connector

### Phase 3: Advanced AI Nodes
- [ ] Vector Store (embedding storage/search)
- [ ] Embedding generation
- [ ] AI Agent (autonomous operations)
- [ ] LLM Chain (multi-step reasoning)

### Phase 4: Communication Nodes
- [ ] Email (SMTP/SendGrid)
- [ ] SMS (Twilio)
- [ ] Teams/Webex
- [ ] WhatsApp Business API

### Phase 5: Utility Nodes
- [ ] CSV Export
- [ ] JSON Transform
- [ ] Data Validation
- [ ] Rate Limiter
- [ ] Cache operations

## ✅ QUALITY CHECKLIST

Before considering a node complete, verify:

- [ ] Node definition added to `NODE_TYPES`
- [ ] Execution logic added to `executeNode()`
- [ ] Usage guide added to `NODE_USAGE_GUIDES`
- [ ] Icon imported in `NodeLibrary.tsx` (if new icon)
- [ ] All required config fields validated
- [ ] Error handling implemented with actionable messages
- [ ] Input validation handles edge cases
- [ ] Output format is consistent and documented
- [ ] External API calls have timeout
- [ ] External API calls have retry logic (if applicable)
- [ ] Rate limiting implemented (if applicable)
- [ ] Memory/resource cleanup (if applicable)
- [ ] TypeScript types are strict (no `any`)
- [ ] Code follows existing patterns
- [ ] Tested with various input formats
- [ ] Tested error scenarios

## 🔍 CODE REVIEW CHECKLIST

When reviewing node implementations:

1. **Type Safety**: No `any` types, proper interfaces
2. **Error Handling**: All error paths covered, messages are actionable
3. **Input Validation**: Handles null, undefined, empty, invalid types
4. **Security**: No injection vulnerabilities, path sanitization, input sanitization
5. **Performance**: Efficient algorithms, proper async handling, resource cleanup
6. **Documentation**: Usage guide is clear, examples work, tips are helpful
7. **Consistency**: Follows existing code patterns, naming conventions
8. **Testing**: Edge cases considered, integration scenarios tested

## 🎓 BEST PRACTICES

### Naming Conventions
- Node types: `snake_case` (e.g., `openai_gpt`, `database_read`)
- Config keys: `camelCase` (e.g., `apiKey`, `maxRetries`)
- Labels: `Title Case` (e.g., "OpenAI GPT", "Database Read")

### Error Messages
- Start with node name: "Node Name: specific error message"
- Be actionable: Tell user how to fix the issue
- Include context: What value/parameter caused the error
- Example: "HTTP Request: URL is required. Please provide a valid URL in the configuration."

### Performance
- Use streaming for large data
- Implement pagination for large result sets
- Cache external API responses when appropriate
- Avoid blocking operations
- Use connection pooling for databases

### Security
- Never log sensitive data (API keys, passwords, tokens)
- Sanitize all user inputs
- Use parameterized queries for databases
- Validate file paths to prevent directory traversal
- Implement proper authentication checks

---

## 📖 USAGE EXAMPLE

**User Prompt:**
> "Implement a PostgreSQL node that can execute SELECT queries with parameterized inputs, connection pooling, and proper error handling."

**AI Assistant should:**
1. Read this prompt document
2. Understand the codebase structure
3. Implement all 3 components (definition, execution, usage guide)
4. Follow all quality standards
5. Include connection pooling, parameterized queries, error handling
6. Add to appropriate category in nodeTypes.ts
7. Test edge cases

---

**This prompt is your blueprint. Follow it religiously for every node implementation. Quality over speed. Enterprise-grade or nothing.**

