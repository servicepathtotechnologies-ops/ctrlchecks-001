import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useWorkflowStore, WorkflowNode } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, ArrowLeft, Loader2, Wand2, Settings2, Check } from 'lucide-react';
import { NODE_TYPES } from '@/components/workflow/nodeTypes';
import { Edge } from '@xyflow/react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface WorkflowGenerationResponse {
  name?: string;
  nodes?: NodeDataRaw[];
  edges?: EdgeDataRaw[];
  error?: string | { message: string };
  message?: string;
}

interface NodeDataRaw {
  id?: string;
  type: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface EdgeDataRaw {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  [key: string]: unknown;
}

interface Requirement {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  description?: string;
  required?: boolean;
}

const HELP_TOPICS: Record<string, { title: string; steps: string[]; linkLabel: string; keywords: string[] }> = {
  sheet_url: {
    title: "How to get Google Sheet URL",
    linkLabel: "Sheet URL",
    keywords: ['sheet_url', 'google_sheet_url', 'spreadsheet_url', 'sheet url'],
    steps: [
      "Open your Google Sheet.",
      "Copy the full URL from the browser address bar.",
      "Make sure the sheet is accessible (e.g. valid permissions).",
      "Paste the URL into the input field."
    ]
  },
  sheet_name: {
    title: "How to get Sheet Name",
    linkLabel: "Sheet Name",
    keywords: ['sheet_name', 'sheet name', 'tab name'],
    steps: [
      "Open your Google Sheet.",
      "Look at the tabs at the bottom of the screen.",
      "The name is on the tab (e.g., 'Sheet1', 'Data').",
      "For multiple sheets, separate names with commas (e.g. 'Sheet1, Sheet2').",
      "Copy the exact name(s) and paste here."
    ]
  },
  slack: {
    title: "How to get Slack Webhook URL",
    linkLabel: "Webhook URL",
    keywords: ['slack', 'webhook', 'slack_webhook', 'webhook_url'],
    steps: [
      "Go to https://api.slack.com/apps.",
      "Create a new app or select an existing one.",
      "Click 'Incoming Webhooks' in the sidebar.",
      "Activate Incoming Webhooks.",
      "Click 'Add New Webhook to Workspace' and select a channel.",
      "Copy the Webhook URL."
    ]
  },
  api_key: {
    title: "How to get API Key",
    linkLabel: "API Key",
    keywords: ['api_key', 'api key', 'apikey', 'gemini_api_key', 'openai_api_key', 'claude_api_key'],
    // Note: This is a generic fallback. Provider-specific keys (pinecone, weaviate, etc.) should match their specific guides first.
    steps: [
      "Log in to the service provider's developer console.",
      "Navigate to API Keys or Credentials section.",
      "Generate or copy the existing API Key.",
      "⚠️ Copy the key immediately - you may not see it again!",
      "Paste it here securely.",
      "Keep your API key private and never share it publicly."
    ]
  },
  embedding_model_api_key: {
    title: "How to get Embedding Model API Key",
    linkLabel: "Embedding Model API Key",
    keywords: ['embedding_model_api_key', 'embedding_api_key', 'embedding model api key', 'embedding api key', 'embeddings api key', 'vector embedding api key'],
    steps: [
      "🔍 What are Embedding Models?",
      "  Embedding models convert text into numerical vectors (arrays of numbers) that AI systems can understand and search.",
      "  These vectors are stored in your vector database for fast similarity search.",
      "",
      "📌 Option 1: OpenAI Embeddings (Recommended)",
      "  1. Go to https://platform.openai.com/api-keys",
      "  2. Sign in or create a new account",
      "  3. Click 'Create new secret key' button",
      "  4. Give it a name (e.g., 'RAG Workflow Embeddings')",
      "  5. Copy the key immediately (starts with sk-...)",
      "  6. ⚠️ You won't see this key again - save it securely!",
      "  Supported models: text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large",
      "  Pricing: Pay-as-you-go, typically $0.0001 per 1K tokens",
      "",
      "📌 Option 2: Cohere Embeddings",
      "  1. Go to https://dashboard.cohere.com/api-keys",
      "  2. Sign in or create a new account",
      "  3. Navigate to 'API Keys' section",
      "  4. Click 'Create API Key'",
      "  5. Copy the key immediately (starts with co-...)",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  Supported models: embed-english-v3.0, embed-multilingual-v3.0",
      "  Pricing: Free tier available, then pay-as-you-go",
      "",
      "📌 Option 3: Google Gemini Embeddings",
      "  1. Go to https://aistudio.google.com/apikey",
      "  2. Sign in with your Google account",
      "  3. Click 'Create API Key'",
      "  4. Select or create a Google Cloud project",
      "  5. Copy the key immediately (starts with AIza...)",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  Supported models: text-embedding-004",
      "  Pricing: Free tier available (60 requests/minute)",
      "",
      "✅ Final Steps:",
      "  1. Copy the API key from your chosen provider",
      "  2. Paste it into the 'Embedding Model API Key' field",
      "  3. Keep your API key secure and never share it publicly",
      "  4. The same key will be used to convert your documents into embeddings"
    ]
  },
  llm_api_key: {
    title: "How to get LLM API Key",
    linkLabel: "LLM API Key",
    keywords: ['llm_api_key', 'llm api key', 'large language model api key', 'ai agent api key', 'chat model api key', 'ai model api key'],
    steps: [
      "🤖 What is an LLM API Key?",
      "  LLM (Large Language Model) API keys allow your AI Agent to process questions and generate answers.",
      "  In RAG workflows, the LLM uses retrieved context from your vector database to answer questions.",
      "",
      "📌 Option 1: OpenAI (GPT models) - Recommended",
      "  1. Go to https://platform.openai.com/api-keys",
      "  2. Sign in or create a new account",
      "  3. Click 'Create new secret key' button",
      "  4. Give it a name (e.g., 'RAG Workflow LLM')",
      "  5. Copy the key immediately (starts with sk-...)",
      "  6. ⚠️ You won't see this key again - save it securely!",
      "  Supported models: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo",
      "  Recommended: gpt-4o-mini (cost-effective) or gpt-4o (best quality)",
      "  Pricing: Pay-as-you-go, varies by model",
      "",
      "📌 Option 2: Anthropic (Claude models)",
      "  1. Go to https://console.anthropic.com/settings/keys",
      "  2. Sign in or create a new account",
      "  3. Click 'Create Key' button",
      "  4. Give it a name (e.g., 'RAG Workflow')",
      "  5. Copy the key immediately (starts with sk-ant-...)",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  Supported models: claude-3-5-sonnet, claude-3-opus, claude-3-haiku",
      "  Recommended: claude-3-5-sonnet (best balance) or claude-3-haiku (fastest)",
      "  Pricing: Pay-as-you-go, varies by model",
      "",
      "📌 Option 3: Google Gemini",
      "  1. Go to https://aistudio.google.com/apikey",
      "  2. Sign in with your Google account",
      "  3. Click 'Create API Key'",
      "  4. Select or create a Google Cloud project",
      "  5. Copy the key immediately (starts with AIza...)",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  Supported models: gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite",
      "  Recommended: gemini-2.5-flash (fast and cost-effective)",
      "  Pricing: Free tier available (60 requests/minute)",
      "",
      "✅ Final Steps:",
      "  1. Choose your preferred LLM provider",
      "  2. Copy the API key from your provider",
      "  3. Paste it into the 'AI Model API Key' or 'LLM API Key' field",
      "  4. Keep your API key secure and never share it publicly",
      "  5. This key will be used by the AI Agent to answer questions using your knowledge base"
    ]
  },
  vector_store_api_key: {
    title: "How to get Vector Store API Key",
    linkLabel: "Vector Store API Key",
    keywords: ['vector_store_api_key', 'vector store api key', 'vector database api key', 'pinecone api key', 'pinecone_api_key', 'weaviate api key', 'qdrant api key', 'pinecone', 'vector store'],
    steps: [
      "🗄️ What is a Vector Store?",
      "  Vector stores are specialized databases that store and search vector embeddings.",
      "  They enable fast similarity search to find relevant documents for RAG workflows.",
      "",
      "📌 Option 1: Pinecone (Recommended for beginners)",
      "  1. Go to https://www.pinecone.io/ and click 'Sign Up'",
      "  2. Create a free account (no credit card required for free tier)",
      "  3. Create a new project or select an existing one",
      "  4. Go to 'API Keys' in the left sidebar",
      "  5. Click 'Create API Key'",
      "  6. Give it a name (e.g., 'RAG Workflow')",
      "  7. Copy the API key immediately (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
      "  8. ⚠️ Save it securely - you won't see it again!",
      "  9. Also note your Environment (e.g., us-east-1-aws) - you'll need this for the URL field",
      "  Free tier: 1 index, 100K vectors, 1M queries/month",
      "",
      "📌 Option 2: Weaviate Cloud",
      "  1. Go to https://console.weaviate.cloud/ and sign up",
      "  2. Create a new cluster or select an existing one",
      "  3. Go to 'Cluster Details' → 'API Keys' tab",
      "  4. Click 'Create API Key'",
      "  5. Copy the API key immediately",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  7. Also note your Weaviate URL (e.g., https://xxxx.weaviate.network) - you'll need this",
      "  Free tier: Available with limitations",
      "",
      "📌 Option 3: Qdrant Cloud",
      "  1. Go to https://cloud.qdrant.io/ and sign up",
      "  2. Create a new cluster or select an existing one",
      "  3. Go to 'API Keys' section in cluster settings",
      "  4. Click 'Create API Key'",
      "  5. Copy the API key immediately",
      "  6. ⚠️ Save it securely - you won't see it again!",
      "  7. Also note your Qdrant URL (e.g., https://xxxx.qdrant.io) - you'll need this",
      "  Free tier: Available with limitations",
      "",
      "📌 Option 4: Supabase (pgvector) - If using Supabase",
      "  1. Use your existing Supabase project",
      "  2. No separate API key needed - uses your Supabase project credentials",
      "  3. Ensure pgvector extension is enabled in your database",
      "  4. Go to Database → Extensions → Enable 'vector' extension",
      "  This option uses your existing Supabase connection",
      "",
      "✅ Final Steps:",
      "  1. Choose your vector store provider",
      "  2. Copy the API key from your provider",
      "  3. Paste it into the 'Vector Store API Key' field",
      "  4. Keep your API key secure and never share it publicly",
      "  5. You'll also need to provide the URL/Environment and Index Name in separate fields"
    ]
  },
  vector_store_url: {
    title: "How to get Vector Store URL/Environment",
    linkLabel: "Vector Store URL/Environment",
    keywords: ['vector_store_url', 'vector store url', 'vector store environment', 'vector database url', 'pinecone environment', 'weaviate url', 'qdrant url'],
    steps: [
      "🌐 What is Vector Store URL/Environment?",
      "  This is the location/endpoint where your vector database is hosted.",
      "  Different providers use different formats (URL, environment name, etc.).",
      "",
      "📌 For Pinecone:",
      "  1. Log in to your Pinecone account at https://www.pinecone.io/",
      "  2. Go to your project dashboard",
      "  3. Look for 'Environment' in your project settings or API Keys section",
      "  4. The environment format is: us-east-1-aws, us-west-2-aws, eu-west-1-aws, etc.",
      "  5. Copy the environment name (e.g., 'us-east-1-aws')",
      "  6. Paste it into the 'Vector Store URL/Environment' field",
      "  Example: us-east-1-aws",
      "",
      "📌 For Weaviate Cloud:",
      "  1. Log in to https://console.weaviate.cloud/",
      "  2. Select your cluster",
      "  3. Go to 'Cluster Details'",
      "  4. Find the 'Cluster URL' or 'Endpoint'",
      "  5. Copy the full URL (e.g., https://xxxx.weaviate.network)",
      "  6. Paste it into the 'Vector Store URL/Environment' field",
      "  Example: https://my-cluster.weaviate.network",
      "",
      "📌 For Qdrant Cloud:",
      "  1. Log in to https://cloud.qdrant.io/",
      "  2. Select your cluster",
      "  3. Go to cluster settings or overview",
      "  4. Find the 'Cluster URL' or 'Endpoint'",
      "  5. Copy the full URL (e.g., https://xxxx.qdrant.io)",
      "  6. Paste it into the 'Vector Store URL/Environment' field",
      "  Example: https://my-cluster.qdrant.io",
      "",
      "📌 For Supabase (pgvector):",
      "  1. Go to your Supabase project dashboard",
      "  2. Go to 'Settings' → 'API'",
      "  3. Find your 'Project URL' (e.g., https://xxxx.supabase.co)",
      "  4. Copy the full URL",
      "  5. Paste it into the 'Vector Store URL/Environment' field",
      "  Example: https://abcdefgh.supabase.co",
      "",
      "✅ Important Notes:",
      "  • The format depends on your vector store provider",
      "  • For Pinecone: Use the environment name (e.g., us-east-1-aws)",
      "  • For Weaviate/Qdrant: Use the full cluster URL",
      "  • Make sure the URL/environment matches the region where your index is located"
    ]
  },
  vector_store_index: {
    title: "How to get Vector Store Index/Collection Name",
    linkLabel: "Vector Store Index/Collection Name",
    keywords: ['vector_store_index', 'vector store index', 'vector store collection', 'index name', 'collection name', 'pinecone index', 'weaviate collection', 'qdrant collection'],
    steps: [
      "📚 What is an Index/Collection?",
      "  An index (or collection) is a named container in your vector database where documents are stored.",
      "  Think of it as a 'table' or 'folder' where all your document embeddings will be saved.",
      "",
      "📌 For Pinecone:",
      "  1. Log in to your Pinecone account at https://www.pinecone.io/",
      "  2. Go to your project dashboard",
      "  3. Click on 'Indexes' in the left sidebar",
      "  4. If you have an existing index, copy its name",
      "  5. If you need to create a new index:",
      "     • Click 'Create Index'",
      "     • Give it a name (e.g., 'rag-knowledge-base')",
      "     • Select dimensions (e.g., 1536 for OpenAI, 768 for some models)",
      "     • Choose metric: 'cosine' (recommended) or 'euclidean'",
      "     • Click 'Create Index'",
      "  6. Copy the index name",
      "  7. Paste it into the 'Vector Store Index/Collection Name' field",
      "  Example: rag-knowledge-base",
      "",
      "📌 For Weaviate Cloud:",
      "  1. Log in to https://console.weaviate.cloud/",
      "  2. Select your cluster",
      "  3. Go to 'Schema' or 'Collections'",
      "  4. If you have an existing collection, copy its name",
      "  5. If you need to create a new collection:",
      "     • Click 'Create Collection' or 'Add Class'",
      "     • Give it a name (e.g., 'Document')",
      "     • Configure vectorizer settings if needed",
      "     • Click 'Create'",
      "  6. Copy the collection/class name",
      "  7. Paste it into the 'Vector Store Index/Collection Name' field",
      "  Example: Document",
      "",
      "📌 For Qdrant Cloud:",
      "  1. Log in to https://cloud.qdrant.io/",
      "  2. Select your cluster",
      "  3. Go to 'Collections'",
      "  4. If you have an existing collection, copy its name",
      "  5. If you need to create a new collection:",
      "     • Click 'Create Collection'",
      "     • Give it a name (e.g., 'documents')",
      "     • Set vector size (e.g., 1536 for OpenAI embeddings)",
      "     • Click 'Create'",
      "  6. Copy the collection name",
      "  7. Paste it into the 'Vector Store Index/Collection Name' field",
      "  Example: documents",
      "",
      "📌 For Supabase (pgvector):",
      "  1. Go to your Supabase project dashboard",
      "  2. Go to 'Table Editor'",
      "  3. Create a new table or use an existing one",
      "  4. The table name will be your 'index/collection name'",
      "  5. Make sure the table has a vector column with type 'vector'",
      "  6. Copy the table name",
      "  7. Paste it into the 'Vector Store Index/Collection Name' field",
      "  Example: document_embeddings",
      "",
      "✅ Important Notes:",
      "  • The index/collection name is case-sensitive",
      "  • Use lowercase with hyphens or underscores (e.g., 'rag-knowledge-base')",
      "  • If the index doesn't exist, the workflow may create it automatically (depending on provider)",
      "  • Make sure the dimensions match your embedding model (e.g., 1536 for OpenAI text-embedding-3)"
    ]
  },
  whatsapp: {
    title: "How to get WhatsApp API Details",
    linkLabel: "WhatsApp API Details",
    keywords: ['whatsapp', 'phone_number_id', 'whatsapp_access_token', 'whatsapp_phone', 'whatsapp_token', 'whatsapp_phone_number'],
    steps: [
      "Go to https://developers.facebook.com/.",
      "Create a Meta App or select existing one.",
      "Add WhatsApp product to your app.",
      "Go to WhatsApp > API Setup.",
      "Copy Phone Number ID and Access Token.",
      "Paste them into the input fields."
    ]
  },
  gemini: {
    title: "How to get Gemini API Key",
    linkLabel: "Gemini API Key",
    keywords: ['gemini', 'gemini_api', 'google_gemini'],
    steps: [
      "Go to https://aistudio.google.com/apikey.",
      "Click 'Create API Key'.",
      "Select or create a Google Cloud project.",
      "Copy the generated API key (starts with AIza...).",
      "Paste it here."
    ]
  },
  openai: {
    title: "How to get OpenAI API Key",
    linkLabel: "OpenAI API Key",
    keywords: ['openai', 'gpt', 'openai_api'],
    steps: [
      "Go to https://platform.openai.com/api-keys.",
      "Sign in or create an account.",
      "Click 'Create new secret key'.",
      "Copy the key (starts with sk-...).",
      "Paste it here."
    ]
  },
  claude: {
    title: "How to get Claude API Key",
    linkLabel: "Claude API Key",
    keywords: ['claude', 'anthropic', 'claude_api'],
    steps: [
      "Go to https://console.anthropic.com/settings/keys.",
      "Sign in or create an account.",
      "Click 'Create Key'.",
      "Copy the key (starts with sk-ant-...).",
      "Paste it here."
    ]
  },
  telegram: {
    title: "How to get Telegram Bot Token",
    linkLabel: "Telegram Bot Token",
    keywords: ['telegram', 'bot_token', 'telegram_token'],
    steps: [
      "Open Telegram and search for @BotFather.",
      "Start a chat and send /newbot command.",
      "Follow instructions to create your bot.",
      "Copy the bot token (format: 123456:ABC-DEF...).",
      "Paste it here."
    ]
  },
  discord: {
    title: "How to get Discord Webhook URL",
    linkLabel: "Discord Webhook URL",
    keywords: ['discord', 'discord_webhook'],
    steps: [
      "Open your Discord server.",
      "Go to Server Settings > Integrations > Webhooks.",
      "Click 'New Webhook'.",
      "Copy the Webhook URL.",
      "Paste it here."
    ]
  },
  email: {
    title: "How to get Email Configuration",
    linkLabel: "Email Details",
    keywords: ['email', 'resend', 'email_api'],
    steps: [
      "For Resend: Go to https://resend.com/api-keys.",
      "Sign up or log in to your account.",
      "Create an API key.",
      "Copy the API key.",
      "Paste it here."
    ]
  },
  twilio: {
    title: "How to get Twilio Credentials",
    linkLabel: "Twilio Credentials",
    keywords: ['twilio', 'twilio_account', 'twilio_token'],
    steps: [
      "Go to https://console.twilio.com/.",
      "Sign in or create an account.",
      "Find Account SID and Auth Token on dashboard.",
      "Copy both values.",
      "Paste them into the input fields."
    ]
  },
  google_doc: {
    title: "How to get Google Doc URL for Knowledge Base",
    linkLabel: "Google Doc URL/ID",
    keywords: ['google_doc', 'doc_url', 'document_id', 'doc id', 'google doc url', 'knowledge base', 'document url', 'google doc url for knowledge base'],
    steps: [
      "📋 Step 1: Open your Google Doc",
      "  • Navigate to https://docs.google.com/ in your web browser",
      "  • Open the document you want to use as your knowledge base",
      "  • Make sure the document contains the information you want the RAG system to access",
      "",
      "📋 Step 2: Check Document Permissions",
      "  • Click the 'Share' button in the top-right corner",
      "  • Ensure the document is accessible (either 'Anyone with the link' or shared with the service account)",
      "  • For private documents, you may need to share with a service account email",
      "",
      "📋 Step 3: Copy the Document URL",
      "  • Look at your browser's address bar",
      "  • The URL format is: https://docs.google.com/document/d/DOCUMENT_ID/edit",
      "  • Copy the ENTIRE URL from the address bar",
      "  • Example: https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit",
      "",
      "📋 Step 4: Extract Document ID (Optional)",
      "  • The Document ID is the long string between '/d/' and '/edit'",
      "  • From the example above, the ID would be: 1a2b3c4d5e6f7g8h9i0j",
      "  • You can paste either the full URL or just the Document ID",
      "",
      "📋 Step 5: Paste into the Input Field",
      "  • Paste the full URL or Document ID into the 'Google Doc URL for Knowledge Base' field",
      "  • The workflow will automatically extract the content from this document",
      "",
      "⚠️ Important Notes:",
      "  • The document must be accessible to the workflow service",
      "  • If the document is private, ensure proper sharing settings",
      "  • Large documents may take longer to process",
      "  • The document content will be converted to embeddings and stored in your vector database"
    ]
  },
  database: {
    title: "How to get Database Connection Details",
    linkLabel: "Database Details",
    keywords: ['database', 'postgres', 'mysql', 'mongodb', 'db_'],
    steps: [
      "Check your database provider's documentation.",
      "Find connection string or credentials.",
      "Extract host, port, database name, username, password.",
      "Enter each value in the corresponding fields."
    ]
  },
  aws_access_key_id: {
    title: "How to get AWS Access Key ID",
    linkLabel: "AWS Access Key ID",
    keywords: ['aws_access_key_id', 'access_key_id', 'aws access key', 'access key id', 'aws_access_key'],
    steps: [
      "Log in to the AWS Management Console at https://console.aws.amazon.com/.",
      "Click on your username in the top-right corner and select 'Security credentials'.",
      "Scroll down to the 'Access keys' section.",
      "Click 'Create access key' (or use an existing access key).",
      "Copy the 'Access key ID' (starts with 'AKIA...').",
      "Paste it into the input field. Keep your Secret Access Key secure!"
    ]
  },
  aws_secret_access_key: {
    title: "How to get AWS Secret Access Key",
    linkLabel: "AWS Secret Access Key",
    keywords: ['aws_secret_access_key', 'secret_access_key', 'aws secret key', 'secret access key', 'aws_secret'],
    steps: [
      "Log in to the AWS Management Console at https://console.aws.amazon.com/.",
      "Click on your username in the top-right corner and select 'Security credentials'.",
      "Scroll down to the 'Access keys' section.",
      "Click 'Create access key' (or view an existing access key).",
      "Copy the 'Secret access key' (you'll only see this once when creating a new key).",
      "Paste it into the input field. ⚠️ Keep this key secure and never share it publicly!"
    ]
  },
  aws_region: {
    title: "How to find AWS Region",
    linkLabel: "AWS Region",
    keywords: ['aws_region', 'region', 'aws region', 's3 region'],
    steps: [
      "Log in to the AWS Management Console at https://console.aws.amazon.com/.",
      "Look at the top-right corner of the console - the region is displayed (e.g., 'N. Virginia' = us-east-1).",
      "Or go to S3 service and check the region where your bucket is located.",
      "Common regions: us-east-1 (N. Virginia), us-west-2 (Oregon), eu-west-1 (Ireland), ap-southeast-1 (Singapore).",
      "Enter the region code (e.g., 'us-east-1', 'eu-west-1') into the input field."
    ]
  },
  s3_bucket_name: {
    title: "How to get S3 Bucket Name",
    linkLabel: "S3 Bucket Name",
    keywords: ['s3_bucket', 'bucket_name', 'bucket name', 's3 bucket', 'aws bucket'],
    steps: [
      "Log in to the AWS Management Console at https://console.aws.amazon.com/.",
      "Navigate to the S3 service (search for 'S3' in the services menu).",
      "You'll see a list of all your S3 buckets.",
      "Click on the bucket you want to use (or create a new one if needed).",
      "Copy the bucket name from the list or from the bucket details page.",
      "Paste it into the input field. Bucket names must be globally unique across all AWS accounts."
    ]
  },
  s3_destination_path: {
    title: "How to set S3 Destination Path",
    linkLabel: "S3 Destination Path",
    keywords: ['s3_destination_path', 's3_path', 's3 key', 'object key', 's3 destination', 'destination path'],
    steps: [
      "The S3 Destination Path is the folder/file path where files will be uploaded in your S3 bucket.",
      "This is like a file path, but uses forward slashes (/) as separators.",
      "Examples: 'uploads/' (uploads to 'uploads' folder), 'uploads/ftp/' (uploads to 'uploads/ftp' folder), 'data/file.txt' (specific file).",
      "If left empty, files will be uploaded to the root of the bucket.",
      "The path can include folders and file names. Folders don't need to exist - S3 will create them automatically.",
      "Enter the desired path (e.g., 'uploads/ftp/') or leave empty for root level."
    ]
  },
  twitter_api_key: {
    title: "How to get Twitter API Key",
    linkLabel: "Twitter API Key",
    keywords: ['twitter_api_key', 'twitter api key', 'api_key', 'api key', 'twitter_apikey', 'consumer key'],
    steps: [
      "Go to https://developer.twitter.com/ and sign in with your Twitter account.",
      "Navigate to the Developer Portal (or go to https://developer.twitter.com/en/portal/dashboard).",
      "Click on 'Projects & Apps' in the left sidebar.",
      "Select your app (or create a new app if you don't have one).",
      "Click on the 'Keys and tokens' tab.",
      "Under 'API Key and Secret', you'll see your 'API Key' (also called Consumer Key).",
      "Click 'Reveal' or 'Copy' to view and copy the API Key.",
      "Paste it into the input field. ⚠️ Keep this key secure!"
    ]
  },
  twitter_api_secret: {
    title: "How to get Twitter API Secret",
    linkLabel: "Twitter API Secret",
    keywords: ['twitter_api_secret', 'twitter api secret', 'api_secret', 'api secret', 'twitter_apisecret', 'consumer secret'],
    steps: [
      "Go to https://developer.twitter.com/ and sign in with your Twitter account.",
      "Navigate to the Developer Portal → Projects & Apps.",
      "Select your app and go to the 'Keys and tokens' tab.",
      "Under 'API Key and Secret', find the 'API Secret Key' (also called Consumer Secret).",
      "Click 'Reveal' to view the secret (you may need to enter your password).",
      "Copy the API Secret Key immediately.",
      "Paste it into the input field. ⚠️ You'll only see this once - save it securely!",
      "If you've lost it, click 'Regenerate' to create a new one (old key will stop working)."
    ]
  },
  twitter_access_token: {
    title: "How to get Twitter Access Token",
    linkLabel: "Twitter Access Token",
    keywords: ['twitter_access_token', 'twitter access token', 'twitter_token', 'twitter/x access token', 'x_access_token', 'x access token'],
    steps: [
      "Go to https://developer.twitter.com/ and sign in with your Twitter account.",
      "Navigate to the Developer Portal (or go to https://developer.twitter.com/en/portal/dashboard).",
      "Click on 'Projects & Apps' in the left sidebar.",
      "Select your app (or create a new app if you don't have one).",
      "Click on the 'Keys and tokens' tab.",
      "Scroll down to the 'Access Token and Secret' section.",
      "If you don't have tokens yet, click 'Generate' to create them.",
      "Copy the 'Access Token' (this is different from the API Key).",
      "Paste it into the input field. ⚠️ Keep this token secure!",
      "Note: You'll also need the Access Token Secret (separate field)."
    ]
  },
  twitter_access_token_secret: {
    title: "How to get Twitter Access Token Secret",
    linkLabel: "Twitter Access Token Secret",
    keywords: ['twitter_access_token_secret', 'twitter access token secret', 'twitter_token_secret', 'twitter/x access token secret', 'x_access_token_secret', 'x access token secret'],
    steps: [
      "Go to https://developer.twitter.com/ and sign in with your Twitter account.",
      "Navigate to the Developer Portal (or go to https://developer.twitter.com/en/portal/dashboard).",
      "Click on 'Projects & Apps' in the left sidebar.",
      "Select your app and go to the 'Keys and tokens' tab.",
      "Scroll down to the 'Access Token and Secret' section.",
      "If you don't have tokens yet, click 'Generate' to create them.",
      "Click 'Reveal' next to 'Access Token Secret' (you may need to enter your password).",
      "Copy the 'Access Token Secret' immediately.",
      "Paste it into the input field. ⚠️ You'll only see this once - save it securely!",
      "If you've lost it, click 'Regenerate' to create a new one (old token will stop working)."
    ]
  },
  linkedin_client_id: {
    title: "How to get LinkedIn Client ID",
    linkLabel: "LinkedIn Client ID",
    keywords: ['linkedin_client_id', 'linkedin client id', 'client_id', 'client id', 'linkedin_clientid'],
    steps: [
      "Go to https://www.linkedin.com/developers/apps and sign in with your LinkedIn account.",
      "Click 'Create app' to create a new app (or select an existing app).",
      "Fill in the app details: App name, Company LinkedIn Page, Privacy policy URL, etc.",
      "Accept the API Terms of Use and click 'Create app'.",
      "Once your app is created, you'll be on the app details page.",
      "Go to the 'Auth' tab in the top navigation.",
      "Under 'Application credentials', you'll see your 'Client ID'.",
      "Copy the Client ID and paste it into the input field.",
      "Note: You'll also need the Client Secret (separate field) to complete OAuth authentication."
    ]
  },
  linkedin_client_secret: {
    title: "How to get LinkedIn Client Secret",
    linkLabel: "LinkedIn Client Secret",
    keywords: ['linkedin_client_secret', 'linkedin client secret', 'client_secret', 'client secret', 'linkedin_clientsecret'],
    steps: [
      "Go to https://www.linkedin.com/developers/apps and sign in with your LinkedIn account.",
      "Select your app from the list (or create a new one if needed).",
      "Go to the 'Auth' tab in the top navigation.",
      "Under 'Application credentials', you'll see your 'Client Secret'.",
      "Click 'Show' or 'Reveal' to view the Client Secret (you may need to verify your identity).",
      "Copy the Client Secret immediately.",
      "Paste it into the input field. ⚠️ Keep this secret secure and never share it publicly!",
      "If you've lost it, you can generate a new one, but the old secret will stop working."
    ]
  },
  linkedin_access_token: {
    title: "How to get LinkedIn Access Token",
    linkLabel: "LinkedIn Access Token",
    keywords: ['linkedin_access_token', 'linkedin access token', 'linkedin_token', 'linkedin oauth token'],
    steps: [
      "Go to https://www.linkedin.com/developers/apps and sign in with your LinkedIn account.",
      "Select your app from the list.",
      "Go to the 'Auth' tab in the top navigation.",
      "Under 'OAuth 2.0 settings', make sure you've added the required redirect URLs.",
      "Scroll down to 'Authentication' section and click 'Generate token'.",
      "Select the scopes/permissions you need (e.g., 'w_member_social' for personal posts, 'w_organization_social' for company pages).",
      "Click 'Generate token' and authorize the app.",
      "Copy the generated Access Token immediately.",
      "Paste it into the input field. ⚠️ Note: This token expires after 60 days - you'll need to regenerate it.",
      "For production use, implement OAuth 2.0 flow to automatically refresh tokens."
    ]
  }
};

type Step = 'prompt' | 'analyzing' | 'config' | 'generating';

export default function AIWorkflowBuilder() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setNodes, setEdges, setWorkflowName, setWorkflowId, resetWorkflow } = useWorkflowStore();

  const [step, setStep] = useState<Step>('prompt');
  const [prompt, setPrompt] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [selectedHelp, setSelectedHelp] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    status: 'generating' | 'completed' | 'error';
    estimated_time_seconds: number;
    elapsed_time_seconds: number;
    progress_percentage: number;
    current_phase: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  // Continuous timer update while generating
  useEffect(() => {
    if (step !== 'generating' || !generationProgress) return;

    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (!prev || prev.status !== 'generating') return prev;
        
        // Increment elapsed time
        const newElapsed = prev.elapsed_time_seconds + 0.1;
        
        // Update progress percentage based on elapsed vs estimated time
        let newProgress = prev.progress_percentage;
        if (prev.estimated_time_seconds > 0) {
          const calculatedProgress = Math.min(95, Math.floor((newElapsed / prev.estimated_time_seconds) * 100));
          // Only update if it's higher (don't decrease progress)
          if (calculatedProgress > newProgress) {
            newProgress = calculatedProgress;
          }
        }
        
        return {
          ...prev,
          elapsed_time_seconds: Math.round(newElapsed * 10) / 10,
          progress_percentage: newProgress,
        };
      });
    }, 100); // Update every 100ms for smooth timer

    return () => clearInterval(interval);
  }, [step, generationProgress]);

  const analyzeRequirements = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow description',
        variant: 'destructive',
      });
      return;
    }

    setStep('analyzing');
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-workflow-requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : '',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to analyze requirements: ${response.status}`);
      }

      const data = await response.json();

      if (data.requirements && data.requirements.length > 0) {
        setRequirements(data.requirements);
        setStep('config');
      } else {
        // Even if no requirements, let's show a confirmation or at least not skip silently if the user wants verification. 
        // But per request "ask for required properties", if none, maybe we should just say "No extra config needed".
        // However, if the user explicitly wants the flow, let's show the config step but empty? 
        // Or better: Show a toast and stay on prompt, or just go to config with empty list?
        // Let's go to config step with empty list so user sees "No requirements found"
        setRequirements([]);
        setStep('config');

        toast({
          title: 'Analysis Complete',
          description: 'No specific configuration requirements detected.',
        });
      }
    } catch (error) {
      console.error('Analysis error:', error);
      // DO NOT auto-generate. Show error to user so they know analysis failed.
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze requirements',
        variant: 'destructive',
      });
      // Allow them to try again or skip manually if we add a "Skip" button later.
      // For now, staying on 'analyzing' might lock UI, so go back to 'prompt'
      setStep('prompt');
    }
  };

  const extractSheetIdFromUrl = (url: string): string | null => {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const generateWorkflow = async (finalConfig: Record<string, string>) => {
    setStep('generating');
    
    // Initialize progress immediately with estimated time
    const goalLower = prompt.toLowerCase();
    let estimatedTime = 15;
    const hasSheets = goalLower.includes('google sheet') || goalLower.includes('sheets');
    const hasDoc = goalLower.includes('google doc') || goalLower.includes('document');
    const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
    const hasSlack = goalLower.includes('slack');
    const integrations = [hasSheets, hasDoc, hasGmail, hasSlack].filter(Boolean).length;
    estimatedTime += integrations * 3;
    if (hasSheets) estimatedTime += 2;
    if (hasSheets && hasDoc) estimatedTime += 2;
    if (hasGmail && hasSlack) estimatedTime += 2;
    estimatedTime = Math.max(12, Math.min(45, estimatedTime));
    
    setGenerationProgress({
      status: 'generating',
      estimated_time_seconds: estimatedTime,
      elapsed_time_seconds: 0,
      progress_percentage: 0,
      current_phase: 'Initializing...',
    });

    // Process config to extract IDs if needed
    const processedConfig = { ...finalConfig };
    if (processedConfig['google_sheet_url']) {
      const extractedId = extractSheetIdFromUrl(processedConfig['google_sheet_url']);
      if (extractedId) {
        processedConfig['spreadsheetId'] = extractedId; // Key expected by generate-workflow
        processedConfig['google_sheet_id'] = extractedId; // Alias
      }
    }

    // Validate environment variables before making request
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration. Please check your environment variables.');
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication failed. Please try logging in again.');
      }

      const functionUrl = `${supabaseUrl}/functions/v1/generate-workflow`;

      // First, try to verify the function is accessible with a simple OPTIONS check
      // This helps diagnose deployment issues early
      try {
        const optionsCheck = await fetch(functionUrl, {
          method: 'OPTIONS',
          headers: {
            'apikey': supabaseKey,
          },
        }).catch(() => null);
        
        if (optionsCheck && !optionsCheck.ok && optionsCheck.status !== 200) {
          console.warn('OPTIONS preflight check failed, function might not be deployed');
        }
      } catch (e) {
        // Ignore OPTIONS check errors, we'll try the actual request anyway
        console.warn('OPTIONS check failed:', e);
      }

      // Helper function to make fetch request with timeout and retry
      const fetchWithRetry = async (
        url: string,
        options: RequestInit,
        retries = 3,
        timeout = 120000 // 2 minutes timeout
      ): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
          } catch (error: unknown) {
            clearTimeout(timeoutId);
            
            // Check if it's a network/CORS error
            // CORS errors typically show up as TypeError with "Failed to fetch"
            const isNetworkError = error instanceof TypeError && (
              error.message.includes('fetch') || 
              error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError') ||
              error.message.includes('Network request failed')
            );
            
            const isCorsError = error.message.includes('CORS') || 
                               error.message.includes('blocked') ||
                               error.message.includes('preflight') ||
                               error.message.includes('access control');
            
            if (isNetworkError || isCorsError) {
              // For network/CORS errors on first attempt, don't retry - immediately fall back to Supabase invoke
              // This avoids wasting time retrying fetch when CORS will always fail
              if (attempt === 1 && (isCorsError || isNetworkError)) {
                // Mark as network/CORS error so outer catch knows to use Supabase invoke immediately
                const networkError = new Error(isCorsError ? 'CORS_ERROR' : 'NETWORK_ERROR');
                (networkError as any).isCorsError = true;
                (networkError as any).isNetworkError = true;
                (networkError as any).originalError = error;
                throw networkError;
              }
              
              if (attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
                console.warn(`Request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              // Provide user-friendly error message
              if (isCorsError) {
                throw new Error(
                  'Network connection error. This might be due to:\n' +
                  '1. CORS configuration issue on the server\n' +
                  '2. Network connectivity problems\n' +
                  '3. Server is temporarily unavailable\n\n' +
                  'Please check your internet connection and try again. If the problem persists, contact support.'
                );
              }
              
              throw new Error(
                `Network error: ${error.message}. Please check your internet connection and try again.`
              );
            }
            
            // If it's an abort (timeout), provide specific message
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error(
                'Request timed out. The workflow generation is taking longer than expected. ' +
                'Please try again with a simpler workflow description.'
              );
            }
            
            throw error;
          }
        }
        
        throw new Error('Failed to connect to the server after multiple attempts. Please try again later.');
      };

      let responseData: WorkflowGenerationResponse;

      // PRIMARY METHOD: Use Supabase functions.invoke (handles CORS automatically, most reliable)
      // Skip streaming entirely to avoid CORS issues
      try {
        console.log('Attempting Supabase functions.invoke (primary method)...');
        
        // Use Supabase's built-in functions client with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout
        
        try {
          const { data, error: invokeError } = await supabase.functions.invoke('generate-workflow', {
            body: {
              prompt: prompt.trim(),
              config: processedConfig
            },
          });
          
          clearTimeout(timeoutId);
          
          if (invokeError) {
            // Stop the timer immediately on error
            setGenerationProgress(prev => prev ? { ...prev, status: 'error' } : null);
            
            // Check if it's a function not found or deployment issue
            if (invokeError.message?.includes('Function not found') || 
                invokeError.message?.includes('404') ||
                invokeError.message?.includes('Failed to send')) {
              console.warn('Supabase invoke failed, trying direct fetch as fallback:', invokeError.message);
              throw invokeError; // Will trigger fallback below
            }
            
            // Check for 429/quota errors in invoke error
            if (invokeError.message?.includes('429') || 
                invokeError.message?.includes('quota') || 
                invokeError.message?.includes('limit exceeded') ||
                invokeError.message?.includes('quota exceeded')) {
              throw new Error(
                `API Quota Exceeded\n\n` +
                `You have reached the free tier limit of 20 requests.\n\n` +
                `Please:\n` +
                `1. Wait a few minutes before trying again\n` +
                `2. Consider upgrading your API plan if you need more requests\n` +
                `3. Check the API pricing at https://ai.google.dev/pricing`
              );
            }
            
            // Check if it's a validation error (400 status with validation details)
            // Supabase invoke might return error with context
            if (invokeError.context || invokeError.message?.includes('validation') || invokeError.message?.includes('invalid')) {
              // Try to extract validation errors from context
              let validationDetails = '';
              if (invokeError.context) {
                try {
                  const context = typeof invokeError.context === 'string' ? JSON.parse(invokeError.context) : invokeError.context;
                  if (context.validationErrors) {
                    validationDetails = Array.isArray(context.validationErrors) 
                      ? context.validationErrors.slice(0, 3).join('\n• ')
                      : String(context.validationErrors);
                  } else if (context.details) {
                    validationDetails = context.details;
                  } else if (context.message) {
                    validationDetails = context.message;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
              
              if (validationDetails) {
                throw new Error(
                  `Workflow Validation Error\n\n` +
                  `The generated workflow contains errors:\n• ${validationDetails}\n\n` +
                  `Please try:\n` +
                  `1. Being more specific in your workflow description\n` +
                  `2. Mentioning the exact services you want to use (e.g., "Twitter", "LinkedIn")\n` +
                  `3. Describing the workflow steps more clearly\n` +
                  `4. Trying again with a simpler workflow`
                );
              }
            }
            
            throw invokeError;
          }
          
          // Convert the data to responseData
          responseData = data as WorkflowGenerationResponse;
          
          // Validate response
          if (!responseData || !responseData.nodes || !responseData.edges) {
            throw new Error('Invalid response from AI service - missing nodes or edges');
          }
          
          console.log('✅ Supabase invoke succeeded, got workflow data');
          // Successfully got data, skip to workflow processing below
          
        } catch (invokeError: unknown) {
          clearTimeout(timeoutId);
          
          // Stop the timer immediately on error
          setGenerationProgress(prev => prev ? { ...prev, status: 'error' } : null);
          
          // If Supabase invoke fails, try direct fetch as fallback
          const invokeErrorMessage = invokeError instanceof Error ? invokeError.message : 'Unknown error';
          console.warn('Supabase invoke failed, trying direct fetch fallback:', invokeErrorMessage);
          
          // Helper function to parse error response
          const parseErrorResponse = async (response: Response): Promise<string> => {
            try {
              const errorText = await response.text();
              // Try to parse as JSON
              try {
                const errorJson = JSON.parse(errorText);
                // Check for quota exceeded message
                if (errorJson.error && typeof errorJson.error === 'string') {
                  if (errorJson.error.includes('quota') || errorJson.error.includes('limit') || errorJson.error.includes('exceeded')) {
                    return errorJson.error;
                  }
                }
                // Include validation errors if present
                if (errorJson.validationErrors && Array.isArray(errorJson.validationErrors)) {
                  const validationMsg = errorJson.validationErrors.slice(0, 5).join('; ');
                  return errorJson.message || errorJson.error || `Validation failed: ${validationMsg}`;
                }
                // Include details if present
                if (errorJson.details) {
                  return errorJson.details;
                }
                if (errorJson.message) return errorJson.message;
                if (errorJson.error) return errorJson.error;
                return errorText;
              } catch {
                return errorText;
              }
            } catch {
              return response.statusText || 'Unknown error';
            }
          };
          
          try {
            // Fallback to direct fetch with proper headers
            const fallbackResponse = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': session ? `Bearer ${session.access_token}` : '',
                'apikey': supabaseKey,
              },
              body: JSON.stringify({
                prompt: prompt.trim(),
                config: processedConfig
              }),
            });
            
            if (!fallbackResponse.ok) {
              const errorMessage = await parseErrorResponse(fallbackResponse);
              
              // Handle 429 (rate limit/quota exceeded) specifically
              if (fallbackResponse.status === 429) {
                throw new Error(
                  `API Quota Exceeded\n\n` +
                  `${errorMessage}\n\n` +
                  `The free tier limit has been reached. Please:\n` +
                  `1. Wait a few minutes before trying again\n` +
                  `2. Consider upgrading your API plan if you need more requests\n` +
                  `3. Check the API pricing at https://ai.google.dev/pricing`
                );
              }
              
              // Handle 400 (validation errors) specifically
              if (fallbackResponse.status === 400) {
                // Try to parse the error response to get validation details
                try {
                  const errorText = await fallbackResponse.text();
                  const errorJson = JSON.parse(errorText);
                  
                  let validationDetails = '';
                  if (errorJson.validationErrors && Array.isArray(errorJson.validationErrors)) {
                    validationDetails = errorJson.validationErrors.slice(0, 3).join('\n• ');
                  } else if (errorJson.details) {
                    validationDetails = errorJson.details;
                  } else if (errorJson.message) {
                    validationDetails = errorJson.message;
                  } else {
                    validationDetails = errorMessage;
                  }
                  
                  throw new Error(
                    `Workflow Validation Error\n\n` +
                    `The generated workflow contains errors:\n• ${validationDetails}\n\n` +
                    `Please try:\n` +
                    `1. Being more specific in your workflow description\n` +
                    `2. Mentioning the exact services you want to use (e.g., "Twitter", "LinkedIn")\n` +
                    `3. Describing the workflow steps more clearly\n` +
                    `4. Trying again with a simpler workflow`
                  );
                } catch (parseError) {
                  // If parsing fails, use the original error message
                  throw new Error(`Server returned error: ${fallbackResponse.status} ${fallbackResponse.statusText}. ${errorMessage}`);
                }
              }
              
              throw new Error(`Server returned error: ${fallbackResponse.status} ${fallbackResponse.statusText}. ${errorMessage}`);
            }
            
            const fallbackData = await fallbackResponse.json();
            responseData = fallbackData as WorkflowGenerationResponse;
            
            if (!responseData || !responseData.nodes || !responseData.edges) {
              throw new Error('Invalid response from AI service - missing nodes or edges');
            }
            
            console.log('✅ Direct fetch fallback succeeded');
          } catch (fallbackError: unknown) {
            // Both invoke and fetch failed
            const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
            console.error('❌ Both Supabase invoke and direct fetch failed');
            console.error('Invoke error:', invokeErrorMessage);
            console.error('Fallback error:', fallbackErrorMessage);
            
            // Check for quota/429 errors in both error messages
            if (invokeErrorMessage.includes('429') || 
                invokeErrorMessage.includes('quota') || 
                invokeErrorMessage.includes('limit exceeded') ||
                invokeErrorMessage.includes('quota exceeded') ||
                fallbackErrorMessage.includes('429') ||
                fallbackErrorMessage.includes('quota') ||
                fallbackErrorMessage.includes('limit exceeded') ||
                fallbackErrorMessage.includes('Quota Exceeded')) {
              // Extract quota message if available
              let quotaMessage = '';
              try {
                const quotaMatch = (invokeErrorMessage + ' ' + fallbackErrorMessage).match(/quota exceeded[^.]*\./i) ||
                                  (invokeErrorMessage + ' ' + fallbackErrorMessage).match(/limit[^.]*\./i);
                if (quotaMatch) quotaMessage = quotaMatch[0];
              } catch {}
              
              throw new Error(
                `API Quota Exceeded\n\n` +
                `${quotaMessage || 'You have reached the free tier limit of 20 requests.'}\n\n` +
                `Please:\n` +
                `1. Wait a few minutes before trying again\n` +
                `2. Consider upgrading your API plan if you need more requests\n` +
                `3. Check the API pricing at https://ai.google.dev/pricing`
              );
            }
            
            // Provide helpful error message based on error type
            if (invokeErrorMessage.includes('Function not found') || invokeErrorMessage.includes('404')) {
              throw new Error(
                'The workflow generation service is not available.\n\n' +
                'Please ensure:\n' +
                '1. The Edge Function "generate-workflow" is deployed to Supabase\n' +
                '2. You have the correct Supabase project URL configured\n' +
                '3. Your network connection is working\n\n' +
                'To deploy the function, run:\n' +
                '  supabase functions deploy generate-workflow\n\n' +
                'Contact support if this issue persists.'
              );
            }
            
            if (invokeErrorMessage.includes('CORS') || 
                invokeErrorMessage.includes('blocked') ||
                invokeErrorMessage.includes('preflight') ||
                fallbackErrorMessage.includes('CORS') ||
                fallbackErrorMessage.includes('blocked') ||
                fallbackErrorMessage.includes('Failed to fetch')) {
              throw new Error(
                'Network connection failed due to CORS or network issues.\n\n' +
                'Please check:\n' +
                '1. Your internet connection is working\n' +
                '2. You\'re not behind a firewall or proxy blocking the request\n' +
                '3. The Edge Function is properly deployed\n' +
                '4. Your Supabase project URL is correct\n\n' +
                'Try:\n' +
                '1. Refreshing the page\n' +
                '2. Checking if the function is deployed: supabase functions list\n' +
                '3. Redeploying the function: supabase functions deploy generate-workflow\n' +
                '4. Contacting support if the problem persists'
              );
            }
            
            throw new Error(
              `Failed to generate workflow.\n\n` +
              `Error: ${invokeErrorMessage || fallbackErrorMessage}\n\n` +
              `Please try:\n` +
              `1. Refreshing the page\n` +
              `2. Checking your internet connection\n` +
              `3. Verifying the Edge Function is deployed\n` +
              `4. Contacting support if the problem persists`
            );
          }
        }
      } catch (error: unknown) {
        // This catch handles any errors from the outer try block
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Re-throw if it's already a formatted error message
        if (errorMessage.includes('The workflow generation service') ||
            errorMessage.includes('Network connection failed') ||
            errorMessage.includes('Failed to generate workflow')) {
          throw error;
        }
        
        // Otherwise, provide generic error
        throw new Error(
          `Failed to generate workflow: ${errorMessage}\n\n` +
          `Please try refreshing the page or contacting support.`
        );
      }
      
      // If we reach here, we have responseData from either invoke or fallback
      // Skip all the old streaming/response processing code - we already have the data
      
      // Validate we have responseData before proceeding
      if (!responseData || !responseData.nodes || !responseData.edges) {
        throw new Error('No workflow data received from server');
      }
      
      // We already have responseData from Supabase invoke or fallback
      // Skip all old streaming/response processing code
      // Go directly to workflow processing below

      const data = responseData;

      if (data && data.nodes && data.edges) {
        resetWorkflow();
        const workflowName = data.name || `AI Generated: ${prompt.substring(0, 50)}`;
        setWorkflowName(workflowName);

        const nodes: WorkflowNode[] = (data.nodes || []).map((nodeData: NodeDataRaw, index: number) => {
          // CRITICAL FIX: Replace email_resend with google_gmail (email_resend doesn't exist in node library)
          let nodeTypeId = nodeData.type;
          if (nodeTypeId === 'email_resend') {
            console.warn(`[AIWorkflowBuilder] Replacing email_resend with google_gmail for node ${nodeData.id}`);
            nodeTypeId = 'google_gmail';
            // Update config to match google_gmail format
            if (nodeData.config) {
              nodeData.config = {
                ...nodeData.config,
                operation: 'send',
                to: nodeData.config.to || '',
                subject: nodeData.config.subject || nodeData.config.subject || 'Message from Workflow',
                body: nodeData.config.body || nodeData.config.text || '',
              };
            }
          }
          
          // Backward compatibility: map old 'webhook_trigger_response' to new 'webhook'
          nodeTypeId = nodeTypeId === 'webhook_trigger_response' ? 'webhook' : nodeTypeId;
          const nodeType = NODE_TYPES.find(nt => nt.type === nodeTypeId);
          if (!nodeType) throw new Error(`Unknown node type: ${nodeData.type} (mapped to ${nodeTypeId})`);
          
          // Use the mapped type
          const finalType = nodeTypeId;
          
          // For form nodes, use 'form' type to render FormTriggerNode component
          // For all other nodes, use 'custom' type to render WorkflowNode component
          const nodeReactFlowType = finalType === 'form' ? 'form' : 'custom';
          
          // Ensure form nodes have proper default config
          let nodeConfig = { ...nodeType.defaultConfig, ...(nodeData.config || {}) };
          
          // If it's a form node, ensure it has proper form configuration
          if (finalType === 'form') {
            // Ensure form config has all required fields
            if (!nodeConfig.formTitle) {
              nodeConfig.formTitle = 'Form Submission';
            }
            if (!nodeConfig.formDescription) {
              nodeConfig.formDescription = '';
            }
            if (!Array.isArray(nodeConfig.fields)) {
              nodeConfig.fields = [];
            }
            if (!nodeConfig.submitButtonText) {
              nodeConfig.submitButtonText = 'Submit';
            }
            if (!nodeConfig.successMessage) {
              nodeConfig.successMessage = 'Thank you for your submission!';
            }
            if (!nodeConfig.redirectUrl) {
              nodeConfig.redirectUrl = '';
            }
            
            // If fields are provided, parse them (might be JSON string or array)
            if (nodeData.config?.fields) {
              let parsedFields: any[] = [];
              
              // Try to parse if it's a JSON string
              if (typeof nodeData.config.fields === 'string') {
                try {
                  parsedFields = JSON.parse(nodeData.config.fields);
                } catch (e) {
                  console.warn('Failed to parse form fields JSON string:', e);
                  parsedFields = [];
                }
              } else if (Array.isArray(nodeData.config.fields)) {
                parsedFields = nodeData.config.fields;
              }
              
              // Map fields to proper format
              if (parsedFields && parsedFields.length > 0) {
                nodeConfig.fields = parsedFields.map((field: any, fieldIndex: number) => ({
                  id: field.id || `field_${Date.now()}_${fieldIndex}`,
                  label: field.label || field.name || 'Field',
                  name: field.name || field.label?.toLowerCase().replace(/\s+/g, '_') || `field_${fieldIndex}`,
                  type: field.type || 'text',
                  required: field.required !== undefined ? field.required : true,
                  placeholder: field.placeholder || `Enter ${field.label || field.name || 'value'}`,
                  options: field.options || undefined,
                  defaultValue: field.defaultValue || undefined,
                }));
              }
            }
          }

          return {
            id: nodeData.id || `${nodeData.type}_${Date.now()}_${index}`,
            type: nodeReactFlowType,
            position: nodeData.position || { x: 250 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
            data: {
              label: nodeType.label,
              type: finalType,
              category: nodeType.category,
              icon: nodeType.icon,
              config: nodeConfig,
            },
          };
        });

        const edges: Edge[] = (data.edges || []).map((edgeData: EdgeDataRaw) => ({
          id: edgeData.id || `edge_${edgeData.source}_${edgeData.target}`,
          source: edgeData.source,
          target: edgeData.target,
          sourceHandle: edgeData.sourceHandle,
          targetHandle: edgeData.targetHandle,
          type: 'smoothstep',
        }));

        const workflowData = {
          name: workflowName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodes: nodes as unknown as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          edges: edges as unknown as any,
          user_id: user?.id,
          updated_at: new Date().toISOString(),
        };

        const { data: workflow, error: createError } = await supabase
          .from('workflows')
          .insert(workflowData)
          .select()
          .single();

        if (createError) throw createError;

        setWorkflowId(workflow.id);
        setNodes(nodes);
        setEdges(edges);
        setWorkflowName(workflowName);

        toast({
          title: 'Success',
          description: 'Workflow generated successfully!',
        });

        navigate(`/workflow/${workflow.id}`, { replace: true });
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (error: unknown) {
      console.error('Error generating workflow:', error);
      
      // Stop the timer immediately
      setGenerationProgress(null);
      
      let errorMessage = 'Failed to generate workflow. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Format error message for better display (toast doesn't handle newlines well)
      // Replace newlines with spaces and add bullet points where appropriate
      const formattedMessage = errorMessage
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' • ')
        .replace(/• •/g, '•') // Remove duplicate bullets
        .substring(0, 500); // Limit message length

      // Use a more specific title for quota errors
      const errorTitle = errorMessage.includes('Quota Exceeded') || errorMessage.includes('quota')
        ? 'API Quota Exceeded'
        : 'Error Generating Workflow';

      toast({
        title: errorTitle,
        description: formattedMessage,
        variant: 'destructive',
        duration: 15000, // Show for 15 seconds for quota errors so user can read it
      });
      
      // Reset progress state (already done above, but ensure it's reset)
      setGenerationProgress(null);
      setStep('prompt'); // Go back to start on error
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-3xl px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/workflows')}
          className="mb-4"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card className="overflow-hidden border-2 shadow-lg flex flex-col max-h-[90vh]">
          <CardHeader className="bg-muted/30 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step === 'config' ? 'bg-secondary/10' : 'bg-primary/10'}`}>
                {step === 'config' ? (
                  <Settings2 className="h-5 w-5 text-secondary" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">
                  {step === 'config' ? 'Configure Workflow' : 'AI Workflow Generator'}
                </CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {step === 'config'
                    ? 'Please provide the missing details to build your workflow'
                    : 'Describe your workflow and let AI create it automatically'
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-6 flex-1 overflow-y-auto min-h-0">
            {step === 'prompt' || step === 'analyzing' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-sm font-medium">Workflow Description</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Example: Read data from Google Sheet ID 12345 and send a Slack message..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none text-sm"
                    disabled={step === 'analyzing'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about triggers, processing steps, and outputs
                  </p>
                </div>
              </div>
            ) : step === 'config' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4 flex-shrink-0">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Prompt: </span>
                    "{prompt}"
                  </p>
                </div>

                <div className="grid gap-4 overflow-y-auto pr-2">
                  {requirements.map((req) => (
                    <div key={req.key} className="space-y-2">
                      <Label htmlFor={req.key} className="flex items-center gap-1">
                        {req.label}
                        {req.required && <span className="text-destructive">*</span>}
                      </Label>
                      <Input
                        id={req.key}
                        type={req.type === 'number' ? 'number' : 'text'}
                        placeholder={
                          req.key.includes('sheet_name')
                            ? "Enter sheet names separated by commas (e.g. Sheet1, Sheet2)"
                            : (req.description || `Enter ${req.label}`)
                        }
                        value={config[req.key] || ''}
                        onChange={(e) => handleConfigChange(req.key, e.target.value)}
                      />
                      {(() => {
                        // Find matching help topic by checking keywords
                        // Prioritize more specific matches (more keyword matches = better match)
                        const searchText = `${req.key} ${req.label}`.toLowerCase();
                        
                        // Provider-specific guides that should take priority over generic ones
                        const providerSpecificGuides = ['vector_store_api_key', 'embedding_model_api_key', 'llm_api_key', 'vector_store_url', 'vector_store_index'];
                        
                        // Find all matches with their match scores
                        const matches = Object.entries(HELP_TOPICS)
                          .map(([helpKey, topic]) => {
                            const matchingKeywords = topic.keywords.filter(keyword => 
                              searchText.includes(keyword.toLowerCase())
                            );
                            const isProviderSpecific = providerSpecificGuides.includes(helpKey);
                            return {
                              helpKey,
                              topic,
                              score: matchingKeywords.length,
                              isProviderSpecific,
                              hasExactMatch: matchingKeywords.some(kw => 
                                searchText === kw.toLowerCase() || 
                                searchText.includes(` ${kw.toLowerCase()} `) ||
                                searchText.startsWith(`${kw.toLowerCase()} `) ||
                                searchText.endsWith(` ${kw.toLowerCase()}`)
                              )
                            };
                          })
                          .filter(match => match.score > 0)
                          .sort((a, b) => {
                            // Prioritize exact matches first
                            if (a.hasExactMatch && !b.hasExactMatch) return -1;
                            if (!a.hasExactMatch && b.hasExactMatch) return 1;
                            // Then prioritize provider-specific guides over generic ones
                            if (a.isProviderSpecific && !b.isProviderSpecific) return -1;
                            if (!a.isProviderSpecific && b.isProviderSpecific) return 1;
                            // Then prioritize by number of matching keywords
                            return b.score - a.score;
                          });

                        if (matches.length > 0) {
                          const { helpKey, topic } = matches[0];
                          return (
                            <div key={helpKey} className="flex justify-end mt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedHelp(helpKey)}
                                className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                              >
                                How to get {topic.linkLabel}?
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="text-center space-y-4 w-full max-w-md mx-auto">
                  <div>
                    <p className="text-lg font-medium">Generating your workflow...</p>
                    {generationProgress && (
                      <p className="text-sm text-muted-foreground mt-1">{generationProgress.current_phase}</p>
                    )}
                  </div>
                  
                  {/* Timer Display */}
                  {generationProgress ? (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary tabular-nums">
                            {Math.floor(generationProgress.elapsed_time_seconds)}s
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Elapsed</div>
                        </div>
                        <div className="text-muted-foreground">/</div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-muted-foreground tabular-nums">
                            ~{Math.ceil(generationProgress.estimated_time_seconds)}s
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Estimated</div>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out flex items-center justify-end pr-2"
                          style={{ width: `${generationProgress.progress_percentage}%` }}
                        >
                          {generationProgress.progress_percentage > 10 && (
                            <span className="text-[10px] font-medium text-primary-foreground">
                              {generationProgress.progress_percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Percentage */}
                      <div className="text-center">
                        <span className="text-sm font-medium text-foreground">
                          {generationProgress.progress_percentage}% Complete
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">Initializing workflow generation...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="bg-muted/10 flex justify-between pt-6 flex-shrink-0">
            {step === 'config' ? (
              <>
                <Button variant="ghost" onClick={() => setStep('prompt')}>
                  Back to Prompt
                </Button>
                <Button
                  onClick={() => generateWorkflow(config)}
                  className="gradient-primary text-primary-foreground min-w-[140px]"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate
                </Button>
              </>
            ) : step === 'prompt' || step === 'analyzing' ? (
              <div className="w-full flex justify-end">
                <Button
                  onClick={analyzeRequirements}
                  disabled={step === 'analyzing' || !prompt.trim()}
                  className="gradient-primary text-primary-foreground min-w-[140px]"
                >
                  {step === 'analyzing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Next
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </CardFooter>
        </Card>

        {step === 'prompt' && (
          <Card className="mt-4 border-l-4 border-l-primary/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Tips for Best Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-primary mt-0.5" />
                  <span>Specify the trigger type (webhook, schedule, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-primary mt-0.5" />
                  <span>Mention output actions (email, Slack, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-primary mt-0.5" />
                  <span>Describe data processing steps clearly</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-primary mt-0.5" />
                  <span>We'll ask for API keys/IDs in the next step!</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        <Sheet open={!!selectedHelp} onOpenChange={(open) => !open && setSelectedHelp(null)}>
          <SheetContent className="flex flex-col overflow-hidden">
            <SheetHeader className="flex-shrink-0 pb-4">
              <SheetTitle>{selectedHelp && HELP_TOPICS[selectedHelp]?.title}</SheetTitle>
              <SheetDescription>
                Follow these steps to get the required information.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 pb-4">
              <div className="space-y-4">
                {selectedHelp && HELP_TOPICS[selectedHelp]?.steps
                  .filter(step => step.trim().length > 0)
                  .map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </div>
                      <p className="text-sm text-muted-foreground pt-0.5 flex-1 whitespace-pre-wrap">{step}</p>
                </div>
              ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

