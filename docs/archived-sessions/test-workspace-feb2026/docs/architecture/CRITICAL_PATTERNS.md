📍 **Navigation**: [CLAUDE.md](../../CLAUDE.md) > [docs/](../README.md) > [architecture/](./README.md) > Critical Patterns

---

# Critical Architecture Patterns

**⚠️ MUST-FOLLOW PATTERNS** - These patterns are enforced throughout the codebase. Violations will cause connection leaks, security issues, or runtime errors.

## Table of Contents

- [Quick Reference Guide](#quick-reference-guide)
- [1. Database Access Pattern](#1-database-access-pattern-must-follow)
- [2. API Security Pattern](#2-api-security-pattern)
- [3. API Route Pattern](#3-api-route-pattern)
- [4. Next.js 15 Async Params](#4-nextjs-15-async-params-critical)
- [5. Service Export Pattern](#5-service-export-pattern)
- [6. Optimistic UI Pattern](#6-optimistic-ui-pattern-react-19)
- [7. Real-Time Updates Pattern](#7-real-time-updates-pattern)
- [8. SSR-Safe Code Pattern](#8-ssr-safe-code-pattern)
- [9. File Upload Processing Pattern](#9-file-upload-processing-pattern)
- [10. Password Generation Pattern](#10-password-generation-pattern-mandatory)
- [11. Maintenance Mode Deployment Verification](#11-maintenance-mode-deployment-verification-critical)

---

## Quick Reference Guide

**Use this to quickly determine the right pattern:**

```
Q: Need to access a database?
→ Use `dbAdapter.query(sql, params, { schema: 'schema-name' })` - NEVER create Database instances

Q: Creating an API route?
→ Use withSecurity() + inline validation + errorResponse() pattern

Q: Working with params in Next.js 15?
→ MUST await: `const params = await context.params`

Q: Which database for my data?
→ forums (discussions), wiki (pages), content (projects/news/workspaces),
  users (profiles), auth (sessions), library (documents), messaging (messages)

Q: Need cross-database data?
→ Use ProfileAggregatorService - NO cross-database JOINs

Q: Need to test file uploads?
→ Use FileQueueManager component with upload-processor utility

Q: Need real-time updates?
→ Use useForumEvents hook for SSE

Q: Need optimistic UI?
→ Use React 19's useOptimistic

Q: Using browser APIs in Server Components?
→ Wrap in `typeof window !== 'undefined'` or use 'use client' + useEffect

Q: Need to generate a password?
→ Use `npm run security:generate-password` - ALWAYS (15+ chars, crypto.randomBytes)

Q: Deploying changes to maintenance mode/middleware?
→ Run `npm run deployment:verify-maintenance` IMMEDIATELY after deployment
```

---

## 1. Database Access Pattern (MUST FOLLOW)

### ⚠️ THE ONLY WAY to access databases

```typescript
// ✅ CORRECT - Use dbAdapter for PostgreSQL
import { dbAdapter } from '@/lib/database/adapter';

// In a service or API route
const result = await dbAdapter.query(
  'SELECT * FROM users WHERE id = ?',
  [userId],
  { schema: 'users' }
);
const user = result.rows[0];

// ❌ WRONG - NEVER create Database instances directly
import Database from 'better-sqlite3';
const db = new Database('path/to/db'); // NEVER DO THIS - causes connection leaks

// ❌ WRONG - Legacy patterns (DEPRECATED)
import { dbPool } from '@/lib/database/pool'; // DEPRECATED - use dbAdapter
import { pgPool } from '@/lib/database/pool-postgres'; // DEPRECATED - use dbAdapter
// These exist only for backward compatibility with tests/legacy code
```

### Why This Matters

- Creating Database instances directly causes **connection leaks** and **performance issues**
- The dbAdapter manages connections and handles PostgreSQL-specific features
- Schema names correspond to PostgreSQL schemas (not separate databases)
- Build-time mocking is handled automatically by the adapter

### Schema Names for dbAdapter.query()

| Schema | Purpose | Tables |
|--------|---------|--------|
| `forums` | Forum discussions | categories, topics, replies, forum_search_fts |
| `wiki` | Wiki pages | wiki_pages, wiki_revisions, wiki_categories, wiki_search |
| `users` | User profiles | users, profiles, settings |
| `system` | System configuration | settings, feature_flags |
| `content` | Content management | news, projects, team_members, project_revisions, workspaces |
| `library` | Documents | library_documents, library_search_fts, library_categories |
| `auth` | Sessions | sessions, tokens, authentication data |
| `messaging` | Private messages | messages, conversations |

### CRITICAL: No Cross-Schema JOINs

Architectural decision - keep schemas isolated for maintainability and clear boundaries. Use **ProfileAggregatorService** for cross-domain data aggregation.

### Database Adapter Details

- **Connection pooling**: Managed by PostgreSQL connection pool
- **Automatic schema selection**: Use `{ schema: 'schemaName' }` parameter
- **Query parameterization**: Prevents SQL injection
- **Transaction support**: Use dbAdapter.transaction() for multi-query operations
- **Build-time mock**: Returns mocks during Next.js builds

📝 **Complete architecture**: See [docs/DATABASE.md](../DATABASE.md)

---

## 2. API Security Pattern

### ✅ Wrap ALL API routes with withSecurity()

```typescript
import { withSecurity } from '@/lib/security/middleware';

// ✅ CORRECT - Wrap all API routes
export const POST = withSecurity(async (request) => {
  const result = await someOperation();
  return NextResponse.json({ success: true, data: result });
});

// ❌ WRONG - Missing security wrapper
export async function POST(request) {
  // Missing security headers, session management, sanitization
}
```

### What withSecurity() Provides

- **Security headers**: CSP with dynamic nonce, X-Frame-Options, HSTS
- **Session management**: Automatic session validation
- **Content sanitization**: DOMPurify for user-generated content
- **CSRF protection**: Double-submit cookie pattern (49 routes)
- **Rate limiting**: In-memory LRU cache (8 critical endpoints)

### Global Auth Middleware

All routes require authentication by default (configured in `src/middleware.ts`).

**Public routes**:
- `/auth/login`
- `/auth/register`
- `/api/auth/*`
- `/api/health`

**Maintenance mode**: Set `MAINTENANCE_MODE=true` to restrict access to admins only.

### Rate Limiters

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth endpoints | 5 attempts | 15 minutes |
| Topic creation | 5 topics | 1 hour |
| Reply creation | 30 replies | 1 hour |
| Search | 100 queries | 1 minute |
| File upload | 10 uploads | 1 hour |
| Message send | 20 messages | 1 hour (reserved) |
| Wiki page creation | 10 pages | 1 hour (reserved) |

📝 **Security Status**: See [docs/security/SECURITY_HARDENING_PROGRESS.md](../security/SECURITY_HARDENING_PROGRESS.md)

---

## 3. API Route Pattern

### ✅ Complete API Route Template

```typescript
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/utils';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // 1. Authentication
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    // 2. Parse and validate request body
    const body = await request.json();
    const { title, content, category_id } = body;

    // 3. Inline validation
    if (!title || typeof title !== 'string') {
      throw new ValidationError('Title is required');
    }

    // 4. Business logic (use service layer)
    const result = await forumService.createTopic({
      title,
      content,
      category_id
    }, user.id);

    // 5. Success response
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // 6. Error handling
    return errorResponse(error);
  }
});
```

### Pattern Flow

1. **withSecurity()** → Security headers, session, sanitization
2. **authenticate** → Get current user or throw AuthenticationError
3. **validate** → Inline validation or use Zod schemas
4. **business logic** → Call service methods
5. **errorResponse()** → Consistent error handling

### Validation Location Guide

- **Domain-specific validation**: Check `/lib/[domain]/validation.ts` (forums, wiki, library, workspace)
- **Shared utilities**: `/lib/utils/validation.ts` (common helpers)

📝 **Example implementations**: See `frontend/src/app/api/forums/topics/route.ts`

---

## 4. Next.js 15 Async Params (CRITICAL)

### ⚠️ MUST await params before accessing properties

```typescript
// ✅ CORRECT - API route
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params;
  const id = params.slug;
  // ... use id
}

// ✅ CORRECT - Page component
export default async function Page({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  // ... use slug
}

// ❌ WRONG - Direct access (Next.js 14 pattern)
export async function GET(req, { params }: { params: { slug: string } }) {
  const projectId = params.slug; // ERROR in Next.js 15
}
```

### Why This Changed

Next.js 15 made `params` asynchronous to support dynamic routing optimizations. Direct access will cause runtime errors.

### Common Locations

- API routes: `src/app/api/[...]/route.ts`
- Page components: `src/app/[...]/page.tsx`
- Layout components: `src/app/[...]/layout.tsx`

📝 **Complete patterns**: See [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md)

---

## 5. Service Export Pattern

### ✅ Export both class AND instance

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// ✅ CORRECT: Export both
export class WikiPageService {
  constructor() {
    // Initialize service
  }

  async getPage(id: number) {
    const result = await dbAdapter.query(
      'SELECT * FROM wiki_pages WHERE id = ?',
      [id],
      { schema: 'wiki' }
    );
    return result.rows[0];
  }
}

// Export singleton instance (REQUIRED)
export const wikiPageService = new WikiPageService();

// ❌ WRONG: Only export class
export class WikiPageService {
  // ... without singleton export
}
```

### Why Both Exports Are Required

- **Class export**: For testing, mocking, and extending
- **Instance export**: For service registry (`lib/services/registry.ts`)
- **Singleton pattern**: Ensures consistent state across application

### Service Locations

Services are located in `/lib/[domain]/service.ts`:
- Forums: `lib/forums/service.ts` (6 specialized services)
- Wiki: `lib/wiki/service.ts` (4 specialized services)
- Library: `lib/library/service.ts`
- Auth: `lib/auth/service.ts`
- Workspace: `lib/workspace/service.ts`

📝 **Service architecture**: See [docs/architecture/NEW_SERVICE_ARCHITECTURE.md](./NEW_SERVICE_ARCHITECTURE.md)

---

## 6. Optimistic UI Pattern (React 19)

### ✅ Use React 19's useOptimistic for instant feedback

```typescript
import { useOptimistic } from 'react';
import { useRouter } from 'next/navigation';

function ReplyList({ replies }: { replies: Reply[] }) {
  const router = useRouter();
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    replies,
    (current, newReply) => [...current, newReply]
  );

  const handleSubmit = async (content: string) => {
    // 1. Add optimistically (instant UI update)
    addOptimisticReply({
      id: Date.now(),
      content,
      created_at: new Date().toISOString(),
      username: 'You'
    });

    // 2. Clear form immediately
    setContent('');

    // 3. Send to server
    await fetch('/api/forums/replies', {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    // 4. Sync with server state
    router.refresh();
  };

  return (
    <div>
      {optimisticReplies.map(reply => (
        <ReplyCard key={reply.id} reply={reply} />
      ))}
    </div>
  );
}
```

### Benefits

- **Instant feedback**: Updates appear in <16ms
- **Auto-rollback**: Reverts on error automatically
- **No external state**: Built into React 19
- **Type-safe**: Full TypeScript support

📝 **Real implementation**: See `frontend/src/components/forums/ReplyList.tsx`

---

## 7. Real-Time Updates Pattern

### ✅ Use useForumEvents hook for SSE

```typescript
import { useForumEvents } from '@/hooks/useForumEvents';
import { useRouter } from 'next/navigation';

function TopicView({ topicId }: { topicId: number }) {
  const router = useRouter();

  const { connected, error } = useForumEvents({
    // Topic-specific events
    onTopicLocked: (data) => {
      toast.info('Topic has been locked');
      router.refresh();
    },
    onTopicPinned: (data) => {
      toast.info('Topic has been pinned');
      router.refresh();
    },
    onReplyCreated: (data) => {
      toast.success('New reply posted');
      router.refresh();
    },

    // Optional: filter by topic
    topicId: topicId,
  });

  if (error) return <div>Connection error: {error}</div>;
  if (!connected) return <div>Connecting...</div>;

  return <div>{/* render topic */}</div>;
}
```

### Features

- **SSE-based**: Server-sent events for real-time updates
- **Automatic reconnection**: Handles network issues
- **Type-safe callbacks**: Full TypeScript event types
- **Filters**: By category, topic, or global events

📝 **Real implementation**: See `frontend/src/hooks/useForumEvents.ts`

---

## 8. SSR-Safe Code Pattern

### ✅ Protect browser-only APIs

```typescript
// ❌ WRONG - Direct access in Server Component
const stored = localStorage.getItem('key'); // ERROR: localStorage not defined

// ✅ CORRECT - Pattern 1: Client guard
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('key');
}

// ✅ CORRECT - Pattern 2: useEffect (Client Components only)
'use client'
import { useEffect, useState } from 'react';

function Component() {
  const [stored, setStored] = useState(null);

  useEffect(() => {
    const value = localStorage.getItem('key');
    setStored(value);
  }, []);

  return <div>{stored}</div>;
}

// ✅ CORRECT - Pattern 3: Early return
'use client'
function Component() {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('key');
  return <div>{stored}</div>;
}
```

### Common Browser-Only APIs

- `localStorage` / `sessionStorage`
- `window` object
- `document` object
- `navigator` object
- Browser-specific libraries (Three.js, Konva, etc.)

### Rule of Thumb

- **Server Components** (default): No browser APIs
- **Client Components** (`'use client'`): Wrap browser APIs in guards or useEffect

📝 **Complete patterns**: See [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md)

---

## 9. File Upload Processing Pattern

### ✅ Use upload processor with queue management

```typescript
// ✅ CORRECT - Use upload processor with queue management
import { processUploadQueue } from '@/lib/upload/upload-processor';

async function handleFileUpload(files: File[]) {
  const result = await processUploadQueue(files, {
    onProgress: (progress) => {
      // Update UI with upload progress
      updateProgressBar(progress);
    },
    onError: (error) => {
      // Handle errors for individual files
      toast.error(`Upload failed: ${error.message}`);
    },
    onSuccess: (file) => {
      // Handle successful file upload
      toast.success(`${file.name} uploaded successfully`);
    }
  });

  return result;
}

// ❌ WRONG - Direct file processing without queue
files.forEach(file => uploadFile(file)); // No progress tracking, error recovery
```

### What upload-processor Provides

- **Queue management**: Processes files sequentially to avoid overwhelming the server
- **Progress tracking**: Real-time progress updates for each file and overall progress
- **Error recovery**: Handles individual file failures without stopping the entire batch
- **Memory efficient**: Chunked processing for large files
- **Type-safe**: Full TypeScript support with proper error types

### Features

- **Concurrent uploads**: Configure max concurrent uploads (default: 3)
- **Retry logic**: Automatic retry on network failures (configurable)
- **File validation**: Size limits, type validation, duplicate detection
- **Chunked uploads**: Large file support with resumable uploads
- **Progress callbacks**: onProgress, onError, onSuccess, onComplete

### UI Component Pattern

```typescript
import { FileQueueManager } from '@/components/upload/FileQueueManager';

function ProjectGallery() {
  return (
    <FileQueueManager
      maxFiles={10}
      maxFileSize={10 * 1024 * 1024} // 10MB
      acceptedTypes={['image/*', 'video/*']}
      onUploadComplete={(results) => {
        console.log('All uploads complete:', results);
        router.refresh();
      }}
    />
  );
}
```

📝 **Real implementation**: See `frontend/src/lib/upload/upload-processor.ts`
📝 **UI component**: See `frontend/src/components/upload/FileQueueManager.tsx`

---

## 10. Password Generation Pattern (MANDATORY)

### ✅ ALWAYS use cryptographic password protocol

```bash
# ✅ CORRECT - Use automated script
npm run security:generate-password          # 15-char password
npm run security:generate-password -- 20    # 20-char admin password
npm run security:generate-password -- 32    # 32-char service account

# ❌ WRONG - Weak passwords
TestPassword123!
AdminPassword123
password123
UserPassword2024!
```

### Why This Pattern Exists

- **Incident**: Feb 16, 2026 - Production authentication failure after using weak password "TestPassword123!"
- **Compliance**: NIST SP 800-90Ar1 requires cryptographically secure RNG
- **Security**: 15+ char alphanumeric = 89+ bits entropy (resistant to brute force for millions of years)
- **Random.org Inspiration**: Uses crypto.randomBytes() similar to atmospheric noise randomness

### What the Script Provides

- **CSPRNG**: Node.js crypto.randomBytes() (not Math.random)
- **Validation**: Character distribution checking (uppercase, lowercase, digits)
- **Bcrypt Hash**: Automatic hash generation (cost factor 12)
- **SQL Statement**: Ready-to-use UPDATE query for users.users table
- **Documentation**: Output includes entropy calculation and security notes

### Password Requirements

- **Minimum**: 15 characters (user/dev passwords)
- **Recommended**: 20 characters (admin/service accounts)
- **Character Set**: Alphanumeric (A-Z, a-z, 0-9)
- **Entropy**: 89 bits (15 chars) or 119 bits (20 chars)

### When to Use

- ✅ Admin password resets
- ✅ Test/dev account creation
- ✅ User password resets
- ✅ Service account passwords
- ✅ **ANY password generation** - NO EXCEPTIONS

### Example Output

```
🔐 Cryptographic Password Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated Password (15 characters):
OiOs3uSoxpckzoV

Entropy: 89.4 bits
Character Set: Alphanumeric (62 chars)
Method: Node.js crypto.randomBytes() (CSPRNG)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bcrypt Hash (cost 12):
$2b$12$bVNAoCUJphOIWWGZXxQfSOOxcAGaKA1VmbCEuhOQkOdjIAJ6xkZMu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQL UPDATE Statement (users.users):
UPDATE users.users
SET password_hash = '$2b$12$bVNAoCUJphOIWWGZXxQfSOOxcAGaKA1VmbCEuhOQkOdjIAJ6xkZMu',
    updated_at = NOW()
WHERE username = 'admin';
```

📝 **Complete protocol**: See [docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](../security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md)

---

## 11. Maintenance Mode Deployment Verification (CRITICAL)

### ⚠️ ALWAYS verify after middleware/maintenance changes

When deploying changes that affect maintenance mode (site lockdown), middleware, or site_settings, you MUST verify the production state immediately after deployment.

### Problem

On Feb 18, 2026, a bugfix removed code that was forcing permanent lockdown in production. The middleware started correctly reading the database value, but the database had `maintenanceMode = 'false'` (from migration defaults), making the site publicly accessible without warning.

**Impact**: Production site was publicly accessible for unknown duration until admin manually re-enabled lockdown.

**Root cause**: No verification step after deployment of lockdown-related changes.

### Pattern: Post-Deployment Verification

```bash
# ✅ CORRECT - Run immediately after deploying middleware/maintenance changes
git push origin main

# Wait for deployment to complete (2-5 minutes for Coolify)
sleep 180

# CRITICAL: Verify maintenance mode status
npm run deployment:verify-maintenance

# Or manually via production database:
DATABASE_URL="postgresql://postgres:postgres@10.100.0.1:5432/veritable_games" \
  npm run deployment:verify-maintenance
```

### When to Use

Run `npm run deployment:verify-maintenance` immediately after ANY deployment that:

1. **Modifies middleware.ts** - Any changes to authentication/maintenance logic
2. **Changes site_settings** - Direct database updates to maintenance mode
3. **Runs migrations** - Migration 007 or any that touch system.site_settings
4. **Updates lockdown logic** - Bug fixes, features, refactoring

### Verification Script Output

```bash
╔═══════════════════════════════════════════════════════════════╗
║   POST-DEPLOYMENT VERIFICATION: Maintenance Mode Status       ║
╚═══════════════════════════════════════════════════════════════╝

✓ Database connection established

Current Maintenance Mode Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Key:         maintenanceMode
  Value:       true
  Updated:     2026-02-18T17:27:30.932Z
  Updated By:  1 (admin)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PASS: Site is LOCKED (maintenance mode ON)
Site requires authentication - public cannot access

Deployment verification successful.
```

### Emergency Response

If verification fails (site is public when it should be locked):

```bash
# IMMEDIATE ACTION: Enable lockdown
npm run maintenance:enable

# Or via SQL:
UPDATE system.site_settings
SET value = 'true', updated_at = NOW()
WHERE key = 'maintenanceMode';

# Verify change took effect
npm run deployment:verify-maintenance
```

### Audit Logging

Migration `024-site-settings-audit-log.sql` adds automatic audit logging:

```sql
-- View recent maintenance mode changes
SELECT * FROM system.site_settings_changes
WHERE key = 'maintenanceMode'
ORDER BY changed_at DESC
LIMIT 10;
```

This provides visibility into:
- Who changed maintenance mode (user ID)
- When it was changed (timestamp)
- Old and new values
- Operation type (INSERT/UPDATE/DELETE)

### Related Commands

```bash
npm run maintenance:enable            # Enable lockdown (site private)
npm run maintenance:disable           # Disable lockdown (site public)
npm run maintenance:check             # Check current status
npm run deployment:verify-maintenance # Post-deployment verification
```

### Why This Matters

1. **Public exposure**: If lockdown is accidentally disabled, sensitive data may be accessible
2. **Silent failures**: Without verification, incorrect state can persist for hours/days
3. **Security incidents**: Unauthorized access, data leaks, compliance violations
4. **Audit trails**: Migration 024 ensures all changes are logged

### Enforcement

- ✅ **DO**: Run verification immediately after every middleware deployment
- ✅ **DO**: Check audit log if unexpected state is found
- ✅ **DO**: Document when lockdown is intentionally disabled
- ❌ **DON'T**: Assume lockdown state without verification
- ❌ **DON'T**: Deploy maintenance changes without verification
- ❌ **DON'T**: Ignore verification failures

📝 **Incident report**: See [docs/incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md](../incidents/2026-02-18-maintenance-mode-disabled-after-deployment.md)

---

## Summary Checklist

Before writing any code, verify you're following these patterns:

- [ ] Database access via `dbAdapter.query()` only
- [ ] API routes wrapped with `withSecurity()`
- [ ] Error handling via custom error classes + `errorResponse()`
- [ ] Next.js 15 params are awaited before access
- [ ] Services export both class and singleton instance
- [ ] Optimistic UI uses React 19's `useOptimistic`
- [ ] Real-time features use `useForumEvents` hook
- [ ] Browser APIs wrapped in SSR-safe guards
- [ ] File uploads use `processUploadQueue` with progress tracking
- [ ] Password generation uses `npm run security:generate-password` (MANDATORY)
- [ ] Maintenance mode verified after middleware/lockdown deployments

---

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Main development guide
- [docs/security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](../security/CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md) - Password generation protocol
- [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md) - React 19 + Next.js 15 patterns
- [docs/DATABASE.md](../DATABASE.md) - Database architecture details
- [docs/COMMON_PITFALLS.md](../COMMON_PITFALLS.md) - Common mistakes to avoid
- [.claude/BANNED_PATTERNS.md](../../.claude/BANNED_PATTERNS.md) - Patterns NEVER to reintroduce

---

**Last Updated**: February 18, 2026
**Latest Changes**: Added Pattern #11: Maintenance Mode Deployment Verification (CRITICAL) - post-deployment verification for lockdown changes
