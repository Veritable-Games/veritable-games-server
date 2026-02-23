# Rate Limiting Implementation Guide

This document provides instructions for applying rate limiting to API endpoints.

## Completed

✅ **Authentication - Login** (`src/app/api/auth/login/route.ts`)

- Rate limiter: `rateLimiters.auth` (5 requests per 15 minutes)
- Key: IP address (`auth:login:{ip}`)

## Remaining Endpoints to Update

### 1. Authentication - Register

**File**: `src/app/api/auth/register/route.ts`

```typescript
import { withSecurity, rateLimiters } from '@/lib/security/middleware';

export const POST = withSecurity(registerHandler, {
  rateLimiter: rateLimiters.auth,
  rateLimitKey: req => {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0]
      : req.headers.get('x-real-ip') || 'unknown';
    return `auth:register:${ip}`;
  },
});
```

### 2. Forum Topics - Create

**File**: `src/app/api/forums/topics/route.ts`

```typescript
import { withSecurity, rateLimiters } from '@/lib/security/middleware';

export const POST = withSecurity(createTopicHandler, {
  rateLimiter: rateLimiters.topicCreate,
  rateLimitKey: req => {
    // Rate limit by user ID from session
    // Will require extracting user from request
    return `forum:topic:create:${userId}`;
  },
});
```

### 3. Forum Replies - Create

**File**: `src/app/api/forums/replies/route.ts`

```typescript
import { withSecurity, rateLimiters } from '@/lib/security/middleware';

export const POST = withSecurity(createReplyHandler, {
  rateLimiter: rateLimiters.replyCreate,
  rateLimitKey: req => {
    return `forum:reply:create:${userId}`;
  },
});
```

### 4. File Uploads - References

**File**: `src/app/api/projects/[slug]/references/route.ts`

Need to create new rate limiter first:

```typescript
// In middleware.ts, add:
fileUpload: createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,  // 1 hour
  maxRequests: 10,            // 10 uploads per hour
  keyPrefix: 'file-upload',
}),

// Then in route:
export const POST = withSecurity(uploadHandler, {
  rateLimiter: rateLimiters.fileUpload,
  rateLimitKey: (req) => `upload:${userId}`,
});
```

### 5. File Uploads - Avatar

**File**: `src/app/api/users/[id]/avatar/route.ts`

```typescript
export const POST = withSecurity(avatarUploadHandler, {
  rateLimiter: rateLimiters.fileUpload,
  rateLimitKey: req => `avatar:${userId}`,
});
```

### 6. Search Endpoints

**Files**:

- `src/app/api/forums/search/route.ts`
- `src/app/api/wiki/search/route.ts`

```typescript
export const GET = withSecurity(searchHandler, {
  rateLimiter: rateLimiters.search,
  rateLimitKey: req => {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `search:${ip}`;
  },
});
```

## Additional Rate Limiters Needed

Add these to `middleware.ts`:

```typescript
export const rateLimiters = {
  // ... existing ...

  // File uploads: 10 per hour
  fileUpload: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'file-upload',
  }),

  // Messages: 20 per hour
  messageSend: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'message-send',
  }),

  // Wiki page creation: 10 per hour
  wikiCreate: createRateLimitMiddleware({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'wiki-create',
  }),
};
```

## Helper Function for User-Based Rate Limiting

Add to `middleware.ts`:

```typescript
import { getCurrentUser } from '@/lib/auth/utils';

export async function getUserIdForRateLimit(
  request: NextRequest
): Promise<string> {
  const user = await getCurrentUser(request);
  if (user) {
    return `user:${user.id}`;
  }

  // Fall back to IP for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]
    : request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}
```

## Testing Rate Limiting

After implementation, test with:

```bash
# Test login rate limiting (should fail after 5 attempts)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -v
  echo "Attempt $i"
done

# Should see 429 Too Many Requests on attempt 6
```

## Status Tracking

- [x] Login rate limiting
- [x] Register rate limiting
- [x] Forum topic creation rate limiting
- [x] Forum reply creation rate limiting
- [x] File upload rate limiting (references, concept-art, avatar)
- [x] Search rate limiting (forums, wiki)
- [ ] Message sending rate limiting (no message creation endpoint found)
- [ ] Wiki creation rate limiting (existing endpoints use default security)
