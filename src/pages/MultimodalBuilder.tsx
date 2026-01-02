import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import DynamicUIRenderer from '@/components/multimodal/DynamicUIRenderer';
import WorkflowVisualization from '@/components/multimodal/WorkflowVisualization';
import ModelTester from '@/components/multimodal/ModelTester';
import ImageProcessing from '@/components/multimodal/ImageProcessing';

interface LogItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

interface BuildResult {
  success: boolean;
  intent?: any;
  pipeline?: any;
  ui_template?: any;
  logs?: string[];
  execution_engine?: any;
  metadata?: any;
  error?: string;
}

export default function MultimodalBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'builder' | 'image-processing'>('builder');
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [uiTemplate, setUiTemplate] = useState<any>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const examples = [
    "Summarize this PDF and extract key points",
    "Generate an image of a futuristic city",
    "Convert speech to text and summarize",
    "Create a React login component",
    "Extract text from images and translate to Spanish",
    "Generate code from a description"
  ];

  const capabilities = [
    { icon: "📝", label: "Text Analysis" },
    { icon: "🎨", label: "Image Generation" },
    { icon: "🔊", label: "Speech Processing" },
    { icon: "💻", label: "Code Generation" },
    { icon: "📄", label: "Document Conversion" },
    { icon: "🔄", label: "File Transformation" }
  ];

  const addLog = (message: string, type: LogItem['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      message,
      type,
      timestamp: new Date()
    }]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleBuild = async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Prompt Required',
        description: 'Please describe what you want to build',
        variant: 'destructive'
      });
      return;
    }

    setIsBuilding(true);
    setLogs([]);
    setProgress(0);
    setUiTemplate(null);
    setBuildResult(null);

    try {
      // Convert files to base64 for transmission
      const fileData = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          data: await file.arrayBuffer().then(buf => 
            Array.from(new Uint8Array(buf))
          )
        }))
      );

      addLog('✨ Analyzing your vision...', 'info');
      setProgress(10);

      // Call backend to build agent
      const { data, error } = await supabase.functions.invoke('build-multimodal-agent', {
        body: {
          prompt: prompt.trim(),
          files: fileData
        }
      });

      if (error) throw error;

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      // Process logs from response
      if (data.logs) {
        data.logs.forEach((log: string, index: number) => {
          setTimeout(() => {
            addLog(log, 'info');
          }, index * 500);
        });
      }

      clearInterval(progressInterval);
      setProgress(100);

      if (data.success) {
        addLog('✅ Your AI agent is ready!', 'success');
        setBuildResult(data);
        setUiTemplate(data.ui_template);
      } else {
        throw new Error(data.error || 'Failed to build agent');
      }

    } catch (error: any) {
      console.error('Build error:', error);
      addLog('🔄 Adjusting approach...', 'warning');
      addLog('❌ ' + (error.message || 'Failed to build agent'), 'error');
      
      toast({
        title: 'Build Failed',
        description: error.message || 'Failed to build agent. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsBuilding(false);
    }
  };

  const getLogIcon = (type: LogItem['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      default: return <Sparkles className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Multimodal Agent Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'builder' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('builder')}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Builder
          </Button>
          <Button
            variant={activeTab === 'image-processing' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('image-processing')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Image Processing
          </Button>
        </div>
      </header>

      {activeTab === 'image-processing' ? (
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto p-6">
          <ImageProcessing />
        </div>
      ) : (
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* LEFT PANEL - Explanation */}
        <div className="w-80 border-r border-border bg-muted/30 p-6 overflow-y-auto">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Build AI with Words
              </CardTitle>
              <CardDescription>Describe. We build. Magic happens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">How it works:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✅</span>
                    <span><strong>Describe</strong> what you want</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✅</span>
                    <span><strong>AI selects</strong> the best free models</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✅</span>
                    <span><strong>System builds</strong> the workflow</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✅</span>
                    <span><strong>Get working</strong> interface instantly</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Try these examples:</h3>
                <div className="space-y-2">
                  {examples.map((example, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="w-full justify-start p-2 cursor-pointer hover:bg-accent text-left"
                      onClick={() => setPrompt(example)}
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">What you can build:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {capabilities.map((cap, idx) => (
                    <Badge key={idx} variant="secondary" className="justify-center p-2">
                      <span className="mr-1">{cap.icon}</span>
                      {cap.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER PANEL - Input */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle>Describe your AI model</CardTitle>
              <CardDescription>
                Be specific about what you want to create. Include input and output types.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Example: 'Upload a PDF, summarize it, extract key points, and save as markdown'
Example: 'Generate an image of a cyberpunk city at night with neon lights'
Example: 'Convert my voice memo to text, summarize, and generate action items'
Example: 'Create a Python script to analyze CSV data'"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="resize-none"
              />

              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Drag & drop files or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports: PDF, DOCX, Images, Audio, Text, CSV
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((file, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-2">
                      {file.name}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles(files.filter((_, i) => i !== idx));
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleBuild}
                disabled={isBuilding || !prompt.trim()}
              >
                {isBuilding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Building Your Model...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    🚀 Build My Model
                  </>
                )}
              </Button>

              {isBuilding && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-center text-muted-foreground">
                    Building... {progress}%
                  </p>
                </div>
              )}

              {/* Generated UI Preview */}
              {uiTemplate && buildResult && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <h3 className="font-semibold">✨ Your Generated Interface:</h3>
                  </div>
                  <DynamicUIRenderer 
                    template={uiTemplate} 
                    pipeline={buildResult.pipeline}
                    executionEngine={buildResult.execution_engine}
                  />
                </div>
              )}

              {/* Workflow Visualization */}
              {buildResult?.pipeline && (
                <div className="mt-6">
                  <WorkflowVisualization pipeline={buildResult.pipeline} />
                </div>
              )}

              {/* Model Tester - Always visible for debugging */}
              <div className="mt-6">
                <ModelTester />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL - Live Logs */}
        <div className="w-80 border-l border-border bg-muted/30 p-6 overflow-y-auto">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
              <CardTitle>✨ Creation Process</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Logs will appear here as your agent is built...
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 p-2 rounded text-sm ${
                        log.type === 'error' ? 'bg-red-50 dark:bg-red-950/20' :
                        log.type === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                        log.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20' :
                        'bg-blue-50 dark:bg-blue-950/20'
                      }`}
                    >
                      {getLogIcon(log.type)}
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Model Usage Stats */}
              {buildResult?.metadata && (
                <div className="mt-6 space-y-2">
                  <h4 className="font-semibold text-sm">Model Usage:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-card rounded">
                      <div className="text-lg font-bold">{buildResult.metadata.model_count || 0}</div>
                      <div className="text-xs text-muted-foreground">AI Models</div>
                    </div>
                    <div className="text-center p-2 bg-card rounded">
                      <div className="text-lg font-bold">100%</div>
                      <div className="text-xs text-muted-foreground">Free</div>
                    </div>
                    <div className="text-center p-2 bg-card rounded">
                      <div className="text-lg font-bold">~{buildResult.metadata.estimated_completion || '5'}s</div>
                      <div className="text-xs text-muted-foreground">Est. Time</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

