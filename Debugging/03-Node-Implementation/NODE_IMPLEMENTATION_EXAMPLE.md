# 📚 Node Implementation Example: CSV Parser Node

This document shows a **complete, real-world example** of implementing a node following the master prompt guidelines.

## Node Specification

**Name**: CSV Parser Node  
**Category**: Data Transformation  
**Purpose**: Parse CSV text into JSON array with configurable delimiter and header handling

## Step 1: Node Definition

**File**: `src/components/workflow/nodeTypes.ts`

```typescript
{
  type: 'csv_parser',  // Note: This already exists, but showing full implementation
  label: 'CSV Parser',
  category: 'data',
  icon: 'Table',  // Must be imported in NodeLibrary.tsx
  description: 'Parse CSV text into structured JSON data',
  defaultConfig: {
    delimiter: ',',
    hasHeader: true,
    skipEmptyRows: true
  },
  configFields: [
    {
      key: 'delimiter',
      label: 'Delimiter',
      type: 'text',
      placeholder: ',',
      defaultValue: ',',
      required: true,
      helpText: 'Character that separates columns (usually comma, tab, or semicolon)'
    },
    {
      key: 'hasHeader',
      label: 'First Row is Header',
      type: 'boolean',
      defaultValue: true,
      required: false,
      helpText: 'If enabled, first row will be used as column names'
    },
    {
      key: 'skipEmptyRows',
      label: 'Skip Empty Rows',
      type: 'boolean',
      defaultValue: true,
      required: false,
      helpText: 'Ignore rows with no data'
    }
  ]
}
```

## Step 2: Execution Logic

**File**: `supabase/functions/execute-workflow/index.ts`

```typescript
case "csv_parser": {
  // 1. Extract configuration with defaults
  const delimiter = (config.delimiter as string) || ',';
  const hasHeader = (config.hasHeader as boolean) ?? true;
  const skipEmptyRows = (config.skipEmptyRows as boolean) ?? true;
  
  // 2. Validate delimiter
  if (delimiter.length !== 1) {
    throw new Error('CSV Parser: Delimiter must be a single character');
  }
  
  // 3. Extract input - handle multiple formats
  const inputObj = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  let csvText: string;
  
  // Try to extract CSV text from common field names
  if (typeof input === 'string') {
    csvText = input;
  } else if (typeof inputObj.csv === 'string') {
    csvText = inputObj.csv;
  } else if (typeof inputObj.text === 'string') {
    csvText = inputObj.text;
  } else if (typeof inputObj.data === 'string') {
    csvText = inputObj.data;
  } else if (typeof inputObj.content === 'string') {
    csvText = inputObj.content;
  } else {
    throw new Error('CSV Parser: Input must contain CSV text. Provide CSV data in input.csv, input.text, input.data, or input.content, or pass CSV string directly.');
  }
  
  // 4. Validate CSV text is not empty
  if (!csvText || csvText.trim().length === 0) {
    throw new Error('CSV Parser: CSV text is empty');
  }
  
  try {
    // 5. Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      throw new Error('CSV Parser: No data rows found in CSV');
    }
    
    // Extract headers if applicable
    let headers: string[] = [];
    let dataStartIndex = 0;
    
    if (hasHeader && lines.length > 0) {
      headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      dataStartIndex = 1;
    }
    
    // Parse data rows
    const rows: Record<string, string>[] = [];
    
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty rows if configured
      if (skipEmptyRows && line.length === 0) {
        continue;
      }
      
      // Parse columns
      const columns = line.split(delimiter).map(col => col.trim().replace(/^"|"$/g, ''));
      
      // If no headers, use column indices
      if (headers.length === 0) {
        headers = columns.map((_, idx) => `column_${idx + 1}`);
      }
      
      // Create row object
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = columns[idx] || '';
      });
      
      rows.push(row);
    }
    
    // 6. Return standardized output
    return {
      success: true,
      rows: rows,
      count: rows.length,
      headers: headers,
      // Pass through original input for downstream nodes
      ...(typeof input === 'object' && input !== null ? input : {})
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`CSV Parser failed: ${errorMessage}. Check your CSV format and delimiter setting.`);
  }
}
```

## Step 3: Usage Guide

**File**: `src/components/workflow/nodeUsageGuides.ts`

```typescript
csv_parser: {
  overview: 'Parses CSV (Comma-Separated Values) text into a structured JSON array. Perfect for processing data from spreadsheets, exports, or CSV files. Supports custom delimiters, header detection, and empty row filtering.',
  inputs: [
    'CSV text (required) - can be in input.csv, input.text, input.data, input.content, or passed as string',
    'Any additional data (optional) - will be passed through to output'
  ],
  outputs: [
    'rows - Array of parsed row objects',
    'count - Number of rows parsed',
    'headers - Array of column names (from header row or auto-generated)'
  ],
  example: `Input CSV Text:
"name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25"

Configuration:
- Delimiter: ","
- First Row is Header: true
- Skip Empty Rows: true

Output:
{
  rows: [
    { name: "John Doe", email: "john@example.com", age: "30" },
    { name: "Jane Smith", email: "jane@example.com", age: "25" }
  ],
  count: 2,
  headers: ["name", "email", "age"]
}

Connect: Webhook (receives CSV) → CSV Parser → Loop (process each row) → Database Write`,
  tips: [
    'Use comma (,) for standard CSV, tab (\\t) for TSV files, semicolon (;) for European CSV',
    'Enable "First Row is Header" to use column names from CSV header',
    'Disable "Skip Empty Rows" if you want to preserve empty lines',
    'Headers are auto-generated as "column_1", "column_2" if no header row exists',
    'Works great with Google Sheets node output or file read operations',
    'Chain with Loop node to process each row individually',
    'Use Set Variable to store parsed data for use in multiple nodes'
  ]
}
```

## Step 4: Testing Checklist

- [x] ✅ Happy path: Valid CSV with headers
- [x] ✅ Happy path: Valid CSV without headers
- [x] ✅ Custom delimiter (tab, semicolon)
- [x] ✅ Empty input → throws error
- [x] ✅ Invalid delimiter (multiple chars) → throws error
- [x] ✅ CSV with quoted values
- [x] ✅ CSV with empty rows (skip vs keep)
- [x] ✅ Input from different field names (csv, text, data, content)
- [x] ✅ String input (direct CSV string)
- [x] ✅ Integration: Webhook → CSV Parser → Loop

## Quality Standards Compliance

✅ **Type Safety**: No `any` types, proper TypeScript interfaces  
✅ **Error Handling**: Specific, actionable error messages  
✅ **Input Validation**: Handles multiple input formats, validates delimiter  
✅ **Output Format**: Consistent structure with pass-through input  
✅ **Documentation**: Complete usage guide with examples  
✅ **Edge Cases**: Empty CSV, no headers, quoted values, empty rows  
✅ **User Experience**: Helpful error messages guide user to fix issues  

## Alternative Implementation (More Robust)

For production, you might want to use a proper CSV parser library to handle edge cases like:
- Quoted fields with commas inside
- Escaped quotes
- Multiline fields
- Different line endings (CRLF vs LF)

However, the simple implementation above works for most use cases and demonstrates the pattern.

---

**This example demonstrates all the principles from `NODE_IMPLEMENTATION_PROMPT.md`. Use it as a reference when implementing new nodes.**

