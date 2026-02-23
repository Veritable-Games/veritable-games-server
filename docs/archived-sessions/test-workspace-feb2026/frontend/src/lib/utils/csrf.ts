/**
 * CSRF Token Utilities
 *
 * Provides helper functions for including CSRF tokens in API requests.
 * Works with the double submit cookie pattern implemented in the backend.
 *
 * Usage:
 *   import { fetchWithCSRF, getCSRFToken } from '@/lib/utils/csrf';
 *
 *   // Automatic CSRF token inclusion
 *   const response = await fetchWithCSRF('/api/forums/topics', {
 *     method: 'POST',
 *     body: JSON.stringify(data),
 *   });
 *
 *   // Manual token retrieval
 *   const token = getCSRFToken();
 */

import { logger } from '@/lib/utils/logger';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Get CSRF token from cookies
 *
 * @returns CSRF token string or null if not found
 */
export function getCSRFToken(): string | null {
  // Only run on client side
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split('; ');
  const csrfCookie = cookies.find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!csrfCookie) {
    return null;
  }

  // Return the value after '=' or null if undefined
  return csrfCookie.split('=')[1] || null;
}

/**
 * Fetch wrapper that automatically includes CSRF token for state-changing requests
 *
 * @param url - Request URL
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Promise resolving to Response
 *
 * @example
 * // POST request with CSRF token
 * const response = await fetchWithCSRF('/api/forums/topics', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ title, content }),
 * });
 *
 * @example
 * // GET request (CSRF not needed, but still works)
 * const response = await fetchWithCSRF('/api/forums/topics');
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  const needsCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (needsCSRF) {
    const token = getCSRFToken();

    if (!token) {
      logger.warn('CSRF token not found in cookies. Request may fail.');
      logger.info('Available cookies:', document.cookie);
    } else {
      logger.info(`[fetchWithCSRF] Adding CSRF token to headers: ${token.substring(0, 10)}...`);
    }

    // Add CSRF token to headers
    options.headers = {
      ...options.headers,
      ...(token ? { [CSRF_HEADER_NAME]: token } : {}),
    };
  }

  // CRITICAL: Include credentials to send cookies (session, CSRF, etc.)
  options.credentials = 'include';

  return fetch(url, options);
}

/**
 * Enhanced fetch with CSRF + JSON handling
 *
 * Automatically:
 * - Adds CSRF token for state-changing requests
 * - Sets Content-Type: application/json
 * - Parses JSON response
 * - Throws on HTTP errors
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise resolving to parsed JSON data
 *
 * @example
 * try {
 *   const data = await fetchJSON('/api/forums/topics', {
 *     method: 'POST',
 *     body: { title: 'Test', content: 'Hello' },
 *   });
 *   logger.info('Created topic:', data);
 * } catch (error) {
 *   logger.error('Failed to create topic:', error);
 * }
 */
export async function fetchJSON<T = any>(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    cache?: RequestCache;
  } = {}
): Promise<T> {
  const { body, headers = {}, cache, ...otherOptions } = options;

  // Handle FormData specially - don't set Content-Type or stringify
  const isFormData = body instanceof FormData;

  const response = await fetchWithCSRF(url, {
    ...otherOptions,
    cache: cache || 'no-store',
    headers: isFormData
      ? headers // Let browser set Content-Type for FormData
      : {
          'Content-Type': 'application/json',
          ...headers,
        },
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // Get response text for debugging
    const responseText = await response.text();
    let errorData: any = {};

    // Try to parse as JSON
    if (responseText) {
      try {
        errorData = JSON.parse(responseText);
      } catch (parseErr) {
        logger.error('Failed to parse error response as JSON:', responseText);
      }
    }

    // Log error details (use logger.warn for client errors 4xx, logger.error for server errors 5xx)
    const isClientError = response.status >= 400 && response.status < 500;
    const logFn = isClientError ? logger.warn.bind(logger) : logger.error.bind(logger);

    logFn(
      `[fetchJSON] ${isClientError ? 'Validation' : 'Server'} error ${response.status} from ${url}`
    );

    // Only log detailed info for actual server errors, not validation errors
    if (!isClientError) {
      logger.error('Response text:', responseText);
      logger.error('Parsed error data:', errorData);
      if (errorData && typeof errorData === 'object') {
        logger.error('Error structure:', {
          hasError: 'error' in errorData,
          errorType: errorData.error ? typeof errorData.error : 'N/A',
          hasDetails:
            errorData.error && typeof errorData.error === 'object' && 'details' in errorData.error,
          details: typeof errorData.error === 'object' ? errorData.error?.details : undefined,
        });
      }
    }

    // Extract error message from nested structure
    let errorMessage = '';

    if (errorData.error && typeof errorData.error === 'object') {
      // Handle nested error structure: { error: { message: '...', details: {...} } }
      errorMessage = errorData.error.message || errorData.error.code || 'Unknown error';

      // Append field-specific validation errors if available
      if (errorData.error.details && typeof errorData.error.details === 'object') {
        const fieldErrors = Object.entries(errorData.error.details)
          .map(([field, errors]) => {
            if (Array.isArray(errors)) {
              return `${field}: ${errors.join(', ')}`;
            }
            return `${field}: ${errors}`;
          })
          .join('; ');

        if (fieldErrors) {
          errorMessage += ` - ${fieldErrors}`;
        }
      }
    } else if (errorData.message) {
      // Handle flat structure: { message: '...' }
      errorMessage = errorData.message;
    } else if (typeof errorData.error === 'string') {
      // Handle string error: { error: '...' }
      errorMessage = errorData.error;
    } else if (responseText) {
      // Use raw response text if available
      errorMessage = responseText;
    } else {
      // Fallback to HTTP status
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Check if CSRF token is available
 *
 * @returns true if CSRF token exists in cookies
 */
export function hasCSRFToken(): boolean {
  return getCSRFToken() !== null;
}

/**
 * Wait for CSRF token to be available (useful for initial page load)
 *
 * @param timeout - Maximum wait time in milliseconds (default: 5000)
 * @returns Promise resolving to token or null on timeout
 */
export async function waitForCSRFToken(timeout: number = 5000): Promise<string | null> {
  const startTime = Date.now();

  return new Promise(resolve => {
    const checkToken = () => {
      const token = getCSRFToken();

      if (token) {
        resolve(token);
        return;
      }

      if (Date.now() - startTime > timeout) {
        logger.warn('CSRF token not found after timeout');
        resolve(null);
        return;
      }

      // Check again in 100ms
      setTimeout(checkToken, 100);
    };

    checkToken();
  });
}

/**
 * React hook for CSRF token
 *
 * @returns CSRF token string or null
 *
 * @example
 * function MyComponent() {
 *   const csrfToken = useCSRFToken();
 *
 *   const handleSubmit = async () => {
 *     if (!csrfToken) {
 *       logger.error('No CSRF token available');
 *       return;
 *     }
 *
 *     await fetch('/api/data', {
 *       method: 'POST',
 *       headers: { 'x-csrf-token': csrfToken },
 *     });
 *   };
 * }
 */
export function useCSRFToken(): string | null {
  // This is a simple implementation - for React 19 we could use useSyncExternalStore
  if (typeof window === 'undefined') {
    return null;
  }

  return getCSRFToken();
}
