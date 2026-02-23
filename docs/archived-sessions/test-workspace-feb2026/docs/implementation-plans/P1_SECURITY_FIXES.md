# P1 Security Fixes - Implementation Plan

**Priority:** P1 (High - Security)
**Estimated Time:** 10-15 hours
**Impact:** Security vulnerabilities, unauthorized access, potential abuse

---

## Overview

This document outlines critical security vulnerabilities discovered in the library system that must be addressed immediately. These issues expose administrative endpoints, lack authentication, and have no rate limiting.

---

## Issue 1: Unauthenticated Admin Endpoints

**Severity:** Critical
**CVSS Score:** 9.1 (Critical)
**Impact:** Unauthorized users can trigger expensive operations, database writes, and system-wide changes

### Vulnerable Endpoints

#### 1. `/api/library/admin/import` (POST)
**File:** `/frontend/src/app/api/library/admin/import/route.ts`
**Vulnerability:** No authentication check
**Impact:**
- Anyone can trigger bulk document imports
- Potential for DoS via expensive database operations
- Unauthorized data modification

```typescript
// CURRENT CODE (VULNERABLE)
export async function POST(request: Request) {
  // ❌ No auth check
  const body = await request.json();
  // ... performs database writes
}
```

#### 2. `/api/library/admin/tags/refresh` (POST)
**File:** `/frontend/src/app/api/library/admin/tags/refresh/route.ts`
**Vulnerability:** No authentication check
**Impact:**
- Anyone can trigger tag extraction on 24,643+ documents
- Expensive CPU/memory operation (VADER sentiment, keyword extraction)
- Potential DoS vector

#### 3. Other Admin Endpoints (Unaudited)
**Action Required:** Full audit of all `/api/*/admin/*` routes

### Implementation Plan

**Time Estimate:** 6-8 hours

**Step 1: Create Authentication Middleware** (2 hours)

Create `/frontend/src/middleware/auth.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    );
  }

  return session;
}

export async function requireAdmin(request: NextRequest) {
  const session = await requireAuth(request);

  if (session instanceof NextResponse) {
    return session; // Already returned 401
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }

  return session;
}

export async function requirePermission(request: NextRequest, permission: string) {
  const session = await requireAuth(request);

  if (session instanceof NextResponse) {
    return session;
  }

  // Check specific permission
  const hasPermission = await checkUserPermission(session.user.id, permission);

  if (!hasPermission) {
    return NextResponse.json(
      { error: `Forbidden - Missing permission: ${permission}` },
      { status: 403 }
    );
  }

  return session;
}
```

**Step 2: Add Auth to Admin Endpoints** (2 hours)

Update each admin route:

```typescript
// /api/library/admin/import/route.ts
import { requireAdmin } from '@/middleware/auth';

export async function POST(request: Request) {
  // ✅ Add auth check at the top
  const authResult = await requireAdmin(request as NextRequest);
  if (authResult instanceof NextResponse) {
    return authResult; // Return 401/403 error
  }

  const session = authResult;

  // ... rest of import logic

  // Log admin action
  await logAdminAction({
    user_id: session.user.id,
    action: 'import_documents',
    details: { count: results.length }
  });
}
```

**Step 3: Create Admin Action Logging** (1 hour)

```sql
-- Migration: Create admin_actions table
CREATE TABLE IF NOT EXISTS auth.admin_actions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth.users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_user ON auth.admin_actions(user_id);
CREATE INDEX idx_admin_actions_created ON auth.admin_actions(created_at);
CREATE INDEX idx_admin_actions_action ON auth.admin_actions(action);
```

**Step 4: Audit All Admin Routes** (1-2 hours)

Search for all admin routes and add auth:

```bash
# Find all admin routes
find /frontend/src/app/api -path "*admin*route.ts"

# Expected results to audit:
# - /api/library/admin/import/route.ts
# - /api/library/admin/tags/refresh/route.ts
# - /api/anarchist/admin/* (if exists)
# - /api/wiki/admin/* (if exists)
# - /api/forums/admin/* (if exists)
```

**Step 5: Add Tests** (1 hour)

```typescript
// __tests__/api/admin/import.test.ts
describe('POST /api/library/admin/import', () => {
  it('returns 401 when not authenticated', async () => {
    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    const response = await POST(mockRequestWithUser);
    expect(response.status).toBe(403);
  });

  it('succeeds when user is admin', async () => {
    const response = await POST(mockRequestWithAdmin);
    expect(response.status).toBe(200);
  });

  it('logs admin action on success', async () => {
    await POST(mockRequestWithAdmin);
    const logs = await getAdminLogs();
    expect(logs).toContainEqual(expect.objectContaining({
      action: 'import_documents'
    }));
  });
});
```

---

## Issue 2: No Rate Limiting

**Severity:** High
**CVSS Score:** 7.5 (High)
**Impact:** DoS attacks, resource exhaustion, abuse of expensive operations

### Vulnerable Endpoints

**All API routes lack rate limiting:**
- `/api/library/documents` - Database queries
- `/api/library/search` - Full-text search (expensive)
- `/api/anarchist/documents` - Database queries
- `/api/library/admin/*` - Expensive operations (even with auth)

### Implementation Plan

**Time Estimate:** 4-6 hours

**Step 1: Choose Rate Limiting Strategy** (30 minutes)

**Options:**
1. **Redis-based** (Recommended for production)
   - Shared state across multiple instances
   - Fast in-memory operations
   - Requires Redis container

2. **In-memory** (Simple, single-instance only)
   - No external dependencies
   - Works for current single-instance deployment
   - Doesn't scale horizontally

**Recommendation:** Start with in-memory, plan Redis migration for horizontal scaling

**Step 2: Implement Rate Limiter** (2 hours)

Create `/frontend/src/lib/rate-limit.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

type RateLimitConfig = {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per token
};

export function rateLimit(config: RateLimitConfig) {
  const tokenCache = new LRUCache({
    max: config.uniqueTokenPerInterval || 500,
    ttl: config.interval || 60000,
  });

  return {
    check: async (request: NextRequest, limit: number, token: string) => {
      const tokenCount = (tokenCache.get(token) as number[]) || [0];

      if (tokenCount[0] === 0) {
        tokenCache.set(token, [1]);
        return { success: true };
      }

      tokenCount[0] += 1;

      const currentUsage = tokenCount[0];
      const isRateLimited = currentUsage > limit;

      return {
        success: !isRateLimited,
        limit,
        remaining: limit - currentUsage,
        reset: new Date(Date.now() + config.interval),
      };
    },
  };
}

// Create limiters for different endpoint types
export const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 unique IPs per minute
});

export const strictLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100, // Fewer unique tokens for strict endpoints
});

export async function applyRateLimit(
  request: NextRequest,
  limit: number = 60
): Promise<NextResponse | null> {
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const result = await limiter.check(request, limit, ip);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        limit: result.limit,
        remaining: 0,
        reset: result.reset.toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.reset.getTime().toString(),
          'Retry-After': Math.ceil(config.interval / 1000).toString()
        }
      }
    );
  }

  return null; // No rate limit hit
}
```

**Step 3: Apply to Endpoints** (1.5 hours)

```typescript
// /api/library/documents/route.ts
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limit (60 requests/minute default)
  const rateLimitResult = await applyRateLimit(request);
  if (rateLimitResult) return rateLimitResult;

  // ... rest of handler
}
```

**Different limits for different endpoints:**
```typescript
// Public search: 30 req/min
await applyRateLimit(request, 30);

// Document list: 60 req/min
await applyRateLimit(request, 60);

// Admin endpoints: 10 req/min (even with auth)
await applyRateLimit(request, 10);
```

**Step 4: Add Rate Limit Monitoring** (1 hour)

```typescript
// Log rate limit hits
if (!result.success) {
  console.warn('Rate limit exceeded', {
    ip,
    endpoint: request.url,
    limit: result.limit,
    timestamp: new Date().toISOString()
  });

  // Optional: Store in database for analysis
  await logRateLimitHit({
    ip,
    endpoint: request.url,
    limit: result.limit
  });
}
```

**Step 5: Add Tests** (1 hour)

```typescript
describe('Rate Limiting', () => {
  it('allows requests under limit', async () => {
    for (let i = 0; i < 60; i++) {
      const response = await GET(mockRequest);
      expect(response.status).not.toBe(429);
    }
  });

  it('blocks requests over limit', async () => {
    // Make 60 requests (at limit)
    for (let i = 0; i < 60; i++) {
      await GET(mockRequest);
    }

    // 61st request should be blocked
    const response = await GET(mockRequest);
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('resets after interval', async () => {
    // Hit rate limit
    for (let i = 0; i < 61; i++) {
      await GET(mockRequest);
    }

    // Wait for interval to pass
    await sleep(60000);

    // Should allow requests again
    const response = await GET(mockRequest);
    expect(response.status).not.toBe(429);
  });
});
```

---

## Issue 3: Missing CSRF Protection

**Severity:** Medium-High
**CVSS Score:** 6.5 (Medium)
**Impact:** Cross-site request forgery attacks on POST/PUT/DELETE endpoints

### Implementation Plan

**Time Estimate:** 2-3 hours

**Step 1: Add CSRF Tokens** (1.5 hours)

```typescript
// /frontend/src/lib/csrf.ts
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export async function generateCSRFToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');

  cookies().set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  });

  return token;
}

export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  const cookieToken = request.cookies.get('csrf-token')?.value;
  const headerToken = request.headers.get('x-csrf-token');

  if (!cookieToken || !headerToken) {
    return false;
  }

  return cookieToken === headerToken;
}

export async function requireCSRF(request: NextRequest): Promise<NextResponse | null> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null; // Skip CSRF for safe methods
  }

  const isValid = await validateCSRFToken(request);

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  return null;
}
```

**Step 2: Apply to Mutation Endpoints** (1 hour)

```typescript
// /api/library/admin/import/route.ts
import { requireCSRF } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  // Check CSRF
  const csrfResult = await requireCSRF(request);
  if (csrfResult) return csrfResult;

  // Check auth
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  // ... rest of logic
}
```

**Step 3: Frontend Integration** (30 minutes)

```typescript
// /frontend/src/lib/api-client.ts
export async function apiPost(url: string, data: any) {
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken || ''
    },
    body: JSON.stringify(data)
  });

  return response;
}
```

---

## Security Checklist

### Authentication
- [ ] All `/api/*/admin/*` routes require authentication
- [ ] Admin role check implemented and tested
- [ ] Session management secure (httpOnly cookies)
- [ ] Password hashing uses bcrypt/argon2 (verify existing)
- [ ] Admin action logging implemented

### Rate Limiting
- [ ] Rate limiting applied to all public API routes
- [ ] Stricter limits on expensive operations (search, import)
- [ ] Rate limit headers included in responses
- [ ] Rate limit monitoring/logging implemented
- [ ] Tests cover rate limit scenarios

### CSRF Protection
- [ ] CSRF tokens generated and validated
- [ ] All POST/PUT/DELETE endpoints protected
- [ ] Frontend sends CSRF tokens with mutations
- [ ] Tokens rotate on login/logout
- [ ] Tests cover CSRF scenarios

### Additional Hardening
- [ ] SQL injection prevention (parameterized queries - verify existing)
- [ ] XSS prevention (output encoding - verify existing)
- [ ] CORS configured correctly (verify existing)
- [ ] Security headers set (CSP, X-Frame-Options, etc.)
- [ ] Sensitive data not logged (passwords, tokens)
- [ ] Environment variables secured (.env not in git)

---

## Deployment Plan

**Branch:** `security/auth-and-rate-limiting`

**Migration Files:**
- `002-admin-actions-table.sql` (admin logging)
- `003-rate-limit-logs-table.sql` (optional monitoring)

**Configuration:**
```env
# .env.local
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
CSRF_SECRET=<generate with openssl rand -hex 32>
```

**Rollout:**
1. Deploy to staging
2. Test all admin endpoints require auth
3. Test rate limiting with load testing tool
4. Test CSRF protection with Postman
5. Deploy to production
6. Monitor logs for auth failures
7. Monitor rate limit hits

---

## Monitoring & Alerts

**Metrics to Track:**
```sql
-- Failed auth attempts (potential attack)
SELECT COUNT(*) as failed_attempts, ip_address
FROM auth.login_attempts
WHERE success = false
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 10;

-- Rate limit hits (potential abuse)
SELECT COUNT(*) as hits, ip_address, endpoint
FROM rate_limit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address, endpoint
ORDER BY hits DESC;

-- Admin actions (audit trail)
SELECT user_id, action, COUNT(*) as count
FROM auth.admin_actions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, action;
```

**Alerts:**
- Email alert if >100 failed auth attempts from single IP in 1 hour
- Email alert if >1000 rate limit hits in 1 hour
- Daily summary of admin actions

---

## Risk Assessment

**Risks:**
- **Medium:** Breaking existing admin workflows if auth added incorrectly
- **Low:** Rate limiting may block legitimate heavy users
- **Low:** CSRF may break existing API clients

**Mitigation:**
- Comprehensive testing before production deploy
- Start with generous rate limits, tighten based on monitoring
- Provide clear error messages for rate limiting
- Document CSRF requirements for API clients

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-17
**Author:** Claude Code (Security Analysis)
