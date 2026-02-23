/**
 * TOTP Secret Encryption Service
 *
 * Uses AES-256-GCM to encrypt TOTP secrets before storing in database.
 * TOTP secrets MUST be encrypted (not hashed) because we need to recover
 * the original secret to verify codes.
 */
import crypto from 'crypto';
import { logger } from '@/lib/utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Must be 32 bytes (64 hex characters)
 * Generate with: openssl rand -hex 32
 */
function getEncryptionKey(): Buffer {
  const key = process.env.TOTP_ENCRYPTION_KEY;

  if (!key) {
    // In development, use a deterministic key (NOT for production!)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[TOTP] Using development encryption key - NOT FOR PRODUCTION');
      return Buffer.from('0'.repeat(64), 'hex');
    }
    throw new Error('TOTP_ENCRYPTION_KEY environment variable not set');
  }

  if (key.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a TOTP secret for database storage
 * @param secret - The Base32 TOTP secret from otplib
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex)
 */
export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a TOTP secret from database
 * @param encryptedData - The encrypted string from database
 * @returns The original Base32 TOTP secret
 */
export function decryptTotpSecret(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const ciphertext = parts[2];

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted data: missing components');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash a value for non-sensitive lookups (e.g., used token tracking)
 * This is NOT for secrets - just for deduplication
 */
export function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
