// Deno global type declaration for TypeScript
declare const Deno: {
  readTextFile(path: string | URL): Promise<string>;
  env: {
    get(key: string): string | undefined;
  };
};

// Cache for node reference content
let nodeReferenceCache: string | null = null;

/**
 * Load the comprehensive node reference guide for the AI agent
 * This file provides detailed information about all available nodes, their properties, and usage
 */
export async function loadNodeReference(): Promise<string> {
  // Return cached version if available
  if (nodeReferenceCache) {
    return nodeReferenceCache;
  }

  try {
    // Try multiple possible paths for the node reference file
    const possiblePaths = [
      "./NODE_REFERENCE_FOR_AGENT.md",
      "NODE_REFERENCE_FOR_AGENT.md",
      "../../NODE_REFERENCE_FOR_AGENT.md", // From function directory to root
    ];

    // Try to get the function directory path
    try {
      const functionDir = new URL(".", import.meta.url).pathname;
      possiblePaths.push(`${functionDir}NODE_REFERENCE_FOR_AGENT.md`);
      possiblePaths.push(`${functionDir}../../NODE_REFERENCE_FOR_AGENT.md`);
    } catch {
      // Ignore if import.meta.url doesn't work
    }

    let nodeReferenceText: string | null = null;
    let lastError: Error | null = null;

    for (const path of possiblePaths) {
      try {
        nodeReferenceText = await Deno.readTextFile(path);
        console.log(`[NODE_REFERENCE] Successfully loaded from: ${path}`);
        break;
      } catch (error) {
        lastError = error as Error;
        console.log(`[NODE_REFERENCE] Failed to load from ${path}:`, (error as Error).message);
      }
    }

    if (!nodeReferenceText) {
      console.warn("[NODE_REFERENCE] Failed to load node reference file from all paths, using fallback");
      console.error("[NODE_REFERENCE] Last error:", lastError);
      // Return a minimal fallback
      return getFallbackNodeReference();
    }

    // Cache the loaded content
    nodeReferenceCache = nodeReferenceText;
    console.log("[NODE_REFERENCE] Node reference loaded and cached successfully");
    return nodeReferenceCache;
  } catch (error) {
    console.error("[NODE_REFERENCE] Failed to load node reference:", error);
    return getFallbackNodeReference();
  }
}

/**
 * Fallback node reference if file can't be loaded
 * This provides basic node information to prevent errors
 */
function getFallbackNodeReference(): string {
  return `
NODE REFERENCE GUIDE (FALLBACK - File not found)

This is a fallback node reference. For comprehensive node information, ensure NODE_REFERENCE_FOR_AGENT.md is available in the function directory.

AVAILABLE NODE CATEGORIES:
- Triggers: manual_trigger, webhook, schedule, form, chat_trigger, error_trigger, interval, workflow_trigger
- Logic: if_else, switch, loop, wait, error_handler, filter, merge, javascript
- Data: function, function_item, set, set_variable, json_parser, csv_processor
- Database: database_read, database_write, supabase, postgresql
- HTTP: http_request, http_post, graphql
- Communication: slack_webhook, slack_message, discord_webhook, telegram, http_post
- AI: openai_gpt, anthropic_claude, google_gemini, hugging_face, text_summarizer
- Google: google_sheets, google_gmail, google_doc, google_drive, google_calendar
- Storage: read_binary_file, write_binary_file, dropbox, onedrive
- CRM: hubspot, salesforce, zoho_crm, pipedrive
- DevOps: github, gitlab, jenkins, docker
- E-commerce: shopify, woocommerce, stripe, paypal
- Analytics: google_analytics, mixpanel, segment, amplitude

For detailed information about each node's properties and usage, please ensure NODE_REFERENCE_FOR_AGENT.md is available.
`;
}

