# New Nodes User Guide

## Overview

This guide covers 20 new nodes added to the Flow Genius AI workflow system, organized into 4 categories:

- **Authentication & Identity** (6 nodes)
- **Payment & Finance** (5 nodes)
- **E-commerce** (4 nodes)
- **Analytics & Data Tools** (5 nodes)

---

## Table of Contents

1. [Authentication & Identity Nodes](#authentication--identity-nodes)
2. [Payment & Finance Nodes](#payment--finance-nodes)
3. [E-commerce Nodes](#e-commerce-nodes)
4. [Analytics & Data Tools Nodes](#analytics--data-tools-nodes)
5. [Common Patterns & Best Practices](#common-patterns--best-practices)

---

## Authentication & Identity Nodes

### 1. OAuth2

**Purpose:** OAuth2 authentication and token management

**Operations:**
- Get Access Token
- Refresh Token
- Validate Token
- Revoke Token

**Configuration:**
- **Client ID***: OAuth application client ID
- **Client Secret***: OAuth application client secret
- **Token URL***: OAuth token endpoint (usually `https://provider.com/oauth/token`)
- **Grant Type***: Authorization Code, Client Credentials, Password, or Refresh Token
- **Authorization Code**: Required for authorization_code grant type
- **Refresh Token**: Required for refresh_token operation
- **Scope**: Space-separated list of scopes

**How to Get Credentials:**
1. Go to your OAuth provider's developer console
2. Create a new OAuth application
3. Copy the Client ID and Client Secret
4. Note the Token URL and Authorization URL from provider documentation

**Example Workflow:**
```
Manual Trigger → OAuth2 (Get Access Token) → HTTP Request (Use Token)
```

**Tips:**
- Use authorization_code for user authorization flows
- Use client_credentials for server-to-server authentication
- Store refresh tokens securely for automatic token renewal
- Token URL format: `https://provider.com/oauth/token`

---

### 2. JWT

**Purpose:** JSON Web Token generation and verification

**Operations:**
- Sign Token
- Verify Token
- Decode Token

**Configuration:**
- **Operation***: Sign, Verify, or Decode
- **Algorithm***: HS256, HS384, HS512, RS256, RS384, or RS512
- **Secret/Key***: Secret key for HS* algorithms, or private key for RS* algorithms
- **Payload (JSON)**: Required for sign operation
- **JWT Token**: Required for verify/decode operations
- **Expiration Time**: Optional (e.g., "1h", "24h", "7d")

**Example Workflow:**
```
Manual Trigger → JWT (Sign) → HTTP Request (Send Token)
```

**Tips:**
- HS* algorithms use symmetric keys (same secret for sign/verify)
- RS* algorithms use asymmetric keys (private key to sign, public key to verify)
- Always include "exp" claim for token expiration
- Token format: `header.payload.signature`

---

### 3. LDAP

**Purpose:** LDAP authentication and directory operations

**Note:** LDAP operations require an LDAP client library. Use HTTP Request node with LDAP API endpoints as an alternative.

**Operations:**
- Authenticate
- Search
- Bind

**Configuration:**
- **Server URL***: LDAP server URL (e.g., `ldap://ldap.example.com:389`)
- **Bind DN***: Distinguished Name for binding
- **Bind Password***: Password for binding
- **User DN**: User Distinguished Name for authentication
- **Username**: Alternative to User DN
- **Password**: User password
- **Search Base**: Base DN for search operations
- **Search Filter**: LDAP search filter (e.g., `(uid=username)`)
- **Attributes**: Array of attributes to retrieve

---

### 4. Okta

**Purpose:** Okta SSO and identity management

**Operations:**
- Get User
- List Users
- Create User
- Update User
- Delete User
- Authenticate User

**Configuration:**
- **Okta Domain***: Your Okta domain (e.g., `dev-123456.okta.com`)
- **API Token***: Okta API token
- **User ID**: Required for get_user, update_user, delete_user
- **User Data (JSON)**: Required for create_user, update_user
- **Query**: Okta filter query for list_users
- **Limit**: Maximum results (default: 200)

**How to Get Credentials:**
1. Log into Okta Admin Console
2. Go to Security → API → Tokens
3. Click "Create Token"
4. Copy the token (shown only once)

**Example Workflow:**
```
Webhook → Okta (Get User) → If/Else (Check Status) → Email (Send Notification)
```

**Tips:**
- Domain format: `your-domain.okta.com`
- Use filter queries for list_users (e.g., `status eq "ACTIVE"`)
- User IDs are returned in create/list operations
- API token has admin permissions - keep it secure

---

### 5. Auth0

**Purpose:** Auth0 identity and access management

**Operations:**
- Get User
- List Users
- Create User
- Update User
- Delete User
- Get Token

**Configuration:**
- **Auth0 Domain***: Your Auth0 domain (e.g., `dev-abc123.us.auth0.com`)
- **Client ID***: Auth0 application client ID
- **Client Secret***: Auth0 application client secret
- **User ID**: Required for get_user, update_user, delete_user (format: `auth0|123456`)
- **User Data (JSON)**: Required for create_user, update_user
- **Audience**: API identifier for get_token
- **Scope**: Space-separated scopes for get_token

**How to Get Credentials:**
1. Go to Auth0 Dashboard → Applications
2. Select your application (or create one)
3. Copy Client ID and Client Secret from Settings tab

**Example Workflow:**
```
Webhook → Auth0 (Get User) → Database Write (Log User Activity)
```

**Tips:**
- User ID format: `auth0|123456` or `google-oauth2|123456`
- Use Management API for user operations
- Get token operation uses client credentials grant
- Check API scopes in Auth0 Dashboard

---

### 6. Keycloak

**Purpose:** Keycloak identity and access management

**Operations:**
- Get Token
- Refresh Token
- Get User
- List Users
- Create User
- Update User

**Configuration:**
- **Keycloak Server URL***: Your Keycloak server URL
- **Realm***: Keycloak realm (usually "master")
- **Client ID***: Keycloak client ID
- **Client Secret***: Keycloak client secret
- **Username**: Required for get_token (password grant)
- **Password**: Required for get_token (password grant)
- **Refresh Token**: Required for refresh_token operation
- **User ID**: Required for get_user, update_user

**How to Get Credentials:**
1. Log into Keycloak Admin Console
2. Go to Clients → Select your client
3. Copy Client ID and Client Secret from Credentials tab
4. Note your realm name (usually "master")

**Example Workflow:**
```
Manual Trigger → Keycloak (Get Token) → HTTP Request (Use Token)
```

**Tips:**
- Realm is usually "master" for admin operations
- Use password grant for user authentication
- Use client credentials for admin API access
- Token endpoint: `/realms/{realm}/protocol/openid-connect/token`

---

## Payment & Finance Nodes

### 7. Stripe

**Purpose:** Stripe payment processing

**Operations:**
- Create Payment Intent
- Get Payment
- List Payments
- Create Refund
- Create Customer
- Create Subscription
- Create Invoice

**Configuration:**
- **API Key***: Stripe secret key (starts with `sk_test_` or `sk_live_`)
- **Amount (cents)**: Amount in smallest currency unit
- **Currency**: ISO currency code (default: "usd")
- **Payment Method ID**: Payment method ID (format: `pm_...`)
- **Customer ID**: Customer ID (format: `cus_...`)
- **Payment Intent ID**: Payment Intent ID (format: `pi_...`)
- **Metadata (JSON)**: Additional metadata

**How to Get API Key:**
1. Go to Stripe Dashboard → Developers → API keys
2. Copy your "Secret key" (starts with `sk_test_` for test, `sk_live_` for live)
3. Keep it secure - never expose in client-side code

**Example Workflow:**
```
Webhook (Payment Event) → Stripe (Get Payment) → Database Write (Log Payment) → Email (Send Receipt)
```

**Tips:**
- Amount is in smallest currency unit (cents for USD)
- Use test keys (`sk_test_`) for development
- Payment Intent is required for modern payment flows
- Customer ID format: `cus_...`

---

### 8. Razorpay

**Purpose:** Razorpay payment gateway

**Operations:**
- Create Order
- Get Order
- Create Payment
- Get Payment
- Create Refund
- Create Customer

**Configuration:**
- **Key ID***: Razorpay key ID (starts with `rzp_test_` or `rzp_live_`)
- **Key Secret***: Razorpay key secret
- **Amount (paise)**: Amount in smallest currency unit (paise for INR)
- **Currency**: ISO currency code (default: "INR")
- **Order ID**: Order ID (format: `order_...`)
- **Payment ID**: Payment ID (format: `pay_...`)
- **Notes (JSON)**: Additional notes

**How to Get Credentials:**
1. Log into Razorpay Dashboard
2. Go to Settings → API Keys
3. Copy Key ID and Key Secret
4. Use test keys for development

**Example Workflow:**
```
Webhook (Order Created) → Razorpay (Create Payment) → Database Write (Log Transaction)
```

**Tips:**
- Amount is in smallest currency unit (paise for INR)
- Use test keys (`rzp_test_`) for development
- Order must be created before payment
- Payment ID format: `pay_...`

---

### 9. PayPal

**Purpose:** PayPal payment processing

**Operations:**
- Create Order
- Get Order
- Capture Order
- Create Refund
- Get Access Token

**Configuration:**
- **Client ID***: PayPal application client ID
- **Client Secret***: PayPal application client secret
- **Environment***: Sandbox or Production
- **Amount**: Order amount as decimal string (e.g., "10.00")
- **Currency**: ISO currency code (default: "USD")
- **Order ID**: Order ID for get/capture operations

**How to Get Credentials:**
1. Go to PayPal Developer Dashboard
2. Create a new app or select existing
3. Copy Client ID and Client Secret from app credentials

**Example Workflow:**
```
Webhook (Order Created) → PayPal (Create Order) → PayPal (Capture Order) → Email (Send Confirmation)
```

**Tips:**
- Use sandbox for testing, production for live payments
- Amount is decimal string (e.g., "10.00")
- Order must be captured after creation
- Access token is auto-generated for API calls

---

### 10. QuickBooks

**Purpose:** QuickBooks accounting operations

**Operations:**
- Get Invoice
- List Invoices
- Create Invoice
- Get Customer
- Create Customer
- Get Payment
- Create Payment

**Configuration:**
- **Access Token***: QuickBooks OAuth access token
- **Realm ID (Company ID)***: QuickBooks company ID
- **Environment***: Sandbox or Production
- **Invoice ID**: Required for get_invoice
- **Customer ID**: Required for get_customer, create_invoice
- **Invoice Data (JSON)**: Required for create_invoice

**How to Get Credentials:**
1. Use OAuth2 flow to authorize your app with QuickBooks
2. After authorization, you'll receive access_token and realmId
3. Copy both values

**Example Workflow:**
```
Schedule → QuickBooks (List Invoices) → Filter (Overdue) → Email (Send Reminder)
```

**Tips:**
- Use OAuth2 to get access token
- Realm ID is your Company ID
- Use sandbox for testing
- Invoice ID is numeric

---

### 11. Xero

**Purpose:** Xero accounting operations

**Operations:**
- Get Invoice
- List Invoices
- Create Invoice
- Get Contact
- Create Contact
- Get Payment
- Create Payment

**Configuration:**
- **Access Token***: Xero OAuth access token
- **Tenant ID***: Xero tenant ID
- **Invoice ID**: Required for get_invoice
- **Contact ID**: Required for get_contact, create_invoice
- **Invoice Data (JSON)**: Required for create_invoice

**How to Get Credentials:**
1. Use OAuth2 flow to authorize your app with Xero
2. After authorization, you'll receive access_token and tenantId
3. Copy both values

**Example Workflow:**
```
Schedule (Monthly) → Xero (List Invoices) → Database Write (Archive Invoices)
```

**Tips:**
- Get access token via OAuth2 flow
- Tenant ID from OAuth connection
- Invoice Type: ACCREC (Accounts Receivable) or ACCPAY (Accounts Payable)
- Contact ID required for creating invoices

---

## E-commerce Nodes

### 12. Shopify

**Purpose:** Shopify e-commerce operations

**Operations:**
- Get Product
- List Products
- Create Product
- Update Product
- Get Order
- List Orders
- Create Order
- Get Customer
- List Customers

**Configuration:**
- **Shop Domain***: Your Shopify shop domain (e.g., `mystore.myshopify.com`)
- **Access Token***: Shopify Admin API access token (starts with `shpat_`)
- **Product ID**: Required for get_product, update_product
- **Order ID**: Required for get_order
- **Customer ID**: Required for get_customer
- **Limit**: Maximum results (default: 250)

**How to Get Credentials:**
1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → Create a new app
3. Configure API scopes (read_products, write_products, etc.)
4. Install app and copy the Admin API access token

**Example Workflow:**
```
Webhook (Order Created) → Shopify (Get Order) → Database Write (Log Order) → Email (Send Confirmation)
```

**Tips:**
- Shop domain format: `your-shop.myshopify.com`
- Access token starts with `shpat_`
- Product ID is numeric
- Use Admin API version 2024-01 or later

---

### 13. WooCommerce

**Purpose:** WooCommerce store operations

**Operations:**
- Get Product
- List Products
- Create Product
- Update Product
- Get Order
- List Orders
- Create Order
- Get Customer

**Configuration:**
- **Store URL***: Your WooCommerce store URL
- **Consumer Key***: WooCommerce consumer key (starts with `ck_`)
- **Consumer Secret***: WooCommerce consumer secret (starts with `cs_`)
- **Product ID**: Required for get_product, update_product
- **Order ID**: Required for get_order
- **Customer ID**: Required for get_customer
- **Per Page**: Results per page (default: 10)

**How to Get Credentials:**
1. Go to WooCommerce → Settings → Advanced → REST API
2. Click "Add key"
3. Set permissions (Read, Write, or Read/Write)
4. Copy Consumer Key and Consumer Secret

**Example Workflow:**
```
Schedule (Daily) → WooCommerce (List Orders) → Filter (Pending) → Email (Send Reminder)
```

**Tips:**
- Store URL without trailing slash
- Consumer key starts with `ck_`, secret with `cs_`
- Product/Order IDs are numeric
- Use REST API v3 endpoint

---

### 14. Magento

**Purpose:** Magento e-commerce operations

**Operations:**
- Get Product
- List Products
- Create Product
- Update Product
- Get Order
- List Orders
- Create Order

**Configuration:**
- **Store URL***: Your Magento store URL
- **Access Token***: Magento access token
- **Product ID (SKU)**: Product SKU for get_product, update_product
- **Order ID**: Required for get_order
- **Search Criteria (JSON)**: Search criteria for list operations

**How to Get Credentials:**
1. Go to Magento Admin → System → Integrations
2. Create a new integration
3. Configure API access permissions
4. Activate and copy the access token

**Example Workflow:**
```
Webhook (Product Updated) → Magento (Get Product) → Database Write (Sync Inventory)
```

**Tips:**
- Product ID is the SKU (string)
- Order ID is numeric
- Use searchCriteria for filtering list operations
- REST API uses V1 endpoint

---

### 15. BigCommerce

**Purpose:** BigCommerce store operations

**Operations:**
- Get Product
- List Products
- Create Product
- Update Product
- Get Order
- List Orders
- Get Customer

**Configuration:**
- **Store Hash***: BigCommerce store hash
- **Access Token***: BigCommerce access token
- **Product ID**: Required for get_product, update_product
- **Order ID**: Required for get_order
- **Customer ID**: Required for get_customer
- **Limit**: Maximum results (default: 250)

**How to Get Credentials:**
1. Go to BigCommerce → Advanced Settings → API Accounts
2. Create a new API account
3. Configure OAuth scopes
4. Copy Store Hash and Access Token

**Example Workflow:**
```
Schedule (Hourly) → BigCommerce (List Orders) → Filter (New Orders) → Slack (Send Notification)
```

**Tips:**
- Store hash is in API URL: `/stores/{storeHash}/v3`
- Product/Order IDs are numeric
- API uses v3 endpoint
- Access token has OAuth scopes

---

## Analytics & Data Tools Nodes

### 16. Google Analytics

**Purpose:** Google Analytics data and reporting

**Operations:**
- Get Report
- List Properties
- Track Event

**Configuration:**
- **Access Token***: Google Analytics access token
- **Property ID**: GA4 Property ID (format: `properties/123456789`)
- **Date Ranges (JSON)**: Array of date range objects
- **Dimensions (JSON)**: Array of dimension names
- **Metrics (JSON)**: Array of metric names
- **Event Name**: Event name for track_event
- **Event Parameters (JSON)**: Event parameters

**How to Get Credentials:**
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Use OAuth2 flow to get access token
4. Or use Service Account JSON key

**Example Workflow:**
```
Schedule (Daily) → Google Analytics (Get Report) → Database Write (Store Metrics) → Email (Send Report)
```

**Tips:**
- Property ID format: `properties/123456789`
- Use GA4 Data API for reports
- Measurement Protocol for event tracking
- Date ranges: `[{"startDate": "2024-01-01", "endDate": "2024-01-31"}]`

---

### 17. Mixpanel

**Purpose:** Mixpanel analytics and event tracking

**Operations:**
- Track Event
- Track User
- Get Event
- Query Insights

**Configuration:**
- **Project Token***: Mixpanel project token
- **API Secret**: Required for query_insights
- **Event Name**: Event name for track_event
- **Distinct ID**: User identifier
- **Properties (JSON)**: Event or user properties
- **Query (JSON)**: Query object for query_insights

**How to Get Credentials:**
1. Go to Mixpanel → Project Settings
2. Copy Project Token
3. For queries, get API Secret from Account Settings

**Example Workflow:**
```
Webhook (User Action) → Mixpanel (Track Event) → Database Write (Log Event)
```

**Tips:**
- Project token identifies your Mixpanel project
- API secret needed for query operations
- Distinct ID identifies the user
- Properties are custom event data

---

### 18. Segment

**Purpose:** Segment analytics and data routing

**Operations:**
- Track
- Identify
- Page
- Group

**Configuration:**
- **Write Key***: Segment write key
- **User ID**: User identifier
- **Event**: Event name for track operation
- **Properties (JSON)**: Event properties
- **Traits (JSON)**: User traits for identify
- **Page Name**: Page name for page operation
- **Group ID**: Group identifier for group operation

**How to Get Credentials:**
1. Go to Segment → Settings → API Keys
2. Copy your Write Key

**Example Workflow:**
```
Webhook (User Event) → Segment (Track) → Segment (Identify) → Database Write (Update User)
```

**Tips:**
- Write key identifies your Segment workspace
- User ID identifies the user across events
- Traits are user properties (for identify)
- Segment routes data to your connected destinations

---

### 19. Amplitude

**Purpose:** Amplitude product analytics

**Operations:**
- Track Event
- Identify User
- Get Event

**Configuration:**
- **API Key***: Amplitude API key
- **Secret Key**: Required for get_event
- **User ID**: User identifier
- **Event Type**: Event type/name
- **Event Properties (JSON)**: Event properties
- **User Properties (JSON)**: User properties for identify

**How to Get Credentials:**
1. Go to Amplitude → Settings → Projects
2. Copy API Key
3. For get_event, get Secret Key from same section

**Example Workflow:**
```
Webhook (User Action) → Amplitude (Track Event) → Database Write (Log Analytics)
```

**Tips:**
- API key identifies your Amplitude project
- Secret key needed for get_event operation
- Event type is the event name
- Event properties are custom data

---

### 20. Elasticsearch

**Purpose:** Elasticsearch search and analytics

**Operations:**
- Search
- Index Document
- Get Document
- Update Document
- Delete Document
- Bulk Operation

**Configuration:**
- **Node URL***: Elasticsearch cluster URL
- **Username**: Optional, for authentication
- **Password**: Optional, for authentication
- **Index***: Elasticsearch index name
- **Query (JSON)**: Elasticsearch Query DSL
- **Document ID**: Required for get, update, delete
- **Document (JSON)**: Document data for index/update
- **Bulk Body**: Bulk operation body (NDJSON format)

**Example Workflow:**
```
Webhook (Data Update) → Elasticsearch (Index Document) → Elasticsearch (Search) → Email (Send Results)
```

**Tips:**
- Node URL is your Elasticsearch cluster URL
- Index is the index name
- Query uses Elasticsearch Query DSL
- Bulk operations use NDJSON format

---

## Common Patterns & Best Practices

### Authentication Flow
```
Manual Trigger → OAuth2 (Get Access Token) → [Service Node] (Use Token)
```

### Payment Processing
```
Webhook (Order Created) → [Payment Node] (Create Payment) → Database Write (Log) → Email (Confirmation)
```

### E-commerce Sync
```
Schedule (Hourly) → [E-commerce Node] (List Orders) → Filter (New) → Database Write (Sync)
```

### Analytics Tracking
```
Webhook (User Action) → [Analytics Node] (Track Event) → Database Write (Log)
```

### Error Handling
```
[Any Node] → Error Handler (Retry) → [Fallback Node]
```

### Data Transformation
```
[Service Node] → Set (Transform Data) → [Next Node]
```

---

## Security Best Practices

1. **Never expose API keys or secrets in client-side code**
2. **Use environment variables or secure credential storage**
3. **Rotate tokens regularly**
4. **Use test/sandbox environments for development**
5. **Validate all inputs before processing**
6. **Use HTTPS for all API calls**
7. **Implement rate limiting for API calls**
8. **Log all sensitive operations**

---

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify credentials are correct
   - Check token expiration
   - Ensure proper scopes/permissions

2. **API Rate Limits**
   - Implement retry logic with backoff
   - Use pagination for large datasets
   - Cache responses when possible

3. **Data Format Errors**
   - Verify JSON format is correct
   - Check required fields are present
   - Validate data types match API requirements

4. **Network Errors**
   - Check internet connectivity
   - Verify API endpoints are accessible
   - Check firewall/proxy settings

---

## Support & Resources

- **Node Documentation**: Check individual node help text in the Properties Panel
- **API Documentation**: Refer to official API docs for each service
- **Workflow Examples**: See example workflows in the Templates section
- **Community**: Join our community for tips and support

---

## Version History

- **v1.0** (2024-01-15): Initial release of 20 new nodes

---

**Last Updated:** January 2024

