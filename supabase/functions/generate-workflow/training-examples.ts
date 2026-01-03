/**
 * Training Examples for Autonomous Workflow Agent
 * 
 * These 25 sample workflows serve as training data to help the agent
 * understand patterns, node selection, and workflow structure.
 * 
 * Each example shows:
 * - User Prompt (what the user asked for)
 * - Expected Output (title, description, nodes used)
 * - Key Patterns (what the agent should learn)
 */

export interface TrainingExample {
  prompt: string;
  title: string;
  description: string;
  nodesUsed: string[];
  patterns: string[];
  dataFlow?: string;
}

export const TRAINING_EXAMPLES: TrainingExample[] = [
  {
    prompt: "Create a workflow that receives user data from a webhook, stores it in a database, and sends a confirmation message and stored data to Slack.",
    title: "Webhook Data Intake & Notification",
    description: "Captures webhook data, persists it, and notifies the team.",
    nodesUsed: ["Webhook", "PostgreSQL", "Slack"],
    patterns: [
      "Webhook trigger receives external data",
      "Database write operation for persistence",
      "Slack notification as output",
      "Data flows: webhook → database → slack"
    ],
    dataFlow: "Webhook receives JSON → PostgreSQL stores data → Slack sends notification with stored data"
  },
  {
    prompt: "Create a scheduled workflow that fetches data from an HTTP API every day and appends it to Google Sheets.",
    title: "Scheduled API to Sheets",
    description: "Daily API data sync into Sheets.",
    nodesUsed: ["Schedule Trigger", "HTTP Request", "Google Sheets"],
    patterns: [
      "Schedule trigger for recurring execution",
      "HTTP Request fetches external API data",
      "Google Sheets append operation",
      "Data transformation may be needed between HTTP and Sheets"
    ],
    dataFlow: "Schedule triggers → HTTP Request fetches API → JavaScript transforms → Google Sheets appends"
  },
  {
    prompt: "Create a workflow that takes user data from form submission and sends a confirmation email and user data to the user.",
    title: "Form to Email Automation",
    description: "Sends automated email after form submit.",
    nodesUsed: ["Form", "Google Gmail"],
    patterns: [
      "Form trigger collects user input",
      "Google Gmail node sends confirmation",
      "Form data accessed via input.data",
      "Template variables for email content"
    ],
    dataFlow: "Form receives data → Google Gmail node sends confirmation with form data"
  },
  {
    prompt: "Create a chat workflow using Google Gemini that remembers previous user messages and responds intelligently.",
    title: "AI Chatbot with Memory",
    description: "Stateful chatbot with conversation memory.",
    nodesUsed: ["Chat Trigger", "Google Gemini", "Memory", "AI Agent"],
    patterns: [
      "Chat trigger for user messages",
      "Memory node stores/retrieves conversation history",
      "AI node processes with context",
      "Session management via session_id"
    ],
    dataFlow: "Chat trigger → Memory retrieve → JavaScript builds context → Gemini generates response → Memory store"
  },
  {
    prompt: "Create a workflow that triggers on workflow errors and sends an alert to PagerDuty.",
    title: "Error Alert System",
    description: "Monitors failures and escalates alerts.",
    nodesUsed: ["Error Trigger", "PagerDuty"],
    patterns: [
      "Error trigger catches workflow failures",
      "PagerDuty for incident management",
      "Error data passed to alerting system"
    ],
    dataFlow: "Error Trigger receives error → PagerDuty creates incident"
  },
  {
    prompt: "Create a workflow that sends a Slack message whenever a new GitHub issue is created.",
    title: "GitHub Issue Alerts",
    description: "Keeps team informed about new issues.",
    nodesUsed: ["GitHub", "Slack"],
    patterns: [
      "GitHub webhook or polling for new issues",
      "Slack notification for team alerts",
      "Issue data formatted for Slack"
    ],
    dataFlow: "GitHub webhook/poll → Format issue data → Slack notification"
  },
  {
    prompt: "Fetch data from an API, summarize it using an AI model, and email the summary.",
    title: "AI Data Summarizer",
    description: "AI-powered content summarization.",
    nodesUsed: ["HTTP Request", "OpenAI / Google Gemini", "Google Gmail"],
    patterns: [
      "HTTP Request fetches data",
      "AI node summarizes content",
      "Google Gmail sends formatted summary",
      "Data transformation between nodes"
    ],
    dataFlow: "HTTP Request → AI Summarization → Google Gmail send"
  },
  {
    prompt: "Create a workflow that routes form data differently based on a condition if gender male send data to slack else females send to email. input fields - Name, Age, Gender, email, Mobile",
    title: "Conditional Webhook Router",
    description: "Uses logic to route data flows.",
    nodesUsed: ["Form", "Switch", "Slack", "Email"],
    patterns: [
      "Form trigger with multiple fields",
      "Switch/If-Else for conditional routing",
      "Multiple output paths based on condition",
      "Form data validation"
    ],
    dataFlow: "Form → JavaScript validation → Switch (gender check) → Slack (male) OR Email (female)"
  },
  {
    prompt: "Create a workflow that uploads files from FTP to AWS S3.",
    title: "File Migration Workflow",
    description: "Moves files between storage systems.",
    nodesUsed: ["FTP", "AWS S3"],
    patterns: [
      "FTP node reads files",
      "S3 node writes files",
      "File handling and transfer"
    ],
    dataFlow: "FTP read → S3 write"
  },
  {
    prompt: "Create a workflow that reads a PDF from Google Drive and extracts text.",
    title: "PDF Text Extraction",
    description: "Reads and processes PDFs.",
    nodesUsed: ["Google Drive", "PDF", "Set"],
    patterns: [
      "Google Drive reads file",
      "PDF node extracts text",
      "Set node formats output"
    ],
    dataFlow: "Google Drive → PDF extract → Set format"
  },
  {
    prompt: "Create a workflow that posts scheduled content to Twitter and LinkedIn.",
    title: "Social Media Scheduler",
    description: "Auto-posts content to social platforms.",
    nodesUsed: ["Schedule Trigger", "Twitter/X", "LinkedIn"],
    patterns: [
      "Schedule trigger for timed posts",
      "Multiple social media outputs",
      "Content formatting for each platform"
    ],
    dataFlow: "Schedule → Format content → Twitter post → LinkedIn post"
  },
  {
    prompt: "Create a RAG workflow that stores documents in a vector database and answers user questions.",
    title: "RAG Knowledge Assistant",
    description: "Retrieval-augmented generation system.",
    nodesUsed: ["Chat Trigger", "Embeddings", "Vector Store", "AI Agent"],
    patterns: [
      "Chat trigger for questions",
      "Embeddings for document processing",
      "Vector Store for semantic search",
      "AI Agent for RAG responses"
    ],
    dataFlow: "Chat → Vector Store search → Embeddings → AI Agent generates answer"
  },
  {
    prompt: "Create a workflow that confirms Stripe payments and sends an email receipt.",
    title: "Payment Confirmation",
    description: "Payment processing automation.",
    nodesUsed: ["Stripe", "Google Gmail"],
    patterns: [
      "Stripe webhook for payment events",
      "Google Gmail for receipt delivery",
      "Payment data formatting"
    ],
    dataFlow: "Stripe webhook → Format receipt → Google Gmail send"
  },
  {
    prompt: "Create a workflow that captures leads from a form and stores them in HubSpot CRM.",
    title: "Lead Management System",
    description: "Automates lead intake.",
    nodesUsed: ["Form", "HubSpot"],
    patterns: [
      "Form trigger for lead capture",
      "CRM integration for lead storage",
      "Data mapping between form and CRM"
    ],
    dataFlow: "Form → Format lead data → HubSpot create contact"
  },
  {
    prompt: "Create a scheduled workflow that backs up a database to Google Drive.",
    title: "DB Backup Automation",
    description: "Periodic database backup.",
    nodesUsed: ["Schedule Trigger", "MySQL", "Google Drive"],
    patterns: [
      "Schedule trigger for periodic execution",
      "Database read/export",
      "Google Drive file upload"
    ],
    dataFlow: "Schedule → MySQL export → Google Drive upload"
  },
  {
    prompt: "Create a workflow that generates a JWT token after OAuth authentication.",
    title: "Auth Token Workflow",
    description: "Secure token handling.",
    nodesUsed: ["OAuth2", "JWT"],
    patterns: [
      "OAuth2 for authentication",
      "JWT node for token generation",
      "Token management"
    ],
    dataFlow: "OAuth2 authenticate → JWT generate token"
  },
  {
    prompt: "Create a workflow that pulls data from Google Analytics and sends it to BigQuery.",
    title: "Analytics ETL",
    description: "Data pipeline for analytics.",
    nodesUsed: ["Google Analytics", "Google BigQuery"],
    patterns: [
      "Google Analytics data extraction",
      "BigQuery for data warehousing",
      "ETL transformation"
    ],
    dataFlow: "Google Analytics → Transform data → BigQuery insert"
  },
  {
    prompt: "Create a workflow that resizes images uploaded to Dropbox.",
    title: "Image Processing Pipeline",
    description: "Image automation flow.",
    nodesUsed: ["Dropbox", "Image Manipulation"],
    patterns: [
      "Dropbox file trigger",
      "Image manipulation node",
      "File processing and storage"
    ],
    dataFlow: "Dropbox file → Image resize → Save back to Dropbox"
  },
  {
    prompt: "Create a workflow that syncs tasks from Trigger-HTTP to ClickUp.",
    title: "Task Sync Automation",
    description: "Productivity tool integration.",
    nodesUsed: ["HTTP Request", "ClickUp"],
    patterns: [
      "HTTP Request for external data",
      "ClickUp API integration",
      "Task data synchronization"
    ],
    dataFlow: "HTTP Request → Format task data → ClickUp create task"
  },
  {
    prompt: "Create a workflow that sends a Telegram message when a new YouTube video is uploaded.",
    title: "YouTube Alerts",
    description: "Content publishing notifications.",
    nodesUsed: ["YouTube", "Telegram"],
    patterns: [
      "YouTube webhook/polling",
      "Telegram notification",
      "Video metadata formatting"
    ],
    dataFlow: "YouTube webhook → Format video info → Telegram send"
  },
  {
    prompt: "Create a workflow that monitors logs and sends alerts when errors exceed a threshold.",
    title: "Log Monitoring System",
    description: "Observability automation.",
    nodesUsed: ["Datadog", "If", "Slack"],
    patterns: [
      "Datadog for log monitoring",
      "If-Else for threshold checking",
      "Slack for alerting",
      "Conditional logic based on metrics"
    ],
    dataFlow: "Datadog query logs → If (error count > threshold) → Slack alert"
  },
  {
    prompt: "Create a workflow that processes Shopify orders and updates inventory.",
    title: "Ecommerce Order Handler",
    description: "Automates order flow.",
    nodesUsed: ["Shopify", "Set"],
    patterns: [
      "Shopify webhook for orders",
      "Set node for data transformation",
      "Inventory management"
    ],
    dataFlow: "Shopify order webhook → Process order → Update inventory"
  },
  {
    prompt: "Create an interval workflow that deletes old records from a database.",
    title: "Scheduled Data Cleanup",
    description: "Maintains DB hygiene.",
    nodesUsed: ["Interval", "PostgreSQL", "Delete Query"],
    patterns: [
      "Interval trigger for periodic execution",
      "Database query for old records",
      "Delete operation"
    ],
    dataFlow: "Interval → PostgreSQL query old records → Delete"
  },
  {
    prompt: "Create a workflow that waits for manager approval before proceeding.",
    title: "Approval Workflow",
    description: "Human-in-the-loop automation.",
    nodesUsed: ["Webhook", "Wait", "If"],
    patterns: [
      "Webhook for approval input",
      "Wait node for human interaction",
      "Conditional logic based on approval"
    ],
    dataFlow: "Webhook request → Wait for approval → If approved → Continue"
  },
  {
    prompt: "Create a workflow where an AI Agent generates another workflow based on user input.",
    title: "Meta Workflow Generator",
    description: "Tests AI Agent autonomy.",
    nodesUsed: ["Chat Trigger", "AI Agent", "Google Gemini", "Set"],
    patterns: [
      "Chat trigger for user input",
      "AI Agent for autonomous generation",
      "Meta-workflow creation",
      "Complex AI reasoning"
    ],
    dataFlow: "Chat → AI Agent reasons → Gemini generates workflow → Set formats output"
  }
];

/**
 * Get training examples formatted for system prompt
 */
export function getTrainingExamplesSection(): string {
  const examples = TRAINING_EXAMPLES.map((example, index) => {
    return `
════════════════════════════════════
TRAINING EXAMPLE ${index + 1}
════════════════════════════════════

USER PROMPT:
"${example.prompt}"

EXPECTED OUTPUT:
- Title: ${example.title}
- Description: ${example.description}
- Nodes Used: ${example.nodesUsed.join(', ')}
${example.dataFlow ? `- Data Flow: ${example.dataFlow}` : ''}

KEY PATTERNS TO LEARN:
${example.patterns.map(p => `- ${p}`).join('\n')}

════════════════════════════════════`;
  }).join('\n');

  return `
════════════════════════════════════
TRAINING EXAMPLES (25 PRODUCTION WORKFLOWS)
════════════════════════════════════

These are REAL, PRODUCTION-READY workflow examples. Study them carefully
to understand:
1. How to map user prompts to workflow structures
2. Which nodes to select for common patterns
3. How data flows between nodes
4. How to handle conditional logic, scheduling, and integrations

${examples}

════════════════════════════════════
TRAINING GUIDELINES
════════════════════════════════════

When generating workflows, follow these patterns from the examples:

1. TRIGGER SELECTION:
   - "webhook receives" → Use webhook trigger
   - "form submission" → Use form trigger
   - "scheduled" / "every day" → Use schedule trigger
   - "chat" / "user questions" → Use chat_trigger
   - "workflow errors" → Use error_trigger
   - "interval" / "periodic" → Use interval trigger

2. NODE COMBINATIONS:
   - Webhook → Database → Slack (data persistence + notification)
   - Schedule → HTTP Request → Google Sheets (scheduled data sync)
   - Form → Email (form submission confirmation)
   - Chat → Memory → AI → Memory (conversational AI with memory)
   - Error Trigger → PagerDuty (error alerting)
   - GitHub → Slack (issue notifications)
   - HTTP Request → AI → Email (data summarization)
   - Form → Switch/If → Multiple outputs (conditional routing)
   - Schedule → Social Media nodes (scheduled posting)
   - Chat → Embeddings → Vector Store → AI (RAG systems)

3. DATA FLOW PATTERNS:
   - Webhook data: input.body.fieldName
   - Form data: input.data.fieldName
   - HTTP Request data: input.fieldName (NOT input.body)
   - Chat data: input.message, input.session_id
   - Database data: input.rows or input.data
   - Google Sheets: input.data (array of arrays)
   - Google Doc: input.content or input.text

4. CONDITIONAL LOGIC:
   - Use if_else for binary conditions
   - Use switch for multiple cases
   - Always provide both true/false paths for if_else
   - Route data based on conditions (see Example 8)

5. SCHEDULING PATTERNS:
   - Schedule trigger for daily/hourly execution
   - Interval trigger for fixed intervals
   - Combine with data fetching and storage

6. INTEGRATION PATTERNS:
   - External API → Internal storage (Example 2)
   - External service → Notification (Example 6)
   - Form → CRM (Example 14)
   - Payment → Email (Example 13)
   - Database → Cloud Storage (Example 15)

════════════════════════════════════`;
}

/**
 * Get relevant training examples based on user prompt
 * Enhanced matching algorithm for better accuracy
 */
export function getRelevantExamples(userPrompt: string, maxExamples: number = 5): TrainingExample[] {
  const promptLower = userPrompt.toLowerCase();

  // Extract key concepts from user prompt
  const keyConcepts = extractKeyConcepts(userPrompt);

  // Score examples based on multiple factors
  const scored = TRAINING_EXAMPLES.map(example => {
    let score = 0;
    const exampleText = `${example.prompt} ${example.title} ${example.description} ${example.nodesUsed.join(' ')} ${example.patterns.join(' ')}`.toLowerCase();
    const exampleLower = example.prompt.toLowerCase();

    // 1. Exact phrase matches (highest priority)
    const exactPhrases = [
      'webhook', 'form', 'schedule', 'chat', 'error', 'github', 'slack',
      'email', 'gmail', 'database', 'postgresql', 'mysql', 'sheets',
      'google sheets', 'google doc', 'pdf', 'stripe', 'payment',
      'hubspot', 'crm', 'backup', 'oauth', 'jwt', 'analytics',
      'image', 'dropbox', 'clickup', 'youtube', 'telegram', 'datadog',
      'shopify', 'interval', 'approval', 'ai agent', 'rag', 'vector'
    ];

    exactPhrases.forEach(phrase => {
      if (promptLower.includes(phrase) && exampleLower.includes(phrase)) {
        score += 5; // High score for exact matches
      }
    });

    // 2. Node type matches (very important)
    example.nodesUsed.forEach(node => {
      const nodeLower = node.toLowerCase();
      // Direct node mention
      if (promptLower.includes(nodeLower)) {
        score += 4;
      }
      // Partial match (e.g., "slack" matches "slack_webhook")
      if (nodeLower.includes('slack') && promptLower.includes('slack')) {
        score += 3;
      }
      if (nodeLower.includes('email') && (promptLower.includes('email') || promptLower.includes('gmail'))) {
        score += 3;
      }
      if (nodeLower.includes('database') && (promptLower.includes('database') || promptLower.includes('db') || promptLower.includes('postgres') || promptLower.includes('mysql'))) {
        score += 3;
      }
    });

    // 3. Pattern matching (workflow structure similarity)
    example.patterns.forEach(pattern => {
      const patternLower = pattern.toLowerCase();
      // Check if pattern concepts match
      if (patternLower.includes('trigger') && (promptLower.includes('trigger') || promptLower.includes('when') || promptLower.includes('on'))) {
        score += 2;
      }
      if (patternLower.includes('notification') && (promptLower.includes('notify') || promptLower.includes('alert') || promptLower.includes('send'))) {
        score += 2;
      }
      if (patternLower.includes('store') && (promptLower.includes('store') || promptLower.includes('save') || promptLower.includes('persist'))) {
        score += 2;
      }
      if (patternLower.includes('sync') && promptLower.includes('sync')) {
        score += 2;
      }
      if (patternLower.includes('monitor') && promptLower.includes('monitor')) {
        score += 2;
      }
    });

    // 4. Key concept matches
    keyConcepts.forEach(concept => {
      if (exampleText.includes(concept)) {
        score += 2;
      }
    });

    // 5. Action verb matches
    const actionVerbs = ['receive', 'send', 'store', 'fetch', 'create', 'update', 'delete', 'process', 'transform', 'route'];
    actionVerbs.forEach(verb => {
      if (promptLower.includes(verb) && exampleLower.includes(verb)) {
        score += 1;
      }
    });

    // 6. Data flow similarity
    if (example.dataFlow) {
      const flowLower = example.dataFlow.toLowerCase();
      // Check if similar data flow patterns exist
      if (flowLower.includes('→') && promptLower.includes('then')) {
        score += 1;
      }
      if (flowLower.includes('webhook') && promptLower.includes('webhook')) {
        score += 1;
      }
      if (flowLower.includes('database') && (promptLower.includes('database') || promptLower.includes('store'))) {
        score += 1;
      }
    }

    return { example, score };
  });

  // Sort by score and return top matches
  const sorted = scored.sort((a, b) => b.score - a.score);

  // Filter out examples with score 0 (no relevance)
  const relevant = sorted
    .filter(item => item.score > 0)
    .slice(0, maxExamples)
    .map(item => item.example);

  // If no relevant examples found, return top examples by default
  if (relevant.length === 0) {
    return sorted.slice(0, maxExamples).map(item => item.example);
  }

  return relevant;
}

/**
 * Extract key concepts from user prompt for better matching
 */
function extractKeyConcepts(prompt: string): string[] {
  const promptLower = prompt.toLowerCase();
  const concepts: string[] = [];

  // Common workflow concepts
  const conceptPatterns = [
    { pattern: /webhook/i, concept: 'webhook' },
    { pattern: /form|form data|user data|collect data/i, concept: 'form' },
    { pattern: /schedule|daily|every day|periodic|interval/i, concept: 'schedule' },
    { pattern: /chat|chatbot|conversation|ai assistant/i, concept: 'chat' },
    { pattern: /error|failure|exception/i, concept: 'error' },
    { pattern: /notification|alert|notify|send message/i, concept: 'notification' },
    { pattern: /store|save|persist|database|db/i, concept: 'storage' },
    { pattern: /email|gmail|send email/i, concept: 'email' },
    { pattern: /slack|team message/i, concept: 'slack' },
    { pattern: /api|http request|fetch data/i, concept: 'api' },
    { pattern: /google sheets|sheets|spreadsheet/i, concept: 'sheets' },
    { pattern: /google doc|document|read doc/i, concept: 'document' },
    { pattern: /conditional|if|else|switch|route/i, concept: 'conditional' },
    { pattern: /process|transform|format/i, concept: 'processing' },
    { pattern: /monitor|watch|observe/i, concept: 'monitoring' },
  ];

  conceptPatterns.forEach(({ pattern, concept }) => {
    if (pattern.test(prompt)) {
      concepts.push(concept);
    }
  });

  return concepts;
}

/**
 * Get detailed training example context for agent
 */
export function getTrainingExampleContext(userPrompt: string, maxExamples: number = 3): string {
  const relevantExamples = getRelevantExamples(userPrompt, maxExamples);

  if (relevantExamples.length === 0) {
    return '';
  }

  return `
════════════════════════════════════
MOST RELEVANT TRAINING EXAMPLES
════════════════════════════════════

These are the ${relevantExamples.length} most similar workflows from our training data.
Study them carefully and apply their patterns to generate the current workflow.

${relevantExamples.map((ex, i) => `
EXAMPLE ${i + 1}: ${ex.title}
────────────────────────────────────
User Prompt: "${ex.prompt}"
Description: ${ex.description}
Nodes Used: ${ex.nodesUsed.join(' → ')}
Data Flow: ${ex.dataFlow || 'N/A'}
Key Patterns:
${ex.patterns.map(p => `  • ${p}`).join('\n')}

LESSONS TO APPLY:
${ex.patterns.map(p => `  - ${p}`).join('\n')}
`).join('\n')}

════════════════════════════════════
CRITICAL: You MUST follow the patterns from these examples.
If a similar workflow exists above, use the SAME node types and data flow structure.
════════════════════════════════════
`;
}
