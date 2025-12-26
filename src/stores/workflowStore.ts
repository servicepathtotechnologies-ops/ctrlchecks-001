import { create } from 'zustand';
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
  addEdge,
} from '@xyflow/react';

export type NodeCategory = 'triggers' | 'ai' | 'logic' | 'data' | 'database' | 'storage' | 'output' | 'http_api' | 'google';

export interface NodeData {
  label: string;
  type: string;
  category: NodeCategory;
  icon: string;
  config: Record<string, unknown>;
  executionStatus?: 'idle' | 'running' | 'success' | 'error';
  [key: string]: unknown;
}

export type WorkflowNode = Node<NodeData>;

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: Edge[];
  selectedNode: WorkflowNode | null;
  selectedEdge: Edge | null;
  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;
  copiedNode: WorkflowNode | null;

  // Undo/Redo Stacks
  undoStack: { nodes: WorkflowNode[]; edges: Edge[] }[];
  redoStack: { nodes: WorkflowNode[]; edges: Edge[] }[];

  // Actions
  // Actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  addNode: (node: WorkflowNode) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeStatus: (nodeId: string, status: 'idle' | 'running' | 'success' | 'error') => void;
  resetAllNodeStatuses: () => void;
  selectNode: (node: WorkflowNode | null) => void;
  selectEdge: (edge: Edge | null) => void;
  deleteSelectedNode: () => void;
  deleteSelectedEdge: () => void;
  setWorkflowId: (id: string | null) => void;
  setWorkflowName: (name: string) => void;
  setIsDirty: (dirty: boolean) => void;
  resetWorkflow: () => void;

  // History & Clipboard
  undo: () => void;
  redo: () => void;
  copySelectedNode: () => void;
  pasteNode: () => void;
  selectAll: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
  workflowId: null,
  workflowName: 'Untitled Workflow',
  isDirty: false,
  copiedNode: null,
  undoStack: [],
  redoStack: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[],
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
      isDirty: true,
    });
  },

  onReconnect: (oldEdge, newConnection) => {
    const { edges, nodes } = get();
    // Save state for undo
    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];

    set({
      edges: addEdge(newConnection, edges.filter((e) => e.id !== oldEdge.id)),
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  addNode: (node) => {
    const { nodes, edges } = get();
    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];
    set({
      nodes: [...nodes, node],
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  updateNodeConfig: (nodeId, config) => {
    const { nodes, edges } = get();
    // Only push to undo stack if config actually changes significantly or debounced? 
    // For now, let's keep it simple. If this is called frequently on typing, we might need to debounce history.
    // Assuming this is called on blur or explicit save/change.
    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];

    const updatedNodes = nodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
        : node
    );
    const selectedNode = get().selectedNode;
    const updatedSelectedNode = selectedNode?.id === nodeId
      ? updatedNodes.find(n => n.id === nodeId) || null
      : selectedNode;

    set({
      nodes: updatedNodes,
      selectedNode: updatedSelectedNode,
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  updateNodeStatus: (nodeId, status) => {
    // Status updates don't need to be in history/undo stack
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, executionStatus: status } }
          : node
      ),
    });
  },

  resetAllNodeStatuses: () => {
    // Reset all node execution statuses to 'idle' - used when starting a new execution
    set({
      nodes: get().nodes.map((node) => ({
        ...node,
        data: { ...node.data, executionStatus: 'idle' as const },
      })),
    });
  },

  selectNode: (node) => {
    const { nodes, edges } = get();
    set({
      selectedNode: node,
      selectedEdge: null,
      // Sync visual state
      nodes: nodes.map(n => ({ ...n, selected: n.id === node?.id })),
      edges: edges.map(e => ({ ...e, selected: false }))
    });
  },
  selectEdge: (edge) => {
    const { nodes, edges } = get();
    set({
      selectedEdge: edge,
      selectedNode: null,
      // Sync visual state 
      edges: edges.map(e => ({ ...e, selected: e.id === edge?.id })),
      nodes: nodes.map(n => ({ ...n, selected: false }))
    });
  },

  deleteSelectedNode: () => {
    const { selectedNode, nodes, edges } = get();
    if (!selectedNode) return;

    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];

    set({
      nodes: nodes.filter((n) => n.id !== selectedNode.id),
      edges: edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
      selectedNode: null,
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  deleteSelectedEdge: () => {
    const { selectedEdge, nodes, edges } = get();
    if (!selectedEdge) return;

    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];

    set({
      edges: edges.filter((e) => e.id !== selectedEdge.id),
      selectedEdge: null,
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, nodes, edges, redoStack } = get();
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set({
      nodes: previousState.nodes,
      edges: previousState.edges,
      undoStack: newUndoStack,
      redoStack: [...redoStack, { nodes, edges }],
      selectedNode: null,
      selectedEdge: null,
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, nodes, edges, redoStack } = get();
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    set({
      nodes: nextState.nodes,
      edges: nextState.edges,
      undoStack: [...undoStack, { nodes, edges }],
      redoStack: newRedoStack,
      selectedNode: null,
      selectedEdge: null,
      isDirty: true,
    });
  },

  copySelectedNode: () => {
    const { selectedNode } = get();
    if (selectedNode) {
      set({ copiedNode: JSON.parse(JSON.stringify(selectedNode)) });
    }
  },

  pasteNode: () => {
    const { copiedNode, nodes, edges } = get();
    if (!copiedNode) return;

    const newUndoStack = [...get().undoStack, { nodes: [...nodes], edges: [...edges] }];

    // Create new node with new ID and offset position
    const newNode: WorkflowNode = {
      ...copiedNode,
      id: `${copiedNode.type}_${Date.now()}`,
      position: {
        x: copiedNode.position.x + 50,
        y: copiedNode.position.y + 50,
      },
      selected: true,
    };

    set({
      nodes: [...nodes.map(n => ({ ...n, selected: false })), newNode],
      selectedNode: newNode,
      isDirty: true,
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  selectAll: () => {
    const { nodes } = get();
    // React Flow handles multi-selection by adding 'selected: true' to nodes
    // We update our nodes state to reflect this
    set({
      nodes: nodes.map(n => ({ ...n, selected: true })),
      selectedNode: null, // Clear single selection reference
    });
  },

  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  resetWorkflow: () => set({
    nodes: [],
    edges: [],
    selectedNode: null,
    selectedEdge: null,
    workflowId: null,
    workflowName: 'Untitled Workflow',
    isDirty: false,
    undoStack: [],
    redoStack: [],
  }),
}));
