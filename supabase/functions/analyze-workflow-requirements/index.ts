import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LLMAdapter } from "../_shared/llm-adapter.ts";

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return new Response(
                JSON.stringify({ error: 'Prompt is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const systemPrompt = `
      You are an expert workflow requirements analyzer.
      Your task is to analyze a user's natural language request for a workflow and identify specific configuration values that are required to build it.
      
      Examples:
      - "Read from Google Sheet" -> Requires: "google_sheet_url" (URL) and "sheet_name" (Tab Name)
      - "Send message to Slack" -> Requires: Slack Webhook URL or Channel ID
      - "Email me everyday" -> Requires: Email Address
      
      Specific Rules:
      - For Google Sheets: ALWAYS ask for "google_sheet_url" and "sheet_name". Do NOT ask for "spreadsheet_id" directly as it's hard for users to find.
      - For Google Docs: ALWAYS ask for "google_doc_url" (the full Google Docs URL). Do NOT ask for "document_id" directly. Users should paste the full URL like: https://docs.google.com/document/d/DOCUMENT_ID/edit
      - For others: Ask for the most user-friendly identifier.
      
      Identify ONLY essential external identifiers, secrets, or specific configuration values that the user MUST provide for the workflow to function.
      Do NOT ask for generic things like "Workflow Name" or "Description".
      Do NOT ask for internal logic variables unless absolutely ambiguous.
      
      Return a JSON object with a "requirements" array.
      Each requirement should have:
      - key: string (variable name, e.g., "google_sheet_id")
      - label: string (user friendly label, e.g., "Google Sheet ID")
      - type: "text" | "number" | "select"
      - description: string (brief help text)
      - required: boolean (usually true)
      
      If no specific requirements are found, return { "requirements": [] }.
      
      Respond with VALID JSON only.
    `;

        const llm = new LLMAdapter();
        console.log("Attempting analysis with gemini-2.5-flash");
        const response = await llm.chat(
            'gemini',
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            { apiKey, model: 'gemini-2.5-flash' }
        );

        let result;
        try {
            // Extract JSON from potential code blocks
            let jsonText = response.content.trim();
            if (jsonText.includes('```json')) {
                jsonText = jsonText.split('```json')[1].split('```')[0].trim();
            } else if (jsonText.includes('```')) {
                jsonText = jsonText.split('```')[1].split('```')[0].trim();
            }

            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("Failed to parse JSON", response.content);
            result = { requirements: [] }; // Fallback
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
