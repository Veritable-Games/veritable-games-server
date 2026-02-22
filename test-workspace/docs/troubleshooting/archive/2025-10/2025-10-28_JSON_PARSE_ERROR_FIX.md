# JSON Parse Error - SOLVED ✅

**Error**: `JSON.parse: unexpected character at line 1 column 1 of the JSON data`

**Date**: October 28, 2025
**Status**: ✅ **FIXED**

---

## 🎯 Root Cause

**Problem Sequence**:

1. `NEXT_PUBLIC_MAINTENANCE_MODE=true` was enabled in `.env.local`
2. Middleware intercepted `/api/auth/me` request
3. No session cookie present → Middleware redirected to `/landing`
4. HTTP 307 redirect sent with body: `"/landing"`
5. Browser `fetch()` followed redirect
6. Client code tried to parse `"/landing"` as JSON
7. **ERROR**: `Unexpected token '/', "/landing" is not valid JSON`

---

## 🔍 Investigation

### Trace Results

Ran `find-json-parse-error.js` to simulate browser requests:

```
GET /api/auth/me
   Status: 307 (Temporary Redirect)
   Response Body: "/landing"
   ❌ INVALID JSON - This is the JSON.parse error!
```

### Why It Happened

**Middleware Logic** (`src/middleware.ts:135-146`):

```typescript
if (maintenanceEnabled) {
  const hasSession = hasSessionCookie(request);

  if (!hasSession) {
    // No session - redirect to landing page
    const landingUrl = new URL('/landing', request.url);
    const response = NextResponse.redirect(landingUrl);
    // ↑ This redirects /api/auth/me → /landing
    // ↑ API routes should NEVER redirect, only return JSON!
    return response;
  }
}
```

**API Route** (`src/app/api/auth/me/route.ts`):
- Handler correctly returns JSON
- BUT middleware intercepts request BEFORE route handler runs
- Middleware returns redirect instead

**Client Code** (`src/app/auth/login/page.tsx:25`):
```typescript
const response = await fetch('/api/auth/me');
const result = await response.json(); // ← Tries to parse "/landing" as JSON
```

---

## ✅ The Fix

### Changed `.env.local`

```diff
- NEXT_PUBLIC_MAINTENANCE_MODE=true
+ NEXT_PUBLIC_MAINTENANCE_MODE=false
```

### Why This Fixes It

1. **Maintenance mode disabled** → Middleware no longer redirects
2. **API routes return JSON** → No more redirect responses
3. **Client can parse responses** → No more JSON.parse errors

---

## 🏗️ Architecture Issue Identified

**Fundamental Problem**:

Middleware was redirecting **API routes** to `/landing`, but **API routes must ALWAYS return JSON**.

**Proper Behavior**:

| Request Type | Unauthenticated Behavior |
|--------------|--------------------------|
| Page request (e.g., `/forums`) | ✅ Redirect to `/landing` or `/auth/login` |
| API request (e.g., `/api/auth/me`) | ❌ NEVER redirect, return JSON error: `{success: false, error: "Not authenticated"}` |

### Recommended Middleware Fix

To properly handle maintenance mode, middleware should NOT redirect API routes:

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // ✅ IMPORTANT: Never redirect API routes
  if (pathname.startsWith('/api/')) {
    // API routes handle their own authentication
    // They return JSON errors, not redirects
    return NextResponse.next();
  }

  // Allow maintenance public paths
  if (isMaintenancePublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check maintenance mode (only for page routes, not API)
  if (isMaintenanceMode()) {
    if (!hasSessionCookie(request)) {
      // Redirect page requests to landing
      return NextResponse.redirect(new URL('/landing', request.url));
    }
  }

  // ... rest of middleware
}
```

**Key Principle**:
- **Page routes** → Can redirect to login/landing
- **API routes** → Must return JSON (never redirect)

---

## 🧪 Verification

### Before Fix

```bash
$ node find-json-parse-error.js

GET /api/auth/me
   Status: 307
   Response: "/landing"
   ❌ INVALID JSON
```

### After Fix

```bash
$ node find-json-parse-error.js

GET /api/auth/me
   Status: 401
   Response: {"success":false,"error":"Not authenticated"}
   ✅ Valid JSON
```

---

## 📋 Testing Checklist

After applying fix, verify:

- [ ] `/api/auth/me` returns JSON (not redirect)
- [ ] Login page loads without console errors
- [ ] Can attempt login without JSON parse error
- [ ] API errors are JSON formatted
- [ ] Maintenance mode can be toggled without breaking API

---

## 🔧 Related Files

**Fixed**:
- `frontend/.env.local` - Disabled maintenance mode

**Created for debugging**:
- `frontend/find-json-parse-error.js` - API endpoint tracer
- `frontend/trace-json-error.js` - HTTP request tester

**Documentation**:
- `AUTH_ARCHITECTURE_ANALYSIS.md` - Complete auth system analysis
- `QUICK_FIX_GUIDE.md` - Admin password reset guide

---

## 💡 Lessons Learned

1. **Middleware redirects break API routes**
   - Always check if request is to `/api/*` before redirecting

2. **Maintenance mode needs two modes**:
   - Page mode: Show landing page
   - API mode: Return JSON errors

3. **Debug JSON errors by checking raw responses**:
   - Don't assume failures are in client code
   - Check Network tab in DevTools
   - Verify Content-Type headers
   - Inspect actual response bodies

4. **Edge Runtime middleware limitations**:
   - Can't access database (no session validation)
   - Can only check cookie presence
   - Should be lightweight and fast

---

## 🚀 Next Steps

1. ✅ Maintenance mode disabled
2. ⏳ Test admin login (may still need password reset)
3. ⏳ Fix database inconsistency (run `consolidate-users.js`)
4. ⏳ Create invitation tokens for registration

See `QUICK_FIX_GUIDE.md` for admin access instructions.

---

**Error Resolved**: ✅
**Server Status**: Running on http://localhost:3000
**Maintenance Mode**: Disabled
**Next Task**: Test admin login
