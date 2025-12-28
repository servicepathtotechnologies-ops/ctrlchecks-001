# Form Node Testing Examples

This file contains comprehensive examples for testing the Form Trigger node, including sample configurations, inputs, and expected outputs.

---

## 📋 Table of Contents

1. [Basic Form Node Configuration](#basic-form-node-configuration)
2. [Sample Form Submissions](#sample-form-submissions)
3. [Expected Outputs](#expected-outputs)
4. [Complete Workflow Examples](#complete-workflow-examples)
5. [Test Scenarios](#test-scenarios)

---

## 🎯 Basic Form Node Configuration

### Example 1: Contact Form

```json
{
  "id": "form-node-1",
  "type": "form",
  "position": { "x": 100, "y": 100 },
  "data": {
    "type": "form",
    "label": "Contact Form",
    "config": {
      "formTitle": "Contact Us",
      "formDescription": "Please fill out the form below and we'll get back to you soon.",
      "submitButtonText": "Send Message",
      "successMessage": "Thank you! Your message has been sent.",
      "redirectUrl": "",
      "waitForSubmission": true,
      "fields": [
        {
          "name": "full_name",
          "label": "Full Name",
          "type": "text",
          "required": true,
          "placeholder": "Enter your full name"
        },
        {
          "name": "email",
          "label": "Email Address",
          "type": "email",
          "required": true,
          "placeholder": "your.email@example.com"
        },
        {
          "name": "phone",
          "label": "Phone Number",
          "type": "text",
          "required": false,
          "placeholder": "+1 (555) 123-4567"
        },
        {
          "name": "message",
          "label": "Message",
          "type": "textarea",
          "required": true,
          "placeholder": "Tell us about your inquiry..."
        }
      ]
    }
  }
}
```

### Example 2: Registration Form with Select and Radio

```json
{
  "id": "form-node-2",
  "type": "form",
  "position": { "x": 100, "y": 100 },
  "data": {
    "type": "form",
    "label": "User Registration",
    "config": {
      "formTitle": "Create Your Account",
      "formDescription": "Join our platform today!",
      "submitButtonText": "Register",
      "successMessage": "Registration successful! Welcome aboard.",
      "redirectUrl": "",
      "waitForSubmission": true,
      "fields": [
        {
          "name": "username",
          "label": "Username",
          "type": "text",
          "required": true,
          "placeholder": "Choose a username"
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "required": true,
          "placeholder": "your.email@example.com"
        },
        {
          "name": "age",
          "label": "Age",
          "type": "number",
          "required": true,
          "placeholder": "18"
        },
        {
          "name": "country",
          "label": "Country",
          "type": "select",
          "required": true,
          "options": [
            { "label": "United States", "value": "us" },
            { "label": "Canada", "value": "ca" },
            { "label": "United Kingdom", "value": "uk" },
            { "label": "Australia", "value": "au" }
          ]
        },
        {
          "name": "newsletter",
          "label": "Subscribe to Newsletter",
          "type": "checkbox",
          "required": false
        },
        {
          "name": "plan",
          "label": "Select Plan",
          "type": "radio",
          "required": true,
          "options": [
            { "label": "Free", "value": "free" },
            { "label": "Pro ($9/month)", "value": "pro" },
            { "label": "Enterprise", "value": "enterprise" }
          ]
        }
      ]
    }
  }
}
```

### Example 3: Simple Feedback Form

```json
{
  "id": "form-node-3",
  "type": "form",
  "position": { "x": 100, "y": 100 },
  "data": {
    "type": "form",
    "label": "Feedback Form",
    "config": {
      "formTitle": "We'd Love Your Feedback",
      "formDescription": "Help us improve by sharing your thoughts.",
      "submitButtonText": "Submit Feedback",
      "successMessage": "Thank you for your feedback!",
      "redirectUrl": "",
      "waitForSubmission": true,
      "fields": [
        {
          "name": "name",
          "label": "Name",
          "type": "text",
          "required": true,
          "placeholder": "Your name"
        },
        {
          "name": "email",
          "label": "Email",
          "type": "email",
          "required": true,
          "placeholder": "your.email@example.com"
        },
        {
          "name": "rating",
          "label": "Rating",
          "type": "select",
          "required": true,
          "options": [
            { "label": "Excellent", "value": "5" },
            { "label": "Good", "value": "4" },
            { "label": "Average", "value": "3" },
            { "label": "Poor", "value": "2" },
            { "label": "Very Poor", "value": "1" }
          ]
        },
        {
          "name": "comments",
          "label": "Comments",
          "type": "textarea",
          "required": false,
          "placeholder": "Additional comments..."
        }
      ]
    }
  }
}
```

---

## 📥 Sample Form Submissions

### Sample Submission 1: Contact Form

**HTTP Request:**
```
POST /forms/{workflowId}/{nodeId}/submit
Content-Type: application/x-www-form-urlencoded

full_name=John Doe
email=john.doe@example.com
phone=+1-555-123-4567
message=Hello, I'm interested in your services.
```

**JSON Equivalent:**
```json
{
  "full_name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-123-4567",
  "message": "Hello, I'm interested in your services."
}
```

### Sample Submission 2: Registration Form

**HTTP Request:**
```
POST /forms/{workflowId}/{nodeId}/submit
Content-Type: application/json

{
  "username": "johndoe123",
  "email": "john@example.com",
  "age": "28",
  "country": "us",
  "newsletter": "on",
  "plan": "pro"
}
```

**Multipart Form Data:**
```
POST /forms/{workflowId}/{nodeId}/submit
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="username"

johndoe123
------WebKitFormBoundary
Content-Disposition: form-data; name="email"

john@example.com
------WebKitFormBoundary
Content-Disposition: form-data; name="age"

28
------WebKitFormBoundary
Content-Disposition: form-data; name="country"

us
------WebKitFormBoundary
Content-Disposition: form-data; name="newsletter"

on
------WebKitFormBoundary
Content-Disposition: form-data; name="plan"

pro
------WebKitFormBoundary--
```

### Sample Submission 3: Feedback Form

**HTTP Request:**
```
POST /forms/{workflowId}/{nodeId}/submit
Content-Type: application/x-www-form-urlencoded

name=Jane Smith
email=jane.smith@example.com
rating=5
comments=Great service! Keep up the good work.
```

---

## 📤 Expected Outputs

### Expected Output 1: Contact Form Submission

**Form Node Output (to next node):**
```json
{
  "submitted_at": "2025-01-28T10:30:45.123Z",
  "form_id": "form-node-1",
  "workflow_id": "a327a1a4-30dd-4c03-90f8-6d36fc882e08",
  "data": {
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-123-4567",
    "message": "Hello, I'm interested in your services."
  },
  "_user_id": "7625d51f-2dd1-46b9-8920-42e9dc96e9af",
  "_workflow_id": "a327a1a4-30dd-4c03-90f8-6d36fc882e08"
}
```

**Execution Record in Database:**
```json
{
  "id": "exec-123-456-789",
  "workflow_id": "a327a1a4-30dd-4c03-90f8-6d36fc882e08",
  "status": "running",
  "trigger": "manual",
  "input": {
    "submitted_at": "2025-01-28T10:30:45.123Z",
    "form_id": "form-node-1",
    "workflow_id": "a327a1a4-30dd-4c03-90f8-6d36fc882e08",
    "data": {
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-123-4567",
      "message": "Hello, I'm interested in your services."
    }
  },
  "waiting_for_node_id": null,
  "logs": [
    {
      "nodeId": "form-node-1",
      "nodeLabel": "Contact Form",
      "status": "success",
      "startedAt": "2025-01-28T10:30:45.123Z",
      "finishedAt": "2025-01-28T10:30:45.143Z",
      "duration": 20,
      "input": {},
      "output": {
        "submitted_at": "2025-01-28T10:30:45.123Z",
        "form_id": "form-node-1",
        "workflow_id": "a327a1a4-30dd-4c03-90f8-6d36fc882e08",
        "data": {
          "full_name": "John Doe",
          "email": "john.doe@example.com",
          "phone": "+1-555-123-4567",
          "message": "Hello, I'm interested in your services."
        }
      }
    }
  ]
}
```

### Expected Output 2: Registration Form

**Form Node Output:**
```json
{
  "submitted_at": "2025-01-28T11:15:22.456Z",
  "form_id": "form-node-2",
  "workflow_id": "b428b2b5-41ee-5d14-a1g9-7e47gd993f19",
  "data": {
    "username": "johndoe123",
    "email": "john@example.com",
    "age": "28",
    "country": "us",
    "newsletter": "on",
    "plan": "pro"
  },
  "_user_id": "7625d51f-2dd1-46b9-8920-42e9dc96e9af",
  "_workflow_id": "b428b2b5-41ee-5d14-a1g9-7e47gd993f19"
}
```

### Expected Output 3: Feedback Form

**Form Node Output:**
```json
{
  "submitted_at": "2025-01-28T12:00:00.789Z",
  "form_id": "form-node-3",
  "workflow_id": "c539c3c6-52ff-6e25-b2h0-8f58he004g20",
  "data": {
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "rating": "5",
    "comments": "Great service! Keep up the good work."
  },
  "_user_id": "7625d51f-2dd1-46b9-8920-42e9dc96e9af",
  "_workflow_id": "c539c3c6-52ff-6e25-b2h0-8f58he004g20"
}
```

---

## 🔄 Complete Workflow Examples

### Workflow 1: Contact Form → Send to Slack

**Workflow Nodes:**
```json
{
  "nodes": [
    {
      "id": "form-node-1",
      "type": "form",
      "position": { "x": 100, "y": 100 },
      "data": {
        "type": "form",
        "label": "Contact Form",
        "config": {
          "formTitle": "Contact Us",
          "formDescription": "Fill out the form below",
          "fields": [
            { "name": "name", "label": "Name", "type": "text", "required": true },
            { "name": "email", "label": "Email", "type": "email", "required": true },
            { "name": "message", "label": "Message", "type": "textarea", "required": true }
          ]
        }
      }
    },
    {
      "id": "slack-node-1",
      "type": "slack",
      "position": { "x": 400, "y": 100 },
      "data": {
        "type": "slack",
        "label": "Send to Slack",
        "config": {
          "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
          "message": "New contact form submission:\nName: {{input.data.name}}\nEmail: {{input.data.email}}\nMessage: {{input.data.message}}"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "form-node-1",
      "target": "slack-node-1"
    }
  ]
}
```

**Test Input (Form Submission):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello, I need help with your product."
}
```

**Expected Slack Message:**
```
New contact form submission:
Name: John Doe
Email: john@example.com
Message: Hello, I need help with your product.
```

**Expected Final Output:**
```json
{
  "message": "Slack message sent",
  "success": true
}
```

### Workflow 2: Registration Form → Save to Database → Send Welcome Email

**Workflow Nodes:**
```json
{
  "nodes": [
    {
      "id": "form-node-2",
      "type": "form",
      "position": { "x": 100, "y": 100 },
      "data": {
        "type": "form",
        "label": "Registration Form",
        "config": {
          "formTitle": "Create Account",
          "fields": [
            { "name": "username", "label": "Username", "type": "text", "required": true },
            { "name": "email", "label": "Email", "type": "email", "required": true },
            { "name": "password", "label": "Password", "type": "text", "required": true }
          ]
        }
      }
    },
    {
      "id": "db-node-1",
      "type": "database",
      "position": { "x": 400, "y": 100 },
      "data": {
        "type": "database",
        "label": "Save User",
        "config": {
          "operation": "insert",
          "table": "users",
          "data": {
            "username": "{{input.data.username}}",
            "email": "{{input.data.email}}",
            "password_hash": "{{input.data.password}}"
          }
        }
      }
    },
    {
      "id": "email-node-1",
      "type": "email",
      "position": { "x": 700, "y": "100" },
      "data": {
        "type": "email",
        "label": "Send Welcome Email",
        "config": {
          "to": "{{input.data.email}}",
          "subject": "Welcome to our platform!",
          "body": "Hi {{input.data.username}}, welcome aboard!"
        }
      }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "form-node-2", "target": "db-node-1" },
    { "id": "edge-2", "source": "db-node-1", "target": "email-node-1" }
  ]
}
```

**Test Input (Form Submission):**
```json
{
  "username": "johndoe123",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Expected Output After Each Node:**

**After Form Node:**
```json
{
  "submitted_at": "2025-01-28T10:30:45.123Z",
  "form_id": "form-node-2",
  "data": {
    "username": "johndoe123",
    "email": "john@example.com",
    "password": "securepassword123"
  }
}
```

**After Database Node:**
```json
{
  "id": "user-123-456",
  "username": "johndoe123",
  "email": "john@example.com",
  "created_at": "2025-01-28T10:30:45.200Z"
}
```

**After Email Node (Final Output):**
```json
{
  "email_sent": true,
  "to": "john@example.com",
  "message_id": "msg-789-012"
}
```

---

## 🧪 Test Scenarios

### Test Scenario 1: Valid Submission

**Setup:**
- Create workflow with Form Trigger node
- Add fields: name (text, required), email (email, required)
- Activate workflow

**Action:**
- Submit form with valid data:
  ```
  name=John Doe
  email=john@example.com
  ```

**Expected Result:**
- ✅ Form submission succeeds
- ✅ Execution status changes from "waiting" to "running"
- ✅ Workflow continues to next node
- ✅ Form data is available as `{{input.data.name}}` and `{{input.data.email}}`

### Test Scenario 2: Missing Required Field

**Setup:**
- Same as Test Scenario 1

**Action:**
- Submit form with missing required field:
  ```
  name=John Doe
  (email is missing)
  ```

**Expected Result:**
- ❌ Form submission fails with validation error
- ❌ Error message: "Email is required"
- ❌ Execution remains in "waiting" state
- ❌ Workflow does not proceed

### Test Scenario 3: Invalid Email Format

**Setup:**
- Same as Test Scenario 1

**Action:**
- Submit form with invalid email:
  ```
  name=John Doe
  email=not-an-email
  ```

**Expected Result:**
- ❌ Form submission fails with validation error
- ❌ Error message: "Please enter a valid email address"
- ❌ Execution remains in "waiting" state

### Test Scenario 4: Duplicate Submission (Idempotency)

**Setup:**
- Same as Test Scenario 1

**Action:**
- Submit form twice with same idempotency key:
  ```
  First submission:
  name=John Doe
  email=john@example.com
  X-Idempotency-Key: test-key-123
  
  Second submission (same key):
  name=Jane Smith
  email=jane@example.com
  X-Idempotency-Key: test-key-123
  ```

**Expected Result:**
- ✅ First submission succeeds and triggers workflow
- ✅ Second submission is ignored (idempotent)
- ✅ Only one execution is created
- ✅ Response: "Form already submitted"

### Test Scenario 5: Form Submission While Workflow Inactive

**Setup:**
- Create workflow with Form Trigger
- Do NOT activate workflow (status = "draft")

**Action:**
- Try to submit form via public URL

**Expected Result:**
- ❌ Form submission fails
- ❌ Error message: "Form is not active. Please activate the workflow first."
- ❌ No execution is created

### Test Scenario 6: Multiple Form Submissions (Different Users)

**Setup:**
- Same as Test Scenario 1

**Action:**
- User A submits: `name=Alice, email=alice@example.com`
- User B submits: `name=Bob, email=bob@example.com`

**Expected Result:**
- ✅ Both submissions succeed
- ✅ Two separate executions are created
- ✅ Each execution has unique execution ID
- ✅ Both workflows proceed independently

### Test Scenario 7: Select Field Submission

**Setup:**
- Form with select field:
  ```json
  {
    "name": "country",
    "label": "Country",
    "type": "select",
    "required": true,
    "options": [
      { "label": "United States", "value": "us" },
      { "label": "Canada", "value": "ca" }
    ]
  }
  ```

**Action:**
- Submit form: `country=us`

**Expected Result:**
- ✅ Submission succeeds
- ✅ Output contains: `"data": { "country": "us" }`

### Test Scenario 8: Checkbox Field Submission

**Setup:**
- Form with checkbox field:
  ```json
  {
    "name": "newsletter",
    "label": "Subscribe to Newsletter",
    "type": "checkbox",
    "required": false
  }
  ```

**Action:**
- Submit form with checkbox checked: `newsletter=on`
- Submit form with checkbox unchecked: (field not sent)

**Expected Result:**
- ✅ When checked: `"data": { "newsletter": "on" }`
- ✅ When unchecked: `"data": { }` (field not present)

### Test Scenario 9: Radio Field Submission

**Setup:**
- Form with radio field:
  ```json
  {
    "name": "plan",
    "label": "Select Plan",
    "type": "radio",
    "required": true,
    "options": [
      { "label": "Free", "value": "free" },
      { "label": "Pro", "value": "pro" }
    ]
  }
  ```

**Action:**
- Submit form: `plan=pro`

**Expected Result:**
- ✅ Submission succeeds
- ✅ Output contains: `"data": { "plan": "pro" }`

### Test Scenario 10: Textarea Field Submission

**Setup:**
- Form with textarea field:
  ```json
  {
    "name": "message",
    "label": "Message",
    "type": "textarea",
    "required": true
  }
  ```

**Action:**
- Submit form with multi-line text:
  ```
  message=Line 1
  Line 2
  Line 3
  ```

**Expected Result:**
- ✅ Submission succeeds
- ✅ Output preserves newlines: `"data": { "message": "Line 1\nLine 2\nLine 3" }`

---

## 🔗 Form URL Examples

### URL Pattern
```
https://ctrlchecks.app/forms/{workflowId}/{nodeId}
```

### Example URLs

**Contact Form:**
```
https://ctrlchecks.app/forms/a327a1a4-30dd-4c03-90f8-6d36fc882e08/form-node-1
```

**Registration Form:**
```
https://ctrlchecks.app/forms/b428b2b5-41ee-5d14-a1g9-7e47gd993f19/form-node-2
```

**Feedback Form:**
```
https://ctrlchecks.app/forms/c539c3c6-52ff-6e25-b2h0-8f58he004g20/form-node-3
```

---

## 📝 Notes

1. **All form submissions are validated** against the field definitions in the node configuration
2. **Required fields** must be provided or submission fails
3. **Email fields** are validated for proper email format
4. **Number fields** are validated to ensure numeric values
5. **Idempotency keys** prevent duplicate submissions**
6. **Form data is sanitized** to prevent XSS attacks
7. **Workflow must be active** for form submissions to be processed
8. **Each submission creates exactly one execution** (unless idempotent)

---

## 🚀 Quick Test Commands

### Test Form Submission with cURL

```bash
# Contact Form
curl -X POST "https://ctrlchecks.app/forms/{workflowId}/{nodeId}/submit" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "full_name=John Doe&email=john@example.com&message=Hello"

# Registration Form (JSON)
curl -X POST "https://ctrlchecks.app/forms/{workflowId}/{nodeId}/submit" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-key-123" \
  -d '{"username":"johndoe","email":"john@example.com","age":"28","country":"us"}'

# Feedback Form
curl -X POST "https://ctrlchecks.app/forms/{workflowId}/{nodeId}/submit" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "name=Jane Smith&email=jane@example.com&rating=5&comments=Great service!"
```

---

**Last Updated:** 2025-01-28

