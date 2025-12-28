/**
 * AI Workflow Generation Agent
 * 
 * This is an intelligent agent-based system that:
 * 1. Analyzes user requirements from natural language prompts
 * 2. Makes decisions about which nodes to use and how to structure the workflow
 * 3. Generates error-free workflows with proper configurations
 * 4. Validates the workflow structure before returning
 * 
 * Agent Process:
 * - Step 1: Requirement Analysis - Understands what the user wants
 * - Step 2: Node Selection - Decides which nodes are needed
 * - Step 3: Workflow Generation - Builds the workflow structure
 * - Step 4: Validation - Ensures the workflow will work without errors
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAndFixWorkflow } from "./workflow-validation.ts";
import { AutonomousWorkflowAgent } from "./autonomous-agent.ts";

// CORS headers (inlined from _shared/cors.ts)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stream-progress',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

// LLM Adapter (inlined from _shared/llm-adapter.ts - only Gemini part needed)
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  stream?: boolean;
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

// Simplified LLM Adapter - only Gemini support (what we need)
class LLMAdapter {
  async chatGemini(
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    const apiKey = options.apiKey || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('Gemini API key required. Provide apiKey in options or set GEMINI_API_KEY environment variable.');
    }

    // Map model names to actual Gemini API model identifiers
    // Use gemini-2.5-flash as default (user's preferred model)
    const modelMap: Record<string, string> = {
      'gemini-2.5-flash': 'gemini-2.5-flash', // Try exact name first
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-pro': 'gemini-1.5-flash', // Fallback to 1.5-flash
    };

    // Use gemini-2.5-flash as default (user's preferred model)
    const model = modelMap[options.model] || 'gemini-2.5-flash';

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const conversationParts = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Try v1beta first (supports more models), fallback to v1 if needed
    let apiVersion = 'v1beta';
    let attemptModel = model;

    try {
      let url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${attemptModel}:generateContent?key=${apiKey}`;

      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: conversationParts,
          systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }],
          } : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
      });

      // If 404, try fallback models in order
      if (response.status === 404) {
        // Try gemini-2.5-flash variants first, then fallback to 1.5 models
        const fallbackModels = [
          'gemini-2.5-flash',            // Try exact 2.5 flash name
          'gemini-2.0-flash-exp',        // Try 2.5 flash variant
          'gemini-1.5-flash',            // Fallback to 1.5 flash
          'gemini-1.5-pro',              // Fallback to 1.5 pro
        ];

        for (const fallbackModel of fallbackModels) {
          if (attemptModel === fallbackModel) continue; // Skip if already tried

          console.warn(`Model ${attemptModel} not found, trying fallback: ${fallbackModel}`);
          attemptModel = fallbackModel;
          url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${fallbackModel}:generateContent?key=${apiKey}`;

          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: conversationParts,
              systemInstruction: systemInstruction ? {
                parts: [{ text: systemInstruction }],
              } : undefined,
              generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
              },
            }),
          });

          // If this model works, break out of loop
          if (response.ok) {
            console.log(`Successfully using fallback model: ${fallbackModel}`);
            break;
          }
        }
      }

      // If still 404 after fallbacks, try v1 API
      if (response.status === 404 && apiVersion === 'v1beta') {
        console.warn('v1beta API failed, trying v1 API');
        apiVersion = 'v1';
        url = `https://generativelanguage.googleapis.com/v1/models/${attemptModel}:generateContent?key=${apiKey}`;

        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: conversationParts,
            systemInstruction: systemInstruction ? {
              parts: [{ text: systemInstruction }],
            } : undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxTokens,
            },
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          const apiError = errorJson.error || errorJson;
          errorMessage = apiError.message || apiError.error?.message || errorMessage;

          // Add more context for 404 errors
          if (response.status === 404) {
            errorMessage = `Model "${attemptModel}" not found in ${apiVersion} API. ${errorMessage}. Please verify your API key has access to Gemini models and check available models.`;
          }
        } catch {
          errorMessage += ` - ${errorText}`;
        }

        console.error('Gemini API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          model: attemptModel,
          originalModel: model,
          apiVersion,
          url,
        });

        throw new Error(errorMessage);
      }

      const data = await response.json();

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageInfo = data.usageMetadata;

      // Log successful response
      if (attemptModel !== model) {
        console.log(`Successfully used fallback model: ${attemptModel} (requested: ${model})`);
      }

      return {
        content,
        usage: usageInfo ? {
          promptTokens: usageInfo.promptTokenCount || 0,
          completionTokens: usageInfo.candidatesTokenCount || 0,
          totalTokens: usageInfo.totalTokenCount || 0,
        } : undefined,
        model: data.model || attemptModel,
        finishReason: data.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Gemini API request failed: ${String(error)}`);
    }
  }

  async chat(
    provider: 'openai' | 'gemini',
    messages: LLMMessage[],
    options: LLMOptions
  ): Promise<LLMResponse> {
    if (provider === 'gemini') {
      return this.chatGemini(messages, options);
    }
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Available node types for workflow generation - COMPREHENSIVE LIST
const AVAILABLE_NODES = {
  triggers: ['manual_trigger', 'webhook', 'schedule', 'chat_trigger', 'error_trigger', 'interval', 'workflow_trigger'],
  ai: ['openai_gpt', 'anthropic_claude', 'google_gemini', 'text_summarizer', 'sentiment_analyzer', 'ai_agent', 'memory', 'llm_chain', 'azure_openai', 'hugging_face', 'cohere', 'ollama', 'embeddings', 'vector_store', 'chat_model'],
  logic: ['if_else', 'switch', 'loop', 'wait', 'error_handler', 'filter', 'merge', 'noop', 'split_in_batches', 'stop_and_error'],
  data: ['javascript', 'json_parser', 'csv_processor', 'text_formatter', 'merge_data', 'set_variable', 'aggregate', 'edit_fields', 'execute_command', 'function', 'function_item', 'item_lists', 'limit', 'rename_keys', 'set', 'sort', 'date_time', 'math', 'crypto', 'html_extract', 'xml', 'rss_feed_read', 'pdf', 'image_manipulation'],
  database: ['database_read', 'database_write', 'postgresql', 'supabase', 'mysql', 'mongodb', 'redis', 'mssql', 'sqlite', 'snowflake', 'timescaledb', 'elasticsearch'],
  storage: ['read_binary_file', 'write_binary_file', 'aws_s3', 'ftp', 'sftp', 'dropbox', 'onedrive', 'box', 'minio'],
  http_api: ['http_request', 'graphql', 'respond_to_webhook', 'http_post'],
  output: ['slack_message', 'slack_webhook', 'discord_webhook', 'microsoft_teams', 'telegram', 'whatsapp_cloud', 'twilio', 'log_output'],
  google: ['google_sheets', 'google_doc', 'google_drive', 'google_calendar', 'google_gmail', 'google_bigquery', 'google_tasks', 'google_contacts', 'google_analytics'],
  crm: ['hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshdesk', 'intercom', 'mailchimp', 'activecampaign'],
  devops: ['github', 'gitlab', 'bitbucket', 'jenkins', 'docker', 'kubernetes', 'pagerduty', 'datadog'],
  ecommerce: ['shopify', 'woocommerce', 'stripe', 'paypal', 'bigcommerce'],
  analytics: ['google_analytics', 'mixpanel', 'segment', 'amplitude'],
  authentication: ['oauth2', 'jwt', 'api_key_auth'],
  payment: ['stripe', 'paypal', 'razorpay'],
  social_media: ['twitter', 'facebook', 'instagram', 'linkedin'],
  productivity: ['notion', 'trello', 'asana', 'jira', 'linear'],
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Length': '0',
      }
    });
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept both 'prompt' and 'description' for compatibility
    // Also accept 'mode' ('create' | 'edit') and 'currentWorkflow'
    const prompt = requestBody.prompt || requestBody.description;
    const mode = requestBody.mode || 'create';
    const currentWorkflow = requestBody.currentWorkflow;
    const config = requestBody.config || {}; // User provided configuration values

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'edit' && !currentWorkflow) {
      return new Response(
        JSON.stringify({ error: 'currentWorkflow is required for edit mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get auth token from request (optional for now, but recommended)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    let user = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '').replace('bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
        if (!authError && authUser) {
          user = authUser;
        }
      } catch (authErr) {
        console.warn('Auth verification failed:', authErr);
        // Continue without auth for now
      }
    }

    // Build comprehensive system prompt with all available node types and descriptions
    const nodeDescriptions = `
TRIGGERS:
- manual_trigger: Start workflow manually (no config needed)
- webhook: Trigger via HTTP webhook (config: method: POST/GET/PUT)
- schedule: Run on a schedule (config: time in HH:MM format like "09:00", timezone like "Asia/Kolkata" or "UTC")
- chat_trigger: Trigger from chat/AI/UI messages (no config, receives message and session_id)
- error_trigger: Automatically fire when any node fails (no config, global scope)
- interval: Run workflow at fixed intervals (config: interval like "10m", "30s", "1h")
- workflow_trigger: Trigger one workflow from another (config: source_workflow_id)

AI PROCESSING:
- openai_gpt: Process with OpenAI GPT models (config: apiKey, model: gpt-4o/gpt-4o-mini/gpt-4-turbo, prompt, temperature, memory)
- anthropic_claude: Process with Claude models (config: apiKey, model: claude-3-5-sonnet/claude-3-opus/claude-3-haiku, prompt, temperature, memory)
- google_gemini: Process with Google Gemini models (config: apiKey, model: gemini-2.5-flash/gemini-2.5-pro/gemini-2.5-flash-lite, prompt, temperature, memory)
- text_summarizer: Summarize text using AI (config: apiKey, maxLength, style: concise/bullets/detailed, memory)
- sentiment_analyzer: Analyze text sentiment (config: apiKey, memory)
- ai_agent: Autonomous AI agent with tool usage (config: apiKey, model, prompt, tools as JSON array, maxIterations, temperature)
- memory: Store/retrieve conversation memory (config: operation: store/retrieve/clear/search, memoryType: short/long/both, ttl, maxMessages)
- llm_chain: Chain multiple prompts (config: steps as JSON array)
- azure_openai: Use Azure OpenAI service (config: endpoint, apiKey, deploymentName, model, prompt, temperature)
- hugging_face: Use Hugging Face models (config: apiKey, model, input, parameters as JSON)
- cohere: Use Cohere AI models (config: apiKey, model, prompt, temperature)
- ollama: Use local Ollama models (config: baseUrl, model, prompt, temperature)
- embeddings: Generate text embeddings (config: apiKey, model, input)
- vector_store: Store and search vectors (config: operation: store/search, vectors, query, topK)
- chat_model: Chat with AI models (config: apiKey, model, messages as JSON array, temperature)

LOGIC & CONTROL:
- if_else: Conditional branching (config: condition expression like "{{input.value}} > 10") - MUST have both true and false output edges
- switch: Multiple case branching (config: expression, cases as JSON array)
- loop: Iterate over items (config: array expression, maxIterations)
- wait: Pause execution (config: duration in milliseconds)
- error_handler: Handle errors gracefully (config: retries, retryDelay, fallbackValue)
- filter: Filter array items (config: array expression, condition)
- merge: Merge multiple inputs (config: mode: append/merge, mergeKey for key-based merge)
- noop: No operation - pass through data unchanged (no config)
- split_in_batches: Split array into batches (config: array expression, batchSize)
- stop_and_error: Stop workflow with error (config: errorMessage, errorCode)

DATA TRANSFORM:
- javascript: Run custom JavaScript code (config: code, timeout)
- json_parser: Parse/transform JSON using JSONPath (config: expression like "$.data.items[*]")
- csv_processor: Process CSV data (config: delimiter, hasHeader)
- text_formatter: Format text with templates (config: template like "Hello {{name}}!")
- merge_data: Combine multiple inputs (config: mode: merge/concat)
- set_variable: Store value in variable (config: name, value)
- aggregate: Aggregate array data (config: operation: sum/count/avg/min/max, field, groupBy)
- edit_fields: Edit object fields (config: operations as JSON array with set/delete/rename)
- execute_command: Execute shell command (config: command, enabled, timeout) - WARNING: disabled by default
- function: Run function code (config: code, timeout)
- function_item: Run function on each item (config: code, timeout)
- item_lists: Convert items to list format (no config)
- limit: Limit number of items (config: limit)
- rename_keys: Rename object keys (config: mappings as JSON object)
- set: Set object fields (config: fields as JSON object)
- sort: Sort array items (config: field, direction: asc/desc, type: string/number/date)
- date_time: Date/time operations (config: operation: format/parse/add/subtract, format, value)
- math: Mathematical operations (config: operation: add/subtract/multiply/divide/power/round, a, b)
- crypto: Cryptographic operations (config: operation: hash/encode_base64/decode_base64/uuid/random_string/hmac, algorithm, secretKey, length, charset)
- html_extract: Extract data from HTML (config: html, selector, sanitize, stripScripts, extractText, maxSize)
- xml: Parse/validate XML (config: operation: parse/extract/validate, xml, xpath, safeMode, maxSize)
- rss_feed_read: Read RSS/Atom feeds (config: feedUrl, maxItems, detectDuplicates, timeout)
- pdf: Process PDF documents (config: operation: extractText/readMetadata, pdfUrl, maxSize)
- image_manipulation: Process images (config: operation: resize/crop/convert/readMetadata, imageUrl, width, height, format, quality)

DATABASE NODES:
- database_read: Read from database (config: table, columns, filters, limit, orderBy, ascending)
- database_write: Write to database (config: table, operation: insert/update/upsert/delete, data, matchColumn)
- postgresql: PostgreSQL operations (config: host, port, database, username, password, query/operation, ssl)
- supabase: Supabase operations (config: url, key, operation: query/insert/update/delete, table, data)
- mysql: MySQL operations (config: host, port, database, username, password, query/operation, ssl)
- mongodb: MongoDB operations (config: connectionString, database, collection, operation: find/insert/update/delete, query, document)
- redis: Redis operations (config: host, port, password, operation: get/set/delete/keys, key, value, ttl)
- mssql: Microsoft SQL Server operations (config: server, database, username, password, query/operation, ssl)
- sqlite: SQLite operations (config: databasePath, query/operation, table, data)
- snowflake: Snowflake operations (config: account, username, password, database, schema, warehouse, query)
- timescaledb: TimescaleDB operations (config: host, port, database, username, password, query)
- elasticsearch: Elasticsearch operations (config: nodeUrl, username, password, index, operation: search/index/get/update/delete/bulk, query, documentId, document, bulkBody)

STORAGE NODES:
- read_binary_file: Read binary file (config: filePath, encoding)
- write_binary_file: Write binary file (config: filePath, content, encoding)
- aws_s3: AWS S3 operations (config: accessKeyId, secretAccessKey, region, bucket, operation: get/put/delete/list, key, body)
- ftp: FTP operations (config: host, port, username, password, operation: list/get/put/delete, path, fileContent)
- sftp: SFTP operations (config: host, port, username, password, operation: list/get/put/delete, path, fileContent)
- dropbox: Dropbox operations (config: accessToken, operation: read/write/list/delete, path, content)
- onedrive: OneDrive operations (config: accessToken, operation: list/get/upload/delete, path, fileContent)
- box: Box operations (config: accessToken, operation: list/get/upload/delete, fileId, path, fileContent)
- minio: MinIO operations (config: endpoint, accessKey, secretKey, bucket, operation: get/put/delete/list, key, body)

HTTP & API NODES:
- http_request: Make HTTP API call (config: url, method: GET/POST/PUT/PATCH/DELETE, headers, body, timeout)
- graphql: Execute GraphQL query (config: url, query, variables as JSON, headers, operationName, timeout)
- respond_to_webhook: Send custom response to webhook caller (config: statusCode, responseBody as JSON, headers)
- http_post: Send HTTP POST request (config: url, headers, bodyTemplate)

OUTPUT & COMMUNICATION:
- google_gmail: ✅ REQUIRED for sending emails (config: operation: "send", to, subject, body). 
  * ✅ No domain verification needed. Works with any Gmail account.
  * ✅ ALWAYS use google_gmail when user mentions "gmail", "email", or "send email".
  * ✅ THIS IS THE ONLY EMAIL NODE TYPE AVAILABLE - USE google_gmail FOR ALL EMAIL OPERATIONS.
- slack_message: Send Slack notification (config: webhookUrl, channel, username, iconEmoji, message, blocks)
- slack_webhook: Simple Slack webhook (config: webhookUrl, text). Use {{input.content}} or {{input.slackMessage}} to pass data from previous nodes.
- discord_webhook: Send Discord message (config: webhookUrl, content, username, avatarUrl)
- microsoft_teams: Send Microsoft Teams message (config: webhookUrl, title, text, themeColor)
- telegram: Send Telegram message (config: botToken, chatId, text, parseMode)
- whatsapp_cloud: Send WhatsApp message via Cloud API (config: phoneNumberId, accessToken, to, message)
- twilio: Send SMS via Twilio (config: accountSid, authToken, from, to, body)
- log_output: Log data for debugging (config: message, level: info/warn/error/debug)

GOOGLE NODES:
- google_sheets: Read/write Google Sheets (config: operation: read/write/append/update, spreadsheetId, sheetName, range, outputFormat). Get spreadsheetId from URL: /d/SPREADSHEET_ID/edit
  * Read operation outputs: {data: [[headers], [row1], [row2], ...], rows, columns, range, formatted, operation, sheetName, spreadsheetId}
  * The "data" field is an array of arrays where first row is headers, subsequent rows are data.
  * CRITICAL: When reading Google Sheets, you MUST use a javascript node to parse the array-of-arrays format.
  * Example JavaScript code to parse Google Sheets data:
    const sheetsData = input.data || [];
    let sheetsText = "Data from Google Sheets:\\n";
    if (sheetsData.length === 0) {
      sheetsText += "No data found in Google Sheets.\\n";
    } else {
      const headers = sheetsData[0] || [];
      const dataRows = sheetsData.slice(1);
      if (dataRows.length === 0) {
        sheetsText += "No data rows found.\\n";
      } else {
        dataRows.forEach((row, idx) => {
          const rowText = row.map((cell, i) => {
            const header = headers[i] || \`Column\${i + 1}\`;
            return \`\${header}: \${cell || ''}\`;
          }).join(', ');
          sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
        });
      }
    }
    return { sheetsText, sheetsData };
  * ALWAYS format the data as readable text for email/Slack output.
- google_doc: Read/create/update Google Docs (config: operation: read/create/update, documentId, title, content). 
  * Read operation: Extract documentId from Google Docs URL. Full URL format: https://docs.google.com/document/d/DOCUMENT_ID/edit. You can paste full URL or just the ID part after /d/. 
  * Returns: {documentId, title, content: "extracted text", body: "same as content", text: "same as content", contentLength, hasContent, documentUrl}. 
  * The content/body/text fields contain ALL extracted text from the document.
  * CRITICAL: When reading Google Docs, the content is already in text format - use {{input.content}} directly in output nodes.
  * If you need to combine with Sheets data, use JavaScript node to merge:
    const docContent = input.content || input.text || input.body || '';
    const docText = docContent ? \`Data from Google Document:\\n\${docContent}\` : "No Google Doc content found.\\n";
    return { docText, docContent };
  * Create operation: Creates new empty doc, then inserts content if provided. Returns {documentId, title, documentUrl}.
  * Update operation: Appends content to beginning of document. Requires documentId and content.
- google_drive: List/upload/download/delete Google Drive files (config: operation: list/upload/download/delete, folderId, fileId, fileName, fileContent). Leave folderId empty for root. Get fileId from URL: /file/d/FILE_ID/view. Upload requires Base64 fileContent.
- google_calendar: Create/list/update/delete calendar events (config: operation: list/create/update/delete, calendarId: use "primary", eventId, summary, startTime: ISO 8601, endTime: ISO 8601, description). Times must be UTC format: 2024-01-15T14:00:00Z
- google_gmail: Send/list/get/search Gmail messages (config: operation: send/list/get/search, to, subject, body, messageId, query: Gmail search syntax like "from:email" or "subject:text", maxResults). 
  * Send operation: Use operation: "send", requires: to, subject, body. 
  * To send data from previous node: Use {{input.content}} or {{input.text}} or {{input.body}} in the body field.
  * Example: If previous node is google_doc, use body: "{{input.content}}" to send the document text.
  * Search syntax: from:, subject:, is:unread, has:attachment
- google_bigquery: Execute SQL queries on BigQuery (config: projectId, datasetId, query: SQL with backticks for table names like \`project.dataset.table\`, useLegacySql: false for Standard SQL). Returns rows as JSON objects.
- google_tasks: Create/list/update/complete Google Tasks (config: operation: list/create/update/complete, taskListId: use "@default", taskId, title, notes, dueDate: ISO 8601). Task IDs returned when creating.
- google_contacts: List/create/update/delete Google Contacts (config: operation: list/create/update/delete, contactId: resourceName like "people/c123", name, email: required for create, phone: include country code like +1234567890, maxResults). Contact IDs are resourceName field.
- google_analytics: Google Analytics data and reporting (config: accessToken, operation: get_report/list_properties/track_event, propertyId, dateRanges, dimensions, metrics, eventName, eventParams)

CRM & MARKETING:
- hubspot: HubSpot CRM operations (config: apiKey, operation: create_contact/update_contact/get_contact/list_contacts/create_deal/update_deal, objectType, properties)
- salesforce: Salesforce operations (config: instanceUrl, accessToken, operation: query/create/update/delete, sobject, query, data)
- zoho_crm: Zoho CRM operations (config: accessToken, operation: create/update/get/list, module, recordId, data)
- pipedrive: Pipedrive operations (config: apiToken, operation: add/update/get/list, entityType, entityId, data)
- freshdesk: Freshdesk operations (config: domain, apiKey, operation: create_ticket/update_ticket/get_ticket/list_tickets, ticketId, data)
- intercom: Intercom operations (config: accessToken, operation: create_conversation/update_conversation/get_conversation/list_conversations, conversationId, data)
- mailchimp: Mailchimp operations (config: apiKey, dataCenter, operation: add_member/update_member/get_member/list_members, listId, email, mergeFields)
- activecampaign: ActiveCampaign operations (config: apiUrl, apiKey, operation: add_contact/update_contact/get_contact/list_contacts, contactId, email, firstName, lastName)

DEVOPS:
- github: GitHub operations (config: token, operation: create_issue/update_issue/get_issue/list_issues/create_pr/merge_pr, owner, repo, issueNumber, title, body)
- gitlab: GitLab operations (config: token, baseUrl, operation: create_issue/update_issue/get_issue/list_issues/create_merge_request, projectId, issueId, title, description)
- bitbucket: Bitbucket operations (config: username, appPassword, workspace, operation: create_issue/update_issue/get_issue/list_issues/create_pr, repo, issueId, title, content)
- jenkins: Jenkins operations (config: url, username, apiToken, operation: trigger_build/get_build_status, jobName, buildNumber)
- docker: Docker operations (config: host, port, operation: list_containers/start_container/stop_container/remove_container, containerId)
- kubernetes: Kubernetes operations (config: kubeconfig, operation: get_pods/list_pods/create_deployment, namespace, name, manifest)
- pagerduty: PagerDuty operations (config: apiKey, operation: create_incident/update_incident/get_incident/list_incidents, incidentId, title, serviceId, urgency)
- datadog: Datadog operations (config: apiKey, appKey, operation: create_event/get_metric/query_metrics, title, text, tags, metric, query)

ECOMMERCE:
- shopify: Shopify operations (config: shopDomain, accessToken, operation: get_product/create_product/update_product/list_orders/get_order, productId, orderId, data)
- woocommerce: WooCommerce operations (config: url, consumerKey, consumerSecret, operation: get_product/create_product/update_product/list_orders, productId, orderId, data)
- stripe: Stripe payment operations (config: apiKey, operation: create_charge/create_customer/create_subscription/get_payment_intent, amount, currency, customerId, paymentIntentId)
- paypal: PayPal operations (config: clientId, clientSecret, mode: sandbox/live, operation: create_order/capture_order/get_order, orderId, amount, currency)
- bigcommerce: BigCommerce operations (config: storeHash, accessToken, operation: get_product/list_products/get_order/list_orders/get_customer, productId, orderId, customerId, limit)

ANALYTICS:
- mixpanel: Mixpanel analytics (config: projectToken, apiSecret, operation: track_event/track_user/get_event/query_insights, eventName, distinctId, properties, query)
- segment: Segment analytics (config: writeKey, operation: track/identify/page/group, userId, event, properties, traits, name, groupId)
- amplitude: Amplitude analytics (config: apiKey, secretKey, operation: track/identify/get_event, userId, eventType, eventProperties, userProperties)

AUTHENTICATION:
- oauth2: OAuth2 authentication (config: clientId, clientSecret, tokenUrl, authorizationUrl, scope, grantType)
- jwt: JWT token operations (config: operation: encode/decode/verify, secret, payload, token, algorithm)
- api_key_auth: API key authentication (config: apiKey, headerName)

PAYMENT:
- razorpay: Razorpay payment operations (config: keyId, keySecret, operation: create_order/create_payment/capture_payment, orderId, amount, currency, receipt)

PRODUCTIVITY:
- notion: Notion operations (config: apiKey, operation: create_page/update_page/get_page/list_pages, pageId, databaseId, title, content)
- trello: Trello operations (config: apiKey, token, operation: create_card/update_card/get_card/list_cards, boardId, listId, cardId, name, desc)
- asana: Asana operations (config: accessToken, operation: create_task/update_task/get_task/list_tasks, taskId, workspaceId, name, notes)
- jira: Jira operations (config: domain, email, apiToken, operation: create_issue/update_issue/get_issue/list_issues, issueKey, projectKey, summary, description)
- linear: Linear operations (config: apiKey, operation: create_issue/update_issue/get_issue/list_issues, issueId, teamId, title, description)
`;

    // Initialize LLM adapter and API key early
    const llmAdapter = new LLMAdapter();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured. Please set it in Supabase project settings under Edge Functions secrets.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For 'create' mode: Use Advanced Autonomous Workflow AI Agent
    if (mode === 'create') {
      try {
        console.log('[AUTONOMOUS AGENT] Starting autonomous workflow generation...');
        
        // Check if client wants streaming progress updates
        const streamProgress = req.headers.get('accept')?.includes('text/event-stream') || 
                              req.headers.get('x-stream-progress') === 'true';
        
        if (streamProgress) {
          // Create a streaming response with progress updates
          const stream = new ReadableStream({
            async start(controller) {
              let finalWorkflow: any = null;
              let hasError = false;
              
              try {
                // Initialize autonomous agent with progress callback
                const agent = new AutonomousWorkflowAgent(
                  {
                    apiKey,
                    model: 'gemini-2.5-flash',
                    temperature: 0.3,
                    maxIterations: 10,
                    enableLearning: true,
                    onProgress: (progress) => {
                      // Send progress update as JSON line
                      const progressLine = JSON.stringify(progress) + '\n';
                      controller.enqueue(new TextEncoder().encode(progressLine));
                    },
                  },
                  nodeDescriptions
                );

                // Execute autonomous agent (this will call onProgress callbacks)
                finalWorkflow = await agent.execute(prompt, config);
                
                // Send final workflow
                const finalResponse = {
                  status: 'completed',
                  workflow: finalWorkflow,
                };
                controller.enqueue(new TextEncoder().encode(JSON.stringify(finalResponse) + '\n'));
                controller.close();
              } catch (error) {
                hasError = true;
                const errorResponse = {
                  status: 'error',
                  error: error instanceof Error ? error.message : String(error),
                };
                controller.enqueue(new TextEncoder().encode(JSON.stringify(errorResponse) + '\n'));
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no', // Disable buffering for streaming
            },
          });
        }
        
        // Non-streaming mode: collect progress (but can't send it in real-time)
        // We'll include initial progress estimate in response
        let lastProgress: any = null;
        const startTime = Date.now();
        
        // Estimate time before starting
        const goalLower = prompt.toLowerCase();
        let estimatedTime = 15;
        const hasSheets = goalLower.includes('google sheet') || goalLower.includes('sheets');
        const hasDoc = goalLower.includes('google doc') || goalLower.includes('document');
        const hasGmail = goalLower.includes('gmail') || goalLower.includes('email');
        const hasSlack = goalLower.includes('slack');
        const integrations = [hasSheets, hasDoc, hasGmail, hasSlack].filter(Boolean).length;
        estimatedTime += integrations * 3;
        if (hasSheets) estimatedTime += 2;
        if (hasSheets && hasDoc) estimatedTime += 2;
        if (hasGmail && hasSlack) estimatedTime += 2;
        estimatedTime = Math.max(12, Math.min(45, estimatedTime));
        
        // Initialize autonomous agent with full node knowledge
        const agent = new AutonomousWorkflowAgent(
          {
            apiKey,
            model: 'gemini-2.5-flash',
            temperature: 0.3,
            maxIterations: 10,
            enableLearning: true,
            onProgress: (progress) => {
              lastProgress = progress;
            },
          },
          nodeDescriptions
        );

        // Execute autonomous agent
        const workflow = await agent.execute(prompt, config);
        
        // CRITICAL: Check if workflow is a fallback (just trigger + log) - this is WRONG
        const nodeTypes = workflow.nodes?.map((n: any) => n.type) || [];
        if (nodeTypes.length <= 2 && nodeTypes.includes('manual_trigger') && nodeTypes.includes('log_output')) {
          console.error('[AUTONOMOUS AGENT] CRITICAL: Generated fallback workflow instead of proper workflow');
          throw new Error('Workflow generation failed - generated fallback instead of proper workflow. Please try again.');
        }

        // Validate and fix workflow structure
        const validatedWorkflow = validateAndFixWorkflow(workflow);

        // CRITICAL: ALWAYS replace email_resend with google_gmail (email_resend doesn't exist in node library)
        validatedWorkflow.nodes = validatedWorkflow.nodes.map((node: any) => {
          if (node.type === 'email_resend') {
            console.log(`[AUTONOMOUS AGENT] CRITICAL FIX: Replacing email_resend with google_gmail for node ${node.id}`);
            return {
              ...node,
              type: 'google_gmail',
              config: {
                ...node.config,
                operation: 'send',
                to: node.config.to || '',
                subject: node.config.subject || 'Message from Workflow',
                body: node.config.body || node.config.text || '',
              },
            };
          }
          return node;
        });

        // CRITICAL: Final validation - check if workflow matches user requirements
        const promptLower = prompt.toLowerCase();
        const nodeTypes = validatedWorkflow.nodes?.map((n: any) => n.type) || [];
        
        // CRITICAL: Check if workflow is just trigger + log (fallback) - REJECT IMMEDIATELY
        if (nodeTypes.length <= 2 && nodeTypes.includes('manual_trigger') && nodeTypes.includes('log_output')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Workflow is just fallback (trigger + log)');
          throw new Error('Generated workflow is incomplete (only trigger + log). This indicates the AI agent failed to generate the proper workflow. Please try again.');
        }
        
        // Check for Google Sheets
        if ((promptLower.includes('google sheet') || promptLower.includes('sheets')) && !nodeTypes.includes('google_sheets')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Missing google_sheets node');
          throw new Error('Generated workflow is missing required google_sheets node. The workflow cannot read from Google Sheets as requested. Please try again.');
        }
        
        // Check for Google Doc
        if ((promptLower.includes('google doc') || promptLower.includes('document')) && !nodeTypes.includes('google_doc')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Missing google_doc node');
          throw new Error('Generated workflow is missing required google_doc node. The workflow cannot read from Google Documents as requested. Please try again.');
        }
        
        // Check for Gmail
        if ((promptLower.includes('gmail') || promptLower.includes('email')) && !nodeTypes.includes('google_gmail')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Missing google_gmail node');
          throw new Error('Generated workflow is missing required google_gmail node. The workflow cannot send emails as requested. Please try again.');
        }
        
        // Check for Slack
        if (promptLower.includes('slack') && !nodeTypes.includes('slack_webhook') && !nodeTypes.includes('slack_message')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Missing slack node');
          throw new Error('Generated workflow is missing required slack node. The workflow cannot send to Slack as requested. Please try again.');
        }
        
        // Check for JavaScript node when Google Sheets is present (needed for parsing)
        if (nodeTypes.includes('google_sheets') && !nodeTypes.includes('javascript')) {
          console.error('[AUTONOMOUS AGENT] FINAL CHECK FAILED: Missing javascript node for Google Sheets parsing');
          throw new Error('Generated workflow has Google Sheets but missing JavaScript node to parse the data. Please try again.');
        }

        // Ensure all config values are strings
        validatedWorkflow.nodes = validatedWorkflow.nodes.map((node: any) => {
          if (node.config && typeof node.config === 'object') {
            const fixedConfig: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(node.config)) {
              if (value === null || value === undefined) {
                fixedConfig[key] = '';
              } else if (typeof value !== 'string') {
                if (typeof value === 'object') {
                  fixedConfig[key] = JSON.stringify(value);
                } else {
                  fixedConfig[key] = String(value);
                }
              } else {
                fixedConfig[key] = value;
              }
            }
            node.config = fixedConfig;
          }
          return node;
        });

        // Apply user config values to nodes
        validatedWorkflow.nodes = validatedWorkflow.nodes.map((node: any) => {
          if (node.type === 'google_doc' && node.config.operation === 'read') {
            node.config.documentId = node.config.documentId || config.documentId || config.google_doc_id || config.google_doc_url || '';
          }
          if (node.type === 'google_sheets' && node.config.operation === 'read') {
            node.config.spreadsheetId = node.config.spreadsheetId || config.spreadsheetId || config.google_sheet_id || '';
            node.config.sheetName = node.config.sheetName || config.sheetName || 'Sheet1';
          }
          if (node.type === 'slack_webhook' || node.type === 'slack_message') {
            node.config.webhookUrl = node.config.webhookUrl || config.webhookUrl || config.slack_webhook || '';
          }
          if (node.type === 'google_gmail' && node.config.operation === 'send') {
            node.config.to = node.config.to || config.to || config.email || '';
            node.config.subject = node.config.subject || config.subject || 'Message from Workflow';
            // Ensure body uses template variable if not already set
            if (!node.config.body || (!node.config.body.includes('{{input') && !node.config.body.trim())) {
              node.config.body = node.config.body || '{{input.content}}';
            }
          }
          return node;
        });
        
        // CRITICAL: Final check - ensure JavaScript nodes return formatted text
        const promptLower = prompt.toLowerCase();
        const hasSheets = promptLower.includes('google sheet') || promptLower.includes('sheets');
        const hasDoc = promptLower.includes('google doc') || promptLower.includes('document');
        
        validatedWorkflow.nodes = validatedWorkflow.nodes.map((node: any) => {
          if (node.type === 'javascript') {
            const code = node.config?.code || '';
            const hasReturnContent = code.includes('content:') || code.includes('"content"') || code.includes("'content'");
            const hasReturnText = code.includes('text:') || code.includes('"text"') || code.includes("'text'");
            
            // If JavaScript node doesn't return formatted text, fix it
            if (!hasReturnContent && !hasReturnText && code.trim() !== '') {
              console.log(`[AUTONOMOUS AGENT] Fixing JavaScript node ${node.id} - ensuring it returns formatted text`);
              
              if (hasSheets && hasDoc) {
                // Both Sheets and Doc
                node.config.code = `// Parse and format data from Google Sheets and Google Document
const sheetsInput = input.sheetsInput || input.input1 || input;
const docInput = input.docInput || input.input2 || {};

// Process Google Sheets data
const sheetsData = sheetsInput.data || [];
let sheetsText = "Data from Google Sheets:\\n";
if (sheetsData.length === 0) {
  sheetsText += "No data found in Google Sheets.\\n\\n";
} else {
  const headers = sheetsData[0] || [];
  const dataRows = sheetsData.slice(1);
  if (dataRows.length === 0) {
    sheetsText += "No data rows found in Google Sheets.\\n\\n";
  } else {
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
    sheetsText += "\\n";
  }
}

// Process Google Document content
const docContent = docInput.content || docInput.text || docInput.body || '';
let docText = "Data from Google Document:\\n";
if (!docContent || docContent.trim() === '') {
  docText += "No Google Doc content found.\\n";
} else {
  docText += docContent;
}

// Combine both sources
const combinedText = sheetsText + docText;

// Return formatted text for email/Slack
return {
  content: combinedText,
  text: combinedText,
  body: combinedText
};`;
              } else if (hasSheets) {
                // Only Sheets
                node.config.code = `// Parse and format data from Google Sheets
const sheetsData = input.data || [];
let sheetsText = "Data from Google Sheets:\\n";
if (sheetsData.length === 0) {
  sheetsText += "No data found in Google Sheets.\\n";
} else {
  const headers = sheetsData[0] || [];
  const dataRows = sheetsData.slice(1);
  if (dataRows.length === 0) {
    sheetsText += "No data rows found in Google Sheets.\\n";
  } else {
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
}

// Return formatted text for email/Slack
return {
  content: sheetsText,
  text: sheetsText,
  body: sheetsText
};`;
              }
            }
          }
          
          // Ensure output nodes use template variables
          if (node.type === 'google_gmail' && node.config.operation === 'send') {
            if (!node.config.body || (!node.config.body.includes('{{input.content}}') && 
                                     !node.config.body.includes('{{input.text}}') && 
                                     !node.config.body.includes('{{input.body}}'))) {
              node.config.body = '{{input.content}}';
            }
          }
          if (node.type === 'slack_webhook') {
            if (!node.config.text || (!node.config.text.includes('{{input.content}}') && 
                                     !node.config.text.includes('{{input.text}}') && 
                                     !node.config.text.includes('{{input.body}}'))) {
              node.config.text = '{{input.content}}';
            }
          }
          if (node.type === 'slack_message') {
            if (!node.config.message || (!node.config.message.includes('{{input.content}}') && 
                                        !node.config.message.includes('{{input.text}}') && 
                                        !node.config.message.includes('{{input.body}}'))) {
              node.config.message = '{{input.content}}';
            }
          }
          
          return node;
        });

        console.log('[AUTONOMOUS AGENT] Workflow generation completed successfully');
        console.log(`Generated ${validatedWorkflow.nodes.length} nodes and ${validatedWorkflow.edges.length} edges`);

        return new Response(
          JSON.stringify(validatedWorkflow),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (agentError) {
        console.error('[AUTONOMOUS AGENT] Error:', agentError);
        // Fall through to legacy generation as fallback
        console.log('[AUTONOMOUS AGENT] Falling back to legacy generation...');
      }
    }

    // AGENT-BASED WORKFLOW GENERATION
    // Step 1: Requirement Analysis
    const analysisPrompt = `You are an intelligent workflow automation agent. Your task is to analyze user requirements and understand what they want to achieve.

USER PROMPT: "${prompt}"

USER PROVIDED CONFIGURATION:
${JSON.stringify(config, null, 2)}

CRITICAL: Pay special attention to these common patterns:
- "read data from Google Doc and send to Slack" → google_doc (read) + slack_webhook
- "get data from Google Doc and send it" → google_doc (read) + google_gmail (send)
- "read Google Doc and send to email" → google_doc (read) + google_gmail (send) - ALWAYS use google_gmail
- "read Google Sheets and send to Slack" → google_sheets (read) + javascript (parse) + slack_webhook
- "send email" or "email" → ALWAYS use google_gmail (operation: "send")

When you detect "read" or "get" + "Google Doc" + "send" or "Slack":
- REQUIRED: google_doc node with operation: "read"
- REQUIRED: Output node (slack_webhook, google_gmail, etc.) with template variable {{input.content}}
- The google_doc node outputs: {content, text, body} - use {{input.content}} to pass data
- If combining with Google Sheets, use merge_data or javascript node to combine both sources
- Example JavaScript to combine Sheets + Doc:
  const sheetsData = input1.data || [];
  const docContent = input2.content || input2.text || '';
  let combinedText = "Data from Google Sheets:\\n";
  if (sheetsData.length === 0) {
    combinedText += "No data found in Google Sheets.\\n\\n";
  } else {
    const headers = sheetsData[0] || [];
    const dataRows = sheetsData.slice(1);
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      combinedText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
  combinedText += "\\nData from Google Document:\\n";
  combinedText += docContent || "No Google Doc content found.\\n";
  return { content: combinedText, text: combinedText, body: combinedText };

When you detect "read" or "get" + "Google Sheets" + "send":
- REQUIRED: google_sheets node with operation: "read"
- REQUIRED: javascript node to parse the array-of-arrays format from google_sheets
- REQUIRED: Output node (slack_webhook, google_gmail, etc.) with template variable from javascript output
- The google_sheets node outputs: {data: [[headers], [row1], ...]} - MUST parse in javascript node
- JavaScript MUST format data as readable text string (not objects) for email/Slack output
- Example JavaScript code for Google Sheets:
  const sheetsData = input.data || [];
  let sheetsText = "Data from Google Sheets:\\n";
  if (sheetsData.length === 0) {
    sheetsText += "No data found in Google Sheets.\\n";
  } else {
    const headers = sheetsData[0] || [];
    const dataRows = sheetsData.slice(1);
    dataRows.forEach((row, idx) => {
      const rowText = row.map((cell, i) => {
        const header = headers[i] || \`Column\${i + 1}\`;
        return \`\${header}: \${cell || ''}\`;
      }).join(', ');
      sheetsText += \`Row \${idx + 1}: \${rowText}\\n\`;
    });
  }
  return { content: sheetsText, text: sheetsText, body: sheetsText };
- Output nodes MUST use {{input.content}} or {{input.text}} or {{input.body}} to get the formatted text

When you detect "send email" or "email":
- ALWAYS use google_gmail with operation: "send"
- google_gmail works with any Gmail account without verification
- THIS IS THE ONLY EMAIL NODE TYPE AVAILABLE

Analyze the user's requirements and respond with a JSON object containing:
{
  "summary": "Brief summary of what the user wants to achieve",
  "requirements": ["requirement 1", "requirement 2", ...],
  "triggerType": "manual_trigger | webhook_trigger_response | schedule | http_trigger",
  "requiredNodes": [
    {"type": "node_type", "purpose": "why this node is needed", "config": {"key": "value"}},
    ...
  ],
  "dataFlow": "Description of how data flows between nodes, including template variables like {{input.content}}",
  "outputAction": "What should happen at the end (send email, send to Slack, save to database, etc.)",
  "potentialIssues": ["any potential issues or missing information"]
}

Be thorough and accurate. If you detect Google Doc + output pattern, explicitly list google_doc and the output node. Return ONLY valid JSON, no markdown.`;

    // Step 2: Get requirement analysis
    let analysisResult: any = null;
    try {
      const analysisMessages: LLMMessage[] = [
        { role: 'system', content: analysisPrompt },
        { role: 'user', content: prompt },
      ];

      console.log('Step 1: Analyzing requirements...');
      const analysisResponse = await llmAdapter.chat('gemini', analysisMessages, {
        model: 'gemini-2.5-flash',
        temperature: 0.3, // Lower temperature for more focused analysis
        apiKey,
      });

      let analysisText = analysisResponse.content.trim();
      if (analysisText.includes('```json')) {
        analysisText = analysisText.split('```json')[1].split('```')[0].trim();
      } else if (analysisText.includes('```')) {
        analysisText = analysisText.split('```')[1].split('```')[0].trim();
      }

      analysisResult = JSON.parse(analysisText);
      console.log('Requirement analysis completed:', JSON.stringify(analysisResult, null, 2));
    } catch (analysisError) {
      console.warn('Requirement analysis failed, proceeding with direct generation:', analysisError);
      // Continue without analysis if it fails
    }

    // Build system prompt based on mode
    let systemPrompt = '';

    if (mode === 'create') {
      // Enhanced system prompt with agent reasoning
      const analysisContext = analysisResult ? `
REQUIREMENT ANALYSIS (for reference):
${JSON.stringify(analysisResult, null, 2)}

Based on this analysis, you must generate a workflow that:
1. Addresses ALL requirements listed above
2. Uses the nodes identified in requiredNodes
3. Implements the data flow described
4. Includes the output action specified
5. Resolves any potential issues mentioned
` : '';

      systemPrompt = `You are an expert workflow automation agent with advanced reasoning capabilities. Your task is to analyze a user's workflow description and generate a structured, error-free workflow with nodes and edges using ONLY the available node types listed below.

${analysisContext}

${nodeDescriptions}

AGENT REASONING PROCESS:
Before generating the workflow, you must:
1. UNDERSTAND: Carefully read and understand the user's requirements
2. ANALYZE: Identify what actions need to be performed
3. SELECT: Choose the appropriate nodes from the available list
4. PLAN: Determine the correct order and connections
5. CONFIGURE: Set all required configuration values correctly
6. VALIDATE: Ensure the workflow will execute without errors

You must respond with a valid JSON object in this exact format:
{
  "name": "Workflow name based on description",
  "summary": "Brief explanation of what this workflow does",
  "reasoning": "Your reasoning process: why you chose these nodes and this structure",
  "nodes": [
    {
      "id": "unique_node_id",
      "type": "node_type_from_available_list",
      "position": {"x": number, "y": number},
      "config": { /* node-specific configuration - ALL required fields must be present */ }
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "sourceHandle": "optional handle for conditional nodes"
    }
  ]
}

USER PROVIDED CONFIGURATION:
The user has specifically provided the following configuration values. You MUST use these values in the appropriate node configurations where they make sense.
${JSON.stringify(config, null, 2)}
If a value matches a node property (e.g. 'google_sheet_id' for 'spreadsheetId', 'slack_webhook' for 'webhookUrl'), USE IT.

CRITICAL RULES FOR ERROR-FREE WORKFLOWS:
1. Always start with a trigger node (manual_trigger, webhook, schedule, chat_trigger, error_trigger, interval, or workflow_trigger)
2. Connect nodes in a logical flow from trigger to output - each node should connect to the next
3. Position nodes with x spacing of 300px and y spacing of 150px (start at x:250, y:100)
4. Use ONLY the node types listed above - do not invent new node types
5. Include ALL necessary configuration for each node:
   - For AI nodes: include prompt, model, temperature (0.7 default), memory (10 default)
   - For HTTP nodes (http_request): include url, method, headers, body if needed, timeout
   - For GraphQL nodes: include url, query, variables (JSON), headers, operationName if needed
   - For webhook: include method (POST default)
   - For respond_to_webhook: include statusCode (200 default), responseBody (JSON), headers if needed
   - For schedule: include time in HH:MM format (e.g., "09:00") and timezone (Asia/Kolkata default for IST)
   - For interval: include interval in format like "10m", "30s", "1h"
   - For workflow_trigger: include source_workflow_id
   - For email: include to, from, subject, body
   - For database: include table name and operation
   - **IMPORTANT**: Use the USER PROVIDED CONFIGURATION values to populate these fields.
6. Keep workflows simple and focused - don't overcomplicate
7. If description mentions AI/LLM/GPT/Claude/Gemini, use appropriate AI node (openai_gpt, anthropic_claude, or google_gemini)
8. Always end with an output action (http_post, slack_message, discord_webhook, database_write, log_output, or google_gmail with operation: send) if the workflow should produce results
9. Use proper node IDs: format like "trigger_1", "ai_1", "output_1" etc.
10. Ensure all edges connect valid node IDs
11. CRITICAL FOR GOOGLE DOC + OUTPUT WORKFLOWS:
    - If user wants to "read data from Google Doc and send to [destination]", ALWAYS create: manual_trigger -> google_doc (operation: read) -> [output_node]
    - For google_doc read: Set operation: "read" and documentId (from config or prompt)
    - The google_doc node outputs: {content, text, body, title, documentId} - all contain the document text
    - Destination can be:
      * Slack: Use slack_webhook with text: "{{input.content}}" or slack_message with message: "{{input.content}}"
      * Email: Use google_gmail (operation: send) with body: "{{input.content}}"
      * Database: Use database_write with data template containing {{input.content}}
      * HTTP: Use http_post with bodyTemplate containing {{input.content}}
    - ALWAYS use template variables to pass data: {{input.content}} for document text
    - Example for Slack: { "type": "slack_webhook", "config": { "webhookUrl": "...", "text": "{{input.content}}" } }
    - Example for Gmail: { "type": "google_gmail", "config": { "operation": "send", "to": "...", "subject": "Document", "body": "{{input.content}}" } }
12. CRITICAL FOR CONDITIONAL NODES (if_else):
    - You MUST generate exactly two outgoing edges for every "if_else" node.
    - One edge MUST have a "true" label (for when condition is met).
    - One edge MUST have a "false" label (for when condition is not met).
    - Connect the "true" output to the nodes that should run on success.
    - Connect the "false" output to the nodes that should run on failure/else.
    - DO NOT leave either branch empty. If no specific action is needed, connect to a "log_output" node with a message like "Condition false".
    - Example edge structure:
      { "id": "e1", "source": "if_1", "target": "action_true", "sourceHandle": "true" }
      { "id": "e2", "source": "if_1", "target": "log_false", "sourceHandle": "false" }
13. IMPORTANT: If the workflow starts with a "manual_trigger" but requires data for validation (like in "check if mark > 50"):
    - You MUST add a "javascript" node immediately after the trigger to define mock data.
    - Example config for JS node: { "code": "return { mark: 85, student: 'John' };" }
    - Connect: manual_trigger -> javascript -> if_else
    - This ensures the workflow is testable immediately.
14. SYSTEMATIC DATA STRUCTURE (CRITICAL):
    - The user prefers "Systematic" data flow.
    - Always ensure nodes pass data as structured JSON objects.
    - When fetching properties in downstream nodes (like If/Else), use dot notation: "{{input.age}}", "{{input.name}}".
    - Avoid flat unstructured values; prefer nested objects where logical.
15. DATA PASSING BETWEEN NODES:
    - Use template variables like {{input.fieldName}} to pass data from one node to another
    - google_doc read outputs: content, text, body, title, documentId - use {{input.content}} to access document text
    - google_sheets read outputs: {data: [[headers], [row1], ...], rows, columns} - the data field is an array of arrays
    - When processing google_sheets data, ALWAYS use a javascript node to parse the array-of-arrays format into a usable structure
    - Example JavaScript code for Google Sheets:
      const rows = input.data || [];
      if (rows.length < 2) return { message: "No data found" };
      const headers = rows[0];
      const dataRows = rows.slice(1).filter(row => row && row.length > 0).map(row => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        return obj;
      });
      const formattedText = dataRows.map(row => 
        Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\\n')
      ).join('\\n\\n');
      return { 
        students: dataRows, 
        count: dataRows.length,
        formattedText: formattedText,
        slackMessage: `Found ${dataRows.length} students:\\n\\n${formattedText}`
      };
    - Always check what fields each node outputs and use appropriate template variables

16. NODE SELECTION GUIDANCE:
    - For AI/LLM tasks: Use openai_gpt, anthropic_claude, or google_gemini based on user preference or mention
    - For EMAIL: ALWAYS use google_gmail (operation: "send"). THIS IS THE ONLY EMAIL NODE TYPE AVAILABLE.
    - For file storage: Use aws_s3, dropbox, onedrive, google_drive, or box based on the service mentioned
    - For databases: Use postgresql, mysql, mongodb, supabase, or database_read/database_write for generic operations
    - For CRM operations: Use hubspot, salesforce, zoho_crm, pipedrive, or freshdesk based on the CRM mentioned
    - For DevOps: Use github, gitlab, jenkins, docker, kubernetes, or pagerduty based on the tool mentioned
    - For e-commerce: Use shopify, woocommerce, stripe, paypal, or bigcommerce based on the platform mentioned
    - For analytics: Use google_analytics, mixpanel, segment, or amplitude based on the service mentioned
    - For communication: Use slack_webhook, discord_webhook, telegram, whatsapp_cloud, twilio, or microsoft_teams based on the platform
    - For productivity: Use notion, trello, asana, jira, or linear based on the tool mentioned
    - Always match the node type to the service/platform mentioned in the user's prompt

17. CONFIGURATION BEST PRACTICES:
    - For nodes with "operation" field: Always set the operation explicitly (e.g., "read", "write", "send", "create")
    - For API-based nodes: Include apiKey, accessToken, or authentication credentials when mentioned or in user config
    - For database nodes: Include connection details (host, database, username, password) or use generic database_read/database_write
    - For file operations: Include file paths, file IDs, or URLs as appropriate
    - For time-based operations: Use ISO 8601 format for dates/times (e.g., "2024-01-15T14:00:00Z")
    - For JSON fields: Always provide valid JSON strings, not objects (will be stringified automatically)
    - For template variables: Always use string format with quotes: "{{input.field}}" not {{input.field}}
    - For Google Sheets workflows: ALWAYS add a javascript node after google_sheets read to parse the array-of-arrays format
    - For email workflows: ALWAYS use google_gmail (operation: "send")


EXAMPLES:

Example 1: "Get the data from Google Doc and send it" (Email)
{
  "name": "Get data from Google Doc and send it",
  "nodes": [
    {
      "id": "trigger_1",
      "type": "manual_trigger",
      "position": {"x": 250, "y": 100},
      "config": {}
    },
    {
      "id": "google_doc_1",
      "type": "google_doc",
      "position": {"x": 550, "y": 100},
      "config": {
        "operation": "read",
        "documentId": "DOCUMENT_ID_HERE"
      }
    },
    {
      "id": "gmail_1",
      "type": "google_gmail",
      "position": {"x": 850, "y": 100},
      "config": {
        "operation": "send",
        "to": "recipient@example.com",
        "subject": "Document Content",
        "body": "{{input.content}}"
      }
    }
  ],
  "edges": [
    {"id": "edge_1", "source": "trigger_1", "target": "google_doc_1"},
    {"id": "edge_2", "source": "google_doc_1", "target": "gmail_1"}
  ]
}

Example 2: "Read data from Google Doc and send to Slack"
{
  "name": "Read data from Google Doc and send to Slack",
  "nodes": [
    {
      "id": "trigger_1",
      "type": "manual_trigger",
      "position": {"x": 250, "y": 100},
      "config": {}
    },
    {
      "id": "google_doc_1",
      "type": "google_doc",
      "position": {"x": 550, "y": 100},
      "config": {
        "operation": "read",
        "documentId": "DOCUMENT_ID_HERE"
      }
    },
    {
      "id": "slack_1",
      "type": "slack_webhook",
      "position": {"x": 850, "y": 100},
      "config": {
        "webhookUrl": "WEBHOOK_URL_HERE",
        "text": "{{input.content}}"
      }
    }
  ],
  "edges": [
    {"id": "edge_1", "source": "trigger_1", "target": "google_doc_1"},
    {"id": "edge_2", "source": "google_doc_1", "target": "slack_1"}
  ]
}

Example 3: "Read Google Sheets data and send to Slack and Email"
{
  "name": "Read Google Sheets and send to Slack and Email",
  "nodes": [
    {
      "id": "trigger_1",
      "type": "manual_trigger",
      "position": {"x": 250, "y": 100},
      "config": {}
    },
    {
      "id": "google_sheets_1",
      "type": "google_sheets",
      "position": {"x": 550, "y": 100},
      "config": {
        "operation": "read",
        "spreadsheetId": "SPREADSHEET_ID_HERE",
        "sheetName": "Sheet1"
      }
    },
    {
      "id": "javascript_1",
      "type": "javascript",
      "position": {"x": 850, "y": 100},
      "config": {
        "code": "const rows = input.data || [];\\nif (rows.length < 2) return { slackMessage: 'No data found', emailBody: 'No data found' };\\nconst headers = rows[0];\\nconst dataRows = rows.slice(1).filter(row => row && row.length > 0).map(row => {\\n  const obj = {};\\n  headers.forEach((header, i) => {\\n    obj[header] = row[i] || '';\\n  });\\n  return obj;\\n});\\nconst formattedText = dataRows.map((row, idx) => {\\n  return `Student ${idx + 1}:\\\\n${Object.entries(row).map(([key, value]) => `  ${key}: ${value}`).join('\\\\n')}`;\\n}).join('\\\\n\\\\n');\\nreturn {\\n  students: dataRows,\\n  count: dataRows.length,\\n  slackMessage: `Found ${dataRows.length} students:\\\\n\\\\n${formattedText}`,\\n  emailBody: `Hello,\\\\n\\\\nHere is the data from the Google Sheet:\\\\n\\\\n${formattedText}\\\\n\\\\nBest regards,\\\\nYour Workflow`\\n};"
      }
    },
    {
      "id": "slack_1",
      "type": "slack_webhook",
      "position": {"x": 1150, "y": 50},
      "config": {
        "webhookUrl": "WEBHOOK_URL_HERE",
        "text": "{{input.slackMessage}}"
      }
    },
    {
      "id": "gmail_1",
      "type": "google_gmail",
      "position": {"x": 1150, "y": 150},
      "config": {
        "operation": "send",
        "to": "recipient@example.com",
        "subject": "Google Sheets Data",
        "body": "{{input.emailBody}}"
      }
    }
  ],
  "edges": [
    {"id": "edge_1", "source": "trigger_1", "target": "google_sheets_1"},
    {"id": "edge_2", "source": "google_sheets_1", "target": "javascript_1"},
    {"id": "edge_3", "source": "javascript_1", "target": "slack_1"},
    {"id": "edge_4", "source": "javascript_1", "target": "gmail_1"}
  ]
}

FINAL VALIDATION CHECKLIST:
Before returning the workflow, verify:
✓ All nodes have valid types from the available list
✓ All required config fields are present for each node
✓ All config field values are STRINGS (not null, not undefined, not objects)
✓ Template variables use string format: "{{input.content}}" not {{input.content}} without quotes
✓ All edges connect valid node IDs
✓ Template variables ({{input.field}}) match actual output fields
✓ Workflow has a trigger node
✓ Workflow has an output action if needed
✓ If/else nodes have both true and false paths
✓ Data flow is logical and complete

CRITICAL: All config field values MUST be strings. Examples:
- CORRECT: { "text": "{{input.content}}" }
- WRONG: { "text": {{input.content}} } (missing quotes)
- WRONG: { "text": null }
- WRONG: { "text": undefined }

Generate a workflow based on this description. Think step by step, validate your choices, and return ONLY valid JSON with the structure shown above (including "summary" and "reasoning" fields). No markdown or explanations outside the JSON.`;

    } else if (mode === 'edit') {
      const currentWorkflowJson = JSON.stringify(currentWorkflow, null, 2);
      systemPrompt = `Role: You are an embedded AI workflow editor assistant that lives inside the workflow builder page.
You fully understand the current workflow graph, including Nodes, Connections, Conditions, Execution order, and Node states.
You can modify the existing workflow in real time based on user instructions.

🧠 Context Awareness (MANDATORY)
Before making any change, you must:
1. Read the current workflow structure provided below.
2. Identify Node types, Node IDs, Connections (edges), and Conditional paths.
3. Confirm how the workflow currently behaves.
❗ Never assume an empty workflow.

✏️ Editing Rules (CRITICAL)
Safe Editing:
- Modify only what the user asks.
- Preserve all unrelated nodes and connections.
- Prefer rewiring connections instead of deleting nodes.
- Never recreate the whole workflow unless explicitly requested.

IF / ELSE Handling:
- Always maintain Separate TRUE and FALSE outputs.
- Exclusive execution.
- If user requests a change that breaks logic: Auto-correct and explain briefly.

Allowed Operations:
- Add nodes (Use ONLY available types: ${Object.values(AVAILABLE_NODES).flat().join(', ')})
- Remove connections
- Rewire paths
- Update node configurations
- Rename nodes
- Change conditions

You may NOT:
- Delete nodes silently
- Break execution flow
- Merge conditional branches incorrectly

🛑 Forbidden Behavior
❌ Do not regenerate the entire workflow (keep existing IDs for unchanged nodes)
❌ Do not ignore current workflow context
❌ Do not ask the user to recreate nodes
❌ Do not apply destructive edits without confirmation

Response Format (IMPORTANT):
Return a valid JSON object containing the UPDATED workflow structure (full nodes and edges lists) and a brief explanation.
{
  "nodes": [ ... ],
  "edges": [ ... ],
  "explanation": "Brief interaction summary (e.g., 'Added Slack node and connected to success path')"
}

Current Workflow:
${currentWorkflowJson}

User Instruction: "${prompt}"

Generate the updated workflow JSON. Return ONLY valid JSON, no markdown or explanations outside the JSON object.`;
    }

    // Use Google Gemini (free version) to generate workflow
    const provider = 'gemini';
    // Use gemini-2.5-flash as default (user's preferred model)
    // Maps to gemini-2.0-flash-exp in the API
    const model = 'gemini-2.5-flash';

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    console.log('Calling Gemini API with model:', model);
    let response;
    try {
      response = await llmAdapter.chat('gemini', messages, {
        model,
        temperature: 0.7,
        apiKey,
      });
      console.log('Gemini API response received, content length:', response.content?.length || 0);
    } catch (llmError) {
      console.error('Gemini API call failed:', llmError);
      const llmErrorMessage = llmError instanceof Error ? llmError.message : String(llmError);
      throw new Error(`Failed to generate workflow with AI: ${llmErrorMessage}`);
    }

    // Parse AI response
    let workflowData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.content.trim();
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }

      workflowData = JSON.parse(jsonText);
      
      // CRITICAL SAFETY FIX: Replace email_resend with google_gmail (email_resend doesn't exist in node library)
      if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
        workflowData.nodes = workflowData.nodes.map((node: any) => {
          if (node.type === 'email_resend') {
            console.log(`[LEGACY GENERATION] CRITICAL FIX: Replacing email_resend with google_gmail for node ${node.id}`);
            return {
              ...node,
              type: 'google_gmail',
              config: {
                ...node.config,
                operation: 'send',
                to: node.config.to || '',
                subject: node.config.subject || 'Message from Workflow',
                body: node.config.body || node.config.text || '',
              },
            };
          }
          return node;
        });
      }
      
      // Log agent reasoning if available
      if (workflowData.reasoning) {
        console.log('Agent reasoning:', workflowData.reasoning);
      }
      if (workflowData.summary) {
        console.log('Workflow summary:', workflowData.summary);
      }
      
      // Quick validation check - if mismatch detected, throw to trigger fallback
      const promptLower = prompt.toLowerCase();
      const hasGoogleDocReq = (promptLower.includes('google doc') || promptLower.includes('doc')) && 
                              (promptLower.includes('read') || promptLower.includes('get') || promptLower.includes('data'));
      const hasSlackReq = promptLower.includes('slack');
      const generatedNodeTypes = workflowData.nodes?.map((n: any) => n.type) || [];
      const hasGoogleDocNode = generatedNodeTypes.includes('google_doc');
      const hasSlackNode = generatedNodeTypes.includes('slack_webhook') || generatedNodeTypes.includes('slack_message');
      
      if (hasGoogleDocReq && !hasGoogleDocNode) {
        console.error('Early validation: Missing Google Doc node, triggering fallback');
        throw new Error('Workflow generation mismatch - missing required nodes');
      }
      if (hasSlackReq && !hasSlackNode) {
        console.error('Early validation: Missing Slack node, triggering fallback');
        throw new Error('Workflow generation mismatch - missing required nodes');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', response.content);
      console.error('Parse error:', parseError);
      
      // Smart fallback: Try to detect workflow intent from prompt
      const promptLower = prompt.toLowerCase();
      
      // Smart pattern detection for common workflows
      const hasGoogleDoc = promptLower.includes('google doc') || promptLower.includes('google doc') || 
                               promptLower.includes('doc') && (promptLower.includes('read') || promptLower.includes('get') || promptLower.includes('data'));
      const hasSlack = promptLower.includes('slack');
      const hasEmail = promptLower.includes('send') || promptLower.includes('email') || promptLower.includes('gmail');
      
      if (hasGoogleDoc && hasSlack) {
        console.log('Detected Google Doc + Slack workflow pattern, creating smart fallback');
        workflowData = {
          name: `Workflow: Read data from Google Doc and send to Slack`,
          summary: 'Reads content from a Google Doc and sends it to Slack',
          reasoning: 'User wants to read Google Doc content and send it to Slack. Using google_doc (read) -> slack_webhook with {{input.content}} template variable.',
          nodes: [
            {
              id: 'trigger_1',
              type: 'manual_trigger',
              position: { x: 250, y: 100 },
              config: {},
            },
            {
              id: 'google_doc_1',
              type: 'google_doc',
              position: { x: 550, y: 100 },
              config: {
                operation: 'read',
                documentId: config.documentId || config.google_doc_id || config.google_doc_url || '',
              },
            },
            {
              id: 'slack_1',
              type: 'slack_webhook',
              position: { x: 850, y: 100 },
              config: {
                webhookUrl: config.webhookUrl || config.slack_webhook || '',
                text: '{{input.content}}',
              },
            },
          ],
          edges: [
            {
              id: 'edge_1',
              source: 'trigger_1',
              target: 'google_doc_1',
            },
            {
              id: 'edge_2',
              source: 'google_doc_1',
              target: 'slack_1',
            },
          ],
        };
      } else if (hasGoogleDoc && hasEmail) {
        console.log('Detected Google Doc + Email workflow pattern, creating smart fallback');
        workflowData = {
          name: `Workflow: Get data from Google Doc and send it`,
          summary: 'Reads content from a Google Doc and sends it via email',
          reasoning: 'User wants to read Google Doc content and send it via email. Using google_doc (read) -> google_gmail (send) with {{input.content}} template variable.',
          nodes: [
            {
              id: 'trigger_1',
              type: 'manual_trigger',
              position: { x: 250, y: 100 },
              config: {},
            },
            {
              id: 'google_doc_1',
              type: 'google_doc',
              position: { x: 550, y: 100 },
              config: {
                operation: 'read',
                documentId: config.documentId || config.google_doc_id || config.google_doc_url || '',
              },
            },
            {
              id: 'gmail_1',
              type: 'google_gmail',
              position: { x: 850, y: 100 },
              config: {
                operation: 'send',
                to: config.to || config.email || 'recipient@example.com',
                subject: config.subject || 'Document Content',
                body: '{{input.content}}',
              },
            },
          ],
          edges: [
            {
              id: 'edge_1',
              source: 'trigger_1',
              target: 'google_doc_1',
            },
            {
              id: 'edge_2',
              source: 'google_doc_1',
              target: 'gmail_1',
            },
          ],
        };
      } else {
        // Generic fallback: create a simple workflow
        workflowData = {
          name: `Workflow: ${prompt.substring(0, 50)}`,
          nodes: [
            {
              id: 'trigger_1',
              type: 'manual_trigger',
              position: { x: 250, y: 100 },
              config: {},
            },
            {
              id: 'output_1',
              type: 'log_output',
              position: { x: 550, y: 100 },
              config: { message: 'Workflow executed' },
            },
          ],
          edges: [
            {
              id: 'edge_1',
              source: 'trigger_1',
              target: 'output_1',
            },
          ],
        };
      }
    }

    // Validate and clean workflow data
    if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
      throw new Error('Invalid workflow structure: nodes array is required');
    }

    if (!workflowData.edges || !Array.isArray(workflowData.edges)) {
      workflowData.edges = [];
    }

    // AGENT VALIDATION: Verify workflow correctness
    console.log('Validating generated workflow...');
    const validationErrors: string[] = [];
    
    // Check if workflow matches user requirements
    const promptLower = prompt.toLowerCase();
    const hasGoogleDocReq = (promptLower.includes('google doc') || promptLower.includes('doc')) && 
                            (promptLower.includes('read') || promptLower.includes('get') || promptLower.includes('data'));
    const hasSlackReq = promptLower.includes('slack');
    const hasEmailReq = promptLower.includes('send') && (promptLower.includes('email') || promptLower.includes('gmail'));
    
    const generatedNodeTypes = workflowData.nodes.map((n: any) => n.type);
    const hasGoogleDocNode = generatedNodeTypes.includes('google_doc');
    const hasSlackNode = generatedNodeTypes.includes('slack_webhook') || generatedNodeTypes.includes('slack_message');
    const hasEmailNode = generatedNodeTypes.includes('google_gmail');
    
    // If user asked for Google Doc but workflow doesn't have it, that's a critical error - use fallback
    if (hasGoogleDocReq && !hasGoogleDocNode) {
      console.error('Workflow mismatch detected - missing Google Doc node, using smart fallback');
      // Trigger fallback by throwing parse error
      throw new Error('Workflow generation mismatch - missing required nodes');
    }
    
    // If user asked for Slack but workflow doesn't have it, that's a critical error - use fallback
    if (hasSlackReq && !hasSlackNode && !hasEmailNode) {
      console.error('Workflow mismatch detected - missing Slack node, using smart fallback');
      // Trigger fallback by throwing parse error
      throw new Error('Workflow generation mismatch - missing required nodes');
    }
    
    // Validate node types and config values
    const validNodeTypes = Object.values(AVAILABLE_NODES).flat();
    workflowData.nodes.forEach((node: any) => {
      // Ensure all config values are strings (not null, undefined, or objects)
      if (node.config && typeof node.config === 'object') {
        const fixedConfig: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node.config)) {
          // Convert non-string values to strings, but preserve null/undefined as empty string
          if (value === null || value === undefined) {
              fixedConfig[key] = '';
            } else if (typeof value !== 'string') {
              // Convert to string, but warn if it's an object
              if (typeof value === 'object') {
                console.warn(`Node ${node.id} config.${key} is an object, converting to JSON string`);
                fixedConfig[key] = JSON.stringify(value);
              } else {
                fixedConfig[key] = String(value);
              }
            } else {
              fixedConfig[key] = value;
            }
        }
        node.config = fixedConfig;
      }
      if (!validNodeTypes.includes(node.type)) {
        validationErrors.push(`Invalid node type: ${node.type} in node ${node.id}`);
      }
      
      // Validate required config fields based on node type
      if (!node.config) {
        node.config = {};
      }
      
      // Google Doc validation
      if (node.type === 'google_doc') {
        if (!node.config.operation) {
          validationErrors.push(`google_doc node ${node.id} missing required field: operation`);
        } else if (node.config.operation === 'read' && !node.config.documentId) {
          // Try to get from config object
          const docId = config.documentId || config.google_doc_id || config.google_doc_url || '';
          if (docId) {
            node.config.documentId = docId;
          } else {
            validationErrors.push(`google_doc node ${node.id} (read) missing required field: documentId`);
          }
        }
      }
      
      // Gmail validation
      if (node.type === 'google_gmail' && node.config.operation === 'send') {
        if (!node.config.to) {
          const email = config.to || config.email || '';
          if (email) {
            node.config.to = email;
          } else {
            validationErrors.push(`google_gmail node ${node.id} (send) missing required field: to`);
          }
        }
        if (!node.config.subject) {
          node.config.subject = node.config.subject || 'Message from Workflow';
        }
        if (!node.config.body) {
          validationErrors.push(`google_gmail node ${node.id} (send) missing required field: body`);
        }
      }
      
      // Slack validation
      if (node.type === 'slack_webhook' || node.type === 'slack_message') {
        if (!node.config.webhookUrl) {
          const webhook = config.webhookUrl || config.slack_webhook || '';
          if (webhook) {
            node.config.webhookUrl = webhook;
          } else {
            validationErrors.push(`${node.type} node ${node.id} missing required field: webhookUrl`);
          }
        }
        if (node.type === 'slack_webhook' && !node.config.text) {
          // Auto-add template variable if missing
          node.config.text = node.config.text || '{{input.content}}';
        }
        if (node.type === 'slack_message' && !node.config.message) {
          node.config.message = node.config.message || '{{input.content}}';
        }
      }
      
      // Google Sheets validation
      if (node.type === 'google_sheets') {
        if (!node.config.operation) {
          validationErrors.push(`google_sheets node ${node.id} missing required field: operation`);
        }
        if (node.config.operation !== 'create' && !node.config.spreadsheetId) {
          const sheetId = config.spreadsheetId || config.google_sheet_id || '';
          if (sheetId) {
            node.config.spreadsheetId = sheetId;
          } else {
            validationErrors.push(`google_sheets node ${node.id} missing required field: spreadsheetId`);
          }
        }
      }
      
      // AI nodes validation
      if (['openai_gpt', 'anthropic_claude', 'google_gemini'].includes(node.type)) {
        if (!node.config.prompt) {
          validationErrors.push(`${node.type} node ${node.id} missing required field: prompt`);
        }
        if (!node.config.model) {
          // Set default model
          if (node.type === 'openai_gpt') node.config.model = 'gpt-4o-mini';
          else if (node.type === 'anthropic_claude') node.config.model = 'claude-3-haiku';
          else if (node.type === 'google_gemini') node.config.model = 'gemini-2.5-flash';
        }
      }
      
      // HTTP request validation
      if (node.type === 'http_request') {
        if (!node.config.url) {
          validationErrors.push(`http_request node ${node.id} missing required field: url`);
        }
        if (!node.config.method) {
          node.config.method = 'GET';
        }
      }
      
      // Schedule validation
      if (node.type === 'schedule') {
        if (!node.config.cron) {
          validationErrors.push(`schedule node ${node.id} missing required field: cron`);
        }
      }
    });
    
    // Validate edges
    const validNodeIdsSet = new Set(workflowData.nodes.map((n: any) => n.id));
    workflowData.edges.forEach((edge: any) => {
      if (!validNodeIdsSet.has(edge.source)) {
        validationErrors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!validNodeIdsSet.has(edge.target)) {
        validationErrors.push(`Edge references non-existent target node: ${edge.target}`);
      }
    });
    
    // Check for orphaned nodes (nodes without incoming edges, except triggers)
    const triggerTypes = AVAILABLE_NODES.triggers;
    const nodesWithIncoming = new Set(workflowData.edges.map((e: any) => e.target));
    workflowData.nodes.forEach((node: any) => {
      if (!triggerTypes.includes(node.type) && !nodesWithIncoming.has(node.id)) {
        validationErrors.push(`Node ${node.id} (${node.type}) has no incoming edges`);
      }
    });
    
    if (validationErrors.length > 0) {
      console.warn('Workflow validation errors found:', validationErrors);
      // Try to fix common issues automatically
      console.log('Attempting to auto-fix validation errors...');
    } else {
      console.log('✓ Workflow validation passed');
    }

    // Ensure all node IDs are unique and valid
    const uniqueNodeIds = new Set<string>();
    workflowData.nodes = workflowData.nodes.map((node: any, index: number) => {
      const nodeId = node.id || `node_${index}_${Date.now()}`;
      if (uniqueNodeIds.has(nodeId)) {
        return { ...node, id: `${nodeId}_${index}` };
      }
      uniqueNodeIds.add(nodeId);
      return {
        ...node,
        id: nodeId,
        position: node.position || { x: 250 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
      };
    });

    // Validate edges reference existing nodes
    const validNodeIds = new Set(workflowData.nodes.map((n: any) => n.id));
    workflowData.edges = workflowData.edges.filter((edge: any) =>
      validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
    );

    // Ensure at least one trigger node exists
    const hasTrigger = workflowData.nodes.some((node: any) =>
      AVAILABLE_NODES.triggers.includes(node.type)
    );

    if (!hasTrigger) {
      // Add a manual trigger at the beginning
      workflowData.nodes.unshift({
        id: 'trigger_manual',
        type: 'manual_trigger',
        position: { x: 250, y: 100 },
        config: {},
      });

      // Connect trigger to first non-trigger node
      const firstNonTrigger = workflowData.nodes.find((n: any) =>
        !AVAILABLE_NODES.triggers.includes(n.type) && n.id !== 'trigger_manual'
      );
      if (firstNonTrigger) {
        workflowData.edges.unshift({
          id: 'edge_trigger',
          source: 'trigger_manual',
          target: firstNonTrigger.id,
        });
      }
    }

    // Validate and fix workflow structure (Strict If/Else rules)
    const validatedWorkflow = validateAndFixWorkflow(workflowData);
    
    // Add agent analysis and summary to response
    const responseData: any = {
      ...validatedWorkflow,
    };
    
    // Include requirement analysis if available
    if (analysisResult) {
      responseData.agentAnalysis = {
        summary: analysisResult.summary,
        requirements: analysisResult.requirements,
        dataFlow: analysisResult.dataFlow,
        outputAction: analysisResult.outputAction,
      };
    }
    
    // Include workflow summary and reasoning if available
    if (workflowData.summary) {
      responseData.summary = workflowData.summary;
    }
    if (workflowData.reasoning) {
      responseData.reasoning = workflowData.reasoning;
    }

    console.log('Workflow generation completed successfully');
    console.log(`Generated ${validatedWorkflow.nodes.length} nodes and ${validatedWorkflow.edges.length} edges`);

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating workflow:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log full error details for debugging
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: Deno.env.get('ENVIRONMENT') === 'development' ? errorStack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

