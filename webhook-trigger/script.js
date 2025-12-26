// Webhook URL
const WEBHOOK_URL = 'https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/webhook-trigger/7b82ee69-5c91-4fcc-bdf0-d3d00ac5b65e';

// Copy to clipboard function
function copyToClipboard() {
    const url = document.getElementById('webhookUrl').textContent;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Webhook URL copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy URL', 'error');
    });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'error' ? '#dc3545' : '#28a745';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Trigger webhook
async function triggerWebhook() {
    const method = document.getElementById('method').value;
    const bodyText = document.getElementById('body').value.trim();
    const headersText = document.getElementById('headers').value.trim();
    
    const triggerBtn = document.getElementById('triggerBtn');
    const responseSection = document.getElementById('responseSection');
    const statusBadge = document.getElementById('statusBadge');
    const statusTime = document.getElementById('statusTime');
    const responseContent = document.getElementById('responseContent');

    // Disable button and show loading
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<span class="loading-spinner"></span> <span>Sending...</span>';
    
    // Show response section
    responseSection.style.display = 'block';
    statusBadge.textContent = 'Loading';
    statusBadge.className = 'status-badge loading';
    statusTime.textContent = new Date().toLocaleTimeString();
    responseContent.textContent = 'Sending request...';

    try {
        // Parse headers
        let headers = {};
        if (headersText) {
            try {
                headers = JSON.parse(headersText);
            } catch (e) {
                throw new Error('Invalid JSON in headers: ' + e.message);
            }
        }

        // Parse body (only for POST/PUT)
        let body = null;
        if ((method === 'POST' || method === 'PUT') && bodyText) {
            try {
                // Replace {{timestamp}} placeholder
                const processedBody = bodyText.replace('{{timestamp}}', new Date().toISOString());
                body = JSON.parse(processedBody);
            } catch (e) {
                throw new Error('Invalid JSON in body: ' + e.message);
            }
        }

        // Prepare fetch options
        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        // Add body for POST/PUT
        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        // Make the request
        const startTime = Date.now();
        const response = await fetch(WEBHOOK_URL, fetchOptions);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Get response data
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        // Display response
        statusBadge.textContent = response.ok ? 'Success' : 'Error';
        statusBadge.className = `status-badge ${response.ok ? 'success' : 'error'}`;
        statusTime.textContent = `${new Date().toLocaleTimeString()} (${duration}ms)`;
        
        responseContent.textContent = JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        }, null, 2);

        if (response.ok) {
            showToast('Webhook triggered successfully!');
        } else {
            showToast('Webhook returned an error', 'error');
        }

    } catch (error) {
        // Display error
        statusBadge.textContent = 'Error';
        statusBadge.className = 'status-badge error';
        statusTime.textContent = new Date().toLocaleTimeString();
        
        responseContent.textContent = JSON.stringify({
            error: error.message,
            stack: error.stack
        }, null, 2);

        showToast('Failed to trigger webhook: ' + error.message, 'error');
        console.error('Webhook error:', error);
    } finally {
        // Re-enable button
        triggerBtn.disabled = false;
        triggerBtn.innerHTML = '<span class="btn-icon">⚡</span> <span>Trigger Webhook</span>';
    }
}

// Clear response
function clearResponse() {
    const responseSection = document.getElementById('responseSection');
    responseSection.style.display = 'none';
}

// Auto-format JSON on blur
document.getElementById('body').addEventListener('blur', function() {
    try {
        const parsed = JSON.parse(this.value);
        this.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // Invalid JSON, keep as is
    }
});

document.getElementById('headers').addEventListener('blur', function() {
    try {
        const parsed = JSON.parse(this.value);
        this.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
        // Invalid JSON, keep as is
    }
});

// Allow Enter key to trigger (Ctrl+Enter or Cmd+Enter)
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        triggerWebhook();
    }
});

// Initialize - show webhook URL
console.log('Webhook Trigger initialized');
console.log('Webhook URL:', WEBHOOK_URL);

