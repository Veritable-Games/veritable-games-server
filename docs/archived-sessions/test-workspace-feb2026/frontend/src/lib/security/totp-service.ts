/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Implements RFC 6238 TOTP authentication using otplib.
 * Provides setup, verification, and backup code functionality.
 */
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { encryptTotpSecret, decryptTotpSecret, hashForLookup } from './totp-encryption';
import { dbAdapter } from '@/lib/database/adapter';

// Configure otplib
authenticator.options = {
  window: 1, // Allow +/- 30 seconds for clock drift
  step: 30, // 30-second intervals (standard)
};

const ISSUER = 'Veritable Games';
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface BackupCodesResult {
  codes: string[];
  count: number;
}

export class TotpService {
  /**
   * Check if a user has 2FA enabled
   */
  async isEnabled(userId: number): Promise<boolean> {
    const result = await dbAdapter.query<{ is_enabled: boolean }>(
      `SELECT is_enabled FROM users.two_factor_totp WHERE user_id = ? AND is_enabled = true`,
      [userId],
      { schema: 'users' }
    );
    const row = result.rows[0];
    return result.rows.length > 0 && row !== undefined && row.is_enabled;
  }

  /**
   * Get 2FA status for a user (for UI display)
   */
  async getStatus(userId: number): Promise<{
    enabled: boolean;
    verifiedAt: Date | null;
    backupCodesRemaining: number;
  }> {
    const [totpResult, backupResult] = await Promise.all([
      dbAdapter.query<{ is_enabled: boolean; verified_at: string | null }>(
        `SELECT is_enabled, verified_at FROM users.two_factor_totp WHERE user_id = ?`,
        [userId],
        { schema: 'users' }
      ),
      dbAdapter.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users.backup_codes WHERE user_id = ? AND used_at IS NULL`,
        [userId],
        { schema: 'users' }
      ),
    ]);

    const totp = totpResult.rows.length > 0 ? totpResult.rows[0] : null;
    const backupRow = backupResult.rows.length > 0 ? backupResult.rows[0] : null;
    const backupCount = parseInt(backupRow?.count ?? '0', 10);

    return {
      enabled: totp?.is_enabled ?? false,
      verifiedAt: totp?.verified_at ? new Date(totp.verified_at) : null,
      backupCodesRemaining: backupCount,
    };
  }

  /**
   * Initialize 2FA setup for a user
   * Returns secret and QR code, but doesn't enable 2FA yet
   * User must verify with a valid token to complete setup
   */
  async initializeSetup(userId: number, email: string): Promise<TotpSetupResult> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store encrypted secret but don't enable yet
    const encrypted = encryptTotpSecret(secret);

    await dbAdapter.query(
      `INSERT INTO users.two_factor_totp (user_id, encrypted_secret, is_enabled)
       VALUES (?, ?, false)
       ON CONFLICT (user_id)
       DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret, is_enabled = false, updated_at = NOW()`,
      [userId, encrypted],
      { schema: 'users' }
    );

    return { secret, qrCodeDataUrl, otpauthUrl };
  }

  /**
   * Verify setup and enable 2FA
   * User must provide a valid token to prove they've set up their authenticator
   */
  async verifyAndEnable(
    userId: number,
    token: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate token format
    if (!token || !/^\d{6}$/.test(token)) {
      return { success: false, error: 'Invalid token format. Must be 6 digits.' };
    }

    const result = await dbAdapter.query<{ encrypted_secret: string }>(
      `SELECT encrypted_secret FROM users.two_factor_totp WHERE user_id = ? AND is_enabled = false`,
      [userId],
      { schema: 'users' }
    );

    const setupRow = result.rows[0];
    if (!setupRow) {
      return { success: false, error: 'No pending 2FA setup found. Please start setup again.' };
    }

    const secret = decryptTotpSecret(setupRow.encrypted_secret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      return { success: false, error: 'Invalid verification code. Please try again.' };
    }

    // Enable 2FA
    await dbAdapter.query(
      `UPDATE users.two_factor_totp SET is_enabled = true, verified_at = NOW(), updated_at = NOW() WHERE user_id = ?`,
      [userId],
      { schema: 'users' }
    );

    await dbAdapter.query(
      `UPDATE users.users SET two_factor_enabled = true WHERE id = ?`,
      [userId],
      { schema: 'users' }
    );

    return { success: true };
  }

  /**
   * Verify a TOTP token during login
   */
  async verifyToken(userId: number, token: string): Promise<{ success: boolean; error?: string }> {
    // Validate token format
    if (!token || !/^\d{6}$/.test(token)) {
      return { success: false, error: 'Invalid token format' };
    }

    // Check rate limiting
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Too many attempts. Please wait ${rateLimitCheck.waitMinutes} minutes.`,
      };
    }

    // Get TOTP secret
    const result = await dbAdapter.query<{ encrypted_secret: string }>(
      `SELECT encrypted_secret FROM users.two_factor_totp WHERE user_id = ? AND is_enabled = true`,
      [userId],
      { schema: 'users' }
    );

    if (result.rows.length === 0) {
      return { success: false, error: '2FA not enabled for this account' };
    }

    // Check for replay attack
    const tokenHash = hashForLookup(token);
    const windowStart = new Date(Math.floor(Date.now() / 30000) * 30000);

    const usedCheck = await dbAdapter.query(
      `SELECT 1 FROM users.totp_used_tokens WHERE user_id = ? AND token_hash = ?`,
      [userId, tokenHash],
      { schema: 'users' }
    );

    if (usedCheck.rows.length > 0) {
      await this.recordAttempt(userId, 'totp', false);
      return {
        success: false,
        error: 'This code has already been used. Please wait for a new code.',
      };
    }

    // Verify token
    const row = result.rows[0];
    if (!row) {
      return { success: false, error: '2FA configuration not found' };
    }
    const secret = decryptTotpSecret(row.encrypted_secret);
    const isValid = authenticator.verify({ token, secret });

    await this.recordAttempt(userId, 'totp', isValid);

    if (isValid) {
      // Mark token as used (replay prevention)
      await dbAdapter.query(
        `INSERT INTO users.totp_used_tokens (user_id, token_hash, window_start)
         VALUES (?, ?, ?)
         ON CONFLICT DO NOTHING`,
        [userId, tokenHash, windowStart.toISOString()],
        { schema: 'users' }
      );

      // Cleanup old tokens (older than 2 minutes)
      await dbAdapter.query(
        `DELETE FROM users.totp_used_tokens WHERE window_start < NOW() - INTERVAL '2 minutes'`,
        [],
        { schema: 'users' }
      );

      return { success: true };
    }

    return { success: false, error: 'Invalid verification code' };
  }

  /**
   * Generate 10 backup codes for a user
   */
  async generateBackupCodes(userId: number): Promise<BackupCodesResult> {
    // Delete existing unused codes
    await dbAdapter.query(
      `DELETE FROM users.backup_codes WHERE user_id = ? AND used_at IS NULL`,
      [userId],
      { schema: 'users' }
    );

    const codes: string[] = [];

    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric code (format: XXXX-XXXX)
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const code = `${part1}-${part2}`;

      const hash = await bcrypt.hash(code, 10);

      await dbAdapter.query(
        `INSERT INTO users.backup_codes (user_id, code_hash) VALUES (?, ?)`,
        [userId, hash],
        { schema: 'users' }
      );

      codes.push(code);
    }

    return { codes, count: codes.length };
  }

  /**
   * Verify and consume a backup code
   */
  async verifyBackupCode(
    userId: number,
    code: string
  ): Promise<{ success: boolean; error?: string; remainingCodes?: number }> {
    // Normalize code (remove dashes, uppercase)
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4, 8)}`;

    // Check rate limiting
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Too many attempts. Please wait ${rateLimitCheck.waitMinutes} minutes.`,
      };
    }

    // Get unused backup codes
    const result = await dbAdapter.query<{ id: number; code_hash: string }>(
      `SELECT id, code_hash FROM users.backup_codes WHERE user_id = ? AND used_at IS NULL`,
      [userId],
      { schema: 'users' }
    );

    for (const row of result.rows) {
      if (await bcrypt.compare(formattedCode, row.code_hash)) {
        // Mark as used
        await dbAdapter.query(
          `UPDATE users.backup_codes SET used_at = NOW() WHERE id = ?`,
          [row.id],
          { schema: 'users' }
        );

        await this.recordAttempt(userId, 'backup', true);

        // Count remaining codes
        const remaining = await dbAdapter.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM users.backup_codes WHERE user_id = ? AND used_at IS NULL`,
          [userId],
          { schema: 'users' }
        );

        const remainingRow = remaining.rows.length > 0 ? remaining.rows[0] : null;
        return {
          success: true,
          remainingCodes: parseInt(remainingRow?.count ?? '0', 10),
        };
      }
    }

    await this.recordAttempt(userId, 'backup', false);
    return { success: false, error: 'Invalid backup code' };
  }

  /**
   * Disable 2FA for a user
   * Requires current password verification (handled by caller)
   */
  async disable(userId: number): Promise<void> {
    await dbAdapter.query(`DELETE FROM users.two_factor_totp WHERE user_id = ?`, [userId], {
      schema: 'users',
    });

    await dbAdapter.query(`DELETE FROM users.backup_codes WHERE user_id = ?`, [userId], {
      schema: 'users',
    });

    await dbAdapter.query(`DELETE FROM users.totp_used_tokens WHERE user_id = ?`, [userId], {
      schema: 'users',
    });

    await dbAdapter.query(
      `UPDATE users.users SET two_factor_enabled = false WHERE id = ?`,
      [userId],
      { schema: 'users' }
    );
  }

  /**
   * Check if user is rate limited
   */
  private async checkRateLimit(
    userId: number
  ): Promise<{ allowed: boolean; waitMinutes?: number }> {
    const result = await dbAdapter.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users.two_factor_attempts
       WHERE user_id = ? AND success = false AND attempt_at > NOW() - INTERVAL '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
      [userId],
      { schema: 'users' }
    );

    const failedAttempts = parseInt(result.rows[0]?.count || '0', 10);

    if (failedAttempts >= RATE_LIMIT_ATTEMPTS) {
      return { allowed: false, waitMinutes: RATE_LIMIT_WINDOW_MINUTES };
    }

    return { allowed: true };
  }

  /**
   * Record an authentication attempt
   */
  private async recordAttempt(
    userId: number,
    method: 'totp' | 'backup',
    success: boolean
  ): Promise<void> {
    await dbAdapter.query(
      `INSERT INTO users.two_factor_attempts (user_id, method, success) VALUES (?, ?, ?)`,
      [userId, method, success],
      { schema: 'users' }
    );
  }
}

// Singleton instance
export const totpService = new TotpService();
