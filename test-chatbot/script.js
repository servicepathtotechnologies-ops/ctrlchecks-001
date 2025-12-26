// ============================================
// CONFIGURATION - REPLACE THIS WITH YOUR WEBHOOK URL
// ============================================
// Replace this URL with your actual webhook URL from CtrlChecks
// Example: https://your-project.supabase.co/functions/v1/chat-webhook
// OR: https://your-project.supabase.co/functions/v1/webhook-trigger/{workflow-id}
const WEBHOOK_URL = "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/a6519c95-3bf5-48ad-8981-0be00090b18b";

// ============================================
// CHAT FUNCTIONALITY
// ============================================

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const loadingIndicator = document.getElementById('loadingIndicator');

// Generate or retrieve session ID for conversation memory
let sessionId = localStorage.getItem('chatbot_session_id');
if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('chatbot_session_id', sessionId);
}

// Check if webhook URL is configured
if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
    showError('⚠️ Please configure WEBHOOK_URL in script.js');
}

// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (WEBHOOK_URL === 'YOUR_WEBHOOK_URL_HERE') {
        showError('⚠️ Please configure WEBHOOK_URL in script.js');
        return;
    }
    
    // Disable input while sending
    messageInput.disabled = true;
    sendButton.disabled = true;
    loadingIndicator.style.display = 'flex';
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    messageInput.value = '';
    
    try {
        // Call webhook API
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: sessionId  // Include session_id for conversation memory
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract reply from response
        // Handle different response formats
        let reply = '';
        if (data.reply) {
            reply = data.reply;
        } else if (data.content) {
            reply = data.content;
        } else if (data.message) {
            reply = data.message;
        } else if (data.output) {
            // Handle execution output format
            if (typeof data.output === 'string') {
                reply = data.output;
            } else if (data.output.text) {
                reply = data.output.text;
            } else if (data.output.content) {
                reply = data.output.content;
            } else {
                reply = JSON.stringify(data.output);
            }
        } else if (typeof data === 'string') {
            reply = data;
        } else {
            // Try to find reply in nested structure
            reply = data.response || data.text || JSON.stringify(data);
        }
        
        // Clean up the reply (remove any extra formatting)
        reply = reply.trim();
        
        // Add bot reply to chat with typing animation
        addMessageWithTyping(reply, 'bot');
        
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage(
            'Sorry, I encountered an error. Please check the console for details and make sure your webhook URL is correct.',
            'bot'
        );
        showError(`Error: ${error.message}`);
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        loadingIndicator.style.display = 'none';
        messageInput.focus();
    }
}

// Add message to chat UI
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${escapeHtml(text)}</p>`;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add message with typing animation (for bot messages)
function addMessageWithTyping(text, sender) {
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Show typing indicator
    contentDiv.innerHTML = '<p class="typing-indicator"><span></span><span></span><span></span></p>';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Type out the message character by character
    let index = 0;
    const typingInterval = setInterval(() => {
        if (index < text.length) {
            const displayText = text.substring(0, index + 1);
            contentDiv.innerHTML = `<p>${escapeHtml(displayText)}</p>`;
            index++;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            clearInterval(typingInterval);
        }
    }, 20); // Adjust speed: lower = faster typing
}

// Show error message
function showError(message) {
    // Remove existing error if any
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const inputContainer = document.querySelector('.chat-input-container');
    inputContainer.appendChild(errorDiv);
    
    // Remove error after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Get current time string
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Focus input on load
messageInput.focus();

