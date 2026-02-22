# Session Cookies Not Being Set - P0 Bug Fix

**Date**: February 16, 2026
**Severity**: P0 CRITICAL
**Status**: ✅ RESOLVED
**Time to Fix**: 2.5 hours (investigation + fix + verification)

---

## Problem Summary

**Symptom**: Login succeeded (200 OK, user redirected) but NO session cookies were sent to browser.

**Impact**:
- 🔴 Users cannot stay logged in
- 🔴 All authentication is broken
- 🔴 E2E tests fail (cannot test authenticated features)

**Evidence**:
```bash
# Login API returned 200 OK with user data
{"success": true, "data": {"user": {...}}, "message": "Login successful"}

# But HTTP response had NO Set-Cookie headers for session
# Only csrf_token cookie was present
< set-cookie: csrf_token=...; Path=/; SameSite=strict

# MISSING:
# < set-cookie: session_id=...; HttpOnly; SameSite=strict
# < set-cookie: has_auth=1; SameSite=strict
```

---

## Root Cause

**Next.js Bug #46579**: "[NEXT-735] Using headers.append twice with the Set-Cookie header only adds a single header"

**Issue**: When calling `response.headers.append('Set-Cookie', ...)` multiple times, Next.js only sends ONE Set-Cookie header instead of multiple. This is spec-incompliant behavior.

**In our code**:
```typescript
// This code was NOT working:
response.headers.append('Set-Cookie', sessionCookieHeader);
response.headers.append('Set-Cookie', indicatorCookieHeader);

// Only ONE of these cookies was being sent (middleware's csrf_token)
```

**References**:
- [Next.js Issue #46579](https://github.com/vercel/next.js/issues/46579)
- [Next.js Issue #40820](https://github.com/vercel/next.js/issues/40820) - Multiple Set-Cookie headers folded
- [Next.js Issue #54033](https://github.com/vercel/next.js/issues/54033) - .getSetCookie() broken

---

## Investigation Timeline

### 1. Code Review (30 min)
- ✅ Verified `httpOnly: true` flag was correctly set
- ✅ Confirmed `setSessionCookie()` was being called
- ✅ No obvious code errors

### 2. Middleware Check (15 min)
- ✅ Verified middleware only adds headers, doesn't remove cookies
- ✅ CSRF cookie works (uses same `response.cookies.set()` API)

### 3. Local Development Test (15 min)
- ✅ Bug reproduced in local dev (not deployment-specific)
- ✅ Ruled out Cloudflare/production environment issues

### 4. Direct Set-Cookie Header Test (30 min)
- ❌ Tried using `response.headers.append('Set-Cookie', ...)` directly
- ❌ Still didn't work - only ONE cookie sent

### 5. HTTP Response Analysis (15 min)
- ✅ Used curl to examine raw HTTP headers
- ✅ Confirmed: Only ONE Set-Cookie header in response
- ✅ Confirmed: `X-Auth-State-Changed: true` header WAS set (code IS running)

### 6. Next.js Bug Search (30 min)
- ✅ Found GitHub issue #46579 describing exact problem
- ✅ Discovered Next.js docs recommend using `cookies()` from `next/headers`

### 7. Implement Fix (15 min)
- ✅ Changed from `response.headers.append()` to `cookies().set()`
- ✅ Updated `createAuthResponse()` to be async
- ✅ Updated callers in `login/route.ts` and `register/route.ts`

### 8. Verification (15 min)
- ✅ curl test: All 3 cookies present
- ✅ Playwright test: All 3 cookies received by browser
- ✅ Session cookie has HttpOnly flag
- ✅ Auth indicator cookie is readable by client

---

## The Fix

### Before (Broken):
```typescript
// frontend/src/lib/auth/server.ts
export function createAuthResponse(data: any, sessionId: string) {
  const response = NextResponse.json(data);

  // ❌ This doesn't work - Next.js bug #46579
  response.headers.append('Set-Cookie', sessionCookieHeader);
  response.headers.append('Set-Cookie', indicatorCookieHeader);

  return response;
}
```

### After (Fixed):
```typescript
// frontend/src/lib/auth/server.ts
export async function createAuthResponse(data: any, sessionId: string) {
  // ✅ Use cookies() from next/headers instead
  const cookieStore = await cookies();

  // Set session cookie (HttpOnly)
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  // Set auth indicator cookie (readable by client)
  cookieStore.set('has_auth', '1', {
    httpOnly: false, // Client needs to read this
    secure,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  const response = NextResponse.json(data);
  response.headers.set('X-Auth-State-Changed', 'true');

  return response;
}
```

### Caller Updates:
```typescript
// frontend/src/app/api/auth/login/route.ts
// BEFORE:
return createAuthResponse(data, sessionId);

// AFTER (must await):
return await createAuthResponse(data, sessionId);
```

---

## Files Modified

1. `frontend/src/lib/auth/server.ts` - Updated `createAuthResponse()` to use `cookies()`
2. `frontend/src/app/api/auth/login/route.ts` - Added `await` to caller
3. `frontend/src/app/api/auth/register/route.ts` - Added `await` to caller

---

## Verification Tests

### Test 1: curl (Raw HTTP)
```bash
$ curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"username":"claude","password":"..."}'

HTTP/1.1 200 OK
set-cookie: csrf_token=...; Path=/; Max-Age=604800; SameSite=strict
set-cookie: session_id=...; HttpOnly; SameSite=strict  ← ✅ PRESENT
set-cookie: has_auth=1; SameSite=strict               ← ✅ PRESENT
x-auth-state-changed: true
```

### Test 2: Playwright (Browser)
```javascript
const cookies = await context.cookies();

// ✅ session_id: HttpOnly (secure)
// ✅ has_auth: NOT HttpOnly (readable by client)
// ✅ csrf_token: Present
// ✅ Total: 3 cookies
```

---

## Lessons Learned

### 1. **Trust Browser Tools Over Code**
Even when code looks correct, use browser DevTools and curl to verify actual HTTP behavior.

### 2. **Next.js Has Cookie API Bugs**
`response.headers.append('Set-Cookie', ...)` is broken in Next.js 15. Always use `cookies()` from `next/headers` instead.

### 3. **Test in Local Dev First**
Testing in local development quickly ruled out deployment/environment issues.

### 4. **Check GitHub Issues**
The exact problem was documented in Next.js issue tracker. Always search for known issues.

### 5. **Document API Quirks**
Added this incident doc to help future developers avoid this pitfall.

---

## Prevention

### Code Review Checklist
When working with cookies in Next.js:
- [ ] ✅ Use `cookies()` from `next/headers`
- [ ] ❌ NEVER use `response.headers.append('Set-Cookie', ...)`
- [ ] ✅ Test with curl to verify Set-Cookie headers
- [ ] ✅ Test with browser to verify cookies are received

### Testing
- Add E2E test to verify session cookies are set on login
- Add integration test to verify cookie flags (httpOnly, secure, sameSite)

---

## Related Documentation

- [Next.js Cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js Issue #46579](https://github.com/vercel/next.js/issues/46579)
- [MDN: Set-Cookie Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)

---

## Status

✅ **RESOLVED** - February 16, 2026 07:35 UTC

**Deployed**: Pending commit + push to production

**Verified**:
- ✅ Local development (curl + Playwright)
- ⏳ Production (pending deployment)

---

**Session End**: February 16, 2026 07:40 UTC
**Total Time**: 2.5 hours (investigation + fix + verification)
