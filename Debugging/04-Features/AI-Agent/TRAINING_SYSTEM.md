# Autonomous Agent Training System

## Overview

The Autonomous Workflow Agent has been trained using 25 production-ready workflow examples extracted from the SAMPLE-DATA.pdf. These examples serve as reference patterns to help the agent understand:

1. How to map user prompts to workflow structures
2. Which nodes to select for common patterns
3. How data flows between nodes
4. How to handle conditional logic, scheduling, and integrations

## Training Data Structure

### Location
- **Training Examples File**: `training-examples.ts`
- **Integration Point**: `generate-workflow/index.ts`

### Training Examples Format

Each training example contains:
- **Prompt**: The original user request
- **Title**: Expected workflow title
- **Description**: What the workflow does
- **Nodes Used**: List of nodes required
- **Patterns**: Key patterns to learn from
- **Data Flow**: How data moves between nodes

## 25 Training Examples

1. **Webhook → DB → Slack Notification** - Data intake and persistence
2. **Scheduled API Polling → Google Sheets** - Daily data sync
3. **Form Submission → Email Confirmation** - Form automation
4. **Chatbot Using Gemini + Memory** - Conversational AI
5. **Error Monitoring → PagerDuty Alert** - Error alerting
6. **GitHub Issue → Slack Notification** - Issue tracking
7. **API → AI Summarization → Email** - Content summarization
8. **Webhook → Conditional Routing** - Conditional logic
9. **File Upload → Cloud Storage** - File migration
10. **Google Drive → PDF Processing** - Document processing
11. **Social Media Auto Poster** - Scheduled posting
12. **RAG System with Vector Store** - Knowledge assistant
13. **Payment Confirmation Workflow** - Payment automation
14. **CRM Lead Capture** - Lead management
15. **Database Backup Automation** - Scheduled backups
16. **Authentication Token Generator** - Auth workflows
17. **Analytics Data Pipeline** - ETL processes
18. **Image Processing Automation** - Image manipulation
19. **Task Management Sync** - Productivity integration
20. **YouTube Upload Notification** - Content alerts
21. **Log Monitoring with Datadog** - Observability
22. **Ecommerce Order Processing** - Order automation
23. **Interval-Based Cleanup Job** - Data maintenance
24. **Multi-Step Approval Workflow** - Human-in-the-loop
25. **Full AI Agent Workflow Generator** - Meta-workflows

## Integration Points

### 1. System Prompt Integration

The training examples are integrated into the main system prompt (`nodeDescriptions`) that is passed to the agent. This ensures all 25 examples are always available as reference.

**Location**: `generate-workflow/index.ts` line ~1582

```typescript
${getTrainingExamplesSection()}
```

### 2. Dynamic Relevant Examples

For each user prompt, the system automatically selects the 3 most relevant training examples based on:
- Keyword matching
- Node type similarity
- Pattern similarity

**Location**: `generate-workflow/index.ts` lines ~1691 and ~1833

```typescript
const relevantExamples = getRelevantExamples(prompt, 3);
const examplesContext = relevantExamples.length > 0 
  ? `\n\nRELEVANT TRAINING EXAMPLES...`
  : '';
```

### 3. Autonomous Agent Integration

The training examples are passed to the `AutonomousWorkflowAgent` as part of the `nodeKnowledge` parameter, making them available during all agent phases:
- Phase 1: Understanding & Planning
- Phase 2: Planning
- Phase 3: Workflow Construction
- Phase 4: Validation
- Phase 5: Self-Healing
- Phase 6: Goal Verification

## Training Guidelines Embedded

The training system includes guidelines for:

### Trigger Selection
- "webhook receives" → Use webhook trigger
- "form submission" → Use form trigger
- "scheduled" / "every day" → Use schedule trigger
- "chat" / "user questions" → Use chat_trigger
- "workflow errors" → Use error_trigger

### Node Combinations
- Webhook → Database → Slack
- Schedule → HTTP Request → Google Sheets
- Form → Email
- Chat → Memory → AI → Memory
- Error Trigger → PagerDuty

### Data Flow Patterns
- Webhook data: `input.body.fieldName`
- Form data: `input.data.fieldName`
- HTTP Request data: `input.fieldName` (NOT input.body)
- Chat data: `input.message`, `input.session_id`
- Google Sheets: `input.data` (array of arrays)
- Google Doc: `input.content` or `input.text`

### Conditional Logic
- Use `if_else` for binary conditions
- Use `switch` for multiple cases
- Always provide both true/false paths

## How It Works

1. **User submits prompt** → System receives workflow generation request

2. **Training examples loaded** → All 25 examples added to system prompt

3. **Relevant examples selected** → Top 3 most similar examples identified

4. **Agent receives context** → Full training examples + relevant examples passed to agent

5. **Agent learns patterns** → Agent uses examples to:
   - Understand similar workflows
   - Select appropriate nodes
   - Structure data flow correctly
   - Apply conditional logic

6. **Workflow generated** → Agent creates workflow following learned patterns

## Benefits

1. **Pattern Recognition**: Agent recognizes common workflow patterns
2. **Node Selection**: Better understanding of which nodes to use
3. **Data Flow**: Correct data mapping between nodes
4. **Error Prevention**: Learning from proven patterns reduces errors
5. **Consistency**: Similar prompts generate similar, reliable workflows

## Example Usage

When a user prompts:
> "Create a workflow that receives user data from a webhook, stores it in a database, and sends a confirmation message to Slack"

The agent will:
1. Match to Training Example #1 (Webhook → DB → Slack)
2. Use the pattern: Webhook → PostgreSQL → Slack
3. Apply correct data flow: `input.body.fieldName` → database → Slack notification
4. Generate a workflow following the learned pattern

## Maintenance

To add new training examples:

1. Add to `TRAINING_EXAMPLES` array in `training-examples.ts`
2. Follow the `TrainingExample` interface structure
3. Include patterns and data flow information
4. The system will automatically include it in training

## Testing

The training system is automatically active. To verify:

1. Check that `getTrainingExamplesSection()` returns all 25 examples
2. Verify `getRelevantExamples()` returns relevant matches for test prompts
3. Confirm examples appear in agent's system prompt during generation

## Future Enhancements

Potential improvements:
- [ ] Add more training examples from real user workflows
- [ ] Implement example scoring/ranking system
- [ ] Add example validation to ensure quality
- [ ] Create example categories for better organization
- [ ] Track which examples are most effective
