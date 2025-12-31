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
    steps: [
      "Log in to the service provider's developer console.",
      "Navigate to API Keys or Credentials section.",
      "Generate or copy the existing API Key.",
      "Paste it here."
    ]
  },
  whatsapp: {
    title: "How to get WhatsApp API Details",
    linkLabel: "WhatsApp API Details",
    keywords: ['whatsapp', 'phone_number_id', 'access_token', 'whatsapp_phone', 'whatsapp_token'],
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
    title: "How to get Google Doc URL/ID",
    linkLabel: "Google Doc URL/ID",
    keywords: ['google_doc', 'doc_url', 'document_id', 'doc id'],
    steps: [
      "Open your Google Doc.",
      "Copy the full URL from the browser.",
      "Or extract the Document ID from the URL.",
      "Paste the URL or ID here."
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
                  return errorJson.error;
                }
                if (errorJson.message) return errorJson.message;
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

        <Card className="overflow-hidden border-2 shadow-lg flex flex-col max-h-[calc(100vh-8rem)]">
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

          <CardContent className="space-y-4 pt-6 flex-1 min-h-0 flex flex-col">
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
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 flex-1 min-h-0 flex flex-col">
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4 flex-shrink-0">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Prompt: </span>
                    "{prompt}"
                  </p>
                </div>

                <div className="grid gap-4 overflow-y-auto pr-2 flex-1 min-h-0">
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
                        // Prefer more specific matches (topics with more matching keywords)
                        const searchText = `${req.key} ${req.label}`.toLowerCase();
                        const allMatches = Object.entries(HELP_TOPICS)
                          .map(([helpKey, topic]) => {
                            const matchingKeywords = topic.keywords.filter(keyword => 
                              searchText.includes(keyword.toLowerCase())
                            );
                            return {
                              helpKey,
                              topic,
                              matchCount: matchingKeywords.length,
                              isExactMatch: matchingKeywords.length > 0
                            };
                          })
                          .filter(m => m.isExactMatch)
                          .sort((a, b) => b.matchCount - a.matchCount); // Sort by most matches first

                        const matchedHelp = allMatches[0];

                        if (matchedHelp) {
                          const [helpKey, topic] = [matchedHelp.helpKey, matchedHelp.topic];
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
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedHelp && HELP_TOPICS[selectedHelp]?.title}</SheetTitle>
              <SheetDescription>
                Follow these steps to get the required information.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {selectedHelp && HELP_TOPICS[selectedHelp]?.steps.map((step, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm text-muted-foreground pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

