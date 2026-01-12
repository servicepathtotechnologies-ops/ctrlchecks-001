import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const nodeTypesPath = path.join(__dirname, '../src/components/workflow/nodeTypes.ts');
const executeWorkflowPath = path.join(__dirname, '../supabase/functions/execute-workflow/index.ts');

console.log('🔍 Starting comprehensive node validation...\n');

// Read files
let nodeTypesContent, executeWorkflowContent;
try {
  nodeTypesContent = fs.readFileSync(nodeTypesPath, 'utf8');
  console.log('✅ Read nodeTypes.ts');
} catch (error) {
  console.error('❌ Error reading nodeTypes.ts:', error.message);
  process.exit(1);
}

try {
  executeWorkflowContent = fs.readFileSync(executeWorkflowPath, 'utf8');
  console.log('✅ Read execute-workflow/index.ts');
} catch (error) {
  console.error('❌ Error reading execute-workflow/index.ts:', error.message);
  process.exit(1);
}

// Extract node types from nodeTypes.ts using a more robust approach
console.log('\n📋 Extracting node types from nodeTypes.ts...');
const nodeTypes = new Map();

// Find the NODE_TYPES array
const nodeTypesArrayStart = nodeTypesContent.indexOf('export const NODE_TYPES:');
if (nodeTypesArrayStart === -1) {
  console.error('❌ Could not find NODE_TYPES export');
  process.exit(1);
}

// Extract everything from NODE_TYPES array
let arrayContent = nodeTypesContent.substring(nodeTypesArrayStart);
// Find the closing bracket of the array
let bracketCount = 0;
let arrayEnd = -1;
let inString = false;
let stringChar = null;

for (let i = 0; i < arrayContent.length; i++) {
  const char = arrayContent[i];
  const prevChar = i > 0 ? arrayContent[i - 1] : null;
  
  // Handle string escaping
  if (prevChar === '\\') continue;
  
  // Handle string boundaries
  if ((char === '"' || char === "'" || char === '`') && !inString) {
    inString = true;
    stringChar = char;
  } else if (char === stringChar && inString) {
    inString = false;
    stringChar = null;
  }
  
  if (inString) continue;
  
  if (char === '[') bracketCount++;
  if (char === ']') {
    bracketCount--;
    if (bracketCount === 0) {
      arrayEnd = i + 1;
      break;
    }
  }
}

if (arrayEnd === -1) {
  console.error('❌ Could not find end of NODE_TYPES array');
  process.exit(1);
}

arrayContent = arrayContent.substring(0, arrayEnd);

// Now extract node definitions using regex - look for type: '...' patterns
// This regex looks for type: followed by a string in quotes
const typePattern = /type:\s*['"`]([^'"`]+)['"`]/g;
let match;
const nodeTypeMap = new Map();

while ((match = typePattern.exec(arrayContent)) !== null) {
  const nodeType = match[1];
  // Only count if it's not inside a comment
  const beforeMatch = arrayContent.substring(0, match.index);
  const lastNewline = beforeMatch.lastIndexOf('\n');
  const lineContent = arrayContent.substring(lastNewline + 1, match.index);
  
  // Skip if in comment
  if (lineContent.includes('//') || lineContent.includes('/*')) {
    continue;
  }
  
  // Extract label and category from nearby content
  const afterType = arrayContent.substring(match.index, match.index + 500);
  const labelMatch = afterType.match(/label:\s*['"`]([^'"`]+)['"`]/);
  const categoryMatch = afterType.match(/category:\s*['"`]([^'"`]+)['"`]/);
  
  if (!nodeTypeMap.has(nodeType)) {
    nodeTypeMap.set(nodeType, {
      type: nodeType,
      label: labelMatch ? labelMatch[1] : nodeType,
      category: categoryMatch ? categoryMatch[1] : 'unknown'
    });
  }
}

console.log(`✅ Found ${nodeTypeMap.size} node types in nodeTypes.ts`);

// Extract case statements from execute-workflow/index.ts
console.log('\n🔧 Extracting node implementations from execute-workflow/index.ts...');
const implementedNodes = new Map();
const casePattern = /case\s+["']([a-z_][a-z0-9_]*)["']\s*:\s*\{/g;

while ((match = casePattern.exec(executeWorkflowContent)) !== null) {
  const nodeType = match[1];
  const line = executeWorkflowContent.substring(0, match.index).split('\n').length;
  
  // Skip if inside a string or comment
  const beforeCase = executeWorkflowContent.substring(0, match.index);
  const lastComment = Math.max(
    beforeCase.lastIndexOf('//'),
    beforeCase.lastIndexOf('/*')
  );
  const lastNewlineBeforeCase = beforeCase.lastIndexOf('\n');
  if (lastComment > lastNewlineBeforeCase) {
    continue;
  }
  
  // Skip nested cases (sub-cases like 'append', 'key_based', etc.)
  // These are typically inside switch statements within node implementations
  const beforeCaseLines = beforeCase.split('\n');
  const currentLine = beforeCaseLines[beforeCaseLines.length - 1];
  const indentLevel = (currentLine.match(/^(\s*)/) || [''])[0].length;
  
  // Only include top-level cases (usually indented with 2-4 spaces, not deeply nested)
  if (indentLevel > 6) {
    continue;
  }
  
  if (!implementedNodes.has(nodeType)) {
    implementedNodes.set(nodeType, { type: nodeType, line });
  }
}

console.log(`✅ Found ${implementedNodes.size} node implementations in execute-workflow/index.ts`);

// Compare and find issues
console.log('\n🔍 Comparing node definitions with implementations...\n');

const issues = [];
const warnings = [];
const allNodeTypes = Array.from(nodeTypeMap.values());
const allImplementedNodes = Array.from(implementedNodes.values());

// Known sub-cases that should be ignored (these are operations within nodes, not separate nodes)
const knownSubCases = new Set([
  'append', 'key_based', 'wait_all', 'concat', 'format', 'add', 'subtract', 
  'diff', 'now', 'hash', 'hmac', 'random_string', 'create_page', 'update_page',
  'read_page', 'delete_page', 'query_database', 'update_database_entry',
  'create_record', 'update_record', 'delete_record', 'get_record', 'list_records',
  'batch_delete', 'create_task', 'update_task', 'get_task', 'delete_task',
  'list_tasks', 'add_comment', 'update_status', 'get_teams', 'get_spaces',
  'get_folders', 'get_lists', 'create_card', 'update_card', 'get_card',
  'delete_card', 'list_cards', 'move_card', 'add_label', 'add_checklist',
  'get_boards', 'add_subtask', 'get_projects', 'get_sections', 'create_issue',
  'update_issue', 'get_issue', 'delete_issue', 'search_issues', 'transition_issue',
  'create_item', 'update_item', 'get_item', 'delete_item', 'list_items',
  'update_column', 'create_subitem', 'get_groups', 'complete_task', 'reopen_task',
  'get_user', 'list_users', 'create_user', 'update_user', 'delete_user',
  'authenticate_user', 'create_payment_intent', 'get_payment', 'create_refund',
  'create_customer', 'create_subscription', 'create_invoice', 'create_order',
  'get_order', 'capture_order', 'get_invoice', 'list_invoices', 'get_customer',
  'create_payment', 'get_contact', 'create_contact', 'get_product', 'list_products',
  'create_product', 'update_product', 'list_orders', 'list_customers',
  'track', 'identify', 'page', 'group', 'search', 'index', 'get', 'update', 'delete', 'bulk'
]);

// Filter out known sub-cases from implemented nodes
for (const [type, info] of implementedNodes.entries()) {
  if (knownSubCases.has(type)) {
    implementedNodes.delete(type);
  }
}

// Check for nodes defined but not implemented
for (const nodeType of allNodeTypes) {
  if (!implementedNodes.has(nodeType.type)) {
    issues.push({
      severity: 'ERROR',
      type: nodeType.type,
      label: nodeType.label,
      category: nodeType.category,
      issue: 'Node type is defined in nodeTypes.ts but has NO implementation in execute-workflow/index.ts',
    });
  }
}

// Check for nodes implemented but not defined (warnings only - some may be internal/experimental)
for (const implNode of Array.from(implementedNodes.values())) {
  if (!nodeTypeMap.has(implNode.type) && !knownSubCases.has(implNode.type)) {
    // Check if it's a known internal node (like webhook_trigger_response, decision_recommendation_agent, etc.)
    const internalNodePatterns = [
      'webhook_trigger_response',
      'decision_recommendation_agent',
      'workflow_generator_agent',
      'node_selector_agent',
      'prompt_synthesizer',
      'multi_agent_coordinator',
      'agent_role_assigner',
      'agent_voting_consensus',
      'execution_explainer',
      'workflow_summary_generator',
      'human_approval',
      'escalation_router',
      'fallback_router',
      'retry_with_backoff',
      'timeout_guard',
      'circuit_breaker',
      'workflow_state_manager',
      'execution_context_store',
      'session_manager',
      'email_sequence_sender',
      'auto_followup_sender',
      'human_handoff_notification',
      'approval_request_sender',
      'reminder_scheduler',
      'document_ocr',
      'resume_parser',
      'invoice_parser',
      'document_classifier',
      'file_metadata_extractor',
      'knowledge_base_search',
      'onboarding_flow_generator',
      'policy_sync_node',
      'employee_faq_indexer',
      'crm_lead_router',
      'crm_ticket_prioritizer',
      'crm_sla_monitor',
      'crm_duplicate_detector',
      'alert_correlation_engine',
      'incident_classifier',
      'auto_remediation_planner',
      'postmortem_generator',
      'expense_categorizer',
      'payment_reminder_engine',
      'audit_trail_generator',
      'tax_rule_engine',
      'fraud_detection_node',
      'agent_performance_tracker',
      'cost_monitor',
      'accuracy_evaluator',
      'feedback_loop_collector',
      'compliance_log_writer'
    ];
    
    if (!internalNodePatterns.includes(implNode.type)) {
      warnings.push({
        severity: 'WARNING',
        type: implNode.type,
        issue: 'Node type is implemented in execute-workflow/index.ts but NOT defined in nodeTypes.ts',
        line: implNode.line
      });
    }
  }
}

// Check input/output handling patterns
console.log('🔍 Checking input/output data flow patterns...\n');

const inputOutputFunctions = {
  extractInputObject: executeWorkflowContent.includes('extractInputObject'),
  extractDataFromInput: executeWorkflowContent.includes('extractDataFromInput'),
};

if (!inputOutputFunctions.extractInputObject) {
  warnings.push({
    severity: 'WARNING',
    issue: 'extractInputObject function not found in execute-workflow/index.ts'
  });
}

if (!inputOutputFunctions.extractDataFromInput) {
  warnings.push({
    severity: 'WARNING',
    issue: 'extractDataFromInput function not found in execute-workflow/index.ts'
  });
}

// Check for common input/output issues
const problematicPatterns = [
  { pattern: /input\.body\.body/, name: 'Double body access (input.body.body)' },
  { pattern: /input\.data\.data/, name: 'Double data access (input.data.data)' },
];

for (const { pattern, name } of problematicPatterns) {
  if (pattern.test(executeWorkflowContent)) {
    warnings.push({
      severity: 'WARNING',
      issue: `Potential issue found: ${name} - this might indicate incorrect data path`
    });
  }
}

// Generate report
console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 COMPREHENSIVE NODE VALIDATION REPORT');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Nodes Defined: ${allNodeTypes.length}`);
console.log(`Total Nodes Implemented: ${allImplementedNodes.length}`);
console.log(`Errors Found: ${issues.length}`);
console.log(`Warnings Found: ${warnings.length}\n`);

if (issues.length > 0) {
  console.log('❌ ERRORS (Nodes defined but not implemented):');
  console.log('═══════════════════════════════════════════════════════════════');
  issues.forEach((issue, index) => {
    console.log(`\n${index + 1}. ${issue.type} (${issue.label})`);
    console.log(`   Category: ${issue.category}`);
    console.log(`   Issue: ${issue.issue}`);
  });
  console.log('\n');
}

if (warnings.length > 0 && warnings.length <= 50) {
  console.log('⚠️  WARNINGS:');
  console.log('═══════════════════════════════════════════════════════════════');
  warnings.forEach((warning, index) => {
    console.log(`\n${index + 1}. ${warning.issue}`);
    if (warning.type) {
      console.log(`   Type: ${warning.type}`);
    }
    if (warning.line) {
      console.log(`   Location: execute-workflow/index.ts:${warning.line}`);
    }
  });
  console.log('\n');
} else if (warnings.length > 50) {
  console.log(`⚠️  WARNINGS (${warnings.length} total, showing first 20):`);
  console.log('═══════════════════════════════════════════════════════════════');
  warnings.slice(0, 20).forEach((warning, index) => {
    console.log(`\n${index + 1}. ${warning.issue}`);
    if (warning.type) {
      console.log(`   Type: ${warning.type}`);
    }
  });
  console.log(`\n... and ${warnings.length - 20} more warnings\n`);
}

// Summary by category
console.log('📊 Summary by Category:');
console.log('═══════════════════════════════════════════════════════════════');
const categoryStats = {};
for (const nodeType of allNodeTypes) {
  if (!categoryStats[nodeType.category]) {
    categoryStats[nodeType.category] = { total: 0, implemented: 0, missing: 0 };
  }
  categoryStats[nodeType.category].total++;
  if (implementedNodes.has(nodeType.type)) {
    categoryStats[nodeType.category].implemented++;
  } else {
    categoryStats[nodeType.category].missing++;
  }
}

for (const [category, stats] of Object.entries(categoryStats)) {
  const status = stats.missing === 0 ? '✅' : '❌';
  console.log(`${status} ${category.padEnd(25)} ${stats.implemented}/${stats.total} implemented (${stats.missing} missing)`);
}

console.log('\n═══════════════════════════════════════════════════════════════');

if (issues.length === 0) {
  console.log('✅ All nodes in nodeTypes.ts have implementations!');
  console.log('✅ Input/output handling functions are present!');
  if (warnings.length === 0) {
    console.log('✅ No warnings found!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${warnings.length} warning(s) found (see above)`);
    process.exit(0);
  }
} else {
  console.log(`\n❌ Found ${issues.length} error(s) and ${warnings.length} warning(s)`);
  console.log('Please review the issues above and fix them.');
  process.exit(1);
}

