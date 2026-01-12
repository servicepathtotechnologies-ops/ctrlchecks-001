import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const nodeTypesPath = path.join(__dirname, '../src/components/workflow/nodeTypes.ts');
const executeWorkflowPath = path.join(__dirname, '../supabase/functions/execute-workflow/index.ts');

console.log('🔍 Starting comprehensive node library check...\n');

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

// Extract node types from nodeTypes.ts
console.log('\n📋 Extracting node types from nodeTypes.ts...');
const nodeTypes = new Map();

// Better pattern: look for object start followed by type property
const lines = nodeTypesContent.split('\n');
let inNodeDefinition = false;
let currentNode = null;
let braceDepth = 0;
let inConfigFields = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Check if we're starting a node definition (object starting with type)
  if (trimmed === '{' && !inNodeDefinition) {
    // Look ahead a few lines to see if this is a node definition
    let foundType = false;
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      if (lines[j].includes("type: '") && lines[j].includes("label: '") && lines[j].includes("category: '")) {
        foundType = true;
        break;
      }
      if (lines[j].trim().startsWith('configFields')) {
        break; // This is not a node definition
      }
    }
    if (foundType) {
      inNodeDefinition = true;
      braceDepth = 1;
      currentNode = {};
    }
  }
  
  if (inNodeDefinition) {
    // Track brace depth
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceDepth += openBraces - closeBraces;
    
    // Extract type, label, category
    const typeMatch = line.match(/type:\s*'([^']+)'/);
    const labelMatch = line.match(/label:\s*'([^']+)'/);
    const categoryMatch = line.match(/category:\s*'([^']+)'/);
    
    if (typeMatch) currentNode.type = typeMatch[1];
    if (labelMatch) currentNode.label = labelMatch[1];
    if (categoryMatch) currentNode.category = categoryMatch[1];
    
    // Check if we're in configFields
    if (trimmed.includes('configFields')) {
      inConfigFields = true;
    }
    
    // If brace depth reaches 0, we've completed the node definition
    if (braceDepth === 0 && currentNode.type && currentNode.label && currentNode.category) {
      if (!inConfigFields) { // Only add if not inside configFields
        nodeTypes.set(currentNode.type, { 
          type: currentNode.type, 
          label: currentNode.label, 
          category: currentNode.category, 
          line: i + 1 
        });
      }
      inNodeDefinition = false;
      currentNode = null;
      inConfigFields = false;
    }
  }
}

// Fallback: use regex as backup if parsing failed
if (nodeTypes.size === 0) {
  console.log('⚠️  Object parsing failed, trying regex fallback...');
  const nodeTypePattern = /^\s*type:\s*'([a-z_][a-z0-9_]*)',/gm;
  let match;
  while ((match = nodeTypePattern.exec(nodeTypesContent)) !== null) {
    const beforeMatch = nodeTypesContent.substring(0, match.index);
    const lastConfigFields = beforeMatch.lastIndexOf('configFields');
    const lastNodeStart = beforeMatch.lastIndexOf('{\n    type:');
    
    if (lastConfigFields > lastNodeStart) continue;
    
    const type = match[1];
    const lineNum = nodeTypesContent.substring(0, match.index).split('\n').length;
    
    // Try to extract label and category from nearby lines
    const linesAround = nodeTypesContent.substring(Math.max(0, match.index - 500), match.index + 500);
    const labelMatch = linesAround.match(new RegExp(`type:\\s*'${type}',[\\s\\S]*?label:\\s*'([^']+)'`));
    const categoryMatch = linesAround.match(new RegExp(`type:\\s*'${type}',[\\s\\S]*?category:\\s*'([^']+)'`));
    
    if (!nodeTypes.has(type)) {
      nodeTypes.set(type, { 
        type, 
        label: labelMatch ? labelMatch[1] : type, 
        category: categoryMatch ? categoryMatch[1] : 'unknown', 
        line: lineNum 
      });
    }
  }
}

console.log(`✅ Found ${nodeTypes.size} node types in nodeTypes.ts`);

// Extract case statements from execute-workflow/index.ts
console.log('\n🔧 Extracting node implementations from execute-workflow/index.ts...');
const casePattern = /case\s+["']([a-z_][a-z0-9_]*)["']\s*:\s*\{/g;
const implementedNodes = new Map();
let caseMatch;

while ((caseMatch = casePattern.exec(executeWorkflowContent)) !== null) {
  const nodeType = caseMatch[1];
  const line = executeWorkflowContent.substring(0, caseMatch.index).split('\n').length;
  
  // Skip if inside a string or comment
  const beforeCase = executeWorkflowContent.substring(0, caseMatch.index);
  const lastComment = Math.max(
    beforeCase.lastIndexOf('//'),
    beforeCase.lastIndexOf('/*'),
    beforeCase.lastIndexOf('*')
  );
  const lastNewlineBeforeCase = beforeCase.lastIndexOf('\n');
  if (lastComment > lastNewlineBeforeCase) {
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
const allNodeTypes = Array.from(nodeTypes.values());
const allImplementedNodes = Array.from(implementedNodes.values());

// Check for nodes defined but not implemented
for (const nodeType of allNodeTypes) {
  if (!implementedNodes.has(nodeType.type)) {
    issues.push({
      severity: 'ERROR',
      type: nodeType.type,
      label: nodeType.label,
      category: nodeType.category,
      issue: 'Node type is defined in nodeTypes.ts but has NO implementation in execute-workflow/index.ts',
      line: nodeType.line
    });
  }
}

// Check for nodes implemented but not defined (should not happen, but good to check)
for (const implNode of allImplementedNodes) {
  if (!nodeTypes.has(implNode.type)) {
    warnings.push({
      severity: 'WARNING',
      type: implNode.type,
      issue: 'Node type is implemented in execute-workflow/index.ts but NOT defined in nodeTypes.ts',
      line: implNode.line
    });
  }
}

// Check input/output handling patterns
console.log('🔍 Checking input/output data flow patterns...\n');

// Look for extractInputObject and extractDataFromInput usage
const inputOutputPatterns = {
  extractInputObject: executeWorkflowContent.includes('extractInputObject'),
  extractDataFromInput: executeWorkflowContent.includes('extractDataFromInput'),
};

if (!inputOutputPatterns.extractInputObject) {
  warnings.push({
    severity: 'WARNING',
    issue: 'extractInputObject function not found in execute-workflow/index.ts'
  });
}

if (!inputOutputPatterns.extractDataFromInput) {
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
console.log('📊 NODE LIBRARY CHECK REPORT');
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
    console.log(`   Location: nodeTypes.ts:${issue.line}`);
  });
  console.log('\n');
}

if (warnings.length > 0) {
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

if (issues.length === 0 && warnings.length === 0) {
  console.log('✅ All nodes are properly defined and implemented!');
  console.log('✅ Input/output handling looks good!');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${issues.length} error(s) and ${warnings.length} warning(s)`);
  console.log('Please review the issues above and fix them.');
  process.exit(issues.length > 0 ? 1 : 0);
}

