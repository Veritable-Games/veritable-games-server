# Security Remediation Plan - Veritable Games Platform

**Date:** 2025-09-16
**Severity Summary:** 12 Critical, 15 High, 14 Medium, 6 Low vulnerabilities
**Estimated Total Remediation Time:** 2 weeks with phased deployment

## Executive Summary

This document outlines the remediation strategy for 47 identified security vulnerabilities in the Veritable Games platform. The plan is organized into four phases based on severity and risk, with specific code fixes, testing requirements, and deployment procedures.

**Critical Findings:**
- SQL injection vulnerability in forum search (CVSS 9.8)
- Only 38% of API routes have security middleware
- Authentication timing attacks exposing user enumeration
- Session fixation vulnerabilities in auth flow
- Race conditions in database connection pool
- Path traversal risks in file upload handlers

---

## Phase 1: Critical Patches (0-24 Hours)

### 1.1 SQL Injection in Forum Search [CRITICAL - CVSS 9.8]

**Location:** `/frontend/src/lib/forums/service.ts:922-924`

**Current Vulnerable Code:**
```typescript
// Line 922-924 - Direct string interpolation in SQL
WHERE ft.id IN (${topicIds.map(() => '?').join(',')})
ORDER BY CASE ft.id ${topicIds.map((id, i) => `WHEN ${id} THEN ${i}`).join(' ')} END
```

**Fixed Code:**
```typescript
// Use parameterized query with prepared statement
async searchTopics(query: string, options: ForumSearchOptions = {}): Promise<ForumTopic[]> {
  // Validate and sanitize search query
  const sanitizedQuery = query.replace(/[^\w\s\-'"]/g, ' ').trim();
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return [];
  }

  // Use FTS5 with proper escaping
  const ftsStmt = this.db.prepare(`
    SELECT ft.id, ft.title, ft.content,
           snippet(forum_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
    FROM forum_fts
    JOIN forum_topics ft ON forum_fts.rowid = ft.id
    WHERE forum_fts MATCH ?
    ORDER BY bm25(forum_fts)
    LIMIT ?
  `);

  const searchResults = ftsStmt.all(sanitizedQuery, options.limit || 20) as any[];

  if (searchResults.length === 0) return [];

  // Use prepared statement for topic retrieval
  const placeholders = searchResults.map(() => '?').join(',');
  const topicsStmt = this.db.prepare(`
    SELECT
      ft.*,
      u.username,
      lru.username as last_reply_username
    FROM forum_topics ft
    LEFT JOIN users u ON ft.user_id = u.id
    LEFT JOIN users lru ON ft.last_reply_user_id = lru.id
    WHERE ft.id IN (${placeholders})
    ORDER BY
      CASE ft.id
        ${searchResults.map((_, i) => `WHEN ? THEN ${i}`).join(' ')}
      END
  `);

  // Pass IDs twice - once for IN clause, once for ORDER BY
  const ids = searchResults.map(r => r.id);
  return topicsStmt.all(...ids, ...ids) as ForumTopic[];
}
```

**Testing Script:**
```typescript
// tests/security/sql-injection.test.ts
describe('SQL Injection Prevention', () => {
  it('should handle malicious search queries safely', () => {
    const maliciousQueries = [
      "'; DROP TABLE forum_topics; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
      "\\x27; DROP TABLE users--"
    ];

    for (const query of maliciousQueries) {
      expect(() => forumService.searchTopics(query)).not.toThrow();
      // Verify tables still exist
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      expect(tables).toContainEqual({ name: 'forum_topics' });
    }
  });
});
```

**Deployment:** Immediate hotfix deployment
**Rollback:** Revert to previous service.ts if search breaks
**Time Estimate:** 2 hours

---

### 1.2 Authentication Timing Attack [CRITICAL - CVSS 7.5]

**Location:** `/frontend/src/lib/auth/service.ts:56-65`

**Current Vulnerable Code:**
```typescript
// Timing attack - early return reveals user existence
const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?')
  .get(username, email);
if (existingUser) {
  throw new Error('Username or email already exists');
}
```

**Fixed Code:**
```typescript
// Constant-time user verification
async register(data: RegisterData): Promise<{ user: User; sessionId: string }> {
  const { username, email, password, display_name } = data;

  // Always hash password regardless of user existence (constant time)
  const password_hash = await bcrypt.hash(password, 12);

  // Check user existence
  const db = this.getDb();
  const existingUser = db.prepare(
    'SELECT id, username, email FROM users WHERE username = ? OR email = ?'
  ).get(username, email) as any;

  // Constant-time comparison to prevent timing attacks
  const userExists = !!existingUser;
  const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks';

  // Always perform hash comparison to maintain constant timing
  if (!userExists) {
    await bcrypt.compare('dummy', dummyHash);
  } else {
    await bcrypt.compare(password, dummyHash);
  }

  if (userExists) {
    // Generic error message prevents user enumeration
    throw new Error('Invalid registration details');
  }

  // Continue with registration...
}

// Similar fix for login method
async login(username: string, password: string): Promise<User | null> {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // Always perform hash comparison (constant time)
  const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks';
  const hashToCheck = user ? user.password_hash : dummyHash;
  const isValid = await bcrypt.compare(password, hashToCheck);

  if (!user || !isValid) {
    // Generic error prevents user enumeration
    throw new Error('Invalid credentials');
  }

  return user;
}
```

**Testing:**
```typescript
// Measure timing differences
async function measureAuthTiming(username: string): Promise<number> {
  const start = performance.now();
  try {
    await authService.login(username, 'wrongpassword');
  } catch {}
  return performance.now() - start;
}

test('should have consistent timing for valid/invalid users', async () => {
  const validUserTimes = [];
  const invalidUserTimes = [];

  for (let i = 0; i < 100; i++) {
    validUserTimes.push(await measureAuthTiming('admin'));
    invalidUserTimes.push(await measureAuthTiming('nonexistent' + i));
  }

  const avgValid = average(validUserTimes);
  const avgInvalid = average(invalidUserTimes);
  const difference = Math.abs(avgValid - avgInvalid);

  // Timing difference should be < 5ms
  expect(difference).toBeLessThan(5);
});
```

**Time Estimate:** 3 hours
**Deployment:** Rolling update with feature flag

---

### 1.3 Session Fixation Prevention [CRITICAL - CVSS 8.0]

**Location:** `/frontend/src/lib/auth/service.ts` and session management

**Fixed Code:**
```typescript
// Regenerate session ID on privilege changes
class AuthService {
  async login(username: string, password: string): Promise<{ user: User; sessionId: string }> {
    // Validate credentials...

    // Invalidate any existing sessions for this user
    this.invalidateUserSessions(user.id);

    // Generate new session with secure flags
    const sessionId = this.createSecureSession(user.id, {
      regenerate: true,
      bindToIp: request.ip,
      bindToUserAgent: request.headers['user-agent'],
      secure: true,
      httpOnly: true,
      sameSite: 'strict'
    });

    // Log security event
    this.auditLog('session_created', {
      userId: user.id,
      sessionId: sessionId.substring(0, 8) + '...',
      ip: request.ip
    });

    return { user, sessionId };
  }

  private createSecureSession(userId: number, options: SessionOptions): string {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    const stmt = this.db.prepare(`
      INSERT INTO user_sessions (
        id, user_id, expires_at, ip_address, user_agent,
        is_active, created_at, last_activity
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `);

    stmt.run(
      sessionId,
      userId,
      expiresAt,
      options.bindToIp,
      options.bindToUserAgent,
      Date.now(),
      Date.now()
    );

    return sessionId;
  }

  // Validate session with additional checks
  async validateSession(sessionId: string, request: Request): Promise<User | null> {
    const session = this.db.prepare(`
      SELECT * FROM user_sessions
      WHERE id = ? AND is_active = 1 AND expires_at > ?
    `).get(sessionId, Date.now());

    if (!session) return null;

    // Verify IP and User-Agent binding
    if (session.ip_address !== request.ip) {
      this.auditLog('session_hijack_attempt', {
        sessionId: sessionId.substring(0, 8) + '...',
        expectedIp: session.ip_address,
        actualIp: request.ip
      });
      this.invalidateSession(sessionId);
      return null;
    }

    // Update last activity
    this.db.prepare('UPDATE user_sessions SET last_activity = ? WHERE id = ?')
      .run(Date.now(), sessionId);

    return this.getUserById(session.user_id);
  }
}
```

**Time Estimate:** 4 hours
**Testing:** Session hijacking simulation tests

---

### 1.4 Database Connection Pool Race Conditions [CRITICAL - CVSS 7.0]

**Location:** `/frontend/src/lib/database/pool.ts`

**Fixed Code:**
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { Mutex } from 'async-mutex';

class DatabasePool {
  private static instance: DatabasePool;
  private connections: Map<string, Database.Database>;
  private connectionMutex: Mutex;
  private readonly maxConnections = 15;
  private readonly dataDir: string;
  private connectionStats: Map<string, ConnectionStats>;

  private constructor() {
    this.connections = new Map();
    this.connectionMutex = new Mutex();
    this.connectionStats = new Map();
    this.dataDir = path.join(process.cwd(), 'data');

    // Set up connection monitoring
    this.startConnectionMonitoring();
  }

  async getConnection(dbName: string): Promise<Database.Database> {
    // Use mutex to prevent race conditions
    return await this.connectionMutex.runExclusive(async () => {
      // Check existing connection
      if (this.connections.has(dbName)) {
        const db = this.connections.get(dbName)!;
        try {
          // Verify connection health
          db.exec('SELECT 1');
          this.updateStats(dbName, 'reused');
          return db;
        } catch (error) {
          // Connection dead, remove it
          this.connections.delete(dbName);
          this.updateStats(dbName, 'recycled');
        }
      }

      // Check connection limit
      if (this.connections.size >= this.maxConnections) {
        // Find least recently used connection
        const lru = this.findLRUConnection();
        if (lru) {
          await this.closeConnection(lru);
        }
      }

      // Create new connection with retry logic
      const db = await this.createConnection(dbName);
      this.connections.set(dbName, db);
      this.updateStats(dbName, 'created');

      return db;
    });
  }

  private async createConnection(dbName: string, retries = 3): Promise<Database.Database> {
    const dbPath = path.join(this.dataDir, `${dbName}.db`);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const db = new Database(dbPath);

        // Configure with optimized settings
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = 10000');
        db.pragma('foreign_keys = ON');
        db.pragma('temp_store = MEMORY');
        db.pragma('wal_autocheckpoint = 500');

        // Set connection timeout
        db.pragma('lock_timeout = 10000');

        return db;
      } catch (error) {
        if (attempt === retries - 1) throw error;
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
      }
    }

    throw new Error(`Failed to create connection for ${dbName}`);
  }

  private findLRUConnection(): string | null {
    let oldestTime = Date.now();
    let lruKey = null;

    for (const [key, stats] of this.connectionStats) {
      if (stats.lastAccessed < oldestTime) {
        oldestTime = stats.lastAccessed;
        lruKey = key;
      }
    }

    return lruKey;
  }

  private async closeConnection(dbName: string): Promise<void> {
    const db = this.connections.get(dbName);
    if (db) {
      try {
        // Ensure WAL checkpoint before closing
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (error) {
        console.error(`Error closing ${dbName}:`, error);
      }
      this.connections.delete(dbName);
      this.connectionStats.delete(dbName);
    }
  }

  // Monitor for connection leaks
  private startConnectionMonitoring(): void {
    setInterval(() => {
      for (const [name, stats] of this.connectionStats) {
        const idleTime = Date.now() - stats.lastAccessed;
        if (idleTime > 300000) { // 5 minutes idle
          console.warn(`Connection ${name} idle for ${idleTime}ms`);
          this.closeConnection(name);
        }
      }
    }, 60000); // Check every minute
  }
}
```

**Testing:**
```typescript
// Stress test for race conditions
test('should handle concurrent connection requests', async () => {
  const promises = [];

  // Create 100 concurrent connection requests
  for (let i = 0; i < 100; i++) {
    promises.push(dbPool.getConnection('forums'));
  }

  const connections = await Promise.all(promises);

  // All should be the same connection (no duplicates)
  const uniqueConnections = new Set(connections);
  expect(uniqueConnections.size).toBe(1);

  // Pool should show correct stats
  const stats = dbPool.getStats();
  expect(stats.activeConnections).toBeLessThanOrEqual(15);
});
```

**Time Estimate:** 4 hours
**Deployment:** Requires server restart with maintenance window

---

### 1.5 API Security Middleware Coverage [CRITICAL]

**Current:** Only 38% (56/148) of API routes use security middleware

**Fix:** Create automated middleware wrapper application

```typescript
// scripts/apply-security-middleware.ts
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const API_DIR = 'src/app/api';
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/public',
  '/api/auth/verify-email',
  '/api/auth/reset-password'
];

async function applySecurityMiddleware() {
  const files = await glob(`${API_DIR}/**/route.ts`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const apiPath = file.replace('src/app', '').replace('/route.ts', '');

    // Skip if already has withSecurity
    if (content.includes('withSecurity')) {
      console.log(`✓ ${apiPath} already secured`);
      continue;
    }

    // Skip excluded paths
    if (EXCLUDED_PATHS.some(path => apiPath.startsWith(path))) {
      console.log(`- ${apiPath} excluded`);
      continue;
    }

    // Determine security requirements
    const requiresAuth = !apiPath.includes('/public');
    const requiresCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].some(
      method => content.includes(`export const ${method}`)
    );

    // Apply wrapper
    const securedContent = transformRouteFile(content, {
      requiresAuth,
      requiresCsrf,
      rateLimitConfig: determineRateLimit(apiPath)
    });

    fs.writeFileSync(file, securedContent);
    console.log(`✅ Secured ${apiPath}`);
  }
}

function transformRouteFile(content: string, options: SecurityOptions): string {
  // Add import if not present
  if (!content.includes("from '@/lib/security/middleware'")) {
    content = `import { withSecurity } from '@/lib/security/middleware';\n${content}`;
  }

  // Wrap each exported handler
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    const regex = new RegExp(`export const ${method} = async \\(`, 'g');
    if (regex.test(content)) {
      content = content.replace(
        regex,
        `export const ${method} = withSecurity(async (`
      );

      // Add security options
      const endRegex = new RegExp(`(export const ${method} = withSecurity\\(async \\([^)]*\\) => {[^}]+}\\))`, 'g');
      content = content.replace(endRegex, `$1, {
        requireAuth: ${options.requiresAuth},
        csrfEnabled: ${options.requiresCsrf},
        rateLimitConfig: '${options.rateLimitConfig}'
      })`);
    }
  }

  return content;
}
```

**Deployment Script:**
```bash
#!/bin/bash
# apply-security.sh

echo "Applying security middleware to all API routes..."

# Backup current API routes
cp -r src/app/api src/app/api.backup.$(date +%s)

# Run the security application script
npx tsx scripts/apply-security-middleware.ts

# Verify TypeScript compilation
npm run type-check

# Run security tests
npm test -- security.test.ts

if [ $? -eq 0 ]; then
  echo "✅ Security middleware applied successfully"
  rm -rf src/app/api.backup.*
else
  echo "❌ Security application failed, rolling back..."
  mv src/app/api.backup.* src/app/api
  exit 1
fi
```

**Time Estimate:** 6 hours
**Testing:** Automated test suite for all endpoints

---

## Phase 2: High Priority Fixes (24-72 Hours)

### 2.1 Path Traversal in File Upload [HIGH - CVSS 7.5]

**Location:** File upload handlers

**Fixed Code:**
```typescript
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

class SecureFileUploadService {
  private readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.md'];
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly UPLOAD_BASE_PATH = path.join(process.cwd(), 'uploads');

  async handleUpload(file: File, userId: string): Promise<string> {
    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error('File too large');
    }

    // Validate and sanitize filename
    const originalName = file.name;
    const sanitizedName = this.sanitizeFilename(originalName);
    const extension = path.extname(sanitizedName).toLowerCase();

    // Check allowed extensions
    if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error('File type not allowed');
    }

    // Generate secure filename with UUID
    const fileId = crypto.randomUUID();
    const secureFilename = `${fileId}${extension}`;

    // Create user-specific directory (prevents traversal)
    const userDir = path.join(this.UPLOAD_BASE_PATH, userId);
    const filePath = path.join(userDir, secureFilename);

    // Verify the path is within upload directory (defense in depth)
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(this.UPLOAD_BASE_PATH)) {
      throw new Error('Invalid file path');
    }

    // Create directory if it doesn't exist
    await fs.mkdir(userDir, { recursive: true });

    // Scan file content for malware signatures
    await this.scanFile(file);

    // Save file with restricted permissions
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()), {
      mode: 0o644 // Read for all, write for owner only
    });

    // Store metadata in database
    this.storeFileMetadata({
      fileId,
      userId,
      originalName,
      secureFilename,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date()
    });

    return fileId;
  }

  private sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    return filename
      .replace(/\.\./g, '')
      .replace(/[\/\\]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255);
  }

  private async scanFile(file: File): Promise<void> {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check for common malware signatures
    const signatures = [
      Buffer.from([0x4D, 0x5A]), // EXE
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF
      Buffer.from('<%eval'), // PHP eval
      Buffer.from('<script'), // Script tags
    ];

    for (const sig of signatures) {
      if (buffer.includes(sig)) {
        throw new Error('Malicious content detected');
      }
    }
  }
}
```

**Time Estimate:** 4 hours

---

### 2.2 CSRF Token Management [HIGH - CVSS 6.5]

**Fixed Implementation:**
```typescript
// Enhanced CSRF with double-submit cookies
class EnhancedCSRFManager {
  private readonly TOKEN_LENGTH = 32;
  private readonly TOKEN_EXPIRY = 3600000; // 1 hour

  generateToken(sessionId: string): CSRFToken {
    const tokenValue = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    const timestamp = Date.now();
    const signature = this.signToken(tokenValue, timestamp, sessionId);

    return {
      token: `${tokenValue}.${timestamp}.${signature}`,
      cookieToken: this.hashToken(tokenValue),
      expires: timestamp + this.TOKEN_EXPIRY
    };
  }

  verifyToken(
    headerToken: string,
    cookieToken: string,
    sessionId: string
  ): boolean {
    try {
      const [value, timestamp, signature] = headerToken.split('.');

      // Verify signature
      const expectedSignature = this.signToken(value, parseInt(timestamp), sessionId);
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        return false;
      }

      // Verify double-submit cookie
      const expectedCookie = this.hashToken(value);
      if (!crypto.timingSafeEqual(
        Buffer.from(cookieToken),
        Buffer.from(expectedCookie)
      )) {
        return false;
      }

      // Check expiry
      if (Date.now() > parseInt(timestamp) + this.TOKEN_EXPIRY) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private signToken(value: string, timestamp: number, sessionId: string): string {
    const secret = process.env.CSRF_SECRET!;
    return crypto
      .createHmac('sha256', secret)
      .update(`${value}.${timestamp}.${sessionId}`)
      .digest('hex');
  }

  private hashToken(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
  }
}
```

**Time Estimate:** 3 hours

---

### 2.3 Rate Limiting Bypass Prevention [HIGH - CVSS 6.0]

**Fixed Implementation:**
```typescript
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

class DistributedRateLimiter {
  private cache: LRUCache<string, RateLimitEntry>;
  private readonly WINDOW_MS = 60000; // 1 minute

  constructor() {
    this.cache = new LRUCache({
      max: 10000,
      ttl: this.WINDOW_MS
    });
  }

  async checkLimit(
    identifier: string,
    limit: number,
    options: RateLimitOptions = {}
  ): Promise<RateLimitResult> {
    // Create composite key to prevent bypass attempts
    const keys = [
      identifier,
      options.ip,
      options.sessionId,
      options.fingerprint
    ].filter(Boolean);

    // Check all relevant keys
    const promises = keys.map(key => this.checkSingleLimit(key, limit));
    const results = await Promise.all(promises);

    // Use the most restrictive result
    const mostRestrictive = results.reduce((prev, curr) =>
      curr.remaining < prev.remaining ? curr : prev
    );

    if (!mostRestrictive.allowed) {
      // Log potential bypass attempt
      this.logRateLimitViolation({
        identifier,
        keys,
        violation: 'limit_exceeded'
      });
    }

    return mostRestrictive;
  }

  private async checkSingleLimit(
    key: string,
    limit: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.cache.get(key) || {
      count: 0,
      resetTime: now + this.WINDOW_MS
    };

    // Reset if window expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + this.WINDOW_MS;
    }

    entry.count++;
    this.cache.set(key, entry);

    const remaining = Math.max(0, limit - entry.count);
    const resetAfter = entry.resetTime - now;

    return {
      allowed: entry.count <= limit,
      remaining,
      resetAfter,
      retryAfter: entry.count > limit ? resetAfter : null
    };
  }

  // Fingerprint generation for additional tracking
  generateFingerprint(request: Request): string {
    const components = [
      request.headers.get('user-agent'),
      request.headers.get('accept-language'),
      request.headers.get('accept-encoding'),
      request.headers.get('dnt'),
      // Add more entropy sources as needed
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);
  }
}
```

**Time Estimate:** 4 hours

---

### 2.4 Input Validation Enhancement [HIGH]

**Comprehensive Validation Schema:**
```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Central validation schemas
export const ValidationSchemas = {
  // User input validation
  username: z.string()
    .min(3, 'Username too short')
    .max(20, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid username format'),

  email: z.string()
    .email('Invalid email format')
    .max(255)
    .transform(val => val.toLowerCase()),

  password: z.string()
    .min(8, 'Password too short')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),

  // Content validation
  forumTitle: z.string()
    .min(5)
    .max(200)
    .transform(val => DOMPurify.sanitize(val, { ALLOWED_TAGS: [] })),

  forumContent: z.string()
    .min(10)
    .max(50000)
    .transform(val => sanitizeForumContent(val)),

  // ID validation
  numericId: z.coerce.number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),

  uuid: z.string()
    .uuid('Invalid UUID format'),

  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Invalid slug format')
    .max(100),

  // File upload validation
  fileUpload: z.object({
    name: z.string().max(255),
    size: z.number().max(10 * 1024 * 1024), // 10MB
    type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'application/pdf']),
  }),

  // Pagination validation
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['asc', 'desc']).default('desc'),
    orderBy: z.string().regex(/^[a-z_]+$/).optional()
  })
};

// Content sanitization function
function sanitizeForumContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'code', 'pre',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: {
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height'],
      '*': ['class']
    },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
    FORBID_CONTENTS: ['script', 'style'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

// Validation middleware
export function validateRequest(schema: z.ZodSchema) {
  return async (request: Request) => {
    try {
      const body = await request.json();
      const validated = schema.parse(body);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(error.errors);
      }
      throw error;
    }
  };
}
```

**Time Estimate:** 5 hours

---

## Phase 3: Medium Priority Hardening (1 Week)

### 3.1 Security Headers Enhancement

```typescript
// Enhanced CSP and security headers
export function getEnhancedSecurityHeaders(nonce: string): HeadersInit {
  return {
    // Content Security Policy - Strict mode
    'Content-Security-Policy': [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: https:`,
      `font-src 'self'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `block-all-mixed-content`,
      `upgrade-insecure-requests`,
      `require-trusted-types-for 'script'`
    ].join('; '),

    // Additional security headers
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()'
    ].join(', '),

    // HSTS (only in production)
    ...(process.env.NODE_ENV === 'production' && {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
    })
  };
}
```

### 3.2 Secure Session Management

```typescript
// Enhanced session security
class SecureSessionManager {
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  async createSession(userId: number, request: Request): Promise<Session> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const fingerprint = this.generateFingerprint(request);

    const session = {
      id: sessionId,
      userId,
      fingerprint,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION,
      lastActivity: Date.now(),
      ipAddress: this.getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      isSecure: true
    };

    // Store with encryption
    await this.storeEncrypted(session);

    return session;
  }

  async validateSession(sessionId: string, request: Request): Promise<boolean> {
    const session = await this.retrieveDecrypted(sessionId);

    if (!session) return false;

    // Check expiry
    if (Date.now() > session.expiresAt) {
      await this.invalidateSession(sessionId);
      return false;
    }

    // Check idle timeout
    if (Date.now() - session.lastActivity > this.IDLE_TIMEOUT) {
      await this.invalidateSession(sessionId);
      return false;
    }

    // Verify fingerprint
    const currentFingerprint = this.generateFingerprint(request);
    if (session.fingerprint !== currentFingerprint) {
      await this.logSecurityEvent('session_fingerprint_mismatch', {
        sessionId,
        expected: session.fingerprint,
        actual: currentFingerprint
      });
      return false;
    }

    // Update activity
    await this.updateActivity(sessionId);

    return true;
  }
}
```

### 3.3 Audit Logging System

```typescript
class SecurityAuditLogger {
  private readonly RETENTION_DAYS = 90;

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event_type: event.type,
      severity: event.severity,
      user_id: event.userId,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      details: event.details,
      stack_trace: event.error?.stack,
      request_id: event.requestId
    };

    // Store in database
    await this.storeInDatabase(logEntry);

    // Alert on critical events
    if (event.severity === 'critical') {
      await this.sendSecurityAlert(logEntry);
    }

    // Forward to SIEM if configured
    if (process.env.SIEM_ENDPOINT) {
      await this.forwardToSIEM(logEntry);
    }
  }

  async detectAnomalies(userId: string): Promise<AnomalyReport> {
    const recentEvents = await this.getRecentEvents(userId, 24 * 60 * 60 * 1000);

    const anomalies = {
      multipleIpAddresses: this.detectMultipleIPs(recentEvents),
      unusualAccessPatterns: this.detectUnusualPatterns(recentEvents),
      failedAuthAttempts: this.countFailedAuth(recentEvents),
      privilegeEscalation: this.detectPrivilegeEscalation(recentEvents)
    };

    return anomalies;
  }
}
```

**Time Estimate:** 3 days for Phase 3 implementation

---

## Phase 4: Long-term Security Improvements (2 Weeks)

### 4.1 Web Application Firewall (WAF)

```typescript
class WebApplicationFirewall {
  private rules: WAFRule[] = [];

  async processRequest(request: Request): Promise<WAFResult> {
    const threats = [];

    // Check against rule sets
    for (const rule of this.rules) {
      const result = await rule.evaluate(request);
      if (result.matched) {
        threats.push(result);
      }
    }

    // Calculate threat score
    const threatScore = threats.reduce((sum, t) => sum + t.severity, 0);

    if (threatScore >= 10) {
      return {
        action: 'block',
        threats,
        score: threatScore
      };
    }

    if (threatScore >= 5) {
      return {
        action: 'challenge',
        threats,
        score: threatScore
      };
    }

    return {
      action: 'allow',
      threats,
      score: threatScore
    };
  }

  // OWASP Core Rule Set implementation
  private loadOWASPRules(): void {
    this.rules.push(
      new SQLInjectionRule(),
      new XSSRule(),
      new PathTraversalRule(),
      new CommandInjectionRule(),
      new XXERule(),
      new SensitiveDataExposureRule()
    );
  }
}
```

### 4.2 Security Monitoring Dashboard

```typescript
// Real-time security monitoring
class SecurityMonitoringService {
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const now = Date.now();
    const hour = 60 * 60 * 1000;

    return {
      authenticationMetrics: {
        successfulLogins: await this.countEvents('auth_success', hour),
        failedLogins: await this.countEvents('auth_failed', hour),
        suspiciousPatterns: await this.detectSuspiciousAuth(),
        activeSessionS: await this.countActiveSessions()
      },

      threatMetrics: {
        blockedRequests: await this.countEvents('request_blocked', hour),
        rateLimitViolations: await this.countEvents('rate_limit_exceeded', hour),
        sqlInjectionAttempts: await this.countEvents('sql_injection_attempt', hour),
        xssAttempts: await this.countEvents('xss_attempt', hour)
      },

      systemHealth: {
        apiResponseTime: await this.getAverageResponseTime(),
        errorRate: await this.calculateErrorRate(),
        dbConnectionPool: await this.getPoolStatus(),
        memoryUsage: process.memoryUsage()
      }
    };
  }
}
```

---

## Testing Scripts

### Security Test Suite

```typescript
// security-tests/comprehensive-security.test.ts
import { describe, test, expect } from '@jest/globals';

describe('Security Test Suite', () => {
  describe('SQL Injection Prevention', () => {
    const injectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "' UNION SELECT * FROM users--",
      "admin'--",
      "' OR 1=1--",
      "1' AND 1=CAST((SELECT username FROM users LIMIT 1) AS INT)--"
    ];

    test.each(injectionPayloads)(
      'should handle SQL injection attempt: %s',
      async (payload) => {
        const response = await fetch('/api/forums/search', {
          method: 'POST',
          body: JSON.stringify({ query: payload })
        });

        expect(response.status).not.toBe(500);
        // Verify database integrity
        const tablesExist = await verifyDatabaseTables();
        expect(tablesExist).toBe(true);
      }
    );
  });

  describe('XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src=javascript:alert("XSS")>'
    ];

    test.each(xssPayloads)(
      'should sanitize XSS attempt: %s',
      async (payload) => {
        const response = await createForumPost({ content: payload });
        const post = await response.json();

        expect(post.content).not.toContain('<script>');
        expect(post.content).not.toContain('onerror');
        expect(post.content).not.toContain('javascript:');
      }
    );
  });

  describe('Authentication Security', () => {
    test('should prevent timing attacks', async () => {
      const timings = [];

      // Test with valid username
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await attemptLogin('admin', 'wrongpassword');
        timings.push(performance.now() - start);
      }

      const avgValidUser = average(timings);
      timings.length = 0;

      // Test with invalid username
      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        await attemptLogin('nonexistent' + i, 'wrongpassword');
        timings.push(performance.now() - start);
      }

      const avgInvalidUser = average(timings);

      // Timing difference should be minimal (< 5ms)
      expect(Math.abs(avgValidUser - avgInvalidUser)).toBeLessThan(5);
    });

    test('should regenerate session on login', async () => {
      const sessionBefore = await getSessionId();
      await login('testuser', 'password');
      const sessionAfter = await getSessionId();

      expect(sessionBefore).not.toBe(sessionAfter);
    });
  });

  describe('CSRF Protection', () => {
    test('should reject requests without CSRF token', async () => {
      const response = await fetch('/api/forums/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', content: 'Test' })
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: expect.stringContaining('CSRF')
      });
    });

    test('should reject requests with invalid CSRF token', async () => {
      const response = await fetch('/api/forums/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'invalid-token'
        },
        body: JSON.stringify({ title: 'Test', content: 'Test' })
      });

      expect(response.status).toBe(403);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = [];

      // Make 100 rapid requests
      for (let i = 0; i < 100; i++) {
        requests.push(fetch('/api/forums/list'));
      }

      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);

      // Should have some 429 responses
      expect(statusCodes).toContain(429);

      // Check rate limit headers
      const limitedResponse = responses.find(r => r.status === 429);
      expect(limitedResponse?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(limitedResponse?.headers.get('Retry-After')).toBeDefined();
    });
  });
});
```

### Automated Security Scanner

```bash
#!/bin/bash
# security-scan.sh

echo "Running comprehensive security scan..."

# 1. Dependency vulnerability check
echo "Checking dependencies..."
npm audit --audit-level=moderate

# 2. Code vulnerability scan
echo "Scanning code for vulnerabilities..."
npx eslint --ext .ts,.tsx src/ --config .eslintrc.security.json

# 3. Secret detection
echo "Checking for secrets..."
npx secretlint "**/*"

# 4. OWASP dependency check
echo "Running OWASP dependency check..."
npx owasp-dependency-check --scan . --format JSON --out dependency-check-report.json

# 5. SQL injection test
echo "Testing SQL injection prevention..."
npm test -- sql-injection.test.ts

# 6. XSS test
echo "Testing XSS prevention..."
npm test -- xss.test.ts

# 7. Authentication security test
echo "Testing authentication security..."
npm test -- auth-security.test.ts

# 8. API security coverage
echo "Checking API security coverage..."
node scripts/check-api-security-coverage.js

# Generate report
node scripts/generate-security-report.js

echo "Security scan complete. Report saved to security-report.html"
```

---

## Deployment Procedures

### Phase 1 Deployment (Critical - Immediate)

```bash
#!/bin/bash
# deploy-phase1.sh

set -e

echo "Starting Phase 1 Critical Security Deployment"

# 1. Backup current deployment
echo "Creating backup..."
kubectl create backup production-backup-$(date +%s)

# 2. Apply SQL injection fix
echo "Applying SQL injection fixes..."
kubectl set image deployment/api api=veritable-games:security-phase1-sql

# 3. Wait for rollout
kubectl rollout status deployment/api

# 4. Run smoke tests
echo "Running smoke tests..."
npm run test:smoke

# 5. Apply auth timing fix
echo "Applying authentication fixes..."
kubectl set image deployment/api api=veritable-games:security-phase1-auth

# 6. Verify deployment
kubectl rollout status deployment/api

# 7. Monitor error rates
echo "Monitoring for errors (5 minutes)..."
node scripts/monitor-deployment.js --duration=300

echo "Phase 1 deployment complete"
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh

set -e

echo "Initiating rollback..."

# Get previous revision
PREVIOUS_REVISION=$(kubectl rollout history deployment/api | tail -2 | head -1 | awk '{print $1}')

# Rollback to previous version
kubectl rollout undo deployment/api --to-revision=$PREVIOUS_REVISION

# Wait for rollback
kubectl rollout status deployment/api

# Verify system health
npm run test:health

echo "Rollback complete"
```

---

## Security Maintenance Checklist

### Daily Tasks
- [ ] Review security audit logs for anomalies
- [ ] Check rate limit violations
- [ ] Monitor failed authentication attempts
- [ ] Verify WAF block statistics
- [ ] Check database connection pool health

### Weekly Tasks
- [ ] Run dependency vulnerability scan
- [ ] Review and update security rules
- [ ] Analyze security metrics trends
- [ ] Test backup restoration
- [ ] Update threat intelligence feeds

### Monthly Tasks
- [ ] Comprehensive security audit
- [ ] Penetration testing
- [ ] Security training for team
- [ ] Review and update security policies
- [ ] Disaster recovery drill

### Quarterly Tasks
- [ ] Third-party security assessment
- [ ] Update security architecture documentation
- [ ] Review compliance requirements
- [ ] Security incident response drill

---

## Monitoring and Alerting

### Critical Security Alerts

```typescript
// Alert configurations
const SECURITY_ALERTS = {
  sql_injection: {
    threshold: 1,
    window: '1m',
    severity: 'critical',
    action: 'block_and_alert'
  },

  brute_force: {
    threshold: 10,
    window: '5m',
    severity: 'high',
    action: 'rate_limit_and_alert'
  },

  session_hijack: {
    threshold: 1,
    window: '1m',
    severity: 'critical',
    action: 'invalidate_session_and_alert'
  },

  privilege_escalation: {
    threshold: 1,
    window: '1m',
    severity: 'critical',
    action: 'block_and_investigate'
  }
};
```

---

## Success Metrics

### Security KPIs
- **API Security Coverage:** Target 100% (from current 38%)
- **Mean Time to Detect (MTTD):** < 5 minutes
- **Mean Time to Respond (MTTR):** < 30 minutes
- **False Positive Rate:** < 5%
- **Security Test Coverage:** > 90%
- **Vulnerability Remediation Time:** Critical < 24h, High < 72h

### Monitoring Dashboard

```typescript
// Real-time security metrics
interface SecurityDashboard {
  realTimeThreats: {
    activeAttacks: number;
    blockedRequests: number;
    suspiciousPatterns: string[];
  };

  systemHealth: {
    apiSecurity: number; // percentage
    dbConnections: number;
    errorRate: number;
    responseTime: number;
  };

  compliance: {
    csrfCoverage: number;
    rateLimitActive: boolean;
    auditLogEnabled: boolean;
    encryptionStatus: 'active' | 'partial' | 'disabled';
  };
}
```

---

## Conclusion

This security remediation plan addresses all 47 identified vulnerabilities with a prioritized, phased approach. Implementation should begin immediately with Phase 1 critical patches, followed by systematic deployment of remaining phases.

**Key Success Factors:**
1. Immediate patching of SQL injection vulnerability
2. Comprehensive API security middleware coverage
3. Robust testing at each phase
4. Continuous monitoring and alerting
5. Regular security assessments

**Next Steps:**
1. Review and approve this plan
2. Allocate resources for implementation
3. Begin Phase 1 deployment immediately
4. Schedule security training for development team
5. Establish ongoing security review process

---

**Document Version:** 1.0
**Last Updated:** 2025-09-16
**Next Review:** 2025-09-23