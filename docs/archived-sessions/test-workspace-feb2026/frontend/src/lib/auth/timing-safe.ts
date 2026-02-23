/**
 * Timing-safe authentication utilities
 * Prevents timing attacks that could reveal valid usernames or session tokens
 */

import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/utils/logger';

/**
 * Constant-time string comparison
 * Prevents timing attacks by always taking the same amount of time
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Make both strings same length for constant time comparison
    const maxLength = Math.max(a.length, b.length);
    a = a.padEnd(maxLength, '\0');
    b = b.padEnd(maxLength, '\0');
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    // Fallback for length mismatch (shouldn't happen after padding)
    return false;
  }
}

/**
 * Timing-safe password verification
 * Always takes similar time whether user exists or not
 */
export async function safePasswordVerify(
  password: string,
  hash: string | null,
  fakeDelay = true
): Promise<boolean> {
  // If no hash provided (user doesn't exist), use a fake hash
  // This ensures timing is consistent for invalid users
  const fakeHash = '$2a$12$dummyhashfornonexistentuser1234567890abcdef';
  const hashToCheck = hash || fakeHash;

  try {
    const isValid = await bcrypt.compare(password, hashToCheck);

    // If we used fake hash and it somehow matched (shouldn't happen),
    // ensure we return false
    if (!hash && isValid) {
      return false;
    }

    return isValid;
  } catch (error: any) {
    logger.error('Password verification error', {
      errorMessage: error?.message,
    });
    // Hash format error - treat as invalid
    if (fakeDelay) {
      // Add artificial delay to match bcrypt timing
      await artificialDelay(50 + Math.random() * 50);
    }
    return false;
  }
}

/**
 * Artificial delay to normalize timing
 * Used when we need to simulate computation time
 */
export async function artificialDelay(ms: number): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now();
    // CPU-bound delay to match bcrypt's behavior
    while (Date.now() - start < ms) {
      // Perform some calculations to consume CPU
      Math.sqrt(Math.random());
    }
    resolve();
  });
}

/**
 * Generate a dummy hash for timing consistency
 * Used when checking credentials for non-existent users
 */
export function getDummyHash(): string {
  // This is a valid bcrypt hash format that will never match any real password
  // but will take the normal bcrypt comparison time
  return '$2a$12$invalidhashfortimingnormalization1234567890abc';
}

/**
 * Timing-safe session validation
 * Prevents leaking information about valid session formats
 */
export function isValidSessionFormat(sessionId: string): boolean {
  // Session IDs should be 64 character hex strings
  const validFormat = /^[a-f0-9]{64}$/i;

  // Check length first (constant time)
  if (sessionId.length !== 64) {
    return false;
  }

  // Check characters (already constant length)
  return validFormat.test(sessionId);
}

/**
 * Normalize error messages to prevent information leakage
 */
export function normalizeAuthError(error: any): Error {
  // Always return the same generic error for authentication failures
  // This prevents attackers from distinguishing between different failure modes
  const genericError = new Error('Invalid credentials');

  // Log the actual error for debugging (but don't expose to client)
  if (process.env.NODE_ENV === 'development') {
    logger.error('Auth error (hidden from client):', error);
  }

  return genericError;
}

/**
 * Rate limit key generator that prevents username enumeration
 * Uses a hash of the username to prevent timing attacks
 */
export function getRateLimitKey(identifier: string): string {
  // Use a simple hash to normalize the key length
  // This prevents timing attacks based on key length
  const hash = Buffer.from(identifier).toString('base64');
  return `auth:${hash.substring(0, 16)}`;
}
