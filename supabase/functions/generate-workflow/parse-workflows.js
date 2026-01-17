/**
 * Helper script to parse 250 workflows and convert to TrainingExample format
 * This script generates the workflow data to be added to training-examples.ts
 */

// Node name mapping from snake_case to display format
const nodeNameMap = {
  'form': 'Form',
  'google_gmail': 'Google Gmail',
  'manual_trigger': 'Manual Trigger',
  'google_sheets': 'Google Sheets',
  'javascript': 'JavaScript',
  'webhook': 'Webhook',
  'database_write': 'Database Write',
  'schedule': 'Schedule Trigger',
  'http_request': 'HTTP Request',
  'if_else': 'If/Else',
  'slack_message': 'Slack Message',
  'chat_trigger': 'Chat Trigger',
  'google_gemini': 'Google Gemini',
  'database_read': 'Database Read',
  'read_binary_file': 'Read Binary File',
  'write_binary_file': 'Write Binary File',
  'aws_s3': 'AWS S3',
  'log_output': 'Log Output',
  'interval': 'Interval Trigger',
  'error_trigger': 'Error Trigger',
  'loop_over_items': 'Loop Over Items',
  'loop': 'Loop',
  'switch': 'Switch',
  'openai_gpt': 'OpenAI GPT',
  'memory': 'Memory',
  'chat_response': 'Chat Response',
  'respond_to_webhook': 'Respond to Webhook',
  'database_delete': 'Database Delete',
  'google_doc': 'Google Doc',
  'sms_send': 'SMS Send'
};

function mapNodeName(nodeName) {
  // Remove underscores and convert to title case
  const mapped = nodeNameMap[nodeName.toLowerCase()];
  if (mapped) return mapped;
  
  // Fallback: convert snake_case to Title Case
  return nodeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Parse workflows from the user's input
// This is a simplified parser - in production, you'd parse the full text
function parseWorkflows(text) {
  const workflows = [];
  const workflowRegex = /Workflow\s+(\d+)[\s\S]*?User Prompt:\s*"([^"]+)"[\s\S]*?Corrected Nodes:\s*([^\n]+)[\s\S]*?Flowchart:([^\n]+)/g;
  
  let match;
  while ((match = workflowRegex.exec(text)) !== null) {
    const [, num, prompt, nodesStr, flowchart] = match;
    const nodes = nodesStr.split('→').map(n => n.trim()).filter(n => n);
    const mappedNodes = nodes.map(mapNodeName);
    
    workflows.push({
      num: parseInt(num),
      prompt: prompt.trim(),
      nodes: mappedNodes,
      flowchart: flowchart ? flowchart.trim() : null
    });
  }
  
  return workflows;
}

// Generate TrainingExample objects
function generateTrainingExamples(workflows) {
  return workflows.map(w => {
    // Generate title from prompt (first few words)
    const titleWords = w.prompt.split(' ').slice(0, 6).join(' ');
    const title = titleWords.length > 50 ? titleWords.substring(0, 47) + '...' : titleWords;
    
    // Generate description (simplified version of prompt)
    const description = w.prompt.length > 100 
      ? w.prompt.substring(0, 97) + '...' 
      : w.prompt;
    
    // Generate patterns based on nodes and prompt
    const patterns = [];
    if (w.nodes.some(n => n.includes('Form'))) {
      patterns.push('Form trigger collects user input');
    }
    if (w.nodes.some(n => n.includes('Webhook'))) {
      patterns.push('Webhook trigger receives external data');
    }
    if (w.nodes.some(n => n.includes('Schedule') || n.includes('Interval'))) {
      patterns.push('Scheduled/interval trigger for recurring execution');
    }
    if (w.nodes.some(n => n.includes('Email') || n.includes('Gmail'))) {
      patterns.push('Google Gmail node sends email notifications');
    }
    if (w.nodes.some(n => n.includes('Slack'))) {
      patterns.push('Slack notification for team alerts');
    }
    if (w.nodes.some(n => n.includes('Database'))) {
      patterns.push('Database operation for data persistence');
    }
    if (w.nodes.some(n => n.includes('JavaScript'))) {
      patterns.push('JavaScript node for data transformation');
    }
    if (w.nodes.some(n => n.includes('If/Else') || n.includes('Switch'))) {
      patterns.push('Conditional logic for routing data');
    }
    if (w.nodes.some(n => n.includes('AI') || n.includes('Gemini') || n.includes('GPT'))) {
      patterns.push('AI node for intelligent processing');
    }
    if (w.nodes.some(n => n.includes('Loop'))) {
      patterns.push('Loop node for iterating over items');
    }
    
    // Generate data flow from flowchart or nodes
    let dataFlow = null;
    if (w.flowchart) {
      dataFlow = w.flowchart.replace(/\[|\]/g, '').trim();
    } else {
      dataFlow = w.nodes.join(' → ');
    }
    
    return {
      prompt: w.prompt,
      title: title,
      description: description,
      nodesUsed: w.nodes,
      patterns: patterns.length > 0 ? patterns : ['Standard workflow pattern'],
      dataFlow: dataFlow
    };
  });
}

module.exports = { parseWorkflows, generateTrainingExamples, mapNodeName };

