# Authentication Nodes Testing Guide

This guide provides complete information about all Authentication nodes and how to test them individually.

## Table of Contents
1. [How to Get Node Properties Values](#how-to-get-node-properties-values)
2. [Authentication Nodes List](#authentication-nodes-list)
   - [1. OAuth2 Node](#1-oauth2-node)
   - [2. JWT Node](#2-jwt-node)
   - [3. LDAP Node](#3-ldap-node)
   - [4. Okta Node](#4-okta-node)
   - [5. Auth0 Node](#5-auth0-node)
   - [6. Keycloak Node](#6-keycloak-node)

---

## How to Get Node Properties Values

Node properties are accessed from the `config` object in each node. The properties are stored in `node.data.config` as a `Record<string, unknown>`.

### Accessing Properties in Code

When testing nodes, you can access properties like this:

```typescript
// In executeNode function
const config = node.data.config;

// Access string properties
const clientId = config.clientId as string;
const clientSecret = config.clientSecret as string;

// Access number properties
const limit = config.limit as number;

// Access JSON properties (parse if needed)
const userData = typeof config.userData === 'string' 
  ? JSON.parse(config.userData) 
  : config.userData;

// Access select properties (they're strings)
const operation = config.operation as string;
```

### Using Helper Functions

The execution engine uses helper functions to safely access properties:

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

### Testing Node Properties

To test a node, you need to provide a `config` object with all required properties. Here's an example:

```json
{
  "id": "node-1",
  "type": "oauth2",
  "data": {
    "label": "OAuth2",
    "type": "oauth2",
    "category": "authentication",
    "config": {
      "operation": "get_access_token",
      "grantType": "authorization_code",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "tokenUrl": "https://example.com/oauth/token",
      "authorizationUrl": "https://example.com/oauth/authorize",
      "redirectUri": "https://your-app.com/callback",
      "code": "authorization-code-here",
      "scope": "read write"
    }
  }
}
```

---

## Authentication Nodes List

### 1. OAuth2 Node

**Type:** `oauth2`  
**Category:** `authentication`  
**Description:** OAuth2 authentication and token management

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `get_access_token` | Operation to perform |
| `grantType` | Grant Type | select | Yes | `authorization_code` | OAuth grant type |
| `clientId` | Client ID | text | Yes | - | OAuth application client ID |
| `clientSecret` | Client Secret | text | Yes | - | OAuth application client secret |
| `tokenUrl` | Token URL | text | Yes | - | OAuth token endpoint URL |
| `authorizationUrl` | Authorization URL | text | No | - | Required for authorization_code flow |
| `redirectUri` | Redirect URI | text | No | - | Required for authorization_code flow |
| `code` | Authorization Code | text | No | - | Required for authorization_code grant |
| `refreshToken` | Refresh Token | text | No | - | Required for refresh_token operation |
| `scope` | Scope | text | No | - | Space-separated scopes (e.g., "read write") |

#### Operation Options
- `get_access_token` - Get Access Token
- `refresh_token` - Refresh Token
- `validate_token` - Validate Token
- `revoke_token` - Revoke Token

#### Grant Type Options
- `authorization_code` - Authorization Code
- `client_credentials` - Client Credentials
- `password` - Password
- `refresh_token` - Refresh Token

#### Test Configuration Example

```json
{
  "operation": "get_access_token",
  "grantType": "authorization_code",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "tokenUrl": "https://oauth.example.com/token",
  "authorizationUrl": "https://oauth.example.com/authorize",
  "redirectUri": "https://yourapp.com/callback",
  "code": "abc123xyz",
  "scope": "read write"
}
```

---

### 2. JWT Node

**Type:** `jwt`  
**Category:** `authentication`  
**Description:** JSON Web Token generation and verification

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `sign` | Operation to perform |
| `algorithm` | Algorithm | select | Yes | `HS256` | JWT signing algorithm |
| `secret` | Secret/Key | text | Yes | - | Secret key for HS* or private key for RS* |
| `payload` | Payload (JSON) | json | Yes* | - | JWT payload as JSON (required for sign) |
| `token` | JWT Token | text | No* | - | JWT token string (required for verify/decode) |
| `expiresIn` | Expiration Time | text | No | - | Token expiration (e.g., "1h", "24h", "7d") |

*Note: `payload` required for `sign`, `token` required for `verify`/`decode`*

#### Operation Options
- `sign` - Sign Token
- `verify` - Verify Token
- `decode` - Decode Token

#### Algorithm Options
- `HS256` - HMAC SHA-256
- `HS384` - HMAC SHA-384
- `HS512` - HMAC SHA-512
- `RS256` - RSA SHA-256
- `RS384` - RSA SHA-384
- `RS512` - RSA SHA-512

#### Test Configuration Example (Sign)

```json
{
  "operation": "sign",
  "algorithm": "HS256",
  "secret": "your-secret-key",
  "payload": "{\"sub\": \"user123\", \"exp\": 1735689600, \"iat\": 1735686000}",
  "expiresIn": "1h"
}
```

#### Test Configuration Example (Verify)

```json
{
  "operation": "verify",
  "algorithm": "HS256",
  "secret": "your-secret-key",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0..."
}
```

---

### 3. LDAP Node

**Type:** `ldap`  
**Category:** `authentication`  
**Description:** LDAP authentication and directory operations

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `authenticate` | Operation to perform |
| `serverUrl` | LDAP Server URL | text | Yes | - | LDAP server URL (e.g., ldap://ldap.example.com:389) |
| `bindDn` | Bind DN | text | Yes | - | Distinguished Name for binding |
| `bindPassword` | Bind Password | text | Yes | - | Password for binding |
| `userDn` | User DN | text | No | - | User Distinguished Name for authentication |
| `username` | Username | text | No | - | Username (alternative to User DN) |
| `password` | Password | text | No | - | User password for authentication |
| `searchBase` | Search Base | text | No | - | Base DN for search operations |
| `searchFilter` | Search Filter | text | No | - | LDAP search filter (e.g., "(uid=username)") |
| `attributes` | Attributes | json | No | - | Array of attributes to retrieve in search |

#### Operation Options
- `authenticate` - Authenticate
- `search` - Search
- `bind` - Bind

#### Test Configuration Example (Authenticate)

```json
{
  "operation": "authenticate",
  "serverUrl": "ldap://ldap.example.com:389",
  "bindDn": "cn=admin,dc=example,dc=com",
  "bindPassword": "admin-password",
  "userDn": "uid=user,ou=users,dc=example,dc=com",
  "password": "user-password"
}
```

#### Test Configuration Example (Search)

```json
{
  "operation": "search",
  "serverUrl": "ldap://ldap.example.com:389",
  "bindDn": "cn=admin,dc=example,dc=com",
  "bindPassword": "admin-password",
  "searchBase": "dc=example,dc=com",
  "searchFilter": "(uid=username)",
  "attributes": "[\"cn\", \"mail\", \"uid\"]"
}
```

---

### 4. Okta Node

**Type:** `okta`  
**Category:** `authentication`  
**Description:** Okta SSO and identity management

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `get_user` | Operation to perform |
| `domain` | Okta Domain | text | Yes | - | Okta domain (e.g., your-domain.okta.com) |
| `apiToken` | API Token | text | Yes | - | Okta API token |
| `userId` | User ID | text | No* | - | Required for get_user, update_user, delete_user |
| `userData` | User Data (JSON) | json | No* | - | Required for create_user/update_user |
| `query` | Query | text | No | - | Okta filter query for list_users |
| `limit` | Limit | number | No | 200 | Max results (default: 200) |

*Note: `userId` required for get_user, update_user, delete_user. `userData` required for create_user/update_user.*

#### Operation Options
- `get_user` - Get User
- `list_users` - List Users
- `create_user` - Create User
- `update_user` - Update User
- `delete_user` - Delete User
- `authenticate_user` - Authenticate User

#### Test Configuration Example (Get User)

```json
{
  "operation": "get_user",
  "domain": "dev-123456.okta.com",
  "apiToken": "your-api-token",
  "userId": "00u1abc23def456ghi"
}
```

#### Test Configuration Example (List Users)

```json
{
  "operation": "list_users",
  "domain": "dev-123456.okta.com",
  "apiToken": "your-api-token",
  "query": "status eq \"ACTIVE\"",
  "limit": 200
}
```

#### Test Configuration Example (Create User)

```json
{
  "operation": "create_user",
  "domain": "dev-123456.okta.com",
  "apiToken": "your-api-token",
  "userData": "{\"profile\": {\"firstName\": \"John\", \"lastName\": \"Doe\", \"email\": \"john@example.com\"}}"
}
```

---

### 5. Auth0 Node

**Type:** `auth0`  
**Category:** `authentication`  
**Description:** Auth0 identity and access management

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `get_user` | Operation to perform |
| `domain` | Auth0 Domain | text | Yes | - | Auth0 domain (e.g., your-tenant.auth0.com) |
| `clientId` | Client ID | text | Yes | - | Auth0 application client ID |
| `clientSecret` | Client Secret | text | Yes | - | Auth0 application client secret |
| `userId` | User ID | text | No* | - | Required for get_user, update_user, delete_user |
| `userData` | User Data (JSON) | json | No* | - | Required for create_user/update_user |
| `audience` | Audience | text | No | - | API identifier for get_token |
| `scope` | Scope | text | No | - | Space-separated scopes for get_token |

*Note: `userId` required for get_user, update_user, delete_user. `userData` required for create_user/update_user.*

#### Operation Options
- `get_user` - Get User
- `list_users` - List Users
- `create_user` - Create User
- `update_user` - Update User
- `delete_user` - Delete User
- `get_token` - Get Token

#### Test Configuration Example (Get User)

```json
{
  "operation": "get_user",
  "domain": "dev-abc123.us.auth0.com",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "userId": "auth0|123456789"
}
```

#### Test Configuration Example (Get Token)

```json
{
  "operation": "get_token",
  "domain": "dev-abc123.us.auth0.com",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "audience": "https://api.example.com",
  "scope": "read:users update:users"
}
```

#### Test Configuration Example (Create User)

```json
{
  "operation": "create_user",
  "domain": "dev-abc123.us.auth0.com",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "userData": "{\"email\": \"user@example.com\", \"password\": \"password123\", \"connection\": \"Username-Password-Authentication\"}"
}
```

---

### 6. Keycloak Node

**Type:** `keycloak`  
**Category:** `authentication`  
**Description:** Keycloak identity and access management

#### Properties

| Property Key | Label | Type | Required | Default Value | Description |
|-------------|-------|------|----------|---------------|-------------|
| `operation` | Operation | select | Yes | `get_token` | Operation to perform |
| `serverUrl` | Keycloak Server URL | text | Yes | - | Keycloak server URL |
| `realm` | Realm | text | Yes | - | Keycloak realm name |
| `clientId` | Client ID | text | Yes | - | Keycloak client ID |
| `clientSecret` | Client Secret | text | Yes | - | Keycloak client secret |
| `username` | Username | text | No* | - | Required for get_token (password grant) |
| `password` | Password | text | No* | - | Required for get_token (password grant) |
| `refreshToken` | Refresh Token | text | No* | - | Required for refresh_token operation |
| `userId` | User ID | text | No* | - | Required for get_user, update_user operations |

*Note: `username` and `password` required for get_token. `refreshToken` required for refresh_token. `userId` required for get_user, update_user.*

#### Operation Options
- `get_token` - Get Token
- `refresh_token` - Refresh Token
- `get_user` - Get User
- `list_users` - List Users
- `create_user` - Create User
- `update_user` - Update User

#### Test Configuration Example (Get Token)

```json
{
  "operation": "get_token",
  "serverUrl": "https://keycloak.example.com",
  "realm": "master",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "username": "user@example.com",
  "password": "user-password"
}
```

#### Test Configuration Example (Refresh Token)

```json
{
  "operation": "refresh_token",
  "serverUrl": "https://keycloak.example.com",
  "realm": "master",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "refreshToken": "refresh-token-here"
}
```

#### Test Configuration Example (Get User)

```json
{
  "operation": "get_user",
  "serverUrl": "https://keycloak.example.com",
  "realm": "master",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "userId": "user-uuid-here"
}
```

---

## Testing Tips

1. **Start with Required Fields**: Always provide all required fields (marked with `required: true`) when testing.

2. **Test Each Operation Separately**: Each node supports multiple operations - test each one separately with appropriate properties.

3. **Handle JSON Fields**: Properties of type `json` need to be provided as JSON strings (e.g., `"{\"key\": \"value\"}"`) or as parsed objects depending on how the execution engine handles them.

4. **Use Default Values**: Some properties have default values - you can omit them to test with defaults.

5. **Conditional Requirements**: Some properties are only required for specific operations (e.g., `code` is only needed for `authorization_code` grant type in OAuth2).

6. **Check Help Text**: Each property has `helpText` that explains how to obtain values (e.g., "How to get Client ID: ...").

7. **Test Error Cases**: Also test with missing required fields, invalid formats, etc., to ensure proper error handling.

---

## Quick Reference: Property Types

- **text**: String value
- **number**: Numeric value
- **select**: One of the provided options (stored as string)
- **json**: JSON object or array (may need to be stringified)
- **boolean**: true/false
- **textarea**: Multi-line text (stored as string)

---

## Node Definition Location

All node definitions are located in: `src/components/workflow/nodeTypes.ts`

You can find the exact property definitions starting at line 5888 for authentication nodes.

