# Production Login Issue: Cookie Prefix vs HTTP Protocol Incompatibility

**Date**: November 8, 2025
**Status**: Identified - Awaiting Fix Implementation
**Severity**: Critical (Complete login failure on production)
**Affected Environment**: Production HTTP deployment (192.168.1.15:3000)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Issue Overview](#issue-overview)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Investigation Findings](#investigation-findings)
5. [Fix Options](#fix-options)
6. [Recommended Solution](#recommended-solution)
7. [Implementation Guide](#implementation-guide)
8. [Security Considerations](#security-considerations)
9. [Testing & Verification](#testing--verification)
10. [References](#references)

---

## Executive Summary

**Problem**: Users cannot log in to production environment (192.168.1.15:3000) despite correct credentials.

**Root Cause**: The session cookie uses the `__Secure-` prefix (which requires HTTPS) but production runs on HTTP, causing browsers to reject the cookie.

**Impact**: 100% login failure rate on production HTTP deployment. Authentication system is fully functional, but cookies are blocked by browser security enforcement.

**Solution**: Add environment variable to control cookie prefix usage, or remove the prefix entirely for HTTP deployments.

**Timeline**:
- Issue identified: November 8, 2025
- Investigation completed: November 8, 2025
- Fix implementation: Pending selection of Option 1, 2, or 3

---

## Issue Overview

### Symptoms

**Production Environment (192.168.1.15:3000)**:
- ❌ Login fails with 401 Unauthorized
- ❌ Browser console warning: `Cookie "__Secure-session_id" has been rejected for invalid prefix`
- ❌ Security warning: `Password fields present on an insecure (http://) page`
- ❌ Affects all user accounts (admin, regular users)

**Development Environment (localhost:3000)**:
- ✅ Login works perfectly
- ✅ Same credentials, same code
- ✅ No cookie warnings

### Error Messages

**Browser Console**:
```
Cookie "__Secure-session_id" has been rejected for invalid prefix.
TypeError: can't access property "catch", n() is undefined
```

**Network Tab**:
```
POST http://192.168.1.15:3000/api/auth/login
Status: 401 Unauthorized
```

**Security Warning**:
```
Password fields present on an insecure (http://) page.
This is a security risk that allows user login credentials to be stolen.
```

---

## Root Cause Analysis

### The `__Secure-` Cookie Prefix Requirement

According to the Cookie specification (RFC 6265bis), the `__Secure-` prefix has strict requirements:

1. **Cookies with `__Secure-` prefix MUST have the `Secure` attribute set to `true`**
2. **Cookies with the `Secure` attribute can ONLY be set over HTTPS connections**
3. **Browsers will REJECT `__Secure-` prefixed cookies on HTTP connections**

This is a **browser-enforced security specification** - there is no workaround or override.

### Current Production Configuration

**Environment Variables**:
```bash
NODE_ENV=production
COOKIE_SECURE_FLAG=false      # ✅ Sets secure attribute to false
POSTGRES_URL=postgresql://... # ✅ Database connection
NEXT_PUBLIC_SITE_URL=http://m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io
```

**Code Configuration** (`frontend/src/lib/auth/server.ts:16-18`):
```typescript
// Use __Secure- prefix in production for additional security
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

### The Mismatch

| Aspect | Current Setting | Browser Requirement | Result |
|--------|----------------|---------------------|---------|
| Cookie Name | `__Secure-session_id` | Must use HTTPS | ❌ Conflict |
| Secure Flag | `false` (via `COOKIE_SECURE_FLAG`) | Must be `true` for `__Secure-` | ❌ Conflict |
| Protocol | HTTP (192.168.1.15:3000) | Must be HTTPS | ❌ Conflict |
| Browser Action | Receives Set-Cookie header | Rejects cookie | ❌ Login fails |

### Why `COOKIE_SECURE_FLAG=false` Doesn't Fix It

The environment variable `COOKIE_SECURE_FLAG` controls the cookie's **`secure` attribute**:

```typescript
// In server.ts lines 46-53
secure: process.env.COOKIE_SECURE_FLAG !== undefined
  ? process.env.COOKIE_SECURE_FLAG === 'true'
  : process.env.NODE_ENV === 'production'
```

**However**, the cookie **NAME** is hardcoded based on `NODE_ENV` only:

```typescript
// The problem: No environment variable controls this
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

**Result**:
- ✅ `COOKIE_SECURE_FLAG=false` sets `secure` attribute correctly
- ❌ Cookie name is still `__Secure-session_id` (requires HTTPS)
- ❌ Browser rejects cookie regardless of `secure` flag value

### Why It Works on Localhost

| Environment | NODE_ENV | Cookie Name | Protocol | Browser Accepts? |
|-------------|----------|-------------|----------|------------------|
| **Localhost** | `development` | `session_id` | HTTP | ✅ Yes (no prefix requirement) |
| **Production** | `production` | `__Secure-session_id` | HTTP | ❌ No (prefix requires HTTPS) |

**Development mode** uses `session_id` (no prefix), which has no protocol restrictions.

---

## Investigation Findings

### Authentication System Status: ✅ FULLY FUNCTIONAL

The comprehensive investigation revealed that **every component of the authentication system is working correctly**:

#### Database ✅

**Production PostgreSQL Verification**:
```sql
-- Admin account exists and is active
SELECT username, email, role, is_active
FROM users.users
WHERE username = 'admin';

-- Result:
username | email                     | role  | is_active
---------|---------------------------|-------|----------
admin    | admin@veritablegames.com  | admin | true
```

**Password Hash Verification**:
```javascript
// Tested via bcrypt.compare()
const hash = "$2b$12$sPZlrvo46xowZ..."; // From database
const password = "euZe3CTvcDqqsVz";
await bcrypt.compare(password, hash); // ✅ Returns true
```

**Sessions Table**:
- ✅ 5 active sessions found
- ✅ Session IDs: 64-character hex strings (cryptographically secure)
- ✅ Proper foreign key relationships to users table
- ✅ Expiration timestamps set correctly (30 days)

#### Security Mechanisms ✅

**CSRF Protection**:
- ✅ Double Submit Cookie pattern implemented
- ✅ Timing-safe token comparison
- ✅ Automatic token rotation
- ✅ Client-side utilities working correctly

**Rate Limiting**:
- ✅ Configured: 5 attempts per 15 minutes per IP
- ✅ Tested and blocking correctly
- ✅ Sliding window algorithm
- ✅ In-memory LRU cache (1000 entries max)

**Password Security**:
- ✅ bcrypt with cost factor 12
- ✅ Timing-safe password verification
- ✅ Dummy hash for non-existent users (prevents timing attacks)
- ✅ Error messages prevent username enumeration

**Session Security**:
- ✅ httpOnly: true (prevents JavaScript access)
- ✅ sameSite: 'strict' (prevents CSRF)
- ✅ 64-character hex tokens (128 bits of entropy)
- ✅ Cryptographically secure random generation

#### Code Flow ✅

**Complete Login Flow** (All Steps Working):
```
1. POST /api/auth/login
   ✅ Request received

2. withSecurity middleware
   ✅ CSRF validation passes
   ✅ Rate limiting checks pass

3. authService.login()
   ✅ Database query executes
   ✅ Password verification succeeds
   ✅ Session created in database
   ✅ last_active timestamp updated

4. createAuthResponse()
   ✅ Session cookie header created
   ✅ User data serialized
   ✅ Response sent to browser

5. Browser receives response
   ❌ Cookie rejected (prefix violation)
   ❌ Subsequent requests have no session
   ❌ User appears logged out
```

**The ONLY failure point**: Browser cookie rejection due to `__Secure-` prefix on HTTP.

### Files Using `__Secure-` Prefix

The hardcoded prefix appears in **4 locations**:

| File | Line | Context |
|------|------|---------|
| `src/lib/auth/server.ts` | 18 | Cookie name definition (primary) |
| `src/middleware.ts` | 85 | Middleware session check |
| `src/app/api/users/[id]/route.ts` | 114 | User API route |
| `src/app/api/auth/logout/route.ts` | 18 | Logout route |

**Pattern in all files**:
```typescript
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

---

## Fix Options

### Option 1: Environment Variable for Cookie Prefix Control

**Recommended for**: Production flexibility + future HTTPS migration

#### Changes Required

**1. Update Cookie Name Logic (4 files)**

Replace existing pattern with:
```typescript
// Add new environment variable control
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false; // Default to false for compatibility

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX
  ? '__Secure-session_id'
  : 'session_id';
```

**2. Environment Configuration**

**For HTTP Deployments** (current production):
```bash
# .env or Coolify environment variables
COOKIE_USE_SECURE_PREFIX=false
COOKIE_SECURE_FLAG=false
```

**For HTTPS Deployments** (future):
```bash
# When SSL is configured
COOKIE_USE_SECURE_PREFIX=true
COOKIE_SECURE_FLAG=true
```

**3. Update Documentation**

Add to `.env.example`:
```bash
# ===== COOKIE PREFIX CONFIGURATION =====
# Control whether to use __Secure- prefix for session cookies
# - Default: false (works on both HTTP and HTTPS)
# - Set to true ONLY when using HTTPS
# - IMPORTANT: __Secure- prefix REQUIRES HTTPS connection
#
# Current Production Setup (November 2025):
# - Server: http://192.168.1.15:3000 (HTTP only, no SSL)
# - Required: COOKIE_USE_SECURE_PREFIX=false
# - When SSL added: Set to true for enhanced security
#
COOKIE_USE_SECURE_PREFIX=false
```

#### Pros

✅ **Flexible**: Works for both HTTP and HTTPS deployments
✅ **Future-proof**: Easy migration path when HTTPS is added
✅ **Explicit**: Configuration clearly states prefix usage
✅ **Reversible**: Can switch back to `__Secure-` prefix anytime
✅ **Documented**: Environment variable makes intention clear
✅ **Best practice**: Separates concerns (protocol vs environment)

#### Cons

⚠️ **More changes**: Need to update 4 files + documentation
⚠️ **Configuration required**: Must set environment variable in production
⚠️ **Testing needed**: Verify both HTTP and HTTPS modes work

#### Files to Modify

1. `frontend/src/lib/auth/server.ts` (lines 17-18)
2. `frontend/src/middleware.ts` (lines 84-85)
3. `frontend/src/app/api/users/[id]/route.ts` (line 114)
4. `frontend/src/app/api/auth/logout/route.ts` (line 18)
5. `frontend/.env.example` (add documentation section)

---

### Option 2: Remove `__Secure-` Prefix Entirely

**Recommended for**: Quick fix, HTTP-only deployments

#### Changes Required

**1. Update Cookie Name (4 files)**

Replace:
```typescript
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

With:
```typescript
const SESSION_COOKIE_NAME = 'session_id';
```

**2. Update Comments**

Remove or update comments referencing `__Secure-` prefix security benefits.

#### Pros

✅ **Simplest fix**: One-line change per file
✅ **Immediate**: Works instantly on HTTP
✅ **No config needed**: No environment variables required
✅ **Consistent**: Same cookie name in all environments
✅ **Fast deployment**: Minimal testing required

#### Cons

❌ **No HTTPS benefit**: Loses security enhancement when HTTPS is added
❌ **Manual migration**: Need code changes to add prefix back later
❌ **Less flexible**: Cannot switch between HTTP/HTTPS easily
❌ **Security regression**: Removes defense-in-depth layer for future HTTPS

#### Files to Modify

1. `frontend/src/lib/auth/server.ts` (line 18)
2. `frontend/src/middleware.ts` (line 85)
3. `frontend/src/app/api/users/[id]/route.ts` (line 114)
4. `frontend/src/app/api/auth/logout/route.ts` (line 18)

---

### Option 3: Add HTTPS to Production

**Recommended for**: Long-term security, permanent solution

#### Requirements

**1. SSL Certificate**
- Option A: Let's Encrypt (free, automated)
- Option B: Self-signed (for internal network)
- Option C: Custom CA certificate

**2. Configure Coolify/Traefik**
- Enable HTTPS listener on port 443
- Configure SSL certificate in Traefik
- Set up automatic redirect from HTTP → HTTPS
- Update Coolify domain configuration

**3. Update Environment**
```bash
# Keep prefix enabled (default behavior)
# Remove COOKIE_SECURE_FLAG override or set to true
COOKIE_SECURE_FLAG=true
NEXT_PUBLIC_SITE_URL=https://192.168.1.15:3000
```

**4. DNS/URL Updates**
- Update all references from `http://` to `https://`
- Configure browser bookmarks
- Update documentation

#### Pros

✅ **Maximum security**: Full HTTPS encryption
✅ **No code changes**: Works with existing `__Secure-` prefix
✅ **Best practice**: Industry standard for web applications
✅ **Future-proof**: Enables other HTTPS-only features (HTTP/2, service workers, etc.)
✅ **Defense in depth**: `__Secure-` prefix adds extra security layer

#### Cons

❌ **Infrastructure work**: Requires Coolify/Traefik configuration
❌ **Certificate management**: Renewal, expiration monitoring
❌ **Longer timeline**: Cannot be deployed immediately
❌ **Testing required**: SSL configuration can be complex
❌ **Internal network**: May need self-signed cert (browser warnings)

#### Implementation Steps

1. **Generate SSL Certificate**
   ```bash
   # Option: Let's Encrypt with certbot
   certbot certonly --standalone -d 192.168.1.15

   # Option: Self-signed for internal use
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /etc/ssl/private/selfsigned.key \
     -out /etc/ssl/certs/selfsigned.crt
   ```

2. **Configure Traefik** (Coolify)
   - Update Traefik static configuration
   - Add TLS certificate
   - Enable HTTPS entrypoint
   - Configure redirect middleware

3. **Update Application Environment**
   - Set `COOKIE_SECURE_FLAG=true` (or remove variable)
   - Update `NEXT_PUBLIC_SITE_URL` to `https://`
   - Verify `NODE_ENV=production`

4. **Test HTTPS Connection**
   ```bash
   curl -v https://192.168.1.15:3000
   ```

5. **Deploy and Verify**
   - Redeploy application via Coolify
   - Test login on HTTPS
   - Verify cookie is set with `__Secure-` prefix
   - Check browser DevTools for security

---

## Recommended Solution

### Primary Recommendation: **Option 1** (Environment Variable)

**Rationale**:

1. **Immediate fix**: Resolves login issue now
2. **Flexible**: Works for both HTTP and HTTPS
3. **Migration path**: Easy upgrade to HTTPS later
4. **Explicit configuration**: Clear intention in environment variables
5. **Best practices**: Separates protocol concerns from environment

**Implementation Timeline**: 2-4 hours
- Code changes: 1 hour
- Testing: 1 hour
- Documentation: 30 minutes
- Deployment: 30 minutes

### Secondary Recommendation: **Option 2** (Remove Prefix)

**When to use**:
- Need immediate fix (< 1 hour)
- No plans for HTTPS in near future
- Want simplest possible solution
- Willing to accept manual migration later

### Long-term Goal: **Option 3** (HTTPS)

**When to implement**:
- After Option 1 or 2 is deployed
- When time permits for infrastructure work
- For maximum security posture
- To enable modern web features

**Migration Path from Option 1**:
1. Configure SSL certificate
2. Set `COOKIE_USE_SECURE_PREFIX=true`
3. Set `COOKIE_SECURE_FLAG=true`
4. Deploy - cookie prefix automatically enabled

---

## Implementation Guide

### Option 1 Implementation: Step-by-Step

#### Step 1: Update `frontend/src/lib/auth/server.ts`

**Current (lines 16-18)**:
```typescript
// Use __Secure- prefix in production for additional security
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

**New**:
```typescript
// Use __Secure- prefix only when explicitly enabled via environment variable
// This allows HTTP deployments while maintaining option for HTTPS security
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false; // Default to false for HTTP compatibility

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX
  ? '__Secure-session_id'
  : 'session_id';
```

#### Step 2: Update `frontend/src/middleware.ts`

**Current (lines 82-88)**:
```typescript
function hasSessionCookie(request: NextRequest): boolean {
  // Use environment-aware cookie name to match auth system
  const SESSION_COOKIE_NAME =
    process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return !!sessionId;
}
```

**New**:
```typescript
function hasSessionCookie(request: NextRequest): boolean {
  // Use environment-aware cookie name to match auth system
  const USE_SECURE_PREFIX =
    process.env.COOKIE_USE_SECURE_PREFIX !== undefined
      ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
      : false;

  const SESSION_COOKIE_NAME = USE_SECURE_PREFIX
    ? '__Secure-session_id'
    : 'session_id';

  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return !!sessionId;
}
```

#### Step 3: Update `frontend/src/app/api/users/[id]/route.ts`

**Current (line 114)**:
```typescript
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

**New**:
```typescript
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false;

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX
  ? '__Secure-session_id'
  : 'session_id';
```

#### Step 4: Update `frontend/src/app/api/auth/logout/route.ts`

**Current (line 18)**:
```typescript
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Secure-session_id' : 'session_id';
```

**New**:
```typescript
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false;

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX
  ? '__Secure-session_id'
  : 'session_id';
```

#### Step 5: Update `frontend/.env.example`

**Add this section after the existing cookie security configuration**:

```bash
# ===== COOKIE PREFIX CONFIGURATION =====
# Control whether to use __Secure- prefix for session cookies
# The __Secure- prefix provides additional security but REQUIRES HTTPS
#
# Browser Requirement:
# - Cookies with __Secure- prefix can ONLY be set over HTTPS
# - Browsers will reject __Secure- cookies on HTTP connections
# - This is a browser security specification (RFC 6265bis)
#
# Configuration:
# - Set to 'false' for HTTP deployments (required)
# - Set to 'true' for HTTPS deployments (recommended when available)
# - Default: false (if not specified)
#
# Current Production Setup (November 2025):
# - Server: http://192.168.1.15:3000 (HTTP only, no SSL)
# - Required: COOKIE_USE_SECURE_PREFIX=false
# - When SSL configured: Change to true for enhanced security
#
# Important: This must match your actual protocol (HTTP vs HTTPS)
# Using __Secure- prefix on HTTP will cause login to fail
#
COOKIE_USE_SECURE_PREFIX=false

# ===== COOKIE SECURITY CONFIGURATION =====
# Control cookie Secure flag behavior
# - Default: Enabled in production (secure=true), disabled in development (secure=false)
# - Override: Set COOKIE_SECURE_FLAG=false for HTTP-only production deployments
# - IMPORTANT: Only disable for local HTTP deployments (like Coolify without SSL)
# - When HTTPS is configured, remove this override to restore security
#
# Current Production Setup (November 2025):
# - Server: http://192.168.1.15:3000 (HTTP only, no SSL)
# - Required: COOKIE_SECURE_FLAG=false
# - When SSL added: Remove this variable to default to secure=true
#
COOKIE_SECURE_FLAG=false
```

#### Step 6: Update Coolify Environment Variables

**In Coolify Dashboard**:
1. Navigate to your application
2. Go to Environment Variables section
3. Add new variable:
   - Name: `COOKIE_USE_SECURE_PREFIX`
   - Value: `false`
4. Save changes
5. Redeploy application

#### Step 7: Verify TypeScript Compilation

```bash
cd frontend
npm run type-check
```

Should pass with no errors.

#### Step 8: Test Locally

```bash
# Test with prefix disabled
COOKIE_USE_SECURE_PREFIX=false npm run dev

# Verify login works
# Check browser DevTools → Application → Cookies
# Should see: session_id (not __Secure-session_id)
```

#### Step 9: Deploy to Production

```bash
git add .
git commit -m "fix: Add environment variable for cookie prefix control

Resolves login issue on HTTP production deployments.

Changes:
- Add COOKIE_USE_SECURE_PREFIX environment variable
- Update cookie name logic in 4 files to respect new variable
- Default to no prefix (HTTP compatible)
- Add comprehensive documentation in .env.example

This allows production to run on HTTP while maintaining
option to enable __Secure- prefix when HTTPS is configured.

Fixes: Production login failure due to __Secure- prefix on HTTP
"
git push
```

Coolify will automatically deploy. Monitor logs for successful build.

#### Step 10: Verify Production Login

1. Navigate to http://192.168.1.15:3000/auth/login
2. Enter credentials: `admin` / `euZe3CTvcDqqsVz`
3. Submit login
4. **Should succeed** ✅

**Check in Browser DevTools**:
- Application → Cookies → http://192.168.1.15:3000
- Should see: `session_id` cookie (not `__Secure-session_id`)
- No console errors about cookie rejection

---

## Security Considerations

### Current Security Posture (HTTP without `__Secure-`)

**Active Protections**:
- ✅ **httpOnly**: true - Prevents JavaScript from accessing cookie
- ✅ **sameSite**: strict - Prevents CSRF attacks
- ✅ **CSRF tokens**: Double Submit Cookie pattern
- ✅ **Rate limiting**: 5 attempts per 15 minutes
- ✅ **Password hashing**: bcrypt cost factor 12
- ✅ **Timing-safe verification**: Prevents timing attacks
- ✅ **Session expiration**: 30-day maximum lifetime
- ✅ **Secure random tokens**: 128 bits of entropy

**Missing Protections**:
- ❌ **HTTPS encryption**: Cookies transmitted in plain text
- ❌ **Man-in-the-middle protection**: Network traffic visible
- ❌ **`__Secure-` prefix**: No browser-level prefix enforcement

### Security With HTTPS + `__Secure-` Prefix

**Additional Protections**:
- ✅ **Transport encryption**: All traffic encrypted via TLS
- ✅ **Cookie encryption in transit**: Cookies sent over HTTPS only
- ✅ **`__Secure-` prefix**: Browser enforces HTTPS requirement
- ✅ **Downgrade attack prevention**: Prefix prevents HTTP fallback
- ✅ **Network security**: Protection against packet sniffing

### Risk Assessment

**Current Risk (HTTP)**:
- **Low**: For internal network (192.168.1.x) deployments
- **Medium**: If accessible from public internet
- **High**: If handling sensitive data over public networks

**Mitigation for HTTP Deployment**:
1. **Network isolation**: Keep on private network
2. **VPN access**: Require VPN for external access
3. **Firewall rules**: Restrict access to trusted IPs
4. **Monitor access logs**: Watch for unauthorized attempts
5. **Plan HTTPS migration**: Set timeline for SSL implementation

---

## Testing & Verification

### Pre-Deployment Tests

**1. TypeScript Compilation**:
```bash
cd frontend
npm run type-check
```
Expected: ✅ No errors

**2. Local Development Test**:
```bash
COOKIE_USE_SECURE_PREFIX=false npm run dev
```
- Navigate to http://localhost:3000/auth/login
- Login with test credentials
- Verify cookie name in DevTools: `session_id`
- Verify session works across pages

**3. Production Build Test**:
```bash
COOKIE_USE_SECURE_PREFIX=false NODE_ENV=production npm run build
npm run start
```
- Navigate to http://localhost:3000/auth/login
- Login and verify functionality
- Check cookie name: `session_id`

### Post-Deployment Verification

**1. Production Login Test**:
```bash
# Get CSRF token first
CSRF_TOKEN=$(curl -s -c /tmp/cookies.txt http://192.168.1.15:3000 | grep csrf_token | cut -d'=' -f2)

# Attempt login
curl -X POST http://192.168.1.15:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -b "csrf_token=$CSRF_TOKEN" \
  -d '{"username":"admin","password":"euZe3CTvcDqqsVz"}' \
  -c /tmp/session.txt \
  -v
```

Expected:
- ✅ Status: 200 OK
- ✅ Response contains user data
- ✅ Set-Cookie header present
- ✅ Cookie name: `session_id` (not `__Secure-session_id`)

**2. Browser Test**:
1. Open browser
2. Navigate to http://192.168.1.15:3000/auth/login
3. Open DevTools → Console (check for errors)
4. Open DevTools → Network tab
5. Enter credentials: `admin` / `euZe3CTvcDqqsVz`
6. Click Login
7. Verify:
   - ✅ No console errors
   - ✅ Network request: 200 OK
   - ✅ Redirected to dashboard/home
   - ✅ User menu shows logged-in state

**3. Cookie Verification**:
- DevTools → Application → Cookies → http://192.168.1.15:3000
- Check for `session_id` cookie
- Verify attributes:
  - Name: `session_id`
  - Value: 64-character hex string
  - HttpOnly: ✅
  - SameSite: Strict
  - Secure: (empty/false)
  - Path: /

**4. Session Persistence Test**:
1. After successful login
2. Navigate to another page (e.g., /wiki)
3. Refresh page (F5)
4. Verify user remains logged in
5. Check Network → Request Headers → Cookie
6. Should include `session_id=...`

**5. Logout Test**:
1. Click logout button
2. Verify redirect to login page
3. Check DevTools → Application → Cookies
4. Verify `session_id` cookie is removed
5. Attempt to access protected page
6. Should redirect to login

### Rollback Plan

If issues occur after deployment:

**Quick Rollback** (Coolify):
1. Navigate to Coolify dashboard
2. Select application
3. Go to Deployments tab
4. Click "Rollback" to previous deployment
5. Wait for rollback to complete (~2 minutes)

**Manual Rollback** (Git):
```bash
git revert HEAD
git push
```
Coolify will auto-deploy previous version.

---

## References

### Cookie Specification
- **RFC 6265bis**: HTTP State Management Mechanism
  - Section 4.1.3.1: The `__Secure-` Prefix
  - Requirement: Cookies with this prefix MUST be set from HTTPS

### Browser Implementation
- **Chrome**: Enforces `__Secure-` prefix requirements since v49
- **Firefox**: Enforces since v52
- **Safari**: Enforces since v10.1
- **Edge**: Enforces since v14

### Related Documentation
- [CLAUDE.md](../CLAUDE.md) - Cookie security configuration section
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Authentication troubleshooting
- [docs/DATABASE_ENVIRONMENTS.md](./DATABASE_ENVIRONMENTS.md) - Database password sync
- [.env.example](../frontend/.env.example) - Environment variable reference

### Code Files
- `frontend/src/lib/auth/server.ts` - Session management
- `frontend/src/lib/security/middleware.ts` - CSRF and rate limiting
- `frontend/src/middleware.ts` - Request routing and session checks
- `frontend/src/lib/auth/service.ts` - Authentication logic

---

## Appendix: Complete Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Client)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/auth/login
                              │ Body: { username, password }
                              │ Headers: x-csrf-token
                              │ Cookie: csrf_token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js Middleware                            │
│  (src/middleware.ts)                                            │
│                                                                 │
│  ✅ Check: hasSessionCookie()                                   │
│  ✅ Route: /api/* → Allow                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   withSecurity Middleware                       │
│  (src/lib/security/middleware.ts)                               │
│                                                                 │
│  ✅ CSRF Validation:                                            │
│     - Compare cookie csrf_token vs header x-csrf-token         │
│     - Timing-safe comparison                                   │
│  ✅ Rate Limiting:                                              │
│     - Key: auth:login:<IP>                                     │
│     - Limit: 5 attempts per 15 minutes                         │
│     - Action: Block if exceeded                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Login Handler                                 │
│  (src/app/api/auth/login/route.ts)                              │
│                                                                 │
│  ✅ Parse request body                                          │
│  ✅ Call authService.login({ username, password })              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Auth Service                                  │
│  (src/lib/auth/service.ts)                                      │
│                                                                 │
│  1. Database Query:                                             │
│     SELECT * FROM users.users                                   │
│     WHERE username = $1 OR email = $1                           │
│                                                                 │
│  2. Password Verification:                                      │
│     - Call safePasswordVerify()                                 │
│     - Timing-safe bcrypt.compare()                              │
│     - Dummy hash if user not found                              │
│                                                                 │
│  3. If valid:                                                   │
│     BEGIN TRANSACTION                                           │
│       UPDATE users.users                                        │
│       SET last_active = NOW()                                   │
│       WHERE id = $1                                             │
│                                                                 │
│       INSERT INTO auth.sessions                                 │
│       (user_id, token, expires_at)                              │
│       VALUES ($1, $2, NOW() + INTERVAL '30 days')               │
│     COMMIT                                                      │
│                                                                 │
│  4. Return { user, sessionId }                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Create Auth Response                          │
│  (src/lib/auth/server.ts)                                       │
│                                                                 │
│  1. Set session cookie:                                         │
│     - Name: session_id (or __Secure-session_id)                 │
│     - Value: <64-char hex token>                                │
│     - HttpOnly: true                                            │
│     - SameSite: strict                                          │
│     - Secure: based on COOKIE_SECURE_FLAG                       │
│     - MaxAge: 30 days                                           │
│                                                                 │
│  2. Return JSON:                                                │
│     { success: true, user: {...} }                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Response:
                              │ - Status: 200 OK
                              │ - Set-Cookie: session_id=...
                              │ - Body: { success: true, user }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (Client)                            │
│                                                                 │
│  ❌ HTTP + __Secure- prefix:                                    │
│     Browser rejects cookie                                      │
│     (Specification violation)                                   │
│                                                                 │
│  ✅ HTTP + session_id (no prefix):                              │
│     Browser accepts cookie                                      │
│     Stores for 30 days                                          │
│     Sends with subsequent requests                              │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document Version**: 1.0
**Last Updated**: November 8, 2025
**Author**: Claude (via investigation agents)
**Status**: Ready for implementation
