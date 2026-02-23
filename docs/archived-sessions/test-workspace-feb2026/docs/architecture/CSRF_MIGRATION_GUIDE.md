# CSRF Migration Guide

## Overview

CSRF protection has been restored to the backend (October 2025). All POST/PUT/PATCH/DELETE requests must include a CSRF token.

## Quick Migration

### Before (Vulnerable to CSRF)
```typescript
const response = await fetch('/api/forums/topics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, content }),
});
```

### After (CSRF Protected)
```typescript
import { fetchJSON } from '@/lib/utils/csrf';

const data = await fetchJSON('/api/forums/topics', {
  method: 'POST',
  body: { title, content }, // No stringify needed
});
```

## Available Utilities

### 1. `fetchJSON<T>()` - Recommended
Automatically handles:
- CSRF token inclusion
- JSON stringification
- Response parsing
- Error throwing

```typescript
import { fetchJSON } from '@/lib/utils/csrf';

// POST request
const topic = await fetchJSON('/api/forums/topics', {
  method: 'POST',
  body: { title: 'Hello', content: 'World' },
});

// GET request (CSRF not needed, but still works)
const topics = await fetchJSON('/api/forums/topics');

// PATCH request
const updated = await fetchJSON(`/api/forums/replies/${id}`, {
  method: 'PATCH',
  body: { content: 'Updated content' },
});

// DELETE request
const deleted = await fetchJSON(`/api/forums/topics/${id}`, {
  method: 'DELETE',
});
```

### 2. `fetchWithCSRF()` - Lower Level
Same as `fetch()` but adds CSRF token:

```typescript
import { fetchWithCSRF } from '@/lib/utils/csrf';

const response = await fetchWithCSRF('/api/forums/topics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, content }),
});

const data = await response.json();
```

### 3. `getCSRFToken()` - Manual Control
Get token directly:

```typescript
import { getCSRFToken } from '@/lib/utils/csrf';

const token = getCSRFToken();

const response = await fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': token,
  },
  body: JSON.stringify(data),
});
```

## Migration Checklist

### Files to Update (Priority Order)

#### High Priority - Forum Operations ✅ COMPLETED
- [x] `src/app/forums/create/page.tsx` ✅ DONE
  - [x] POST /api/forums/topics (line 86)

- [x] `src/components/forums/ReplyList.tsx` ✅ DONE
  - [x] POST /api/forums/replies (nested and top-level)
  - [x] PATCH /api/forums/replies/{id}
  - [x] POST/DELETE /api/forums/replies/{id}/solution
  - [x] DELETE /api/forums/replies/{id}

- [x] `src/components/forums/TopicView.tsx` ✅ DONE
  - [x] PATCH /api/forums/topics/{id}
  - [x] DELETE /api/forums/topics/{id}

- [x] `src/components/forums/TagSelector.tsx` ✅ DONE
  - [x] POST /api/forums/tags

#### Medium Priority - Other Features
- [ ] User profile updates
- [ ] Settings changes
- [ ] Wiki edits
- [ ] Library uploads

#### Low Priority - Read-Only (No CSRF needed)
- GET requests don't need CSRF tokens (but using fetchJSON won't hurt)

## Testing

###1. Verify Token is Set
Open browser DevTools > Application > Cookies
Look for `csrf_token` cookie

### 2. Test POST Request
```typescript
import { fetchJSON } from '@/lib/utils/csrf';

try {
  const result = await fetchJSON('/api/forums/topics', {
    method: 'POST',
    body: { title: 'Test', content: 'Testing CSRF' },
  });
  console.log('Success!', result);
} catch (error) {
  console.error('Failed:', error);
}
```

### 3. Check Network Tab
POST request should have header:
```
x-csrf-token: <64-character-hex-string>
```

## Error Handling

### CSRF Validation Failed (403)
```json
{
  "error": "CSRF validation failed",
  "message": "Invalid or missing CSRF token"
}
```

**Causes**:
1. Cookie not set (server didn't send it)
2. Token not included in request
3. Cookie and header don't match

**Fix**:
1. Ensure server sends CSRF cookie (check withSecurity wrapper)
2. Use `fetchJSON()` or `fetchWithCSRF()`
3. Check browser isn't blocking cookies

### Rate Limit Exceeded (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

**Headers**:
```
Retry-After: 3600
X-RateLimit-Reset: 1728394800000
```

## Common Patterns

### Form Submission
```typescript
'use client';
import { fetchJSON } from '@/lib/utils/csrf';

function MyForm() {
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = await fetchJSON('/api/data', {
        method: 'POST',
        body: { /* form data */ },
      });

      alert('Success!');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Optimistic UI with CSRF
```typescript
'use client';
import { useOptimistic } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';

function ReplyList({ replies }) {
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    replies,
    (current, newReply) => [...current, newReply]
  );

  const handleSubmit = async () => {
    // 1. Update UI immediately
    addOptimisticReply({ id: Date.now(), content: userInput });

    // 2. Clear form
    setUserInput('');

    // 3. Send request with CSRF
    try {
      await fetchJSON('/api/forums/replies', {
        method: 'POST',
        body: { content: userInput },
      });

      // 4. Sync with server
      router.refresh();
    } catch (error) {
      // On error, refresh reverts optimistic update
      router.refresh();
    }
  };
}
```

### React Hook Usage
```typescript
'use client';
import { useCSRFToken } from '@/lib/utils/csrf';

function MyComponent() {
  const csrfToken = useCSRFToken();

  const handleAction = async () => {
    if (!csrfToken) {
      console.error('No CSRF token available');
      return;
    }

    await fetch('/api/data', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      body: JSON.stringify(data),
    });
  };
}
```

## Backward Compatibility

### Server-Side (API Routes)
CSRF protection is **enabled by default** but can be disabled:

```typescript
export const POST = withSecurity(async (request) => {
  // Your logic
}, {
  enableCSRF: false, // Disable CSRF for this route (not recommended)
});
```

### Frontend
Old `fetch()` calls will fail with 403. Must update to include CSRF token.

## Production Deployment

1. Ensure `process.env.NODE_ENV === 'production'` for secure cookies
2. Use HTTPS (CSRF cookies have `secure` flag in production)
3. Monitor 403 errors after deployment (indicates missing CSRF tokens)
4. Check rate limit headers in responses

## Troubleshooting

### "CSRF token not found in cookies"
- Server didn't set the cookie
- Check `withSecurity()` wrapper is used
- Verify response has `Set-Cookie` header

### "Invalid or missing CSRF token"
- Token in cookie doesn't match header
- Use `fetchJSON()` or `fetchWithCSRF()`
- Check browser isn't clearing cookies

### Requests work in development but fail in production
- Check `secure` cookie flag (requires HTTPS)
- Verify `sameSite` cookie attribute
- Check domain/subdomain cookie scope

## References

- CSRF Utility: `/src/lib/utils/csrf.ts`
- Security Middleware: `/src/lib/security/middleware.ts`
- Documentation: `/docs/PERFORMANCE_MONITORING.md`
- Critical Improvements: `/frontend/CRITICAL_IMPROVEMENTS_SUMMARY.md`
