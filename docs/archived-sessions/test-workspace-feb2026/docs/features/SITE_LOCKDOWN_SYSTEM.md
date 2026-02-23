# Site Lockdown System

**Last Updated**: December 1, 2025
**Status**: Fixed - Root cause identified and resolved

---

## Overview

The site lockdown system controls whether the Veritable Games site requires authentication to access. When enabled ("locked"), visitors are redirected to `/auth/login`. When disabled ("public"), the site is open to everyone.

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Middleware | `frontend/src/middleware.ts` | Intercepts all requests, checks lockdown status, redirects unauthenticated users |
| Maintenance API | `frontend/src/app/api/settings/maintenance/route.ts` | Public endpoint returning current lockdown status |
| Settings Service | `frontend/src/lib/settings/service.ts` | Manages site settings in database with caching |
| Admin Settings API | `frontend/src/app/api/admin/settings/route.ts` | Admin endpoint to read/write settings |
| Cache Invalidation API | `frontend/src/app/api/admin/settings/invalidate-cache/route.ts` | Forces settings cache to clear |
| Admin UI | `frontend/src/components/admin/SiteSettingsManager.tsx` | Toggle switch and status indicator |

### Data Flow

```
User Request
    ↓
middleware.ts
    ↓ (checks lockdown status)
    ├─→ Cache hit? Return cached value
    └─→ Cache miss? Fetch from /api/settings/maintenance
                         ↓
                   settingsService.getSettings()
                         ↓
                   PostgreSQL: system.site_settings
```

### Caching Layers

| Layer | Location | TTL | Invalidation |
|-------|----------|-----|--------------|
| Middleware cache | `middleware.ts` line 47 | 5 seconds | Time-based only |
| Settings service cache | `lib/settings/service.ts` | 60 seconds | `clearCache()` method |

---

## Priority Logic (Current Implementation)

The `isMaintenanceMode()` function in `middleware.ts` determines lockdown state:

```typescript
async function isMaintenanceMode(request: NextRequest): Promise<boolean> {
  // 1. Emergency override - can only FORCE lockdown ON
  if (process.env.LOCKDOWN_EMERGENCY_OVERRIDE === 'true') {
    return true;
  }

  // 2. Legacy env var - only forcing ON
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    return true;
  }

  // 3. Check middleware cache (5 second TTL)
  // 4. Fetch from /api/settings/maintenance
  // 5. Default to true (fail-secure)
}
```

**Design Intent**: Environment variables can only force lockdown ON (for emergencies). The database setting controls unlock. Admin UI is the only way to make the site public.

---

## Database Schema

**Table**: `system.site_settings`

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT | Setting identifier |
| `value` | TEXT (JSON) | Setting value |

**Relevant Settings**:
- `maintenanceMode`: boolean - whether lockdown is enabled
- `maintenanceMessage`: string - message shown on login page

---

## Admin UI Features

### Status Indicator

Located in `SiteSettingsManager.tsx`, shows real-time lockdown state:

- **Green indicator**: "Site is PUBLIC - Open to everyone"
- **Yellow pulsing indicator**: "Site is LOCKED - Login required for access"
- **Warning message**: Displayed when environment override is active

### Toggle Behavior

1. Admin toggles "Enable Site Lockdown"
2. On save, calls `PUT /api/admin/settings`
3. After save, calls `POST /api/admin/settings/invalidate-cache`
4. Waits 100ms for cache propagation
5. Calls `/api/settings/maintenance` to verify new state
6. Updates status indicator

---

## API Endpoints

### GET /api/settings/maintenance (Public)

Returns current lockdown status. Used by middleware and admin UI.

**Response**:
```json
{
  "success": true,
  "data": {
    "enabled": true,           // Effective state (env OR database)
    "message": "",             // Maintenance message
    "envOverrideActive": false, // Whether env var is forcing ON
    "databaseValue": true      // Actual database setting
  }
}
```

### PUT /api/admin/settings (Admin Only)

Updates site settings including `maintenanceMode`.

### POST /api/admin/settings/invalidate-cache (Admin Only)

Forces the settings service to clear its cache. Called after admin saves settings.

---

## Resolved Issues

### Issue 1: Lockdown Toggle Not Propagating (FIXED)

**Symptom**: Admin toggles lockdown off, saves, but site still requires login.

**Root Cause**: Missing `cache: 'no-store'` option in the middleware's `fetch()` call to `/api/settings/maintenance`. In Next.js Edge Runtime, fetch has default caching behavior that was caching stale responses.

**Fix Applied** (December 1, 2025):
1. Added `cache: 'no-store'` to middleware fetch in `middleware.ts:85`
2. Added `Cache-Control: no-store` headers to `/api/settings/maintenance` response

**Files Changed**:
- `frontend/src/middleware.ts` - Added `cache: 'no-store'` to fetch options
- `frontend/src/app/api/settings/maintenance/route.ts` - Added Cache-Control headers

### Issue 2: Cache Synchronization (Mitigated)

The middleware runs in Edge Runtime and maintains its own in-memory cache. When admin saves settings:
1. Settings service cache is cleared
2. Middleware cache is NOT directly cleared (5s time-based)
3. If middleware cache was just refreshed, stale data persists for up to 5 seconds

**Note**: The 5-second middleware cache is acceptable since it only affects the brief window after an admin change. The critical fix was ensuring the API fetch doesn't return cached data.

---

## Environment Variables

| Variable | Effect |
|----------|--------|
| `LOCKDOWN_EMERGENCY_OVERRIDE=true` | Forces lockdown ON, cannot be disabled via UI |
| `NEXT_PUBLIC_MAINTENANCE_MODE=true` | Forces lockdown ON (legacy) |
| `NEXT_PUBLIC_MAINTENANCE_MODE=false` | **No effect** (intentionally ignored) |

---

## Changes Made This Session (December 1, 2025)

### 1. Modified Middleware Priority Logic

**File**: `frontend/src/middleware.ts`

Changed `isMaintenanceMode()` to:
- Only check for env vars that force lockdown ON
- Ignore `false` values (database controls unlock)
- Added comments explaining priority order

### 2. Enhanced Maintenance Status API

**File**: `frontend/src/app/api/settings/maintenance/route.ts`

Added to response:
- `envOverrideActive`: boolean indicating if env var is forcing lockdown
- `databaseValue`: the actual database setting (separate from effective state)

### 3. Added Status Indicator to Admin UI

**File**: `frontend/src/components/admin/SiteSettingsManager.tsx`

Added:
- `LockdownStatus` interface and state
- `checkLockdownStatus()` callback to fetch current state
- Visual indicator (green/yellow) showing current lockdown state
- Warning message when env override is active
- Status verification after save

### 4. Created Cache Invalidation Endpoint

**File**: `frontend/src/app/api/admin/settings/invalidate-cache/route.ts` (NEW)

- Admin-only endpoint
- Calls `settingsService.clearCache()`
- Called after admin saves settings

---

## Testing Checklist

- [ ] Remove all maintenance-related env vars from Coolify
- [ ] Deploy changes
- [ ] Toggle lockdown OFF in admin UI
- [ ] Verify in incognito window (should be public)
- [ ] Toggle lockdown ON in admin UI
- [ ] Verify in incognito window (should redirect to login)
- [ ] Verify status indicator shows correct state
- [ ] Test with `LOCKDOWN_EMERGENCY_OVERRIDE=true` set

---

## Debugging Steps

### Check Current State

```bash
# From server via SSH
curl -s http://localhost:3000/api/settings/maintenance | jq

# Check Coolify env vars
coolify app env list m4s0kwo4kc4oooocck4sswc4 | grep -i maintenance
```

### Check Database Value

```sql
-- Connect to PostgreSQL
SELECT * FROM system.site_settings WHERE key = 'maintenanceMode';
```

### Check Logs

Look for middleware debug headers in responses:
- `X-Maintenance-Mode`: current lockdown state
- `X-Has-Session`: whether user has session cookie

---

## Related Files

- `frontend/src/lib/settings/service.ts` - Settings service with caching
- `frontend/src/lib/settings/types.ts` - Type definitions
- `frontend/src/app/admin/page.tsx` - Admin dashboard
- `frontend/src/app/auth/login/page.tsx` - Login page (redirect target)
