import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useWorkflowStore, WorkflowNode } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, PanelLeft, PanelRight } from 'lucide-react';
import { NodeTypeDefinition } from '@/components/workflow/nodeTypes';
import WorkflowHeader from '@/components/workflow/WorkflowHeader';
import NodeLibrary from '@/components/workflow/NodeLibrary';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import PropertiesPanel from '@/components/workflow/PropertiesPanel';
import ExecutionConsole from '@/components/workflow/ExecutionConsole';
import { Edge } from '@xyflow/react';
import { Json } from '@/integrations/supabase/types';
import AIAssistant from '@/components/workflow/AIAssistant';
import { validateAndFixWorkflow } from '@/lib/workflowValidation';

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [nodeLibraryOpen, setNodeLibraryOpen] = useState(true);
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true);
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setWorkflowId,
    setWorkflowName,
    setIsDirty,
    resetWorkflow,
    resetAllNodeStatuses,
  } = useWorkflowStore();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin');
    }
  }, [user, authLoading, navigate]);

  // Load workflow if editing - only reset for new workflows
  useEffect(() => {
    if (id && id !== 'new' && user) {
      loadWorkflow(id);
    } else if (id === 'new') {
      resetWorkflow();
    }
  }, [id, user]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error) throw error;

      if (data) {
        setWorkflowId(data.id);
        setWorkflowName(data.name);
        
        // Normalize nodes to ensure they have label, category, icon, etc.
        const normalized = validateAndFixWorkflow({
          nodes: data.nodes || [],
          edges: data.edges || []
        });
        
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workflow',
        variant: 'destructive',
      });
    }
  };

  const handleSave = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const workflowData = {
        name: useWorkflowStore.getState().workflowName,
        nodes: nodes as unknown as Json,
        edges: edges as unknown as Json,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      const workflowId = useWorkflowStore.getState().workflowId;

      if (workflowId) {
        const { error } = await supabase
          .from('workflows')
          .update(workflowData)
          .eq('id', workflowId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('workflows')
          .insert(workflowData)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setWorkflowId(data.id);
          navigate(`/workflow/${data.id}`, { replace: true });
        }
      }

      setIsDirty(false);
      toast({
        title: 'Saved',
        description: 'Workflow saved successfully',
      });
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: 'Error',
        description: 'Failed to save workflow',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, user, navigate, setWorkflowId, setIsDirty]);

  const handleImportWorkflow = useCallback((workflowData: { name?: string; nodes?: unknown[]; edges?: unknown[] }) => {
    try {
      // Validate workflow structure
      if (!workflowData.nodes || !workflowData.edges) {
        throw new Error('Invalid workflow format: missing nodes or edges');
      }

      // Set workflow name
      if (workflowData.name) {
        setWorkflowName(workflowData.name);
      }

      // Convert and set nodes
      const importedNodes = (workflowData.nodes || []) as WorkflowNode[];
      setNodes(importedNodes);

      // Convert and set edges
      const importedEdges = (workflowData.edges || []) as Edge[];
      setEdges(importedEdges);

      setIsDirty(true);

      toast({
        title: 'Success',
        description: 'Workflow imported successfully',
      });
    } catch (error) {
      console.error('Error importing workflow:', error);
      toast({
        title: 'Error',
        description: `Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  }, [setWorkflowName, setNodes, setEdges, setIsDirty]);

  const handleRun = useCallback(async () => {
    const workflowId = useWorkflowStore.getState().workflowId;

    if (nodes.length === 0) {
      toast({
        title: 'No nodes',
        description: 'Add some nodes to your workflow before running',
        variant: 'destructive',
      });
      return;
    }

    if (!workflowId) {
      toast({
        title: 'Save required',
        description: 'Please save your workflow before running',
        variant: 'destructive',
      });
      return;
    }

    // Check if workflow has a form trigger node
    const formNode = nodes.find((node: any) => node.data?.type === 'form');
    const testInput: any = {};

    if (formNode) {
      // For Form Trigger nodes, check if workflow is active
      try {
        const { data: workflowData, error: workflowError } = await supabase
          .from('workflows')
          .select('status')
          .eq('id', workflowId)
          .single();

        if (workflowError) {
          console.error('Error checking workflow status:', workflowError);
          toast({
            title: 'Error',
            description: 'Failed to check workflow status. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        if (!workflowData) {
          console.error('Workflow data not found');
          toast({
            title: 'Error',
            description: 'Workflow not found',
            variant: 'destructive',
          });
          return;
        }

        const isActive = workflowData.status === 'active';
        console.log('Workflow status check:', { workflowId, status: workflowData.status, isActive });
      const formUrl = `${window.location.origin}/form/${workflowId}/${formNode.id}`;
      
        if (!isActive) {
          // Workflow is not active - show activation message
      toast({
        title: 'Form Trigger Detected',
        description: `Form Trigger is a blocking trigger. Activate the workflow to start waiting for form submissions. Form URL: ${formUrl}`,
        duration: 10000,
      });
      
      // Expand console to show form URL
      if (!consoleExpanded) {
        setConsoleExpanded(true);
      }
      
      // Don't execute workflow manually - Form Trigger must wait for submission
      // User should activate workflow instead, which will put execution in WAITING state
      return;
        } else {
          // Workflow is active - create a waiting execution
          toast({
            title: 'Form Trigger Active',
            description: 'Workflow is active and waiting for form submissions. Creating waiting execution...',
          });
          
          // Expand console to show the waiting execution
          if (!consoleExpanded) {
            setConsoleExpanded(true);
          }
          
          // For active form triggers, call execute-workflow which will handle creating the waiting execution
          // The execute-workflow function detects form triggers and sets status to 'waiting'
          setIsRunning(true);
          try {
            const { data: execData, error: execWorkflowError } = await supabase.functions.invoke('execute-workflow', {
              body: { 
                workflowId, 
                input: {} // Empty input - form trigger will wait for submission
              },
            });

            if (execWorkflowError) {
              console.error('Error executing workflow:', execWorkflowError);
              toast({
                title: 'Error',
                description: `Failed to start workflow: ${execWorkflowError.message || 'Unknown error'}`,
                variant: 'destructive',
              });
              return;
            }

            toast({
              title: 'Waiting for Form Submission',
              description: `Workflow is now active and waiting for form submissions. Form URL: ${formUrl}`,
              duration: 8000,
            });
          } catch (error) {
            console.error('Error invoking execute-workflow:', error);
            toast({
              title: 'Error',
              description: `Failed to start workflow: ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: 'destructive',
            });
          } finally {
            setIsRunning(false);
          }
          
          return;
        }
      } catch (error) {
        console.error('Error checking workflow status:', error);
        toast({
          title: 'Error',
          description: 'Failed to check workflow status',
          variant: 'destructive',
        });
        return;
      }
    }

    // Reset all node statuses to 'idle' before starting new execution
    resetAllNodeStatuses();

    setIsRunning(true);
    // Expand console to show logs
    if (!consoleExpanded) {
      setConsoleExpanded(true);
    }

    toast({
      title: 'Running workflow',
      description: 'Execution started...',
    });

    try {
      const { data, error } = await supabase.functions.invoke('execute-workflow', {
        body: { workflowId, input: testInput },
      });

      if (error) throw error;

      toast({
        title: data.status === 'success' ? 'Execution complete' : 'Execution failed',
        description: data.status === 'success'
          ? `Completed in ${data.durationMs}ms`
          : data.error || 'Unknown error',
        variant: data.status === 'success' ? 'default' : 'destructive',
      });

      // Don't navigate away - logs will show in console
      // The ExecutionConsole component will auto-update via realtime subscription
    } catch (error) {
      console.error('Execution error:', error);
      toast({
        title: 'Error',
        description: 'Failed to execute workflow',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  }, [nodes, consoleExpanded]);


  const onDragStart = useCallback((event: React.DragEvent, nodeType: NodeTypeDefinition) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <WorkflowHeader
        onSave={handleSave}
        onRun={handleRun}
        isSaving={isSaving}
        isRunning={isRunning}
        showAI={showAI}
        onToggleAI={() => setShowAI(!showAI)}
        onImport={handleImportWorkflow}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex overflow-hidden">
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              nodeLibraryOpen ? 'w-72' : 'w-0'
            }`}
          >
            {nodeLibraryOpen && (
              <NodeLibrary 
                onDragStart={onDragStart} 
                onClose={() => setNodeLibraryOpen(false)}
              />
            )}
          </div>
          <div className="flex-1 relative">
            <WorkflowCanvas />
            {/* Floating buttons to reopen panels when closed */}
            {!nodeLibraryOpen && (
              <button
                onClick={() => setNodeLibraryOpen(true)}
                className="absolute left-0 top-20 z-50 flex items-center gap-2 pl-2 pr-4 py-3 rounded-r-lg bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:translate-x-1 group"
                title="Open Node Library"
              >
                <PanelLeft className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Node Library</span>
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-foreground/20 rounded-l-lg group-hover:bg-primary-foreground/30 transition-colors" />
              </button>
            )}
            {!propertiesPanelOpen && (
              <button
                onClick={() => setPropertiesPanelOpen(true)}
                className="absolute right-0 top-20 z-50 flex items-center gap-2 pl-4 pr-2 py-3 rounded-l-lg bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:-translate-x-1 group"
                title="Open Properties Panel"
              >
                <span className="text-sm font-medium whitespace-nowrap">Properties</span>
                <PanelRight className="h-5 w-5 flex-shrink-0" />
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-foreground/20 rounded-r-lg group-hover:bg-primary-foreground/30 transition-colors" />
              </button>
            )}
          </div>
          {propertiesPanelOpen && (
            <div className="transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0">
              <PropertiesPanel onClose={() => setPropertiesPanelOpen(false)} />
            </div>
          )}
          <AIAssistant isOpen={showAI} onClose={() => setShowAI(false)} />
        </div>
        <ExecutionConsole
          isExpanded={consoleExpanded}
          onToggle={() => setConsoleExpanded(!consoleExpanded)}
        />
      </div>
    </div>
  );
}
