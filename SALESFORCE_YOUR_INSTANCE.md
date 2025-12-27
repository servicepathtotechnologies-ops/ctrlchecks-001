# Your Salesforce Instance Configuration

Based on your Salesforce URL, here's your instance information:

## Your Salesforce Instance

**Your Lightning URL**: `https://connect-agility-9124.lightning.force.com/lightning/page/home`

**Your Instance URL for API calls**: `https://connect-agility-9124.my.salesforce.com`

---

## Quick Configuration Steps

### 1. Get Your Access Token

Use one of these methods:

#### Method A: Salesforce Workbench (Fastest)

1. Go to: https://workbench.developerforce.com/login.php
2. Log in with your Salesforce credentials
3. After login, go to: **Info** → **Session Information**
4. Copy:
   - **Session ID** = Your Access Token
   - Verify the Server URL matches your instance

#### Method B: Create Connected App

1. In Salesforce, go to **Setup** (gear icon)
2. Search for **App Manager**
3. Click **New Connected App**
4. Configure:
   - **Connected App Name**: `Flow Genius AI Integration`
   - **Enable OAuth Settings**: ✅
   - **Callback URL**: `http://localhost:8080/oauth/callback`
   - **Selected OAuth Scopes**:
     - ✅ `Access and manage your data (api)`
     - ✅ `Perform requests on your behalf at any time (refresh_token, offline_access)`
5. **Save** and copy your **Consumer Key** and **Consumer Secret**
6. Get access token using Postman or cURL (see SALESFORCE_CREDENTIALS_GUIDE.md)

### 2. Configure Your Workflow

1. **Import** `crm_workflow_2_salesforce.json` into your workflow builder
2. **Click the Salesforce node**
3. **Set the following**:
   - **Instance URL**: `https://connect-agility-9124.my.salesforce.com`
   - **OAuth2 Access Token**: `YOUR_ACCESS_TOKEN` (from Step 1)
   - **Resource/Object**: `Contact`
   - **Operation**: `query`
   - **SOQL**: `SELECT Id, Name, Email FROM Contact LIMIT 10`
4. **Save and Run**

---

## Important Notes

### URL Format Differences

- **Lightning UI URL**: `https://connect-agility-9124.lightning.force.com/...`
- **API Instance URL**: `https://connect-agility-9124.my.salesforce.com`
- **API Base URL**: `https://connect-agility-9124.my.salesforce.com/services/data/v57.0/`

### Testing Your Configuration

Once you have your access token, test it:

```bash
curl https://connect-agility-9124.my.salesforce.com/services/data/v57.0/sobjects/Contact/describe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

If successful, you'll get JSON describing the Contact object.

---

## Example SOQL Queries

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

## Troubleshooting

**If you get "Invalid Login" or "401 Unauthorized"**:
- Verify your access token is correct and not expired
- Check that the instance URL is exactly: `https://connect-agility-9124.my.salesforce.com`
- Ensure your user has API access enabled

**If you get "Session Expired"**:
- Access tokens expire after ~2 hours of inactivity
- Get a new access token from Workbench or refresh your OAuth token

**If you get "Insufficient Access Rights"**:
- Check your user profile permissions
- Ensure API access is enabled in your profile
- Verify OAuth scopes include `api` permission

---

For more detailed instructions, see `SALESFORCE_CREDENTIALS_GUIDE.md`

