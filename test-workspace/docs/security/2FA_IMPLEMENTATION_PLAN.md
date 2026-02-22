# Two-Factor Authentication (2FA) Implementation Plan

**Last Updated**: November 29, 2025
**Status**: Planning Phase
**Cost**: $0 (Free solutions only)

---

## Executive Summary

This document outlines the implementation plan for adding two-factor authentication (2FA) to Veritable Games using **entirely free, open-source solutions**. We are deliberately avoiding SMS-based authentication due to both cost and security concerns.

### Chosen Approach

| Method | Library | Cost | Security Level |
|--------|---------|------|----------------|
| **TOTP (Authenticator Apps)** | `otplib` | Free | High |
| **WebAuthn/Passkeys** | `@simplewebauthn` | Free | Highest |
| **Backup Codes** | Built-in | Free | Medium (recovery only) |

### What We're NOT Implementing

| Method | Reason |
|--------|--------|
| SMS Codes | Requires paid SMS gateway (Twilio ~$0.0075/msg), security vulnerabilities (SIM swapping, SS7 attacks), NIST RESTRICTED status |
| Email Codes | Already have email; adds friction without meaningful security improvement |
| Voice Calls | Requires paid telephony API |

---

## Part 1: Research Findings

### 1.1 TOTP Libraries Evaluated

#### otplib (Recommended)
- **Repository**: https://github.com/yeojz/otplib
- **npm**: `otplib` (380k weekly downloads)
- **Status**: Actively maintained (last update: 2024)
- **TypeScript**: Full support with `@types/otplib`
- **Dependencies**: Zero external dependencies
- **Bundle Size**: ~5KB gzipped
- **Standards**: RFC 4226 (HOTP), RFC 6238 (TOTP)

```typescript
import { authenticator } from 'otplib';

// Generate secret for new user
const secret = authenticator.generateSecret(); // Base32, 20 bytes

// Generate URI for QR code
const otpauth = authenticator.keyuri(
  'user@example.com',
  'Veritable Games',
  secret
);
// otpauth://totp/Veritable%20Games:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Veritable%20Games

// Verify token with time window tolerance
const isValid = authenticator.verify({
  token: '123456',
  secret: secret,
  window: 1  // ±30 seconds tolerance for clock drift
});
```

#### speakeasy (NOT Recommended)
- **Repository**: https://github.com/speakeasyjs/speakeasy
- **Status**: ABANDONED - No updates since 2017
- **Security**: Unpatched vulnerabilities
- **Verdict**: Do not use

#### node-2fa (Alternative)
- **Repository**: https://github.com/nicb/node-2fa
- **Status**: Minimal maintenance
- **Verdict**: Use otplib instead

### 1.2 WebAuthn/Passkeys Libraries

#### @simplewebauthn (Recommended)
- **Repository**: https://github.com/MasterKale/SimpleWebAuthn
- **Packages**:
  - `@simplewebauthn/server` (backend)
  - `@simplewebauthn/browser` (frontend)
- **Status**: Actively maintained, excellent documentation
- **TypeScript**: Native support
- **Standards**: WebAuthn Level 2, FIDO2

```typescript
// Server: Generate registration options
import { generateRegistrationOptions } from '@simplewebauthn/server';

const options = await generateRegistrationOptions({
  rpName: 'Veritable Games',
  rpID: 'veritablegames.com',
  userID: new TextEncoder().encode(user.id.toString()),
  userName: user.email,
  attestationType: 'none',
  authenticatorSelection: {
    residentKey: 'preferred',
    userVerification: 'preferred',
  },
});

// Browser: Create credential
import { startRegistration } from '@simplewebauthn/browser';

const credential = await startRegistration(options);
// Send credential to server for verification
```

### 1.3 QR Code Generation

#### qrcode (Recommended)
- **npm**: `qrcode` (2.5M weekly downloads)
- **Purpose**: Generate QR codes for TOTP setup

```typescript
import QRCode from 'qrcode';

// Generate QR code as data URL for display in browser
const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
// Returns: data:image/png;base64,...

// Or generate as SVG string
const qrSvg = await QRCode.toString(otpauthUrl, { type: 'svg' });
```

### 1.4 Why Not SMS?

#### Cost Barrier
Every SMS message requires a paid gateway:

| Provider | Cost per SMS (US) | Cost per 1000 users/month |
|----------|-------------------|---------------------------|
| Twilio | $0.0079 | $7.90+ |
| AWS SNS | $0.00645 | $6.45+ |
| Plivo | $0.005 | $5.00+ |
| Vonage | $0.0068 | $6.80+ |

**Note**: These costs scale with user base and assume only 1 SMS per user per month. Real usage (failed attempts, re-authentication) would be 3-5x higher.

#### Security Vulnerabilities

1. **SIM Swapping**: Attacker convinces carrier to transfer victim's number
   - Documented in high-profile cryptocurrency thefts
   - Success rate: ~50% of social engineering attempts

2. **SS7 Protocol Attacks**: Intercept SMS at network level
   - Requires sophisticated attacker but well-documented
   - No user action can prevent this

3. **Number Recycling**: Old numbers reassigned to new users
   - Carriers recycle numbers after 90 days
   - New owner receives old user's 2FA codes

4. **NIST Guidelines**: SP 800-63B rates SMS as "RESTRICTED"
   - Should not be only factor
   - Better alternatives exist (TOTP, WebAuthn)

#### Our Decision

**Skip SMS entirely.** The security weaknesses combined with ongoing costs make it a poor choice when free, more secure alternatives exist.

---

## Part 2: Implementation Plan

### Phase 1: Database Schema (Week 1)

Create the following tables in the `users` schema:

```sql
-- TOTP secrets (encrypted, not hashed!)
CREATE TABLE users.two_factor_totp (
  user_id INTEGER PRIMARY KEY REFERENCES users.users(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,      -- AES-256-GCM encrypted Base32 secret
  is_enabled BOOLEAN DEFAULT false,    -- Only true after verification
  verified_at TIMESTAMPTZ,             -- When user completed setup
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One-time backup codes (hashed like passwords)
CREATE TABLE users.backup_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,             -- bcrypt hashed (one-time use, can be hashed)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,                 -- NULL = unused, timestamp = used
  CONSTRAINT unique_code_per_user UNIQUE (user_id, code_hash)
);

-- Track used TOTP tokens to prevent replay attacks
CREATE TABLE users.totp_used_tokens (
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,            -- SHA-256 of token (not sensitive, just dedup)
  window_start TIMESTAMPTZ NOT NULL,   -- 30-second window this token belongs to
  PRIMARY KEY (user_id, token_hash)
);

-- Cleanup job: delete tokens older than 2 minutes
CREATE INDEX idx_totp_used_tokens_cleanup ON users.totp_used_tokens(window_start);

-- WebAuthn credentials (passkeys)
CREATE TABLE users.webauthn_credentials (
  id TEXT PRIMARY KEY,                 -- Credential ID from authenticator
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  public_key BYTEA NOT NULL,           -- Public key for verification
  counter INTEGER DEFAULT 0,           -- Replay attack prevention
  device_type TEXT,                    -- 'singleDevice' or 'multiDevice'
  backed_up BOOLEAN DEFAULT false,     -- Is credential backed up to cloud
  transports TEXT[],                   -- ['usb', 'ble', 'nfc', 'internal']
  friendly_name TEXT,                  -- User-provided name ("My iPhone")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_webauthn_user ON users.webauthn_credentials(user_id);

-- Rate limiting for 2FA attempts
CREATE TABLE users.two_factor_attempts (
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  attempt_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  method TEXT NOT NULL,                -- 'totp', 'backup', 'webauthn'
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_2fa_attempts_user_time ON users.two_factor_attempts(user_id, attempt_at);

-- User 2FA preferences
ALTER TABLE users.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users.users ADD COLUMN IF NOT EXISTS preferred_2fa_method TEXT DEFAULT 'totp';
```

### Phase 2: TOTP Implementation (Week 2)

#### 2.1 Secret Encryption Service

**Critical**: TOTP secrets must be **encrypted**, not hashed. We need to recover the original secret to verify codes.

```typescript
// frontend/src/lib/security/totp-encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Key must be 32 bytes for AES-256
// Generate once: openssl rand -hex 32
const ENCRYPTION_KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, 'hex');

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptTotpSecret(encryptedData: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedData.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### 2.2 TOTP Service

```typescript
// frontend/src/lib/security/totp-service.ts
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { encryptTotpSecret, decryptTotpSecret } from './totp-encryption';
import { dbAdapter } from '@/lib/database/adapter';

// Configure otplib
authenticator.options = {
  window: 1,  // Allow ±30 seconds for clock drift
  step: 30,   // 30-second intervals (standard)
};

export class TotpService {
  /**
   * Initialize 2FA setup for a user
   * Returns secret and QR code, but doesn't enable 2FA yet
   */
  async initializeSetup(userId: number, email: string): Promise<{
    secret: string;
    qrCodeDataUrl: string;
    otpauthUrl: string;
  }> {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'Veritable Games', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store encrypted secret but don't enable yet
    const encrypted = encryptTotpSecret(secret);

    await dbAdapter.runQuery(`
      INSERT INTO users.two_factor_totp (user_id, encrypted_secret, is_enabled)
      VALUES ($1, $2, false)
      ON CONFLICT (user_id)
      DO UPDATE SET encrypted_secret = $2, is_enabled = false, updated_at = NOW()
    `, [userId, encrypted]);

    return { secret, qrCodeDataUrl, otpauthUrl };
  }

  /**
   * Verify setup and enable 2FA
   * User must provide a valid token to prove they've set up their authenticator
   */
  async verifyAndEnable(userId: number, token: string): Promise<boolean> {
    const row = await dbAdapter.getQuery(`
      SELECT encrypted_secret FROM users.two_factor_totp
      WHERE user_id = $1 AND is_enabled = false
    `, [userId]);

    if (!row) return false;

    const secret = decryptTotpSecret(row.encrypted_secret);
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      await dbAdapter.runQuery(`
        UPDATE users.two_factor_totp
        SET is_enabled = true, verified_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);

      await dbAdapter.runQuery(`
        UPDATE users.users SET two_factor_enabled = true WHERE id = $1
      `, [userId]);

      // Generate backup codes
      await this.generateBackupCodes(userId);

      return true;
    }

    return false;
  }

  /**
   * Verify a TOTP token during login
   */
  async verifyToken(userId: number, token: string): Promise<boolean> {
    // Check rate limiting first
    if (await this.isRateLimited(userId)) {
      throw new Error('Too many attempts. Please wait 15 minutes.');
    }

    const row = await dbAdapter.getQuery(`
      SELECT encrypted_secret FROM users.two_factor_totp
      WHERE user_id = $1 AND is_enabled = true
    `, [userId]);

    if (!row) return false;

    // Check for replay attack
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const windowStart = new Date(Math.floor(Date.now() / 30000) * 30000);

    const used = await dbAdapter.getQuery(`
      SELECT 1 FROM users.totp_used_tokens
      WHERE user_id = $1 AND token_hash = $2
    `, [userId, tokenHash]);

    if (used) {
      await this.recordAttempt(userId, 'totp', false);
      return false; // Replay attack detected
    }

    const secret = decryptTotpSecret(row.encrypted_secret);
    const isValid = authenticator.verify({ token, secret });

    await this.recordAttempt(userId, 'totp', isValid);

    if (isValid) {
      // Mark token as used
      await dbAdapter.runQuery(`
        INSERT INTO users.totp_used_tokens (user_id, token_hash, window_start)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [userId, tokenHash, windowStart]);

      // Cleanup old tokens (older than 2 minutes)
      await dbAdapter.runQuery(`
        DELETE FROM users.totp_used_tokens
        WHERE window_start < NOW() - INTERVAL '2 minutes'
      `);
    }

    return isValid;
  }

  /**
   * Generate 10 backup codes
   */
  async generateBackupCodes(userId: number): Promise<string[]> {
    // Delete existing unused codes
    await dbAdapter.runQuery(`
      DELETE FROM users.backup_codes WHERE user_id = $1 AND used_at IS NULL
    `, [userId]);

    const codes: string[] = [];
    const bcrypt = await import('bcrypt');

    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const hash = await bcrypt.hash(code, 10);

      await dbAdapter.runQuery(`
        INSERT INTO users.backup_codes (user_id, code_hash)
        VALUES ($1, $2)
      `, [userId, hash]);

      codes.push(code);
    }

    return codes;
  }

  /**
   * Verify and consume a backup code
   */
  async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    if (await this.isRateLimited(userId)) {
      throw new Error('Too many attempts. Please wait 15 minutes.');
    }

    const bcrypt = await import('bcrypt');
    const rows = await dbAdapter.allQuery(`
      SELECT id, code_hash FROM users.backup_codes
      WHERE user_id = $1 AND used_at IS NULL
    `, [userId]);

    for (const row of rows) {
      if (await bcrypt.compare(code.toUpperCase(), row.code_hash)) {
        // Mark as used
        await dbAdapter.runQuery(`
          UPDATE users.backup_codes SET used_at = NOW() WHERE id = $1
        `, [row.id]);

        await this.recordAttempt(userId, 'backup', true);
        return true;
      }
    }

    await this.recordAttempt(userId, 'backup', false);
    return false;
  }

  /**
   * Check if user is rate limited (5 failed attempts in 15 minutes)
   */
  private async isRateLimited(userId: number): Promise<boolean> {
    const result = await dbAdapter.getQuery(`
      SELECT COUNT(*) as count FROM users.two_factor_attempts
      WHERE user_id = $1
        AND success = false
        AND attempt_at > NOW() - INTERVAL '15 minutes'
    `, [userId]);

    return result.count >= 5;
  }

  /**
   * Record an authentication attempt
   */
  private async recordAttempt(
    userId: number,
    method: string,
    success: boolean
  ): Promise<void> {
    await dbAdapter.runQuery(`
      INSERT INTO users.two_factor_attempts (user_id, method, success)
      VALUES ($1, $2, $3)
    `, [userId, method, success]);
  }

  /**
   * Disable 2FA for a user
   */
  async disable(userId: number): Promise<void> {
    await dbAdapter.runQuery(`
      DELETE FROM users.two_factor_totp WHERE user_id = $1
    `, [userId]);

    await dbAdapter.runQuery(`
      DELETE FROM users.backup_codes WHERE user_id = $1
    `, [userId]);

    await dbAdapter.runQuery(`
      UPDATE users.users SET two_factor_enabled = false WHERE id = $1
    `, [userId]);
  }
}

export const totpService = new TotpService();
```

### Phase 3: WebAuthn Implementation (Week 3)

```typescript
// frontend/src/lib/security/webauthn-service.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { dbAdapter } from '@/lib/database/adapter';

const RP_NAME = 'Veritable Games';
const RP_ID = process.env.NODE_ENV === 'production'
  ? 'veritablegames.com'
  : 'localhost';
const ORIGIN = process.env.NODE_ENV === 'production'
  ? 'https://veritablegames.com'
  : 'http://localhost:3000';

export class WebAuthnService {
  /**
   * Generate options for registering a new passkey
   */
  async generateRegistrationOptions(userId: number, email: string) {
    // Get existing credentials to exclude
    const existingCredentials = await dbAdapter.allQuery(`
      SELECT id FROM users.webauthn_credentials WHERE user_id = $1
    `, [userId]);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(userId.toString()),
      userName: email,
      attestationType: 'none', // We don't need attestation
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.id,
        type: 'public-key',
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Prefer built-in (Touch ID, Face ID, Windows Hello)
      },
    });

    // Store challenge for verification
    await dbAdapter.runQuery(`
      INSERT INTO users.webauthn_challenges (user_id, challenge, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
      ON CONFLICT (user_id) DO UPDATE SET challenge = $2, expires_at = NOW() + INTERVAL '5 minutes'
    `, [userId, options.challenge]);

    return options;
  }

  /**
   * Verify registration response and store credential
   */
  async verifyRegistration(
    userId: number,
    response: RegistrationResponseJSON,
    friendlyName?: string
  ): Promise<boolean> {
    const challengeRow = await dbAdapter.getQuery(`
      SELECT challenge FROM users.webauthn_challenges
      WHERE user_id = $1 AND expires_at > NOW()
    `, [userId]);

    if (!challengeRow) {
      throw new Error('Challenge expired or not found');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      await dbAdapter.runQuery(`
        INSERT INTO users.webauthn_credentials
        (id, user_id, public_key, counter, friendly_name)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        Buffer.from(credentialID).toString('base64url'),
        userId,
        Buffer.from(credentialPublicKey),
        counter,
        friendlyName || 'Security Key',
      ]);

      // Enable 2FA if not already
      await dbAdapter.runQuery(`
        UPDATE users.users SET two_factor_enabled = true WHERE id = $1
      `, [userId]);

      return true;
    }

    return false;
  }

  /**
   * Generate options for authenticating with a passkey
   */
  async generateAuthenticationOptions(userId: number) {
    const credentials = await dbAdapter.allQuery(`
      SELECT id, transports FROM users.webauthn_credentials WHERE user_id = $1
    `, [userId]);

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map(cred => ({
        id: cred.id,
        type: 'public-key',
        transports: cred.transports,
      })),
      userVerification: 'preferred',
    });

    await dbAdapter.runQuery(`
      INSERT INTO users.webauthn_challenges (user_id, challenge, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
      ON CONFLICT (user_id) DO UPDATE SET challenge = $2, expires_at = NOW() + INTERVAL '5 minutes'
    `, [userId, options.challenge]);

    return options;
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    userId: number,
    response: AuthenticationResponseJSON
  ): Promise<boolean> {
    const [challengeRow, credentialRow] = await Promise.all([
      dbAdapter.getQuery(`
        SELECT challenge FROM users.webauthn_challenges
        WHERE user_id = $1 AND expires_at > NOW()
      `, [userId]),
      dbAdapter.getQuery(`
        SELECT id, public_key, counter FROM users.webauthn_credentials
        WHERE id = $1 AND user_id = $2
      `, [response.id, userId]),
    ]);

    if (!challengeRow || !credentialRow) {
      return false;
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: credentialRow.id,
        credentialPublicKey: credentialRow.public_key,
        counter: credentialRow.counter,
      },
    });

    if (verification.verified) {
      // Update counter to prevent replay attacks
      await dbAdapter.runQuery(`
        UPDATE users.webauthn_credentials
        SET counter = $1, last_used_at = NOW()
        WHERE id = $2
      `, [verification.authenticationInfo.newCounter, response.id]);

      return true;
    }

    return false;
  }
}

export const webAuthnService = new WebAuthnService();
```

### Phase 4: API Routes (Week 4)

```typescript
// frontend/src/app/api/auth/2fa/setup/route.ts
import { withSecurity } from '@/lib/security/middleware';
import { totpService } from '@/lib/security/totp-service';
import { getCurrentUser } from '@/lib/auth/server';

export const POST = withSecurity(async (request) => {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const setup = await totpService.initializeSetup(user.id, user.email);

  return Response.json({
    success: true,
    qrCode: setup.qrCodeDataUrl,
    // Only show secret if user can't scan QR (accessibility)
    manualEntry: setup.secret,
  });
});

// frontend/src/app/api/auth/2fa/verify/route.ts
export const POST = withSecurity(async (request) => {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { token } = await request.json();

  if (!token || !/^\d{6}$/.test(token)) {
    return Response.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const success = await totpService.verifyAndEnable(user.id, token);

  if (success) {
    const backupCodes = await totpService.generateBackupCodes(user.id);
    return Response.json({
      success: true,
      backupCodes, // Show only once!
      message: 'Two-factor authentication enabled',
    });
  }

  return Response.json({ error: 'Invalid verification code' }, { status: 400 });
});
```

### Phase 5: UI Components (Week 5)

The UI should integrate with the existing SecuritySettingsForm.tsx, replacing the current "Coming Soon" placeholder.

Key UI elements:
1. **Setup wizard** - QR code display, manual entry option, verification input
2. **Backup codes modal** - Display once, force download/copy
3. **Recovery flow** - Backup code entry during login
4. **Device management** - List registered passkeys, allow removal

---

## Part 3: Security Considerations

### 3.1 Encryption Key Management

**TOTP_ENCRYPTION_KEY requirements:**
- Must be 32 bytes (64 hex characters)
- Generate with: `openssl rand -hex 32`
- Store in environment variables, NOT in code
- Rotate annually (requires re-encryption of all secrets)

### 3.2 Rate Limiting

| Action | Limit | Lockout |
|--------|-------|---------|
| TOTP verification | 5 attempts | 15 minutes |
| Backup code use | 5 attempts | 15 minutes |
| 2FA setup | 3 attempts | 1 hour |

### 3.3 Replay Attack Prevention

- Track used TOTP tokens per user per time window
- WebAuthn: Increment counter on each use, reject if counter doesn't increase
- Backup codes: Mark as used immediately, never allow reuse

### 3.4 Recovery Flow

If user loses access to authenticator AND backup codes:
1. Require email verification
2. Require identity verification (security questions, ID upload)
3. 24-48 hour cooling period before 2FA reset
4. Notify user via all known contact methods

---

## Part 4: Dependencies to Install

```bash
cd frontend
npm install otplib qrcode @simplewebauthn/server @simplewebauthn/browser
npm install -D @types/qrcode
```

**Package sizes:**
- `otplib`: ~5KB gzipped
- `qrcode`: ~30KB gzipped
- `@simplewebauthn/server`: ~15KB gzipped
- `@simplewebauthn/browser`: ~8KB gzipped

**Total added bundle size**: ~58KB gzipped

---

## Part 5: Environment Variables

Add to `.env.local` and Coolify:

```bash
# 2FA encryption key (generate with: openssl rand -hex 32)
TOTP_ENCRYPTION_KEY=your-64-character-hex-key-here

# WebAuthn configuration
WEBAUTHN_RP_ID=veritablegames.com
WEBAUTHN_ORIGIN=https://veritablegames.com
```

---

## Part 6: Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Database Schema | 1 week | Tables created, migrations ready |
| 2. TOTP Service | 1 week | Working TOTP verification |
| 3. WebAuthn Service | 1 week | Passkey registration/verification |
| 4. API Routes | 1 week | All endpoints functional |
| 5. UI Components | 1 week | Settings integration complete |
| 6. Testing | 1 week | Security audit, edge cases |

**Total: 6 weeks** for full implementation

---

## Part 7: Current Billboard Status

The current SecuritySettingsForm.tsx (documented in [BILLBOARD_FEATURES.md](../BILLBOARD_FEATURES.md)) shows:
- "Enable Two-Factor Authentication" button (disabled, "Coming Soon" badge)
- Mock session data
- Mock login history

After implementation:
- Remove "Coming Soon" badge
- Enable 2FA setup flow
- Replace mock data with real session/login tracking (separate task)

---

## Appendix: Related Documentation

- [BILLBOARD_FEATURES.md](../BILLBOARD_FEATURES.md) - Current placeholder features
- [PASSWORD_MANAGEMENT.md](./PASSWORD_MANAGEMENT.md) - Password security standards
- [Critical Patterns](../architecture/CRITICAL_PATTERNS.md) - API security patterns

---

**Last Updated**: November 29, 2025
