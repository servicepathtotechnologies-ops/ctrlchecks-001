# Salesforce Credentials - Quick Start Guide

## Fastest Way to Get Salesforce Credentials

### Option 1: Use Salesforce Workbench (Fastest for Testing)

1. **Go to**: https://workbench.developerforce.com/login.php
2. **Log in** with your Salesforce credentials
3. **After login**, go to: `Info` → `Session Information`
4. **Copy these values**:
   - **Session ID** = Your Access Token
   - **Server URL** = Your Instance URL (remove `/services/Soap/u/` and everything after)
   
   Example:
   - Server URL: `https://yourinstance.salesforce.com/services/Soap/u/57.0/00D...`
   - Instance URL: `https://yourinstance.salesforce.com`

5. **Use in your workflow**:
   - **Instance URL**: `https://yourinstance.salesforce.com`
   - **OAuth2 Access Token**: `00D...` (your Session ID)

⚠️ **Note**: Session IDs from Workbench expire after inactivity. Refresh if you get authentication errors.

---

### Option 2: Create Connected App (More Permanent)

1. **Salesforce Setup** → Search `App Manager` → `New Connected App`
2. **Configure**:
   - Name: `Flow Genius AI`
   - Enable OAuth Settings: ✅
   - Callback URL: `http://localhost:8080/oauth/callback`
   - OAuth Scopes: 
     - ✅ `Access and manage your data (api)`
     - ✅ `Perform requests on your behalf at any time (refresh_token, offline_access)`
3. **Save** → Copy **Consumer Key** and **Consumer Secret**
4. **Get Access Token** using Postman or cURL:

```bash
curl https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=password" \
  -d "client_id=YOUR_CONSUMER_KEY" \
  -d "client_secret=YOUR_CONSUMER_SECRET" \
  -d "username=YOUR_USERNAME" \
  -d "password=YOUR_PASSWORDYOUR_SECURITY_TOKEN"
```

**Get Security Token**: Setup → My Personal Information → Reset My Security Token

Response contains `access_token` and `instance_url`.

---

## Configure Your Workflow

1. **Open**: `crm_workflow_2_salesforce.json`
2. **Click Salesforce node**
3. **Set**:
   - **Instance URL**: `https://yourinstance.salesforce.com`
   - **OAuth2 Access Token**: Your access token
   - **Resource/Object**: `Contact`
   - **Operation**: `query`
   - **SOQL**: `SELECT Id, Name, Email FROM Contact LIMIT 10`
4. **Save and Run**

---

## Quick Test Query Examples

**Get Contacts**:
```sql
SELECT Id, Name, Email FROM Contact LIMIT 10
```

**Get Accounts**:
```sql
SELECT Id, Name, Industry FROM Account LIMIT 10
```

**Get Leads**:
```sql
SELECT Id, FirstName, LastName, Email FROM Lead LIMIT 10
```

---

## Common Issues

**"Invalid Login"**: Check username/password/security token  
**"Session Expired"**: Get a new token (tokens expire after ~2 hours)  
**"Insufficient Access"**: Check your user profile permissions

For detailed instructions, see `SALESFORCE_CREDENTIALS_GUIDE.md`

