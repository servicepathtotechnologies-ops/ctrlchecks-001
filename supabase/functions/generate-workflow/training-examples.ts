/**
 * Training Examples for Autonomous Workflow Agent
 * 
 * These 275 sample workflows (25 original + 250 new) serve as training data to help the agent
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

/**
 * Helper function to map node names from snake_case to display format
 */
function mapNodeName(nodeName: string): string {
  const nodeMap: Record<string, string> = {
    'form': 'Form',
    'google_gmail': 'Google Gmail',
    'manual_trigger': 'Manual Trigger',
    'google_sheets': 'Google Sheets',
    'javascript': 'JavaScript',
    'webhook': 'Webhook',
    'database_write': 'Database Write',
    'database_read': 'Database Read',
    'supabase': 'Supabase',
    'schedule': 'Schedule Trigger',
    'http_request': 'HTTP Request',
    'if_else': 'If/Else',
    'slack_message': 'Slack Message',
    'chat_trigger': 'Chat Trigger',
    'google_gemini': 'Google Gemini',
    'read_binary_file': 'Read Binary File',
    'write_binary_file': 'Write Binary File',
    'aws_s3': 'AWS S3',
    'log_output': 'Log Output',
    'interval': 'Interval Trigger',
    'error_trigger': 'Error Trigger',
    'loop_over_items': 'Loop Over Items',
    'loop': 'Loop',
    'switch': 'Switch',
    'openai_gpt': 'OpenAI GPT',
    'memory': 'Memory',
    'chat_response': 'Chat Response',
    'respond_to_webhook': 'Respond to Webhook',
    'database_delete': 'Database Delete',
    'google_doc': 'Google Doc',
    'sms_send': 'SMS Send'
  };
  
  const mapped = nodeMap[nodeName.toLowerCase()];
  if (mapped) return mapped;
  
  // Fallback: convert snake_case to Title Case
  return nodeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper function to parse node sequence string
 */
function parseNodeSequence(sequence: string): string[] {
  return sequence
    .split('→')
    .map(n => n.trim())
    .filter(n => n)
    .map(mapNodeName);
}

export const TRAINING_EXAMPLES: TrainingExample[] = [
  {
    prompt: "Create a workflow that receives user data from a webhook, stores it in a database, and sends a confirmation message and stored data to Slack.",
    title: "Webhook Data Intake & Notification",
    description: "Captures webhook data, persists it, and notifies the team.",
    nodesUsed: ["Webhook", "Supabase", "Slack"],
    patterns: [
      "Webhook trigger receives external data",
      "Database write operation for persistence",
      "Slack notification as output",
      "Data flows: webhook → database → slack"
    ],
    dataFlow: "Webhook receives JSON → Supabase stores data → Slack sends notification with stored data"
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
    nodesUsed: ["Schedule Trigger", "Supabase", "Google Drive"],
    patterns: [
      "Schedule trigger for periodic execution",
      "Database read/export",
      "Google Drive file upload"
    ],
    dataFlow: "Schedule → Supabase export → Google Drive upload"
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
    nodesUsed: ["Interval", "Supabase", "Delete Query"],
    patterns: [
      "Interval trigger for periodic execution",
      "Database query for old records",
      "Delete operation"
    ],
    dataFlow: "Interval → Supabase query old records → Delete"
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
  },
  // ========== NEW TRAINING EXAMPLES (250 workflows) ==========
  {
    prompt: "When a user submits a form, send them a confirmation email.",
    title: "Form Submission → Confirmation Email",
    description: "Send confirmation email when form is submitted.",
    nodesUsed: parseNodeSequence("form → google_gmail"),
    patterns: [
      "Form trigger collects user input",
      "Google Gmail node sends confirmation email",
      "Form data accessed via input.data.email and input.data.name",
      "Template variables for email content"
    ],
    dataFlow: "Form Trigger → Google Gmail: Send Confirmation Email"
  },
  {
    prompt: "Read data from Google Sheets and email it to me.",
    title: "Manual Trigger → Read Google Sheets → Email Data",
    description: "Read Google Sheets data and send via email.",
    nodesUsed: parseNodeSequence("manual_trigger → google_sheets → javascript → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Google Sheets read operation",
      "JavaScript node parses array-of-arrays to text",
      "Google Gmail sends formatted data"
    ],
    dataFlow: "Manual Trigger → Google Sheets: Read Data → JavaScript: Parse Data → Google Gmail: Send Email"
  },
  {
    prompt: "When my API sends data, save it into the database.",
    title: "Webhook → Save Data to Database",
    description: "Save webhook data to database.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives API data",
      "JavaScript node validates and normalizes data",
      "Database write operation for persistence",
      "Data validation before storage"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Validate & Normalize → Database Write: Save Data"
  },
  {
    prompt: "Every day at 9 AM, fetch API data and save it to Google Sheets.",
    title: "Scheduled API Sync → Google Sheets",
    description: "Daily API data sync to Google Sheets.",
    nodesUsed: parseNodeSequence("schedule → http_request → javascript → google_sheets"),
    patterns: [
      "Schedule trigger with cron expression (0 9 * * *)",
      "HTTP Request fetches external API data",
      "JavaScript converts JSON to array of arrays",
      "Google Sheets append operation"
    ],
    dataFlow: "Schedule: Daily 9 AM → HTTP Request: Fetch API Data → JavaScript: Format Rows → Google Sheets: Append Data"
  },
  {
    prompt: "If age is greater than 18, send Slack message, otherwise send email.",
    title: "Form → Conditional Routing (Slack or Email)",
    description: "Route based on age condition to Slack or email.",
    nodesUsed: parseNodeSequence("form → if_else → slack_message → google_gmail"),
    patterns: [
      "Form trigger collects user input",
      "If/Else node for conditional routing",
      "Condition checks: Number(input.data.age) > 18",
      "Multiple output paths based on condition"
    ],
    dataFlow: "Form Trigger → If Else: age > 18? → Yes: Slack Message → No: Google Gmail"
  },
  {
    prompt: "Create a chatbot that remembers conversation history.",
    title: "Chatbot with Memory and AI Response",
    description: "Chatbot with conversation memory using AI.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → database_write"),
    patterns: [
      "Chat trigger for user messages",
      "JavaScript combines history + user message",
      "Google Gemini generates AI response",
      "Database write stores conversation history with session_id"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Prompt → Google Gemini: AI Response → Database Write: Store History"
  },
  {
    prompt: "When a file is uploaded, read its content and email it.",
    title: "File Upload → Read → Email Content",
    description: "Read uploaded file and email content.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → javascript → google_gmail"),
    patterns: [
      "Webhook trigger receives file upload",
      "Read Binary File extracts file content",
      "JavaScript extracts text from file",
      "Google Gmail sends file content"
    ],
    dataFlow: "Webhook Trigger → Read Binary File → JavaScript: Extract Text → Google Gmail: Send Content"
  },
  {
    prompt: "Fetch API data and save only active users to database.",
    title: "API Call → Conditional Database Write",
    description: "Fetch API and filter active users before saving.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches API data",
      "JavaScript filters active users",
      "Database write saves filtered data"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Fetch API Data → JavaScript: Filter Active Users → Database Write: Save Active Users"
  },
  {
    prompt: "Every 10 minutes, check API health and alert if down.",
    title: "Interval → Health Check → Alert",
    description: "Monitor API health and alert on failure.",
    nodesUsed: parseNodeSequence("interval → http_request → if_else → slack_message"),
    patterns: [
      "Interval trigger for periodic execution (10 minutes)",
      "HTTP Request checks API health",
      "If/Else checks if status is OK",
      "Slack Message alerts if API is down"
    ],
    dataFlow: "Interval: 10m → HTTP Request: Check API Health → If Else: Status OK? → No: Slack Message: API Down"
  },
  {
    prompt: "When webhook receives data, process it and send a response.",
    title: "Webhook → Transform → Respond",
    description: "Process webhook data and respond.",
    nodesUsed: parseNodeSequence("webhook → javascript → google_gmail"),
    patterns: [
      "Webhook trigger receives incoming data",
      "JavaScript transforms input data",
      "Google Gmail sends processed data as response (alternative to respond_to_webhook)"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Transform Input → Google Gmail: Send Processed Data as Response"
  },
  {
    prompt: "New user signup: send welcome email and save to database.",
    title: "New User Signup → Welcome Email → Save to Database",
    description: "Welcome new users and store their data.",
    nodesUsed: parseNodeSequence("form → javascript → google_gmail → database_write"),
    patterns: [
      "Form trigger for user signup",
      "JavaScript normalizes input data",
      "Google Gmail sends welcome email",
      "Database write saves user data"
    ],
    dataFlow: "Form Trigger → JavaScript: Normalize Input → Google Gmail: Welcome Email → Database Write: Save User"
  },
  {
    prompt: "Upload CSV file, parse it, and store each row in database.",
    title: "CSV File Upload → Parse → Store Rows",
    description: "Parse CSV and store rows in database.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → javascript → loop_over_items → database_write"),
    patterns: [
      "Webhook trigger receives file upload",
      "Read Binary File reads CSV content",
      "JavaScript parses CSV to array of objects",
      "Loop Over Items iterates through rows",
      "Database Write saves each row"
    ],
    dataFlow: "Webhook Trigger → Read Binary File → JavaScript: Parse CSV → Loop Over Items → Database Write: Save Rows"
  },
  {
    prompt: "Daily database backup to cloud storage.",
    title: "Daily Database Backup → Cloud Storage",
    description: "Backup database daily to cloud storage.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → write_binary_file → aws_s3"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Read fetches all data",
      "JavaScript serializes data",
      "Write Binary File creates backup file",
      "AWS S3 uploads backup"
    ],
    dataFlow: "Schedule: Daily → Database Read → JavaScript: Serialize → Write Binary File → AWS S3: Backup"
  },
  {
    prompt: "Slack command fetches data and replies.",
    title: "Slack Command → Fetch Data → Reply",
    description: "Respond to Slack commands with fetched data.",
    nodesUsed: parseNodeSequence("webhook → http_request → javascript → slack_message"),
    patterns: [
      "Webhook trigger receives Slack command",
      "HTTP Request fetches external data",
      "JavaScript formats response",
      "Slack Message sends reply"
    ],
    dataFlow: "Webhook Trigger → HTTP Request: Fetch Data → JavaScript: Format Response → Slack Message"
  },
  {
    prompt: "Website contact form sends Slack notification.",
    title: "Website Contact Form → Slack Notification",
    description: "Notify team via Slack on form submission.",
    nodesUsed: parseNodeSequence("form → javascript → slack_message"),
    patterns: [
      "Form trigger collects contact information",
      "JavaScript formats message",
      "Slack Message notifies team"
    ],
    dataFlow: "Form Trigger → JavaScript: Format Message → Slack Message"
  },
  {
    prompt: "Check API every hour, detect changes, and alert.",
    title: "API Polling → Detect Change → Alert",
    description: "Monitor API for changes and alert.",
    nodesUsed: parseNodeSequence("interval → http_request → javascript → if_else → slack_message"),
    patterns: [
      "Interval trigger for hourly execution",
      "HTTP Request fetches API data",
      "JavaScript compares current state with previous",
      "If/Else checks if change detected",
      "Slack Message alerts on change"
    ],
    dataFlow: "Interval: 1h → HTTP Request: Fetch API → JavaScript: Compare State → If Else: Change Detected? → Yes: Slack Message"
  },
  {
    prompt: "Categorize user feedback and save to database.",
    title: "User Feedback Form → Categorize → Save",
    description: "Categorize feedback and store.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects feedback",
      "JavaScript classifies feedback category",
      "Database Write saves categorized feedback"
    ],
    dataFlow: "Form Trigger → JavaScript: Classify Feedback → Database Write: Save Categorized Feedback"
  },
  {
    prompt: "Summarize text using AI and email the summary.",
    title: "AI Text Summarization Pipeline",
    description: "AI-powered text summarization and email delivery.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → google_gemini → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript prepares prompt",
      "Google Gemini summarizes text",
      "Google Gmail sends summary"
    ],
    dataFlow: "Manual Trigger → JavaScript: Prepare Prompt → Google Gemini: Summarize Text → Google Gmail: Send Summary"
  },
  {
    prompt: "Generate invoice PDF and email it.",
    title: "Invoice Generation → Email PDF",
    description: "Generate invoice and send via email.",
    nodesUsed: parseNodeSequence("form → javascript → write_binary_file → google_gmail"),
    patterns: [
      "Form trigger collects invoice data",
      "JavaScript generates invoice",
      "Write Binary File creates PDF",
      "Google Gmail sends invoice PDF"
    ],
    dataFlow: "Form Trigger → JavaScript: Generate Invoice → Write Binary File: PDF → Google Gmail: Send Invoice"
  },
  {
    prompt: "Calculate lead score and update CRM.",
    title: "Lead Scoring → CRM Update",
    description: "Score leads and update CRM system.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives lead data",
      "JavaScript calculates lead score",
      "Database Write updates CRM"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Calculate Lead Score → Database Write: Update CRM"
  },
  {
    prompt: "Route data based on type to different destinations.",
    title: "Multi-Branch Routing Based on Type",
    description: "Route data to different nodes based on type.",
    nodesUsed: parseNodeSequence("webhook → switch → javascript → database_write → google_gmail"),
    patterns: [
      "Webhook trigger receives data",
      "Switch node routes based on type field",
      "Multiple output paths: JavaScript, Database Write, Google Gmail"
    ],
    dataFlow: "Webhook Trigger → Switch: Type → Case A: JavaScript → Case B: Database Write → Case C: Google Gmail"
  },
  {
    prompt: "Handle workflow errors and notify team.",
    title: "Error Handling → Notification",
    description: "Catch errors and send notifications.",
    nodesUsed: parseNodeSequence("error_trigger → slack_message"),
    patterns: [
      "Error Trigger catches workflow failures",
      "Slack Message notifies team of failure"
    ],
    dataFlow: "Error Trigger → Slack Message: Notify Failure"
  },
  {
    prompt: "Send bulk emails to all users from database.",
    title: "Bulk Email Campaign",
    description: "Send emails to multiple users.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → loop_over_items → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches all users",
      "Loop Over Items iterates through users",
      "Google Gmail sends email to each user"
    ],
    dataFlow: "Manual Trigger → Database Read: Fetch Users → Loop Over Items → Google Gmail: Send Email"
  },
  {
    prompt: "Log user activity to analytics storage.",
    title: "User Activity Log → Analytics Storage",
    description: "Track and store user activity.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives activity data",
      "JavaScript normalizes activity data",
      "Database Write logs activity"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Normalize Data → Database Write: Log Activity"
  },
  {
    prompt: "Moderate content using AI and block unsafe content.",
    title: "Content Moderation with AI",
    description: "AI-powered content moderation system.",
    nodesUsed: parseNodeSequence("webhook → google_gemini → if_else → database_write"),
    patterns: [
      "Webhook trigger receives content",
      "Google Gemini checks content safety",
      "If/Else routes based on safety check",
      "Database Write blocks/allows content"
    ],
    dataFlow: "Webhook Trigger → Google Gemini: Content Check → If Else: Unsafe? → Database Write: Block/Allow"
  },
  {
    prompt: "Enrich user data from third-party API.",
    title: "Data Enrichment Pipeline",
    description: "Enrich user data with external API.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → http_request → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches users",
      "HTTP Request enriches data from API",
      "JavaScript merges enriched data",
      "Database Write saves enriched users"
    ],
    dataFlow: "Manual Trigger → Database Read: Fetch Users → HTTP Request: Enrich Data → JavaScript: Merge Data → Database Write: Save Enriched Users"
  },
  {
    prompt: "Generate daily report and post it on Slack.",
    title: "Report Generation → Slack Delivery",
    description: "Generate and deliver daily reports.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → slack_message"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Read fetches report data",
      "JavaScript generates report",
      "Slack Message posts report"
    ],
    dataFlow: "Schedule: Daily → Database Read: Fetch Data → JavaScript: Generate Report → Slack Message: Post Report"
  },
  {
    prompt: "When a user is deleted, remove all their data.",
    title: "User Deletion → Cleanup Resources",
    description: "Clean up user data on deletion.",
    nodesUsed: parseNodeSequence("webhook → database_delete → aws_s3"),
    patterns: [
      "Webhook trigger receives user deletion event",
      "Database Delete removes user records",
      "AWS S3 deletes user files"
    ],
    dataFlow: "Webhook Trigger: User Deletion → Database Delete: Remove Records → AWS S3: Delete Files"
  },
  {
    prompt: "Validate incoming webhook data and respond accordingly.",
    title: "Webhook → Data Validation → Reject or Accept",
    description: "Validate webhook and respond.",
    nodesUsed: parseNodeSequence("webhook → javascript → if_else → google_gmail"),
    patterns: [
      "Webhook trigger receives data",
      "JavaScript validates data",
      "If/Else routes based on validation",
      "Google Gmail sends accept/reject response"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Validate Data → If Else: Valid? → Yes: Google Gmail: Accept → No: Google Gmail: Reject"
  },
  {
    prompt: "Automatically reply to messages using AI.",
    title: "AI-Based Auto Reply System",
    description: "AI-powered automatic message replies.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → chat_response"),
    patterns: [
      "Chat Trigger receives user message",
      "JavaScript builds prompt",
      "Google Gemini generates AI reply",
      "Chat Response sends reply"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Prompt → Google Gemini: AI Reply → Chat Response"
  },
  {
    prompt: "Send a test email manually.",
    title: "Manual → Send Test Email",
    description: "Send test email on demand.",
    nodesUsed: parseNodeSequence("manual_trigger → google_gmail"),
    patterns: [
      "Manual trigger for testing",
      "Google Gmail sends test email"
    ],
    dataFlow: "Manual Trigger → Google Gmail: Send Test Email"
  },
  {
    prompt: "Post a message to Slack manually.",
    title: "Manual → Post Message to Slack",
    description: "Send Slack message on demand.",
    nodesUsed: parseNodeSequence("manual_trigger → slack_message"),
    patterns: [
      "Manual trigger for testing",
      "Slack Message posts message"
    ],
    dataFlow: "Manual Trigger → Slack Message: Post Message"
  },
  {
    prompt: "Save form submission to Google Sheets.",
    title: "Form → Save Submission to Google Sheets",
    description: "Store form data in Google Sheets.",
    nodesUsed: parseNodeSequence("form → javascript → google_sheets"),
    patterns: [
      "Form trigger collects data",
      "JavaScript formats row data",
      "Google Sheets append operation"
    ],
    dataFlow: "Form Trigger → JavaScript: Format Row → Google Sheets: Append Data"
  },
  {
    prompt: "Log incoming webhook data.",
    title: "Webhook → Log Incoming Data",
    description: "Log webhook payloads.",
    nodesUsed: parseNodeSequence("webhook → log_output"),
    patterns: [
      "Webhook trigger receives data",
      "Log Output logs incoming data"
    ],
    dataFlow: "Webhook Trigger → Log Output: Log Incoming Data"
  },
  {
    prompt: "Send daily reminder email.",
    title: "Schedule → Send Daily Reminder Email",
    description: "Daily email reminders.",
    nodesUsed: parseNodeSequence("schedule → google_gmail"),
    patterns: [
      "Schedule trigger for daily execution",
      "Google Gmail sends reminder email"
    ],
    dataFlow: "Schedule Trigger: Daily → Google Gmail: Send Reminder"
  },
  {
    prompt: "Ping API every 5 minutes.",
    title: "Interval → Ping API",
    description: "Periodic API health check.",
    nodesUsed: parseNodeSequence("interval → http_request"),
    patterns: [
      "Interval trigger for periodic execution (5 min)",
      "HTTP Request pings API"
    ],
    dataFlow: "Interval Trigger: Every 5 Min → HTTP Request: Ping API"
  },
  {
    prompt: "Send admin notification email on form submission.",
    title: "Form → Send Admin Notification Email",
    description: "Notify admins of form submissions.",
    nodesUsed: parseNodeSequence("form → google_gmail"),
    patterns: [
      "Form trigger collects data",
      "Google Gmail sends admin notification"
    ],
    dataFlow: "Form Trigger → Google Gmail: Send Admin Notification"
  },
  {
    prompt: "Read content from Google Doc.",
    title: "Manual → Read Google Doc",
    description: "Read Google Doc content.",
    nodesUsed: parseNodeSequence("manual_trigger → google_doc"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Google Doc read operation"
    ],
    dataFlow: "Manual Trigger → Google Doc: Read Content"
  },
  {
    prompt: "Fetch data from API manually.",
    title: "Manual → Fetch API Data",
    description: "Fetch API data on demand.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request"),
    patterns: [
      "Manual trigger for testing",
      "HTTP Request fetches API data"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Fetch API Data"
  },
  {
    prompt: "Respond to webhook with success message.",
    title: "Webhook → Respond with Success",
    description: "Acknowledge webhook with response.",
    nodesUsed: parseNodeSequence("webhook → google_gmail"),
    patterns: [
      "Webhook trigger receives data",
      "Google Gmail sends success message (alternative to respond_to_webhook)"
    ],
    dataFlow: "Webhook Trigger → Google Gmail: Respond with Success Message"
  },
  {
    prompt: "Echo chat message back to user.",
    title: "Chat → Echo Message",
    description: "Simple echo chatbot.",
    nodesUsed: parseNodeSequence("chat_trigger → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "Chat Response echoes message"
    ],
    dataFlow: "Chat Trigger → Chat Response: Echo Message"
  },
  {
    prompt: "Write data to database manually.",
    title: "Manual → Write Data to Database",
    description: "Insert record into database.",
    nodesUsed: parseNodeSequence("manual_trigger → database_write"),
    patterns: [
      "Manual trigger for testing",
      "Database Write inserts record"
    ],
    dataFlow: "Manual Trigger → Database Write: Insert Record"
  },
  {
    prompt: "Save raw webhook payload to database.",
    title: "Webhook → Save Raw Payload to Database",
    description: "Store webhook payload as-is.",
    nodesUsed: parseNodeSequence("webhook → database_write"),
    patterns: [
      "Webhook trigger receives payload",
      "Database Write saves raw payload"
    ],
    dataFlow: "Webhook Trigger → Database Write: Save Raw Payload"
  },
  {
    prompt: "Clear old records from database daily.",
    title: "Schedule → Clear Old Records",
    description: "Daily database cleanup.",
    nodesUsed: parseNodeSequence("schedule → database_delete"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Delete removes old records"
    ],
    dataFlow: "Schedule Trigger: Daily → Database Delete: Old Records"
  },
  {
    prompt: "Upload file to cloud storage manually.",
    title: "Manual → Upload File to Cloud Storage",
    description: "Upload file to S3.",
    nodesUsed: parseNodeSequence("manual_trigger → write_binary_file → aws_s3"),
    patterns: [
      "Manual trigger for file upload",
      "Write Binary File prepares file",
      "AWS S3 uploads file"
    ],
    dataFlow: "Manual Trigger → Write Binary File → AWS S3: Upload File"
  },
  {
    prompt: "Send thank you email on form submission.",
    title: "Form → Thank You Email",
    description: "Thank users for form submission.",
    nodesUsed: parseNodeSequence("form → google_gmail"),
    patterns: [
      "Form trigger collects data",
      "Google Gmail sends thank you email"
    ],
    dataFlow: "Form Trigger → Google Gmail: Send Thank You Email"
  },
  {
    prompt: "Generate random ID using JavaScript.",
    title: "Manual → Generate Random ID",
    description: "Generate unique identifier.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript"),
    patterns: [
      "Manual trigger for testing",
      "JavaScript generates random ID"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate Random ID"
  },
  {
    prompt: "Forward webhook data to another API.",
    title: "Webhook → Forward Data to Another API",
    description: "Proxy webhook to external API.",
    nodesUsed: parseNodeSequence("webhook → http_request"),
    patterns: [
      "Webhook trigger receives data",
      "HTTP Request forwards data to API"
    ],
    dataFlow: "Webhook Trigger → HTTP Request: Forward Data"
  },
  {
    prompt: "Print output to log.",
    title: "Manual → Print Output Log",
    description: "Log message for debugging.",
    nodesUsed: parseNodeSequence("manual_trigger → log_output"),
    patterns: [
      "Manual trigger for testing",
      "Log Output prints message"
    ],
    dataFlow: "Manual Trigger → Log Output: Print Message"
  },
  {
    prompt: "Save form submission as JSON file.",
    title: "Form → Save as JSON File",
    description: "Store form data as JSON.",
    nodesUsed: parseNodeSequence("form → javascript → write_binary_file"),
    patterns: [
      "Form trigger collects data",
      "JavaScript serializes to JSON",
      "Write Binary File saves JSON"
    ],
    dataFlow: "Form Trigger → JavaScript: Serialize JSON → Write Binary File: Save JSON"
  },
  {
    prompt: "Convert given text into a PDF file.",
    title: "Manual → Convert Text to PDF",
    description: "Generate PDF from text.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript converts text to PDF",
      "Write Binary File saves PDF"
    ],
    dataFlow: "Manual Trigger → JavaScript: Convert Text to PDF → Write Binary File: Save PDF"
  },
  {
    prompt: "Send SMS notification when form is submitted.",
    title: "Form → Send SMS Notification",
    description: "Send SMS on form submission.",
    nodesUsed: parseNodeSequence("form → javascript → sms_send"),
    patterns: [
      "Form trigger collects data",
      "JavaScript prepares SMS content",
      "SMS Send sends notification (or Google Gmail as alternative)"
    ],
    dataFlow: "Form Trigger → JavaScript: Prepare SMS Content → SMS Send / Google Gmail: Send SMS via Email Gateway"
  },
  {
    prompt: "Process an uploaded image and store the result.",
    title: "Webhook → Image Processing → Store",
    description: "Process and store images.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → javascript → aws_s3"),
    patterns: [
      "Webhook trigger receives image upload",
      "Read Binary File reads image",
      "JavaScript processes image",
      "AWS S3 uploads processed image"
    ],
    dataFlow: "Webhook Trigger → Read Binary File: Image → JavaScript: Process Image → AWS S3: Upload Image"
  },
  {
    prompt: "Generate a QR code for a given URL.",
    title: "Manual → Generate QR Code",
    description: "Create QR code image.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates QR code",
      "Write Binary File saves QR code image"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate QR Code → Write Binary File: Save QR Code"
  },
  {
    prompt: "Send a weekly analytics report email.",
    title: "Schedule → Weekly Analytics Report",
    description: "Weekly analytics email report.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → google_gmail"),
    patterns: [
      "Schedule trigger for weekly execution",
      "Database Read fetches analytics data",
      "JavaScript generates report",
      "Google Gmail sends email"
    ],
    dataFlow: "Schedule Trigger: Weekly → Database Read: Fetch Analytics → JavaScript: Generate Report → Google Gmail: Send Email"
  },
  {
    prompt: "Send customer feedback to Slack.",
    title: "Form → Customer Feedback → Slack",
    description: "Route feedback to Slack.",
    nodesUsed: parseNodeSequence("form → javascript → slack_message"),
    patterns: [
      "Form trigger collects feedback",
      "JavaScript formats feedback",
      "Slack Message posts feedback"
    ],
    dataFlow: "Form Trigger → JavaScript: Format Feedback → Slack Message: Post Feedback"
  },
  {
    prompt: "Delete old or duplicate records from the database.",
    title: "Manual → Clean Database",
    description: "Clean database records.",
    nodesUsed: parseNodeSequence("manual_trigger → database_delete"),
    patterns: [
      "Manual trigger for maintenance",
      "Database Delete removes old/duplicate records"
    ],
    dataFlow: "Manual Trigger → Database Delete: Clean Records"
  },
  {
    prompt: "Send email to admin when webhook is triggered.",
    title: "Webhook → Notify Admin via Email",
    description: "Notify admin of webhook events.",
    nodesUsed: parseNodeSequence("webhook → google_gmail"),
    patterns: [
      "Webhook trigger receives data",
      "Google Gmail sends admin notification"
    ],
    dataFlow: "Webhook Trigger → Google Gmail: Send Admin Notification"
  },
  {
    prompt: "Monitor disk space every hour and alert if low.",
    title: "Interval → Check Disk Space → Alert",
    description: "Monitor system resources.",
    nodesUsed: parseNodeSequence("interval → javascript → if_else → google_gmail"),
    patterns: [
      "Interval trigger for hourly execution",
      "JavaScript checks disk space",
      "If/Else checks if space is low",
      "Google Gmail sends alert if low"
    ],
    dataFlow: "Interval Trigger: Hourly → JavaScript: Check Disk Space → If Else: Low? → Yes: Google Gmail: Send Alert"
  },
  {
    prompt: "Analyze sentiment of user messages in chat.",
    title: "Chat → AI Sentiment Analysis",
    description: "Sentiment analysis for chat messages.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript builds analysis prompt",
      "Google Gemini analyzes sentiment",
      "Chat Response returns sentiment"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Analysis Prompt → Google Gemini: Sentiment Analysis → Chat Response: Return Sentiment"
  },
  {
    prompt: "Assign a ticket number to each form submission.",
    title: "Form → Auto-Assign Ticket Number",
    description: "Auto-generate ticket numbers.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects submission",
      "JavaScript generates ticket number",
      "Database Write saves ticket"
    ],
    dataFlow: "Form Trigger → JavaScript: Generate Ticket Number → Database Write: Save Ticket"
  },
  {
    prompt: "Get current weather data from API.",
    title: "Manual → Fetch Weather Data",
    description: "Fetch weather information.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches weather API",
      "JavaScript parses response"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Weather API → JavaScript: Parse Response"
  },
  {
    prompt: "Save uploaded files to cloud storage.",
    title: "Webhook → File Upload → Cloud Storage",
    description: "Store uploaded files in cloud.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → aws_s3"),
    patterns: [
      "Webhook trigger receives file upload",
      "Read Binary File reads uploaded file",
      "AWS S3 uploads file"
    ],
    dataFlow: "Webhook Trigger → Read Binary File: Uploaded File → AWS S3: Upload File"
  },
  {
    prompt: "Notify different teams based on form input.",
    title: "Form → Conditional Notification",
    description: "Route notifications by condition.",
    nodesUsed: parseNodeSequence("form → if_else → slack_message → google_gmail"),
    patterns: [
      "Form trigger collects data",
      "If/Else routes based on input condition",
      "Slack Message for team A",
      "Google Gmail for team B"
    ],
    dataFlow: "Form Trigger → If Else: Condition Based on Input → True: Slack Message: Notify Team A → False: Google Gmail: Notify Team B"
  },
  {
    prompt: "Generate a unique API key for a user.",
    title: "Manual → Generate API Key",
    description: "Create API keys for users.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates API key",
      "Database Write stores key"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate API Key → Database Write: Store Key"
  },
  {
    prompt: "Sync API data to database daily.",
    title: "Schedule → Daily API Sync",
    description: "Daily API to database sync.",
    nodesUsed: parseNodeSequence("schedule → http_request → javascript → database_write"),
    patterns: [
      "Schedule trigger for daily execution",
      "HTTP Request fetches API data",
      "JavaScript formats data",
      "Database Write saves data"
    ],
    dataFlow: "Schedule Trigger: Daily → HTTP Request: Fetch API Data → JavaScript: Format Data → Database Write: Save Data"
  },
  {
    prompt: "Translate chat messages automatically.",
    title: "Chat → Auto Translation",
    description: "Automatic message translation.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript builds translation prompt",
      "Google Gemini translates message",
      "Chat Response sends translated message"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Translation Prompt → Google Gemini: Translate → Chat Response: Send Translated Message"
  },
  {
    prompt: "Create CSV report from database data.",
    title: "Manual → Generate CSV Report",
    description: "Export data as CSV.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches data",
      "JavaScript converts to CSV",
      "Write Binary File saves CSV"
    ],
    dataFlow: "Manual Trigger → Database Read: Fetch Data → JavaScript: Convert to CSV → Write Binary File: Save CSV"
  },
  {
    prompt: "Check API every 30 minutes and log changes.",
    title: "Interval → Monitor API → Log Changes",
    description: "Monitor API and track changes.",
    nodesUsed: parseNodeSequence("interval → http_request → javascript → log_output"),
    patterns: [
      "Interval trigger for 30-minute execution",
      "HTTP Request fetches API data",
      "JavaScript detects changes",
      "Log Output records changes"
    ],
    dataFlow: "Interval Trigger: 30 Min → HTTP Request: Fetch API Data → JavaScript: Detect Changes → Log Output: Record Changes"
  },
  {
    prompt: "Validate incoming webhook payload and save valid ones.",
    title: "Webhook → Validate → Store",
    description: "Validate and store webhook data.",
    nodesUsed: parseNodeSequence("webhook → javascript → if_else → database_write"),
    patterns: [
      "Webhook trigger receives payload",
      "JavaScript validates payload",
      "If/Else routes based on validation",
      "Database Write saves valid data"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Validate Payload → If Else: Valid? → Yes: Database Write: Save Data → No: Log Output: Invalid Payload"
  },
  {
    prompt: "Generate a PDF from form submission and email it.",
    title: "Form → Generate PDF → Email",
    description: "Generate PDF and send via email.",
    nodesUsed: parseNodeSequence("form → javascript → write_binary_file → google_gmail"),
    patterns: [
      "Form trigger collects data",
      "JavaScript generates PDF",
      "Write Binary File saves PDF",
      "Google Gmail sends PDF"
    ],
    dataFlow: "Form Trigger → JavaScript: Generate PDF → Write Binary File: Save PDF → Google Gmail: Send PDF"
  },
  {
    prompt: "Send emails to all users from database.",
    title: "Manual → Send Batch Emails",
    description: "Bulk email to all users.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → loop → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches users",
      "Loop iterates through users",
      "Google Gmail sends email to each"
    ],
    dataFlow: "Manual Trigger → Database Read: Fetch Users → Loop: Each User → Google Gmail: Send Email"
  },
  {
    prompt: "Parse incoming JSON webhook payload and store in database.",
    title: "Webhook → Parse JSON → Store",
    description: "Parse and store JSON webhook data.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives JSON payload",
      "JavaScript parses JSON",
      "Database Write stores parsed data"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Parse JSON → Database Write: Store Data"
  },
  {
    prompt: "Chatbot responds and saves conversation.",
    title: "Chat → AI Response → Store History",
    description: "AI chatbot with conversation history.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → memory"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript builds prompt",
      "Google Gemini generates response",
      "Memory stores conversation"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Prompt → Google Gemini: Generate Response → Memory: Store Conversation"
  },
  {
    prompt: "Send different emails based on user input.",
    title: "Form → Conditional Email",
    description: "Conditional email routing.",
    nodesUsed: parseNodeSequence("form → if_else → google_gmail"),
    patterns: [
      "Form trigger collects data",
      "If/Else routes based on condition",
      "Google Gmail sends different emails"
    ],
    dataFlow: "Form Trigger → If Else: Condition → True: Google Gmail: Send Email A → False: Google Gmail: Send Email B"
  },
  {
    prompt: "Fetch API data, parse it, and store in database.",
    title: "Manual → Fetch API → Parse → Store",
    description: "Fetch, parse, and store API data.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches data",
      "JavaScript parses data",
      "Database Write saves data"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Fetch Data → JavaScript: Parse Data → Database Write: Save Data"
  },
  {
    prompt: "Backup database daily to cloud storage.",
    title: "Schedule → Daily Backup → Cloud Storage",
    description: "Daily database backup to S3.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → write_binary_file → aws_s3"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Read fetches all data",
      "JavaScript serializes data",
      "Write Binary File creates backup",
      "AWS S3 uploads backup"
    ],
    dataFlow: "Schedule Trigger: Daily → Database Read → JavaScript: Serialize Data → Write Binary File → AWS S3: Upload"
  },
  {
    prompt: "Filter webhook data and send an email if criteria met.",
    title: "Webhook → Filter Data → Email",
    description: "Conditional email based on webhook data.",
    nodesUsed: parseNodeSequence("webhook → javascript → if_else → google_gmail"),
    patterns: [
      "Webhook trigger receives data",
      "JavaScript filters data",
      "If/Else checks if criteria met",
      "Google Gmail sends email if condition true"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Filter Data → If Else: Criteria Met? → Yes: Google Gmail: Send Email"
  },
  {
    prompt: "Check website every 15 minutes and alert Slack if down.",
    title: "Interval → Check Website → Slack Alert",
    description: "Monitor website uptime.",
    nodesUsed: parseNodeSequence("interval → http_request → if_else → slack_message"),
    patterns: [
      "Interval trigger for 15-minute execution",
      "HTTP Request pings website",
      "If/Else checks if status OK",
      "Slack Message alerts if down"
    ],
    dataFlow: "Interval Trigger: 15min → HTTP Request: Ping Website → If Else: Status OK? → No: Slack Message: Alert"
  },
  {
    prompt: "Generate random password for user and store it.",
    title: "Manual → Generate Random Password → Store",
    description: "Generate and store passwords.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates random password",
      "Database Write saves password"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate Password → Database Write: Save Password"
  },
  {
    prompt: "Categorize feedback and store in database.",
    title: "Form → Categorize Feedback → Database",
    description: "Categorize and store feedback.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects feedback",
      "JavaScript categorizes feedback",
      "Database Write stores feedback"
    ],
    dataFlow: "Form Trigger → JavaScript: Categorize Feedback → Database Write: Store Feedback"
  },
  {
    prompt: "Translate chat messages automatically.",
    title: "Chat → AI Translation → Response",
    description: "Auto-translate chat messages.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript prepares translation",
      "Google Gemini translates",
      "Chat Response sends translation"
    ],
    dataFlow: "Chat Trigger → JavaScript: Prepare Translation → Google Gemini: Translate → Chat Response: Send Translation"
  },
  {
    prompt: "Save attachments from webhook to cloud storage.",
    title: "Webhook → Save Attachment → Cloud Storage",
    description: "Store webhook attachments.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → aws_s3"),
    patterns: [
      "Webhook trigger receives attachment",
      "Read Binary File reads attachment",
      "AWS S3 uploads attachment"
    ],
    dataFlow: "Webhook Trigger → Read Binary File → AWS S3: Upload Attachment"
  },
  {
    prompt: "Fetch API data, convert to CSV, and save file.",
    title: "Manual → API Data → CSV → Save",
    description: "Export API data as CSV.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches API",
      "JavaScript converts to CSV",
      "Write Binary File saves CSV"
    ],
    dataFlow: "Manual Trigger → HTTP Request: API → JavaScript: Convert to CSV → Write Binary File: Save CSV"
  },
  {
    prompt: "Send reminder emails daily at 8 AM.",
    title: "Schedule → Send Daily Reminder Email",
    description: "Daily reminder emails.",
    nodesUsed: parseNodeSequence("schedule → google_gmail"),
    patterns: [
      "Schedule trigger for daily 8 AM execution",
      "Google Gmail sends reminder"
    ],
    dataFlow: "Schedule Trigger: Daily 8AM → Google Gmail: Send Reminder"
  },
  {
    prompt: "Assign role to user automatically based on input.",
    title: "Form → Auto-Assign User Role",
    description: "Auto-assign user roles.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects user data",
      "JavaScript determines role",
      "Database Write saves user role"
    ],
    dataFlow: "Form Trigger → JavaScript: Determine Role → Database Write: Save User Role"
  },
  {
    prompt: "Check API every 10 minutes and email alert if down.",
    title: "Interval → Monitor API → Email Alert",
    description: "Monitor API and email alerts.",
    nodesUsed: parseNodeSequence("interval → http_request → if_else → google_gmail"),
    patterns: [
      "Interval trigger for 10-minute execution",
      "HTTP Request checks API",
      "If/Else checks if status OK",
      "Google Gmail sends alert if down"
    ],
    dataFlow: "Interval Trigger: 10min → HTTP Request: API → If Else: Status OK? → No: Google Gmail: Alert"
  },
  {
    prompt: "Analyze sentiment of chat messages and save result.",
    title: "Chat → Sentiment Analysis → Database",
    description: "Sentiment analysis with storage.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → database_write"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript builds sentiment prompt",
      "Google Gemini analyzes sentiment",
      "Database Write stores result"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Sentiment Prompt → Google Gemini: Analyze Sentiment → Database Write: Store Result"
  },
  {
    prompt: "Generate invoice PDF and email to customer.",
    title: "Manual → Generate Invoice → Email",
    description: "Generate and email invoices.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → write_binary_file → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates invoice PDF",
      "Write Binary File saves PDF",
      "Google Gmail sends invoice"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate Invoice PDF → Write Binary File: Save PDF → Google Gmail: Send Invoice"
  },
  {
    prompt: "Send auto-reply and store submission.",
    title: "Form → Auto-Respond → Save Submission",
    description: "Auto-reply and store form data.",
    nodesUsed: parseNodeSequence("form → google_gmail → database_write"),
    patterns: [
      "Form trigger collects data",
      "Google Gmail sends auto-reply",
      "Database Write saves submission"
    ],
    dataFlow: "Form Trigger → Google Gmail: Auto-Reply → Database Write: Save Submission"
  },
  {
    prompt: "Normalize webhook payload and save to database.",
    title: "Webhook → Normalize Data → Database",
    description: "Normalize and store webhook data.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives payload",
      "JavaScript normalizes data",
      "Database Write saves normalized data"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Normalize Data → Database Write"
  },
  {
    prompt: "Generate report from database and send to Slack.",
    title: "Manual → Generate Report → Slack",
    description: "Generate and send reports.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → javascript → slack_message"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches data",
      "JavaScript generates report",
      "Slack Message sends report"
    ],
    dataFlow: "Manual Trigger → Database Read: Fetch Data → JavaScript: Generate Report → Slack Message: Send Report"
  },
  {
    prompt: "Backup files from system to cloud every night.",
    title: "Schedule → Backup Files → Cloud Storage",
    description: "Nightly file backups.",
    nodesUsed: parseNodeSequence("schedule → read_binary_file → aws_s3"),
    patterns: [
      "Schedule trigger for nightly execution",
      "Read Binary File reads source files",
      "AWS S3 uploads backup"
    ],
    dataFlow: "Schedule Trigger: Nightly → Read Binary File: Source Files → AWS S3: Upload Backup"
  },
  {
    prompt: "Send Slack alert only for high-priority submissions.",
    title: "Form → Conditional Slack Notification",
    description: "Conditional Slack alerts.",
    nodesUsed: parseNodeSequence("form → if_else → slack_message"),
    patterns: [
      "Form trigger collects data",
      "If/Else checks if priority is high",
      "Slack Message alerts only if high priority"
    ],
    dataFlow: "Form Trigger → If Else: Priority High? → Yes: Slack Message: Alert Team"
  },
  {
    prompt: "Sync API data to database every hour.",
    title: "Interval → API Data Sync",
    description: "Hourly API sync.",
    nodesUsed: parseNodeSequence("interval → http_request → javascript → database_write"),
    patterns: [
      "Interval trigger for hourly execution",
      "HTTP Request fetches API data",
      "JavaScript formats data",
      "Database Write saves data"
    ],
    dataFlow: "Interval Trigger: Hourly → HTTP Request: Fetch API Data → JavaScript: Format Data → Database Write: Save Data"
  },
  {
    prompt: "Reply automatically to chat messages based on keywords.",
    title: "Chat → Auto-Reply Based on Keywords",
    description: "Keyword-based auto-replies.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript matches keywords",
      "Chat Response sends auto reply"
    ],
    dataFlow: "Chat Trigger → JavaScript: Keyword Matching → Chat Response: Auto Reply"
  },
  {
    prompt: "Export user data from database to CSV.",
    title: "Manual → Export User Data → CSV",
    description: "Export users as CSV.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches users",
      "JavaScript converts to CSV",
      "Write Binary File saves CSV"
    ],
    dataFlow: "Manual Trigger → Database Read → JavaScript: Convert to CSV → Write Binary File: Save CSV"
  },
  {
    prompt: "Validate payment webhook and store result.",
    title: "Webhook → Validate Payment → Database",
    description: "Validate and store payments.",
    nodesUsed: parseNodeSequence("webhook → javascript → if_else → database_write"),
    patterns: [
      "Webhook trigger receives payment",
      "JavaScript validates payment",
      "If/Else routes based on validation",
      "Database Write stores valid payments"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Validate Payment → If Else: Valid? → Yes: Database Write → No: Log Output"
  },
  {
    prompt: "Send daily summary of activities via email.",
    title: "Schedule → Daily Summary Email",
    description: "Daily activity summaries.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → google_gmail"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Read fetches activities",
      "JavaScript generates summary",
      "Google Gmail sends email"
    ],
    dataFlow: "Schedule Trigger: Daily → Database Read: Fetch Activities → JavaScript: Generate Summary → Google Gmail: Send Email"
  },
  {
    prompt: "Automatically tag user submissions based on content.",
    title: "Form → Auto-Tag User Submission",
    description: "Auto-tag form submissions.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects submission",
      "JavaScript auto-tags submission",
      "Database Write saves tagged data"
    ],
    dataFlow: "Form Trigger → JavaScript: Auto-Tag Submission → Database Write: Save Tagged Data"
  },
  {
    prompt: "Generate a PDF report and send it to Slack.",
    title: "Manual → Generate PDF Report → Slack",
    description: "Generate PDF and send to Slack.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → write_binary_file → slack_message"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates PDF",
      "Write Binary File saves PDF",
      "Slack Message sends PDF"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate PDF → Write Binary File: Save PDF → Slack Message: Send PDF"
  },
  {
    prompt: "Insert into database only if criteria met.",
    title: "Form → Conditional Database Insert",
    description: "Conditional database writes.",
    nodesUsed: parseNodeSequence("form → if_else → database_write"),
    patterns: [
      "Form trigger collects data",
      "If/Else checks condition",
      "Database Write only if condition true"
    ],
    dataFlow: "Form Trigger → If Else: Condition → True: Database Write"
  },
  {
    prompt: "Transform webhook JSON data and respond.",
    title: "Webhook → Transform JSON → Respond",
    description: "Transform and respond to webhook.",
    nodesUsed: parseNodeSequence("webhook → javascript → respond_to_webhook"),
    patterns: [
      "Webhook trigger receives data",
      "JavaScript transforms JSON",
      "Respond to Webhook sends 200 OK"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Transform JSON → Respond to Webhook: 200 OK"
  },
  {
    prompt: "Analyze chat keywords and save in database.",
    title: "Chat → Keyword Analysis → Store",
    description: "Extract and store keywords.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → database_write"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript extracts keywords",
      "Database Write saves keywords"
    ],
    dataFlow: "Chat Trigger → JavaScript: Extract Keywords → Database Write: Save Keywords"
  },
  {
    prompt: "Fetch API data and email if certain condition met.",
    title: "Manual → Fetch API → Conditional Email",
    description: "Conditional email based on API data.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript → if_else → google_gmail"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches API data",
      "JavaScript evaluates condition",
      "If/Else routes based on condition",
      "Google Gmail sends email if condition met"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Fetch API Data → JavaScript: Evaluate Condition → If Else: Condition Met? → Yes: Google Gmail: Send Email"
  },
  {
    prompt: "Export database every night to S3.",
    title: "Schedule → Export Database → S3",
    description: "Nightly database export.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → write_binary_file → aws_s3"),
    patterns: [
      "Schedule trigger for nightly execution",
      "Database Read fetches data",
      "JavaScript serializes data",
      "Write Binary File saves export",
      "AWS S3 uploads export"
    ],
    dataFlow: "Schedule Trigger: Nightly → Database Read → JavaScript: Serialize Data → Write Binary File: Save → AWS S3: Upload"
  },
  {
    prompt: "Send Slack notification when form submitted.",
    title: "Form → Notify Team via Slack",
    description: "Notify team on form submission.",
    nodesUsed: parseNodeSequence("form → slack_message"),
    patterns: [
      "Form trigger collects data",
      "Slack Message notifies team"
    ],
    dataFlow: "Form Trigger → Slack Message: Notify Team"
  },
  {
    prompt: "Check system health and alert only if down.",
    title: "Interval → Health Check → Conditional Alert",
    description: "Conditional health monitoring.",
    nodesUsed: parseNodeSequence("interval → http_request → if_else → slack_message"),
    patterns: [
      "Interval trigger for periodic execution",
      "HTTP Request checks health",
      "If/Else checks if status OK",
      "Slack Message alerts only if down"
    ],
    dataFlow: "Interval Trigger → HTTP Request: Health Check → If Else: Status OK? → No: Slack Message: Alert"
  },
  {
    prompt: "Upload CSV via webhook and store rows.",
    title: "Webhook → CSV Upload → Database",
    description: "Parse and store CSV from webhook.",
    nodesUsed: parseNodeSequence("webhook → read_binary_file → javascript → loop → database_write"),
    patterns: [
      "Webhook trigger receives CSV",
      "Read Binary File reads CSV",
      "JavaScript parses CSV",
      "Loop iterates through rows",
      "Database Write inserts each row"
    ],
    dataFlow: "Webhook Trigger → Read Binary File: CSV → JavaScript: Parse CSV → Loop: Each Row → Database Write: Insert Row"
  },
  {
    prompt: "Automatically translate chat messages.",
    title: "Chat → Auto Translation → Response",
    description: "Auto-translate chat.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → chat_response"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript prepares translation",
      "Google Gemini translates",
      "Chat Response sends translation"
    ],
    dataFlow: "Chat Trigger → JavaScript: Prepare Translation → Google Gemini: Translate → Chat Response: Send Translation"
  },
  {
    prompt: "Generate a random token and store in database.",
    title: "Manual → Generate Random Token → Database",
    description: "Generate and store tokens.",
    nodesUsed: parseNodeSequence("manual_trigger → javascript → database_write"),
    patterns: [
      "Manual trigger for on-demand execution",
      "JavaScript generates token",
      "Database Write stores token"
    ],
    dataFlow: "Manual Trigger → JavaScript: Generate Token → Database Write: Store Token"
  },
  {
    prompt: "Categorize form submission and store.",
    title: "Form → Auto-Assign Category → Database",
    description: "Auto-categorize submissions.",
    nodesUsed: parseNodeSequence("form → javascript → database_write"),
    patterns: [
      "Form trigger collects submission",
      "JavaScript assigns category",
      "Database Write saves submission"
    ],
    dataFlow: "Form Trigger → JavaScript: Assign Category → Database Write: Save Submission"
  },
  {
    prompt: "Validate webhook data and respond accordingly.",
    title: "Webhook → Validate → Respond",
    description: "Validate and respond to webhook.",
    nodesUsed: parseNodeSequence("webhook → javascript → if_else → respond_to_webhook"),
    patterns: [
      "Webhook trigger receives data",
      "JavaScript validates data",
      "If/Else routes based on validation",
      "Respond to Webhook sends 200 OK or 400 Bad Request"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Validate Data → If Else: Valid? → Yes: Respond to Webhook: 200 OK → No: Respond to Webhook: 400 Bad Request"
  },
  {
    prompt: "Generate daily report and email it.",
    title: "Schedule → Generate Report → Email",
    description: "Daily report generation.",
    nodesUsed: parseNodeSequence("schedule → database_read → javascript → google_gmail"),
    patterns: [
      "Schedule trigger for daily execution",
      "Database Read fetches data",
      "JavaScript generates report",
      "Google Gmail sends email"
    ],
    dataFlow: "Schedule Trigger: Daily → Database Read: Fetch Data → JavaScript: Generate Report → Google Gmail: Send Email"
  },
  {
    prompt: "Poll API every 30 min and update database.",
    title: "Interval → API Polling → Database Update",
    description: "Periodic API polling.",
    nodesUsed: parseNodeSequence("interval → http_request → javascript → database_write"),
    patterns: [
      "Interval trigger for 30-minute execution",
      "HTTP Request polls API",
      "JavaScript parses and formats",
      "Database Write updates data"
    ],
    dataFlow: "Interval Trigger: 30min → HTTP Request: API → JavaScript: Parse & Format → Database Write: Update Data"
  },
  {
    prompt: "Send auto-reply and Slack notification on form submission.",
    title: "Form → Auto Reply → Slack Notification",
    description: "Auto-reply and team notification.",
    nodesUsed: parseNodeSequence("form → google_gmail → slack_message"),
    patterns: [
      "Form trigger collects data",
      "Google Gmail sends auto-reply",
      "Slack Message notifies team"
    ],
    dataFlow: "Form Trigger → Google Gmail: Auto Reply → Slack Message: Notify Team"
  },
  {
    prompt: "Fetch data and save as JSON file.",
    title: "Manual → Fetch Data → JSON File",
    description: "Fetch and save as JSON.",
    nodesUsed: parseNodeSequence("manual_trigger → http_request → javascript → write_binary_file"),
    patterns: [
      "Manual trigger for on-demand execution",
      "HTTP Request fetches data",
      "JavaScript converts to JSON",
      "Write Binary File saves JSON"
    ],
    dataFlow: "Manual Trigger → HTTP Request: Fetch Data → JavaScript: Convert to JSON → Write Binary File: Save JSON"
  },
  {
    prompt: "Analyze chat sentiment and alert Slack if negative.",
    title: "Chat → Sentiment Analysis → Slack Alert",
    description: "Sentiment-based alerts.",
    nodesUsed: parseNodeSequence("chat_trigger → javascript → google_gemini → if_else → slack_message"),
    patterns: [
      "Chat Trigger receives message",
      "JavaScript builds prompt",
      "Google Gemini analyzes sentiment",
      "If/Else checks if negative",
      "Slack Message alerts if negative"
    ],
    dataFlow: "Chat Trigger → JavaScript: Build Prompt → Google Gemini: Sentiment Analysis → If Else: Negative? → Yes: Slack Message: Alert Team"
  },
  {
    prompt: "Transform incoming webhook data and save.",
    title: "Webhook → Transform → Database",
    description: "Transform and store webhook data.",
    nodesUsed: parseNodeSequence("webhook → javascript → database_write"),
    patterns: [
      "Webhook trigger receives data",
      "JavaScript transforms data",
      "Database Write saves transformed data"
    ],
    dataFlow: "Webhook Trigger → JavaScript: Transform Data → Database Write: Save Transformed Data"
  },
  {
    prompt: "Export users to CSV and upload to S3.",
    title: "Manual → Export Users → CSV → S3",
    description: "Export users and upload to S3.",
    nodesUsed: parseNodeSequence("manual_trigger → database_read → javascript → write_binary_file → aws_s3"),
    patterns: [
      "Manual trigger for on-demand execution",
      "Database Read fetches users",
      "JavaScript converts to CSV",
      "Write Binary File saves CSV",
      "AWS S3 uploads CSV"
    ],
    dataFlow: "Manual Trigger → Database Read: Users → JavaScript: Convert to CSV → Write Binary File: Save CSV → AWS S3: Upload"
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
