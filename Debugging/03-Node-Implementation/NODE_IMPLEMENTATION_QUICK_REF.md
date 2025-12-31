# ⚡ Node Implementation Quick Reference

## 🎯 The 3-Step Process

Every node requires **3 components** to be implemented:

### 1️⃣ Node Definition
**File**: `src/components/workflow/nodeTypes.ts`  
**Action**: Add to `NODE_TYPES` array

```typescript
{
  type: 'node_name',              // snake_case, unique
  label: 'Display Name',          // Title Case
  category: 'category',           // triggers|ai|logic|data|output|http_api
  icon: 'IconName',               // Lucide icon (must be imported)
  description: 'One-line description',
  defaultConfig: { key: 'value' },
  configFields: [
    {
      key: 'param',
      label: 'Parameter',
      type: 'text|textarea|number|boolean|select|time',
      required: true,
      helpText: 'Help text'
    }
  ]
}
```

### 2️⃣ Execution Logic
**File**: `supabase/functions/execute-workflow/index.ts`  
**Action**: Add case to `executeNode()` function

```typescript
case "node_name": {
  // 1. Extract config
  const param = config.param as string;
  
  // 2. Validate
  if (!param) throw new Error('Node Name: param is required');
  
  // 3. Extract input
  const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const data = inputObj.data || inputObj.input || inputObj;
  
  // 4. Execute with error handling
  try {
    const result = await performOperation(data, param);
    return {
      success: true,
      result,
      ...(typeof input === 'object' && input !== null ? input : {})
    };
  } catch (error) {
    throw new Error(`Node Name failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 3️⃣ Usage Guide
**File**: `src/components/workflow/nodeUsageGuides.ts`  
**Action**: Add to `NODE_USAGE_GUIDES` object

```typescript
node_name: {
  overview: 'What it does and when to use it',
  inputs: ['field1 (required)', 'field2 (optional)'],
  outputs: ['result', 'status'],
  example: `Config: { param: "value" }
Input: { data: "example" }
Output: { result: "processed" }`,
  tips: ['Tip 1', 'Tip 2', 'Common pitfall']
}
```

## 🔧 Category-Specific Patterns

### AI Nodes
```typescript
✅ Use LLMAdapter for unified interface
✅ Handle conversation history
✅ Token counting & cost estimation
✅ Rate limiting per API key
✅ Retry with exponential backoff
```

### Database Nodes
```typescript
✅ Parameterized queries (prevent SQL injection)
✅ Connection pooling
✅ Query timeout (30s default)
✅ Transaction support
✅ Pagination for large results
```

### HTTP Nodes
```typescript
✅ Request timeout (10s default)
✅ Retry logic (3 attempts)
✅ Rate limiting
✅ Proper error handling (4xx vs 5xx)
✅ Header sanitization
```

### File Nodes
```typescript
✅ Stream-based operations
✅ File size limits
✅ Path sanitization (prevent ../)
✅ MIME type detection
✅ Permission checks
```

## ✅ Quality Checklist

- [ ] Zero `any` types - use proper interfaces
- [ ] All errors have actionable messages
- [ ] Input validation handles edge cases
- [ ] External APIs have timeout + retry
- [ ] Rate limiting for external APIs
- [ ] Memory/resource cleanup
- [ ] Consistent output format
- [ ] Usage guide is complete
- [ ] Icon imported in NodeLibrary.tsx

## 🚨 Common Mistakes to Avoid

❌ Using `any` type  
✅ Use proper TypeScript interfaces

❌ Generic error messages  
✅ Specific, actionable error messages

❌ No input validation  
✅ Validate and sanitize all inputs

❌ Hardcoded timeouts  
✅ Configurable timeouts with sensible defaults

❌ No retry logic for APIs  
✅ Exponential backoff retry (3 attempts)

❌ Loading entire file in memory  
✅ Use streaming for large files

❌ SQL string concatenation  
✅ Parameterized queries

❌ No rate limiting  
✅ Implement rate limiting for external APIs

## 📋 Error Message Format

```typescript
// ❌ Bad
throw new Error('Error occurred');

// ✅ Good
throw new Error('Node Name: Parameter "apiKey" is required. Please provide a valid API key in the configuration.');
```

## 🎨 Naming Conventions

- **Node types**: `snake_case` → `openai_gpt`, `database_read`
- **Config keys**: `camelCase` → `apiKey`, `maxRetries`
- **Labels**: `Title Case` → "OpenAI GPT", "Database Read"
- **Icons**: `PascalCase` → `Brain`, `Database`

## 🔗 File Locations

| Component | File Path |
|-----------|-----------|
| Node Definition | `src/components/workflow/nodeTypes.ts` |
| Execution Logic | `supabase/functions/execute-workflow/index.ts` |
| Usage Guide | `src/components/workflow/nodeUsageGuides.ts` |
| Icons | `src/components/workflow/NodeLibrary.tsx` |

## 🚀 Quick Start Template

Copy-paste this template and fill in the blanks:

```typescript
// ============================================
// 1. src/components/workflow/nodeTypes.ts
// ============================================
{
  type: 'YOUR_NODE_NAME',
  label: 'Your Node Label',
  category: 'data', // or triggers|ai|logic|output|http_api
  icon: 'IconName', // Check NodeLibrary.tsx for available icons
  description: 'Brief description',
  defaultConfig: {},
  configFields: [
    { key: 'param', label: 'Parameter', type: 'text', required: true }
  ]
}

// ============================================
// 2. supabase/functions/execute-workflow/index.ts
// ============================================
case "YOUR_NODE_NAME": {
  const param = config.param as string;
  if (!param) throw new Error('Your Node Label: param is required');
  
  const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const data = inputObj.data || inputObj.input || inputObj;
  
  try {
    // YOUR LOGIC HERE
    const result = await yourOperation(data, param);
    
    return {
      success: true,
      result,
      ...(typeof input === 'object' && input !== null ? input : {})
    };
  } catch (error) {
    throw new Error(`Your Node Label failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// 3. src/components/workflow/nodeUsageGuides.ts
// ============================================
YOUR_NODE_NAME: {
  overview: 'Clear explanation',
  inputs: ['input1', 'input2'],
  outputs: ['output1'],
  example: `Example workflow`,
  tips: ['Tip 1', 'Tip 2']
}
```

---

**Need details? See `NODE_IMPLEMENTATION_PROMPT.md` for the full guide.**

