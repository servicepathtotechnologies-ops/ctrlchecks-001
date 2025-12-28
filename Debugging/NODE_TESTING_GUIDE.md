# Node Testing Guide

Complete step-by-step guide for testing nodes using **free public APIs and dummy data** - no accounts required!

---

## 📋 Table of Contents

1. [Quick Start - Easiest Nodes](#quick-start---easiest-nodes)
2. [HTTP & API Nodes](#1-http--api-nodes)
3. [Authentication Nodes](#2-authentication-nodes)
4. [File & Storage Nodes](#3-file--storage-nodes)
5. [Data Manipulation Nodes](#4-data-manipulation-nodes)
6. [Logic Nodes](#5-logic-nodes)
7. [Utility Nodes](#6-utility-nodes)
8. [Quick Reference](#quick-reference)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start - Easiest Nodes

**Start here for instant results (no accounts needed):**

1. **JWT Decode** ⭐⭐⭐ - Instant, no setup
2. **HTTP Request GET** (JSONPlaceholder) ⭐⭐⭐ - Free public API
3. **Set** ⭐⭐ - Simple data creation
4. **Text Formatter** ⭐⭐ - Template processing
5. **Date & Time - Now** ⭐⭐ - Current timestamp

---

## 1. HTTP & API Nodes

### HTTP Request - GET (JSONPlaceholder)

**Why Easy:** Free public API, no authentication, instant results.

#### Configuration:
```
URL: https://jsonplaceholder.typicode.com/posts/1
Method: GET
Headers: {} (leave empty)
Body: (leave empty for GET)
Timeout: 30000 (optional)
```

#### Expected Output:
```json
{
  "userId": 1,
  "id": 1,
  "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
  "body": "quia et suscipit..."
}
```

**More Free Endpoints:**
- `https://jsonplaceholder.typicode.com/users/1` - Get user data
- `https://jsonplaceholder.typicode.com/posts` - Get all posts
- `https://jsonplaceholder.typicode.com/comments/1` - Get comment data

---

### HTTP Request - POST (JSONPlaceholder)

**Why Easy:** Free public API accepts POST, no authentication needed.

#### Configuration:
```
URL: https://jsonplaceholder.typicode.com/posts
Method: POST
Headers: {"Content-Type": "application/json"}
Body: {"title": "Test Post", "body": "This is a test post", "userId": 1}
Timeout: 30000
```

#### Expected Output:
```json
{
  "title": "Test Post",
  "body": "This is a test post",
  "userId": 1,
  "id": 101
}
```

**Note:** JSONPlaceholder simulates creation - returns your data with a fake ID.

---

### HTTP Request - GET (HTTPBin)

**Why Easy:** Free API for testing HTTP requests, returns request details.

#### Configuration:
```
URL: https://httpbin.org/get?name=Test&value=123
Method: GET
Headers: {} (leave empty)
Body: (leave empty)
Timeout: 30000
```

#### Expected Output:
```json
{
  "args": {
    "name": "Test",
    "value": "123"
  },
  "headers": {
    "Accept": "*/*",
    "Host": "httpbin.org"
  },
  "origin": "xxx.xxx.xxx.xxx",
  "url": "https://httpbin.org/get?name=Test&value=123"
}
```

**More HTTPBin Endpoints:**
- `https://httpbin.org/json` - Returns sample JSON
- `https://httpbin.org/uuid` - Returns UUID
- `https://httpbin.org/status/200` - Returns specific status code

---

## 2. Authentication Nodes

### JWT - Decode Token

**Why Easy:** No external API calls, pure JavaScript operation, instant results.

#### Configuration:
```
Operation: Decode Token
Algorithm: HS256 (not used for decode, but required)
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

#### Expected Output:
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "1234567890",
    "name": "John Doe",
    "iat": 1516239022
  }
}
```

**Test Token (you can use this):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

---

### JWT - Sign Token

**Why Easy:** Simple operation, no external dependencies, predictable output.

#### Configuration:
```
Operation: Sign Token
Algorithm: HS256
Secret/Key: my-secret-key-12345
Payload (JSON): {"sub":"user123","name":"John Doe","iat":1735686000}
Expiration Time: 1h (optional)
```

#### Expected Output:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNzM1Njg2MDAwfQ.xxxxxxxxxxxx"
}
```

**Success Indicators:**
- Returns JWT token string
- Token has 3 parts (header.payload.signature) separated by dots
- Can be decoded back to original payload

---

### OAuth2 - Validate Token ⚠️ (NOT RECOMMENDED - Use JWT Decode Instead)

**Note:** This node is more complex and may not show all fields. **We strongly recommend using JWT Decode instead** - it's simpler, already works, and doesn't require OAuth2 setup.

**Why NOT Recommended:**
- More complex configuration required
- Requires dummy credentials even for validation
- Token field may not appear in UI (requires app rebuild)
- JWT Decode does the same job more simply

**If you still want to use OAuth2 Validate Token:**

The Token field should appear when Operation is set to "Validate Token", but if it doesn't:
1. Make sure you've rebuilt the application (`npm run build` or restart dev server)
2. Clear browser cache and hard refresh (Ctrl+Shift+R)
3. Scroll down in the properties panel - the Token field comes after many other fields

#### Configuration (if Token field is visible):
```
Operation: Validate Token
Grant Type: Client Credentials
Client ID: dummy-client-id
Client Secret: dummy-secret
Token URL: https://dummy.com/token
Token: [JWT token to validate]
```

#### Expected Output:
```json
{
  "valid": true,
  "payload": {
    "sub": "1234567890",
    "name": "John Doe",
    "iat": 1516239022
  }
}
```

**💡 Better Alternative:** Just use **JWT Decode** (above) - it's simpler and already works!

---

## 3. File & Storage Nodes

### ⚠️ Important: File Operations Run Server-Side

**File operations run on the Supabase server, not your local machine.** The `/tmp/` path refers to the server's filesystem, not your Windows computer.

**Best Testing Approach:** Create a workflow with **Write Binary File** connected to **Read Binary File** - this creates the file in the same execution, then reads it back.

**⚠️ Note:** Files are created in the server's `/tmp` directory. Each workflow execution is isolated, so you need both nodes in the same workflow to test reading a file you just created.

---

### Write Binary File (Create File First)

**Why Easy:** Simple write operation, uses base64 input, creates file on server for testing.

#### Configuration:
```
File Path: test-file.txt (will be created at /tmp/test-file.txt on server)
Content (Base64): SGVsbG8sIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBmaWxlLg==
```

**Base64 Encoding Helper:**
- Text: "Hello, World! This is a test file."
- Base64: `SGVsbG8sIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBmaWxlLg==`

**To encode text to base64:**
- Online: https://www.base64encode.org/
- PowerShell: `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("Hello, World! This is a test file."))`

#### Expected Output:
```json
{
  "success": true,
  "filePath": "/tmp/test-file.txt",
  "size": 36,
  "message": "File written successfully"
}
```

---

### Read Binary File (Read the File You Created)

**Why Easy:** Reads file created by Write Binary File, simple output.

#### Configuration:
```
File Path: test-file.txt (or /tmp/test-file.txt - both work)
Max Size (bytes): 10485760 (optional, default 10MB)
```

**Step 1:** Create a workflow: **Manual Trigger → Write Binary File → Read Binary File**

**Step 2:** Configure Write Binary File (above) to create `test-file.txt`

**Step 3:** Configure Read Binary File to read `test-file.txt` (same filename)

**Note:** Both nodes must be in the same workflow execution so the file exists when Read Binary File tries to access it.

#### Expected Output:
```json
{
  "content": "SGVsbG8sIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBmaWxlLg==",
  "encoding": "base64",
  "size": 36,
  "path": "/tmp/test-file.txt"
}
```

**Note:** Content is base64 encoded. "SGVsbG8sIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBmaWxlLg==" decodes to "Hello, World! This is a test file."

**To decode base64:**
- Online: https://www.base64decode.org/
- PowerShell: `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("SGVsbG8sIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBmaWxlLg=="))`

---

## 4. Data Manipulation Nodes

### JSON Parser

**Why Easy:** Works with any JSON data, no external APIs, instant results.

#### Configuration:
Create workflow: **Manual Trigger → Set → JSON Parser**

**Set Node:**
```
Fields (JSON): {"data": {"users": [{"id": 1, "name": "John"}, {"id": 2, "name": "Jane"}]}}
```

**JSON Parser Node:**
```
Expression: $.data.users[*].name
```

#### Expected Output:
```json
["John", "Jane"]
```

**More JSONPath Examples:**
- `$.data.users[0]` - Get first user object
- `$.data.users[*].id` - Get all user IDs
- `$..name` - Get all name fields (recursive)

---

### Set (Set Variables)

**Why Easy:** Simple data setting, no dependencies, perfect for testing data flow.

#### Configuration:
```
Fields (JSON): {"name": "John Doe", "age": 30, "city": "New York", "active": true}
```

#### Expected Output:
```json
{
  "name": "John Doe",
  "age": 30,
  "city": "New York",
  "active": true
}
```

---

### Text Formatter

**Why Easy:** Simple template formatting, works with any data, no external calls.

#### Configuration:
Create workflow: **Set → Text Formatter**

**Set Node:**
```
Fields (JSON): {"userName": "John", "orderId": 12345, "total": 99.99}
```

**Text Formatter Node:**
```
Template: Hello {{userName}}! Your order #{{orderId}} total is ${{total}}.
```

#### Expected Output:
```
"Hello John! Your order #12345 total is $99.99."
```

---

## 5. Logic Nodes

### If/Else

**Why Easy:** Simple conditional logic, works with any data, clear true/false paths.

#### Configuration:
Create workflow: **Set → If/Else**

**Set Node:**
```
Fields (JSON): {"score": 85, "passingGrade": 70}
```

**If/Else Node:**
```
Condition: {{input.score}} > {{input.passingGrade}}
```

#### Expected Output:
- If condition is **true**: Output goes to "true" connection
- If condition is **false**: Output goes to "false" connection

---

### Switch

**Why Easy:** Multiple case routing, clear output paths, easy to verify.

#### Configuration:
Create workflow: **Set → Switch**

**Set Node:**
```
Fields (JSON): {"status": "active"}
```

**Switch Node:**
```
Expression: {{input.status}}
Cases (JSON): [{"value": "active", "label": "Active"}, {"value": "inactive", "label": "Inactive"}, {"value": "pending", "label": "Pending"}]
```

#### Expected Output:
- Output routes to matching case connection
- If no match, goes to default connection

---

## 6. Utility Nodes

### Date & Time - Now

**Why Easy:** Returns current date/time, no input needed, instant results.

#### Configuration:
```
Operation: Now
Timezone: UTC (optional, default: UTC)
Format: ISO (optional, default: ISO)
```

#### Expected Output:
```json
{
  "date": "2024-12-28T10:30:00.000Z",
  "timestamp": 1735386600000,
  "formatted": "2024-12-28T10:30:00.000Z"
}
```

---

### Math - Add

**Why Easy:** Simple mathematical operation, works with any numbers, clear output.

#### Configuration:
```
Operation: Add
a: 15
b: 27
```

#### Expected Output:
```json
{
  "result": 42
}
```

**Supported Operations:** add, subtract, multiply, divide

---

### Crypto - Generate UUID

**Why Easy:** Generates UUID, no input needed, useful for testing.

#### Configuration:
```
Operation: UUID
```

#### Expected Output:
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Quick Reference

### Required Properties Summary

#### HTTP & API (No accounts needed)
- **HTTP Request GET:** `url` (use: `https://jsonplaceholder.typicode.com/posts/1`)
- **HTTP Request POST:** `url`, `method: POST`, `body` (JSON)
- **HTTP Request HTTPBin:** `url` (use: `https://httpbin.org/get`)

#### Authentication (No accounts needed)
- **JWT Decode:** `token`, `algorithm` (use test token from guide) ⭐ **RECOMMENDED**
- **JWT Sign:** `secret`, `payload` (JSON), `algorithm`
- **OAuth2 Validate:** Not recommended - use JWT Decode instead (simpler, same functionality)

#### File & Storage
- **Write Binary File:** `filePath`, `content` (base64) - Creates file on server
- **Read Binary File:** `filePath` - Reads file from server (use Write Binary File first to create test file)

#### Data Manipulation (No accounts needed)
- **JSON Parser:** `expression` (JSONPath)
- **Set:** `fields` (JSON object)
- **Text Formatter:** `template` (with {{variables}})

#### Logic (No accounts needed)
- **If/Else:** `condition` (JavaScript expression)
- **Switch:** `expression`, `cases` (JSON array)

#### Utility (No accounts needed)
- **Date & Time Now:** `operation: now`
- **Math Add:** `operation: add`, `a`, `b`
- **Crypto UUID:** `operation: uuid`

---

## Troubleshooting

### OAuth2 Node Issues

**⚠️ Recommendation:** Use **JWT Decode** instead - it's simpler and doesn't have these issues!

#### Token field not visible

**Solution:**
- The Token field may not appear until you rebuild the app or refresh the browser
- **Better solution:** Use **JWT Decode** node instead - it's simpler and works the same way

#### Error: "Authorization code is required for authorization_code grant type"

**Solution:**
- **Use JWT Decode instead** - avoids this complexity entirely
- If you must use OAuth2: Change Operation to "Validate Token" and Grant Type to "Client Credentials"

#### Error: "Client ID, Client Secret, and Token URL are required"

**Solution:**
- Ensure all three fields are filled (can use dummy values)
- **Better solution:** Use **JWT Decode** - no credentials needed!

### General Testing Tips

1. **Start Simple:** Begin with read/list operations (GET requests)
2. **Use Test Data:** Use free public APIs and dummy data for safe testing
3. **Verify Output Structure:** Check that response has expected fields
4. **Check Execution Logs:** Review logs for any warnings or errors

### Success Indicators

✅ **Successful Execution:**
- Node status shows "success" (green checkmark)
- Output contains expected data structure
- No error messages in execution logs
- Response time is reasonable (< 5 seconds for API calls)

❌ **Common Issues:**
- **Authentication Errors:** Check API keys/tokens are correct and not expired
- **Missing Required Fields:** Verify all required properties are filled
- **Invalid IDs:** Ensure IDs exist and are valid
- **Rate Limiting:** Some APIs have rate limits - wait and retry

---

## Free Public API Resources

### JSONPlaceholder
- **Website:** https://jsonplaceholder.typicode.com
- **Endpoints:** `/posts`, `/users`, `/comments`, `/albums`
- **No API key required**
- **Perfect for testing GET/POST requests**

### HTTPBin
- **Website:** https://httpbin.org
- **Endpoints:** `/get`, `/post`, `/json`, `/uuid`
- **No API key required**
- **Great for testing HTTP methods and debugging**

---

## Recommended Testing Order

1. **JWT Decode** ⭐⭐⭐ (instant, no setup)
2. **HTTP Request GET** (JSONPlaceholder) ⭐⭐⭐ (free public API)
3. **Set** ⭐⭐ (simple data creation)
4. **Text Formatter** ⭐⭐ (template processing)
5. **Read Binary File** ⭐ (local file system)
6. **Write Binary File** ⭐ (local file system)
7. **JSON Parser** ⭐⭐ (data extraction)
8. **If/Else** ⭐⭐ (conditional logic)
9. **Date & Time** ⭐⭐ (utility functions)
10. **HTTP Request POST** (JSONPlaceholder) ⭐⭐ (POST requests)

---

## JSON Configuration Files

Ready-to-use JSON configurations are available in:
- `test-node-configs.json` - Individual node configurations
- `test-workflow-examples.json` - Complete workflow examples

Copy the JSON configurations and paste them into the workflow builder.

---

**Happy Testing! 🚀**

