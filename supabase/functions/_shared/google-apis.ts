/**
 * Google APIs Helper
 * Handles various Google API operations (Docs, Drive, Calendar, Gmail, BigQuery, Tasks, Contacts)
 * Enhanced with retry logic, pagination, error handling, and validation
 */

import { getGoogleAccessToken } from './google-sheets.ts';
import {
  fetchWithRetry,
  parseGoogleApiError,
  sanitizeString,
  validateEmail,
  validateISO8601,
  extractDocumentId,
  extractFileId,
  validateBase64,
  logApiOperation,
} from './google-api-utils.ts';

interface GoogleApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Google Docs Operations
 */
export async function executeGoogleDocsOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Docs', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    const documentId = config.documentId as string;
    const title = config.title as string;
    const content = config.content as string;

    switch (operation) {
      case 'read': {
        if (!documentId) {
          throw new Error('Document ID is required for read operation');
        }

        const docId = extractDocumentId(documentId);
        const readUrl = `https://docs.googleapis.com/v1/documents/${docId}`;
        
        const readResponse = await fetchWithRetry(readUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!readResponse.ok) {
          const errorText = await readResponse.text();
          const errorMessage = parseGoogleApiError(readResponse, errorText);
          throw new Error(errorMessage);
        }

        const docData = await readResponse.json();
        
        // Extract text content from document
        let textContent = '';
        if (docData.body && docData.body.content && Array.isArray(docData.body.content)) {
          textContent = extractTextFromContent(docData.body.content);
        }

        const finalDocumentId = docData.documentId || docId;
        const documentTitle = docData.title || 'Untitled Document';

        return {
          success: true,
          data: {
            documentId: finalDocumentId,
            title: documentTitle,
            content: textContent,
            body: textContent,
            text: textContent,
            contentLength: textContent.length,
            hasContent: textContent.length > 0,
            documentUrl: `https://docs.google.com/document/d/${finalDocumentId}/edit`,
          },
        };
      }

      case 'create': {
        const sanitizedTitle = sanitizeString(title, 'Title', 200);
        
        const createUrl = 'https://docs.googleapis.com/v1/documents';
        const createResponse = await fetchWithRetry(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: sanitizedTitle,
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          const errorMessage = parseGoogleApiError(createResponse, errorText);
          throw new Error(errorMessage);
        }

        const newDoc = await createResponse.json();
        const docId = newDoc.documentId;

        // If content is provided, insert it
        if (content && typeof content === 'string' && content.trim()) {
          await insertTextIntoDocument(accessToken, docId, content);
        }

        return {
          success: true,
          data: {
            documentId: docId,
            title: newDoc.title,
            documentUrl: `https://docs.google.com/document/d/${docId}/edit`,
          },
        };
      }

      case 'update': {
        if (!documentId) {
          throw new Error('Document ID is required for update operation');
        }
        if (!content || (typeof content === 'string' && !content.trim())) {
          throw new Error('Content is required for update operation');
        }

        const docId = extractDocumentId(documentId);
        await insertTextIntoDocument(accessToken, docId, content as string);
        
        return {
          success: true,
          data: { documentId: docId, updated: true },
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Docs', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Google Docs operation',
    };
  }
}

function extractTextFromContent(content: any[]): string {
  let text = '';
  if (!content || !Array.isArray(content)) {
    return text;
  }
  
  for (const element of content) {
    if (!element) continue;
    
    // Handle paragraphs
    if (element.paragraph) {
      const paragraph = element.paragraph;
      if (paragraph.elements && Array.isArray(paragraph.elements)) {
        for (const elem of paragraph.elements) {
          if (!elem) continue;
          if (elem.textRun && elem.textRun.content) {
            text += elem.textRun.content;
          }
        }
      }
      if (text && !text.endsWith('\n') && !text.endsWith('\r\n')) {
        text += '\n';
      }
    }
    
    // Handle tables
    if (element.table) {
      const table = element.table;
      if (table.tableRows && Array.isArray(table.tableRows)) {
        for (const row of table.tableRows) {
          if (!row || !row.tableCells || !Array.isArray(row.tableCells)) continue;
          
          const rowTexts: string[] = [];
          for (const cell of row.tableCells) {
            if (!cell || !cell.content || !Array.isArray(cell.content)) {
              rowTexts.push('');
              continue;
            }
            
            let cellText = '';
            for (const cellElement of cell.content) {
              if (!cellElement) continue;
              if (cellElement.paragraph && cellElement.paragraph.elements) {
                for (const elem of cellElement.paragraph.elements) {
                  if (elem && elem.textRun && elem.textRun.content) {
                    cellText += elem.textRun.content;
                  }
                }
              }
            }
            rowTexts.push(cellText.trim());
          }
          text += rowTexts.join('\t') + '\n';
        }
      }
    }
    
    // Handle section breaks
    if (element.sectionBreak) {
      text += '\n\n';
    }
    
    // Handle page breaks
    if (element.pageBreak) {
      text += '\n\n';
    }
  }
  
  // Clean up excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/\s+$/, '');
  
  return text;
}

async function insertTextIntoDocument(accessToken: string, documentId: string, text: string): Promise<void> {
  const updateUrl = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
  const response = await fetchWithRetry(updateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: {
              index: 1,
            },
            text: text,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = parseGoogleApiError(response, errorText);
    throw new Error(errorMessage);
  }
}

/**
 * Google Drive Operations with Pagination
 */
export async function executeGoogleDriveOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Drive', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    switch (operation) {
      case 'list': {
        const folderId = (config.folderId as string) || 'root';
        const pageSize = Math.min((config.pageSize as number) || 100, 1000);
        const pageToken = config.pageToken as string | undefined;
        
        const query = folderId === 'root' 
          ? "'root' in parents and trashed=false"
          : `'${folderId}' in parents and trashed=false`;
        
        let listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink),nextPageToken&pageSize=${pageSize}`;
        if (pageToken) {
          listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        const listResponse = await fetchWithRetry(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          const errorMessage = parseGoogleApiError(listResponse, errorText);
          throw new Error(errorMessage);
        }

        const data = await listResponse.json();
        return {
          success: true,
          data: {
            files: data.files || [],
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken,
          },
        };
      }

      case 'upload': {
        const fileName = sanitizeString(config.fileName, 'File name', 255);
        const fileContent = config.fileContent as string;
        
        if (!fileContent) {
          throw new Error('File content is required for upload');
        }

        // Validate base64 if it looks like base64
        if (!validateBase64(fileContent)) {
          throw new Error('Invalid base64 file content');
        }

        // Decode base64 content
        const cleanBase64 = fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
        const binaryContent = atob(cleanBase64);
        const bytes = new Uint8Array(binaryContent.length);
        for (let i = 0; i < binaryContent.length; i++) {
          bytes[i] = binaryContent.charCodeAt(i);
        }

        // Create file metadata
        const metadata = {
          name: fileName,
        };

        // Upload file using multipart upload
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        // Convert bytes to string for multipart body
        let fileString = '';
        for (let i = 0; i < bytes.length; i++) {
          fileString += String.fromCharCode(bytes[i]);
        }

        const multipartBody = 
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/octet-stream\r\n\r\n' +
          fileString +
          closeDelim;

        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
        const uploadResponse = await fetchWithRetry(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          const errorMessage = parseGoogleApiError(uploadResponse, errorText);
          throw new Error(errorMessage);
        }

        const uploadedFile = await uploadResponse.json();
        return {
          success: true,
          data: {
            fileId: uploadedFile.id,
            name: uploadedFile.name,
            webViewLink: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
          },
        };
      }

      case 'download': {
        const fileId = extractFileId(config.fileId as string);
        
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const downloadResponse = await fetchWithRetry(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          const errorMessage = parseGoogleApiError(downloadResponse, errorText);
          throw new Error(errorMessage);
        }

        const fileContent = await downloadResponse.arrayBuffer();
        const bytes = new Uint8Array(fileContent);
        
        // Handle large files by chunking the conversion
        let base64Content = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          base64Content += btoa(String.fromCharCode(...chunk));
        }

        return {
          success: true,
          data: {
            fileId,
            content: base64Content,
            contentType: downloadResponse.headers.get('content-type') || 'application/octet-stream',
            size: bytes.length,
          },
        };
      }

      case 'delete': {
        const fileId = extractFileId(config.fileId as string);
        
        const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        const deleteResponse = await fetchWithRetry(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!deleteResponse.ok && deleteResponse.status !== 204) {
          const errorText = await deleteResponse.text();
          const errorMessage = parseGoogleApiError(deleteResponse, errorText);
          throw new Error(errorMessage);
        }

        return {
          success: true,
          data: { deleted: true, fileId },
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Drive', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Google Drive operation',
    };
  }
}

/**
 * Google Calendar Operations with Pagination
 */
export async function executeGoogleCalendarOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Calendar', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    const calendarId = (config.calendarId as string) || 'primary';
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`;

    switch (operation) {
      case 'list': {
        const timeMin = config.timeMin as string || new Date().toISOString();
        const timeMax = config.timeMax as string;
        const maxResults = Math.min((config.maxResults as number) || 10, 2500);
        const pageToken = config.pageToken as string | undefined;
        
        if (!validateISO8601(timeMin)) {
          throw new Error('timeMin must be in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)');
        }
        if (timeMax && !validateISO8601(timeMax)) {
          throw new Error('timeMax must be in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)');
        }
        
        let listUrl = `${baseUrl}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
        if (timeMax) {
          listUrl += `&timeMax=${encodeURIComponent(timeMax)}`;
        }
        if (pageToken) {
          listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        const listResponse = await fetchWithRetry(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          const errorMessage = parseGoogleApiError(listResponse, errorText);
          throw new Error(errorMessage);
        }

        const data = await listResponse.json();
        return {
          success: true,
          data: {
            events: data.items || [],
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken,
          },
        };
      }

      case 'create': {
        const summary = sanitizeString(config.summary, 'Summary', 255);
        const startTime = config.startTime as string;
        const endTime = config.endTime as string;
        const description = config.description as string;

        if (!startTime || !endTime) {
          throw new Error('Start time and end time are required for create');
        }

        if (!validateISO8601(startTime)) {
          throw new Error('Start time must be in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)');
        }
        if (!validateISO8601(endTime)) {
          throw new Error('End time must be in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)');
        }

        const event = {
          summary,
          description: description || undefined,
          start: {
            dateTime: startTime,
            timeZone: 'UTC',
          },
          end: {
            dateTime: endTime,
            timeZone: 'UTC',
          },
        };

        const createUrl = `${baseUrl}/events`;
        const createResponse = await fetchWithRetry(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          const errorMessage = parseGoogleApiError(createResponse, errorText);
          throw new Error(errorMessage);
        }

        const createdEvent = await createResponse.json();
        return {
          success: true,
          data: {
            eventId: createdEvent.id,
            summary: createdEvent.summary,
            start: createdEvent.start,
            end: createdEvent.end,
            htmlLink: createdEvent.htmlLink,
          },
        };
      }

      case 'update': {
        const eventId = sanitizeString(config.eventId, 'Event ID');
        const summary = config.summary as string;
        const startTime = config.startTime as string;
        const endTime = config.endTime as string;
        const description = config.description as string;

        const event: any = {};
        if (summary) {
          event.summary = sanitizeString(summary, 'Summary', 255);
        }
        if (description !== undefined) {
          event.description = description;
        }
        if (startTime) {
          if (!validateISO8601(startTime)) {
            throw new Error('Start time must be in ISO 8601 format');
          }
          event.start = { dateTime: startTime, timeZone: 'UTC' };
        }
        if (endTime) {
          if (!validateISO8601(endTime)) {
            throw new Error('End time must be in ISO 8601 format');
          }
          event.end = { dateTime: endTime, timeZone: 'UTC' };
        }

        const updateUrl = `${baseUrl}/events/${eventId}`;
        const updateResponse = await fetchWithRetry(updateUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          const errorMessage = parseGoogleApiError(updateResponse, errorText);
          throw new Error(errorMessage);
        }

        const updatedEvent = await updateResponse.json();
        return {
          success: true,
          data: updatedEvent,
        };
      }

      case 'delete': {
        const eventId = sanitizeString(config.eventId, 'Event ID');
        
        const deleteUrl = `${baseUrl}/events/${eventId}`;
        const deleteResponse = await fetchWithRetry(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!deleteResponse.ok && deleteResponse.status !== 204) {
          const errorText = await deleteResponse.text();
          const errorMessage = parseGoogleApiError(deleteResponse, errorText);
          throw new Error(errorMessage);
        }

        return {
          success: true,
          data: { deleted: true, eventId },
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Calendar', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Google Calendar operation',
    };
  }
}

/**
 * Google Gmail Operations with Enhanced Message Parsing
 */
export async function executeGoogleGmailOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Gmail', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    switch (operation) {
      case 'send': {
        const to = config.to as string;
        const subject = config.subject as string;
        const body = config.body as string;
        const isHtml = (config.isHtml as boolean) || false;
        const cc = config.cc as string | undefined;
        const bcc = config.bcc as string | undefined;

        if (!to || !subject || !body) {
          throw new Error('To, subject, and body are required for send');
        }

        // Validate email addresses
        const toEmails = to.split(',').map(e => e.trim());
        for (const email of toEmails) {
          if (!validateEmail(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
        }

        // Create email message in RFC 2822 format
        const emailParts: string[] = [
          `To: ${to}`,
          `Subject: ${subject}`,
        ];

        if (cc) {
          emailParts.push(`Cc: ${cc}`);
        }
        if (bcc) {
          emailParts.push(`Bcc: ${bcc}`);
        }

        if (isHtml) {
          emailParts.push('Content-Type: text/html; charset=utf-8');
        } else {
          emailParts.push('Content-Type: text/plain; charset=utf-8');
        }

        emailParts.push('');
        emailParts.push(body);

        const email = emailParts.join('\r\n');

        // Encode to base64url format
        const encodedEmail = btoa(unescape(encodeURIComponent(email)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
        const sendResponse = await fetchWithRetry(sendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedEmail,
          }),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          const errorMessage = parseGoogleApiError(sendResponse, errorText);
          throw new Error(errorMessage);
        }

        const sentMessage = await sendResponse.json();
        return {
          success: true,
          data: {
            messageId: sentMessage.id,
            threadId: sentMessage.threadId,
          },
        };
      }

      case 'list':
      case 'search': {
        const query = (config.query as string) || '';
        const maxResults = Math.min((config.maxResults as number) || 10, 500);
        const pageToken = config.pageToken as string | undefined;
        
        let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages`;
        const params = new URLSearchParams();
        if (query) {
          params.append('q', query);
        }
        params.append('maxResults', maxResults.toString());
        if (pageToken) {
          params.append('pageToken', pageToken);
        }
        listUrl += `?${params.toString()}`;
        
        const listResponse = await fetchWithRetry(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          const errorMessage = parseGoogleApiError(listResponse, errorText);
          throw new Error(errorMessage);
        }

        const data = await listResponse.json();
        return {
          success: true,
          data: {
            messages: data.messages || [],
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken,
            resultSizeEstimate: data.resultSizeEstimate,
          },
        };
      }

      case 'get': {
        const messageId = sanitizeString(config.messageId, 'Message ID');
        const format = (config.format as string) || 'full';

        const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`;
        const getResponse = await fetchWithRetry(getUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!getResponse.ok) {
          const errorText = await getResponse.text();
          const errorMessage = parseGoogleApiError(getResponse, errorText);
          throw new Error(errorMessage);
        }

        const message = await getResponse.json();
        
        // Parse message for easier access
        const parsedMessage = parseGmailMessage(message);
        
        return {
          success: true,
          data: {
            ...message,
            parsed: parsedMessage,
          },
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Gmail', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Gmail operation',
    };
  }
}

/**
 * Parse Gmail message for easier access
 */
function parseGmailMessage(message: any): Record<string, unknown> {
  const parsed: Record<string, unknown> = {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds || [],
    snippet: message.snippet || '',
    historyId: message.historyId,
  };

  if (message.payload) {
    const headers = message.payload.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    parsed.from = getHeader('From');
    parsed.to = getHeader('To');
    parsed.subject = getHeader('Subject');
    parsed.date = getHeader('Date');
    parsed.cc = getHeader('Cc');
    parsed.bcc = getHeader('Bcc');
    parsed.replyTo = getHeader('Reply-To');

    // Extract body
    parsed.textBody = extractGmailBody(message.payload, 'text/plain');
    parsed.htmlBody = extractGmailBody(message.payload, 'text/html');
    parsed.body = parsed.textBody || parsed.htmlBody || '';

    // Extract attachments
    parsed.attachments = extractGmailAttachments(message.payload);
  }

  return parsed;
}

function extractGmailBody(payload: any, mimeType: string): string {
  if (!payload) return '';

  if (payload.mimeType === mimeType && payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === mimeType && part.body?.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
      if (part.parts) {
        const nested = extractGmailBody(part, mimeType);
        if (nested) return nested;
      }
    }
  }

  return '';
}

function extractGmailAttachments(payload: any): any[] {
  const attachments: any[] = [];
  
  if (!payload || !payload.parts) {
    return attachments;
  }

  const extractFromPart = (part: any) => {
    if (part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename || '',
        mimeType: part.mimeType || '',
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        extractFromPart(subPart);
      }
    }
  };

  for (const part of payload.parts) {
    extractFromPart(part);
  }

  return attachments;
}

/**
 * Google BigQuery Operations with Service Account Support
 */
export async function executeGoogleBigQueryOperation(
  supabase: any,
  userId: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('BigQuery', 'query', { userId });
    
    let accessToken: string | null = null;
    
    // Check if using service account
    const serviceAccountKey = config.serviceAccountKey as string;
    if (serviceAccountKey) {
      // TODO: Implement service account authentication
      // For now, fall back to OAuth
      accessToken = await getGoogleAccessToken(supabase, userId);
    } else {
      accessToken = await getGoogleAccessToken(supabase, userId);
    }
    
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    const projectId = sanitizeString(config.projectId, 'Project ID');
    const query = sanitizeString(config.query, 'Query', 100000);
    const useLegacySql = (config.useLegacySql as boolean) || false;
    const datasetId = config.datasetId as string | undefined;

    const queryUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;
    const queryResponse = await fetchWithRetry(queryUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        useLegacySql,
        defaultDataset: datasetId ? { datasetId, projectId } : undefined,
      }),
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      const errorMessage = parseGoogleApiError(queryResponse, errorText);
      throw new Error(errorMessage);
    }

    const result = await queryResponse.json();
    
    // Format results
    const rows = result.rows || [];
    const schema = result.schema?.fields || [];
    const formattedRows = rows.map((row: any) => {
      const obj: Record<string, unknown> = {};
      schema.forEach((field: any, index: number) => {
        const value = row.f[index]?.v;
        // Convert types appropriately
        if (field.type === 'INTEGER' || field.type === 'INT64') {
          obj[field.name] = value ? parseInt(value, 10) : null;
        } else if (field.type === 'FLOAT' || field.type === 'FLOAT64') {
          obj[field.name] = value ? parseFloat(value) : null;
        } else if (field.type === 'BOOLEAN' || field.type === 'BOOL') {
          obj[field.name] = value === 'true' || value === true;
        } else {
          obj[field.name] = value;
        }
      });
      return obj;
    });

    return {
      success: true,
      data: {
        rows: formattedRows,
        totalRows: parseInt(result.totalRows || '0', 10),
        jobComplete: result.jobComplete || false,
        schema: schema.map((f: any) => ({ name: f.name, type: f.type })),
      },
    };
  } catch (error) {
    logApiOperation('BigQuery', 'query', { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in BigQuery operation',
    };
  }
}

/**
 * Google Tasks Operations with Pagination
 */
export async function executeGoogleTasksOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Tasks', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    const taskListId = (config.taskListId as string) || '@default';
    const baseUrl = `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}`;

    switch (operation) {
      case 'list': {
        const showCompleted = (config.showCompleted as boolean) || false;
        const showHidden = (config.showHidden as boolean) || false;
        const maxResults = Math.min((config.maxResults as number) || 100, 100);
        const pageToken = config.pageToken as string | undefined;
        
        let listUrl = `${baseUrl}/tasks?showCompleted=${showCompleted}&showHidden=${showHidden}&maxResults=${maxResults}`;
        if (pageToken) {
          listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        const listResponse = await fetchWithRetry(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          const errorMessage = parseGoogleApiError(listResponse, errorText);
          throw new Error(errorMessage);
        }

        const data = await listResponse.json();
        return {
          success: true,
          data: {
            items: data.items || [],
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken,
          },
        };
      }

      case 'create': {
        const title = sanitizeString(config.title, 'Title', 1024);
        const notes = config.notes as string;
        const dueDate = config.dueDate as string;

        if (dueDate && !validateISO8601(dueDate)) {
          throw new Error('Due date must be in ISO 8601 format (e.g., 2024-01-15T14:00:00Z)');
        }

        const task: any = {
          title,
        };
        if (notes) {
          task.notes = notes;
        }
        if (dueDate) {
          task.due = dueDate;
        }

        const createUrl = `${baseUrl}/tasks`;
        const createResponse = await fetchWithRetry(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(task),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          const errorMessage = parseGoogleApiError(createResponse, errorText);
          throw new Error(errorMessage);
        }

        const createdTask = await createResponse.json();
        return {
          success: true,
          data: createdTask,
        };
      }

      case 'update': {
        const taskId = sanitizeString(config.taskId, 'Task ID');
        const title = config.title as string;
        const notes = config.notes as string;
        const dueDate = config.dueDate as string;

        const task: any = {};
        if (title) {
          task.title = sanitizeString(title, 'Title', 1024);
        }
        if (notes !== undefined) {
          task.notes = notes;
        }
        if (dueDate) {
          if (!validateISO8601(dueDate)) {
            throw new Error('Due date must be in ISO 8601 format');
          }
          task.due = dueDate;
        }

        const updateUrl = `${baseUrl}/tasks/${taskId}`;
        const updateResponse = await fetchWithRetry(updateUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(task),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          const errorMessage = parseGoogleApiError(updateResponse, errorText);
          throw new Error(errorMessage);
        }

        const updatedTask = await updateResponse.json();
        return {
          success: true,
          data: updatedTask,
        };
      }

      case 'complete': {
        const taskId = sanitizeString(config.taskId, 'Task ID');
        
        const updateUrl = `${baseUrl}/tasks/${taskId}`;
        const updateResponse = await fetchWithRetry(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'completed',
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          const errorMessage = parseGoogleApiError(updateResponse, errorText);
          throw new Error(errorMessage);
        }

        const completedTask = await updateResponse.json();
        return {
          success: true,
          data: completedTask,
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Tasks', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Google Tasks operation',
    };
  }
}

/**
 * Google Contacts Operations with Pagination
 */
export async function executeGoogleContactsOperation(
  supabase: any,
  userId: string,
  operation: string,
  config: Record<string, unknown>
): Promise<GoogleApiResponse> {
  try {
    logApiOperation('Contacts', operation, { userId });
    
    const accessToken = await getGoogleAccessToken(supabase, userId);
    if (!accessToken) {
      throw new Error('Google OAuth token not found. Please authenticate with Google first.');
    }

    switch (operation) {
      case 'list': {
        const maxResults = Math.min((config.maxResults as number) || 100, 2000);
        const pageToken = config.pageToken as string | undefined;
        
        let listUrl = `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=${maxResults}`;
        if (pageToken) {
          listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        const listResponse = await fetchWithRetry(listUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          const errorMessage = parseGoogleApiError(listResponse, errorText);
          throw new Error(errorMessage);
        }

        const data = await listResponse.json();
        const contacts = (data.connections || []).map((contact: any) => ({
          resourceName: contact.resourceName,
          name: contact.names?.[0]?.displayName || contact.names?.[0]?.givenName || '',
          email: contact.emailAddresses?.[0]?.value || '',
          phone: contact.phoneNumbers?.[0]?.value || '',
          organization: contact.organizations?.[0]?.name || '',
        }));

        return {
          success: true,
          data: {
            contacts,
            nextPageToken: data.nextPageToken,
            hasMore: !!data.nextPageToken,
            totalItems: data.totalItems,
          },
        };
      }

      case 'create': {
        const name = sanitizeString(config.name, 'Name', 200);
        const email = config.email as string;
        const phone = config.phone as string;

        if (!email) {
          throw new Error('Email is required for create');
        }

        if (!validateEmail(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }

        const contact: any = {
          names: [{ givenName: name }],
          emailAddresses: [{ value: email }],
        };
        
        if (phone) {
          contact.phoneNumbers = [{ value: phone }];
        }

        const createUrl = 'https://people.googleapis.com/v1/people:createContact';
        const createResponse = await fetchWithRetry(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contact),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          const errorMessage = parseGoogleApiError(createResponse, errorText);
          throw new Error(errorMessage);
        }

        const createdContact = await createResponse.json();
        return {
          success: true,
          data: {
            resourceName: createdContact.resourceName,
            name: createdContact.names?.[0]?.displayName || createdContact.names?.[0]?.givenName,
            email: createdContact.emailAddresses?.[0]?.value,
            phone: createdContact.phoneNumbers?.[0]?.value,
          },
        };
      }

      case 'update': {
        const contactId = sanitizeString(config.contactId, 'Contact ID');
        const name = config.name as string;
        const email = config.email as string;
        const phone = config.phone as string;

        const updateData: any = {};
        if (name) {
          updateData.names = [{ givenName: sanitizeString(name, 'Name', 200) }];
        }
        if (email) {
          if (!validateEmail(email)) {
            throw new Error(`Invalid email address: ${email}`);
          }
          updateData.emailAddresses = [{ value: email }];
        }
        if (phone) {
          updateData.phoneNumbers = [{ value: phone }];
        }

        if (Object.keys(updateData).length === 0) {
          throw new Error('At least one field (name, email, or phone) must be provided for update');
        }

        const updateUrl = `https://people.googleapis.com/v1/${contactId}:updateContact`;
        const updateResponse = await fetchWithRetry(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          const errorMessage = parseGoogleApiError(updateResponse, errorText);
          throw new Error(errorMessage);
        }

        const updatedContact = await updateResponse.json();
        return {
          success: true,
          data: updatedContact,
        };
      }

      case 'delete': {
        const contactId = sanitizeString(config.contactId, 'Contact ID');
        
        const deleteUrl = `https://people.googleapis.com/v1/${contactId}:deleteContact`;
        const deleteResponse = await fetchWithRetry(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!deleteResponse.ok && deleteResponse.status !== 200) {
          const errorText = await deleteResponse.text();
          const errorMessage = parseGoogleApiError(deleteResponse, errorText);
          throw new Error(errorMessage);
        }

        return {
          success: true,
          data: { deleted: true, contactId },
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    logApiOperation('Contacts', operation, { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Google Contacts operation',
    };
  }
}
