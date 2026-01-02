# CRM & Marketing Nodes Test Workflows

This directory contains 8 test workflows for testing CRM & Marketing nodes.

## Workflow Files

1. **crm_workflow_1_hubspot.json** - Test HubSpot node
   - Tests: Get contact operation
   - Requires: HubSpot API key or OAuth token

2. **crm_workflow_2_salesforce.json** - Test Salesforce node
   - Tests: Query contacts using SOQL
   - Requires: Salesforce instance URL and OAuth token

3. **crm_workflow_3_zoho_crm.json** - Test Zoho CRM node
   - Tests: Get contact operation
   - Requires: Zoho CRM OAuth token and API domain

4. **crm_workflow_4_pipedrive.json** - Test Pipedrive node
   - Tests: Get person operation
   - Requires: Pipedrive API token and company domain

5. **crm_workflow_5_freshdesk.json** - Test Freshdesk node
   - Tests: List tickets operation
   - Requires: Freshdesk API key and domain

6. **crm_workflow_6_intercom.json** - Test Intercom node
   - Tests: Get contact operation
   - Requires: Intercom access token

7. **crm_workflow_7_mailchimp.json** - Test Mailchimp node
   - Tests: List audiences operation
   - Requires: Mailchimp API key and data center

8. **crm_workflow_8_activecampaign.json** - Test ActiveCampaign node
   - Tests: Get contact operation
   - Requires: ActiveCampaign API key and API URL

## How to Use

1. Import each JSON file into your workflow system
2. Configure authentication credentials in the CRM node settings
3. Update IDs/parameters with actual values from your CRM account
4. Run the workflow using Manual Trigger
5. Check Log Output nodes for results

## Expected Results

Each workflow should:
- ✅ Execute without errors
- ✅ Authenticate with the CRM API
- ✅ Retrieve/list data successfully
- ✅ Display results in Log Output

## Important Notes

- Replace placeholder credentials with actual API keys/tokens
- Some workflows require existing records (contacts, tickets, etc.)
- Use actual IDs from your CRM account
- Most operations are read-only (get/list) for safe testing
- API calls may incur costs or count against rate limits
- Test with valid credentials for accurate results

## Getting API Credentials

See `CRM_NODES_TEST_GUIDE.md` for detailed instructions on obtaining API credentials for each CRM platform.

