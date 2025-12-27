# Quick Guide: Import JSON Workflows

## ✅ Import Feature Added!

I've added an **Import JSON** feature to your workflow builder. Here's how to use it:

## How to Import

### Method 1: Using the Import Button (Easiest)

1. **Open your workflow builder**
   - Go to `/workflow/new` (new workflow) or `/workflow/:id` (existing workflow)

2. **Click the Settings menu** (⚙️ icon) in the top-right corner

3. **Click "Import JSON"** from the dropdown menu

4. **Select your JSON file** from the file picker
   - Navigate to `test_workflows/` folder
   - Choose any workflow JSON file (e.g., `crm_workflow_1_hubspot.json`)

5. **Done!** The workflow will be imported and displayed on the canvas

### Method 2: Copy-Paste JSON (Alternative)

If you prefer to copy-paste JSON directly:

1. Open the JSON file in a text editor
2. Copy the entire JSON content
3. Open browser console (F12)
4. Run:
   ```javascript
   const workflowData = /* paste your JSON here */;
   // The import feature will handle it automatically when you use the Import button
   ```

## Imported Workflow Files

All test workflow files are in the `test_workflows/` directory:

### CRM Workflows (8 files):
- `crm_workflow_1_hubspot.json`
- `crm_workflow_2_salesforce.json`
- `crm_workflow_3_zoho_crm.json`
- `crm_workflow_4_pipedrive.json`
- `crm_workflow_5_freshdesk.json`
- `crm_workflow_6_intercom.json`
- `crm_workflow_7_mailchimp.json`
- `crm_workflow_8_activecampaign.json`

## After Importing

1. **Verify nodes** are displayed correctly on the canvas
2. **Check node configurations** in the Properties Panel
3. **Update credentials** (API keys, tokens, etc.) as needed
4. **Save the workflow** to persist it
5. **Test the workflow** using the Run button

## Notes

- ✅ Imported workflows will replace the current workflow
- ✅ You can import into a new or existing workflow
- ✅ The workflow name will be updated from the JSON file
- ✅ All nodes and edges will be imported correctly
- ✅ Remember to save after importing!

## Troubleshooting

**Issue:** "Invalid workflow format"
- **Solution:** Make sure your JSON has `nodes` and `edges` arrays

**Issue:** Nodes not displaying
- **Solution:** Check browser console for errors, verify JSON format is valid

**Issue:** Import button not working
- **Solution:** Make sure you're on the workflow builder page (`/workflow/new` or `/workflow/:id`)

---

## Quick Test

Try importing a test workflow now:

1. Open workflow builder: `/workflow/new`
2. Click Settings (⚙️) → Import JSON
3. Select `test_workflows/crm_workflow_1_hubspot.json`
4. Verify the workflow appears on canvas
5. Save the workflow

That's it! 🎉

