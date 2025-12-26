import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useWorkflowStore, WorkflowNode } from '@/stores/workflowStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { NodeTypeDefinition } from '@/components/workflow/nodeTypes';
import WorkflowHeader from '@/components/workflow/WorkflowHeader';
import NodeLibrary from '@/components/workflow/NodeLibrary';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import PropertiesPanel from '@/components/workflow/PropertiesPanel';
import ExecutionConsole from '@/components/workflow/ExecutionConsole';
import { Edge } from '@xyflow/react';
import { Json } from '@/integrations/supabase/types';
import AIAssistant from '@/components/workflow/AIAssistant';

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [showAI, setShowAI] = useState(false);
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
        setNodes((data.nodes as unknown as WorkflowNode[]) || []);
        setEdges((data.edges as unknown as Edge[]) || []);
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
        body: { workflowId, input: {} },
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
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex overflow-hidden">
          <NodeLibrary onDragStart={onDragStart} />
          <WorkflowCanvas />
          <PropertiesPanel />
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
