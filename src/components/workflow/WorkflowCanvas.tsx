import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
  Edge,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore, NodeData } from '@/stores/workflowStore';
import { NodeTypeDefinition } from './nodeTypes';
import WorkflowNode from './WorkflowNode';

const nodeTypes = {
  custom: WorkflowNode,
};

function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    addNode,
    selectNode,
    selectEdge,
    deleteSelectedNode,
    deleteSelectedEdge,
    undo,
    redo,
    copySelectedNode,
    pasteNode,
    selectAll,
    selectedNode,
    selectedEdge
  } = useWorkflowStore();

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if input/textarea is focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLDivElement && event.target.contentEditable === 'true'
      ) {
        return;
      }

      // Delete
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNode) deleteSelectedNode();
        if (selectedEdge) deleteSelectedEdge();
      }

      // Ctrl/Cmd Shortcuts
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'z':
            event.preventDefault();
            undo();
            break;
          case 'y':
            event.preventDefault();
            redo();
            break;
          case 'c':
            event.preventDefault();
            copySelectedNode();
            break;
          case 'v':
            event.preventDefault();
            pasteNode();
            break;
          case 'a':
            event.preventDefault();
            selectAll();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, selectedEdge, deleteSelectedNode, deleteSelectedEdge, undo, redo, copySelectedNode, pasteNode, selectAll]);


  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeDataString = event.dataTransfer.getData('application/reactflow');
      if (!nodeDataString) return;

      const nodeData: NodeTypeDefinition = JSON.parse(nodeDataString);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<NodeData> = {
        id: `${nodeData.type}_${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: nodeData.label,
          type: nodeData.type,
          category: nodeData.category,
          icon: nodeData.icon,
          config: { ...nodeData.defaultConfig },
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      selectNode(node);
    },
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectEdge(edge);
    },
    [selectEdge]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        className="bg-muted/30"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} className="!bg-muted/50" />
        <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(node) => {
            const data = node.data as NodeData;
            switch (data?.category) {
              case 'triggers': return 'hsl(var(--primary))';
              case 'ai': return 'hsl(var(--accent))';
              case 'logic': return 'hsl(var(--secondary))';
              case 'data': return 'hsl(142 71% 45%)';
              case 'output': return 'hsl(25 95% 53%)';
              default: return 'hsl(var(--muted-foreground))';
            }
          }}
          maskColor="hsl(var(--background) / 0.8)"
        />
      </ReactFlow>
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
