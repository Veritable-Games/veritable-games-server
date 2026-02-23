# Security Implementation Patterns

**Status**: ✅ Production-ready (CSRF + Rate Limiting + CSP + WAF headers)
**Last Updated**: November 10, 2025
**Audience**: Developers implementing security features and API routes

---

## Quick Navigation

### Inline Documentation (Code-Adjacent - Read These!)

- **[CSP Configuration & Justification](../../frontend/security/csp-config.md)** ⭐ START HERE
  - Content Security Policy header configuration
  - Security justifications for each directive
  - Implementation in Next.js 15
  - Monitoring and reporting setup
  - Testing tools and validation

- **[CSRF Token Middleware](../../frontend/src/lib/security/middleware.ts)** (lines 6-50)
  - Double submit cookie pattern implementation
  - Cryptographically secure token generation
  - Constant-time comparison to prevent timing attacks
  - Request validation with safe methods exemption

- **[File Upload Validator](../../frontend/src/lib/security/file-upload-validator.ts)**
  - File size and type validation
  - MIME type checking
  - Malicious file detection
  - Upload security patterns

- **[CSP Monitor](../../frontend/src/lib/security/csp-monitor.ts)**
  - Real-time CSP violation monitoring
  - Security event logging
  - Violation reporting

- **[WAF Headers](../../frontend/src/lib/security/waf.ts)**
  - Web Application Firewall headers
  - Security header configuration
  - Injection prevention

### Central Documentation (System-Level Overview)

- **[Security Hardening Progress](../security/SECURITY_HARDENING_PROGRESS.md)**
  - Deployment status and security audit results
  - CSRF protection on 49 API routes
  - Rate limiting configuration
  - Performance impact analysis

---

## System Overview

### Architecture at a Glance

```
User Request
    ↓
API Route: /api/*
    ↓
withSecurity Middleware
    ↓
├─ CSRF Validation (double submit cookie)
├─ Rate Limiting (configurable per endpoint)
├─ Session Validation
├─ Security Headers (CSP, X-Frame-Options, etc.)
└─ Request/Response Logging
    ↓
Route Handler (Validation + Business Logic)
    ↓
Response with Security Headers
```

### 5 Core Security Layers

| Layer | Purpose | Implementation | File |
|-------|---------|-----------------|------|
| **CSRF Protection** | Prevent cross-site request forgery | Double submit cookie pattern | `middleware.ts:6-50` |
| **Rate Limiting** | Prevent brute force & abuse | Token bucket algorithm | `middleware.ts` |
| **Content Security Policy** | Prevent injection attacks | CSP headers on all responses | `csp.ts` |
| **Input Validation** | Prevent malicious input | Zod schemas + file validators | `file-upload-validator.ts` |
| **Security Headers** | Defense-in-depth | X-Frame-Options, X-Content-Type-Options, etc. | `waf.ts` |

---

## How Security Works

### 1. CSRF Protection (Double Submit Cookie Pattern)

**What It Does**: Prevents malicious websites from forging requests to our API

**How It Works**:
```
1. Server generates random token (32 bytes, hex encoded)
2. Token stored in secure HTTP-only cookie
3. Token also sent to frontend in response
4. Frontend must include token in `x-csrf-token` header on POST/PUT/DELETE
5. Server validates: cookie token === header token (constant-time comparison)
```

**Security Guarantee**: Even if attacker steals one token, they can't use it without:
- Access to the same domain (browser same-origin policy)
- Ability to set headers (cannot be done from `<img>` or `<form>` tags)

**In Code**:
```typescript
// frontend/src/lib/security/middleware.ts:24-50
function validateCSRFToken(request: NextRequest): boolean {
  // Skip for GET, HEAD, OPTIONS (safe methods)
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // Get token from cookie and header
  const cookieToken = request.cookies.get('csrf_token')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );
}
```

**Enabled on 49 API Routes**: All POST/PUT/PATCH/DELETE endpoints are protected

See [SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md#-phase-11-csrf-protection-completed) for complete list.

### 2. Rate Limiting

**What It Does**: Prevents brute force attacks and API abuse

**How It Works**:
```
1. Track requests per user/IP
2. Enforce limits:
   - Login: 5 attempts per 15 minutes
   - Register: 5 attempts per 15 minutes
   - Forum topics: 5 per hour
   - Forum replies: 30 per hour
   - File uploads: 10 per hour
3. Return 429 (Too Many Requests) when exceeded
```

**In Code**:
```typescript
// withSecurity middleware includes rate limiting
export const POST = withSecurity(async (request) => {
  // Rate limiting is automatic for:
  // - /api/auth/login (5 per 15 min)
  // - /api/auth/register (5 per 15 min)
  // - /api/forums/topics (5 per hour)
  // - /api/forums/replies (30 per hour)
  // - /api/projects/[slug]/references (10 per hour)
});
```

**Protected Endpoints**:
- Authentication: login, register (5 attempts/15 min)
- Forum creation: topics, replies (5-30 per hour)
- File uploads: gallery, avatar (10 per hour)

See [SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md#-phase-12-rate-limiting-completed) for complete configuration.

### 3. Content Security Policy (CSP)

**What It Does**: Prevents script injection, CSS injection, and other content injection attacks

**How It Works**:
```
1. Server sends CSP header with every response
2. Browser enforces strict rules:
   - Only scripts from same origin
   - Only styles from same origin
   - Web Workers from same origin or blob URLs
   - No inline scripts/styles
   - No eval-like functions (except Three.js shaders with 'unsafe-eval')
3. Browser blocks violations and reports them
```

**Key Directives**:
```
default-src 'self'                    # Default: same origin only
script-src 'self' 'unsafe-eval'       # Scripts + Three.js eval for shaders
worker-src 'self' blob:               # Web Workers + dynamic workers
style-src 'self' 'unsafe-inline'      # Styles (unsafe-inline for legacy code)
img-src 'self' data: blob:            # Images + data URLs + blob URLs
object-src 'none'                     # No plugins
base-uri 'self'                       # Base URL same origin
form-action 'self'                    # Forms to same origin
upgrade-insecure-requests             # Upgrade HTTP to HTTPS
```

**In Code**: See [csp-config.md](../../frontend/security/csp-config.md) for complete implementation

**Monitoring**: CSP violations are logged via `csp-monitor.ts`

### 4. Input Validation

**What It Does**: Prevents malicious input from reaching the database

**Forum Content Example**:
```typescript
import { CreateTopicSchema } from '@/lib/forums/validation';

const body = await request.json();
const result = CreateTopicSchema.safeParse(body);

if (!result.success) {
  return errorResponse(result.error, 400);
}
// At this point, input is validated and sanitized
```

**File Upload Example**:
```typescript
import { validateFileUpload } from '@/lib/security/file-upload-validator';

const file = await request.formData();
const validation = await validateFileUpload(file, {
  maxSize: 5_000_000,        // 5 MB
  allowedMimes: ['image/jpeg', 'image/png'],
  checkMagicBytes: true      // Prevent disguised files
});

if (!validation.isValid) {
  return errorResponse(validation.error, 400);
}
```

See [VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md) for forum validation patterns.

### 5. Security Headers

**What It Does**: Provides defense-in-depth against various attacks

**Key Headers**:
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer leakage

See [waf.ts](../../frontend/src/lib/security/waf.ts) for implementation.

---

## How to Implement Secure API Routes

### Step 1: Use withSecurity Middleware

```typescript
import { withSecurity } from '@/lib/security/middleware';

export const POST = withSecurity(async (request) => {
  // You automatically get:
  // - CSRF protection
  // - Rate limiting
  // - Security headers
  // - Session validation
  // - Request logging
});
```

### Step 2: Validate Input with Zod

```typescript
import { CreateTopicSchema } from '@/lib/forums/validation';

const body = await request.json();
const result = CreateTopicSchema.safeParse(body);

if (!result.success) {
  return errorResponse(result.error, 400);
}

// Data is now type-safe and validated
const { title, content, category_id } = result.data;
```

### Step 3: Validate File Uploads (If Needed)

```typescript
import { validateFileUpload } from '@/lib/security/file-upload-validator';

const formData = await request.formData();
const file = formData.get('file') as File;

const validation = await validateFileUpload(file, {
  maxSize: 5_000_000,
  allowedMimes: ['image/jpeg', 'image/png'],
  checkMagicBytes: true
});

if (!validation.isValid) {
  return errorResponse(validation.error, 400);
}
```

### Step 4: Return Errors Safely

```typescript
import { errorResponse } from '@/lib/api/response';

// ✅ DO THIS - Safe error messages
return errorResponse('Invalid input', 400);

// ❌ DON'T DO THIS - Leaks implementation details
return errorResponse(`Database error: ${error.message}`, 500);

// ❌ DON'T DO THIS - Leaks stack traces
return errorResponse(error.stack, 500);
```

---

## Example: Create Forum Topic (Secure)

```typescript
// ✅ COMPLETE SECURE EXAMPLE
import { withSecurity } from '@/lib/security/middleware';
import { CreateTopicSchema } from '@/lib/forums/validation';
import { ForumService } from '@/lib/forums/services/forum';
import { errorResponse, successResponse } from '@/lib/api/response';

export const POST = withSecurity(async (request) => {
  try {
    // 1. Parse request body
    const body = await request.json();

    // 2. Validate input (CSRF, rate limiting, authentication already done by middleware)
    const result = CreateTopicSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(result.error, 400);
    }

    // 3. Call service with validated data
    const forumService = new ForumService();
    const topic = await forumService.createTopic({
      ...result.data,
      created_by: session.user.id,  // From middleware
    });

    // 4. Return success response with security headers
    return successResponse(topic, 201);
  } catch (error) {
    // 5. Handle errors safely
    console.error('Forum topic creation error:', error);
    return errorResponse('Failed to create topic', 500);
  }
});
```

**Security Checks Applied**:
- ✅ CSRF validation (middleware)
- ✅ Rate limiting (middleware)
- ✅ Input validation (Zod schema)
- ✅ User authentication (middleware)
- ✅ Safe error responses (no stack traces)
- ✅ Proper HTTP status codes

---

## Common Security Mistakes

### ❌ Mistake 1: Bypassing CSRF Protection

```typescript
// WRONG - Disables CSRF protection
export const POST = withSecurity(async (request) => {
  // ...
}, { enableCSRF: false });
```

**Why Bad**: Opens the route to CSRF attacks

**Fix**: Remove the `enableCSRF` parameter (enabled by default)

### ❌ Mistake 2: Leaking Error Details

```typescript
// WRONG - Exposes database schema and error details
catch (error) {
  return errorResponse(`Database error: ${error.message}`, 500);
}

// WRONG - Exposes file system paths
catch (error) {
  return errorResponse(error.stack, 500);
}
```

**Why Bad**: Helps attackers understand the application

**Fix**: Return generic error messages
```typescript
// CORRECT
catch (error) {
  console.error('Internal error:', error);
  return errorResponse('Internal server error', 500);
}
```

### ❌ Mistake 3: Trusting User Input

```typescript
// WRONG - No validation
const content = body.content;
await db.query('INSERT INTO forums.topics (content) VALUES ($1)', [content]);
```

**Why Bad**: Allows XSS, SQL injection, and other attacks

**Fix**: Always validate with Zod
```typescript
// CORRECT
const result = CreateTopicSchema.safeParse(body);
if (!result.success) return errorResponse(result.error, 400);
const { content } = result.data;
```

### ❌ Mistake 4: Manual CSRF Token Handling

```typescript
// WRONG - Re-implementing security is error-prone
const token = crypto.randomBytes(32).toString('hex');
response.setHeader('x-csrf-token', token);
```

**Why Bad**: Easy to implement incorrectly

**Fix**: Use `withSecurity` middleware which handles it

### ❌ Mistake 5: Disabling Rate Limiting

```typescript
// WRONG - Removes rate limiting
export const POST = withSecurity(async (request) => {
  // ...
}, { enableRateLimit: false });
```

**Why Bad**: Opens the route to brute force attacks

**Fix**: Keep rate limiting enabled by default

---

## Security Audit Results

**Last Audit**: November 8, 2025

✅ **CSRF Protection**: 49 API routes protected
✅ **Rate Limiting**: Login, registration, forum creation, file uploads protected
✅ **CSP Headers**: Content Security Policy enforced
✅ **Input Validation**: All routes use Zod schemas
✅ **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
✅ **Error Handling**: Safe error messages (no stack traces or implementation details)

📝 **Complete audit**: [SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md)

---

## Key Concepts

### Double Submit Cookie (CSRF Protection)

The CSRF protection uses the **double submit cookie pattern**:

1. Server generates random token
2. Token stored in HTTP-only cookie
3. Token also given to frontend
4. Frontend must include token in header
5. Server validates both match

**Why This Works**: Attacker can trigger a request, but cannot read the token (browser same-origin policy) or set headers (form submissions can't do this).

### Constant-Time Comparison

CSRF tokens are compared using `crypto.timingSafeEqual()` instead of `===`:

```typescript
// WRONG - timing attack vulnerable
if (cookieToken === headerToken) { ... }

// CORRECT - constant-time comparison
crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
```

**Why**: Timing attacks can reveal information based on how long comparison takes

### CSP Nonce vs Hash

The CSP implementation uses **Zod-based Nonce generation** (frontend/src/lib/security/csp.ts):

```typescript
// ✅ Nonce-based CSP
export function getSecurityHeaders(nonce: string) {
  return {
    'Content-Security-Policy': `
      script-src 'self' 'nonce-${nonce}' ...
    `
  };
}
```

**Why Nonce**: Allows legitimate inline scripts while blocking injected scripts

---

## Testing Security

### CSRF Token Validation Test

```typescript
// Test that CSRF validation works
const csrfToken = generateCSRFToken();
const response = await fetch('/api/forums/topics', {
  method: 'POST',
  headers: {
    'Cookie': `csrf_token=${csrfToken}`,
    'x-csrf-token': csrfToken  // Must match
  },
  body: JSON.stringify({ title: '...', content: '...' })
});
// Should succeed (200-201)

// Test that mismatched tokens fail
const response2 = await fetch('/api/forums/topics', {
  method: 'POST',
  headers: {
    'Cookie': `csrf_token=${csrfToken}`,
    'x-csrf-token': 'different_token'  // Doesn't match
  },
  body: JSON.stringify({ title: '...', content: '...' })
});
// Should fail (403)
```

### Rate Limiting Test

```typescript
// Test that rate limiting works
for (let i = 0; i < 6; i++) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
  });
  // First 5 requests: 401 (auth failed)
  // 6th request: 429 (rate limited)
}
```

### CSP Validation

Use online tools to validate CSP:
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [SecurityHeaders.com](https://securityheaders.com/)

---

## Related Documentation

- **[CRITICAL_PATTERNS.md](./CRITICAL_PATTERNS.md)** - Must-follow patterns (includes API Security)
- **[SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md)** - Audit & deployment status
- **[VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md)** - Input validation patterns
- **[DATABASE.md](../DATABASE.md)** - Database architecture (safe access patterns)

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
