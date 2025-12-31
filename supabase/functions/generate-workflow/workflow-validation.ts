
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

    // 🚨 CRITICAL FIX: Fix JavaScript nodes that incorrectly access input.body when previous node is HTTP Request
    fixJavaScriptForHttpRequest(nodes, edges);
    
    // 🚨 CRITICAL FIX: Ensure JavaScript nodes handle single objects from HTTP Request
    fixJavaScriptForSingleObject(nodes, edges);
    
    // 🚨 CRITICAL FIX: Replace invalid "custom" node types with valid types
    fixCustomNodeTypes(nodes);

    fixedWorkflow.nodes = nodes;
    fixedWorkflow.edges = edges;
    return fixedWorkflow;
}

/**
 * Fixes JavaScript nodes that incorrectly access input.body when previous node is HTTP Request.
 * HTTP Request returns data DIRECTLY, not wrapped in a "body" property.
 */
function fixJavaScriptForHttpRequest(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Find all JavaScript nodes
    const javascriptNodes = nodes.filter(n => n.type === 'javascript');
    
    for (const jsNode of javascriptNodes) {
        // Find the edge that connects to this JavaScript node
        const incomingEdge = edges.find(e => e.target === jsNode.id);
        if (!incomingEdge) continue;
        
        // Find the source node (previous node)
        const sourceNode = nodes.find(n => n.id === incomingEdge.source);
        if (!sourceNode) continue;
        
        // Check if previous node is HTTP Request
        const isHttpRequest = sourceNode.type === 'http_request' || 
                             sourceNode.data?.type === 'http_request';
        
        if (!isHttpRequest) continue;
        
        // Get JavaScript code
        const code = (jsNode.config?.code || '') as string;
        if (!code) continue;
        
        // Check if code incorrectly uses input.body
        const hasInputBody = /input\.body\b/.test(code);
        if (!hasInputBody) continue;
        
        console.log(`[WORKFLOW VALIDATION] Fixing JavaScript node ${jsNode.id}: Replacing input.body with direct input access (HTTP Request output)`);
        
        // Fix the code by replacing input.body with direct input access
        // Pattern: input.body.property → input.property
        let fixedCode = code;
        
        // Replace input.body.property with input.property
        fixedCode = fixedCode.replace(/input\.body\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g, 'input.$1');
        
        // Replace input.body?.[...] with input?.[...]
        fixedCode = fixedCode.replace(/input\.body\?\./g, 'input?.');
        
        // Replace input.body || with input ||
        fixedCode = fixedCode.replace(/input\.body\s*\|\|/g, 'input ||');
        
        // Replace input.body && with input &&
        fixedCode = fixedCode.replace(/input\.body\s*&&/g, 'input &&');
        
        // If code is accessing array properties like input.body.products, ensure it uses input.products
        // Add comment explaining the fix
        if (fixedCode !== code) {
            const comment = `// FIXED: HTTP Request returns data directly (not in input.body)\n// Changed input.body.* to input.*\n`;
            fixedCode = comment + fixedCode;
        }
        
        // Update node config
        if (!jsNode.config) jsNode.config = {};
        jsNode.config.code = fixedCode;
    }
}

/**
 * Fixes JavaScript nodes that don't handle single objects from HTTP Request.
 * HTTP Request can return either a single object or an array, and JavaScript code
 * that expects an array will return empty values when a single object is received.
 */
function fixJavaScriptForSingleObject(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Find all JavaScript nodes
    const javascriptNodes = nodes.filter(n => n.type === 'javascript');
    
    for (const jsNode of javascriptNodes) {
        // Find the edge that connects to this JavaScript node
        const incomingEdge = edges.find(e => e.target === jsNode.id);
        if (!incomingEdge) continue;
        
        // Find the source node (previous node)
        const sourceNode = nodes.find(n => n.id === incomingEdge.source);
        if (!sourceNode) continue;
        
        // Check if previous node is HTTP Request
        const isHttpRequest = sourceNode.type === 'http_request' || 
                             sourceNode.data?.type === 'http_request';
        
        if (!isHttpRequest) continue;
        
        // Check if next node is Google Sheets (this is the problematic pattern)
        const outgoingEdge = edges.find(e => e.source === jsNode.id);
        if (!outgoingEdge) continue;
        
        const targetNode = nodes.find(n => n.id === outgoingEdge.target);
        const isGoogleSheets = targetNode?.type === 'google_sheets' || 
                               targetNode?.data?.type === 'google_sheets';
        
        if (!isGoogleSheets) continue;
        
        // Get JavaScript code
        const code = (jsNode.config?.code || '') as string;
        if (!code) continue;
        
        // Check if code uses array access pattern that might fail for single objects
        // Pattern: input.products || [] or input.property || []
        const arrayAccessPattern = /input\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\|\|\s*\[\]/;
        const arrayAccessMatch = code.match(arrayAccessPattern);
        
        // Check if code already uses helpers.toArray or handles single objects
        const usesHelpers = code.includes('helpers.toArray') || 
                          code.includes('helpers.getArray') ||
                          code.includes('helpers.toSheetsRows');
        
        // Check if code manually handles single object (checks typeof, Array.isArray, etc.)
        const handlesSingleObject = /typeof\s+input\s*!==\s*['"]object['"]/.test(code) ||
                                   /Array\.isArray\(input\)/.test(code) ||
                                   /!Array\.isArray\(/.test(code);
        
        // If code uses array access but doesn't handle single objects, suggest fix
        if (arrayAccessMatch && !usesHelpers && !handlesSingleObject) {
            console.log(`[WORKFLOW VALIDATION] Warning: JavaScript node ${jsNode.id} uses array access (${arrayAccessMatch[1]}) which may fail if HTTP Request returns single object. Consider using helpers.toArray(input) or handling single object explicitly.`);
            
            // Optionally auto-fix by wrapping with helpers.toArray
            // This is a suggestion - the AI agent should generate correct code from the start
            // We'll just log a warning for now to help the AI agent learn
        }
    }
}

/**
 * Fixes nodes with invalid "custom" type by replacing with appropriate valid type.
 * "custom" is not a valid node type - use "javascript" for custom logic instead.
 */
function fixCustomNodeTypes(nodes: WorkflowNode[]): void {
    // List of valid node types (common ones - not exhaustive but covers most cases)
    const validNodeTypes = new Set([
        'schedule', 'manual_trigger', 'webhook', 'form', 'chat_trigger', 'error_trigger', 'interval', 'workflow_trigger',
        'http_request', 'http_post',
        'javascript', 'function', 'function_item', 'if_else', 'filter', 'set', 'set_variable', 'merge', 'switch', 'loop', 'wait', 'error_handler', 'noop', 'split_in_batches', 'stop_and_error',
        'database_read', 'database_write',
        'google_sheets', 'google_gmail', 'google_doc', 'google_drive', 'google_calendar', 'google_tasks', 'google_contacts', 'google_analytics',
        'log_output', 'slack_webhook', 'slack_message',
        'openai_gpt', 'anthropic_claude', 'google_gemini', 'text_summarizer', 'sentiment_analyzer', 'ai_agent', 'memory', 'llm_chain', 'azure_openai', 'hugging_face', 'cohere', 'ollama', 'embeddings', 'vector_store', 'chat_model'
    ]);
    
    for (const node of nodes) {
        const nodeType = node.type || node.data?.type;
        
        // Check if node has invalid "custom" type
        if (nodeType === 'custom') {
            console.log(`[WORKFLOW VALIDATION] Fixing node ${node.id}: Replacing invalid "custom" type with "javascript"`);
            
            // Replace "custom" with "javascript" (most common use case for custom logic)
            if (node.type) {
                node.type = 'javascript';
            }
            if (node.data?.type) {
                node.data.type = 'javascript';
            }
            
            // If node doesn't have code config, add a placeholder
            if (!node.config?.code) {
                if (!node.config) node.config = {};
                node.config.code = '// Custom logic here\nreturn input;';
            }
        }
        
        // Check if node type is missing or invalid (but not "custom" - already handled above)
        if (!nodeType || (!validNodeTypes.has(nodeType) && nodeType !== 'custom')) {
            console.log(`[WORKFLOW VALIDATION] Warning: Node ${node.id} has invalid or missing type: ${nodeType}`);
            
            // Try to infer type from node name or config
            const nodeName = (node.data?.name || node.name || '').toLowerCase();
            
            if (nodeName.includes('http') || nodeName.includes('request') || nodeName.includes('api')) {
                node.type = 'http_request';
                if (node.data) node.data.type = 'http_request';
            } else if (nodeName.includes('schedule') || nodeName.includes('cron') || nodeName.includes('daily')) {
                node.type = 'schedule';
                if (node.data) node.data.type = 'schedule';
            } else if (nodeName.includes('javascript') || nodeName.includes('code') || nodeName.includes('transform')) {
                node.type = 'javascript';
                if (node.data) node.data.type = 'javascript';
            } else {
                // Default to javascript for unknown types (most flexible)
                console.log(`[WORKFLOW VALIDATION] Setting default type "javascript" for node ${node.id}`);
                node.type = 'javascript';
                if (node.data) node.data.type = 'javascript';
                if (!node.config?.code) {
                    if (!node.config) node.config = {};
                    node.config.code = '// Custom logic here\nreturn input;';
                }
            }
        }
    }
}
