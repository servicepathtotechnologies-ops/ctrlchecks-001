# Post Image to Instagram - Complete Workflow Guide

## 📋 Overview

This workflow posts an image to Instagram using the Facebook Graph API. The process requires two API calls:
1. **Create Media Container** - Uploads image metadata and gets a creation ID
2. **Publish Media** - Publishes the media using the creation ID

---

## 🎯 Step-by-Step Implementation

### **Step 1: Manual Trigger Node**

**Node Type:** `manual_trigger`  
**Category:** Triggers  
**Position:** x: 250, y: 100

**Configuration:**
- No configuration needed (empty object `{}`)

**Purpose:** Starts the workflow manually when you click "Run"

---

### **Step 2: JavaScript Node**

**Node Type:** `javascript`  
**Category:** Data Manipulation  
**Position:** x: 550, y: 100

**Configuration:**
```json
{
  "code": "return {\n  caption: 'My fav bike',\n  image_url: 'https://images.pexels.com/photos/17394011/pexels-photo-17394011.jpeg',\n  instagram_user_id: '_v_shivakumar_143',\n  instagram_access_token: 'YOUR_INSTAGRAM_ACCESS_TOKEN_HERE'\n};",
  "timeout": "5000"
}
```

**Field Details:**
- **JavaScript Code:** Returns an object with:
  - `caption`: The caption for your Instagram post
  - `image_url`: Public URL of the image to post
  - `instagram_user_id`: Your Instagram Business Account ID or username
  - `instagram_access_token`: Your Instagram/Facebook access token

**Purpose:** Prepares the data needed for Instagram posting

**Note:** Replace `YOUR_INSTAGRAM_ACCESS_TOKEN_HERE` with your actual access token.

---

### **Step 3: HTTP POST Node (Create Media Container)**

**Node Type:** `http_request`  
**Category:** HTTP & API  
**Position:** x: 850, y: 100

**Configuration:**
```json
{
  "url": "https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media",
  "method": "POST",
  "headers": "{\"Content-Type\": \"application/x-www-form-urlencoded\"}",
  "body": "image_url={{input.image_url}}&caption={{input.caption}}&access_token={{input.instagram_access_token}}",
  "timeout": "30000"
}
```

**Field Details:**
- **URL:** `https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media`
  - Uses template variable `{{input.instagram_user_id}}` from previous node
  - API version can be updated (v19.0, v20.0, etc.)
  
- **Method:** `POST`

- **Headers (JSON):** 
  ```json
  {
    "Content-Type": "application/x-www-form-urlencoded"
  }
  ```

- **Body Template:**
  ```
  image_url={{input.image_url}}&caption={{input.caption}}&access_token={{input.instagram_access_token}}
  ```
  - Uses form-urlencoded format (not JSON)
  - Template variables pull from JavaScript node output

**Purpose:** Creates a media container and returns a `creation_id` or `id` field

**Expected Response:**
```json
{
  "id": "17912345678901234"
}
```

---

### **Step 4: JSON Parser Node**

**Node Type:** `json_parser`  
**Category:** Data Manipulation  
**Position:** x: 1150, y: 100

**Configuration:**
```json
{
  "expression": "id"
}
```

**Field Details:**
- **Expression:** `id`
  - Extracts the `id` field from the HTTP POST response
  - This is the `creation_id` needed for publishing

**Purpose:** Extracts the creation ID from the media container response

**Output:** The creation ID as a string (e.g., `"17912345678901234"`)

---

### **Step 5: HTTP POST Node (Publish Media)**

**Node Type:** `http_request`  
**Category:** HTTP & API  
**Position:** x: 1450, y: 100

**Configuration:**
```json
{
  "url": "https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media_publish",
  "method": "POST",
  "headers": "{\"Content-Type\": \"application/x-www-form-urlencoded\"}",
  "body": "creation_id={{input.id}}&access_token={{input.instagram_access_token}}",
  "timeout": "30000"
}
```

**Field Details:**
- **URL:** `https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media_publish`
  - Uses the same Instagram user ID
  - Endpoint is `/media_publish` (not `/media`)

- **Method:** `POST`

- **Headers (JSON):**
  ```json
  {
    "Content-Type": "application/x-www-form-urlencoded"
  }
  ```

- **Body Template:**
  ```
  creation_id={{input.id}}&access_token={{input.instagram_access_token}}
  ```
  - `{{input.id}}` comes from JSON Parser node
  - `{{input.instagram_access_token}}` is passed through from JavaScript node

**Purpose:** Publishes the media to Instagram

**Expected Response:**
```json
{
  "id": "17912345678901234"
}
```
This is the published media ID.

---

### **Step 6: Log Output Node**

**Node Type:** `log_output`  
**Category:** Output/Communication  
**Position:** x: 1750, y: 100

**Configuration:**
```json
{
  "message": "Instagram post published successfully! Media ID: {{input.id}}",
  "level": "info"
}
```

**Field Details:**
- **Message:** `Instagram post published successfully! Media ID: {{input.id}}`
  - Uses template variable to show the published media ID

- **Level:** `info` (options: info, warn, error)

**Purpose:** Logs the success message with the published media ID

---

## 🔗 Node Connections

Connect nodes in this order:
1. **Manual Trigger** → **JavaScript**
2. **JavaScript** → **HTTP POST (Create Media)**
3. **HTTP POST (Create Media)** → **JSON Parser**
4. **JSON Parser** → **HTTP POST (Publish)**
5. **HTTP POST (Publish)** → **Log Output**

---

## 📝 Complete JSON Export

Save this as `instagram_post_workflow.json`:

```json
{
  "name": "Post Image to Instagram",
  "description": "Posts an image to Instagram using Facebook Graph API",
  "nodes": [
    {
      "id": "node_1",
      "type": "custom",
      "position": { "x": 250, "y": 100 },
      "data": {
        "type": "manual_trigger",
        "label": "Manual Trigger",
        "category": "triggers",
        "icon": "Play",
        "config": {}
      }
    },
    {
      "id": "node_2",
      "type": "custom",
      "position": { "x": 550, "y": 100 },
      "data": {
        "type": "javascript",
        "label": "JavaScript",
        "category": "data",
        "icon": "Code",
        "config": {
          "code": "return {\n  caption: 'My fav bike',\n  image_url: 'https://images.pexels.com/photos/17394011/pexels-photo-17394011.jpeg',\n  instagram_user_id: '_v_shivakumar_143',\n  instagram_access_token: 'YOUR_INSTAGRAM_ACCESS_TOKEN_HERE'\n};",
          "timeout": "5000"
        }
      }
    },
    {
      "id": "node_3",
      "type": "custom",
      "position": { "x": 850, "y": 100 },
      "data": {
        "type": "http_request",
        "label": "HTTP POST",
        "category": "http_api",
        "icon": "Send",
        "config": {
          "url": "https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media",
          "method": "POST",
          "headers": "{\"Content-Type\": \"application/x-www-form-urlencoded\"}",
          "body": "image_url={{input.image_url}}&caption={{input.caption}}&access_token={{input.instagram_access_token}}",
          "timeout": "30000"
        }
      }
    },
    {
      "id": "node_4",
      "type": "custom",
      "position": { "x": 1150, "y": 100 },
      "data": {
        "type": "json_parser",
        "label": "JSON Parser",
        "category": "data",
        "icon": "Braces",
        "config": {
          "expression": "id"
        }
      }
    },
    {
      "id": "node_5",
      "type": "custom",
      "position": { "x": 1450, "y": 100 },
      "data": {
        "type": "http_request",
        "label": "HTTP POST",
        "category": "http_api",
        "icon": "Send",
        "config": {
          "url": "https://graph.facebook.com/v19.0/{{input.instagram_user_id}}/media_publish",
          "method": "POST",
          "headers": "{\"Content-Type\": \"application/x-www-form-urlencoded\"}",
          "body": "creation_id={{input.id}}&access_token={{input.instagram_access_token}}",
          "timeout": "30000"
        }
      }
    },
    {
      "id": "node_6",
      "type": "custom",
      "position": { "x": 1750, "y": 100 },
      "data": {
        "type": "log_output",
        "label": "Log Output",
        "category": "output",
        "icon": "FileOutput",
        "config": {
          "message": "Instagram post published successfully! Media ID: {{input.id}}",
          "level": "info"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2"
    },
    {
      "id": "edge_2",
      "source": "node_2",
      "target": "node_3"
    },
    {
      "id": "edge_3",
      "source": "node_3",
      "target": "node_4"
    },
    {
      "id": "edge_4",
      "source": "node_4",
      "target": "node_5"
    },
    {
      "id": "edge_5",
      "source": "node_5",
      "target": "node_6"
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

---

## 🔑 How to Get Instagram Access Token

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create or select an App
3. Add "Instagram Graph API" product
4. Connect your Instagram Business Account
5. Go to **Tools → Graph API Explorer**
6. Select your Instagram Business Account
7. Generate token with permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
8. Copy the token and replace `YOUR_INSTAGRAM_ACCESS_TOKEN_HERE` in the JavaScript node

---

## 📌 Important Notes

1. **Image URL:** Must be publicly accessible (not behind authentication)
2. **Access Token:** Needs `instagram_content_publish` permission
3. **User ID:** Can be Instagram Business Account ID or username
4. **API Version:** Update `v19.0` to latest version if needed
5. **Error Handling:** If first HTTP POST fails, check:
   - Access token validity
   - Image URL accessibility
   - Instagram user ID format

---

## 🐛 Common Issues

### Issue: "Invalid OAuth access token"
- **Solution:** Regenerate your access token with correct permissions

### Issue: "Image URL not accessible"
- **Solution:** Ensure image URL is publicly accessible and returns image directly

### Issue: JSON Parser fails
- **Solution:** Check that first HTTP POST returns `{"id": "..."}` format

### Issue: "Cannot read properties of undefined"
- **Solution:** Ensure all template variables match node output fields

---

## ✅ Testing Checklist

- [ ] All nodes are connected in correct order
- [ ] JavaScript node returns all required fields
- [ ] Access token is valid and has correct permissions
- [ ] Image URL is publicly accessible
- [ ] Instagram user ID is correct
- [ ] First HTTP POST returns `{"id": "..."}`
- [ ] JSON Parser extracts `id` correctly
- [ ] Second HTTP POST publishes successfully

---

## 🚀 Quick Start

1. Import the JSON file or create nodes manually
2. Update the JavaScript node with your:
   - Image URL
   - Caption
   - Instagram User ID
   - Access Token
3. Click "Run" to test
4. Check execution logs for any errors
5. Verify post appears on Instagram

---

**Last Updated:** December 27, 2025

