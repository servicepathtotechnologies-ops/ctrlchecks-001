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

// Types for better structure
interface KnowledgeBase {
  product: {
    name: string;
    category: string;
    tagline: string;
    description: string;
  };
  features: {
    core: Array<{ name: string; description: string }>;
    technical: string[];
  };
  pricing: {
    plans: Array<{
      name: string;
      price: string;
      runs: string;
      features: string[];
    }>;
    note: string;
  };
  differentiation: {
    vs_zapier: string[];
    vs_n8n: string[];
    unique: string[];
  };
  use_cases: Array<{
    category: string;
    examples: string[];
  }>;
  faqs: Array<{
    question: string;
    answer: string;
    keywords: string[];
  }>;
  escalation: {
    triggers: string[];
    response: string;
  };
  personality: {
    tone: string;
    style: string;
    greeting: string;
    fallback: string;
    encouragement: string[];
  };
  conversion: {
    suggestions: {
      [key: string]: string[];
    };
    cta_phrases: string[];
  };
  contact: {
    support_email: string;
    sales_email: string;
    website: string;
  };
}

// Load knowledge base - cached per instance
let knowledgeCache: KnowledgeBase | null = null;

async function loadKnowledge(): Promise<KnowledgeBase> {
  if (knowledgeCache) {
    return knowledgeCache;
  }

  try {
    // In Supabase Edge Functions, files are relative to the function directory
    // Try multiple possible paths for the knowledge file
    const possiblePaths = [
      "./website_knowledge.json",
      "website_knowledge.json",
    ];

    // Try to get the function directory path
    try {
      const functionDir = new URL(".", import.meta.url).pathname;
      possiblePaths.push(`${functionDir}website_knowledge.json`);
    } catch {
      // Ignore if import.meta.url doesn't work
    }

    let knowledgeText: string | null = null;
    let lastError: Error | null = null;

    for (const path of possiblePaths) {
      try {
        knowledgeText = await Deno.readTextFile(path);
        console.log(`Successfully loaded knowledge from: ${path}`);
        break;
      } catch (error) {
        lastError = error as Error;
        console.log(`Failed to load from ${path}:`, (error as Error).message);
      }
    }

    if (!knowledgeText) {
      console.warn("Failed to load knowledge base from all paths, using fallback");
      console.error("Last error:", lastError);
      // Return a minimal fallback knowledge base
      return getFallbackKnowledge();
    }

    knowledgeCache = JSON.parse(knowledgeText) as KnowledgeBase;
    console.log("Knowledge base loaded and parsed successfully");
    return knowledgeCache;
  } catch (error) {
    console.error("Failed to parse knowledge base:", error);
    return getFallbackKnowledge();
  }
}

// Fallback knowledge if file can't be loaded
function getFallbackKnowledge(): KnowledgeBase {
  return {
    product: {
      name: "CtrlChecks",
      category: "Visual AI Workflow Automation",
      tagline: "Build automations that think. Connect anything. Automate everything.",
      description: "CtrlChecks is an AI-native workflow automation platform that lets you visually build workflows to connect apps, automate tasks, and deploy AI-powered automations without coding.",
    },
    features: {
      core: [
        { name: "Drag-and-Drop Workflow Builder", description: "Visually design workflows with an intuitive interface." },
        { name: "300+ App Integrations", description: "Connect with popular apps like Google Workspace, Slack, Salesforce, and more." },
        { name: "Built-in AI Nodes", description: "Access GPT, Gemini, and custom AI models directly in your workflows." },
        { name: "Multiple Deployment Options", description: "Deploy workflows as APIs, chatbots, or scheduled jobs." },
        { name: "No-Code with Code Support", description: "Start with no-code simplicity, but add custom code when needed." },
      ],
      technical: [],
    },
    pricing: {
      plans: [
        { name: "Free", price: "$0", runs: "500 runs/month", features: ["All core features", "Community support"] },
        { name: "Pro", price: "$29/month", runs: "10,000 runs/month", features: ["Everything in Free", "Priority support"] },
        { name: "Business", price: "$99/month", runs: "100,000 runs/month", features: ["Everything in Pro", "Team collaboration"] },
        { name: "Enterprise", price: "Custom", runs: "Unlimited", features: ["Everything in Business", "Self-hosting option"] },
      ],
      note: "All plans include access to all integrations and the workflow builder.",
    },
    differentiation: {
      vs_zapier: ["More flexible workflow logic", "AI-native architecture", "Better pricing"],
      vs_n8n: ["More intuitive user interface", "Better AI integration", "Easier onboarding"],
      unique: ["AI capabilities built into every node", "Deploy workflows as chatbots"],
    },
    use_cases: [
      { category: "Marketing", examples: ["Lead enrichment", "Social media automation"] },
      { category: "Sales", examples: ["CRM synchronization", "Lead scoring"] },
      { category: "Operations", examples: ["Customer onboarding", "Automated reporting"] },
    ],
    faqs: [
      {
        question: "Is there a free plan?",
        answer: "Yes! Our free plan includes 500 runs per month, which is perfect for getting started, testing workflows, and building small automations. You get access to all core features, including the drag-and-drop builder and all integrations.",
        keywords: ["free", "plan", "pricing", "cost"],
      },
      {
        question: "What can I build with CtrlChecks?",
        answer: "You can build almost any automation! Common examples include lead enrichment workflows, customer onboarding processes, social media posting schedules, automated reporting systems, data synchronization between apps, and AI-powered content generation.",
        keywords: ["build", "create", "make", "do", "automate"],
      },
      {
        question: "How is CtrlChecks different from Zapier or n8n?",
        answer: "CtrlChecks is AI-native, meaning AI capabilities are built into every workflow node. Compared to n8n, we have a more intuitive interface. Compared to Zapier, we offer more flexibility in workflow logic and better pricing for high-volume users.",
        keywords: ["different", "vs", "compare", "zapier", "n8n"],
      },
    ],
    escalation: {
      triggers: ["enterprise pricing", "custom pricing", "security audit", "compliance", "talk to sales"],
      response: "I'd love to help, but for detailed information about that, I think it's best if you speak directly with our team. Please contact our sales team at sales@ctrlchecks.com!",
    },
    personality: {
      tone: "friendly, helpful, professional, approachable",
      style: "conversational but clear, encouraging, non-pushy",
      greeting: "Hi there! 👋 I'm here to help you learn about CtrlChecks.",
      fallback: "Hmm, I'm not sure I have that specific information right now. But I'd be happy to help with other questions about CtrlChecks! You could ask about our features, pricing, how to get started, or what you can build.",
      encouragement: ["Great question!", "I'd be happy to help!", "That's a common question!"],
    },
    conversion: {
      suggestions: {
        pricing: ["Try free plan", "View all plans"],
        features: ["View templates", "Watch demo"],
        getting_started: ["Sign up free", "Try free plan", "Watch demo"],
        general: ["Try free plan", "View templates", "Watch demo"],
      },
      cta_phrases: ["Ready to get started?", "Want to try it out?"],
    },
    contact: {
      support_email: "support@ctrlchecks.com",
      sales_email: "sales@ctrlchecks.com",
      website: "https://ctrlchecks.com",
    },
  };
}

// Check if query should be escalated
function shouldEscalate(message: string, knowledge: KnowledgeBase): boolean {
  const lowerMessage = message.toLowerCase();
  return knowledge.escalation.triggers.some((trigger) =>
    lowerMessage.includes(trigger.toLowerCase())
  );
}

// Find matching FAQ
function findMatchingFAQ(
  message: string,
  knowledge: KnowledgeBase
): { question: string; answer: string } | null {
  const lowerMessage = message.toLowerCase();

  // First, try exact keyword matching
  for (const faq of knowledge.faqs) {
    if (faq.keywords.some((keyword) => lowerMessage.includes(keyword))) {
      return { question: faq.question, answer: faq.answer };
    }
  }

  // Then try question matching
  for (const faq of knowledge.faqs) {
    const questionWords = faq.question.toLowerCase().split(/\s+/);
    if (questionWords.some((word) => word.length > 3 && lowerMessage.includes(word))) {
      return { question: faq.question, answer: faq.answer };
    }
  }

  return null;
}

// Get relevant suggestions based on message
function getSuggestions(
  message: string,
  knowledge: KnowledgeBase
): string[] {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("pricing") || lowerMessage.includes("plan") || lowerMessage.includes("cost")) {
    return knowledge.conversion.suggestions.pricing || [];
  }

  if (
    lowerMessage.includes("feature") ||
    lowerMessage.includes("what can") ||
    lowerMessage.includes("build")
  ) {
    return knowledge.conversion.suggestions.features || [];
  }

  if (
    lowerMessage.includes("start") ||
    lowerMessage.includes("begin") ||
    lowerMessage.includes("get started")
  ) {
    return knowledge.conversion.suggestions.getting_started || [];
  }

  return knowledge.conversion.suggestions.general || [];
}

// Build structured prompt for AI
function buildPrompt(
  userMessage: string,
  knowledge: KnowledgeBase
): string {
  const faqSection = knowledge.faqs
    .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join("\n\n");

  const featuresSection = knowledge.features.core
    .map((f) => `- ${f.name}: ${f.description}`)
    .join("\n");

  const pricingSection = knowledge.pricing.plans
    .map(
      (p) =>
        `- ${p.name}: ${p.price} - ${p.runs} - Features: ${p.features.join(", ")}`
    )
    .join("\n");

  return `You are a friendly and helpful website chatbot for ${knowledge.product.name}, an AI-native workflow automation platform.

YOUR PERSONALITY:
- ${knowledge.personality.tone}
- ${knowledge.personality.style}
- Be conversational, warm, and encouraging
- Make users feel comfortable asking anything
- Never be pushy or salesy

PRODUCT INFORMATION:
Name: ${knowledge.product.name}
Category: ${knowledge.product.category}
Tagline: ${knowledge.product.tagline}
Description: ${knowledge.product.description}

KEY FEATURES:
${featuresSection}

PRICING PLANS:
${pricingSection}
Note: ${knowledge.pricing.note}

FREQUENTLY ASKED QUESTIONS:
${faqSection}

DIFFERENTIATION:
vs Zapier: ${knowledge.differentiation.vs_zapier.join(", ")}
vs n8n: ${knowledge.differentiation.vs_n8n.join(", ")}
Unique: ${knowledge.differentiation.unique.join(", ")}

USE CASES:
${knowledge.use_cases.map(uc => `${uc.category}: ${uc.examples.join(", ")}`).join("\n")}

CRITICAL RULES:
1. Answer ONLY using the information provided above
2. If you don't have the exact information, use this fallback: "${knowledge.personality.fallback}"
3. Keep responses concise (2-3 short paragraphs max)
4. Use friendly, conversational language
5. Don't repeat information unnecessarily
6. Include at most one follow-up question if natural
7. Make users feel welcome and free to ask anything
8. Never hallucinate or make up information
9. If asked about enterprise/custom/compliance topics, suggest contacting sales

USER QUESTION: ${userMessage}

Provide a helpful, friendly response based on the information above.`;
}

// Main handler
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Load knowledge
    let knowledge: KnowledgeBase;
    try {
      knowledge = await loadKnowledge();
    } catch (error) {
      console.error("Failed to load knowledge:", error);
      knowledge = getFallbackKnowledge();
    }

    // Parse request
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error("Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message } = requestBody;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userMessage = message.trim();
    console.log("Processing message:", userMessage);

    // Check escalation
    if (shouldEscalate(userMessage, knowledge)) {
      const topic = knowledge.escalation.triggers.find((t) =>
        userMessage.toLowerCase().includes(t.toLowerCase())
      ) || "that";
      
      return new Response(
        JSON.stringify({
          content: knowledge.escalation.response.replace("{topic}", topic),
          suggestions: ["Contact sales", "View enterprise plans"],
          escalation: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try FAQ matching first (faster, more deterministic)
    const matchedFAQ = findMatchingFAQ(userMessage, knowledge);
    
    if (matchedFAQ) {
      const suggestions = getSuggestions(userMessage, knowledge);
      return new Response(
        JSON.stringify({
          content: matchedFAQ.answer,
          suggestions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use AI for complex queries
    const CHATBOT_API_KEY = Deno.env.get("CHATBOT_API_KEY");
    
    if (!CHATBOT_API_KEY) {
      console.warn("CHATBOT_API_KEY not set, using fallback response");
      // Fallback to FAQ-based response if no API key
      return new Response(
        JSON.stringify({
          content: knowledge.personality.fallback,
          suggestions: getSuggestions(userMessage, knowledge),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(userMessage, knowledge);
    console.log("Calling Gemini API...");

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${CHATBOT_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 400,
              topP: 0.8,
              topK: 40,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error("Gemini API error:", geminiResponse.status, errorText);
        // Fallback response
        return new Response(
          JSON.stringify({
            content: knowledge.personality.fallback,
            suggestions: getSuggestions(userMessage, knowledge),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();
      console.log("Gemini API response received");
      
      const content =
        geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        knowledge.personality.fallback;

      const suggestions = getSuggestions(userMessage, knowledge);

      return new Response(
        JSON.stringify({
          content,
          suggestions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (apiError) {
      console.error("Gemini API request failed:", apiError);
      // Fallback response
      return new Response(
        JSON.stringify({
          content: knowledge.personality.fallback,
          suggestions: getSuggestions(userMessage, knowledge),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({
        content:
          "Sorry, I'm having trouble responding right now. Please try again or contact our support team at support@ctrlchecks.com.",
        suggestions: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
