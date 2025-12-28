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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-workflow`;

      let response: Response;
      let responseData: WorkflowGenerationResponse;

      try {
        // Try streaming first, fallback to regular if it fails
        let useStreaming = true;
        let response: Response;
        
        try {
          response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session ? `Bearer ${session.access_token}` : '',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
              'x-stream-progress': 'true', // Request streaming progress
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              config: processedConfig
            }),
          });
        } catch (fetchError) {
          // If streaming fails due to CORS or other issues, retry without streaming
          console.warn('Streaming request failed, falling back to regular request:', fetchError);
          useStreaming = false;
          response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session ? `Bearer ${session.access_token}` : '',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              config: processedConfig
            }),
          });
        }

        // Handle streaming response
        if (useStreaming && response.body) {
          try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalWorkflow: any = null;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  const parsed = JSON.parse(line);
                  
                  // Handle progress updates
                  if (parsed.status === 'generating' || parsed.progress_percentage !== undefined) {
                    setGenerationProgress(parsed);
                    continue;
                  }
                  
                  // Handle completion
                  if (parsed.status === 'completed') {
                    if (parsed.workflow) {
                      finalWorkflow = parsed.workflow;
                    }
                    setGenerationProgress({
                      status: 'completed',
                      estimated_time_seconds: parsed.estimated_time_seconds || 0,
                      elapsed_time_seconds: parsed.elapsed_time_seconds || 0,
                      progress_percentage: 100,
                      current_phase: 'Completed',
                    });
                    if (parsed.workflow) {
                      break; // Only break if we have the workflow
                    }
                  }
                  
                  // Handle errors
                  if (parsed.status === 'error') {
                    throw new Error(parsed.error || 'Generation failed');
                  }
                } catch (parseError) {
                  // Skip invalid JSON lines
                  console.warn('Failed to parse progress line:', line, parseError);
                }
              }
            }

            if (finalWorkflow) {
              responseData = finalWorkflow;
            } else {
              throw new Error('No workflow received from server');
            }
          } catch (streamError) {
            // If streaming fails, fallback to regular response parsing
            console.warn('Streaming failed, falling back to regular response:', streamError);
            const responseText = await response.text();
            try {
              responseData = JSON.parse(responseText);
            } catch (parseError) {
              throw new Error('Failed to parse response from server');
            }
          }
        } else {
          // Fallback to non-streaming response
          // Show initial progress estimate
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
          
          const progressStartTime = Date.now();
          setGenerationProgress({
            status: 'generating',
            estimated_time_seconds: estimatedTime,
            elapsed_time_seconds: 0,
            progress_percentage: 0,
            current_phase: 'Initializing...',
          });
          
          // Simulate progress updates while waiting
          const progressInterval = setInterval(() => {
            setGenerationProgress(prev => {
              if (!prev) return null;
              const elapsed = (Date.now() - progressStartTime) / 1000;
              const progress = Math.min(95, Math.floor((elapsed / prev.estimated_time_seconds) * 100));
              return {
                ...prev,
                elapsed_time_seconds: Math.round(elapsed * 10) / 10,
                progress_percentage: progress,
                current_phase: progress < 20 ? 'Understanding & Planning' :
                              progress < 50 ? 'Workflow Design' :
                              progress < 75 ? 'Node Configuration' :
                              progress < 90 ? 'Validation & Simulation' :
                              'Final Optimization',
              };
            });
          }, 500);
          
          try {
            const responseText = await response.text();
            clearInterval(progressInterval);
            
            try {
              responseData = JSON.parse(responseText);
            } catch (parseError) {
              // If parsing fails, try to extract error message
              console.error('Failed to parse response:', parseError);
              responseData = { error: responseText || 'Invalid response from server' };
            }
          } catch (error) {
            clearInterval(progressInterval);
            throw error;
          }
        }

        if (!response.ok) {
          const errorMessage = responseData?.error
            ? (typeof responseData.error === 'string' ? responseData.error : responseData.error.message)
            : responseData?.message || `Server error: ${response.status}`;
          throw new Error(errorMessage);
        }
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error && fetchError.message) {
          throw fetchError;
        }
        throw new Error('Failed to generate workflow.');
      }

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

          return {
            id: nodeData.id || `${nodeData.type}_${Date.now()}_${index}`,
            type: 'custom',
            position: nodeData.position || { x: 250 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
            data: {
              label: nodeType.label,
              type: finalType,
              category: nodeType.category,
              icon: nodeType.icon,
              config: { ...nodeType.defaultConfig, ...(nodeData.config || {}) },
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
      let errorMessage = 'Failed to generate workflow. Please try again.';
      if (error instanceof Error) errorMessage = error.message;

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
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

        <Card className="overflow-hidden border-2 shadow-lg">
          <CardHeader className="bg-muted/30 pb-4">
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

          <CardContent className="space-y-4 pt-6">
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
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Prompt: </span>
                    "{prompt}"
                  </p>
                </div>

                <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
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
                        const matchedHelp = Object.entries(HELP_TOPICS).find(([_, topic]) => {
                          const searchText = `${req.key} ${req.label}`.toLowerCase();
                          return topic.keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
                        });

                        if (matchedHelp) {
                          const [helpKey, topic] = matchedHelp;
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

          <CardFooter className="bg-muted/10 flex justify-between pt-6">
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

