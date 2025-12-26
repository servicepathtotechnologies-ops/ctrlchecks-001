# Webhook Trigger Tool

A simple HTML/CSS/JS tool to trigger your Flow Genius AI webhook.

## Files

- `index.html` - Main HTML file
- `style.css` - Styling
- `script.js` - JavaScript functionality
- `README.md` - This file

## Usage

1. Open `index.html` in a web browser
2. Configure the request:
   - Select HTTP method (GET, POST, or PUT)
   - Enter request body (JSON format)
   - Enter custom headers (JSON format)
3. Click "Trigger Webhook" button
4. View the response

## Features

- ✅ Copy webhook URL to clipboard
- ✅ Support for GET, POST, and PUT methods
- ✅ JSON body editor with auto-formatting
- ✅ Custom headers support
- ✅ Real-time response display
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design
- ✅ Keyboard shortcut: Ctrl+Enter (or Cmd+Enter) to trigger

## Webhook URL

```
https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/7b82ee69-5c91-4fcc-bdf0-d3d00ac5b65e
```

## Example Request Body

```json
{
  "message": "Hello from Webhook Trigger!",
  "timestamp": "2025-12-26T07:00:00Z"
}
```

## Notes

- The `{{timestamp}}` placeholder in the body will be automatically replaced with the current timestamp
- JSON fields are auto-formatted when you click away from them
- Responses are displayed in a formatted JSON view
- The tool shows request duration and status

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge).

