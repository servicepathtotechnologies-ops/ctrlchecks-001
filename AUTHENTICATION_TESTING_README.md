# Authentication Nodes Testing - Quick Start

This directory contains everything you need to test authentication nodes individually.

## Files Overview

1. **AUTHENTICATION_NODES_TESTING_GUIDE.md** - Complete detailed guide with all properties, descriptions, and examples
2. **authentication-nodes-test-configs.json** - Ready-to-use test configurations for all authentication nodes
3. **scripts/extract-auth-node-properties.js** - Reference code showing how to programmatically access node properties

## Quick Start

### Step 1: Choose a Node to Test

There are 6 authentication nodes available:
1. **OAuth2** (`oauth2`)
2. **JWT** (`jwt`)
3. **LDAP** (`ldap`)
4. **Okta** (`okta`)
5. **Auth0** (`auth0`)
6. **Keycloak** (`keycloak`)

### Step 2: Get the Node Properties

Each node has specific properties defined in `src/components/workflow/nodeTypes.ts`. 

**To see all properties for a node:**
1. Open `AUTHENTICATION_NODES_TESTING_GUIDE.md`
2. Navigate to the node you want to test
3. Review the properties table

### Step 3: How to Access Properties in Code

Node properties are stored in `node.data.config` as a `Record<string, unknown>`.

```typescript
// Example: Accessing OAuth2 node properties
const config = node.data.config;

const operation = config.operation as string;           // "get_access_token"
const clientId = config.clientId as string;             // "your-client-id"
const clientSecret = config.clientSecret as string;     // "your-client-secret"
const tokenUrl = config.tokenUrl as string;             // "https://oauth.example.com/token"

// For JSON fields, you may need to parse:
const userData = typeof config.userData === 'string'
  ? JSON.parse(config.userData)
  : config.userData;
```

### Step 4: Use Test Configurations

Open `authentication-nodes-test-configs.json` to find ready-to-use test configurations for each node and operation type.

Example for testing OAuth2 with authorization code:

```json
{
  "operation": "get_access_token",
  "grantType": "authorization_code",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "tokenUrl": "https://oauth.example.com/token",
  "authorizationUrl": "https://oauth.example.com/authorize",
  "redirectUri": "https://yourapp.com/callback",
  "code": "authorization-code-here",
  "scope": "read write"
}
```

### Step 5: Create a Test Node Object

When testing, you need to create a node object with this structure:

```json
{
  "id": "test-node-1",
  "type": "oauth2",
  "data": {
    "label": "OAuth2",
    "type": "oauth2",
    "category": "authentication",
    "config": {
      // ... properties from step 4
    }
  }
}
```

## Property Types Reference

- **text**: String value
- **number**: Numeric value  
- **select**: One of the provided options (stored as string)
- **json**: JSON object or array (may need to be stringified when setting, parsed when reading)
- **boolean**: true/false
- **textarea**: Multi-line text (stored as string)

## Important Notes

1. **Required Fields**: Properties marked as `required: true` must be provided
2. **Conditional Requirements**: Some properties are only required for specific operations (e.g., `code` is only needed for `authorization_code` grant type in OAuth2)
3. **JSON Fields**: Properties of type `json` may need special handling (stringify when setting, parse when reading)
4. **Default Values**: Some properties have default values - check the guide for details
5. **Help Text**: Each property includes `helpText` explaining how to obtain values (see detailed guide)

## Testing Each Node Separately

### OAuth2 Node
- **Location**: Line 5891 in `nodeTypes.ts`
- **Test all operations**: get_access_token, refresh_token, validate_token, revoke_token
- **Test all grant types**: authorization_code, client_credentials, password, refresh_token

### JWT Node
- **Location**: Line 5990 in `nodeTypes.ts`
- **Test all operations**: sign, verify, decode
- **Test all algorithms**: HS256, HS384, HS512, RS256, RS384, RS512

### LDAP Node
- **Location**: Line 6060 in `nodeTypes.ts`
- **Test all operations**: authenticate, search, bind

### Okta Node
- **Location**: Line 6148 in `nodeTypes.ts`
- **Test all operations**: get_user, list_users, create_user, update_user, delete_user, authenticate_user

### Auth0 Node
- **Location**: Line 6220 in `nodeTypes.ts`
- **Test all operations**: get_user, list_users, create_user, update_user, delete_user, get_token

### Keycloak Node
- **Location**: Line 6299 in `nodeTypes.ts`
- **Test all operations**: get_token, refresh_token, get_user, list_users, create_user, update_user

## Where to Find Node Definitions

All node definitions are in: `src/components/workflow/nodeTypes.ts`

Authentication nodes start at line **5888**.

## Helper Functions Reference

The execution engine uses these helper functions to safely access properties:

```typescript
function getStringProperty(obj: Record<string, unknown>, key: string, defaultValue: string): string {
  const value = obj[key];
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

function getNumberProperty(obj: Record<string, unknown>, key: string, defaultValue: number): number {
  const value = obj[key];
  if (typeof value === 'number') {
    return value;
  }
  return defaultValue;
}
```

See `scripts/extract-auth-node-properties.js` for complete examples.

## Need More Details?

Refer to **AUTHENTICATION_NODES_TESTING_GUIDE.md** for:
- Complete property descriptions
- All available options for select fields
- Detailed test configuration examples
- How to obtain credential values (Client ID, API tokens, etc.)

