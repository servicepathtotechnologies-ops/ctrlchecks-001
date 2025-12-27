# How to Import JSON Workflows into Your Project

This guide explains multiple ways to import the test workflow JSON files into your workflow builder.

## Method 1: Using Browser Console (Recommended - Quick)

This is the fastest way to import a workflow JSON file.

### Steps:

1. **Open your workflow builder** (create a new workflow or open an existing one)
2. **Open Browser Developer Tools:**
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Or `Cmd+Option+I` (Mac)
3. **Open the Console tab**
4. **Copy and paste this import function:**

```javascript
async function importWorkflowFromFile(filePath) {
  try {
    // Read the JSON file
    const response = await fetch(filePath);
    const workflowData = await response.json();
    
    // Import the workflow
    const store = window.__workflowStore || {};
    if (store.setNodes && store.setEdges && store.setWorkflowName) {
      store.setWorkflowName(workflowData.name || 'Imported Workflow');
      store.setNodes(workflowData.nodes || []);
      store.setEdges(workflowData.edges || []);
      console.log('✅ Workflow imported successfully!');
      return true;
    } else {
      console.error('❌ Workflow store not found. Make sure you are on the workflow builder page.');
      return false;
    }
  } catch (error) {
    console.error('❌ Error importing workflow:', error);
    return false;
  }
}

// Usage example:
// importWorkflowFromFile('/test_workflows/crm_workflow_1_hubspot.json');
```

5. **Import your workflow:**
   ```javascript
   // For local files (if running locally):
   await importWorkflowFromFile('/test_workflows/crm_workflow_1_hubspot.json');
   
   // Or if the file is in public folder:
   await importWorkflowFromFile('./test_workflows/crm_workflow_1_hubspot.json');
   ```

---

## Method 2: Manual Copy-Paste via Browser Console

If you can't access the file directly, you can copy-paste the JSON content.

### Steps:

1. **Open the JSON file** in a text editor (VS Code, Notepad++, etc.)
2. **Copy the entire JSON content**
3. **Open your workflow builder** and open Browser Console (F12)
4. **Paste and run this code** (replace `YOUR_JSON_CONTENT` with the copied JSON):

```javascript
const workflowData = YOUR_JSON_CONTENT; // Paste your JSON here

// Access the workflow store (adjust based on your store structure)
// For Zustand stores, you can access via window or use the store hook
console.log('Workflow Data:', workflowData);

// If you have access to the store methods:
// store.setWorkflowName(workflowData.name);
// store.setNodes(workflowData.nodes);
// store.setEdges(workflowData.edges);
```

---

## Method 3: Add Import Feature to Workflow Builder (Development)

If you want to add a permanent import feature, you can add this to your `WorkflowBuilder.tsx`:

### Add Import Function:

```typescript
const handleImportWorkflow = useCallback(async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const workflowData = JSON.parse(text);

      // Validate workflow structure
      if (!workflowData.nodes || !workflowData.edges) {
        throw new Error('Invalid workflow format: missing nodes or edges');
      }

      // Set workflow data
      setWorkflowName(workflowData.name || 'Imported Workflow');
      setNodes(workflowData.nodes as WorkflowNode[]);
      setEdges(workflowData.edges as Edge[]);
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
  };
  input.click();
}, [setWorkflowName, setNodes, setEdges, setIsDirty, toast]);
```

### Add Import Button to WorkflowHeader:

In your `WorkflowHeader.tsx`, add an import button:

```typescript
<Button onClick={handleImportWorkflow} variant="outline">
  <Upload className="mr-2 h-4 w-4" />
  Import JSON
</Button>
```

---

## Method 4: Using Supabase Database Directly (Advanced)

If you want to import workflows directly into the database:

### Steps:

1. **Open Supabase Dashboard** → SQL Editor
2. **Run this SQL** (adjust the JSON and user_id):

```sql
INSERT INTO workflows (name, nodes, edges, user_id, created_at, updated_at)
VALUES (
  'Test HubSpot Workflow',
  '[
    {
      "id": "node_1",
      "type": "custom",
      "position": { "x": 100, "y": 100 },
      "data": {
        "type": "manual_trigger",
        "label": "Manual Trigger",
        "category": "triggers",
        "icon": "Play",
        "config": {}
      }
    }
    -- ... rest of nodes
  ]'::jsonb,
  '[
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    }
    -- ... rest of edges
  ]'::jsonb,
  'YOUR_USER_ID_HERE',
  NOW(),
  NOW()
);
```

---

## Method 5: Simple Manual Import Script

Create a simple HTML file to import workflows:

### Create `import-workflow.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Workflow Importer</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    textarea { width: 100%; height: 400px; margin: 10px 0; }
    button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>Workflow JSON Importer</h1>
  <p>Paste your workflow JSON below and copy the formatted data:</p>
  <textarea id="jsonInput" placeholder='Paste your workflow JSON here...'></textarea>
  <button onclick="formatJSON()">Format & Copy</button>
  <script>
    function formatJSON() {
      const input = document.getElementById('jsonInput').value;
      try {
        const parsed = JSON.parse(input);
        const formatted = JSON.stringify(parsed, null, 2);
        navigator.clipboard.writeText(formatted).then(() => {
          alert('✅ Formatted JSON copied to clipboard!');
        });
      } catch (e) {
        alert('❌ Invalid JSON: ' + e.message);
      }
    }
  </script>
</body>
</html>
```

---

## Quick Import for Test Workflows

### For CRM Test Workflows:

1. **Navigate to workflow builder:** `/workflow/new`
2. **Open Browser Console** (F12)
3. **Run this command** (replace the file path):

```javascript
// Example: Import HubSpot workflow
fetch('/test_workflows/crm_workflow_1_hubspot.json')
  .then(r => r.json())
  .then(data => {
    // You'll need to access your Zustand store
    // This assumes the store is accessible globally or via React DevTools
    console.log('Workflow data loaded:', data);
    alert('Check console for workflow data. Use store methods to import.');
  });
```

---

## Recommended Approach

**For testing purposes, I recommend Method 1 or Method 3:**

- **Method 1** is quick and doesn't require code changes
- **Method 3** adds a permanent feature for future use

---

## Workflow JSON Structure

Your workflow JSON files should have this structure:

```json
{
  "name": "Workflow Name",
  "description": "Optional description",
  "nodes": [
    {
      "id": "node_1",
      "type": "custom",
      "position": { "x": 100, "y": 100 },
      "data": {
        "type": "node_type_id",
        "label": "Node Label",
        "category": "category_name",
        "icon": "IconName",
        "config": {
          // Node configuration
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

---

## Troubleshooting

### Issue: "Workflow store not found"
**Solution:** Make sure you're on the workflow builder page (`/workflow/new` or `/workflow/:id`)

### Issue: "Invalid workflow format"
**Solution:** Check that your JSON has `nodes` and `edges` arrays

### Issue: "Nodes not displaying"
**Solution:** Verify node IDs match between nodes and edges

### Issue: "Import button not working"
**Solution:** Make sure you've added the import handler and button correctly

---

## Next Steps

After importing:
1. **Verify nodes** are displayed correctly on the canvas
2. **Check node configurations** match your expectations
3. **Update credentials** (API keys, tokens, etc.) in node settings
4. **Test the workflow** using Manual Trigger
5. **Save the workflow** to persist it in the database

---

## Need Help?

If you encounter issues:
1. Check browser console for error messages
2. Verify JSON format is valid
3. Ensure you're logged in
4. Check that all node types exist in your node library

