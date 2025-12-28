# OAuth2 Node Troubleshooting Guide

## Issue: "OAuth2: Client ID, Client Secret, and Token URL are required"

### Error Message
```
❌ ERROR:
OAuth2: Client ID, Client Secret, and Token URL are required
```

### Root Cause

The OAuth2 node requires three mandatory fields:
1. **Client ID** ✅ (filled in your case)
2. **Client Secret** ✅ (filled in your case)  
3. **Token URL** ❌ (empty/missing in your case)

The validation check in the code (line 11544 of `execute-workflow/index.ts`):
```typescript
if (!clientId || !clientSecret || !tokenUrl) {
  throw new Error('OAuth2: Client ID, Client Secret, and Token URL are required');
}
```

### Solution

**Fill in the Token URL field** in the Node Properties panel. The Token URL is the OAuth provider's token endpoint.

#### For Google OAuth (which your Client ID suggests):

Based on your Client ID format (`817082559298-d6h74dbptgl6q6led8fa0oklnu4nbv9r.ap`), this looks like Google OAuth.

**Google OAuth Token URL:**
```
https://oauth2.googleapis.com/token
```

#### Common OAuth Provider Token URLs:

| Provider | Token URL |
|----------|-----------|
| Google | `https://oauth2.googleapis.com/token` |
| Microsoft/Azure AD | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| GitHub | `https://github.com/login/oauth/access_token` |
| Facebook | `https://graph.facebook.com/v18.0/oauth/access_token` |
| Twitter/X | `https://api.twitter.com/2/oauth2/token` |
| LinkedIn | `https://www.linkedin.com/oauth/v2/accessToken` |
| Auth0 | `https://{your-domain}.auth0.com/oauth/token` |
| Generic OAuth2 | `https://{provider-domain}/oauth/token` |

### Complete OAuth2 Configuration Example (Google)

For testing with Google OAuth using authorization_code grant:

```json
{
  "operation": "get_access_token",
  "grantType": "authorization_code",
  "clientId": "817082559298-d6h74dbptgl6q6led8fa0oklnu4nbv9r.ap",
  "clientSecret": "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",
  "tokenUrl": "https://oauth2.googleapis.com/token",
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth",
  "redirectUri": "https://yourapp.com/callback",
  "code": "authorization-code-here",
  "scope": "openid email profile"
}
```

### Additional Required Fields Based on Operation

Depending on your **Operation** and **Grant Type**, you may need additional fields:

#### For `get_access_token` with `authorization_code` grant:
- ✅ Client ID (required)
- ✅ Client Secret (required)
- ✅ Token URL (required)
- ⚠️ Authorization URL (recommended)
- ⚠️ Redirect URI (recommended)
- ⚠️ Code (required - get this from OAuth callback)
- ⚠️ Scope (optional)

#### For `get_access_token` with `client_credentials` grant:
- ✅ Client ID (required)
- ✅ Client Secret (required)
- ✅ Token URL (required)
- ⚠️ Scope (optional)
- ❌ Code (not needed)
- ❌ Authorization URL (not needed)
- ❌ Redirect URI (not needed)

#### For `refresh_token` operation:
- ✅ Client ID (required)
- ✅ Client Secret (required)
- ✅ Token URL (required)
- ✅ Refresh Token (required - from previous token response)

### How to Fix in the UI

1. **Select your OAuth2 node** in the workflow canvas
2. **Look at the Node Properties panel** on the right
3. **Find the "Token URL" field** (marked with * as required)
4. **Enter the token endpoint URL** for your OAuth provider
   - For Google: `https://oauth2.googleapis.com/token`
5. **Click outside the field** to save (or the config auto-saves)
6. **Try running the workflow again**

### Verification Checklist

Before running the OAuth2 node, ensure:

- [ ] Client ID is filled
- [ ] Client Secret is filled
- [ ] Token URL is filled (this is what's missing!)
- [ ] If using `authorization_code` grant:
  - [ ] Authorization URL is provided
  - [ ] Redirect URI is provided
  - [ ] Authorization Code is provided (from OAuth callback)
- [ ] If using `refresh_token` operation:
  - [ ] Refresh Token is provided

### Property Name Reference

Make sure you're using the correct property keys in the config:

| Property Key | Label | Required |
|-------------|-------|----------|
| `operation` | Operation | Yes |
| `grantType` | Grant Type | Yes |
| `clientId` | Client ID | Yes |
| `clientSecret` | Client Secret | Yes |
| `tokenUrl` | Token URL | **Yes** ← Missing! |
| `authorizationUrl` | Authorization URL | No (but needed for auth_code) |
| `redirectUri` | Redirect URI | No (but needed for auth_code) |
| `code` | Authorization Code | No (but needed for auth_code) |
| `refreshToken` | Refresh Token | No (but needed for refresh) |
| `scope` | Scope | No |

### Debugging Tips

1. **Check the config object**: If you have access to the workflow JSON, verify that `tokenUrl` exists in `node.data.config`
2. **Check for typos**: Make sure the property key is exactly `tokenUrl` (camelCase)
3. **Check the execution logs**: The error message tells you exactly which fields are missing
4. **Test with minimal config**: Start with just the three required fields (clientId, clientSecret, tokenUrl) and a simple grant type like `client_credentials`

### Code Reference

The validation happens in:
- **File**: `supabase/functions/execute-workflow/index.ts`
- **Line**: 11544
- **Code**:
```typescript
const clientId = getStringProperty(config, 'clientId', '');
const clientSecret = getStringProperty(config, 'clientSecret', '');
const tokenUrl = getStringProperty(config, 'tokenUrl', '');

if (!clientId || !clientSecret || !tokenUrl) {
  throw new Error('OAuth2: Client ID, Client Secret, and Token URL are required');
}
```

### Next Steps

1. Fill in the Token URL field with your OAuth provider's token endpoint
2. If using Google OAuth: Use `https://oauth2.googleapis.com/token`
3. Save the workflow
4. Run the workflow again
5. If you still get errors, check the additional required fields based on your operation and grant type

