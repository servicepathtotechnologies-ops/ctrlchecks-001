import { useWorkflowStore } from '@/stores/workflowStore';
import { useState, useCallback, useEffect } from 'react';
import { getNodeDefinition, ConfigField } from './nodeTypes';
import { NODE_USAGE_GUIDES } from './nodeUsageGuides';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import NodeUsageCard from './NodeUsageCard';
import GoogleSheetsSettings from './GoogleSheetsSettings';
import FormNodeSettings from './FormNodeSettings';
import { supabase } from '@/integrations/supabase/client';
import { Copy, ExternalLink } from 'lucide-react';
import {
  Trash2, X, Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link,
  GitBranch, GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table,
  Type, Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput, HelpCircle,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss, Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Play, Webhook, Clock, Globe, Brain, Sparkles, Gem, Link, GitBranch,
  GitMerge, Repeat, Timer, ShieldAlert, Code, Braces, Table, Type,
  Combine, Send, Mail, MessageSquare, Database, Box, FileText, Heart,
  Filter, Variable, Hash, MessageCircle, DatabaseZap, FileOutput,
  XCircle, Layers, Edit, Edit3, Tag, Code2, ListChecks, ArrowUpDown, List, Terminal,
  Calculator, Lock, Rss, Target
};

interface PropertiesPanelProps {
  onClose?: () => void;
}

export default function PropertiesPanel({ onClose }: PropertiesPanelProps) {
  const { selectedNode, selectNode, updateNodeConfig, deleteSelectedNode, workflowId } = useWorkflowStore();
  const { toast } = useToast();

  // Resizable sidebar state
  const [width, setWidth] = useState(400); // Increased default width from 320px (w-80) to 400px
  const [isResizing, setIsResizing] = useState(false);
  
  // Help sidebar state
  const [selectedHelp, setSelectedHelp] = useState<{ title: string; steps: string[] } | null>(null);

  // Form workflow activation state
  const [isWorkflowActive, setIsWorkflowActive] = useState(false);
  const [isSavingActivation, setIsSavingActivation] = useState(false);

  // Load workflow status when form node is selected
  useEffect(() => {
    if (selectedNode?.data.type === 'form' && workflowId) {
      loadWorkflowStatus();
    }
  }, [selectedNode?.data.type, workflowId]);

  const loadWorkflowStatus = async () => {
    if (!workflowId) return;
    
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('status')
        .eq('id', workflowId)
        .single();

      if (error) throw error;
      setIsWorkflowActive(data?.status === 'active');
    } catch (error) {
      console.error('Error loading workflow status:', error);
    }
  };

  const handleToggleActivation = async (enabled: boolean) => {
    if (!workflowId) {
      toast({
        title: 'Error',
        description: 'Please save the workflow first',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingActivation(true);
    try {
      const { data, error } = await supabase
        .from("workflows")
        .update({ 
          status: enabled ? "active" : "draft"
        })
        .eq("id", workflowId)
        .select("status")
        .single();

      if (error) throw error;

      if (data && data.status === (enabled ? "active" : "draft")) {
        setIsWorkflowActive(enabled);
        toast({
          title: 'Success',
          description: enabled ? "Workflow activated successfully" : "Workflow deactivated",
        });
        
        if (enabled) {
          toast({
            title: 'Info',
            description: "Form is now active and waiting for submissions",
          });
        }
      } else {
        await loadWorkflowStatus();
        toast({
          title: 'Warning',
          description: "Status update may not have been saved. Please check and try again.",
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error updating workflow status:", error);
      toast({
        title: 'Error',
        description: "Failed to update workflow status",
        variant: 'destructive',
      });
      await loadWorkflowStatus();
    } finally {
      setIsSavingActivation(false);
    }
  };

  // Resize handlers
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Calculate new width relative to window right edge
        const newWidth = window.innerWidth - mouseMoveEvent.clientX;
        // Constraints: Min 300px, Max 800px (or window width - 100px)
        const constrainedWidth = Math.max(300, Math.min(newWidth, 800));
        setWidth(constrainedWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (!selectedNode) {
    return (
      <div
        className="border-l border-border bg-card h-full flex flex-col transition-all duration-75 relative"
        style={{ width: width, flexShrink: 0 }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-50"
          onMouseDown={startResizing}
        />

        {/* Header with Close Button */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Node Properties</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Close Properties Panel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <HelpCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No node selected</p>
            <p className="text-xs mt-1">Click on a node to view its properties and usage guide</p>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: ensure node has proper data structure
  if (!selectedNode.data || !selectedNode.data.type) {
    console.warn('[PropertiesPanel] Node missing data or type:', selectedNode);
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <HelpCircle className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Invalid Node</p>
          <p className="text-xs mt-1">This node has missing data. Please reload the workflow.</p>
        </div>
      </div>
    );
  }

  const nodeDefinition = getNodeDefinition(selectedNode.data.type);
  const IconComponent = iconMap[selectedNode.data.icon || 'Box'] || Box;

  const handleConfigChange = (key: string, value: unknown) => {
    // Prevent focus loss by using stopPropagation on the update
    updateNodeConfig(selectedNode.id, { [key]: value });
  };

  // Stop event propagation to prevent ReactFlow from stealing focus
  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Parse helpText to extract title and steps
  const parseHelpText = (helpText: string): { title: string; steps: string[] } | null => {
    if (!helpText || !helpText.startsWith('How to get')) {
      return null;
    }
    
    // Extract title (everything before the colon)
    const colonIndex = helpText.indexOf(':');
    if (colonIndex === -1) return null;
    
    const title = helpText.substring(0, colonIndex).trim();
    const content = helpText.substring(colonIndex + 1).trim();
    
    // Extract steps (numbered items like "1) ... 2) ...")
    const steps: string[] = [];
    
    // Split by numbered steps pattern: "1) ", "2) ", etc.
    const stepParts = content.split(/(?=\d+\)\s)/);
    
    for (const part of stepParts) {
      const stepMatch = part.match(/^\d+\)\s*(.+?)(?=\s*\d+\)|$)/s);
      if (stepMatch) {
        const stepText = stepMatch[1].trim();
        if (stepText.length > 0) {
          steps.push(stepText);
        }
      } else {
        // If no match, try to extract any remaining text
        const cleaned = part.replace(/^\d+\)\s*/, '').trim();
        if (cleaned.length > 0) {
          steps.push(cleaned);
        }
      }
    }
    
    // If still no steps found, try alternative parsing
    if (steps.length === 0) {
      // Try splitting by "Method 1", "Method 2", etc. or by periods
      const alternativeSteps = content
        .split(/(?=Method \d+:|Step \d+:|^\d+\.)/)
        .filter(s => s.trim().length > 0)
        .map(s => s.replace(/^(Method \d+:|Step \d+:|\d+\.)\s*/, '').trim())
        .filter(s => s.length > 0);
      
      if (alternativeSteps.length > 0) {
        steps.push(...alternativeSteps);
      } else {
        // Last resort: split by periods and filter
        const periodSteps = content
          .split(/\.(?=\s)/)
          .map(s => s.trim())
          .filter(s => s.length > 10); // Filter out very short fragments
        
        if (periodSteps.length > 0) {
          steps.push(...periodSteps);
        }
      }
    }
    
    return steps.length > 0 ? { title, steps } : null;
  };

  const renderField = (field: ConfigField) => {
    const value = (selectedNode.data.config || {})[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'text':
      case 'cron':
        return (
          <Input
            id={field.key}
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'time':
        return (
          <Input
            id={field.key}
            type="time"
            value={value as string}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder || '09:00'}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'textarea':
      case 'json':
        return (
          <Textarea
            id={field.key}
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => handleConfigChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="min-h-[100px] font-mono text-xs"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'number':
        return (
          <Input
            id={field.key}
            type="number"
            value={value as number}
            onChange={(e) => handleConfigChange(field.key, parseFloat(e.target.value))}
            placeholder={field.placeholder}
            className="h-9"
            onMouseDown={handleInputMouseDown}
            onFocus={(e) => e.stopPropagation()}
          />
        );

      case 'select':
        return (
          <Select
            value={value as string}
            onValueChange={(val) => handleConfigChange(field.key, val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'boolean':
        return (
          <Switch
            id={field.key}
            checked={value as boolean}
            onCheckedChange={(checked) => handleConfigChange(field.key, checked)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="border-l border-border bg-card h-full flex flex-col relative transition-all duration-75"
      style={{ width: width, flexShrink: 0 }}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors z-50 ${isResizing ? 'bg-primary' : ''}`}
        onMouseDown={startResizing}
      />

      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Node Properties</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => selectNode(null)} title="Deselect Node">
            <X className="h-4 w-4" />
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Close Properties Panel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Usage Guide Card - Only for Core Logic Nodes */}
          {nodeDefinition?.category === 'logic' && NODE_USAGE_GUIDES[selectedNode.data.type] && (
            <NodeUsageCard
              guide={NODE_USAGE_GUIDES[selectedNode.data.type]}
              nodeLabel={selectedNode.data.label}
            />
          )}

          {/* Node Info */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <p className="text-sm font-medium">{selectedNode.data.label || selectedNode.data.type || 'Unknown'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm text-muted-foreground">{nodeDefinition?.description || 'No description available'}</p>
            </div>
          </div>

          {/* Config Fields */}
          {nodeDefinition && (
            <>
              {/* Form Settings for Form Nodes - Show prominently at the top */}
              {selectedNode.data.type === 'form' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Form Settings
                  </h3>
                  
                  {/* Activation Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="form-activation" className="text-base font-semibold">
                        Activate Workflow
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {isWorkflowActive 
                          ? "Workflow is active and waiting for form submissions"
                          : "Activate to start accepting form submissions"}
                      </p>
                    </div>
                    <Switch
                      id="form-activation"
                      checked={isWorkflowActive}
                      onCheckedChange={handleToggleActivation}
                      disabled={isSavingActivation || !workflowId}
                    />
                  </div>

                  {/* Form URL Display */}
                  <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold text-foreground">🔗 Form URL</Label>
                        {!workflowId && (
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                            (Save workflow first)
                          </span>
                        )}
                      </div>
                      {workflowId ? (
                        <>
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 min-w-0 p-3 border-2 border-blue-300 dark:border-blue-700 rounded-md bg-background">
                              <code className="text-xs font-mono break-all whitespace-normal text-foreground">
                                {`${window.location.origin}/form/${workflowId}/${selectedNode.id}`}
                              </code>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 flex-shrink-0 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/form/${workflowId}/${selectedNode.id}`;
                                navigator.clipboard.writeText(url);
                                toast({
                                  title: 'Copied!',
                                  description: 'Form URL copied to clipboard',
                                });
                              }}
                              title="Copy form URL"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 flex-shrink-0 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/form/${workflowId}/${selectedNode.id}`;
                                window.open(url, '_blank');
                              }}
                              title="Open form in new tab"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Share this URL with users to collect form submissions. Submissions will automatically trigger your workflow.
                          </p>
                          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              <strong>Note:</strong> The workflow must be saved and active for the form to work. Users can access this URL directly in their browser to fill out and submit the form.
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                          <strong>⚠️ Save Required:</strong> Please save the workflow first to generate the form link.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Node Settings */}
              {selectedNode.data.type === 'form' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Form Configuration
                  </h3>
                  <FormNodeSettings
                    config={{
                      formTitle: selectedNode.data.config?.formTitle || 'Form Submission',
                      formDescription: selectedNode.data.config?.formDescription || '',
                      fields: Array.isArray(selectedNode.data.config?.fields) 
                        ? selectedNode.data.config.fields 
                        : [],
                      submitButtonText: selectedNode.data.config?.submitButtonText || 'Submit',
                      successMessage: selectedNode.data.config?.successMessage || 'Thank you for your submission!',
                      redirectUrl: selectedNode.data.config?.redirectUrl || '',
                    }}
                    onConfigChange={(newConfig) => {
                      updateNodeConfig(selectedNode.id, newConfig);
                    }}
                  />
                </div>
              ) : selectedNode.data.type !== 'form' && (
                <>
              {/* Custom Google Sheets Settings */}
              {selectedNode.data.type === 'google_sheets' ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Configuration
                  </h3>
                  <GoogleSheetsSettings
                    config={selectedNode.data.config}
                    onConfigChange={(newConfig) => {
                      updateNodeConfig(selectedNode.id, newConfig);
                    }}
                  />
                </div>
              ) : nodeDefinition.configFields.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Configuration
                  </h3>
                  {nodeDefinition.configFields.map((field) => {
                    const helpInfo = field.helpText ? parseHelpText(field.helpText) : null;
                    const hasHelpLink = helpInfo !== null;
                    const hasDescription = field.helpText && !hasHelpLink;
                    
                    return (
                      <div key={field.key} className="space-y-2">
                        {/* Top - Heading */}
                        <Label htmlFor={field.key} className="text-sm flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-destructive">*</span>}
                        </Label>
                        
                        {/* Next - Description (if exists and not a help link) */}
                        {hasDescription && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                        
                        {/* Next - Input Field */}
                        {renderField(field)}
                        
                        {/* Last - User Manual Link at Right Side End */}
                        {hasHelpLink && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedHelp(helpInfo)}
                              className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                            >
                              <HelpCircle className="h-3 w-3" />
                              How to get {field.label}?
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border space-y-2">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            deleteSelectedNode();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Node
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted rounded border">Del</kbd> or <kbd className="px-1.5 py-0.5 text-xs font-semibold text-muted-foreground bg-muted rounded border">Backspace</kbd> to delete
        </p>
      </div>

      {/* Help Sidebar */}
      <Sheet open={!!selectedHelp} onOpenChange={(open) => !open && setSelectedHelp(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedHelp?.title || 'Help'}</SheetTitle>
            <SheetDescription>
              Follow these steps to get the required information.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {selectedHelp?.steps.map((step, index) => (
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
  );
}
