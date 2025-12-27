# CRM & Marketing Nodes Testing Guide

## CRM Nodes Overview

The following 8 CRM & Marketing nodes are available in the workflow system:

1. **HubSpot** - Enterprise Marketing CRM
2. **Salesforce** - Enterprise Platform CRM
3. **Zoho CRM** - Multi-Module CRM System
4. **Pipedrive** - Deal-Centric CRM
5. **Freshdesk** - Support CRM
6. **Intercom** - Conversational CRM
7. **Mailchimp** - Email Marketing
8. **ActiveCampaign** - Automation CRM

---

## Test Workflow 1: HubSpot - Get Contact

**Purpose:** Test HubSpot node for retrieving a contact

**Description:** This workflow tests the HubSpot node's ability to get a contact by ID.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Set** → Set contact ID
3. **HubSpot** → Get contact by ID
4. **Log Output** → Display the result

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Set**
- Fields (JSON):
```json
{
  "contactId": "123"
}
```

**Node 3: HubSpot**
- Authentication Type: `API Key` or `OAuth2 Access Token`
- API Key: `your-hubspot-api-key` (if using API Key)
- OAuth2 Access Token: `your-oauth-access-token` (if using OAuth)
- Resource: `contact`
- Operation: `get`
- ID: `{{contactId}}`

**Node 4: Log Output**
- Message: `HubSpot Contact: {{contact}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Contact data is retrieved successfully
❌ **FAIL** if: Authentication error, contact not found, or API error

### Prerequisites:
- HubSpot account with API access
- Valid API key or OAuth2 access token
- At least one contact in your HubSpot account

---

## Test Workflow 2: Salesforce - Query Contacts

**Purpose:** Test Salesforce node for querying contacts using SOQL

**Description:** This workflow tests the Salesforce node's ability to query contacts using SOQL.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Salesforce** → Query contacts using SOQL
3. **Log Output** → Display the results

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Salesforce**
- Instance URL: `https://yourinstance.salesforce.com`
- OAuth2 Access Token: `your-oauth-access-token`
- Resource/Object: `Contact`
- Operation: `query`
- SOQL: `SELECT Id, Name, Email FROM Contact LIMIT 10`

**Node 3: Log Output**
- Message: `Salesforce Results: {{results}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Contacts are queried successfully and results are returned
❌ **FAIL** if: Authentication error, SOQL syntax error, or API error

### Prerequisites:
- Salesforce org with API access
- Valid OAuth2 access token
- At least one contact in your Salesforce org

---

## Test Workflow 3: Zoho CRM - Get Contact

**Purpose:** Test Zoho CRM node for retrieving a contact

**Description:** This workflow tests the Zoho CRM node's ability to get a contact by ID.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Set** → Set contact ID
3. **Zoho CRM** → Get contact by ID
4. **Log Output** → Display the result

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Set**
- Fields (JSON):
```json
{
  "contactId": "123456789"
}
```

**Node 3: Zoho CRM**
- OAuth2 Access Token: `your-oauth-access-token`
- API Domain: `https://www.zohoapis.com` (or your region: .eu, .in, .com.cn, .com.au, .jp)
- Module: `Contacts`
- Operation: `get`
- ID: `{{contactId}}`

**Node 4: Log Output**
- Message: `Zoho CRM Contact: {{contact}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Contact data is retrieved successfully
❌ **FAIL** if: Authentication error, contact not found, or API error

### Prerequisites:
- Zoho CRM account with API access
- Valid OAuth2 access token
- At least one contact in your Zoho CRM

---

## Test Workflow 4: Pipedrive - Get Person

**Purpose:** Test Pipedrive node for retrieving a person

**Description:** This workflow tests the Pipedrive node's ability to get a person by ID.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Set** → Set person ID
3. **Pipedrive** → Get person by ID
4. **Log Output** → Display the result

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Set**
- Fields (JSON):
```json
{
  "personId": "123"
}
```

**Node 3: Pipedrive**
- API Token: `your-api-token`
- Company Domain: `yourcompany` (without .pipedrive.com)
- Resource: `person`
- Operation: `get`
- ID: `{{personId}}`

**Node 4: Log Output**
- Message: `Pipedrive Person: {{person}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Person data is retrieved successfully
❌ **FAIL** if: Authentication error, person not found, or API error

### Prerequisites:
- Pipedrive account with API access
- Valid API token
- At least one person in your Pipedrive account

---

## Test Workflow 5: Freshdesk - List Tickets

**Purpose:** Test Freshdesk node for listing tickets

**Description:** This workflow tests the Freshdesk node's ability to list tickets.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Freshdesk** → List tickets
3. **Log Output** → Display the results

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Freshdesk**
- API Key: `your-api-key`
- Domain: `yourcompany` (without .freshdesk.com)
- Resource: `ticket`
- Operation: `list`
- Limit: `10`

**Node 3: Log Output**
- Message: `Freshdesk Tickets: {{tickets}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Tickets are listed successfully
❌ **FAIL** if: Authentication error or API error

### Prerequisites:
- Freshdesk account with API access
- Valid API key
- At least one ticket in your Freshdesk account (optional for testing)

---

## Test Workflow 6: Intercom - Get Contact

**Purpose:** Test Intercom node for retrieving a contact

**Description:** This workflow tests the Intercom node's ability to get a contact by ID.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Set** → Set contact ID
3. **Intercom** → Get contact by ID
4. **Log Output** → Display the result

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Set**
- Fields (JSON):
```json
{
  "contactId": "123456"
}
```

**Node 3: Intercom**
- Access Token: `your-access-token`
- Resource: `contact`
- Operation: `get`
- ID: `{{contactId}}`

**Node 4: Log Output**
- Message: `Intercom Contact: {{contact}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Contact data is retrieved successfully
❌ **FAIL** if: Authentication error, contact not found, or API error

### Prerequisites:
- Intercom account with API access
- Valid access token
- At least one contact in your Intercom account

---

## Test Workflow 7: Mailchimp - List Audiences

**Purpose:** Test Mailchimp node for listing audiences/lists

**Description:** This workflow tests the Mailchimp node's ability to list audiences.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Mailchimp** → List audiences
3. **Log Output** → Display the results

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Mailchimp**
- API Key: `your-api-key`
- Data Center: `us1` (or us2, eu1, etc.)
- Resource: `audience`
- Operation: `list`
- Count: `10`
- Offset: `0`

**Node 3: Log Output**
- Message: `Mailchimp Audiences: {{audiences}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Audiences are listed successfully
❌ **FAIL** if: Authentication error or API error

### Prerequisites:
- Mailchimp account with API access
- Valid API key
- Note: You can test even without audiences, as the API will return an empty list

---

## Test Workflow 8: ActiveCampaign - Get Contact

**Purpose:** Test ActiveCampaign node for retrieving a contact

**Description:** This workflow tests the ActiveCampaign node's ability to get a contact by ID.

**Node Flow:**
1. **Manual Trigger** → Start the workflow
2. **Set** → Set contact ID
3. **ActiveCampaign** → Get contact by ID
4. **Log Output** → Display the result

### Configuration:

**Node 1: Manual Trigger**
- No configuration needed

**Node 2: Set**
- Fields (JSON):
```json
{
  "contactId": "123"
}
```

**Node 3: ActiveCampaign**
- API Key: `your-api-key`
- API URL: `https://youraccount.api-us1.com` (or your region)
- Resource: `contact`
- Operation: `get`
- ID: `{{contactId}}`

**Node 4: Log Output**
- Message: `ActiveCampaign Contact: {{contact}}`
- Level: `info`

### Expected Result:
✅ **PASS** if: Contact data is retrieved successfully
❌ **FAIL** if: Authentication error, contact not found, or API error

### Prerequisites:
- ActiveCampaign account with API access
- Valid API key and API URL
- At least one contact in your ActiveCampaign account

---

## Prerequisites for Testing

Before running these workflows, ensure:

1. **CRM Account Access:**
   - Create accounts on the respective CRM platforms
   - Enable API access in account settings
   - Generate API keys, tokens, or OAuth credentials

2. **Authentication Credentials:**
   - **HubSpot:** API Key or OAuth2 Access Token
   - **Salesforce:** OAuth2 Access Token + Instance URL
   - **Zoho CRM:** OAuth2 Access Token + API Domain
   - **Pipedrive:** API Token + Company Domain
   - **Freshdesk:** API Key + Domain
   - **Intercom:** Access Token
   - **Mailchimp:** API Key + Data Center
   - **ActiveCampaign:** API Key + API URL

3. **Test Data:**
   - Some workflows require existing records (contacts, tickets, etc.)
   - Use actual IDs from your CRM account
   - For "list" operations, test data is optional

4. **Network & Rate Limits:**
   - Internet connectivity required
   - Respect API rate limits
   - Some CRMs have daily/hourly API limits

---

## Testing Checklist

For each workflow, verify:

- [ ] Workflow executes without errors
- [ ] Authentication credentials are valid and configured
- [ ] CRM node successfully connects to the API
- [ ] Operation completes successfully
- [ ] Output logs show expected data format
- [ ] No API errors or rate limit issues
- [ ] Error handling works (test with invalid credentials)

---

## Common Issues & Solutions

### Issue: "Authentication failed" or "Invalid credentials"
**Solution:** 
- Verify API keys/tokens are correct
- Check if credentials have expired (OAuth tokens)
- Ensure API access is enabled in your CRM account
- Verify the authentication method matches your account type

### Issue: "Resource not found" or "404 error"
**Solution:** 
- Verify the ID exists in your CRM account
- Check that the resource type matches your data structure
- Use correct ID format (numeric vs string)

### Issue: "Rate limit exceeded"
**Solution:** 
- Wait before retrying
- Check your API plan limits
- Implement delays between requests
- Use batch operations when possible

### Issue: "Invalid API URL" or "Domain not found"
**Solution:** 
- Verify instance URL/domain is correct
- Check for typos (e.g., .com vs .com.au)
- Ensure you're using the correct region/data center

### Issue: "Permission denied" or "Access forbidden"
**Solution:** 
- Check API permissions in your CRM account
- Verify the user/role has required permissions
- Review API scope settings for OAuth tokens

---

## Getting API Credentials

### HubSpot
1. Go to Settings → Integrations → Private Apps
2. Create a private app or use API key from account settings

### Salesforce
1. Setup → Platform Tools → Apps → App Manager
2. Create a connected app
3. Use OAuth2 flow to get access token

### Zoho CRM
1. Go to Setup → Developer Space → Client ID
2. Create OAuth client
3. Generate access token via OAuth2 flow

### Pipedrive
1. Settings → Personal → API
2. Copy your API token

### Freshdesk
1. Profile Settings → API
2. Generate API key

### Intercom
1. Settings → Developers → Authentication
2. Create access token

### Mailchimp
1. Account → Extras → API keys
2. Generate API key (shows data center)

### ActiveCampaign
1. Settings → Developer → API Access
2. Generate API key and API URL

---

## Notes

- These workflows use "get" or "list" operations (read-only) for safety
- Replace placeholder credentials with actual values
- Test with different IDs/resources to verify functionality
- Monitor API usage to avoid unexpected limits
- Some workflows may take several seconds due to API latency
- Log Output nodes help verify that operations succeeded
- For production, use environment variables for credentials instead of hardcoding
- Most CRMs have API documentation for detailed operation guides

