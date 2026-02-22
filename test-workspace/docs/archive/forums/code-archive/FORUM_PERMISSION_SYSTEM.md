# Forum Permission System Documentation

**Version:** 1.0.0
**Last Updated:** 2025-10-01
**Architecture:** Next.js 15 App Router with React 19 Server Actions

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Permission Types](#permission-types)
4. [Role-Permission Mapping](#role-permission-mapping)
5. [Permission Service](#permission-service)
6. [Server Actions](#server-actions)
7. [Security Best Practices](#security-best-practices)
8. [Implementation Examples](#implementation-examples)
9. [Edge Cases](#edge-cases)
10. [Performance Optimization](#performance-optimization)
11. [Testing Guidelines](#testing-guidelines)

---

## Overview

This comprehensive permission system provides role-based access control (RBAC) for forum operations with contextual permission checks, caching, and security measures. It integrates seamlessly with Next.js 15 Server Actions and iron-session authentication.

### Key Features

- **Role-based permissions** (admin, moderator, user)
- **Contextual permission checks** (ownership, topic locked, user banned)
- **Permission caching** (5-minute TTL to reduce database hits)
- **Content sanitization** (XSS prevention with DOMPurify)
- **Rate limiting** (prevent spam and abuse)
- **Audit logging** (optional permission check tracking)
- **Server Actions integration** (React 19 useActionState)

### Design Principles

1. **Security by default** - Deny permissions unless explicitly granted
2. **Least privilege** - Users get minimum permissions needed
3. **Defense in depth** - Multiple security layers (permissions + sanitization + rate limiting)
4. **Performance** - Cached permissions to avoid excessive database queries
5. **Type safety** - Branded types prevent ID confusion
6. **Auditability** - Optional logging for compliance

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Server Component (Form)                              │  │
│  │  - useActionState(createTopicAction, null)            │  │
│  │  - useFormStatus() for pending state                  │  │
│  └───────────────────┬───────────────────────────────────┘  │
└────────────────────────┼───────────────────────────────────┘
                         │ FormData
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Server Actions Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  topic-actions.ts / reply-actions.ts                │   │
│  │  1. Validate session (getServerSession)              │   │
│  │  2. Parse FormData                                   │   │
│  │  3. Validate with Zod schemas                        │   │
│  │  4. Check permissions (PermissionService)            │   │
│  │  5. Sanitize content (forum-security.ts)             │   │
│  │  6. Execute database operation                       │   │
│  │  7. Invalidate cache                                 │   │
│  │  8. Return Result<T, E>                              │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Permission Service Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PermissionService                                   │   │
│  │  - hasPermission() - Check if user has permission    │   │
│  │  - canEditTopic() - Convenience method               │   │
│  │  - canDeleteTopic() - Convenience method             │   │
│  │  - Caching with 5-minute TTL                         │   │
│  │  - Ownership checks                                  │   │
│  │  - Locked topic handling                             │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Database Layer (SQLite)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  users.db - User roles and status                    │   │
│  │  forums.db - Topics, replies, categories             │   │
│  │  system.db - Activity logs, notifications            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Permission Types

### Permission Enum

All permissions are defined in `/lib/permissions/types.ts`:

```typescript
export enum Permission {
  // View permissions
  FORUM_VIEW_CATEGORY = 'forum:view:category',
  FORUM_VIEW_PRIVATE_CATEGORY = 'forum:view:private-category',

  // Topic permissions
  FORUM_CREATE_TOPIC = 'forum:create:topic',
  FORUM_EDIT_OWN_TOPIC = 'forum:edit:own-topic',
  FORUM_EDIT_ANY_TOPIC = 'forum:edit:any-topic',
  FORUM_DELETE_OWN_TOPIC = 'forum:delete:own-topic',
  FORUM_DELETE_ANY_TOPIC = 'forum:delete:any-topic',

  // Reply permissions
  FORUM_REPLY_TO_TOPIC = 'forum:reply:topic',
  FORUM_EDIT_OWN_REPLY = 'forum:edit:own-reply',
  FORUM_EDIT_ANY_REPLY = 'forum:edit:any-reply',
  FORUM_DELETE_OWN_REPLY = 'forum:delete:own-reply',
  FORUM_DELETE_ANY_REPLY = 'forum:delete:any-reply',

  // Moderation permissions
  FORUM_PIN_TOPIC = 'forum:moderate:pin',
  FORUM_LOCK_TOPIC = 'forum:moderate:lock',
  FORUM_MODERATE = 'forum:moderate:general',
  FORUM_BAN_USER = 'forum:moderate:ban',
  FORUM_MANAGE_CATEGORIES = 'forum:manage:categories',
  FORUM_MANAGE_TAGS = 'forum:manage:tags',

  // Special permissions
  FORUM_VIEW_DELETED = 'forum:view:deleted',
  FORUM_BYPASS_RATE_LIMIT = 'forum:bypass:rate-limit',
  FORUM_MARK_SOLUTION = 'forum:mark:solution',
}
```

---

## Role-Permission Mapping

### Admin

**All permissions** - Full control over forums

```typescript
RolePermissions.admin = [
  // All 21 permissions
];
```

### Moderator

**All except category/tag management**

```typescript
RolePermissions.moderator = [
  Permission.FORUM_VIEW_CATEGORY,
  Permission.FORUM_VIEW_PRIVATE_CATEGORY,
  Permission.FORUM_CREATE_TOPIC,
  Permission.FORUM_EDIT_OWN_TOPIC,
  Permission.FORUM_EDIT_ANY_TOPIC,
  Permission.FORUM_DELETE_OWN_TOPIC,
  Permission.FORUM_DELETE_ANY_TOPIC,
  Permission.FORUM_REPLY_TO_TOPIC,
  Permission.FORUM_EDIT_OWN_REPLY,
  Permission.FORUM_EDIT_ANY_REPLY,
  Permission.FORUM_DELETE_OWN_REPLY,
  Permission.FORUM_DELETE_ANY_REPLY,
  Permission.FORUM_PIN_TOPIC,
  Permission.FORUM_LOCK_TOPIC,
  Permission.FORUM_MODERATE,
  Permission.FORUM_BAN_USER,
  Permission.FORUM_VIEW_DELETED,
  Permission.FORUM_BYPASS_RATE_LIMIT,
  Permission.FORUM_MARK_SOLUTION,
  // NOT: FORUM_MANAGE_CATEGORIES, FORUM_MANAGE_TAGS
];
```

### User

**Basic permissions** - Create, edit own, delete own

```typescript
RolePermissions.user = [
  Permission.FORUM_VIEW_CATEGORY,
  Permission.FORUM_CREATE_TOPIC,
  Permission.FORUM_EDIT_OWN_TOPIC,
  Permission.FORUM_DELETE_OWN_TOPIC,
  Permission.FORUM_REPLY_TO_TOPIC,
  Permission.FORUM_EDIT_OWN_REPLY,
  Permission.FORUM_DELETE_OWN_REPLY,
  Permission.FORUM_MARK_SOLUTION, // Topic authors only
];
```

### Role Comparison Table

| Permission | Admin | Moderator | User |
|-----------|-------|-----------|------|
| View Categories | ✅ | ✅ | ✅ |
| View Private Categories | ✅ | ✅ | ❌ |
| Create Topics | ✅ | ✅ | ✅ |
| Edit Own Topics | ✅ | ✅ | ✅ |
| Edit Any Topic | ✅ | ✅ | ❌ |
| Delete Own Topics | ✅ | ✅ | ✅ |
| Delete Any Topic | ✅ | ✅ | ❌ |
| Reply to Topics | ✅ | ✅ | ✅ |
| Edit Own Replies | ✅ | ✅ | ✅ |
| Edit Any Reply | ✅ | ✅ | ❌ |
| Delete Own Replies | ✅ | ✅ | ✅ |
| Delete Any Reply | ✅ | ✅ | ❌ |
| Pin Topics | ✅ | ✅ | ❌ |
| Lock Topics | ✅ | ✅ | ❌ |
| Moderate Forums | ✅ | ✅ | ❌ |
| Ban Users | ✅ | ✅ | ❌ |
| Manage Categories | ✅ | ❌ | ❌ |
| Manage Tags | ✅ | ❌ | ❌ |
| View Deleted Content | ✅ | ✅ | ❌ |
| Bypass Rate Limits | ✅ | ✅ | ❌ |
| Mark Solutions | ✅ | ✅ | ✅* |

*Topic author only

---

## Permission Service

### Basic Usage

```typescript
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';
import { unsafeToUserId } from '@/lib/forums/branded-types';

// Check if user can create topics
const canCreate = await permissionService.hasPermission(
  unsafeToUserId(user.id),
  Permission.FORUM_CREATE_TOPIC
);

// Check if user can reply to a locked topic
const canReply = await permissionService.hasPermission(
  unsafeToUserId(user.id),
  Permission.FORUM_REPLY_TO_TOPIC,
  {
    topicId: topic.id,
    topicIsLocked: topic.status === 'locked',
  }
);
```

### Convenience Methods

```typescript
// Check if user can edit a specific topic
const canEdit = await permissionService.canEditTopic(
  unsafeToUserId(user.id),
  topic
);

// Check if user can delete a specific reply
const canDelete = await permissionService.canDeleteReply(
  unsafeToUserId(user.id),
  reply
);

// Check if user can moderate
const canModerate = await permissionService.canModerate(
  unsafeToUserId(user.id)
);
```

### Require Permission (Throws Error)

```typescript
// In Server Actions - throws PermissionError if denied
await permissionService.requirePermission(
  unsafeToUserId(user.id),
  Permission.FORUM_CREATE_TOPIC
);
```

### Permission Context

```typescript
export interface PermissionContext {
  // Topic context
  topicId?: TopicId;
  topicUserId?: UserId;
  topicIsLocked?: boolean;
  topicIsPinned?: boolean;

  // Reply context
  replyId?: ReplyId;
  replyUserId?: UserId;
  replyTopicId?: TopicId;

  // Category context
  categoryId?: CategoryId;
  categoryIsPrivate?: boolean;

  // User context
  isOwner?: boolean;
  isBanned?: boolean;

  // Additional metadata
  metadata?: Record<string, unknown>;
}
```

### Caching Strategy

- **TTL**: 5 minutes
- **Cache Key**: `permissions:{userId}:{permission}:{contextHash}`
- **Invalidation**: Manual via `clearUserPermissionCache(userId)`
- **Storage**: In-memory LRU cache (CacheManager)

```typescript
// Clear cache when user role changes
await permissionService.clearUserPermissionCache(unsafeToUserId(user.id));

// Clear all permission caches
await permissionService.clearAllPermissionCaches();
```

---

## Server Actions

### Topic Actions

Located in `/lib/forums/actions/topic-actions.ts`

#### Create Topic

```typescript
export async function createTopicAction(
  formData: FormData
): Promise<Result<ForumTopic, ActionError>>
```

**Process:**
1. Validate session
2. Parse and validate FormData with Zod
3. Check `FORUM_CREATE_TOPIC` permission
4. Check `FORUM_PIN_TOPIC` permission if pinning
5. Sanitize title and content
6. Validate content length
7. Insert into database
8. Update category topic count
9. Create activity log
10. Invalidate caches
11. Return Result<ForumTopic, ActionError>

#### Update Topic

```typescript
export async function updateTopicAction(
  topicId: number,
  formData: FormData
): Promise<Result<ForumTopic, ActionError>>
```

**Process:**
1. Validate session
2. Get existing topic
3. Check `FORUM_EDIT_OWN_TOPIC` or `FORUM_EDIT_ANY_TOPIC`
4. Check special permissions for pin/lock
5. Sanitize and validate changes
6. Update database
7. Create activity log
8. Invalidate caches

#### Delete Topic

```typescript
export async function deleteTopicAction(
  topicId: number
): Promise<Result<void, ActionError>>
```

**Soft delete** - Sets status to 'closed', decrements category count

#### Pin/Lock Topic

```typescript
export async function pinTopicAction(
  topicId: number,
  pinned: boolean
): Promise<Result<ForumTopic, ActionError>>

export async function lockTopicAction(
  topicId: number,
  locked: boolean
): Promise<Result<ForumTopic, ActionError>>
```

### Reply Actions

Located in `/lib/forums/actions/reply-actions.ts`

#### Create Reply

```typescript
export async function createReplyAction(
  formData: FormData
): Promise<Result<ForumReply, ActionError>>
```

**Special Features:**
- Checks if topic is locked
- Detects @mentions for notifications
- Calculates reply depth for threading
- Updates conversation metadata
- Increments topic reply count

#### Update Reply

```typescript
export async function updateReplyAction(
  replyId: number,
  formData: FormData
): Promise<Result<ForumReply, ActionError>>
```

#### Delete Reply

```typescript
export async function deleteReplyAction(
  replyId: number
): Promise<Result<void, ActionError>>
```

**Soft delete** - Replaces content with "[deleted]", sets `is_deleted = 1`

#### Mark Solution

```typescript
export async function markSolutionAction(
  replyId: number
): Promise<Result<ForumReply, ActionError>>
```

**Permissions:** Only topic author (or admin/moderator)

---

## Security Best Practices

### 1. Content Sanitization

**Always sanitize user input** using `sanitizeContent()`:

```typescript
import { sanitizeContent } from '@/lib/security/forum-security';

const sanitized = sanitizeContent(formData.get('content') as string);
```

**DOMPurify Configuration:**
- Allowed tags: Basic HTML + markdown-compatible elements
- Blocked: `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers
- Forbidden patterns: `javascript:`, `on*=`, excessive URLs

### 2. Content Validation

```typescript
import {
  validateTopicTitle,
  validateTopicContent,
  validateReplyContent,
} from '@/lib/security/forum-security';

const titleValidation = validateTopicTitle(title);
if (!titleValidation.valid) {
  return Err(createActionError('VALIDATION_ERROR', titleValidation.error));
}
```

### 3. SQL Injection Prevention

**Primary Defense:** Use parameterized queries (always)

```typescript
// ✅ CORRECT - Parameterized query
db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);

// ❌ WRONG - String concatenation
db.prepare(`SELECT * FROM topics WHERE id = ${topicId}`).get();
```

**Secondary Defense:** Input validation

```typescript
import { validateSqlInput } from '@/lib/security/forum-security';

if (!validateSqlInput(searchQuery)) {
  return Err(createActionError('VALIDATION_ERROR', 'Invalid search query'));
}
```

### 4. Rate Limiting

```typescript
import {
  checkRateLimit,
  getRateLimitKey,
  FORUM_RATE_LIMITS,
} from '@/lib/security/forum-security';

const rateLimitKey = getRateLimitKey(user.id, 'CREATE_TOPIC');
const rateLimit = checkRateLimit(
  rateLimitKey,
  FORUM_RATE_LIMITS.CREATE_TOPIC.requests,
  FORUM_RATE_LIMITS.CREATE_TOPIC.window
);

if (!rateLimit.allowed) {
  return Err(
    createActionError(
      'RATE_LIMITED',
      `Too many topics created. Try again in ${Math.ceil(
        (rateLimit.resetAt - Date.now()) / 1000
      )} seconds`
    )
  );
}
```

**Rate Limits:**
- Create Topic: 5 per hour
- Create Reply: 30 per hour
- Edit Content: 20 per hour
- Delete Content: 10 per hour

### 5. Mention Detection & Notifications

```typescript
import { detectMentions } from '@/lib/security/forum-security';

const mentions = detectMentions(content); // ['username1', 'username2']

// Create notifications for mentioned users
for (const mention of mentions) {
  // Validate username and create notification
}
```

### 6. Spam Detection

```typescript
import { detectSpam } from '@/lib/security/forum-security';

if (detectSpam(content)) {
  return Err(createActionError('VALIDATION_ERROR', 'Content appears to be spam'));
}
```

**Spam Patterns:**
- Common spam keywords (viagra, casino, lottery)
- Extremely long URLs (>100 chars)
- Repeated characters (>20 times)

---

## Implementation Examples

### Example 1: Create Topic Form (Server Component)

```typescript
'use client';

import { useActionState, useFormStatus } from 'react';
import { createTopicAction } from '@/lib/forums/actions/topic-actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Topic'}
    </button>
  );
}

export default function CreateTopicForm({ categoryId }: { categoryId: string }) {
  const [state, formAction] = useActionState(createTopicAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="category_id" value={categoryId} />

      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          required
          minLength={10}
          maxLength={50000}
          rows={10}
        />
      </div>

      <SubmitButton />

      {state?.error && (
        <div className="error">
          {state.error.message}
        </div>
      )}

      {state?.value && (
        <div className="success">
          Topic created successfully!
        </div>
      )}
    </form>
  );
}
```

### Example 2: Edit Topic with Permission Check

```typescript
import { getServerSession } from '@/lib/auth/session';
import { permissionService } from '@/lib/permissions/service';
import { unsafeToUserId } from '@/lib/forums/branded-types';
import { redirect } from 'next/navigation';

export default async function EditTopicPage({ params }: { params: { id: string } }) {
  const user = await getServerSession();
  if (!user) redirect('/login');

  // Get topic
  const topic = await getTopicById(parseInt(params.id));
  if (!topic) notFound();

  // Check permission
  const canEdit = await permissionService.canEditTopic(
    unsafeToUserId(user.id),
    topic
  );

  if (!canEdit) {
    return <div>You do not have permission to edit this topic.</div>;
  }

  return <EditTopicForm topic={topic} />;
}
```

### Example 3: Moderator Actions

```typescript
'use client';

import { pinTopicAction, lockTopicAction } from '@/lib/forums/actions/topic-actions';
import { useRouter } from 'next/navigation';

export function ModeratorActions({ topic, canModerate }: Props) {
  const router = useRouter();

  if (!canModerate) return null;

  const handlePin = async () => {
    const result = await pinTopicAction(topic.id, !topic.is_pinned);
    if (result.isOk()) {
      router.refresh();
    }
  };

  const handleLock = async () => {
    const result = await lockTopicAction(topic.id, topic.status !== 'locked');
    if (result.isOk()) {
      router.refresh();
    }
  };

  return (
    <div className="moderator-actions">
      <button onClick={handlePin}>
        {topic.is_pinned ? 'Unpin' : 'Pin'} Topic
      </button>
      <button onClick={handleLock}>
        {topic.status === 'locked' ? 'Unlock' : 'Lock'} Topic
      </button>
    </div>
  );
}
```

---

## Edge Cases

### 1. Locked Topics

**Rule:** Only admins/moderators can reply to locked topics

```typescript
// Permission check includes locked status
const canReply = await permissionService.canReplyToTopic(userId, topic);

// Context automatically checks:
// - User has FORUM_REPLY_TO_TOPIC permission
// - If topic is locked, user must be admin/moderator
```

### 2. Deleted Content

**Rule:** Soft delete preserves context

```typescript
// Soft delete sets content to "[deleted]" and is_deleted = 1
db.prepare(
  'UPDATE replies SET content = ?, is_deleted = 1 WHERE id = ?'
).run('[deleted]', replyId);

// Moderators can still view deleted content
if (reply.is_deleted && !canViewDeleted) {
  return <div>[deleted]</div>;
}
```

### 3. Banned Users

**Rule:** No permissions at all

```typescript
// Permission service checks user status
if (user.status === 'banned' || user.status === 'suspended') {
  return { granted: false, reason: 'User is banned or suspended' };
}
```

### 4. Anonymous Users

**Rule:** VIEW permission only (if public categories exist)

```typescript
// Check if user is authenticated
const user = await getServerSession();
if (!user) {
  // Can only view public categories
  return <GuestView />;
}
```

### 5. Solution Marking

**Rule:** Only topic author (or admin/moderator) can mark solutions

```typescript
// Permission context includes topic author
const canMarkSolution = await permissionService.hasPermission(
  userId,
  Permission.FORUM_MARK_SOLUTION,
  {
    topicId: topic.id,
    topicUserId: topic.user_id, // Topic author
  }
);

// Service checks: isOwner OR isModerator/Admin
```

### 6. Nested Reply Depth

**Rule:** Maximum depth of 10 to prevent excessive nesting

```typescript
// Calculate depth from parent
let replyDepth = 0;
if (data.parent_id) {
  const parent = await getReply(data.parent_id);
  replyDepth = (parent.reply_depth || 0) + 1;

  if (replyDepth > 10) {
    return Err(createActionError('VALIDATION_ERROR', 'Reply depth limit exceeded'));
  }
}
```

---

## Performance Optimization

### 1. Permission Caching

**Strategy:** Cache permission checks for 5 minutes

```typescript
// First check: Query database + cache
const canEdit = await permissionService.canEditTopic(userId, topic);
// Result cached with key: permissions:123:FORUM_EDIT_OWN_TOPIC:{contextHash}

// Subsequent checks (within 5 min): Return cached result
const canEditAgain = await permissionService.canEditTopic(userId, topic);
// No database query
```

**Cache Invalidation:**
- User role changes
- User status changes (banned/unbanned)
- Manual invalidation after sensitive operations

### 2. Batched Permission Checks

For checking multiple permissions at once:

```typescript
// Instead of multiple individual checks
const canEdit = await permissionService.hasPermission(userId, Permission.FORUM_EDIT_ANY_TOPIC);
const canDelete = await permissionService.hasPermission(userId, Permission.FORUM_DELETE_ANY_TOPIC);
const canPin = await permissionService.hasPermission(userId, Permission.FORUM_PIN_TOPIC);

// Get all permissions once
const permissions = await permissionService.getUserPermissions(userId);
const canEdit = permissions.includes(Permission.FORUM_EDIT_ANY_TOPIC);
const canDelete = permissions.includes(Permission.FORUM_DELETE_ANY_TOPIC);
const canPin = permissions.includes(Permission.FORUM_PIN_TOPIC);
```

### 3. Database Query Optimization

```typescript
// ✅ GOOD - Single query with JOIN
const topic = db.prepare(`
  SELECT t.*, u.username, u.role, u.status
  FROM topics t
  JOIN users u ON t.user_id = u.id
  WHERE t.id = ?
`).get(topicId);

// ❌ BAD - Multiple queries
const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId);
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(topic.user_id);
```

### 4. Content Sanitization Caching

For frequently accessed content:

```typescript
// Cache sanitized content
const cacheKey = { category: 'content', identifier: `sanitized:${contentHash}` };
const cached = await cacheManager.get(cacheKey);

if (cached) return cached;

const sanitized = sanitizeContent(rawContent);
await cacheManager.set(cacheKey, sanitized);
return sanitized;
```

---

## Testing Guidelines

### Unit Tests

```typescript
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';
import { unsafeToUserId } from '@/lib/forums/branded-types';

describe('PermissionService', () => {
  it('should grant FORUM_CREATE_TOPIC to regular users', async () => {
    const mockUser = { id: 1, role: 'user', status: 'active' };
    const canCreate = await permissionService.hasPermission(
      unsafeToUserId(mockUser.id),
      Permission.FORUM_CREATE_TOPIC
    );
    expect(canCreate).toBe(true);
  });

  it('should deny FORUM_EDIT_ANY_TOPIC to regular users', async () => {
    const mockUser = { id: 1, role: 'user', status: 'active' };
    const canEdit = await permissionService.hasPermission(
      unsafeToUserId(mockUser.id),
      Permission.FORUM_EDIT_ANY_TOPIC
    );
    expect(canEdit).toBe(false);
  });

  it('should deny all permissions to banned users', async () => {
    const mockUser = { id: 1, role: 'user', status: 'banned' };
    const canCreate = await permissionService.hasPermission(
      unsafeToUserId(mockUser.id),
      Permission.FORUM_CREATE_TOPIC
    );
    expect(canCreate).toBe(false);
  });

  it('should check ownership for FORUM_EDIT_OWN_TOPIC', async () => {
    const mockUser = { id: 1, role: 'user', status: 'active' };
    const mockTopic = { id: 1, user_id: 1 };

    const canEdit = await permissionService.canEditTopic(
      unsafeToUserId(mockUser.id),
      mockTopic
    );
    expect(canEdit).toBe(true);

    const cannotEdit = await permissionService.canEditTopic(
      unsafeToUserId(2), // Different user
      mockTopic
    );
    expect(cannotEdit).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { createTopicAction } from '@/lib/forums/actions/topic-actions';

describe('createTopicAction', () => {
  it('should create topic with valid input', async () => {
    const formData = new FormData();
    formData.append('category_id', 'general');
    formData.append('title', 'Test Topic');
    formData.append('content', 'This is test content that is long enough.');

    const result = await createTopicAction(formData);
    expect(result.isOk()).toBe(true);
    expect(result.value.title).toBe('Test Topic');
  });

  it('should reject topic with short title', async () => {
    const formData = new FormData();
    formData.append('category_id', 'general');
    formData.append('title', 'Hi'); // Too short
    formData.append('content', 'This is test content.');

    const result = await createTopicAction(formData);
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('should sanitize XSS attempts', async () => {
    const formData = new FormData();
    formData.append('category_id', 'general');
    formData.append('title', 'Test Topic');
    formData.append('content', '<script>alert("XSS")</script>Legitimate content');

    const result = await createTopicAction(formData);
    expect(result.isOk()).toBe(true);
    expect(result.value.content).not.toContain('<script>');
  });
});
```

### Security Tests

```typescript
import { sanitizeContent, detectSpam } from '@/lib/security/forum-security';

describe('Security', () => {
  it('should remove script tags', () => {
    const malicious = '<script>alert("XSS")</script>Safe content';
    const sanitized = sanitizeContent(malicious);
    expect(sanitized).not.toContain('<script>');
  });

  it('should detect spam patterns', () => {
    const spam = 'Buy cheap viagra now! Click here: http://very-long-suspicious-url.com/...';
    expect(detectSpam(spam)).toBe(true);
  });

  it('should detect mentions', () => {
    const content = 'Hey @john and @jane, check this out!';
    const mentions = detectMentions(content);
    expect(mentions).toEqual(['john', 'jane']);
  });
});
```

---

## Troubleshooting

### Common Issues

**1. Permission denied despite correct role**

**Cause:** Permission cache not invalidated after role change

**Solution:**
```typescript
await permissionService.clearUserPermissionCache(unsafeToUserId(user.id));
```

**2. Cannot reply to topic (locked)**

**Cause:** Topic is locked, user is not moderator

**Solution:** Check topic status and user role

```typescript
if (topic.status === 'locked' && !['admin', 'moderator'].includes(user.role)) {
  return <div>This topic is locked. Only moderators can reply.</div>;
}
```

**3. XSS content getting through**

**Cause:** Content not sanitized properly

**Solution:** Always use `sanitizeContent()` before saving

```typescript
const sanitized = sanitizeContent(rawContent);
// Save sanitized, not rawContent
```

**4. Rate limit false positives**

**Cause:** In-memory rate limiting resets on server restart

**Solution:** For production, use Redis for rate limiting:

```typescript
// Implement Redis-based rate limiting
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

export async function checkRateLimit(key: string, limit: number, window: number) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, window);
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  };
}
```

---

## Migration Guide

### From Old System to New Permission System

**Step 1:** Update imports

```typescript
// Old
import { checkPermission } from '@/lib/old-permissions';

// New
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';
```

**Step 2:** Replace permission checks

```typescript
// Old
if (user.role === 'admin' || user.role === 'moderator') {
  // Allow edit
}

// New
const canEdit = await permissionService.canEditTopic(
  unsafeToUserId(user.id),
  topic
);
if (canEdit) {
  // Allow edit
}
```

**Step 3:** Update Server Actions

```typescript
// Old
export async function createTopic(data: CreateTopicData) {
  if (!user) throw new Error('Unauthorized');
  // Direct database insert
}

// New
export async function createTopicAction(formData: FormData): Promise<Result<ForumTopic, ActionError>> {
  const user = await getServerSession();
  if (!user) return Err(createActionError('UNAUTHORIZED', 'Must be logged in'));

  // Permission check
  const canCreate = await permissionService.hasPermission(
    unsafeToUserId(user.id),
    Permission.FORUM_CREATE_TOPIC
  );

  if (!canCreate) {
    return Err(createActionError('FORBIDDEN', 'No permission'));
  }

  // ... rest of implementation
}
```

---

## API Reference

See individual files for complete API documentation:

- [`/lib/permissions/types.ts`](/home/user/Projects/web/veritable-games-main/frontend/src/lib/permissions/types.ts) - Permission types and enums
- [`/lib/permissions/service.ts`](/home/user/Projects/web/veritable-games-main/frontend/src/lib/permissions/service.ts) - PermissionService class
- [`/lib/forums/actions/topic-actions.ts`](/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/actions/topic-actions.ts) - Topic server actions
- [`/lib/forums/actions/reply-actions.ts`](/home/user/Projects/web/veritable-games-main/frontend/src/lib/forums/actions/reply-actions.ts) - Reply server actions
- [`/lib/security/forum-security.ts`](/home/user/Projects/web/veritable-games-main/frontend/src/lib/security/forum-security.ts) - Security utilities

---

## License & Support

This permission system is part of the Veritable Games platform.

For questions or issues:
1. Check this documentation
2. Review existing tests
3. Check console logs for permission errors
4. Enable audit logging for debugging

```typescript
// Enable audit logging
const permissionService = new PermissionService({
  enableAuditing: true,
  enableCaching: true,
  cacheTTL: 300,
  strictMode: false,
});

// View audit log
const recentChecks = permissionService.getAuditLog(100);
console.log(recentChecks);
```

---

**Last Updated:** 2025-10-01
**Version:** 1.0.0
**Author:** Claude Code (Anthropic)
