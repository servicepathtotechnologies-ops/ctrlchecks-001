# CRM & Marketing Nodes Quick Test Summary

## 8 Test Workflows Created

All workflows are available in the `test_workflows/` directory as JSON files.

### Workflow 1: HubSpot
**File:** `crm_workflow_1_hubspot.json`
**Tests:** Get contact operation
**Nodes:** Manual Trigger → Set → HubSpot → Log Output
**Auth Required:** API Key or OAuth2 Access Token

### Workflow 2: Salesforce
**File:** `crm_workflow_2_salesforce.json`
**Tests:** Query contacts using SOQL
**Nodes:** Manual Trigger → Salesforce → Log Output
**Auth Required:** OAuth2 Access Token + Instance URL

### Workflow 3: Zoho CRM
**File:** `crm_workflow_3_zoho_crm.json`
**Tests:** Get contact operation
**Nodes:** Manual Trigger → Set → Zoho CRM → Log Output
**Auth Required:** OAuth2 Access Token + API Domain

### Workflow 4: Pipedrive
**File:** `crm_workflow_4_pipedrive.json`
**Tests:** Get person operation
**Nodes:** Manual Trigger → Set → Pipedrive → Log Output
**Auth Required:** API Token + Company Domain

### Workflow 5: Freshdesk
**File:** `crm_workflow_5_freshdesk.json`
**Tests:** List tickets operation
**Nodes:** Manual Trigger → Freshdesk → Log Output
**Auth Required:** API Key + Domain

### Workflow 6: Intercom
**File:** `crm_workflow_6_intercom.json`
**Tests:** Get contact operation
**Nodes:** Manual Trigger → Set → Intercom → Log Output
**Auth Required:** Access Token

### Workflow 7: Mailchimp
**File:** `crm_workflow_7_mailchimp.json`
**Tests:** List audiences operation
**Nodes:** Manual Trigger → Mailchimp → Log Output
**Auth Required:** API Key + Data Center

### Workflow 8: ActiveCampaign
**File:** `crm_workflow_8_activecampaign.json`
**Tests:** Get contact operation
**Nodes:** Manual Trigger → Set → ActiveCampaign → Log Output
**Auth Required:** API Key + API URL

## Quick Testing Steps

1. **Import Workflow:** Load the JSON file into your workflow system
2. **Configure Credentials:** Add your API keys/tokens in the CRM node settings
3. **Update IDs:** Replace placeholder IDs with actual IDs from your CRM account
4. **Run Workflow:** Click "Run" on Manual Trigger node
5. **Check Results:** View Log Output node for CRM data

## Expected Output Format

Each workflow should output:
- **HubSpot/Zoho/Pipedrive/Intercom/ActiveCampaign:** `{{contact}}` or `{{person}}` - The retrieved record
- **Salesforce:** `{{results}}` - Query results array
- **Freshdesk:** `{{tickets}}` - List of tickets
- **Mailchimp:** `{{audiences}}` - List of audiences/lists

## Success Criteria

✅ **PASS** if:
- Workflow executes without errors
- Authentication succeeds
- CRM API connection works
- Data is retrieved/listed successfully
- Results appear in Log Output
- No API authentication errors

❌ **FAIL** if:
- Authentication error (invalid credentials)
- Resource not found (wrong ID or doesn't exist)
- API connection error
- Rate limit exceeded
- Permission denied error

## Authentication Quick Reference

| CRM | Credential Type | Where to Find |
|-----|----------------|---------------|
| HubSpot | API Key / OAuth Token | Settings → Integrations → Private Apps |
| Salesforce | OAuth Token + URL | Setup → Apps → Connected Apps |
| Zoho CRM | OAuth Token | Setup → Developer Space → Client ID |
| Pipedrive | API Token | Settings → Personal → API |
| Freshdesk | API Key | Profile Settings → API |
| Intercom | Access Token | Settings → Developers → Authentication |
| Mailchimp | API Key + Data Center | Account → Extras → API keys |
| ActiveCampaign | API Key + URL | Settings → Developer → API Access |

## Notes

- Replace placeholder credentials with actual values before testing
- Some workflows require existing records (use actual IDs from your CRM)
- All test workflows use read-only operations (get/list) for safety
- API calls may count against rate limits or incur costs
- Test with valid credentials for accurate results
- See `CRM_NODES_TEST_GUIDE.md` for detailed setup instructions

