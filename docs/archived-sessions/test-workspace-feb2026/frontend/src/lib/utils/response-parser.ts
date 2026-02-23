/**
 * Safe response parsing utilities with comprehensive error logging
 * Helps diagnose JSON.parse errors by providing context and full response content
 */

/**
 * Safely parse JSON response with detailed error logging
 * Logs the actual response content before parsing to help diagnose parse errors
 */
import { logger } from '@/lib/utils/logger';

export async function safeParseJSON<T>(
  response: Response,
  context: {
    endpoint: string;
    method?: string;
    versionId?: number;
    scriptPath?: string;
  }
): Promise<T> {
  const { endpoint, method = 'GET', versionId, scriptPath } = context;

  // Log the request context
  logger.info(`[API] ${method} ${endpoint}`, {
    versionId,
    scriptPath,
    status: response.status,
    contentType: response.headers.get('content-type'),
  });

  // Check if response is OK
  if (!response.ok) {
    // Try to get response text for logging
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (e) {
      responseText = `[Could not read response body: ${e}]`;
    }

    logger.error(`[API Error] ${method} ${endpoint} - HTTP ${response.status}`, {
      versionId,
      scriptPath,
      status: response.status,
      contentType: response.headers.get('content-type'),
      responseLength: responseText.length,
      responseSample: responseText.substring(0, 200),
      fullResponse: responseText, // Log full response for debugging
    });

    // Determine error message
    let errorMessage = `HTTP ${response.status}`;
    try {
      // Try to parse error response as JSON
      const errorData = JSON.parse(responseText);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If JSON parse fails, just use the response text
      if (responseText) {
        errorMessage = `HTTP ${response.status}: ${responseText.substring(0, 100)}`;
      }
    }

    throw new Error(errorMessage);
  }

  // Get content type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const responseText = await response.text();
    logger.error(`[API Error] ${method} ${endpoint} - Invalid content type`, {
      contentType,
      responseLength: responseText.length,
      responseSample: responseText.substring(0, 200),
      fullResponse: responseText,
    });

    throw new Error(
      `Expected JSON response but got ${contentType}. Response: ${responseText.substring(0, 200)}`
    );
  }

  // Get response text for logging
  const responseText = await response.text();

  // Check if response is empty
  if (!responseText) {
    logger.error(`[API Error] ${method} ${endpoint} - Empty response body`, {
      versionId,
      scriptPath,
    });
    throw new Error('Empty response body received from server');
  }

  // Try to parse JSON
  try {
    logger.info(`[API Success] ${method} ${endpoint}`, {
      versionId,
      scriptPath,
      responseLength: responseText.length,
    });

    const data = JSON.parse(responseText) as T;
    return data;
  } catch (parseError) {
    logger.error(`[API Error] ${method} ${endpoint} - JSON parse failed`, {
      versionId,
      scriptPath,
      parseError: parseError instanceof Error ? parseError.message : String(parseError),
      responseLength: responseText.length,
      responseSample: responseText.substring(0, 500), // Larger sample for parse errors
      fullResponse: responseText, // Log full response for debugging
    });

    // Provide detailed error message
    const firstLineBreak = responseText.indexOf('\n');
    const firstLine =
      firstLineBreak > 0
        ? responseText.substring(0, firstLineBreak)
        : responseText.substring(0, 100);

    throw new Error(
      `Failed to parse JSON response from ${endpoint}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}\n` +
        `Response starts with: ${firstLine}`
    );
  }
}

/**
 * Fetch with automatic JSON parsing and error logging
 */
export async function fetchJSON<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    versionId?: number;
    scriptPath?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = 'GET', body, versionId, scriptPath, headers = {} } = options;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, fetchOptions);

  return safeParseJSON<T>(response, {
    endpoint,
    method,
    versionId,
    scriptPath,
  });
}
