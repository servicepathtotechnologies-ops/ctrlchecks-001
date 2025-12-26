import { supabase } from "@/integrations/supabase/client";

export interface ChatbotResponse {
  content: string;
  suggestions?: string[];
  escalation?: boolean;
}

/**
 * Ask the chatbot a question via Supabase Edge Function
 */
export async function askChatbot(message: string): Promise<ChatbotResponse> {
  try {
    console.log("Sending message to chatbot:", message);
    
    const { data, error } = await supabase.functions.invoke("chatbot", {
      body: { message },
    });

    if (error) {
      console.error("Chatbot function error:", error);
      // Check if it's a network error or function not found
      if (error.message?.includes("Function not found") || error.message?.includes("404")) {
        return {
          content:
            "The chatbot service is not available right now. Please make sure the Edge Function is deployed. Contact support@ctrlchecks.com if this persists.",
          suggestions: ["Try again", "Contact support"],
        };
      }
      throw error;
    }

    console.log("Chatbot response received:", data);

    if (!data) {
      console.error("No data in response");
      throw new Error("No data in response");
    }

    if (!data.content) {
      console.error("No content in response:", data);
      throw new Error("Invalid response from chatbot - no content");
    }

    return {
      content: data.content,
      suggestions: data.suggestions || [],
      escalation: data.escalation || false,
    };
  } catch (error) {
    console.error("Failed to ask chatbot:", error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      return {
        content:
          "I'm having trouble connecting to the server right now. Please check your internet connection and try again.",
        suggestions: ["Try again", "Contact support"],
      };
    }

    // Return a friendly fallback
    return {
      content:
        "Sorry, I'm having trouble connecting right now. Please try again in a moment, or feel free to contact our support team at support@ctrlchecks.com.",
      suggestions: ["Try again", "Contact support"],
    };
  }
}
