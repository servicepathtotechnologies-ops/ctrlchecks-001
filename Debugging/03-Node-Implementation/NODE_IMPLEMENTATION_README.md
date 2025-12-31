# 📖 Node Implementation Documentation

This folder contains comprehensive documentation for implementing enterprise-grade nodes in Flow Genius AI.

## 📚 Documentation Files

### 1. `NODE_IMPLEMENTATION_PROMPT.md` ⭐ **START HERE**
**The Master Guide** - Complete reference with:
- Full architecture overview
- All quality standards and requirements
- Category-specific implementation patterns
- Error handling guidelines
- Security best practices
- Complete code templates
- Quality checklists

**Use this when:** You need comprehensive guidance or are implementing a complex node.

---

### 2. `NODE_IMPLEMENTATION_QUICK_REF.md` ⚡
**Quick Reference Card** - Condensed guide with:
- 3-step implementation process
- Category-specific patterns (AI, Database, HTTP, File)
- Common mistakes to avoid
- Quick-start template
- File locations reference

**Use this when:** You know what you're doing and just need a quick reminder.

---

### 3. `NODE_IMPLEMENTATION_EXAMPLE.md` 📚
**Complete Working Example** - Shows a full implementation:
- Step-by-step implementation of CSV Parser node
- All 3 components (definition, execution, usage guide)
- Testing checklist
- Quality standards compliance demonstration

**Use this when:** You want to see a real-world example before starting.

---

## 🚀 How to Use These Documents

### For AI-Assisted Development (Cursor/Claude/etc.)

**Option 1: Use the Master Prompt**
```
Copy the entire content of NODE_IMPLEMENTATION_PROMPT.md and provide it as context when asking AI to implement a node.
```

**Option 2: Use the Quick Reference**
```
For simpler nodes, use NODE_IMPLEMENTATION_QUICK_REF.md for faster iterations.
```

**Option 3: Reference the Example**
```
Show AI the NODE_IMPLEMENTATION_EXAMPLE.md and ask it to implement a similar node following the same pattern.
```

### Example AI Prompt

```
I need to implement a new [NODE_TYPE] node for [PURPOSE].

Please:
1. Read NODE_IMPLEMENTATION_PROMPT.md for requirements
2. Review NODE_IMPLEMENTATION_EXAMPLE.md for the pattern
3. Implement all 3 components following the quality standards
4. Use the quick reference checklist to verify completeness

Node requirements:
- Category: [CATEGORY]
- Purpose: [WHAT IT DOES]
- Configuration: [CONFIG FIELDS NEEDED]
- Input: [INPUT FORMAT]
- Output: [OUTPUT FORMAT]
```

---

## 📋 Quick Start

1. **Choose your approach:**
   - New to node implementation? → Read `NODE_IMPLEMENTATION_PROMPT.md`
   - Familiar with the process? → Use `NODE_IMPLEMENTATION_QUICK_REF.md`
   - Want to see an example? → Check `NODE_IMPLEMENTATION_EXAMPLE.md`

2. **Plan your node:**
   - Determine category
   - Define configuration parameters
   - Define input/output schema
   - Identify dependencies

3. **Implement the 3 components:**
   - Node Definition (`nodeTypes.ts`)
   - Execution Logic (`execute-workflow/index.ts`)
   - Usage Guide (`nodeUsageGuides.ts`)

4. **Test thoroughly:**
   - Happy path
   - Error cases
   - Edge cases
   - Integration scenarios

5. **Verify quality:**
   - Use the checklist in the master prompt
   - Ensure no `any` types
   - All errors are actionable
   - Documentation is complete

---

## 🎯 Key Principles

1. **Zero Compromise Quality** - Every node must work flawlessly
2. **Superior DX** - Better debugging and error messages than n8n
3. **Performance First** - Optimized for speed and low resource usage
4. **Enterprise Ready** - Security, scalability, observability built-in
5. **Type Safety** - Strict TypeScript, no `any` types
6. **Error Handling** - Actionable error messages with context

---

## 🔗 Related Files in Codebase

- `src/components/workflow/nodeTypes.ts` - Node definitions
- `supabase/functions/execute-workflow/index.ts` - Execution engine
- `src/components/workflow/nodeUsageGuides.ts` - User documentation
- `src/components/workflow/NodeLibrary.tsx` - UI component (icon imports)

---

## 📝 Node Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `triggers` | Start workflow execution | manual_trigger, webhook, schedule |
| `ai` | AI/ML processing | openai_gpt, anthropic_claude, text_summarizer |
| `logic` | Control flow | if_else, switch, loop, wait |
| `data` | Data transformation | javascript, json_parser, csv_processor |
| `output` | Send data out | email_resend, slack_message, database_write |
| `http_api` | HTTP operations | http_request, graphql, respond_to_webhook |

---

## ✅ Quality Checklist (Quick Version)

- [ ] Zero `any` types
- [ ] Actionable error messages
- [ ] Input validation
- [ ] Timeout + retry for external APIs
- [ ] Rate limiting for external APIs
- [ ] Resource cleanup
- [ ] Consistent output format
- [ ] Complete usage guide
- [ ] Icon imported
- [ ] Tested thoroughly

---

**Remember: Quality over speed. Enterprise-grade or nothing. 🚀**

