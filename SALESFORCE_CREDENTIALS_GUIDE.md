# How to Get Salesforce Credentials for Workflow Testing

This guide will help you obtain the necessary Salesforce credentials to test the Salesforce CRM node.

## Required Credentials

For the Salesforce workflow, you need:
1. **Instance URL** - Your Salesforce instance URL (e.g., `https://yourinstance.salesforce.com`)
2. **OAuth2 Access Token** - An access token for API authentication

---

## Method 1: Using Salesforce Workbench (Easiest for Testing)

### Step 1: Access Salesforce Workbench

1. **Log into your Salesforce org**
2. **Navigate to Workbench**:
   - Go to: `https://workbench.developerforce.com/login.php`
   - Or install Workbench from AppExchange if you prefer an internal version

### Step 2: Log in and Get Token

1. **Log in** with your Salesforce credentials
2. **After login**, look at the URL - your instance URL is displayed
   - Example: `https://yourinstance.salesforce.com`
3. **Go to**: `Info` → `Session Information`
4. **Copy** the following values:
   - **Session ID** (this is your access token)
   - **Server URL** (this contains your instance URL)

**Note**: Session IDs from Workbench expire, so you'll need to refresh them periodically.

---

## Method 2: Using Salesforce Connected App (Recommended for Production)

### Step 1: Create a Connected App

1. **Log into Salesforce**
2. **Go to Setup** (gear icon in the top-right)
3. **In Quick Find**, search for `App Manager`
4. **Click "New Connected App"**

### Step 2: Configure Connected App

Fill in the following:

1. **Connected App Name**: `Flow Genius AI Integration` (or any name)
2. **API Name**: Auto-filled based on name
3. **Contact Email**: Your email address
4. **Enable OAuth Settings**: Check this box
5. **Callback URL**: 
   - For testing: `http://localhost:8080/oauth/callback`
   - For production: Your application's OAuth callback URL
6. **Selected OAuth Scopes**: Add the following scopes:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - `Access your basic information (id, profile, email, address, phone)`
7. **Click "Save"**

### Step 3: Get Consumer Key and Secret

1. After saving, you'll see your **Consumer Key** and **Consumer Secret**
2. **Copy these values** (you'll need them for OAuth flow)

### Step 4: Get Access Token (OAuth Flow)

For testing, you can use one of these methods:

#### Option A: Using cURL (Command Line)

```bash
# Replace these values:
# - YOUR_CONSUMER_KEY: From Connected App
# - YOUR_CONSUMER_SECRET: From Connected App  
# - YOUR_USERNAME: Your Salesforce username
# - YOUR_PASSWORD: Your Salesforce password
# - YOUR_SECURITY_TOKEN: Get from Setup → My Personal Information → Reset My Security Token
# - YOUR_INSTANCE_URL: e.g., https://yourinstance.salesforce.com

curl https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=password" \
  -d "client_id=YOUR_CONSUMER_KEY" \
  -d "client_secret=YOUR_CONSUMER_SECRET" \
  -d "username=YOUR_USERNAME" \
  -d "password=YOUR_PASSWORDYOUR_SECURITY_TOKEN"
```

The response will contain:
- `access_token`: Your access token
- `instance_url`: Your instance URL

#### Option B: Using Postman

1. **Create a new POST request**
2. **URL**: `https://login.salesforce.com/services/oauth2/token`
3. **Body** (x-www-form-urlencoded):
   - `grant_type`: `password`
   - `client_id`: Your Consumer Key
   - `client_secret`: Your Consumer Secret
   - `username`: Your Salesforce username
   - `password`: Your password + security token (concatenated)
4. **Send the request**
5. **Copy** the `access_token` and `instance_url` from the response

#### Option C: Using Salesforce REST API Explorer

1. **In Salesforce Setup**, search for "API" → "API"
2. **Use the REST API Explorer** to make a test call
3. **Copy** the authorization header value (Bearer token)

---

## Method 3: Using Salesforce CLI (For Developers)

If you have Salesforce CLI installed:

```bash
# Authenticate to your org
sf org login web

# Get access token
sf org display --json
```

This will show your access token and instance URL.

---

## Method 4: Get Security Token (If Needed)

If you're using username/password OAuth flow, you need your security token:

1. **Go to Setup** → **My Personal Information** → **Reset My Security Token**
2. **Click "Reset Security Token"**
3. **Check your email** for the security token
4. **Concatenate** password + security token when making OAuth requests

---

## Quick Test: Verify Your Credentials

Once you have your credentials, you can test them with a simple API call:

```bash
# Replace YOUR_ACCESS_TOKEN and YOUR_INSTANCE_URL
curl https://YOUR_INSTANCE_URL/services/data/v57.0/sobjects/Contact/describe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

If successful, you'll get JSON describing the Contact object.

---

## Using Credentials in Your Workflow

Once you have your credentials:

1. **Open your Salesforce test workflow** (`crm_workflow_2_salesforce.json`)
2. **Click the Salesforce node**
3. **Configure**:
   - **Instance URL**: `https://yourinstance.salesforce.com` (your instance URL)
   - **OAuth2 Access Token**: Your access token
   - **Resource/Object**: `Contact` (or any Salesforce object)
   - **Operation**: `query`
   - **SOQL**: `SELECT Id, Name, Email FROM Contact LIMIT 10`
4. **Save and run** the workflow

---

## Important Notes

### Token Expiration
- **Access tokens expire** after a period of inactivity (typically 2 hours)
- You'll need to **refresh your token** when it expires
- For production, implement token refresh logic

### Instance URL Format
- **Production**: `https://yourinstance.salesforce.com`
- **Sandbox**: `https://yourinstance--sandboxname.sandbox.my.salesforce.com`
- **Custom Domain**: `https://yourdomain.my.salesforce.com`

### OAuth Scopes
Make sure your connected app has these scopes:
- `api` - Access and manage your data
- `refresh_token` - Perform requests on your behalf at any time
- `id` - Access your basic information

### Security Best Practices
- **Never commit** access tokens to version control
- **Use environment variables** for credentials
- **Rotate tokens** regularly
- **Use IP restrictions** in Connected App settings if possible
- **Limit OAuth scopes** to minimum required permissions

---

## Troubleshooting

### Issue: "Invalid Login" Error
**Solution**: 
- Verify username and password are correct
- Make sure security token is correctly concatenated with password
- Check if your org requires IP restrictions

### Issue: "Invalid Client" Error
**Solution**:
- Verify Consumer Key and Consumer Secret are correct
- Check that the Connected App is activated

### Issue: "Session Expired" Error
**Solution**:
- Access tokens expire after inactivity
- Refresh your token or get a new one

### Issue: "Insufficient Access Rights" Error
**Solution**:
- Check your user profile permissions
- Verify OAuth scopes include required permissions
- Ensure you have API access enabled in your profile

---

## Alternative: Using Salesforce Sandbox

For testing, consider using a **Salesforce Sandbox**:
- Free development environment
- Won't affect production data
- Safe to experiment with

To create a sandbox:
1. **Setup** → **Sandboxes** → **New Sandbox**
2. **Select sandbox type** (Developer is free)
3. **Wait for sandbox creation** (can take a few minutes)
4. **Log into sandbox** and get credentials (same process as above)

---

## Need More Help?

- **Salesforce API Documentation**: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
- **OAuth Authentication Guide**: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm
- **Workbench**: https://workbench.developerforce.com/

