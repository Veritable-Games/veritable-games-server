/**
 * Safe Promise Utilities
 *
 * Utilities for handling promises safely without throwing errors
 */

/**
 * Safely parse JSON from a response, returning fallback on error
 */
import { logger } from '@/lib/utils/logger';

export async function safeJsonParse<T = any>(
  response: Response,
  fallback: T | null = null
): Promise<T | null> {
  try {
    if (!response.ok) {
      return fallback;
    }
    const text = await response.text();
    if (!text) {
      return fallback;
    }
    return JSON.parse(text);
  } catch (error) {
    logger.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Safely execute a promise with error handling
 */
export async function safePromise<T>(
  promise: Promise<T> | (() => Promise<T>),
  fallback?: T
): Promise<T | undefined> {
  try {
    if (typeof promise === 'function') {
      const result = promise();
      // Check if the function returned a promise
      if (result && typeof result.then === 'function') {
        return await result;
      } else {
        // If function didn't return a promise, reject
        throw new Error('Function did not return a promise');
      }
    }
    // Ensure promise is not undefined/null
    if (!promise) {
      throw new Error('Promise is undefined or null');
    }
    return await promise;
  } catch (error) {
    logger.warn('Promise execution failed:', error);
    return fallback;
  }
}

/**
 * Wrap a function to ensure it always returns a promise
 */
export function ensurePromise<T>(fn: (() => T | Promise<T>) | T | Promise<T>): Promise<T> {
  try {
    if (typeof fn === 'function') {
      const result = (fn as () => T | Promise<T>)();
      // Ensure result is not undefined/null before resolving
      if (result === undefined || result === null) {
        return Promise.reject(new Error('Function returned undefined or null'));
      }
      return Promise.resolve(result);
    }
    // Ensure fn is not undefined/null before resolving
    if (fn === undefined || fn === null) {
      return Promise.reject(new Error('Value is undefined or null'));
    }
    return Promise.resolve(fn as T);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Safe catch handler that always returns a valid value
 */
export function safeCatch<T>(fallback: T) {
  return (error: any): T => {
    logger.warn('Caught error:', error);
    return fallback;
  };
}
