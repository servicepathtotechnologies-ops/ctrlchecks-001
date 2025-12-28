// Deno global type declaration for TypeScript
declare const Deno: {
  readTextFile(path: string | URL): Promise<string>;
  env: {
    get(key: string): string | undefined;
  };
  cwd(): string;
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - must allow all required headers including x-idempotency-key
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
};

// Helper function to create HTML response headers with CSP
function createHtmlHeaders(): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  // Permissive CSP to allow inline styles and scripts for form functionality
  // Note: style-src-attr is needed for inline style attributes
  headers.set("Content-Security-Policy", 
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' 'unsafe-hashes'; " +
    "style-src-attr 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co https://*.supabase.io; " +
    "frame-ancestors 'none';"
  );
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return headers;
}

/**
 * Form Trigger - n8n-style blocking trigger
 * 
 * GET /forms/{workflowId}/{nodeId} - Render form HTML
 * * POST /forms/{workflowId}/{nodeId}/submit - Submit form and resume waiting execution
 * 
 * Behavior:
 * - Form Trigger blocks workflow execution until form is submitted
 * - Each submission resumes exactly ONE waiting execution
 * - Idempotency key prevents duplicate submissions
 * - Form URL is stable: /forms/{workflowId}/{nodeId}
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(p => p);
    
    // Parse Supabase edge function URL: /functions/v1/form-trigger/{workflowId}/{nodeId} or /functions/v1/form-trigger/{workflowId}/{nodeId}/submit
    // Find the index of 'form-trigger' in the path
    const functionIndex = pathParts.findIndex(p => p === 'form-trigger');
    
    if (functionIndex === -1) {
      console.error("Invalid URL format. Expected: /functions/v1/form-trigger/{workflowId}/{nodeId}");
      return new Response(
        generateErrorHTML("Invalid URL", "Invalid URL format. Expected: /functions/v1/form-trigger/{workflowId}/{nodeId}"),
        { status: 400, headers: createHtmlHeaders() }
      );
    }
    
    // Extract workflowId and nodeId after 'form-trigger'
    const remainingParts = pathParts.slice(functionIndex + 1);
    const isSubmit = remainingParts[remainingParts.length - 1] === 'submit';
    
    if (isSubmit) {
      // Remove 'submit' from the end
      remainingParts.pop();
    }
    
    const workflowId = remainingParts[0];
    const nodeId = remainingParts[1];
    
    if (!workflowId || !nodeId) {
      console.error("Missing workflowId or nodeId. Expected: /functions/v1/form-trigger/{workflowId}/{nodeId}");
      console.log("Parsed pathParts:", pathParts);
      console.log("functionIndex:", functionIndex);
      console.log("remainingParts:", pathParts.slice(functionIndex + 1));
      return new Response(
        generateErrorHTML("Invalid URL", "Missing workflowId or nodeId in URL. Expected: /functions/v1/form-trigger/{workflowId}/{nodeId}"),
        { status: 400, headers: createHtmlHeaders() }
      );
    }

    console.log(`Form trigger: ${req.method} for workflow ${workflowId}, node ${nodeId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify workflow exists and is active
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

      if (workflowError || !workflow) {
        console.error("Workflow not found:", workflowError);
        return new Response(
          JSON.stringify({ error: "Workflow not found", message: "The requested workflow could not be found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (workflow.status !== "active") {
        console.error("Workflow is not active:", workflow.status);
        return new Response(
          JSON.stringify({ error: "Form expired", message: "This form is no longer active. The workflow has been deactivated." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    // Find the form node
    const nodes = workflow.nodes as any[];
    const formNode = nodes?.find((node: any) => 
      (node.id === nodeId || node.data?.id === nodeId) && 
      (node.data?.type === "form" || node.type === "form")
    );
    
    if (!formNode) {
      console.error("Form node not found:", nodeId);
        return new Response(
          JSON.stringify({ error: "Form not found", message: "The form node was not found in this workflow." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    const formConfig = formNode.data?.config || formNode.config || {};
    const formTitle = formConfig.formTitle || "Form Submission";
    const formDescription = formConfig.formDescription || "";
    
    // Fields are stored as array in node metadata (from inline UI builder)
    let fields: any[] = [];
    if (Array.isArray(formConfig.fields)) {
      fields = formConfig.fields;
    } else if (typeof formConfig.fields === 'string') {
      try {
        fields = JSON.parse(formConfig.fields || '[]');
      } catch (e) {
        console.error("Failed to parse fields JSON:", e);
        fields = [];
      }
    }
    
    const submitButtonText = formConfig.submitButtonText || "Submit";
    const successMessage = formConfig.successMessage || "Thank you for your submission!";
    const redirectUrl = formConfig.redirectUrl || "";

    // Handle GET request - return form config as JSON (for API access)
    // Note: Form UI is now served from React route /form/:workflowId/:nodeId
    if (req.method === "GET") {
      const formConfig = {
        workflowId,
        nodeId,
        formTitle,
        formDescription,
        fields,
        submitButtonText,
        successMessage,
        redirectUrl,
        submitUrl: `${supabaseUrl}/functions/v1/form-trigger/${workflowId}/${nodeId}/submit`,
      };

      return new Response(
        JSON.stringify(formConfig),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle POST request - submit form and resume waiting execution
    if (req.method === "POST" && isSubmit) {
      const contentType = req.headers.get("content-type") || "";
      
      // Get idempotency key from header or generate one
      const idempotencyKey = req.headers.get("x-idempotency-key") || 
                            `form_${workflowId}_${nodeId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Check for duplicate submission (idempotency)
      const { data: existingSubmission } = await supabase
        .from("form_submissions")
        .select("execution_id")
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existingSubmission) {
        console.log("Duplicate submission detected, ignoring:", idempotencyKey);
        // Return success but don't process again
        return new Response(
          JSON.stringify({ success: true, message: successMessage, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let formData: Record<string, any> = {};
      let files: Array<{ fieldName: string; fileName: string; mimeType: string; data: string }> = [];

      // Parse form data
      if (contentType.includes("multipart/form-data")) {
        const formDataObj = await req.formData();
        for (const [key, value] of formDataObj.entries()) {
          if (value instanceof File) {
            const arrayBuffer = await value.arrayBuffer();
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            files.push({
              fieldName: key,
              fileName: value.name,
              mimeType: value.type || "application/octet-stream",
              data: base64Data,
            });
          } else {
            formData[key] = value;
          }
        }
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        for (const [key, value] of params.entries()) {
          formData[key] = value;
        }
      } else {
        try {
          const jsonData = await req.json();
          formData = jsonData.formData || jsonData.data || jsonData;
          files = jsonData.files || [];
        } catch (e) {
          console.error("Failed to parse JSON body:", e);
          return new Response(
            JSON.stringify({ error: "Invalid request", message: "Invalid JSON in request body" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Validate form data
      const validationResult = validateFormData(formData, fields);
      if (!validationResult.valid) {
        return new Response(
          JSON.stringify({ error: "Validation failed", message: validationResult.errors.join(", ") }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Extract metadata
      const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      const maskedIP = maskIP(clientIP);

      const submittedAt = new Date().toISOString();
      const meta = {
        submittedAt,
        ip: maskedIP,
        userAgent,
      };

      // Find waiting execution for this form node
      const { data: waitingExecution, error: waitError } = await supabase
        .from("executions")
        .select("*")
        .eq("workflow_id", workflowId)
        .eq("status", "waiting")
        .eq("trigger", "form")
        .eq("waiting_for_node_id", nodeId)
        .order("started_at", { ascending: true })
        .limit(1)
        .single();

      if (waitError || !waitingExecution) {
        console.error("No waiting execution found for form node:", nodeId, waitError);
        return new Response(
          JSON.stringify({ error: "No active form", message: "This form is not currently waiting for a submission. Please activate the workflow first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prepare form submission data (n8n-style output format)
      const submissionData = {
        submitted_at: submittedAt,
        form: {
          title: formTitle,
          id: nodeId,
        },
        data: sanitizeInput(formData),
        files: files,
        meta: meta,
      };

      // Store submission record (for idempotency and audit)
      await supabase
        .from("form_submissions")
        .insert({
          workflow_id: workflowId,
          node_id: nodeId,
          execution_id: waitingExecution.id,
          idempotency_key: idempotencyKey,
          form_data: submissionData,
          submitted_at: submittedAt,
        });

      // Update execution: set input and change status from "waiting" to "running"
      // Use n8n-style output format
      const executionInput = {
        submitted_at: submittedAt,
        form: {
          title: formTitle,
          id: nodeId,
        },
        data: submissionData.data,
        files: submissionData.files,
        meta: submissionData.meta,
      };

      const { error: updateError } = await supabase
        .from("executions")
        .update({
          status: "running",
          input: executionInput,
          waiting_for_node_id: null, // Clear waiting state
        })
        .eq("id", waitingExecution.id);

      if (updateError) {
        console.error("Failed to update execution:", updateError);
        return new Response(
          JSON.stringify({ error: "Server error", message: "Failed to process form submission. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resume workflow execution asynchronously
      const executeUrl = `${supabaseUrl}/functions/v1/execute-workflow`;
      fetch(executeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          workflowId,
          executionId: waitingExecution.id,
          input: executionInput,
        }),
      }).catch((err) => {
        console.error("Failed to resume workflow execution:", err);
      });

      // Return success response
      if (redirectUrl) {
        return new Response(
          JSON.stringify({ success: true, message: successMessage, redirect: redirectUrl }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: successMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed", message: "This endpoint only supports GET and POST requests." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Form trigger error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", message: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFormHTML(
  fields: any[],
  submitButtonText: string,
  formUrl: string,
  formTitle: string,
  formDescription: string
): string {
  // Ensure fields is an array
  if (!Array.isArray(fields)) {
    fields = [];
  }
  const fieldsHtml = fields.map((field) => {
    const name = field.name || "";
    const label = field.label || name;
    const type = field.type || "text";
    const required = field.required || false;
    const placeholder = field.placeholder || "";
    const defaultValue = field.defaultValue || "";
    const helpText = field.helpText || "";

    let fieldHtml = `<div class="form-field">
      <label for="${name}">${escapeHtml(label)}${required ? ' <span class="required">*</span>' : ''}</label>`;

    if (type === "textarea") {
      fieldHtml += `<textarea id="${name}" name="${name}" ${required ? 'required' : ''} placeholder="${escapeHtml(placeholder)}" rows="4">${escapeHtml(defaultValue)}</textarea>`;
    } else if (type === "select") {
      const options = field.options || [];
      fieldHtml += `<select id="${name}" name="${name}" ${required ? 'required' : ''}>
        <option value="">Select...</option>
        ${options.map((opt: any) => {
          const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label || opt);
          const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value || opt);
          return `<option value="${escapeHtml(String(optValue))}">${escapeHtml(String(optLabel))}</option>`;
        }).join("")}
      </select>`;
    } else if (type === "checkbox") {
      fieldHtml += `<input type="checkbox" id="${name}" name="${name}" ${defaultValue ? 'checked' : ''} ${required ? 'required' : ''}>`;
    } else if (type === "radio") {
      const options = field.options || [];
      fieldHtml += options.map((opt: any, idx: number) => {
        const optValue = typeof opt === 'string' ? opt : (opt.value || opt.label || opt);
        const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value || opt);
        return `<label class="radio-label"><input type="radio" name="${name}" value="${escapeHtml(String(optValue))}" ${idx === 0 && required ? 'required' : ''}> ${escapeHtml(String(optLabel))}</label>`;
      }).join("");
    } else if (type === "file") {
      fieldHtml += `<input type="file" id="${name}" name="${name}" ${required ? 'required' : ''} ${field.accept ? `accept="${escapeHtml(field.accept)}"` : ''}>`;
    } else {
      const inputType = ["email", "password", "number", "date", "time", "url", "tel"].includes(type) ? type : "text";
      fieldHtml += `<input type="${inputType}" id="${name}" name="${name}" ${required ? 'required' : ''} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(String(defaultValue))}">`;
    }

    if (helpText) {
      fieldHtml += `<small class="help-text">${escapeHtml(helpText)}</small>`;
    }

    fieldHtml += `</div>`;
    return fieldHtml;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src-attr 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io; frame-ancestors 'none';">
  <title>${escapeHtml(formTitle || 'Form Submission')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .form-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
    .form-description { color: #666; margin-bottom: 30px; font-size: 14px; line-height: 1.6; }
    .form-field {
      margin-bottom: 24px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
      font-size: 14px;
    }
    .radio-label {
      display: inline-flex;
      align-items: center;
      margin-right: 16px;
      font-weight: normal;
      cursor: pointer;
    }
    .radio-label input[type="radio"] {
      margin-right: 6px;
    }
    .required { color: #e74c3c; }
    input[type="text"],
    input[type="email"],
    input[type="password"],
    input[type="number"],
    input[type="date"],
    input[type="time"],
    input[type="url"],
    input[type="tel"],
    input[type="file"],
    textarea,
    select {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
      font-family: inherit;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: #667eea;
    }
    textarea { resize: vertical; min-height: 100px; }
    .help-text {
      display: block;
      margin-top: 6px;
      color: #888;
      font-size: 12px;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
    button:active { transform: translateY(0); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { color: #e74c3c; margin-top: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="form-container">
    <h1>${escapeHtml(formTitle)}</h1>
    ${formDescription ? `<p class="form-description">${escapeHtml(formDescription)}</p>` : ''}
    <form id="form" enctype="multipart/form-data">
      ${fieldsHtml}
      <button type="submit">${escapeHtml(submitButtonText)}</button>
      <div id="error" class="error"></div>
    </form>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errorDiv = document.getElementById('error');
      const submitButton = form.querySelector('button[type="submit"]');
      
      errorDiv.classList.remove('show');
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
      
      try {
        const formData = new FormData(form);
        const idempotencyKey = 'form_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        
        const response = await fetch('${formUrl}', {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': idempotencyKey
          },
          body: formData
        });
        
        if (response.ok || response.status === 302) {
          if (response.status === 302) {
            window.location.href = response.headers.get('Location');
          } else {
            document.body.innerHTML = await response.text();
          }
        } else {
          const errorText = await response.text();
          const errorMatch = errorText.match(/<div class="error-message">([^<]+)<\/div>/);
          const errorMsg = errorMatch ? errorMatch[1] : 'Submission failed. Please try again.';
          errorDiv.textContent = errorMsg;
          errorDiv.classList.add('show');
          submitButton.disabled = false;
          submitButton.textContent = '${escapeHtml(submitButtonText)}';
        }
      } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.add('show');
        submitButton.disabled = false;
        submitButton.textContent = '${escapeHtml(submitButtonText)}';
      }
    });
  </script>
</body>
</html>`;
}

function generateSuccessHTML(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src-attr 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io; frame-ancestors 'none';">
  <title>Success</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .success-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #4caf50;
      color: white;
      font-size: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 { color: #333; margin-bottom: 16px; font-size: 28px; }
    p { color: #666; font-size: 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="success-container">
    <div class="checkmark">✓</div>
    <h1>Success!</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function generateErrorHTML(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src-attr 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-hashes'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io; frame-ancestors 'none';">
  <title>Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .error-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .error-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #e74c3c;
      color: white;
      font-size: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 { color: #333; margin-bottom: 16px; font-size: 28px; }
    .error-message { color: #666; font-size: 16px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">✗</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="error-message">${escapeHtml(message)}</div>
  </div>
</body>
</html>`;
}

function validateFormData(formData: Record<string, any>, fields: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    const name = field.name || "";
    const value = formData[name];
    const required = field.required || false;

    // Check required fields
    if (required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label || name} is required`);
      continue;
    }

    // Skip validation if value is empty and field is not required
    if (!value) continue;

    // Type-specific validation
    const type = field.type || "text";
    
    if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        errors.push(`${field.label || name} must be a valid email address`);
      }
    } else if (type === "url") {
      try {
        new URL(String(value));
      } catch {
        errors.push(`${field.label || name} must be a valid URL`);
      }
    } else if (type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${field.label || name} must be a valid number`);
      } else {
        if (field.min !== undefined && num < field.min) {
          errors.push(`${field.label || name} must be at least ${field.min}`);
        }
        if (field.max !== undefined && num > field.max) {
          errors.push(`${field.label || name} must be at most ${field.max}`);
        }
      }
    } else if (type === "text" || type === "textarea") {
      const strValue = String(value);
      if (field.minLength !== undefined && strValue.length < field.minLength) {
        errors.push(`${field.label || name} must be at least ${field.minLength} characters`);
      }
      if (field.maxLength !== undefined && strValue.length > field.maxLength) {
        errors.push(`${field.label || name} must be at most ${field.maxLength} characters`);
      }
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(strValue)) {
          errors.push(`${field.label || name} does not match the required format`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function sanitizeInput(input: any): any {
  // Basic sanitization - preserve data integrity for workflow processing
  // XSS prevention is handled at the display layer (HTML generation)
  if (typeof input === 'string') {
    // Remove null bytes and trim
    return input.replace(/\0/g, '').trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function maskIP(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  } else if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length > 0) {
      return `${parts.slice(0, -1).join(":")}:xxxx`;
    }
  }
  return "unknown";
}
