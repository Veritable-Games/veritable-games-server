# Middleware Authentication Architecture

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                             │
│                  http://localhost:3000/forums                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Middleware                           │
│                   (Edge Runtime - Fast)                         │
│                  /frontend/middleware.ts                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  Static Asset?   │      │  Public Path?    │
    │  (/_next/*,      │      │  (/auth/login,   │
    │   *.js, *.css)   │      │   /api/auth/*)   │
    └────┬─────────────┘      └────┬─────────────┘
         │ YES                     │ YES
         │                         │
         ▼                         ▼
    ┌──────────────────────────────────┐
    │   ✅ Allow Access                │
    │   NextResponse.next()            │
    └──────────────────────────────────┘
         │ NO
         ▼
    ┌──────────────────┐
    │ Has session_id   │
    │    cookie?       │
    └────┬─────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
   NO        YES
    │         │
    │         └──────────────────────────┐
    │                                    │
    ▼                                    ▼
┌─────────────────────────┐   ┌──────────────────────┐
│  ❌ Redirect to Login   │   │  ✅ Allow Access     │
│  /auth/login?redirect=  │   │  (proceed to page)   │
│  /forums                │   │                      │
└─────────────────────────┘   └──────┬───────────────┘
                                     │
                                     ▼
                        ┌────────────────────────────┐
                        │     Page Loads             │
                        │  (Server Component)        │
                        └────────┬───────────────────┘
                                 │
                                 ▼
                        ┌────────────────────────────┐
                        │  getCurrentUser()          │
                        │  (Node.js Runtime)         │
                        │  Validates session in      │
                        │  auth.db                   │
                        └────────┬───────────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                        ▼                 ▼
                ┌──────────────┐  ┌──────────────┐
                │ Valid Session│  │Invalid Session│
                │  Return user │  │  Return 401  │
                └──────────────┘  └──────────────┘
```

## Two-Layer Security

### Layer 1: Middleware (Edge Runtime)

**Location**: `/frontend/middleware.ts` **Runtime**: Edge (fast, lightweight)
**Capabilities**: Limited (no database access)

**What it does**:

- ✅ Checks if `session_id` cookie exists
- ✅ Redirects unauthenticated users to login
- ✅ Allows static assets without auth
- ✅ Allows public paths without auth
- ❌ **CANNOT** validate session cryptographically
- ❌ **CANNOT** access database

**Purpose**: Fast gating to prevent page load for obvious unauthenticated users

### Layer 2: API Routes (Node.js Runtime)

**Location**: `/frontend/src/lib/auth/session.ts`,
`/frontend/src/lib/auth/server.ts` **Runtime**: Node.js (full capabilities)
**Capabilities**: Full (database access, crypto)

**What it does**:

- ✅ Validates session against auth.db
- ✅ Checks session expiration
- ✅ Verifies session integrity
- ✅ Returns user data if valid
- ✅ Returns 401 if invalid

**Purpose**: Full cryptographic validation for security

## Why Two Layers?

### Defense in Depth

1. **Fast rejection** (Edge): Block obvious unauthenticated requests before they
   reach the server
2. **Secure validation** (Node.js): Cryptographically verify sessions against
   database

### Performance

- **Edge middleware**: ~1ms to check cookie presence
- **Database validation**: ~10-50ms to query and verify

By doing lightweight checks first, we avoid expensive database calls for static
assets and unauthenticated users.

### Security

Even if middleware is bypassed (e.g., via API call), the second layer (API
validation) still protects the data.

## File Structure

```
frontend/
├── middleware.ts                    # ⭐ Edge Runtime - Layer 1 (lightweight gating)
├── src/
│   ├── middleware.ts.backup         # 🗑️ Old file (unused, backed up)
│   ├── lib/
│   │   └── auth/
│   │       ├── session.ts           # 🔐 Node.js Runtime - Layer 2 (validation)
│   │       ├── server.ts            # 🔐 Server-side auth utilities
│   │       └── service.ts           # 🔐 AuthService (database operations)
│   └── app/
│       ├── api/
│       │   └── auth/
│       │       ├── login/route.ts   # 🔓 Public API
│       │       └── session/route.ts # 🔓 Public API
│       └── auth/
│           └── login/
│               └── page.tsx         # 🔓 Public page
└── data/
    └── auth.db                      # 🗄️ Session storage
```

## Authentication Flow Examples

### Example 1: Unauthenticated User

```
1. User visits /forums
   ↓
2. Middleware checks for session_id cookie
   ↓ (NOT FOUND)
3. Middleware redirects to /auth/login?redirect=/forums
   ↓
4. User sees login page
   ↓
5. User enters credentials and submits
   ↓
6. POST /api/auth/login validates credentials
   ↓ (SUCCESS)
7. Server sets session_id cookie in auth.db
   ↓
8. Client redirects to /forums (from redirect param)
   ↓
9. Middleware checks for session_id cookie
   ↓ (FOUND)
10. Middleware allows access
    ↓
11. Page loads → getCurrentUser() validates session
    ↓ (VALID)
12. User sees forums page with user data
```

### Example 2: Authenticated User

```
1. User visits /wiki (already logged in)
   ↓
2. Middleware checks for session_id cookie
   ↓ (FOUND)
3. Middleware allows access
   ↓
4. Page loads → getCurrentUser() validates session in auth.db
   ↓ (VALID)
5. User sees wiki page
```

### Example 3: Expired Session

```
1. User visits /projects (session_id exists but expired)
   ↓
2. Middleware checks for session_id cookie
   ↓ (FOUND)
3. Middleware allows access
   ↓
4. Page loads → getCurrentUser() validates session in auth.db
   ↓ (EXPIRED)
5. getCurrentUser() returns null
   ↓
6. Page detects no user → client-side redirect to /auth/login
```

### Example 4: Static Asset

```
1. Browser requests /_next/static/chunks/app.js
   ↓
2. Middleware checks if static asset
   ↓ (YES - matches /_next/* pattern)
3. Middleware allows access immediately
   ↓
4. File served with cache headers (no auth check)
```

## Public vs Protected Routes

### Public Routes (No Authentication)

```javascript
// Defined in middleware.ts
const PUBLIC_PATHS = [
  '/auth/login', // Login page
  '/auth/register', // Registration page
  '/api/auth/login', // Login API
  '/api/auth/register', // Register API
  '/api/auth/session', // Session check API
  '/api/health', // Health check
];
```

**Pattern matching**:

- Exact match: `/auth/login` matches `/auth/login` only
- Prefix match: `/api/auth/login` matches `/api/auth/login` and
  `/api/auth/login/verify`

### Protected Routes (Authentication Required)

**Everything else**, including:

- `/` - Home
- `/forums` - Forums
- `/forums/[id]` - Forum topic
- `/wiki` - Wiki
- `/wiki/[slug]` - Wiki page
- `/library` - Library
- `/projects` - Projects
- `/projects/[slug]` - Project detail
- etc.

### Static Assets (No Authentication)

**Pattern**:

```javascript
pathname.startsWith('/_next/') ||
  pathname.startsWith('/static/') ||
  pathname.startsWith('/uploads/') ||
  pathname.match(
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|avif|webp|txt|xml|json)$/
  );
```

**Examples**:

- `/_next/static/chunks/app.js` ✅
- `/static/images/logo.png` ✅
- `/uploads/avatar.jpg` ✅
- `/favicon.ico` ✅
- `/styles.css` ✅

## Security Headers

All responses include these security headers:

```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': '...',  // Environment-specific
  'Vary': 'Accept-Encoding'
}
```

### CSP (Content Security Policy)

**Development**:

```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' ws: wss:;
```

**Production** (stricter):

```
default-src 'self';
script-src 'self' 'unsafe-eval';  # No unsafe-inline
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
```

## Edge Runtime Constraints

### What's Allowed ✅

- `request.cookies.get()`
- `new URL()`
- `NextResponse.redirect()`
- `NextResponse.next()`
- String operations
- Array operations
- `process.env` (build-time only)
- Web Crypto API

### What's NOT Allowed ❌

- `better-sqlite3` (or any Node.js native module)
- `fs` (file system)
- Node.js `crypto` module
- Dynamic `import()`
- `require()`
- Server-side `fetch` with Node.js-specific options
- Long-running operations (timeout ~30 seconds)

## Common Patterns

### Add a new public route

```typescript
// In middleware.ts
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/health',
  '/new/public/route', // ← Add here
];
```

### Protect a new route

**No changes needed** - all routes are protected by default unless in
`PUBLIC_PATHS`.

### Add a new static asset pattern

```typescript
// In middleware.ts, isStaticAsset() function
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/uploads/') ||
    pathname.startsWith('/new-static-dir/') || // ← Add here
    !!pathname.match(
      /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|avif|webp|txt|xml|json|pdf)$/
    ) // ← Or here
  );
}
```

## Troubleshooting

### Issue: Pages still accessible without auth

**Check**:

1. Is middleware.ts at the root level? (Not in src/)
2. Does middleware.ts have authentication logic?
3. Is the server restarted?
4. Are cookies enabled in browser?

**Debug**:

```bash
# Check middleware location
ls -lh middleware.ts

# Check middleware content
grep "hasSessionCookie" middleware.ts

# Restart server
npm run dev
```

### Issue: Login page redirects infinitely

**Check**:

1. Is `/auth/login` in PUBLIC_PATHS?
2. Is middleware returning `NextResponse.next()` for public paths?

### Issue: Static assets fail to load

**Check**:

1. Is `isStaticAsset()` function checking correct patterns?
2. Are static assets in `/_next/`, `/static/`, or have file extensions?

**Debug**:

```bash
# Check browser DevTools → Network tab
# Look for failed requests (red)
# Check if they're being redirected to /auth/login
```

### Issue: Authenticated users still redirected

**Check**:

1. Is `session_id` cookie set? (DevTools → Application → Cookies)
2. Is session valid in auth.db?
3. Is `hasSessionCookie()` function checking the correct cookie name?

**Debug**:

```javascript
// In middleware.ts, add logging (development only)
console.log('Cookie:', request.cookies.get('session_id'));
```

## Testing

See `MIDDLEWARE_FIX_SUMMARY.md` for complete testing instructions.

Quick test:

```bash
# 1. Start server
npm run dev

# 2. Incognito browser → http://localhost:3000
# Expected: Redirect to /auth/login

# 3. Login with valid credentials
# Expected: Access granted

# 4. Clear cookies → try to access /forums
# Expected: Redirect to /auth/login?redirect=/forums
```

## Related Files

- `/frontend/middleware.ts` - Main middleware (this architecture)
- `/frontend/src/lib/auth/session.ts` - Session validation
- `/frontend/src/lib/auth/server.ts` - Server-side auth utilities
- `/frontend/src/lib/auth/service.ts` - AuthService (database)
- `/frontend/MIDDLEWARE_FIX_SUMMARY.md` - Fix documentation
- `/QUICK_FIX_REFERENCE.md` - Quick reference guide

---

**Last Updated**: 2025-10-28
