/**
 * Google API Utilities
 * Shared utilities for retry logic, rate limiting, error handling, and validation
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a fetch request with retry logic and rate limiting
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const retryAfterMs = parseInt(retryAfter, 10) * 1000;
          console.log(`[Google API] Rate limited. Retrying after ${retryAfter} seconds`);
          await sleep(Math.min(retryAfterMs, opts.maxDelay));
          continue;
        }
      }

      // If status is retryable and we have retries left, retry
      if (opts.retryableStatuses.includes(response.status) && attempt < opts.maxRetries) {
        console.log(`[Google API] Request failed with status ${response.status}, retrying (attempt ${attempt + 1}/${opts.maxRetries})...`);
        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Network errors are retryable
      if (attempt < opts.maxRetries) {
        console.log(`[Google API] Network error, retrying (attempt ${attempt + 1}/${opts.maxRetries})...`);
        await sleep(delay);
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Parse and format Google API error messages
 */
export function parseGoogleApiError(response: Response, errorText: string): string {
  let errorMessage = `Google API error: ${response.status}`;

  try {
    const errorData = JSON.parse(errorText);
    if (errorData.error?.message) {
      errorMessage = errorData.error.message;
    } else if (errorData.error_description) {
      errorMessage = errorData.error_description;
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }
  } catch {
    // If JSON parsing fails, use the error text if available
    if (errorText) {
      errorMessage = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
    }
  }

  // Add helpful context based on status code
  switch (response.status) {
    case 400:
      errorMessage = `Bad request: ${errorMessage}`;
      break;
    case 401:
      errorMessage = `Authentication failed: ${errorMessage}. Please re-authenticate with Google.`;
      break;
    case 403:
      errorMessage = `Permission denied: ${errorMessage}. Check your permissions and ensure you have access.`;
      break;
    case 404:
      errorMessage = `Resource not found: ${errorMessage}. Check the ID and ensure the resource exists.`;
      break;
    case 429:
      errorMessage = `Rate limit exceeded: ${errorMessage}. Please try again later.`;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      errorMessage = `Google API server error: ${errorMessage}. Please try again later.`;
      break;
  }

  return errorMessage;
}

/**
 * Validate and sanitize input strings
 */
export function sanitizeString(input: unknown, fieldName: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const sanitized = input.trim();
  
  if (sanitized.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  if (maxLength && sanitized.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }

  return sanitized;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate ISO 8601 date string
 */
export function validateISO8601(dateString: string): boolean {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return iso8601Regex.test(dateString);
}

/**
 * Extract ID from Google URL
 */
export function extractIdFromUrl(url: string, pattern: RegExp): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const match = url.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract document ID from Google Docs URL
 */
export function extractDocumentId(urlOrId: string): string {
  if (!urlOrId || typeof urlOrId !== 'string') {
    throw new Error('Document ID or URL is required');
  }

  const trimmed = urlOrId.trim();
  
  // If it's already just an ID (no slashes), return it
  if (!trimmed.includes('/')) {
    return trimmed;
  }

  // Try to extract from URL
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,
    /document\/d\/([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If no pattern matches, assume it's an ID
  return trimmed;
}

/**
 * Extract file ID from Google Drive URL
 */
export function extractFileId(urlOrId: string): string {
  if (!urlOrId || typeof urlOrId !== 'string') {
    throw new Error('File ID or URL is required');
  }

  const trimmed = urlOrId.trim();
  
  // If it's already just an ID (no slashes), return it
  if (!trimmed.includes('/')) {
    return trimmed;
  }

  // Try to extract from URL
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,
    /file\/d\/([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If no pattern matches, assume it's an ID
  return trimmed;
}

/**
 * Validate base64 string
 */
export function validateBase64(base64: string): boolean {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    
    // Check if it's valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      return false;
    }

    // Try to decode
    atob(cleanBase64);
    return true;
  } catch {
    return false;
  }
}

/**
 * Log API operation with context
 */
export function logApiOperation(service: string, operation: string, details?: Record<string, unknown>): void {
  const logData: Record<string, unknown> = {
    service,
    operation,
    timestamp: new Date().toISOString(),
    ...details,
  };
  
  console.log(`[Google ${service}] ${operation}`, JSON.stringify(logData, null, 2));
}

