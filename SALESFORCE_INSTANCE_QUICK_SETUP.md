# Salesforce Instance Setup - Quick Reference

## Your Instance Information

**Lightning URL**: `https://connect-agility-9124.lightning.force.com/lightning/page/home`

**API Instance URL**: `https://connect-agility-9124.my.salesforce.com`

---

## Step-by-Step Setup

### Step 1: Get Access Token (Choose One Method)

#### Option A: Workbench (Fastest - 2 minutes)

1. Go to: https://workbench.developerforce.com/login.php
2. Log in with your Salesforce credentials
3. Navigate to: **Info** → **Session Information**
4. Copy the **Session ID** (this is your access token)

#### Option B: Connected App (More Permanent)

1. **Setup** → **App Manager** → **New Connected App**
2. Enable OAuth Settings
3. Add OAuth Scopes: `api`, `refresh_token`, `offline_access`
4. Save and copy Consumer Key/Secret
5. Get access token (see detailed guide)

### Step 2: Configure Workflow

1. Open your Salesforce workflow
2. Click the Salesforce node
3. Enter:
   - **Instance URL**: `https://connect-agility-9124.my.salesforce.com`
   - **Access Token**: `YOUR_TOKEN_HERE`
   - **Resource**: `Contact`
   - **Operation**: `query`
   - **SOQL**: `SELECT Id, Name, Email FROM Contact LIMIT 10`

### Step 3: Test

Run the workflow and check the logs for results.

---

## Quick Test Query

Use this SOQL query to test:
```sql
SELECT Id, Name, Email FROM Contact LIMIT 10
```

---

**Note**: Access tokens expire after ~2 hours. Refresh if you get authentication errors.

