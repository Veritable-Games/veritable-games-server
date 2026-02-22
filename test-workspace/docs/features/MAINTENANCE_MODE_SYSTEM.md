# Maintenance Mode Toggle System

**Status**: ✅ Production-ready (December 2, 2025)
**Purpose**: Allow admins to control whether the site requires authentication for public access

---

## Overview

The Maintenance Mode Toggle System provides a database-driven site lockdown mechanism that allows administrators to control public access to the site through the admin settings panel. When enabled, the site requires authentication for all access. When disabled, public pages are accessible without login.

**Key Features:**
- ✅ Database-driven toggle (persisted in PostgreSQL)
- ✅ Real-time enforcement via middleware
- ✅ Two-tier caching (60s service cache + 5s middleware cache)
- ✅ Environment variable emergency override
- ✅ Granular page-level control
- ✅ Admin UI with status indicators

---

## Use Cases

1. **Early Development**: Lock down site during active development
2. **Maintenance Windows**: Restrict access during database migrations
3. **Emergency Response**: Quickly disable public access if needed
4. **Beta Testing**: Control access to staging/preview environments
5. **Content Preparation**: Work on content before public launch

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Admin UI (/admin/settings)                                  │
│ - Toggle ON/OFF                                             │
│ - Save to database                                          │
│ - Invalidate cache                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL (system.site_settings)                           │
│ - key: 'maintenanceMode'                                    │
│ - value: 'true' | 'false' (TEXT column)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Settings Service (60s cache)                                │
│ - getSetting('maintenanceMode')                             │
│ - clearCache() on admin save                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Middleware (5s cache)                                       │
│ - Fetches from /api/settings/maintenance                    │
│ - Checks environment overrides                              │
│ - Redirects to /auth/login if locked                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Individual Pages                                            │
│ - isMaintenanceModeEnabled() helper                         │
│ - Conditional authentication requirements                   │
└─────────────────────────────────────────────────────────────┘
```

### Caching Layers

**1. Settings Service Cache (60s TTL)**
- File: `frontend/src/lib/settings/service.ts`
- Singleton pattern - shared across requests
- Manually cleared via `/api/admin/settings/invalidate-cache`
- Prevents database hits on every request

**2. Middleware Cache (5s TTL)**
- File: `frontend/src/middleware.ts`
- Edge Runtime limitation - cannot be manually cleared
- Expires naturally after 5 seconds
- Protected by `cache: 'no-store'` fetch header

**3. Total Propagation Time**
- Worst case: 65 seconds (60s + 5s)
- Typical: 5-10 seconds after cache invalidation

---

## Components

### Core Files

**1. Helper Function**
```typescript
// frontend/src/lib/auth/maintenance.ts
export async function isMaintenanceModeEnabled(): Promise<boolean>
export async function shouldRequireAuth(requireAuth: boolean): Promise<boolean>
```

**2. Middleware Enforcement**
```typescript
// frontend/src/middleware.ts
// Lines 61-222: Global enforcement logic
// Checks environment overrides → cache → API → default locked
```

**3. Settings Service**
```typescript
// frontend/src/lib/settings/service.ts
// Lines 16-128: Database access with 60s cache
// getSetting('maintenanceMode') returns boolean
```

**4. Admin UI**
```typescript
// frontend/src/components/admin/SiteSettingsManager.tsx
// Lines 94-145: Toggle UI with save/invalidate cache flow
```

**5. API Endpoint**
```typescript
// frontend/src/app/api/settings/maintenance/route.ts
// Lines 26-68: Public endpoint for middleware
// Returns: { enabled: boolean, databaseValue: boolean, envOverrideActive: boolean }
```

---

## Pages Affected

### Pages That Respect Maintenance Mode

These pages are publicly accessible when maintenance mode is **OFF**:

**Wiki (View-Only Pages)**
- `/wiki` - Main wiki landing
- `/wiki/[slug]` - Individual pages
- `/wiki/search` - Search results
- `/wiki/[slug]/history` - Revision history
- `/wiki/category/[id]` - Category listings

**Implementation Pattern:**
```typescript
const user = await getCurrentUser();
const maintenanceModeEnabled = await isMaintenanceModeEnabled();

if (maintenanceModeEnabled && !user) {
  redirect('/auth/login?redirect=/wiki');
}

const userRole = user?.role || 'guest';
```

### Pages That Always Require Auth

These pages **ignore** maintenance mode and always require authentication:

**Wiki (Edit Pages)**
- `/wiki/create` - Creating content requires user account
- `/wiki/[slug]/edit` - Editing requires permissions

**Admin**
- `/admin/**` - All admin functionality is protected

**User Account**
- `/settings` - User settings require account
- `/profile/edit` - Profile editing requires account
- `/messages/**` - Messaging requires account

**Project Tools (Admin-Only)**
- `/projects/[slug]/workspace` - Admin-only workspace
- `/projects/[slug]/revisions` - Admin-only revision history

**Reasoning:**
These pages require a logged-in user context to function. They cannot operate in a "guest" mode, so maintenance mode is irrelevant - authentication is always required.

---

## Environment Variables

### Emergency Override (Force Lockdown ON)

```bash
# Force site lockdown ON (cannot be disabled via admin toggle)
LOCKDOWN_EMERGENCY_OVERRIDE=true

# Alternative legacy variable
NEXT_PUBLIC_MAINTENANCE_MODE=true
```

**Important:**
- Environment variables can ONLY force lockdown **ON**, never OFF
- Database toggle is ignored when env override is active
- Admin UI shows warning when override is active
- Used for emergency situations (security incidents, critical bugs)

### Checking Overrides

```bash
# In Coolify
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -E 'LOCKDOWN|MAINTENANCE'

# In running container
docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep -E 'LOCKDOWN|MAINTENANCE'
```

---

## Admin Usage

### Enabling/Disabling Maintenance Mode

1. Navigate to `/admin/settings`
2. Locate "Maintenance Mode" section
3. Toggle switch ON (locked) or OFF (public)
4. Click "Save Changes"
5. Wait 10 seconds for cache propagation
6. Test in fresh incognito window

### Status Indicators

**Admin UI Shows:**
- Current state: "Site is LOCKED" or "Site is PUBLIC"
- Environment override warning (if active)
- Save confirmation with cache invalidation

**Testing:**
```bash
# Open fresh incognito window
# Navigate to https://www.veritablegames.com/

# If maintenance OFF: Site loads normally
# If maintenance ON: Redirects to /auth/login
```

---

## Technical Details

### Database Schema

```sql
-- Table: system.site_settings
CREATE TABLE system.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users.users(id)
);

-- Example row:
INSERT INTO system.site_settings (key, value, updated_by)
VALUES ('maintenanceMode', 'false', 1);
```

### String-to-Boolean Conversion

```typescript
// Settings Service converts TEXT to boolean
const maintenanceMode = await settingsService.getSetting('maintenanceMode');
// Returns: boolean (true/false)

// Internal conversion:
return value === 'true';  // String comparison
```

### Cache Invalidation Flow

```typescript
// 1. Admin saves settings
await fetch('/api/admin/settings', {
  method: 'PUT',
  body: JSON.stringify({ maintenanceMode: false })
});

// 2. Backend updates database
await settingsService.updateSettings({ maintenanceMode: false });

// 3. Admin UI invalidates cache
await fetch('/api/admin/settings/invalidate-cache', {
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken }
});

// 4. Settings Service clears 60s cache
settingsService.clearCache();

// 5. Middleware cache expires naturally (5s)
```

---

## Troubleshooting

### Site Still Locked After Toggling OFF

**Check 1: Wait for Cache Expiration**
```bash
# Wait 90 seconds after saving
# Clear browser cache completely
# Test in fresh incognito window
```

**Check 2: Verify Database Value**
```bash
ssh user@192.168.1.15
docker exec veritable-games-postgres psql -U postgres -d veritable_games \
  -c "SELECT key, value, updated_at FROM system.site_settings WHERE key = 'maintenanceMode';"

# Expected: value = 'false'
```

**Check 3: Check Environment Overrides**
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep -E 'LOCKDOWN|MAINTENANCE'

# Expected: No output (variables should not be set)
```

**Check 4: Verify API Response**
```bash
curl -s http://192.168.1.15:3000/api/settings/maintenance | jq

# Expected:
# {
#   "enabled": false,
#   "databaseValue": false,
#   "envOverrideActive": false
# }
```

**Check 5: Monitor Middleware Logs**
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50 | grep '\[Middleware\]'

# Should show maintenance mode checks
```

### Cache Invalidation Failing

**Symptom:** Settings save but site doesn't update for 60+ seconds

**Check Cache Invalidation Endpoint:**
```bash
# Look for 403/500 errors
docker logs m4s0kwo4kc4oooocck4sswc4 --since 5m | grep 'invalidate-cache'
```

**Fix:** Ensure CSRF token is included in request headers

### TypeScript Errors When Adding Maintenance Checks

**Problem:** `Type 'boolean | null' is not assignable to type 'boolean'`

**Cause:** When user is nullable (maintenance mode OFF), expressions using `&&` return `null`

**Fix:** Wrap in `Boolean()` for strict type:
```typescript
// ❌ Wrong - returns boolean | null
const canEdit = user && (user.role === 'admin');

// ✅ Correct - returns boolean
const canEdit = Boolean(user && (user.role === 'admin'));
```

---

## Implementation History

### Session 1: Initial Discovery (December 1, 2025)
- **Problem**: Maintenance toggle in admin UI appeared disconnected
- **Investigation**: Found middleware was using self-referential fetch
- **Fix**: Changed middleware to fetch from `localhost:3000` instead of public domain
- **Commit**: `cca6958`

### Session 2: Wiki Pages Not Respecting Toggle (December 2, 2025)
- **Problem**: Homepage worked but wiki pages still blocked when toggle was OFF
- **Root Cause**: 13 pages had hardcoded authentication checks bypassing maintenance mode
- **Solution**:
  - Created `isMaintenanceModeEnabled()` helper
  - Modified 7 wiki view pages to respect toggle
  - Documented 6 pages that always require auth
- **TypeScript Issue**: Fixed `boolean | null` type mismatch
- **Commits**: `7579bdb`, `6a4055f`
- **Deployment**: Succeeded, all wiki pages now respect toggle

---

## Future Enhancements

### Planned Improvements

1. **Scheduled Maintenance Windows**
   - Allow admins to schedule maintenance mode in advance
   - Auto-enable/disable at specified times
   - Email notifications to users

2. **Custom Maintenance Pages**
   - Allow admins to customize maintenance message
   - Rich text editor for maintenance page content
   - Estimated downtime display

3. **Granular Permissions**
   - Allow specific user roles during maintenance
   - Whitelist specific IPs
   - Beta tester access

4. **Maintenance Mode Analytics**
   - Track how long site is locked
   - Monitor impact on traffic
   - Log maintenance history

5. **API Rate Limiting During Maintenance**
   - Graceful degradation for API clients
   - Return proper HTTP 503 status
   - Retry-After headers

---

## Related Documentation

- [Middleware Architecture](../architecture/MIDDLEWARE.md)
- [Settings Service](../api/SETTINGS_SERVICE.md)
- [Admin Panel](../guides/ADMIN_PANEL.md)
- [Authentication System](../security/AUTHENTICATION.md)

---

## Summary

The Maintenance Mode Toggle System provides a reliable, database-driven mechanism for controlling public access to the site. With proper caching, environment overrides, and granular page-level control, it offers flexibility for development, maintenance, and emergency situations while maintaining security and performance.

**Key Takeaways:**
- ✅ Admin toggle controls database setting
- ✅ Middleware enforces globally with 5s cache
- ✅ Individual pages can opt-in to respect toggle
- ✅ Environment variables force lockdown ON only
- ✅ Total propagation time: 5-65 seconds
- ✅ Always test in fresh incognito window
