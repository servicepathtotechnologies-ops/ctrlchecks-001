# How to Submit Inputs to Form Trigger

This guide explains how to provide inputs to your Form Trigger node.

---

## 🎯 Method 1: Using the Public Form URL (Easiest - Recommended)

### Step 1: Get Your Form URL
From your Form Trigger node, copy the **Public Form Link**:
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
```

### Step 2: Open in Browser
1. Click the **external link icon** (↗️) next to the URL, OR
2. Copy the URL and paste it in your browser's address bar
3. Press Enter

### Step 3: Fill Out the Form
You'll see a web form with your configured fields:
- **Email** (required)
- **NAME** (required, Text type)
- **COLLAGE** (required, Text type)

Fill in the fields:
```
Email: john.doe@example.com
NAME: John Doe
COLLAGE: MIT
```

### Step 4: Submit
Click the **Submit** button. The form will:
- ✅ Validate your inputs
- ✅ Trigger your workflow
- ✅ Show a success message

---

## 🔧 Method 2: Using cURL (Command Line)

### For Your Current Form (email, NAME, COLLAGE)

**URL-encoded format:**
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=john.doe@example.com&name=John%20Doe&collage=MIT"
```

**JSON format:**
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "name": "John Doe",
    "collage": "MIT"
  }'
```

**With idempotency key (prevents duplicates):**
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-submission-123" \
  -d '{
    "email": "john.doe@example.com",
    "name": "John Doe",
    "collage": "MIT"
  }'
```

---

## 📮 Method 3: Using Postman

### Setup:
1. **Method:** POST
2. **URL:** 
   ```
   https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit
   ```

### Headers:
```
Content-Type: application/json
```

### Body (raw JSON):
```json
{
  "email": "john.doe@example.com",
  "name": "John Doe",
  "collage": "MIT"
}
```

### Optional: Add Idempotency Header
```
X-Idempotency-Key: unique-key-123
```

---

## 🌐 Method 4: Using JavaScript/Fetch

```javascript
// Submit form data
async function submitForm() {
  const formData = {
    email: "john.doe@example.com",
    name: "John Doe",
    collage: "MIT"
  };

  try {
    const response = await fetch(
      'https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `submission-${Date.now()}` // Optional
        },
        body: JSON.stringify(formData)
      }
    );

    const result = await response.json();
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function
submitForm();
```

---

## 📋 Input Format Reference

### Based on Your Form Fields:

| Field Label | Field Name (in submission) | Type | Required | Example Input |
|------------|----------------------------|------|----------|---------------|
| Email | `email` | email | ✅ Yes | `john.doe@example.com` |
| NAME | `name` | text | ✅ Yes | `John Doe` |
| COLLAGE | `collage` | text | ✅ Yes | `MIT` |

### Important Notes:
- **Field names are auto-generated** from labels in snake_case
- "NAME" → `name`
- "COLLAGE" → `collage`
- **Required fields** must be provided or submission will fail
- **Email field** must be a valid email format

---

## ✅ Expected Response

### Success Response:
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "executionId": "exec-123-456-789"
}
```

### Error Response (Missing Required Field):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "email": "Email is required"
  }
}
```

### Error Response (Invalid Email):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "email": "Please enter a valid email address"
  }
}
```

---

## 🧪 Quick Test Examples

### Test 1: Valid Submission
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","collage":"Harvard"}'
```

### Test 2: Missing Required Field (Should Fail)
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","collage":"Harvard"}'
# Missing email - will return error
```

### Test 3: Invalid Email (Should Fail)
```bash
curl -X POST "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","name":"Test User","collage":"Harvard"}'
# Invalid email format - will return error
```

---

## 🔍 How to Check if Submission Worked

### 1. Check Execution Console
- Go to your workflow builder
- Open the **Execution Console** (bottom panel)
- Look for new execution logs
- You should see:
  ```
  ✓ [1] Form Trigger (success)
  📥 INPUT: {}
  📤 OUTPUT: {
    "submitted_at": "2025-01-28T...",
    "data": {
      "email": "john.doe@example.com",
      "name": "John Doe",
      "collage": "MIT"
    }
  }
  ```

### 2. Check Database
Query the `executions` table:
```sql
SELECT id, status, input, output, logs
FROM executions
WHERE workflow_id = '599a5dba-f3c1-45dc-b37b-4c6eaf1225ae'
ORDER BY started_at DESC
LIMIT 1;
```

### 3. Check Form Submissions Table
```sql
SELECT * FROM form_submissions
WHERE workflow_id = '599a5dba-f3c1-45dc-b37b-4c6eaf1225ae'
ORDER BY submitted_at DESC
LIMIT 1;
```

---

## ⚠️ Important Prerequisites

Before submitting:
1. ✅ **Workflow must be saved** (workflowId must exist)
2. ✅ **Workflow should be active** (status = 'active')
3. ✅ **Form node must have fields configured**
4. ✅ **All required fields must be provided**

---

## 🚨 Troubleshooting

### Error: "Form is not active"
- **Solution:** Activate your workflow first

### Error: "Validation failed"
- **Solution:** Check that all required fields are provided and email is valid

### Error: "Workflow not found"
- **Solution:** Make sure the workflowId in the URL is correct

### Error: "Node not found"
- **Solution:** Make sure the nodeId in the URL matches your form node ID

### No execution appears
- **Solution:** 
  1. Check if workflow is active
  2. Check browser console for errors
  3. Verify the form URL is correct
  4. Check Supabase function logs

---

## 📝 Example: Complete Submission Flow

1. **Configure Form Node:**
   - Add fields: Email, NAME, COLLAGE
   - All set as required

2. **Save Workflow:**
   - Click "Save" button
   - Note the workflowId

3. **Get Form URL:**
   - Copy from "Public Form Link" section

4. **Submit Data:**
   ```bash
   curl -X POST "YOUR_FORM_URL/submit" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "student@university.edu",
       "name": "John Smith",
       "collage": "MIT"
     }'
   ```

5. **Check Results:**
   - Open Execution Console
   - See execution with submitted data
   - Workflow continues to next node

---

**Your Form URL:**
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235
```

**Submit Endpoint:**
```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235/submit
```

