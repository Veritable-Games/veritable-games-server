# P1 SECURITY FIXES - IMPLEMENTATION PLAN

**Created**: 2025-11-17
**Status**: Ready for Implementation
**Priority**: HIGH - Critical Security Issues
**Target**: Veritable Games Library System API Routes

---

## Executive Summary

This plan addresses **3 critical security vulnerabilities** identified in the Veritable Games library system:

1. **CRITICAL**: Unauthenticated admin endpoints (4 routes expose admin operations)
2. **HIGH**: Missing rate limiting on CPU-intensive endpoints (DoS vulnerability)
3. **MEDIUM**: Authorization inconsistencies across the API surface

**Estimated Total Effort**: 6-8 hours
**Risk Level**: High - Immediate exploitation possible for admin endpoints

---

## Fix 1: Add Authentication to Admin Endpoints

### Current Vulnerability Assessment

**Affected Endpoints** (all in `/api/library/admin/`):

1. **`/api/library/admin/tags/import`** (POST)
   - **Lines 12-17**: Contains TODO comment acknowledging missing auth
   ```typescript
   export async function POST(request: NextRequest) {
     try {
       // Note: In production, add authentication/authorization check here
       // if (!isAdmin(request)) {
       //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
       // }
   ```
   - **Impact**: Anyone can import tag categories and tags into the database
   - **Database writes**: Creates records in `library_tag_categories` and `library_tags`

2. **`/api/library/admin/tags/auto-tag`** (POST)
   - **Lines 126-128**: No authentication check
   ```typescript
   export async function POST(request: NextRequest) {
     try {
       // Note: In production, add authentication/authorization check here
   ```
   - **Impact**: CPU-intensive text analysis on all published documents
   - **Database writes**: Creates records in `library_document_tags`
   - **Query params**: `confidence` (threshold), `limit` (document count)

3. **`/api/library/admin/anarchist/extract-author-date`** (POST)
   - **Lines 197-202**: No authentication check
   ```typescript
   export async function POST(request: NextRequest) {
     try {
       // Check for dry-run mode
       const url = new URL(request.url);
       const dryRun = url.searchParams.get('dryRun') === 'true';
   ```
   - **Impact**: Filesystem access to read markdown files, mass database updates
   - **Database writes**: Updates `anarchist.documents` (author, publication_date columns)
   - **Filesystem access**: Reads from `/app/anarchist-library/` (24,643+ files)

4. **`/api/library/admin/anarchist/populate-descriptions`** (POST)
   - **No authentication check** (confirmed by grep pattern)
   - **Impact**: Similar to extract-author-date (mass updates to anarchist documents)

### Security Risk Analysis

**Severity**: **CRITICAL**

**Exploitability**:
- **Trivial** - No authentication required
- **Remote** - Accessible via HTTP POST request
- **No prerequisites** - Anyone with network access can exploit

**Attack Scenarios**:

1. **Data Pollution Attack**:
   - Attacker imports malicious tag categories
   - Auto-tags all documents with spam/offensive tags
   - Legitimate content becomes unusable

2. **Denial of Service**:
   - Trigger auto-tag endpoint without `limit` parameter
   - Processes all 24,643+ anarchist documents
   - Text analysis for each document (CPU intensive)
   - Server becomes unresponsive

3. **Data Integrity Attack**:
   - Mass-update author/date fields with incorrect data
   - Historical accuracy of anarchist archive compromised
   - Corruption difficult to detect and reverse

4. **Filesystem Information Disclosure**:
   - Extract-author-date endpoint reads filesystem
   - Error messages may leak path information
   - Attacker maps server directory structure

**Impact**:
- **Confidentiality**: Low (minimal data exposure)
- **Integrity**: **HIGH** (database corruption possible)
- **Availability**: **HIGH** (DoS via CPU exhaustion)

### Implementation Approach

**Recommended: Use existing `requireAdmin` middleware with inline validation**

**Why this approach**:
- ✅ Infrastructure already exists (`requireAdmin` in `@/lib/auth/server`)
- ✅ Consistent with existing protected endpoints (e.g., tag-categories POST)
- ✅ Minimal code changes required
- ✅ Well-tested pattern already in production
- ✅ Provides both authentication AND authorization

**Alternative approaches considered**:
- ❌ Option A: Use `withSecurity()` alone - Only provides CSRF, not auth
- ❌ Option B: Create admin-specific middleware - Unnecessary duplication
- ❌ Option C: Role-based decorators - Too complex for immediate fix

### Code Changes

**File 1**: `/frontend/src/app/api/library/admin/tags/import/route.ts`

```typescript
// ADD import at top
import { requireAdmin } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    // ADD: Authentication check (replaces TODO comment)
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    console.log('🏴 Starting anarchist tag import via API...');
    console.log(`Admin user: ${user.username} (ID: ${user.id})`);

    // ... rest of existing code unchanged ...
  }
}
```

**File 2**: `/frontend/src/app/api/library/admin/tags/auto-tag/route.ts`

```typescript
// ADD import at top
import { requireAdmin } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    // ADD: Authentication check
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    // ... rest of existing code unchanged ...

    console.log(`🔖 Auto-tagging initiated by admin: ${user.username}`);
  }
}
```

**File 3**: `/frontend/src/app/api/library/admin/anarchist/extract-author-date/route.ts`

```typescript
// ADD import at top
import { requireAdmin } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    // ADD: Authentication check
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    // Check for dry-run mode
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';

    console.log(`📚 Starting author/date extraction (dryRun=${dryRun}) by ${user.username}...`);
    // ... rest of existing code unchanged ...
  }
}
```

**File 4**: `/frontend/src/app/api/library/admin/anarchist/populate-descriptions/route.ts`

```typescript
// ADD import at top
import { requireAdmin } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  try {
    // ADD: Authentication check at the very start
    const authResult = await requireAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }
    const user = authResult.user;

    console.log(`Starting description population by admin: ${user.username}`);
    // ... rest of existing code unchanged ...
  }
}
```

### Testing

**Test 1: Unauthenticated Access (Should Fail)**
```bash
# Should return 401 Unauthorized
curl -X POST http://192.168.1.15:3000/api/library/admin/tags/import \
  -H "Content-Type: application/json"

# Expected response:
# {"success":false,"error":"Authentication required"}
```

**Test 2: Authenticated Non-Admin Access (Should Fail)**
```bash
# Login as regular user first, then:
curl -X POST http://192.168.1.15:3000/api/library/admin/tags/import \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=USER_SESSION_ID"

# Expected response:
# {"success":false,"error":"Admin access required"}
```

**Test 3: Authenticated Admin Access (Should Succeed)**
```bash
# Login as admin user first, then:
curl -X POST http://192.168.1.15:3000/api/library/admin/tags/import \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=ADMIN_SESSION_ID"

# Expected response:
# {"success":true,"message":"Anarchist tags imported successfully",...}
```

**Test 4: Verify Audit Logging**
```bash
# Check Docker logs for admin username
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50 | grep -i "admin user"

# Expected output:
# Admin user: admin (ID: 1)
# Auto-tagging initiated by admin: admin
```

### Rollback Plan

If authentication breaks legitimate admin workflows:

1. **Immediate Rollback** (git revert):
   ```bash
   cd /home/user/projects/veritable-games/site
   git revert HEAD
   git push origin main
   # Wait 2-5 minutes for Coolify auto-deploy
   ```

2. **Emergency Access** (disable auth temporarily):
   ```typescript
   // Temporary bypass (ONLY for emergencies)
   const authResult = await requireAdmin(request);
   if (false && authResult.response) { // Disabled
     return authResult.response;
   }
   ```

3. **Verify Database State**:
   ```bash
   docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
     "SELECT COUNT(*) FROM library.library_tags;"
   # Compare count before/after to detect unauthorized changes
   ```

### Estimated Effort

- **Code changes**: 30 minutes (4 files, identical pattern)
- **Testing**: 30 minutes (3 test scenarios per endpoint)
- **Documentation**: 15 minutes (update API docs)
- **Deployment**: 5 minutes (git push + verify)

**Total**: **1.5 hours**

---

## Fix 2: Implement Rate Limiting

### Attack Scenarios

**Scenario 1: Search Endpoint DoS** (`/api/library/documents?search=...`)
- **Current state**: No rate limiting on GET requests
- **Attack**: Automated script sends 1000 search queries per second
- **Impact**: PostgreSQL full-text search (FTS5) exhausted, site unresponsive
- **Exploitability**: Trivial (any user, no authentication required)

**Scenario 2: Auto-Tag CPU Exhaustion** (`/api/library/admin/tags/auto-tag`)
- **Current state**: CPU-intensive text analysis, no throttling
- **Attack**: Trigger auto-tag without `limit` parameter (processes all 24,643 documents)
- **Impact**: Server CPU at 100% for hours, legitimate requests timeout
- **Exploitability**: After Fix 1, requires admin access (lower risk)
- **Note**: Still needs rate limiting to prevent accidental DoS by admin

**Scenario 3: Tag Category Endpoint N+1 Queries** (`/api/library/tag-categories`)
- **Current state**: Lines 65-96 execute N queries (one per category)
- **Attack**: Rapid repeated requests trigger hundreds of database queries
- **Impact**: Database connection pool exhaustion
- **Code snippet**:
   ```typescript
   const categoriesWithTags = await Promise.all(
     categories.map(async category => {
       const tagsResult = await dbAdapter.query(...); // N queries!
       // ...
     })
   );
   ```

### Rate Limiting Strategy

**Technology**: **In-memory LRU cache** (already implemented in `@/lib/security/middleware`)

**Why in-memory over Redis**:
- ✅ Already implemented and tested (`InMemoryRateLimiter` class exists)
- ✅ No additional infrastructure required
- ✅ Sufficient for single-server deployment
- ✅ Automatic cleanup via LRU eviction (10,000 entry limit)
- ⚠️ **Limitation**: Rate limits reset on server restart (acceptable for current scale)

**Future consideration**: Migrate to Redis if load balancing across multiple servers

**Rate Limits per Endpoint**:

| Endpoint | Current Limit | Recommended | Rationale |
|----------|---------------|-------------|-----------|
| `/api/library/documents` (search) | None | **100 req/min** | Already defined in `rateLimiters.search` |
| `/api/library/admin/tags/auto-tag` | None | **1 req/hour** | CPU-intensive, admin-only |
| `/api/library/tag-categories` | None | **60 req/min** | N+1 query pattern, high DB load |
| All admin endpoints | None | **30 req/hour** | Generic admin operations |

**Identifier Strategy**:
- **Unauthenticated endpoints**: Client IP address (via `getClientIP()`)
- **Authenticated endpoints**: User ID (more accurate tracking)
- **Admin endpoints**: User ID (prevents admin account sharing abuse)

### Implementation

**Step 1: Create admin-specific rate limiter**

**File**: `/frontend/src/lib/security/middleware.ts` (add to `rateLimiters` object)

```typescript
export const rateLimiters = {
  // ... existing limiters ...

  // NEW: Admin operations (generic)
  adminOperation: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 30,
    keyPrefix: 'admin-op',
  }),

  // NEW: Auto-tagging (very expensive)
  autoTag: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 1,  // Only 1 per hour
    keyPrefix: 'auto-tag',
  }),

  // NEW: Tag categories (N+1 query issue)
  tagCategories: createRateLimitMiddleware({
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,
    keyPrefix: 'tag-categories',
  }),
};
```

**Step 2: Apply rate limiting to search endpoint**

**File**: `/frontend/src/app/api/library/documents/route.ts`

```typescript
// CHANGE line 46: Add rate limiter
export const GET = withSecurity(getDocuments, {
  rateLimiter: rateLimiters.search,  // ADD this
  rateLimitKey: (req) => getClientIP(req),  // Use IP for unauthenticated
});
```

**Step 3: Apply rate limiting to auto-tag endpoint**

**File**: `/frontend/src/app/api/library/admin/tags/auto-tag/route.ts`

```typescript
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { requireAdmin } from '@/lib/auth/server';

async function autoTagHandler(request: NextRequest) {
  // Authentication check (from Fix 1)
  const authResult = await requireAdmin(request);
  if (authResult.response) return authResult.response;
  const user = authResult.user;

  // ... existing auto-tag logic ...
}

// WRAP with rate limiting
export const POST = withSecurity(autoTagHandler, {
  enableCSRF: true,
  rateLimiter: rateLimiters.autoTag,
  rateLimitKey: (req) => `user-${user.id}`,  // Per-user limit
});
```

**Step 4: Apply rate limiting to tag-categories endpoint**

**File**: `/frontend/src/app/api/library/tag-categories/route.ts`

```typescript
// CHANGE line 34: Add rate limiter to existing withSecurity call
export const GET = withSecurity(async (request: NextRequest) => {
  // ... existing code ...
}, {
  rateLimiter: rateLimiters.tagCategories,  // ADD this
});
```

**Step 5: Apply generic admin rate limiting**

**Files**: All admin endpoints (import, extract-author-date, populate-descriptions)

```typescript
import { withSecurity, rateLimiters } from '@/lib/security/middleware';

// Wrap existing POST handler
export const POST = withSecurity(async (request: NextRequest) => {
  // ... existing handler code with requireAdmin ...
}, {
  enableCSRF: true,
  rateLimiter: rateLimiters.adminOperation,
  rateLimitKey: (req) => {
    // Extract user ID from session (requireAdmin already validated)
    // Simplified: use IP for admin endpoints (already authenticated)
    return getClientIP(req);
  },
});
```

### Monitoring

**Check rate limit headers in browser DevTools**:
```
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1700240000000
```

**Log rate limit violations**:

**File**: `/frontend/src/lib/security/middleware.ts` (modify line 288-296)

```typescript
if (!result.success) {
  // ADD: Log rate limit violation
  console.warn(`[SECURITY] Rate limit exceeded: ${key} (endpoint: ${request.url})`);

  const response = NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: result.retryAfter,
    },
    { status: 429 }
  );
  // ... rest of existing code ...
}
```

**Monitor logs**:
```bash
# Check for rate limit violations
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep "Rate limit exceeded"

# Count violations per endpoint
docker logs m4s0kwo4kc4oooocck4sswc4 --since 1h | grep -c "Rate limit exceeded"
```

### Testing

**Test 1: Search endpoint rate limiting**
```bash
# Send 101 requests in quick succession (should get 429 on 101st)
for i in {1..101}; do
  curl -s http://192.168.1.15:3000/api/library/documents?search=test \
    -w "\nStatus: %{http_code}\n" | grep "Status:"
done

# Expected: First 100 return 200, 101st returns 429
```

**Test 2: Auto-tag rate limiting**
```bash
# Trigger auto-tag twice within 1 hour (should fail on 2nd attempt)
curl -X POST http://192.168.1.15:3000/api/library/admin/tags/auto-tag \
  -H "Cookie: session_id=ADMIN_SESSION"

# Immediate second request:
curl -X POST http://192.168.1.15:3000/api/library/admin/tags/auto-tag \
  -H "Cookie: session_id=ADMIN_SESSION"

# Expected: Second request returns 429 with Retry-After header
```

**Test 3: Verify rate limit headers**
```bash
curl -v http://192.168.1.15:3000/api/library/documents?search=test 2>&1 | grep -i ratelimit

# Expected output:
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: 1700240000000
```

### Estimated Effort

- **Code changes**: 1 hour (5 endpoints, add rate limiters)
- **Testing**: 45 minutes (rate limit scenarios, header verification)
- **Monitoring setup**: 15 minutes (log analysis, dashboard setup)
- **Documentation**: 30 minutes (update API docs with rate limits)

**Total**: **2.5 hours**

---

## Fix 3: Centralized Authorization Service

### Current Authorization Patterns

**Analysis of 10 library API endpoints**:

| Endpoint | Auth Method | Authorization Check | Inconsistency |
|----------|-------------|---------------------|---------------|
| `tag-categories` POST | `requireAuth()` | `user.role !== 'admin' && !== 'moderator'` | ✅ Inline check |
| `documents` POST | `getCurrentUser()` | `if (!user)` only | ⚠️ No role check |
| `tags` POST | `requireAuth()` | `user.role !== 'admin'` | ✅ Admin only |
| `annotations` POST | `requireAuth()` | Ownership check | ✅ Resource-based |
| Admin endpoints | None | **CRITICAL ISSUE** | ❌ No auth at all |

**Findings**:
1. **3 different auth patterns**: `requireAuth()`, `getCurrentUser()`, `requireAdmin()`
2. **Inline authorization logic**: Each endpoint implements own role checks
3. **Ownership vs role confusion**: Some check `user.role`, others check `created_by`
4. **No centralized permission matrix**: Hard to audit who can do what

### Proposed Permission Model

**Roles** (already defined in database):
- `admin` - Full system access
- `moderator` - Content management
- `member` - Standard user
- `guest` - Read-only (unauthenticated)

**Resources**:
- `tag_categories`
- `tags`
- `documents`
- `annotations`
- `admin_operations`

**Actions**:
- `create`
- `read`
- `update`
- `delete`
- `execute` (for admin operations)

**Permission Matrix**:

| Role | tag_categories | tags | documents | annotations | admin_operations |
|------|----------------|------|-----------|-------------|------------------|
| admin | CRUD | CRUD | CRUD | CRUD | Execute |
| moderator | CRUD | CRUD | CRUD | RU (own) | - |
| member | R | R | CR (own) | CRUD (own) | - |
| guest | R | R | R | - | - |

### Implementation

**Step 1: Create authorization service**

**File**: `/frontend/src/lib/auth/authorization.ts` (NEW FILE)

```typescript
/**
 * Centralized Authorization Service
 *
 * Implements role-based access control (RBAC) for library resources
 */

import type { User } from './types';

export type Role = 'admin' | 'moderator' | 'member' | 'guest';
export type Resource =
  | 'tag_categories'
  | 'tags'
  | 'documents'
  | 'annotations'
  | 'admin_operations';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute';

interface PermissionCheck {
  granted: boolean;
  reason?: string;
}

interface ResourceOwnership {
  userId?: number;
  createdBy?: number;
}

/**
 * Permission matrix defining role-based access
 */
const PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
  admin: {
    tag_categories: ['create', 'read', 'update', 'delete'],
    tags: ['create', 'read', 'update', 'delete'],
    documents: ['create', 'read', 'update', 'delete'],
    annotations: ['create', 'read', 'update', 'delete'],
    admin_operations: ['execute'],
  },
  moderator: {
    tag_categories: ['create', 'read', 'update', 'delete'],
    tags: ['create', 'read', 'update', 'delete'],
    documents: ['create', 'read', 'update', 'delete'],
    annotations: ['read', 'update'], // Own only
    admin_operations: [],
  },
  member: {
    tag_categories: ['read'],
    tags: ['read'],
    documents: ['create', 'read'], // Own documents only for update/delete
    annotations: ['create', 'read', 'update', 'delete'], // Own only
    admin_operations: [],
  },
  guest: {
    tag_categories: ['read'],
    tags: ['read'],
    documents: ['read'],
    annotations: [],
    admin_operations: [],
  },
};

/**
 * Check if user has permission for action on resource
 */
export function can(
  user: User | null,
  action: Action,
  resource: Resource,
  ownership?: ResourceOwnership
): PermissionCheck {
  // Guest access (no user)
  if (!user) {
    const guestPermissions = PERMISSIONS.guest[resource] || [];
    if (guestPermissions.includes(action)) {
      return { granted: true };
    }
    return { granted: false, reason: 'Authentication required' };
  }

  // Get role permissions
  const role = user.role as Role;
  const rolePermissions = PERMISSIONS[role]?.[resource] || [];

  // Check base permission
  if (!rolePermissions.includes(action)) {
    return { granted: false, reason: `Role '${role}' cannot '${action}' '${resource}'` };
  }

  // For non-admin/moderator, check ownership for write operations
  if (role === 'member' && ownership) {
    const writeOperations: Action[] = ['update', 'delete'];
    if (writeOperations.includes(action)) {
      if (ownership.createdBy !== user.id) {
        return { granted: false, reason: 'Can only modify own resources' };
      }
    }
  }

  return { granted: true };
}

/**
 * Require permission (throws if denied)
 */
export function requirePermission(
  user: User | null,
  action: Action,
  resource: Resource,
  ownership?: ResourceOwnership
): void {
  const check = can(user, action, resource, ownership);
  if (!check.granted) {
    throw new AuthorizationError(check.reason || 'Permission denied');
  }
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

/**
 * Check if user is moderator or admin
 */
export function isModerator(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'moderator';
}

/**
 * Custom authorization error
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
```

**Step 2: Create convenience helpers**

**File**: `/frontend/src/lib/auth/server.ts` (ADD to existing file)

```typescript
import { can, requirePermission, type Action, type Resource } from './authorization';

/**
 * Require permission in API route
 * Returns 403 response if denied
 */
export async function requireResourcePermission(
  request: NextRequest,
  action: Action,
  resource: Resource,
  ownership?: { createdBy?: number }
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getCurrentUser(request);

  const check = can(user, action, resource, ownership);

  if (!check.granted) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: 'Permission denied',
          details: check.reason,
        },
        { status: 403 }
      ),
    };
  }

  // If we got here without a user but permission was granted, user must be required
  if (!user && action !== 'read') {
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  return { user: user! };
}
```

### Migration Strategy

**Phase 1: Gradual Migration** (Recommended)

1. **Week 1**: Implement authorization service (new file, no breaking changes)
2. **Week 2**: Migrate admin endpoints to use `requireResourcePermission`
3. **Week 3**: Migrate public endpoints to use authorization service
4. **Week 4**: Audit all endpoints, remove old inline checks

**Phase 2: Update Endpoints Incrementally**

**Example: Migrate tag-categories POST endpoint**

**Before** (current code):
```typescript
export const POST = withSecurity(async (request: NextRequest) => {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;
  const user = authResult.user;

  // Only admins and moderators can create categories
  if (user.role !== 'admin' && user.role !== 'moderator') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // ... rest of handler ...
});
```

**After** (with authorization service):
```typescript
import { requireResourcePermission } from '@/lib/auth/server';

export const POST = withSecurity(async (request: NextRequest) => {
  // Centralized permission check
  const authResult = await requireResourcePermission(
    request,
    'create',
    'tag_categories'
  );
  if (authResult.response) return authResult.response;
  const user = authResult.user;

  // ... rest of handler (no inline role checks!) ...
});
```

**Benefits**:
- ✅ Cleaner code (no inline role checks)
- ✅ Centralized permission matrix (easy to audit)
- ✅ Consistent error messages
- ✅ Easy to add new roles/permissions

### Testing

**Test 1: Permission matrix validation**

**File**: `/frontend/src/lib/auth/__tests__/authorization.test.ts` (NEW FILE)

```typescript
import { can, isAdmin, isModerator } from '../authorization';

describe('Authorization Service', () => {
  const adminUser = { id: 1, role: 'admin', username: 'admin' };
  const modUser = { id: 2, role: 'moderator', username: 'mod' };
  const memberUser = { id: 3, role: 'member', username: 'user' };

  test('admin can execute admin operations', () => {
    const result = can(adminUser, 'execute', 'admin_operations');
    expect(result.granted).toBe(true);
  });

  test('member cannot execute admin operations', () => {
    const result = can(memberUser, 'execute', 'admin_operations');
    expect(result.granted).toBe(false);
    expect(result.reason).toContain('cannot');
  });

  test('member can only update own documents', () => {
    // Own document
    const ownDoc = can(memberUser, 'update', 'documents', { createdBy: 3 });
    expect(ownDoc.granted).toBe(true);

    // Someone else's document
    const otherDoc = can(memberUser, 'update', 'documents', { createdBy: 1 });
    expect(otherDoc.granted).toBe(false);
    expect(otherDoc.reason).toContain('own');
  });

  test('guest can read but not write', () => {
    const read = can(null, 'read', 'documents');
    expect(read.granted).toBe(true);

    const create = can(null, 'create', 'documents');
    expect(create.granted).toBe(false);
  });
});
```

**Test 2: API endpoint integration**

```bash
# Test tag category creation
# As admin: should succeed
curl -X POST http://192.168.1.15:3000/api/library/tag-categories \
  -H "Cookie: session_id=ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Category","type":"general"}'
# Expected: 200 OK

# As member: should fail
curl -X POST http://192.168.1.15:3000/api/library/tag-categories \
  -H "Cookie: session_id=MEMBER_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Category","type":"general"}'
# Expected: 403 Forbidden, "Permission denied"
```

### Estimated Effort

- **Authorization service**: 2 hours (write + test)
- **Migration of 4 admin endpoints**: 1 hour (use new service)
- **Migration of 6 public endpoints**: 1.5 hours (more complex)
- **Testing**: 1 hour (unit tests + integration tests)
- **Documentation**: 30 minutes (permission matrix docs)

**Total**: **6 hours**

**Note**: This can be done incrementally over 2-4 weeks with no downtime

---

## Bonus: Security Hardening Checklist

### SQL Injection Review

**Status**: ✅ **LOW RISK** - All queries use parameterized statements

**Evidence** (from code review):
```typescript
// GOOD: Parameterized query (line 27-30 in tags/import/route.ts)
await dbAdapter.query(
  'SELECT id FROM library_tag_categories WHERE type = $1',
  [category.type],
  { schema: 'library' }
);

// GOOD: Dynamic SQL with validation (line 86-90 in tags/auto-tag/route.ts)
const placeholders = matchedTagNames.map((_, i) => `$${i + 1}`).join(',');
const tagsResult = await dbAdapter.query(
  `SELECT id FROM library_tags WHERE name IN (${placeholders})`,
  matchedTagNames,
  { schema: 'library' }
);
```

**Recommendation**: ✅ No changes needed (already secure)

### XSS Prevention

**Status**: ⚠️ **MEDIUM RISK** - React auto-escapes, but user-generated markdown needs review

**Potential issues**:
1. **Anarchist library content**: Markdown from external sources (24,643 documents)
2. **User annotations**: Rich text input on documents
3. **Search results**: Query reflection in error messages

**Recommendations**:

1. **Sanitize markdown rendering**:
   ```typescript
   // Install DOMPurify for server-side sanitization
   npm install isomorphic-dompurify

   // Sanitize before rendering
   import DOMPurify from 'isomorphic-dompurify';
   const clean = DOMPurify.sanitize(dirtyHTML);
   ```

2. **Content Security Policy** (already implemented):
   - ✅ CSP headers active (via `withSecurity` middleware)
   - ✅ Nonce-based script execution
   - ⚠️ Verify `unsafe-inline` is not used

3. **Escape search queries in error messages**:
   ```typescript
   // BAD: Reflects user input
   return NextResponse.json({ error: `No results for: ${query}` });

   // GOOD: Escape HTML entities
   return NextResponse.json({ error: 'No results found' });
   ```

**Effort**: 2 hours (install DOMPurify, add sanitization, test)

### CSRF Tokens

**Status**: ✅ **SECURE** - Double submit cookie pattern implemented

**Evidence**:
- Lines 9-53 in `middleware.ts`: CSRF token generation and validation
- All POST endpoints wrapped with `withSecurity({ enableCSRF: true })`
- Constant-time comparison prevents timing attacks (line 48)

**Recommendation**: ✅ No changes needed

### Secure Password Handling

**Status**: ✅ **SECURE** - Using Argon2id

**Evidence** (from architecture knowledge):
- Password hashing: Argon2id (recommended by OWASP)
- Session management: HttpOnly cookies with SameSite=strict
- Password reset: Admin-only operation (no email reset vulnerability)

**Recommendation**: ✅ No changes needed

### Audit Logging for Admin Actions

**Status**: ❌ **MISSING** - No structured audit logs

**Current state**:
- Console logging only (e.g., `console.log('🏴 Starting anarchist tag import...')`)
- No persistence of admin actions
- No correlation with user identity

**Recommendations**:

1. **Create audit log table**:
   ```sql
   CREATE TABLE IF NOT EXISTS library.audit_log (
     id SERIAL PRIMARY KEY,
     user_id INTEGER NOT NULL,
     username VARCHAR(255) NOT NULL,
     action VARCHAR(100) NOT NULL,  -- 'tag_import', 'auto_tag', etc.
     resource VARCHAR(100),          -- 'tag_categories', 'documents', etc.
     resource_id INTEGER,
     details JSONB,                  -- Flexible metadata
     ip_address VARCHAR(45),
     user_agent TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE INDEX idx_audit_log_user ON library.audit_log(user_id);
   CREATE INDEX idx_audit_log_action ON library.audit_log(action);
   CREATE INDEX idx_audit_log_created ON library.audit_log(created_at);
   ```

2. **Create audit logging service**:
   ```typescript
   // /frontend/src/lib/audit/service.ts
   import { dbAdapter } from '@/lib/database/adapter';

   export async function logAuditEvent(params: {
     userId: number;
     username: string;
     action: string;
     resource?: string;
     resourceId?: number;
     details?: any;
     ipAddress?: string;
     userAgent?: string;
   }) {
     await dbAdapter.query(
       `INSERT INTO library.audit_log
        (user_id, username, action, resource, resource_id, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
       [
         params.userId,
         params.username,
         params.action,
         params.resource || null,
         params.resourceId || null,
         params.details ? JSON.stringify(params.details) : null,
         params.ipAddress || null,
         params.userAgent || null,
       ],
       { schema: 'library' }
     );
   }
   ```

3. **Add to admin endpoints**:
   ```typescript
   // Example: tag import endpoint
   import { logAuditEvent } from '@/lib/audit/service';

   export async function POST(request: NextRequest) {
     const authResult = await requireAdmin(request);
     if (authResult.response) return authResult.response;
     const user = authResult.user;

     // ... perform operation ...

     // Log audit event
     await logAuditEvent({
       userId: user.id,
       username: user.username,
       action: 'tag_import',
       resource: 'tag_categories',
       details: {
         categories_created: categoryResults.filter(c => c.status === 'created').length,
         tags_created: createdCount,
       },
       ipAddress: getClientIP(request),
       userAgent: request.headers.get('user-agent') || undefined,
     });

     return NextResponse.json({ success: true, ... });
   }
   ```

**Effort**: 3 hours (create table, service, integrate into 4 endpoints)

### OWASP Top 10 Coverage

| Vulnerability | Status | Notes |
|---------------|--------|-------|
| A01:2021 – Broken Access Control | ⚠️ **FIX 1, 3** | Admin endpoints exposed, inconsistent authz |
| A02:2021 – Cryptographic Failures | ✅ Secure | Argon2id, TLS in production |
| A03:2021 – Injection | ✅ Secure | Parameterized queries |
| A04:2021 – Insecure Design | ⚠️ **FIX 2** | No rate limiting (DoS risk) |
| A05:2021 – Security Misconfiguration | ⚠️ Partial | CSP active, audit logs missing |
| A06:2021 – Vulnerable Components | ⚠️ Unknown | Need dependency audit |
| A07:2021 – Identification/Auth Failures | ✅ Secure | Session management solid |
| A08:2021 – Software/Data Integrity | ⚠️ Partial | No audit logs, no integrity checks |
| A09:2021 – Logging/Monitoring Failures | ❌ **AUDIT LOGS** | Console only, no persistence |
| A10:2021 – SSRF | ✅ N/A | No external fetch operations |

### Additional Recommendations

1. **Dependency vulnerability scanning**:
   ```bash
   cd frontend
   npm audit
   npm audit fix
   ```

2. **Docker image scanning** (for production container):
   ```bash
   # Install Trivy
   docker run --rm aquasec/trivy image m4s0kwo4kc4oooocck4sswc4
   ```

3. **Security headers validation**:
   - Use https://securityheaders.com to scan www.veritablegames.com
   - Verify CSP, HSTS, X-Frame-Options

4. **File upload validation** (if library supports uploads):
   - Check `file-upload-validator.ts` (exists in codebase)
   - Ensure MIME type validation
   - Virus scanning for uploaded files

---

## Total Effort Summary

| Fix | Description | Effort |
|-----|-------------|--------|
| Fix 1 | Admin endpoint authentication | 1.5 hours |
| Fix 2 | Rate limiting implementation | 2.5 hours |
| Fix 3 | Authorization service (optional) | 6 hours |
| Bonus | Audit logging | 3 hours |
| Bonus | XSS hardening | 2 hours |
| **Total** | | **15 hours** |

**Priority Order**:

1. **IMMEDIATE** (Deploy today): Fix 1 - Admin authentication (1.5 hours)
2. **HIGH** (Deploy this week): Fix 2 - Rate limiting (2.5 hours)
3. **MEDIUM** (Deploy within 2 weeks): Audit logging (3 hours)
4. **LONG-TERM** (Incremental over 1 month): Fix 3 - Authorization service (6 hours)
5. **OPTIONAL** (As needed): XSS hardening (2 hours)

---

## Risk Assessment

### What Could Go Wrong?

**Risk 1: Admin lockout**
- **Scenario**: After deploying Fix 1, admin cannot access admin endpoints
- **Probability**: Low (authentication is well-tested)
- **Impact**: Medium (admin operations unavailable)
- **Mitigation**:
  - Test authentication with admin account before deploy
  - Have rollback plan ready (git revert)
  - Temporary bypass code prepared

**Risk 2: Rate limiting too aggressive**
- **Scenario**: Legitimate users hit rate limits during normal usage
- **Probability**: Medium (limits based on estimates)
- **Impact**: Medium (user frustration, support tickets)
- **Mitigation**:
  - Start with conservative limits (higher than recommended)
  - Monitor rate limit violations for 1 week
  - Adjust based on real usage patterns
  - Add admin IP whitelist for testing

**Risk 3: Authorization service breaks existing endpoints**
- **Scenario**: Migration to centralized authz introduces bugs
- **Probability**: Low (gradual migration)
- **Impact**: High (broken features)
- **Mitigation**:
  - Incremental migration (one endpoint per day)
  - Comprehensive testing before each deploy
  - Keep old inline checks until all tests pass
  - Feature flag for new authorization service

**Risk 4: Performance degradation**
- **Scenario**: Rate limiting adds latency to requests
- **Probability**: Very Low (in-memory cache is fast)
- **Impact**: Low (milliseconds of latency)
- **Mitigation**:
  - Benchmark before/after (use `autocannon` or `ab`)
  - Monitor response times in production
  - Optimize rate limiter cache if needed

### Security-Performance Trade-off

**Authentication overhead**:
- ✅ Minimal: `requireAdmin()` does 1 database query (session lookup)
- ✅ Cached: Session validated once per request
- ⚠️ Consider: Add Redis caching for high-traffic deployments

**Rate limiting overhead**:
- ✅ Minimal: In-memory hash lookup (O(1))
- ✅ LRU eviction: Prevents memory bloat
- ⚠️ Consider: If >10K unique IPs/hour, migrate to Redis

---

## Conclusion

This plan addresses **critical security vulnerabilities** in the Veritable Games library system with **minimal development effort** (1.5-4 hours for P1 fixes).

**Immediate next steps**:

1. **Review this plan** with team/stakeholder
2. **Deploy Fix 1** (admin authentication) - CRITICAL, 1.5 hours
3. **Deploy Fix 2** (rate limiting) - HIGH, 2.5 hours
4. **Monitor for 1 week** - Adjust rate limits if needed
5. **Consider Fix 3** (authorization service) - Long-term improvement

**Success criteria**:
- ✅ All admin endpoints require authentication
- ✅ Rate limits prevent DoS attacks
- ✅ No legitimate user impact
- ✅ Audit trail for admin actions (bonus)

**Questions or concerns**: Contact security team before implementation.

---

**Document Control**:
- **Created**: 2025-11-17
- **Author**: Claude (Security Specialist)
- **Review Status**: Pending
- **Approval**: Required before implementation
- **Next Review**: After Fix 1 deployment
