# Forum Permission System - Quick Reference

**Quick access guide for developers implementing forum features**

---

## Files Created

```
frontend/
├── src/
│   └── lib/
│       ├── permissions/
│       │   ├── types.ts                    # Permission enums & types
│       │   └── service.ts                  # PermissionService with caching
│       ├── forums/
│       │   └── actions/
│       │       ├── topic-actions.ts        # Topic server actions
│       │       └── reply-actions.ts        # Reply server actions
│       └── security/
│           └── forum-security.ts           # Security utilities
└── FORUM_PERMISSION_SYSTEM.md              # Full documentation
```

---

## Quick Import Reference

```typescript
// Permission service
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';

// Server actions
import {
  createTopicAction,
  updateTopicAction,
  deleteTopicAction,
  pinTopicAction,
  lockTopicAction,
} from '@/lib/forums/actions/topic-actions';

import {
  createReplyAction,
  updateReplyAction,
  deleteReplyAction,
  markSolutionAction,
} from '@/lib/forums/actions/reply-actions';

// Security utilities
import {
  sanitizeContent,
  validateContentLength,
  detectMentions,
  checkRateLimit,
} from '@/lib/security/forum-security';

// Branded types
import { unsafeToUserId, unsafeToTopicId } from '@/lib/forums/branded-types';
```

---

## Role-Permission Matrix

| Action | Admin | Moderator | User | Notes |
|--------|-------|-----------|------|-------|
| **View** |
| View public category | ✅ | ✅ | ✅ | Everyone |
| View private category | ✅ | ✅ | ❌ | Staff only |
| View deleted content | ✅ | ✅ | ❌ | Staff only |
| **Topics** |
| Create topic | ✅ | ✅ | ✅ | All authenticated |
| Edit own topic | ✅ | ✅ | ✅ | Owner |
| Edit any topic | ✅ | ✅ | ❌ | Staff only |
| Delete own topic | ✅ | ✅ | ✅ | Owner |
| Delete any topic | ✅ | ✅ | ❌ | Staff only |
| Pin topic | ✅ | ✅ | ❌ | Staff only |
| Lock topic | ✅ | ✅ | ❌ | Staff only |
| **Replies** |
| Reply to open topic | ✅ | ✅ | ✅ | All authenticated |
| Reply to locked topic | ✅ | ✅ | ❌ | Staff only |
| Edit own reply | ✅ | ✅ | ✅ | Owner |
| Edit any reply | ✅ | ✅ | ❌ | Staff only |
| Delete own reply | ✅ | ✅ | ✅ | Owner |
| Delete any reply | ✅ | ✅ | ❌ | Staff only |
| Mark solution | ✅ | ✅ | ✅* | *Topic author only |
| **Moderation** |
| Ban users | ✅ | ✅ | ❌ | Staff only |
| Manage categories | ✅ | ❌ | ❌ | Admin only |
| Manage tags | ✅ | ❌ | ❌ | Admin only |
| Bypass rate limits | ✅ | ✅ | ❌ | Staff only |

---

## Common Permission Checks

### Check Basic Permission

```typescript
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';
import { unsafeToUserId } from '@/lib/forums/branded-types';

const canCreate = await permissionService.hasPermission(
  unsafeToUserId(user.id),
  Permission.FORUM_CREATE_TOPIC
);
```

### Check with Context (Ownership)

```typescript
const canEdit = await permissionService.hasPermission(
  unsafeToUserId(user.id),
  Permission.FORUM_EDIT_OWN_TOPIC,
  {
    topicId: topic.id,
    topicUserId: topic.user_id,
    isOwner: topic.user_id === user.id,
  }
);
```

### Check with Context (Locked Topic)

```typescript
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
// Easier than manual permission checks
const canEdit = await permissionService.canEditTopic(userId, topic);
const canDelete = await permissionService.canDeleteTopic(userId, topic);
const canReply = await permissionService.canReplyToTopic(userId, topic);
const canModerate = await permissionService.canModerate(userId);
```

---

## Server Action Patterns

### Create Topic Form

```typescript
'use client';

import { useActionState } from 'react';
import { createTopicAction } from '@/lib/forums/actions/topic-actions';

export default function CreateTopicForm({ categoryId }: Props) {
  const [state, formAction] = useActionState(createTopicAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="category_id" value={categoryId} />
      <input name="title" required minLength={3} maxLength={200} />
      <textarea name="content" required minLength={10} maxLength={50000} />
      <button type="submit">Create</button>

      {state?.isErr() && <div className="error">{state.error.message}</div>}
    </form>
  );
}
```

### Edit Topic Form

```typescript
'use client';

import { useActionState } from 'react';
import { updateTopicAction } from '@/lib/forums/actions/topic-actions';

export default function EditTopicForm({ topic }: Props) {
  const updateWithId = updateTopicAction.bind(null, topic.id);
  const [state, formAction] = useActionState(updateWithId, null);

  return (
    <form action={formAction}>
      <input name="title" defaultValue={topic.title} />
      <textarea name="content" defaultValue={topic.content} />
      <button type="submit">Update</button>
    </form>
  );
}
```

### Reply Form

```typescript
'use client';

import { useActionState } from 'react';
import { createReplyAction } from '@/lib/forums/actions/reply-actions';

export default function ReplyForm({ topicId, parentId }: Props) {
  const [state, formAction] = useActionState(createReplyAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="topic_id" value={topicId} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <textarea name="content" required minLength={1} maxLength={50000} />
      <button type="submit">Reply</button>
    </form>
  );
}
```

---

## Security Utilities

### Content Sanitization

```typescript
import { sanitizeContent } from '@/lib/security/forum-security';

const rawContent = formData.get('content') as string;
const sanitized = sanitizeContent(rawContent);
// Removes <script>, <iframe>, event handlers, etc.
```

### Content Validation

```typescript
import { validateContentLength } from '@/lib/security/forum-security';

const validation = validateContentLength(content, { min: 10, max: 50000 });
if (!validation.valid) {
  return Err(createActionError('VALIDATION_ERROR', validation.error));
}
```

### Mention Detection

```typescript
import { detectMentions } from '@/lib/security/forum-security';

const mentions = detectMentions(content);
// ['username1', 'username2'] - without @ symbol

// Create notifications
for (const username of mentions) {
  await createMentionNotification(username, topic);
}
```

### Rate Limiting

```typescript
import { checkRateLimit, getRateLimitKey } from '@/lib/security/forum-security';

const key = getRateLimitKey(user.id, 'CREATE_TOPIC');
const limit = checkRateLimit(key, 5, 3600); // 5 per hour

if (!limit.allowed) {
  return Err(createActionError('RATE_LIMITED', 'Too many topics'));
}
```

---

## Content Limits

```typescript
export const CONTENT_LIMITS = {
  TOPIC_TITLE_MIN: 3,
  TOPIC_TITLE_MAX: 200,
  TOPIC_CONTENT_MIN: 10,
  TOPIC_CONTENT_MAX: 50000,
  REPLY_CONTENT_MIN: 1,
  REPLY_CONTENT_MAX: 50000,
  CATEGORY_NAME_MAX: 100,
  TAG_NAME_MAX: 50,
};
```

---

## Rate Limits

```typescript
export const FORUM_RATE_LIMITS = {
  CREATE_TOPIC: {
    requests: 5,
    window: 3600, // 1 hour
  },
  CREATE_REPLY: {
    requests: 30,
    window: 3600,
  },
  EDIT_CONTENT: {
    requests: 20,
    window: 3600,
  },
  DELETE_CONTENT: {
    requests: 10,
    window: 3600,
  },
};
```

---

## Error Handling

### Server Action Error Response

```typescript
export interface ActionError {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}

// Common error codes:
// - UNAUTHORIZED - Not logged in
// - FORBIDDEN - No permission
// - VALIDATION_ERROR - Invalid input
// - NOT_FOUND - Entity doesn't exist
// - DATABASE_ERROR - DB operation failed
// - INTERNAL_ERROR - Unexpected error
// - RATE_LIMITED - Too many requests
```

### Handling in Components

```typescript
const [state, formAction] = useActionState(createTopicAction, null);

if (state?.isErr()) {
  const error = state.error;

  switch (error.code) {
    case 'UNAUTHORIZED':
      redirect('/login');
    case 'FORBIDDEN':
      return <div>You don't have permission</div>;
    case 'VALIDATION_ERROR':
      return <div>Error in {error.field}: {error.message}</div>;
    case 'RATE_LIMITED':
      return <div>{error.message}</div>;
    default:
      return <div>An error occurred: {error.message}</div>;
  }
}
```

---

## Cache Management

### Clear User Permissions

```typescript
import { permissionService } from '@/lib/permissions/service';
import { unsafeToUserId } from '@/lib/forums/branded-types';

// After role change
await permissionService.clearUserPermissionCache(unsafeToUserId(user.id));
```

### Clear All Permissions

```typescript
// After major permission system changes
await permissionService.clearAllPermissionCaches();
```

### Invalidate Forum Caches

```typescript
import { cacheManager } from '@/lib/cache/manager';

// After creating topic
await cacheManager.invalidateByTag('forum-topics');
await cacheManager.invalidatePattern(`category:${categoryId}`);

// After creating reply
await cacheManager.invalidateByTag('forum-replies');
await cacheManager.invalidatePattern(`topic:${topicId}`);
```

---

## Common Patterns

### Server Component with Permission Check

```typescript
import { getServerSession } from '@/lib/auth/session';
import { permissionService } from '@/lib/permissions/service';
import { unsafeToUserId } from '@/lib/forums/branded-types';

export default async function TopicPage({ params }: Props) {
  const user = await getServerSession();
  const topic = await getTopicById(params.id);

  const canEdit = user
    ? await permissionService.canEditTopic(unsafeToUserId(user.id), topic)
    : false;

  return (
    <div>
      <h1>{topic.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: topic.content }} />

      {canEdit && (
        <Link href={`/forums/topics/${topic.id}/edit`}>Edit</Link>
      )}
    </div>
  );
}
```

### Conditional Rendering Based on Role

```typescript
export function ModeratorControls({ topic, user }: Props) {
  const isModerator = user && ['admin', 'moderator'].includes(user.role);

  if (!isModerator) return null;

  return (
    <div className="moderator-controls">
      <button onClick={() => pinTopicAction(topic.id, !topic.is_pinned)}>
        {topic.is_pinned ? 'Unpin' : 'Pin'}
      </button>
      <button onClick={() => lockTopicAction(topic.id, topic.status !== 'locked')}>
        {topic.status === 'locked' ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
}
```

### Soft Delete Display

```typescript
export function ReplyContent({ reply, user }: Props) {
  const canViewDeleted =
    user && ['admin', 'moderator'].includes(user.role);

  if (reply.is_deleted && !canViewDeleted) {
    return <div className="deleted-content">[deleted]</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: reply.content }} />;
}
```

---

## Testing Examples

### Permission Check Test

```typescript
import { permissionService } from '@/lib/permissions/service';
import { Permission } from '@/lib/permissions/types';

test('user can edit own topic', async () => {
  const userId = 1;
  const topic = { id: 1, user_id: 1 };

  const canEdit = await permissionService.canEditTopic(userId, topic);
  expect(canEdit).toBe(true);
});

test('user cannot edit others topic', async () => {
  const userId = 1;
  const topic = { id: 1, user_id: 2 }; // Different owner

  const canEdit = await permissionService.canEditTopic(userId, topic);
  expect(canEdit).toBe(false);
});
```

### Server Action Test

```typescript
import { createTopicAction } from '@/lib/forums/actions/topic-actions';

test('creates topic with valid data', async () => {
  const formData = new FormData();
  formData.append('category_id', 'general');
  formData.append('title', 'Test Topic');
  formData.append('content', 'This is test content.');

  const result = await createTopicAction(formData);

  expect(result.isOk()).toBe(true);
  expect(result.value.title).toBe('Test Topic');
});
```

### Security Test

```typescript
import { sanitizeContent } from '@/lib/security/forum-security';

test('removes XSS vectors', () => {
  const malicious = '<script>alert("XSS")</script>Safe content';
  const sanitized = sanitizeContent(malicious);

  expect(sanitized).not.toContain('<script>');
  expect(sanitized).toContain('Safe content');
});
```

---

## Troubleshooting

### Permission Denied After Role Change

**Problem:** User still sees old permissions after role upgrade

**Solution:**
```typescript
await permissionService.clearUserPermissionCache(unsafeToUserId(user.id));
```

### Cannot Reply to Topic

**Problem:** "You don't have permission to reply"

**Check:**
1. Is topic locked? Only moderators can reply to locked topics
2. Is user banned? Banned users have no permissions
3. Is user authenticated?

```typescript
console.log('Topic status:', topic.status);
console.log('User role:', user.role);
console.log('User status:', user.status);
```

### XSS Content Getting Through

**Problem:** Malicious content visible on page

**Solution:** Ensure all content is sanitized:
```typescript
// ✅ CORRECT
const sanitized = sanitizeContent(rawContent);
db.prepare('INSERT INTO topics (content) VALUES (?)').run(sanitized);

// ❌ WRONG
db.prepare('INSERT INTO topics (content) VALUES (?)').run(rawContent);
```

### Rate Limit Issues

**Problem:** Rate limits reset unexpectedly

**Explanation:** In-memory rate limiting resets on server restart

**Production Solution:** Use Redis for persistent rate limiting

---

## Migration Checklist

- [ ] Import new permission types
- [ ] Replace manual role checks with `permissionService`
- [ ] Update forms to use Server Actions
- [ ] Add content sanitization
- [ ] Implement rate limiting
- [ ] Test permission checks for all roles
- [ ] Test edge cases (locked topics, banned users)
- [ ] Update UI to show/hide actions based on permissions
- [ ] Add error handling for permission denials
- [ ] Clear permission caches after role changes

---

## Next Steps

1. **Review full documentation:** See `FORUM_PERMISSION_SYSTEM.md` for detailed explanations
2. **Check implementation files:** Review the 5 created files for complete API
3. **Run tests:** Ensure all permission checks work correctly
4. **Implement UI:** Create forms using Server Actions pattern
5. **Monitor performance:** Check cache hit rates and query times
6. **Security audit:** Test XSS prevention and rate limiting

---

## Support

For detailed documentation, see: `/frontend/FORUM_PERMISSION_SYSTEM.md`

File locations:
- Permissions: `/frontend/src/lib/permissions/`
- Server Actions: `/frontend/src/lib/forums/actions/`
- Security: `/frontend/src/lib/security/forum-security.ts`

---

**Quick Reference Version:** 1.0.0
**Last Updated:** 2025-10-01
