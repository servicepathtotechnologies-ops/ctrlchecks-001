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
  hubspot_api_key: {
    title: "How to get HubSpot API Key",
    linkLabel: "HubSpot API Key",
    keywords: ['hubspot_api_key', 'hubspot api key', 'hubspot key', 'hubspot token', 'hubspot access token', 'hubspot private app', 'hubspot_apikey', 'hubspotapikey', 'hubspot_api', 'hubspot api'],
    steps: [
      "🔑 What is a HubSpot API Key?",
      "  HubSpot API Key (also called Private App Access Token) allows your workflow to connect to your HubSpot account.",
      "  It's used to create, read, update, and delete contacts, companies, deals, and other HubSpot data.",
      "",
      "📋 Step 1: Log in to HubSpot",
      "  • Go to https://app.hubspot.com/",
      "  • Sign in with your HubSpot account credentials",
      "  • Make sure you have admin or appropriate permissions to create private apps",
      "",
      "📋 Step 2: Navigate to Private Apps",
      "  • Click on the 'Settings' icon (⚙️) in the top-right corner of your HubSpot account",
      "  • In the left sidebar, navigate to 'Integrations'",
      "  • Click on 'Private Apps' (or 'API key' in older HubSpot accounts)",
      "  • Note: If you don't see 'Private Apps', you may need to enable it or have admin access",
      "",
      "📋 Step 3: Create a New Private App",
      "  • Click the 'Create a private app' button (or 'Create app' button)",
      "  • You'll be taken to the app creation page",
      "",
      "📋 Step 4: Configure Your Private App",
      "  • Enter a name for your app (e.g., 'Workflow Integration', 'Automation App')",
      "  • Add a description (optional but recommended): 'For workflow automation and CRM integration'",
      "  • Click 'Next' or 'Continue'",
      "",
      "📋 Step 5: Set Scopes (Permissions)",
      "  • This is CRITICAL - you must grant the necessary permissions for your workflow to work",
      "  • Select the scopes your workflow needs. Common scopes include:",
      "    ✅ 'crm.objects.contacts.read' - Read contacts",
      "    ✅ 'crm.objects.contacts.write' - Create/update contacts",
      "    ✅ 'crm.objects.companies.read' - Read companies",
      "    ✅ 'crm.objects.companies.write' - Create/update companies",
      "    ✅ 'crm.objects.deals.read' - Read deals",
      "    ✅ 'crm.objects.deals.write' - Create/update deals",
      "    ✅ 'crm.objects.tickets.read' - Read tickets",
      "    ✅ 'crm.objects.tickets.write' - Create/update tickets",
      "    ✅ 'crm.schemas.contacts.read' - Read contact properties",
      "    ✅ 'crm.schemas.companies.read' - Read company properties",
      "  • For lead management workflows, you typically need:",
      "    - Contacts read/write permissions",
      "    - Companies read/write permissions (if storing company data)",
      "    - Deals read/write permissions (if creating deals)",
      "  • Select all scopes your workflow will need",
      "  • Click 'Next' or 'Continue'",
      "",
      "📋 Step 6: Review and Create",
      "  • Review your app configuration and selected scopes",
      "  • Make sure all required permissions are selected",
      "  • Click 'Create app' or 'Create private app'",
      "",
      "📋 Step 7: Copy Your Access Token",
      "  • After creating the app, you'll see the 'Access Token' or 'API Key'",
      "  • The token will look like: 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'",
      "  • ⚠️ CRITICAL: Copy the token IMMEDIATELY - you won't be able to see it again!",
      "  • Click the 'Copy' button or manually select and copy the entire token",
      "  • If you close this page without copying, you'll need to regenerate the token",
      "",
      "📋 Step 8: Paste into Workflow",
      "  • Paste the copied access token into the 'HubSpot API Key' field",
      "  • Make sure you copied the entire token (it's a long string)",
      "  • The token should start with 'pat-' (Private App Token)",
      "",
      "✅ Important Notes:",
      "  • Token Format: HubSpot Private App tokens start with 'pat-' followed by your account region",
      "    - 'pat-na1-...' for North America accounts",
      "    - 'pat-eu1-...' for European accounts",
      "  • Security:",
      "    - Keep your access token secure and never share it publicly",
      "    - Don't commit it to version control (Git, etc.)",
      "    - If you suspect it's compromised, regenerate it immediately",
      "  • Permissions:",
      "    - Make sure you selected all required scopes for your workflow",
      "    - If your workflow fails with permission errors, you may need to add more scopes",
      "    - You can edit scopes later by going back to the Private App settings",
      "  • Regenerating Token:",
      "    - If you lose your token, go back to Private Apps → Select your app → 'Regenerate token'",
      "    - Regenerating will invalidate the old token, so update it in all places where it's used",
      "  • Testing:",
      "    - After adding the token, test your workflow to ensure it can connect to HubSpot",
      "    - Check HubSpot logs if you encounter authentication errors",
      "",
      "🔧 Troubleshooting:",
      "  • 'Invalid API key' error:",
      "    - Make sure you copied the entire token (no spaces before/after)",
      "    - Verify the token starts with 'pat-'",
      "    - Try regenerating the token",
      "  • 'Insufficient permissions' error:",
      "    - Go back to Private Apps → Edit your app → Add the missing scopes",
      "    - Save the changes and try again",
      "  • 'Token not found' error:",
      "    - The token may have been deleted or regenerated",
      "    - Create a new private app or regenerate the token",
      "",
      "📚 Additional Resources:",
      "  • HubSpot Private Apps Documentation: https://developers.hubspot.com/docs/api/working-with-private-apps",
      "  • HubSpot API Scopes Reference: https://developers.hubspot.com/scopes",
      "  • HubSpot Support: https://knowledge.hubspot.com/"
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
  },
  postgresql_host: {
    title: "How to get PostgreSQL Host",
    linkLabel: "PostgreSQL Host",
    keywords: ['postgresql_host', 'postgresql host', 'postgres host', 'database host', 'db host', 'host'],
    steps: [
      "The PostgreSQL host is the server address where your database is running.",
      "For local databases: Use 'localhost' or '127.0.0.1'",
      "For cloud databases (AWS RDS, Google Cloud SQL, Azure, etc.):",
      "  • Check your cloud provider's database dashboard",
      "  • Look for 'Endpoint', 'Host', or 'Connection String'",
      "  • Example format: 'your-db-instance.xxxxx.us-east-1.rds.amazonaws.com'",
      "For managed PostgreSQL services (Heroku, DigitalOcean, etc.):",
      "  • Check your service dashboard → Database settings",
      "  • Copy the hostname from the connection string",
      "  • Usually in format: 'hostname.provider.com' or an IP address",
      "Enter the host address (without 'postgresql://' or port number) into the input field."
    ]
  },
  postgresql_port: {
    title: "How to get PostgreSQL Port",
    linkLabel: "PostgreSQL Port",
    keywords: ['postgresql_port', 'postgresql port', 'postgres port', 'database port', 'db port', 'port'],
    steps: [
      "The PostgreSQL port is the network port your database server listens on.",
      "Default PostgreSQL port is 5432 (most common).",
      "For most databases, use the default: 5432",
      "If using a custom port:",
      "  • Check your database server configuration",
      "  • Look in postgresql.conf file (port setting)",
      "  • Check your cloud provider's database settings",
      "  • Some managed services use different ports (check documentation)",
      "Common ports:",
      "  • 5432 - Standard PostgreSQL port",
      "  • 5433 - Alternative port (if 5432 is in use)",
      "Enter the port number (usually 5432) into the input field."
    ]
  },
  postgresql_database: {
    title: "How to get PostgreSQL Database Name",
    linkLabel: "PostgreSQL Database Name",
    keywords: ['postgresql_database', 'postgresql database', 'postgresql database name', 'postgres database', 'database name', 'db name'],
    steps: [
      "The database name is the specific database you want to connect to within your PostgreSQL server.",
      "To find your database name:",
      "  • Connect to your PostgreSQL server using psql or a database client",
      "  • Run: SELECT datname FROM pg_database; (lists all databases)",
      "  • Or check your application's database configuration",
      "For cloud/managed databases:",
      "  • Check your cloud provider's database dashboard",
      "  • Look for 'Database Name' in connection details",
      "  • It's usually the name you created when setting up the database",
      "Common database names:",
      "  • 'postgres' - Default database",
      "  • 'mydb' or 'appdb' - Custom application databases",
      "Enter the exact database name (case-sensitive) into the input field."
    ]
  },
  postgresql_username: {
    title: "How to get PostgreSQL Username",
    linkLabel: "PostgreSQL Username",
    keywords: ['postgresql_username', 'postgresql username', 'postgres username', 'database username', 'db username', 'username', 'user'],
    steps: [
      "The PostgreSQL username is the database user account for authentication.",
      "To find or create a username:",
      "  • Default superuser is usually 'postgres'",
      "  • Connect as superuser and run: SELECT usename FROM pg_user; (lists all users)",
      "  • To create a new user: CREATE USER myuser WITH PASSWORD 'mypassword';",
      "For cloud/managed databases:",
      "  • Check your cloud provider's database dashboard",
      "  • Look for 'Master Username' or 'Database User' in connection settings",
      "  • It's usually set when you first create the database instance",
      "Best practices:",
      "  • Use a dedicated user (not 'postgres' superuser) for applications",
      "  • Grant only necessary permissions to the user",
      "Enter the username (case-sensitive) into the input field."
    ]
  },
  postgresql_password: {
    title: "How to get PostgreSQL Password",
    linkLabel: "PostgreSQL Password",
    keywords: ['postgresql_password', 'postgresql password', 'postgres password', 'database password', 'db password', 'password'],
    steps: [
      "The PostgreSQL password is the authentication password for your database user.",
      "If you forgot your password:",
      "  • For local PostgreSQL: Reset via pg_hba.conf or command line",
      "  • For cloud/managed databases: Use your provider's password reset feature",
      "To set a new password:",
      "  • Connect as superuser: ALTER USER username WITH PASSWORD 'newpassword';",
      "  • Or use your cloud provider's dashboard → Database settings → Reset password",
      "For cloud/managed databases:",
      "  • Check your cloud provider's database dashboard",
      "  • Look for 'Master Password' or 'Database Password'",
      "  • You may need to reset it if you don't remember",
      "Security best practices:",
      "  • Use a strong, unique password",
      "  • Never share passwords publicly",
      "  • Consider using environment variables or secrets management",
      "Enter the password into the input field (it will be hidden for security)."
    ]
  },
  mysql_host: {
    title: "How to get MySQL Host",
    linkLabel: "MySQL Host",
    keywords: ['mysql_host', 'mysql host', 'mysql server', 'mysql server host', 'database host', 'db host', 'host', 'mysql_hostname', 'mysqlhost'],
    steps: [
      "🗄️ What is MySQL Host?",
      "  MySQL Host is the server address where your MySQL database is running.",
      "  It's the hostname or IP address you use to connect to your MySQL server.",
      "",
      "📋 Common MySQL Host Settings:",
      "",
      "  📌 Local MySQL Database:",
      "    • Host: 'localhost' or '127.0.0.1'",
      "    • Use this if MySQL is running on the same machine",
      "",
      "  📌 Cloud MySQL Databases:",
      "    • AWS RDS MySQL:",
      "      - Check AWS RDS Console → Your database instance",
      "      - Look for 'Endpoint' in the instance details",
      "      - Example: 'your-db-instance.xxxxx.us-east-1.rds.amazonaws.com'",
      "    • Google Cloud SQL:",
      "      - Check Google Cloud Console → SQL → Your instance",
      "      - Look for 'Public IP address' or 'Connection name'",
      "      - Example: 'your-project:region:instance-name'",
      "    • Azure Database for MySQL:",
      "      - Check Azure Portal → Your MySQL server",
      "      - Look for 'Server name' or 'Fully qualified domain name'",
      "      - Example: 'your-server.mysql.database.azure.com'",
      "",
      "  📌 Managed MySQL Services:",
      "    • Heroku: Check Heroku dashboard → Database settings → Host",
      "    • DigitalOcean: Check Managed Databases → Connection details → Host",
      "    • PlanetScale: Check your database → Connection strings → Host",
      "    • Aiven: Check your service → Overview → Hostname",
      "",
      "  📌 Self-Hosted MySQL:",
      "    • Use the server's IP address or domain name",
      "    • Example: '192.168.1.100' or 'mysql.yourdomain.com'",
      "    • Check with your system administrator or hosting provider",
      "",
      "📋 How to Find Your MySQL Host:",
      "  1. Check your database provider's dashboard or console",
      "  2. Look for 'Endpoint', 'Host', 'Hostname', or 'Connection String'",
      "  3. Check your application's database configuration file",
      "  4. Contact your hosting provider or IT administrator",
      "  5. For local databases, use 'localhost' or '127.0.0.1'",
      "",
      "✅ Enter the MySQL Host:",
      "  • Enter just the hostname or IP address (e.g., 'localhost' or 'your-db.example.com')",
      "  • Do NOT include 'mysql://' or 'http://'",
      "  • Do NOT include the port number (that goes in a separate field)",
      "  • Examples:",
      "    - localhost (for local database)",
      "    - your-db-instance.us-east-1.rds.amazonaws.com (for AWS RDS)",
      "    - 192.168.1.100 (for IP address)"
    ]
  },
  mysql_port: {
    title: "How to get MySQL Port",
    linkLabel: "MySQL Port",
    keywords: ['mysql_port', 'mysql port', 'port number', 'port', 'database port', 'db port', 'mysql_port_number', 'mysqlport'],
    steps: [
      "🔌 What is MySQL Port?",
      "  MySQL Port is the network port number your MySQL server listens on for connections.",
      "  The default MySQL port is 3306, which is used by most MySQL installations.",
      "",
      "📋 Common MySQL Ports:",
      "",
      "  📌 Port 3306 (Default) - MOST COMMON:",
      "    • This is the standard MySQL port",
      "    • Used by default in most MySQL installations",
      "    • Works for local, cloud, and managed MySQL databases",
      "    • Use this unless you've configured a custom port",
      "",
      "  📌 Custom Ports:",
      "    • Some hosting providers use different ports for security",
      "    • Check your provider's documentation",
      "    • Common alternatives: 3307, 33060, or other custom ports",
      "",
      "📋 How to Determine the Correct Port:",
      "",
      "  For Local MySQL:",
      "    • Default: 3306",
      "    • Check MySQL configuration file (my.cnf or my.ini)",
      "    • Look for 'port = 3306' setting",
      "",
      "  For Cloud MySQL (AWS RDS, Google Cloud SQL, Azure):",
      "    • Usually 3306 (default)",
      "    • Check your database instance settings in the cloud console",
      "    • Look for 'Port' in connection details",
      "",
      "  For Managed MySQL Services:",
      "    • Check your service dashboard → Connection details",
      "    • Look for 'Port' in the connection string",
      "    • Most services use 3306, but some may use custom ports",
      "",
      "  For Self-Hosted MySQL:",
      "    • Check MySQL configuration: SHOW VARIABLES LIKE 'port';",
      "    • Or check my.cnf file: grep 'port' /etc/mysql/my.cnf",
      "    • Default is usually 3306",
      "",
      "✅ Enter the MySQL Port:",
      "  • Enter just the port number (e.g., '3306')",
      "  • Do NOT include ':' or any other characters",
      "  • Most common: 3306 (default MySQL port)",
      "  • If unsure, try 3306 first - it's the standard port",
      "",
      "⚠️ Important Notes:",
      "  • Port 3306 is the standard and most commonly used",
      "  • Some firewalls may block port 3306 - check your network settings",
      "  • For security, some providers use non-standard ports",
      "  • Make sure the port matches what's configured on your MySQL server"
    ]
  },
  mysql_database: {
    title: "How to get MySQL Database Name",
    linkLabel: "MySQL Database Name",
    keywords: ['mysql_database', 'mysql database', 'mysql database name', 'database name', 'db name', 'database', 'mysql_db', 'mysqldatabase'],
    steps: [
      "📚 What is MySQL Database Name?",
      "  MySQL Database Name is the specific database you want to connect to within your MySQL server.",
      "  A MySQL server can have multiple databases, and you need to specify which one to use.",
      "",
      "📋 How to Find Your MySQL Database Name:",
      "",
      "  Method 1: Using MySQL Command Line:",
      "    • Connect to MySQL: mysql -u username -p",
      "    • Run: SHOW DATABASES; (lists all databases)",
      "    • Look for your database name in the list",
      "",
      "  Method 2: Using MySQL Workbench or phpMyAdmin:",
      "    • Open MySQL Workbench or phpMyAdmin",
      "    • Connect to your MySQL server",
      "    • Look at the left sidebar - you'll see a list of databases",
      "    • Your database name is listed there",
      "",
      "  Method 3: Check Your Application Configuration:",
      "    • Look in your application's config file (config.php, .env, etc.)",
      "    • Find the database name setting",
      "    • Common variable names: DB_NAME, database, dbname",
      "",
      "  Method 4: For Cloud/Managed Databases:",
      "    • Check your cloud provider's database dashboard",
      "    • Look for 'Database Name' in connection details",
      "    • It's usually the name you created when setting up the database",
      "",
      "📋 Common Database Names:",
      "  • 'mysql' - System database (don't use this for your application)",
      "  • 'information_schema' - System database (don't use)",
      "  • 'performance_schema' - System database (don't use)",
      "  • 'mydb', 'appdb', 'production' - Common application database names",
      "  • Your application name (e.g., 'wordpress', 'magento', 'custom_app')",
      "",
      "📋 For Database Backup Workflows:",
      "  • Enter the name of the database you want to back up",
      "  • This is the database that contains your data",
      "  • Example: If backing up a WordPress site, use 'wordpress' or your site's database name",
      "",
      "✅ Enter the MySQL Database Name:",
      "  • Enter the exact database name as it appears in MySQL",
      "  • Database names are case-sensitive on Linux/Unix systems",
      "  • Database names are case-insensitive on Windows systems",
      "  • Best practice: Use lowercase with underscores (e.g., 'my_database')",
      "  • Do NOT include quotes or special characters",
      "",
      "⚠️ Important Notes:",
      "  • Make sure the database exists before connecting",
      "  • You need appropriate permissions to access the database",
      "  • The database name must match exactly (case-sensitive on Linux)",
      "  • If the database doesn't exist, you may need to create it first"
    ]
  },
  mysql_username: {
    title: "How to get MySQL Username",
    linkLabel: "MySQL Username",
    keywords: ['mysql_username', 'mysql username', 'mysql user', 'database username', 'db username', 'username', 'user', 'mysql_user', 'mysqluser'],
    steps: [
      "👤 What is MySQL Username?",
      "  MySQL Username is the database user account used to authenticate and connect to your MySQL database.",
      "  It's different from your system username - it's a MySQL-specific user account.",
      "",
      "📋 Common MySQL Usernames:",
      "",
      "  📌 Default Superuser:",
      "    • 'root' - The default MySQL superuser (has all permissions)",
      "    • Usually created during MySQL installation",
      "    • ⚠️ Not recommended for applications (security risk)",
      "",
      "  📌 Application Users:",
      "    • Custom usernames created for specific applications",
      "    • Examples: 'appuser', 'webapp', 'wordpress', 'magento'",
      "    • ✅ Recommended: Use dedicated users for each application",
      "",
      "📋 How to Find or Create MySQL Username:",
      "",
      "  Method 1: Check Existing Users:",
      "    • Connect to MySQL as root: mysql -u root -p",
      "    • Run: SELECT user FROM mysql.user; (lists all users)",
      "    • Or: SELECT user, host FROM mysql.user; (shows users and their allowed hosts)",
      "",
      "  Method 2: Check Your Application Configuration:",
      "    • Look in your application's config file",
      "    • Find the database username setting",
      "    • Common variable names: DB_USER, username, dbuser",
      "",
      "  Method 3: For Cloud/Managed Databases:",
      "    • Check your cloud provider's database dashboard",
      "    • Look for 'Master Username', 'Database User', or 'Admin Username'",
      "    • It's usually set when you first create the database instance",
      "    • Examples:",
      "      - AWS RDS: Set during instance creation",
      "      - Google Cloud SQL: Set during instance creation",
      "      - Azure: Set during server creation",
      "",
      "  Method 4: Create a New User (if needed):",
      "    • Connect as root: mysql -u root -p",
      "    • Run: CREATE USER 'newuser'@'localhost' IDENTIFIED BY 'password';",
      "    • Grant permissions: GRANT ALL PRIVILEGES ON database_name.* TO 'newuser'@'localhost';",
      "    • Apply changes: FLUSH PRIVILEGES;",
      "",
      "📋 For Database Backup Workflows:",
      "  • Use a user that has SELECT and LOCK TABLES permissions",
      "  • The user needs read access to the database you're backing up",
      "  • Root user works but is not recommended for security",
      "",
      "✅ Enter the MySQL Username:",
      "  • Enter the username exactly as it appears in MySQL",
      "  • Usernames are case-sensitive",
      "  • Do NOT include quotes or special characters",
      "  • Common examples: 'root', 'appuser', 'backup_user'",
      "",
      "⚠️ Important Notes:",
      "  • Best practice: Use a dedicated user (not 'root') for applications",
      "  • Grant only necessary permissions to the user",
      "  • For backups, the user needs SELECT and LOCK TABLES permissions",
      "  • The username is case-sensitive in MySQL",
      "  • Make sure the user has access from the host you're connecting from"
    ]
  },
  mysql_password: {
    title: "How to get MySQL Password",
    linkLabel: "MySQL Password",
    keywords: ['mysql_password', 'mysql password', 'mysql pass', 'database password', 'db password', 'password', 'mysql_pass', 'mysqlpassword'],
    steps: [
      "🔐 What is MySQL Password?",
      "  MySQL Password is the authentication password for your MySQL user account.",
      "  It's used along with the MySQL Username to authenticate and connect to the database.",
      "",
      "⚠️ IMPORTANT SECURITY NOTE:",
      "  • Never share your MySQL password publicly",
      "  • Use strong, unique passwords",
      "  • If you suspect your password is compromised, change it immediately",
      "",
      "📋 How to Find or Reset MySQL Password:",
      "",
      "  Method 1: If You Know the Password:",
      "    • Use the password you set when creating the MySQL user",
      "    • Check your application's configuration file (.env, config.php, etc.)",
      "    • Look for password variables: DB_PASSWORD, password, dbpass",
      "",
      "  Method 2: For Cloud/Managed Databases:",
      "    • Check your cloud provider's database dashboard",
      "    • Look for 'Master Password', 'Database Password', or 'Admin Password'",
      "    • AWS RDS:",
      "      - Go to RDS Console → Your database instance",
      "      - Click 'Modify' → Change master password",
      "    • Google Cloud SQL:",
      "      - Go to SQL → Your instance → Users",
      "      - Click on user → Change password",
      "    • Azure:",
      "      - Go to Azure Portal → Your MySQL server",
      "      - Settings → Reset password",
      "",
      "  Method 3: Reset Password for Local MySQL (if forgotten):",
      "    • Stop MySQL service",
      "    • Start MySQL in safe mode: mysqld_safe --skip-grant-tables",
      "    • Connect: mysql -u root",
      "    • Run: ALTER USER 'username'@'localhost' IDENTIFIED BY 'newpassword';",
      "    • Restart MySQL normally",
      "    • ⚠️ This requires system administrator access",
      "",
      "  Method 4: Reset Password via MySQL Command:",
      "    • Connect as root: mysql -u root -p",
      "    • Run: ALTER USER 'username'@'localhost' IDENTIFIED BY 'newpassword';",
      "    • Or: SET PASSWORD FOR 'username'@'localhost' = PASSWORD('newpassword');",
      "    • Apply changes: FLUSH PRIVILEGES;",
      "",
      "📋 Password Requirements:",
      "  • MySQL passwords can be any length",
      "  • Use a mix of letters, numbers, and special characters for security",
      "  • Avoid common passwords like 'password', '123456', etc.",
      "  • Consider using a password manager to store passwords securely",
      "",
      "📋 For Database Backup Workflows:",
      "  • Use the password for a user with appropriate backup permissions",
      "  • The user needs SELECT and LOCK TABLES permissions",
      "  • Make sure the password is correct to avoid connection failures",
      "",
      "✅ Enter the MySQL Password:",
      "  • Paste the password exactly as it is",
      "  • Make sure there are no extra spaces before or after",
      "  • The password field is hidden for security (you won't see what you type)",
      "  • If copying from a password manager, ensure you copy the entire password",
      "",
      "⚠️ Important Notes:",
      "  • Passwords are case-sensitive",
      "  • Special characters in passwords may need to be URL-encoded in some cases",
      "  • If connection fails, double-check the password is correct",
      "  • Consider using environment variables or secrets management for production",
      "  • Never commit passwords to version control (Git, etc.)"
    ]
  },
  google_drive_folder_id: {
    title: "How to get Google Drive Folder ID",
    linkLabel: "Google Drive Folder ID",
    keywords: ['google_drive_folder_id', 'google drive folder id', 'drive folder id', 'folder id', 'gdrive folder', 'google drive folder', 'drive_folder_id', 'gdrivefolderid'],
    steps: [
      "📁 What is Google Drive Folder ID?",
      "  Google Drive Folder ID is a unique identifier for a specific folder in your Google Drive.",
      "  It's used to identify which folder files should be saved to or accessed from.",
      "",
      "📋 Step 1: Open Google Drive",
      "  • Go to https://drive.google.com/",
      "  • Sign in with your Google account",
      "  • Make sure you have access to the folder you want to use",
      "",
      "📋 Step 2: Navigate to Your Folder",
      "  • Browse to the folder where you want to save files",
      "  • Or create a new folder if needed:",
      "    - Click 'New' → 'Folder'",
      "    - Give it a name (e.g., 'Database Backups', 'Workflow Files')",
      "    - Click 'Create'",
      "",
      "📋 Step 3: Get the Folder ID from URL",
      "  • Click on the folder to open it",
      "  • Look at your browser's address bar",
      "  • The URL will look like:",
      "    https://drive.google.com/drive/folders/FOLDER_ID_HERE",
      "  • The Folder ID is the long string of letters, numbers, and characters after '/folders/'",
      "  • Example:",
      "    URL: https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p",
      "    Folder ID: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p",
      "",
      "📋 Step 4: Copy the Folder ID",
      "  • Select and copy the entire Folder ID from the URL",
      "  • It's usually 33 characters long (letters, numbers, and sometimes hyphens)",
      "  • Make sure you copy the complete ID (no spaces, no extra characters)",
      "",
      "📋 Alternative Method: Right-Click Method",
      "  • Right-click on the folder in Google Drive",
      "  • Select 'Get link' or 'Share'",
      "  • The link will contain the Folder ID",
      "  • Copy the ID from the link",
      "",
      "📋 For Database Backup Workflows:",
      "  • Create a dedicated folder for backups (e.g., 'MySQL Backups', 'Database Backups')",
      "  • Make sure the folder is accessible and has enough storage space",
      "  • The workflow will save backup files to this folder",
      "",
      "✅ Enter the Google Drive Folder ID:",
      "  • Paste the Folder ID into the input field",
      "  • The ID should be a long string of characters (usually 33 characters)",
      "  • Do NOT include the full URL, just the ID",
      "  • Do NOT include 'folders/' or any other text",
      "  • Example: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p",
      "",
      "⚠️ Important Notes:",
      "  • Folder ID is case-sensitive - copy it exactly",
      "  • Make sure the folder exists and you have access to it",
      "  • The folder must be accessible by the service account or user account used by the workflow",
      "  • If using a service account, share the folder with the service account email",
      "  • For shared folders, make sure you have 'Editor' or 'Viewer' permissions",
      "",
      "🔧 Troubleshooting:",
      "  • 'Folder not found' error:",
      "    - Verify the Folder ID is correct",
      "    - Make sure the folder exists and hasn't been deleted",
      "    - Check that you have access to the folder",
      "  • 'Permission denied' error:",
      "    - Make sure you have 'Editor' permissions on the folder",
      "    - If using a service account, share the folder with the service account email",
      "    - Check folder sharing settings",
      "  • 'Invalid folder ID' error:",
      "    - Double-check you copied the complete ID (no missing characters)",
      "    - Make sure there are no spaces or extra characters",
      "    - Try getting the Folder ID again from the URL",
      "",
      "📚 Additional Tips:",
      "  • You can create a dedicated folder structure for organization",
      "  • Example: 'Backups' → 'Database' → 'MySQL' (use the MySQL folder ID)",
      "  • Folder IDs don't change even if you rename the folder",
      "  • You can bookmark folders for easy access to their IDs"
    ]
  },
  postgresql_table: {
    title: "How to get PostgreSQL Table Name",
    linkLabel: "Table Name",
    keywords: ['postgresql_table', 'postgresql table', 'postgres table', 'table name', 'table', 'table name to clean'],
    steps: [
      "The table name is the name of the PostgreSQL table you want to query or modify.",
      "To find table names in your database:",
      "  • Connect to your PostgreSQL database",
      "  • Run: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
      "  • Or use: \\dt command in psql",
      "  • Or check your application's database schema/migrations",
      "Table naming conventions:",
      "  • Usually lowercase with underscores (e.g., 'user_profiles', 'order_items')",
      "  • Case-sensitive in PostgreSQL (use quotes for mixed case)",
      "  • Must match exactly as it appears in the database",
      "For the cleanup workflow:",
      "  • Enter the table name that contains records you want to delete",
      "  • Example: 'logs', 'sessions', 'temp_data', 'old_records'",
      "Enter the exact table name (case-sensitive) into the input field."
    ]
  },
  timestamp_column: {
    title: "How to get Timestamp Column for Age",
    linkLabel: "Timestamp Column for Age",
    keywords: ['timestamp_column', 'timestamp column', 'timestamp column for age', 'created_at', 'updated_at', 'date column', 'age column'],
    steps: [
      "The timestamp column is the date/time column used to determine record age.",
      "To find timestamp columns in your table:",
      "  • Connect to your PostgreSQL database",
      "  • Run: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'your_table';",
      "  • Look for columns with types: TIMESTAMP, TIMESTAMPTZ, DATE, or DATETIME",
      "Common timestamp column names:",
      "  • 'created_at' - When record was created",
      "  • 'updated_at' - When record was last updated",
      "  • 'deleted_at' - Soft delete timestamp",
      "  • 'timestamp' - Generic timestamp",
      "  • 'date_created', 'date_updated' - Alternative naming",
      "For the cleanup workflow:",
      "  • Choose the column that represents when records were created or last modified",
      "  • The workflow will delete records where this column's value is older than the specified days",
      "  • Example: If using 'created_at', records older than X days from 'created_at' will be deleted",
      "Enter the exact column name (case-sensitive, usually lowercase) into the input field."
    ]
  },
  records_older_than: {
    title: "How to set Records Older Than (Days)",
    linkLabel: "Records Older Than (Days)",
    keywords: ['records_older_than', 'records older than', 'older than days', 'days', 'age threshold', 'retention days'],
    steps: [
      "This field specifies how many days old records must be before they are deleted.",
      "How it works:",
      "  • The workflow calculates: Current Date - Timestamp Column Value",
      "  • If the difference is greater than this number of days, the record is deleted",
      "  • Example: If set to 30, records with timestamp older than 30 days will be deleted",
      "Choosing the right value:",
      "  • Consider your data retention policy",
      "  • Common values: 30 (1 month), 90 (3 months), 365 (1 year), 730 (2 years)",
      "  • For logs: Often 7-30 days",
      "  • For sessions: Often 1-7 days",
      "  • For audit trails: Often 90-365 days",
      "Best practices:",
      "  • Start with a conservative value (higher number) and adjust",
      "  • Test with a small number first to verify behavior",
      "  • Consider backing up data before deletion",
      "  • Document your retention policy",
      "Enter the number of days (e.g., 30, 90, 365) into the input field."
    ]
  },
  datadog_api_key: {
    title: "How to get Datadog API Key",
    linkLabel: "Datadog API Key",
    keywords: ['datadog_api_key', 'datadog api key', 'datadog apikey', 'apiKey', 'datadog'],
    steps: [
      "Log in to your Datadog account at https://app.datadoghq.com (or your regional site).",
      "Click on your profile icon in the top right corner.",
      "Select 'Organization Settings' from the dropdown menu.",
      "Navigate to 'API Keys' in the left sidebar.",
      "Click the 'New Key' button.",
      "Give your key a descriptive name (e.g., 'Workflow Integration').",
      "Click 'Create Key'.",
      "⚠️ IMPORTANT: Copy the API key immediately - you won't be able to see it again!",
      "The API key is a long alphanumeric string used for API authentication.",
      "Paste the key securely into the input field."
    ]
  },
  datadog_application_key: {
    title: "How to get Datadog Application Key",
    linkLabel: "Datadog Application Key",
    keywords: ['datadog_app_key', 'datadog application key', 'datadog appkey', 'appKey', 'application key', 'datadog app key'],
    steps: [
      "Log in to your Datadog account at https://app.datadoghq.com (or your regional site).",
      "Click on your profile icon in the top right corner.",
      "Select 'Organization Settings' from the dropdown menu.",
      "Navigate to 'Application Keys' in the left sidebar (different from API Keys).",
      "Click the 'New Key' button.",
      "Give your key a descriptive name (e.g., 'Workflow Integration').",
      "Click 'Create Key'.",
      "⚠️ IMPORTANT: Copy the Application Key immediately - you won't be able to see it again!",
      "Note: Application Key is different from API Key - you need BOTH for full API access.",
      "The Application Key provides additional permissions beyond the API Key.",
      "Paste the key securely into the input field."
    ]
  },
  datadog_site: {
    title: "How to get Datadog Site",
    linkLabel: "Datadog Site",
    keywords: ['datadog_site', 'datadog site', 'datadog region', 'site'],
    steps: [
      "The Datadog Site is the regional endpoint where your Datadog account is hosted.",
      "Check the URL when you log in to Datadog:",
      "  • If URL contains 'datadoghq.com' → Use 'datadoghq.com' (US)",
      "  • If URL contains 'datadoghq.eu' → Use 'datadoghq.eu' (EU)",
      "  • If URL contains 'us3.datadoghq.com' → Use 'us3.datadoghq.com' (US3)",
      "  • If URL contains 'us5.datadoghq.com' → Use 'us5.datadoghq.com' (US5)",
      "Alternatively, go to Organization Settings → API Keys → Your API key will show the site.",
      "Most users in the US use 'datadoghq.com' (default).",
      "Select the correct site from the dropdown to ensure API calls reach the right region."
    ]
  },
  shopify_store_url: {
    title: "How to get Shopify Store URL/Domain",
    linkLabel: "Shopify Store Domain",
    keywords: ['shopify_store_url', 'shopify store url', 'shopify store domain', 'shopify url', 'shop domain', 'shopify domain', 'store url', 'store domain', 'myshopify.com', 'shopdomain', 'shopify_store_domain'],
    steps: [
      "Log in to your Shopify Admin panel at https://admin.shopify.com.",
      "Once logged in, look at the URL in your browser's address bar.",
      "Your Shopify store URL will be in the format: your-store-name.myshopify.com",
      "You can also find it by:",
      "  • Going to Settings → General → Store details",
      "  • The 'Store address' field shows your myshopify.com domain",
      "Copy the entire domain (e.g., 'mystore.myshopify.com') - do NOT include 'https://' or 'www'",
      "Paste the domain exactly as it appears (e.g., 'your-shop.myshopify.com') into the input field."
    ]
  },
  shopify_access_token: {
    title: "How to get Shopify Admin API Access Token",
    linkLabel: "Shopify Admin API Access Token",
    keywords: ['shopify_access_token', 'shopify access token', 'shopify admin api', 'shopify admin api access token', 'shopify api token', 'shopify token', 'access token', 'admin api access token', 'shpat_', 'shopify_access_token'],
    steps: [
      "Log in to your Shopify Admin panel at https://admin.shopify.com.",
      "Navigate to Settings → Apps and sales channels.",
      "Click on 'Develop apps' (you may need to enable developer mode if this is your first time).",
      "Click 'Create an app' button.",
      "Give your app a name (e.g., 'Workflow Integration' or 'API Integration').",
      "Click 'Create app'.",
      "In the app configuration page, click 'Configure Admin API scopes'.",
      "Select the required API scopes based on your workflow needs:",
      "  • For orders: 'read_orders', 'write_orders'",
      "  • For inventory: 'read_inventory', 'write_inventory'",
      "  • For products: 'read_products', 'write_products'",
      "  • For customers: 'read_customers', 'write_customers'",
      "Click 'Save' to save the scopes.",
      "Go to the 'API credentials' tab.",
      "Click 'Install app' if prompted, then click 'Reveal token once' or 'Reveal token'.",
      "⚠️ IMPORTANT: Copy the Admin API access token immediately - it starts with 'shpat_' and you won't be able to see it again!",
      "The token looks like: shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "Paste the token securely into the input field.",
      "Note: Keep this token secure and never share it publicly. If you lose it, you'll need to generate a new one."
    ]
  },
  stripe_api_key: {
    title: "How to get Stripe API Key",
    linkLabel: "Stripe API Key",
    keywords: ['stripe_api_key', 'stripe api key', 'stripe key', 'stripe secret key', 'stripe secret', 'stripe_apikey', 'stripeapikey'],
    steps: [
      "💳 What is a Stripe API Key?",
      "  Stripe API keys are used to authenticate and process payments through Stripe's payment platform.",
      "  You'll need a Secret Key (starts with sk_test_ for test mode or sk_live_ for live mode).",
      "",
      "📋 Step 1: Log in to Stripe Dashboard",
      "  • Go to https://dashboard.stripe.com/",
      "  • Sign in with your Stripe account (or create one if you don't have an account)",
      "  • If you're new, you'll start in Test Mode (recommended for testing)",
      "",
      "📋 Step 2: Navigate to API Keys",
      "  • In the left sidebar, click on 'Developers'",
      "  • Then click on 'API keys' (or go directly to https://dashboard.stripe.com/apikeys)",
      "  • You'll see two sections: 'Publishable key' and 'Secret key'",
      "",
      "📋 Step 3: Get Your Secret Key",
      "  • Under 'Secret key', you'll see either:",
      "    - 'Reveal test key' button (for Test Mode)",
      "    - 'Reveal live key' button (for Live Mode)",
      "  • Click the 'Reveal' button to show your secret key",
      "  • The key will start with:",
      "    - sk_test_... (for Test Mode - use this for development/testing)",
      "    - sk_live_... (for Live Mode - use this for production)",
      "",
      "📋 Step 4: Copy the Key",
      "  • Click the 'Copy' button next to the revealed key",
      "  • Or manually select and copy the entire key",
      "  • ⚠️ IMPORTANT: Copy the key immediately - you may need to reveal it again if you close the page",
      "",
      "📋 Step 5: Paste into Workflow",
      "  • Paste the copied key into the 'Stripe API Key' field",
      "  • Make sure you copied the entire key (it's a long string)",
      "",
      "✅ Important Notes:",
      "  • Test Mode (sk_test_): Use for development and testing - no real charges are made",
      "  • Live Mode (sk_live_): Use for production - processes real payments",
      "  • Keep your secret key secure and never share it publicly or commit it to version control",
      "  • If you accidentally expose your key, regenerate it immediately in the Stripe dashboard",
      "  • The secret key is different from the publishable key - you need the SECRET key for server-side operations"
    ]
  },
  smtp_host: {
    title: "How to get SMTP Host",
    linkLabel: "SMTP Host",
    keywords: ['smtp_host', 'smtp host', 'smtp server', 'smtp server host', 'email host', 'mail host', 'smtp_hostname', 'smtphost'],
    steps: [
      "📧 What is SMTP Host?",
      "  SMTP (Simple Mail Transfer Protocol) Host is the server address used to send emails.",
      "  It's the hostname of your email provider's SMTP server.",
      "",
      "📋 Common SMTP Host Settings by Provider:",
      "",
      "  📌 Gmail / Google Workspace:",
      "    • SMTP Host: smtp.gmail.com",
      "    • SMTP Port: 587 (TLS) or 465 (SSL)",
      "    • Requires: App Password (not your regular Gmail password)",
      "",
      "  📌 Outlook / Microsoft 365:",
      "    • SMTP Host: smtp.office365.com",
      "    • SMTP Port: 587 (TLS)",
      "    • Requires: Your Microsoft account email and password",
      "",
      "  📌 Yahoo Mail:",
      "    • SMTP Host: smtp.mail.yahoo.com",
      "    • SMTP Port: 587 (TLS) or 465 (SSL)",
      "    • Requires: App Password (not your regular Yahoo password)",
      "",
      "  📌 SendGrid:",
      "    • SMTP Host: smtp.sendgrid.net",
      "    • SMTP Port: 587 (TLS) or 465 (SSL)",
      "    • Requires: SendGrid API Key as password",
      "",
      "  📌 Mailgun:",
      "    • SMTP Host: smtp.mailgun.org",
      "    • SMTP Port: 587 (TLS) or 465 (SSL)",
      "    • Requires: Mailgun SMTP credentials",
      "",
      "  📌 Amazon SES:",
      "    • SMTP Host: email-smtp.[region].amazonaws.com (e.g., email-smtp.us-east-1.amazonaws.com)",
      "    • SMTP Port: 587 (TLS) or 465 (SSL)",
      "    • Requires: AWS SMTP credentials",
      "",
      "📋 How to Find Your SMTP Host:",
      "  1. Check your email provider's documentation or support pages",
      "  2. Look in your email client settings (Outlook, Thunderbird, etc.)",
      "  3. Contact your email provider's support if unsure",
      "  4. For custom domains, check with your hosting provider or IT administrator",
      "",
      "✅ Enter the SMTP Host:",
      "  • Enter just the hostname (e.g., 'smtp.gmail.com')",
      "  • Do NOT include 'https://' or 'http://'",
      "  • Do NOT include the port number (that goes in a separate field)",
      "  • Example: smtp.gmail.com"
    ]
  },
  smtp_port: {
    title: "How to get SMTP Port",
    linkLabel: "SMTP Port",
    keywords: ['smtp_port', 'smtp port', 'email port', 'mail port', 'smtp_port_number', 'smtpport'],
    steps: [
      "🔌 What is SMTP Port?",
      "  SMTP Port is the network port number your email server uses for sending emails.",
      "  The port number depends on the encryption method (TLS, SSL, or unencrypted).",
      "",
      "📋 Common SMTP Ports:",
      "",
      "  📌 Port 587 (TLS/STARTTLS) - RECOMMENDED:",
      "    • Most modern email providers use this port",
      "    • Uses TLS encryption (secure)",
      "    • Works with most firewalls",
      "    • Used by: Gmail, Outlook, Yahoo, SendGrid, Mailgun, Amazon SES",
      "",
      "  📌 Port 465 (SSL):",
      "    • Legacy SSL encryption",
      "    • Still supported by many providers",
      "    • Used by: Gmail, Yahoo, some hosting providers",
      "",
      "  📌 Port 25:",
      "    • Unencrypted (not recommended)",
      "    • Often blocked by ISPs",
      "    • Only use if no other option is available",
      "",
      "📋 How to Determine the Correct Port:",
      "",
      "  For Gmail:",
      "    • Use 587 (TLS) - Recommended",
      "    • Or 465 (SSL) - Alternative",
      "",
      "  For Outlook / Microsoft 365:",
      "    • Use 587 (TLS)",
      "",
      "  For Yahoo:",
      "    • Use 587 (TLS) - Recommended",
      "    • Or 465 (SSL) - Alternative",
      "",
      "  For SendGrid:",
      "    • Use 587 (TLS) - Recommended",
      "    • Or 465 (SSL) - Alternative",
      "",
      "  For Mailgun:",
      "    • Use 587 (TLS) - Recommended",
      "    • Or 465 (SSL) - Alternative",
      "",
      "  For Amazon SES:",
      "    • Use 587 (TLS) - Recommended",
      "    • Or 465 (SSL) - Alternative",
      "",
      "  For Custom/Other Providers:",
      "    • Check your email provider's documentation",
      "    • Look in your email client settings",
      "    • Contact your provider's support",
      "",
      "✅ Enter the SMTP Port:",
      "  • Enter just the port number (e.g., '587' or '465')",
      "  • Do NOT include ':' or any other characters",
      "  • Most common: 587 (recommended for most providers)",
      "  • If unsure, try 587 first, then 465 if that doesn't work"
    ]
  },
  smtp_username: {
    title: "How to get SMTP Username",
    linkLabel: "SMTP Username",
    keywords: ['smtp_username', 'smtp username', 'smtp user', 'email username', 'mail username', 'smtp_user', 'smtpuser'],
    steps: [
      "👤 What is SMTP Username?",
      "  SMTP Username is the authentication username for your email account.",
      "  It's used to log in to the SMTP server to send emails.",
      "",
      "📋 SMTP Username by Provider:",
      "",
      "  📌 Gmail / Google Workspace:",
      "    • Username: Your full Gmail address (e.g., yourname@gmail.com)",
      "    • Password: Use an App Password (NOT your regular Gmail password)",
      "    • How to create App Password:",
      "      1. Go to your Google Account settings",
      "      2. Security → 2-Step Verification (must be enabled)",
      "      3. App passwords → Generate new app password",
      "      4. Use the generated 16-character password",
      "",
      "  📌 Outlook / Microsoft 365:",
      "    • Username: Your full email address (e.g., yourname@outlook.com)",
      "    • Password: Your Microsoft account password",
      "    • Note: If 2FA is enabled, you may need an app password",
      "",
      "  📌 Yahoo Mail:",
      "    • Username: Your full Yahoo email address (e.g., yourname@yahoo.com)",
      "    • Password: Use an App Password (NOT your regular Yahoo password)",
      "    • How to create App Password:",
      "      1. Go to Yahoo Account Security",
      "      2. Generate app password",
      "      3. Use the generated password",
      "",
      "  📌 SendGrid:",
      "    • Username: 'apikey' (literally the word 'apikey')",
      "    • Password: Your SendGrid API Key",
      "",
      "  📌 Mailgun:",
      "    • Username: Your Mailgun SMTP username (found in Mailgun dashboard)",
      "    • Password: Your Mailgun SMTP password",
      "",
      "  📌 Amazon SES:",
      "    • Username: Your AWS SMTP username (found in AWS SES console)",
      "    • Password: Your AWS SMTP password",
      "",
      "  📌 Custom Email Hosting:",
      "    • Username: Usually your full email address (e.g., yourname@yourdomain.com)",
      "    • Or sometimes just the part before @ (e.g., 'yourname')",
      "    • Check with your hosting provider or IT administrator",
      "",
      "✅ Enter the SMTP Username:",
      "  • Enter your email address or username exactly as required by your provider",
      "  • For Gmail/Outlook/Yahoo: Use your full email address",
      "  • For SendGrid: Use 'apikey' (the literal word)",
      "  • For custom hosting: Check your provider's documentation",
      "  • Make sure there are no extra spaces before or after"
    ]
  },
  smtp_password: {
    title: "How to get SMTP Password",
    linkLabel: "SMTP Password",
    keywords: ['smtp_password', 'smtp password', 'smtp pass', 'email password', 'mail password', 'smtp_pass', 'smtppassword'],
    steps: [
      "🔐 What is SMTP Password?",
      "  SMTP Password is the authentication password for your email account.",
      "  It's used along with the SMTP Username to authenticate with the email server.",
      "",
      "⚠️ IMPORTANT SECURITY NOTE:",
      "  • Never share your SMTP password publicly",
      "  • Use App Passwords when available (more secure than regular passwords)",
      "  • If you suspect your password is compromised, change it immediately",
      "",
      "📋 SMTP Password by Provider:",
      "",
      "  📌 Gmail / Google Workspace:",
      "    • You MUST use an App Password (NOT your regular Gmail password)",
      "    • Regular Gmail passwords won't work for SMTP",
      "    • How to create App Password:",
      "      1. Go to https://myaccount.google.com/",
      "      2. Click 'Security' in the left sidebar",
      "      3. Enable '2-Step Verification' if not already enabled",
      "      4. Under '2-Step Verification', click 'App passwords'",
      "      5. Select 'Mail' and 'Other (Custom name)'",
      "      6. Enter a name like 'Workflow Integration'",
      "      7. Click 'Generate'",
      "      8. Copy the 16-character password (it looks like: xxxx xxxx xxxx xxxx)",
      "      9. Paste it into the SMTP Password field (remove spaces or keep them, both work)",
      "",
      "  📌 Outlook / Microsoft 365:",
      "    • If 2FA is NOT enabled: Use your regular Microsoft account password",
      "    • If 2FA IS enabled: You need an App Password",
      "    • How to create App Password:",
      "      1. Go to https://account.microsoft.com/security",
      "      2. Click 'Advanced security options'",
      "      3. Under 'App passwords', click 'Create a new app password'",
      "      4. Copy the generated password",
      "      5. Use this password (not your regular password)",
      "",
      "  📌 Yahoo Mail:",
      "    • You MUST use an App Password (NOT your regular Yahoo password)",
      "    • How to create App Password:",
      "      1. Go to https://login.yahoo.com/account/security",
      "      2. Enable 'Two-step verification' if not enabled",
      "      3. Click 'Generate app password'",
      "      4. Select 'Mail' and your device",
      "      5. Copy the generated password",
      "",
      "  📌 SendGrid:",
      "    • Password: Your SendGrid API Key",
      "    • How to get:",
      "      1. Log in to SendGrid dashboard",
      "      2. Go to Settings → API Keys",
      "      3. Create a new API Key or use existing one",
      "      4. Copy the API key (starts with 'SG.')",
      "      5. Use this as your SMTP password",
      "",
      "  📌 Mailgun:",
      "    • Password: Your Mailgun SMTP password",
      "    • How to get:",
      "      1. Log in to Mailgun dashboard",
      "      2. Go to Sending → Domain Settings → SMTP credentials",
      "      3. Copy the SMTP password",
      "",
      "  📌 Amazon SES:",
      "    • Password: Your AWS SMTP password",
      "    • How to get:",
      "      1. Log in to AWS Console",
      "      2. Go to Amazon SES → SMTP Settings",
      "      3. Create SMTP credentials if you don't have them",
      "      4. Copy the SMTP password",
      "",
      "  📌 Custom Email Hosting:",
      "    • Password: Your email account password",
      "    • Or a specific SMTP password set by your hosting provider",
      "    • Check with your hosting provider or IT administrator",
      "",
      "✅ Enter the SMTP Password:",
      "  • Paste the password exactly as provided",
      "  • For App Passwords: You can include or remove spaces (both work)",
      "  • Make sure there are no extra spaces before or after",
      "  • The password field is hidden for security (you won't see what you type)"
    ]
  },
  sender_email: {
    title: "How to set Sender Email Address",
    linkLabel: "Sender Email Address",
    keywords: ['sender_email', 'sender email', 'from email', 'from_email', 'email_from', 'from address', 'sender address', 'email sender', 'from', 'sender'],
    steps: [
      "📮 What is Sender Email Address?",
      "  Sender Email Address is the 'From' email address that appears in emails you send.",
      "  This is the email address recipients will see as the sender of your emails.",
      "",
      "📋 Important Requirements:",
      "",
      "  ✅ Valid Email Format:",
      "    • Must be a valid email address format (e.g., yourname@example.com)",
      "    • Cannot contain spaces or special characters (except @ and .)",
      "",
      "  ✅ Must Match Your SMTP Account:",
      "    • For Gmail: Must be your Gmail address (the one you use for SMTP username)",
      "    • For Outlook: Must be your Outlook/Microsoft email address",
      "    • For Yahoo: Must be your Yahoo email address",
      "    • For SendGrid/Mailgun: Can be any verified email address in your account",
      "    • For custom hosting: Usually must match your SMTP username",
      "",
      "  ✅ Verified Email Address:",
      "    • Some providers (like SendGrid, Mailgun) require you to verify the sender email",
      "    • Unverified addresses may cause emails to be rejected or marked as spam",
      "",
      "📋 Format Options:",
      "",
      "  Option 1: Simple Email Address",
      "    • Format: yourname@example.com",
      "    • Example: john.doe@gmail.com",
      "    • Example: support@yourcompany.com",
      "",
      "  Option 2: Email with Display Name (Recommended)",
      "    • Format: Display Name <yourname@example.com>",
      "    • Example: John Doe <john.doe@gmail.com>",
      "    • Example: Support Team <support@yourcompany.com>",
      "    • Recipients will see 'John Doe' as the sender name",
      "",
      "📋 Examples by Use Case:",
      "",
      "  For Personal Gmail:",
      "    • yourname@gmail.com",
      "    • Or: Your Name <yourname@gmail.com>",
      "",
      "  For Business/Company:",
      "    • support@yourcompany.com",
      "    • Or: Support Team <support@yourcompany.com>",
      "    • Or: noreply@yourcompany.com (for automated emails)",
      "",
      "  For Transactional Emails:",
      "    • receipts@yourcompany.com",
      "    • Or: Receipts <receipts@yourcompany.com>",
      "",
      "  For Notifications:",
      "    • notifications@yourcompany.com",
      "    • Or: Notifications <notifications@yourcompany.com>",
      "",
      "✅ Enter the Sender Email Address:",
      "  • Enter your email address (e.g., yourname@gmail.com)",
      "  • Or use format with display name: Your Name <yourname@gmail.com>",
      "  • Make sure it matches the email account you're using for SMTP",
      "  • For Gmail/Outlook/Yahoo: Use the same email as your SMTP username",
      "  • For SendGrid/Mailgun: Use a verified email address from your account",
      "",
      "⚠️ Important Notes:",
      "  • The sender email must be authorized to send from your SMTP server",
      "  • Using a different email than your SMTP account may cause authentication failures",
      "  • Some email providers block emails if the sender doesn't match the authenticated account",
      "  • For best deliverability, use a verified domain email address (e.g., @yourcompany.com)"
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 py-6 flex flex-col">
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

          <CardFooter className="bg-muted/10 flex justify-between pt-6 border-t flex-shrink-0">
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

