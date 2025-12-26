
interface WorkflowNode {
    id: string;
    type: string;
    data?: any;
    position?: { x: number; y: number };
    config?: any;
}

interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

interface WorkflowData {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    name?: string;
}

/**
 * Validates and fixes the workflow structure.
 * Specifically enforces strict IF/ELSE node rules:
 * 1. Must have exactly two outputs: TRUE and FALSE.
 * 2. No split output conflicts (one condition = one path).
 * 3. Creates default paths if missing.
 */
export function validateAndFixWorkflow(workflow: WorkflowData): WorkflowData {
    // Deep clone to avoid mutating original
    const fixedWorkflow = JSON.parse(JSON.stringify(workflow));

    if (!fixedWorkflow.nodes || !fixedWorkflow.edges) {
        return fixedWorkflow;
    }

    const nodes = fixedWorkflow.nodes as WorkflowNode[];
    let edges = fixedWorkflow.edges as WorkflowEdge[];
    const existingEdgeIds = new Set(edges.map(e => e.id));
    const existingNodeIds = new Set(nodes.map(n => n.id));

    // Helper to generate unique ID
    const generateId = (prefix: string) => {
        let i = 1;
        while (existingEdgeIds.has(`${prefix}_${i}`) || existingNodeIds.has(`${prefix}_${i}`)) {
            i++;
        }
        const id = `${prefix}_${i}`;
        existingEdgeIds.add(id); // Reserve it
        return id;
    };

    // Find all IF/ELSE nodes
    const ifElseNodes = nodes.filter(n => n.type === 'if_else');

    for (const node of ifElseNodes) {
        // Get all edges originating from this node
        const outgoingEdges = edges.filter(e => e.source === node.id);

        // Group edges by handle (true/false)
        const trueEdges = outgoingEdges.filter(e => e.sourceHandle === 'true');
        const falseEdges = outgoingEdges.filter(e => e.sourceHandle === 'false');
        // Edges without handle (invalid for if_else)
        const noHandleEdges = outgoingEdges.filter(e => !e.sourceHandle);

        // FIX 1: Assign valid handles to null-handle edges
        // If we have no true edges, assign first no-handle to true
        // If we have no false edges, assign next no-handle to false
        // Discard extras or assign to existing buckets (which will be filtered later)

        const validEdges: WorkflowEdge[] = [];

        // Process TRUE path
        let finalTrueEdge: WorkflowEdge | null = null;
        if (trueEdges.length > 0) {
            finalTrueEdge = trueEdges[0]; // Keep first one
        } else if (noHandleEdges.length > 0) {
            // Convert a no-handle edge to true
            finalTrueEdge = noHandleEdges.shift()!;
            finalTrueEdge.sourceHandle = 'true';
        }

        // Process FALSE path
        let finalFalseEdge: WorkflowEdge | null = null;
        if (falseEdges.length > 0) {
            finalFalseEdge = falseEdges[0]; // Keep first one
        } else if (noHandleEdges.length > 0) {
            // Convert a no-handle edge to false
            finalFalseEdge = noHandleEdges.shift()!;
            finalFalseEdge.sourceHandle = 'false';
        }

        // Add back to edges list (excluding the ones we just processed from the original list)
        // We will rebuild the edges array for this node
        edges = edges.filter(e => e.source !== node.id);

        if (finalTrueEdge) {
            edges.push(finalTrueEdge);
        } else {
            // Create default TRUE path to a Log node if missing
            const logNodeId = generateId('log_true');
            nodes.push({
                id: logNodeId,
                type: 'log_output',
                position: {
                    x: (node.position?.x || 0) + 300,
                    y: (node.position?.y || 0) - 100
                },
                config: { message: `True path from ${node.id}`, level: 'info' }
            });
            existingNodeIds.add(logNodeId);

            edges.push({
                id: generateId('edge'),
                source: node.id,
                target: logNodeId,
                sourceHandle: 'true'
            });
        }

        if (finalFalseEdge) {
            edges.push(finalFalseEdge);
        } else {
            // Create default FALSE path to a Log node if missing
            const logNodeId = generateId('log_false');
            nodes.push({
                id: logNodeId,
                type: 'log_output',
                position: {
                    x: (node.position?.x || 0) + 300,
                    y: (node.position?.y || 0) + 100
                },
                config: { message: `False path from ${node.id}`, level: 'info' }
            });
            existingNodeIds.add(logNodeId);

            edges.push({
                id: generateId('edge'),
                source: node.id,
                target: logNodeId,
                sourceHandle: 'false'
            });
        }

        // FIX 2: Check for ambiguous targets (same node connected to both TRUE and FALSE)
        // This is rare after the above filtering (since we picked distinct edges), 
        // but possible if the original edges pointed to the same target.
        // Re-fetch our two new edges
        const currentTrue = edges.find(e => e.source === node.id && e.sourceHandle === 'true')!;
        const currentFalse = edges.find(e => e.source === node.id && e.sourceHandle === 'false')!;

        if (currentTrue.target === currentFalse.target) {
            // DETACH FALSE path and create a new log node
            // (We preserve TRUE path preference)
            const logNodeId = generateId('log_false_fix');
            nodes.push({
                id: logNodeId,
                type: 'log_output',
                position: {
                    x: (node.position?.x || 0) + 300,
                    y: (node.position?.y || 0) + 150
                },
                config: { message: `False path from ${node.id} (detached from shared target)`, level: 'info' }
            });
            existingNodeIds.add(logNodeId);

            // Update false edge target
            currentFalse.target = logNodeId;
        }
    }

    fixedWorkflow.nodes = nodes;
    fixedWorkflow.edges = edges;
    return fixedWorkflow;
}
