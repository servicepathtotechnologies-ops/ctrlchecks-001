# Google Nodes User Manual

Complete guide for using all 8 Google integration nodes in your workflows.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Sheets](#google-sheets)
3. [Google Doc](#google-doc)
4. [Google Drive](#google-drive)
5. [Google Calendar](#google-calendar)
6. [Google Gmail](#google-gmail)
7. [Google BigQuery](#google-bigquery)
8. [Google Tasks](#google-tasks)
9. [Google Contacts](#google-contacts)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Authentication Setup

Before using any Google nodes, you must authenticate with Google:

1. Navigate to your account settings
2. Click on "Connect Google Account" or similar
3. Authorize the application to access your Google services
4. Grant the following permissions:
   - Google Sheets
   - Google Docs
   - Google Drive
   - Google Calendar
   - Gmail
   - BigQuery (if using)
   - Google Tasks
   - Google Contacts

**Important:** All Google nodes require authentication. If you see an error about missing OAuth tokens, authenticate first.

---

## Google Sheets

### Overview
Read, write, append, or update data in Google Sheets spreadsheets.

### Operations

#### Read
Reads data from a Google Sheet.

**Configuration:**
- **Operation:** Read
- **Spreadsheet ID:** Required. Extract from URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
- **Sheet Name:** Optional. Leave empty for first sheet. Use comma-separated names for multiple sheets.
- **Range:** Optional. Format: `A1:D100`. Leave empty for all used cells.
- **Output Format:** Choose JSON Array, Key-Value Pairs, or Plain Text Table
- **Read Direction:** Row-wise (default) or Column-wise

**Example:**
```
Spreadsheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
Sheet Name: Sheet1
Range: A1:D100
Output Format: Key-Value Pairs
```

**Output:**
```json
{
  "data": [
    {"Name": "John", "Email": "john@example.com"},
    {"Name": "Jane", "Email": "jane@example.com"}
  ],
  "rows": 2,
  "columns": 4
}
```

#### Write
Overwrites data in a specified range.

**Configuration:**
- **Operation:** Write
- **Spreadsheet ID:** Required
- **Sheet Name:** Required
- **Range:** Required (e.g., `A1:D10`)
- **Data to Write:** JSON array format: `[["Header1", "Header2"], ["Value1", "Value2"]]`

**Example:**
```json
[["Name", "Email", "Status"], ["John Doe", "john@example.com", "Active"]]
```

#### Append
Adds new rows to the end of a sheet.

**Configuration:**
- **Operation:** Append
- **Spreadsheet ID:** Required
- **Sheet Name:** Required
- **Data to Write:** Same format as Write

#### Update
Updates existing cells in a range.

**Configuration:**
- **Operation:** Update
- **Spreadsheet ID:** Required
- **Sheet Name:** Required
- **Range:** Required
- **Data to Write:** Same format as Write

### Using Template Variables

You can use `{{input.field}}` to dynamically insert values:

```
Range: A{{input.startRow}}:D{{input.endRow}}
Data: [["{{input.name}}", "{{input.email}}"]]
```

### Tips
- Get Spreadsheet ID from URL: `/d/SPREADSHEET_ID/edit`
- Use Key-Value format for easier AI processing
- For multiple sheets, separate names with commas: `Sheet1, Sheet2`
- Leave range empty to read all used cells

---

## Google Doc

### Overview
Read, create, or update Google Docs documents.

### Operations

#### Read
Reads text content from an existing document.

**Configuration:**
- **Operation:** Read
- **Document ID:** Required. Extract from URL: `https://docs.google.com/document/d/DOCUMENT_ID/edit`

**Output:**
```json
{
  "documentId": "abc123...",
  "title": "My Document",
  "content": "Full text content of the document..."
}
```

#### Create
Creates a new Google Doc.

**Configuration:**
- **Operation:** Create
- **Title:** Required. Document name
- **Content:** Optional. Text to insert into the document

**Output:**
```json
{
  "documentId": "new_doc_id",
  "title": "My New Document",
  "documentUrl": "https://docs.google.com/document/d/.../edit"
}
```

#### Update
Adds text to an existing document.

**Configuration:**
- **Operation:** Update
- **Document ID:** Required
- **Content:** Required. Text to append

**Note:** Update appends text to the beginning of the document. For more complex edits, use the Google Docs API directly.

### Using Template Variables

```
Title: Report for {{input.date}}
Content: Hello {{input.name}}, this is your report...
```

### Tips
- Document ID is in the URL between `/d/` and `/edit`
- Content is inserted at the beginning of the document
- For complex formatting, consider using Google Docs API directly

---

## Google Drive

### Overview
List, upload, download, or delete files in Google Drive.

### Operations

#### List Files
Lists files in a folder.

**Configuration:**
- **Operation:** List Files
- **Folder ID:** Optional. Leave empty for root folder. Extract from URL: `https://drive.google.com/drive/folders/FOLDER_ID`

**Output:**
```json
[
  {
    "id": "file_id",
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": "12345",
    "modifiedTime": "2024-01-15T10:00:00Z"
  }
]
```

#### Upload File
Uploads a file to Google Drive.

**Configuration:**
- **Operation:** Upload File
- **File Name:** Required (e.g., `report.pdf`)
- **File Content:** Required. Base64-encoded file content

**Example:**
```
File Name: report.pdf
File Content: [Base64 encoded content]
```

**Output:**
```json
{
  "fileId": "uploaded_file_id",
  "name": "report.pdf",
  "webViewLink": "https://drive.google.com/file/d/.../view"
}
```

#### Download File
Downloads a file from Google Drive.

**Configuration:**
- **Operation:** Download File
- **File ID:** Required

**Output:**
```json
{
  "fileId": "file_id",
  "content": "[Base64 encoded content]",
  "contentType": "application/pdf"
}
```

#### Delete File
Deletes a file from Google Drive.

**Configuration:**
- **Operation:** Delete File
- **File ID:** Required

**Output:**
```json
{
  "deleted": true,
  "fileId": "deleted_file_id"
}
```

### Tips
- Use root folder by leaving Folder ID empty
- File IDs are in the URL: `/file/d/FILE_ID/view`
- For large files, consider using resumable uploads (not currently supported)

---

## Google Calendar

### Overview
Create, list, update, or delete calendar events.

### Operations

#### List Events
Lists upcoming events from a calendar.

**Configuration:**
- **Operation:** List Events
- **Calendar ID:** Default is `primary`. Use specific calendar ID for other calendars
- **Max Results:** Optional. Default is 10

**Output:**
```json
[
  {
    "id": "event_id",
    "summary": "Meeting Title",
    "start": {"dateTime": "2024-01-15T10:00:00Z"},
    "end": {"dateTime": "2024-01-15T11:00:00Z"}
  }
]
```

#### Create Event
Creates a new calendar event.

**Configuration:**
- **Operation:** Create Event
- **Calendar ID:** Default is `primary`
- **Event Title:** Required
- **Start Time:** Required. ISO 8601 format: `2024-01-15T10:00:00Z`
- **End Time:** Required. ISO 8601 format: `2024-01-15T11:00:00Z`
- **Description:** Optional

**Example:**
```
Event Title: Team Meeting
Start Time: 2024-01-15T14:00:00Z
End Time: 2024-01-15T15:00:00Z
Description: Weekly team sync
```

**Output:**
```json
{
  "eventId": "new_event_id",
  "summary": "Team Meeting",
  "htmlLink": "https://calendar.google.com/event?eid=..."
}
```

#### Update Event
Updates an existing event.

**Configuration:**
- **Operation:** Update Event
- **Calendar ID:** Required
- **Event ID:** Required
- **Event Title:** Optional
- **Start Time:** Optional
- **End Time:** Optional
- **Description:** Optional

#### Delete Event
Deletes a calendar event.

**Configuration:**
- **Operation:** Delete Event
- **Calendar ID:** Required
- **Event ID:** Required

### Using Template Variables

```
Event Title: Meeting with {{input.clientName}}
Start Time: {{input.meetingStart}}
End Time: {{input.meetingEnd}}
```

### Tips
- Use `primary` for your main calendar
- Times must be in ISO 8601 format (UTC)
- Event IDs are returned when creating events
- Use 24-hour format for times

---

## Google Gmail

### Overview
Send, list, get, or search Gmail messages.

### Operations

#### Send Email
Sends an email via Gmail.

**Configuration:**
- **Operation:** Send Email
- **To:** Required. Recipient email address
- **Subject:** Required
- **Body:** Required. Plain text email body

**Example:**
```
To: recipient@example.com
Subject: Workflow Notification
Body: Your workflow has completed successfully!
```

**Output:**
```json
{
  "messageId": "sent_message_id",
  "threadId": "thread_id"
}
```

#### List Messages
Lists recent messages.

**Configuration:**
- **Operation:** List Messages
- **Max Results:** Optional. Default is 10

**Output:**
```json
[
  {"id": "message_id_1"},
  {"id": "message_id_2"}
]
```

#### Get Message
Retrieves full message details.

**Configuration:**
- **Operation:** Get Message
- **Message ID:** Required

**Output:**
```json
{
  "id": "message_id",
  "threadId": "thread_id",
  "snippet": "Message preview...",
  "payload": {...}
}
```

#### Search Messages
Searches messages using Gmail search syntax.

**Configuration:**
- **Operation:** Search Messages
- **Search Query:** Gmail search syntax (e.g., `from:example@gmail.com`, `subject:meeting`)
- **Max Results:** Optional. Default is 10

**Example Queries:**
- `from:john@example.com` - Messages from specific sender
- `subject:meeting` - Messages with "meeting" in subject
- `is:unread` - Unread messages
- `has:attachment` - Messages with attachments

### Using Template Variables

```
To: {{input.recipientEmail}}
Subject: Report for {{input.date}}
Body: Hello {{input.name}}, your report is ready...
```

### Tips
- Gmail search syntax is powerful - use it to filter messages
- Message IDs are returned when listing messages
- Body is plain text only (HTML not supported in current implementation)
- Use search to find specific messages before getting details

---

## Google BigQuery

### Overview
Execute SQL queries on BigQuery datasets.

### Configuration

- **Project ID:** Required. Your Google Cloud Project ID
- **Dataset ID:** Required. The BigQuery dataset name
- **SQL Query:** Required. Standard SQL query
- **Use Legacy SQL:** Optional. Default is false (uses Standard SQL)

**Example:**
```
Project ID: my-project-id
Dataset ID: my_dataset
SQL Query: SELECT * FROM `my-project-id.my_dataset.my_table` LIMIT 10
```

**Output:**
```json
{
  "rows": [
    {"column1": "value1", "column2": "value2"},
    {"column1": "value3", "column2": "value4"}
  ],
  "totalRows": "2",
  "jobComplete": true
}
```

### Using Template Variables

```
SQL Query: SELECT * FROM `{{input.projectId}}.{{input.datasetId}}.{{input.tableName}}` WHERE date = '{{input.date}}'
```

### Tips
- Use backticks for table names: `` `project.dataset.table` ``
- Standard SQL is recommended (set Use Legacy SQL to false)
- Results are automatically formatted as JSON objects
- Large queries may take time - check `jobComplete` status

---

## Google Tasks

### Overview
Create, list, update, or complete Google Tasks.

### Operations

#### List Tasks
Lists tasks from a task list.

**Configuration:**
- **Operation:** List Tasks
- **Task List ID:** Default is `@default`. Use specific list ID for other lists

**Output:**
```json
[
  {
    "id": "task_id",
    "title": "Complete report",
    "status": "needsAction",
    "due": "2024-01-15T23:59:59Z"
  }
]
```

#### Create Task
Creates a new task.

**Configuration:**
- **Operation:** Create Task
- **Task List ID:** Default is `@default`
- **Task Title:** Required
- **Notes:** Optional
- **Due Date:** Optional. ISO 8601 format: `2024-01-15T23:59:59Z`

**Example:**
```
Task Title: Review project proposal
Notes: Check budget and timeline
Due Date: 2024-01-20T17:00:00Z
```

#### Update Task
Updates an existing task.

**Configuration:**
- **Operation:** Update Task
- **Task List ID:** Required
- **Task ID:** Required
- **Task Title:** Optional
- **Notes:** Optional
- **Due Date:** Optional

#### Complete Task
Marks a task as completed.

**Configuration:**
- **Operation:** Complete Task
- **Task List ID:** Required
- **Task ID:** Required

### Using Template Variables

```
Task Title: Follow up with {{input.clientName}}
Notes: Discuss {{input.topic}}
Due Date: {{input.dueDate}}
```

### Tips
- Use `@default` for your default task list
- Task IDs are returned when creating tasks
- Due dates must be in ISO 8601 format
- Completed tasks won't appear in list (by default)

---

## Google Contacts

### Overview
List, create, update, or delete Google Contacts.

### Operations

#### List Contacts
Lists contacts from your Google account.

**Configuration:**
- **Operation:** List Contacts
- **Max Results:** Optional. Default is 100

**Output:**
```json
[
  {
    "resourceName": "people/c1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
]
```

#### Create Contact
Creates a new contact.

**Configuration:**
- **Operation:** Create Contact
- **Name:** Required
- **Email:** Required
- **Phone:** Optional

**Example:**
```
Name: Jane Smith
Email: jane@example.com
Phone: +1987654321
```

**Output:**
```json
{
  "resourceName": "people/c1234567890",
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

#### Update Contact
Updates an existing contact.

**Configuration:**
- **Operation:** Update Contact
- **Contact ID:** Required (resourceName from list/create)
- **Name:** Optional
- **Email:** Optional
- **Phone:** Optional

#### Delete Contact
Deletes a contact.

**Configuration:**
- **Operation:** Delete Contact
- **Contact ID:** Required

### Using Template Variables

```
Name: {{input.firstName}} {{input.lastName}}
Email: {{input.email}}
Phone: {{input.phoneNumber}}
```

### Tips
- Contact ID is the `resourceName` field (e.g., `people/c1234567890`)
- Email is required for creating contacts
- Phone number should include country code (e.g., `+1234567890`)
- Max results limit applies to list operation

---

## Troubleshooting

### Common Errors

#### "Google OAuth token not found"
**Solution:** Authenticate with Google first. Go to settings and connect your Google account.

#### "User ID not found in workflow context"
**Solution:** This is an internal error. Ensure you're running the workflow as an authenticated user.

#### "Permission denied" or "403 Forbidden"
**Solution:** 
- Check that you've granted the necessary permissions during authentication
- Verify you have access to the resource (spreadsheet, document, etc.)
- For write operations, ensure you have edit permissions

#### "Document/File/Spreadsheet not found" or "404 Not Found"
**Solution:**
- Verify the ID is correct (extract from URL)
- Check that the resource exists and is accessible
- Ensure you're using the correct ID format

#### "Invalid date format"
**Solution:**
- Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`
- Example: `2024-01-15T14:30:00Z`
- All times are in UTC

#### "Base64 encoding error" (Drive upload)
**Solution:**
- Ensure file content is properly Base64 encoded
- Check that the file isn't corrupted
- Verify file size limits

### Best Practices

1. **Always authenticate first** - All Google nodes require authentication
2. **Use template variables** - Make workflows dynamic with `{{input.field}}`
3. **Handle errors gracefully** - Use Error Handler nodes for critical operations
4. **Test with small data first** - Verify operations work before processing large datasets
5. **Check permissions** - Ensure you have appropriate access to Google resources
6. **Use appropriate IDs** - Extract IDs from URLs, don't guess
7. **Format dates correctly** - Always use ISO 8601 format for dates/times

### Getting IDs from URLs

**Google Sheets:**
```
URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

**Google Docs:**
```
URL: https://docs.google.com/document/d/1a2b3c4d5e6f7g8h9i0j/edit
ID: 1a2b3c4d5e6f7g8h9i0j
```

**Google Drive:**
```
URL: https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view
File ID: 1a2b3c4d5e6f7g8h9i0j

URL: https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
Folder ID: 1a2b3c4d5e6f7g8h9i0j
```

### Support

For additional help:
1. Check the error message - it usually indicates what went wrong
2. Verify your configuration matches the examples
3. Ensure all required fields are filled
4. Test with a simple operation first
5. Check Google API status if issues persist

---

**Last Updated:** January 2024
**Version:** 1.0

