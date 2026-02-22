# Admin Site Settings System

**Status**: Complete
**Implemented**: November 30, 2025

## Overview

The Admin Site Settings system provides a centralized interface for managing site-wide configuration, including maintenance mode, user registration, feature toggles, and upload limits. Settings are stored in the PostgreSQL `site_settings` table and can be toggled instantly from the admin dashboard.

## Features

### Maintenance Mode (Lockdown)
- **Instant toggle** via admin UI (no server restart required)
- **When ON**: Site requires login - unauthenticated users redirected to `/auth/login`
- **When OFF**: Site is publicly accessible to everyone
- **Admin banner** - yellow notification bar shows for admins when lockdown is active
- **Custom message** stored for display in banner
- **Database-driven** with environment variable override for emergencies

### User Registration
- Enable/disable new user registration
- Require email verification toggle

### Feature Toggles
- Wiki system enable/disable

### Upload Settings
- Maximum upload size (in MB)
- Allowed file types (comma-separated extensions)

### Site Identity
- Site name
- Site description

---

## Architecture

### Data Flow

```
Admin UI (SiteSettingsManager)
        ↓
/api/admin/settings (PUT)
        ↓
SettingsService.updateSettings()
        ↓
PostgreSQL site_settings table
        ↓
30-second cache invalidation
        ↓
Middleware checks /api/settings/maintenance
        ↓
Site behavior changes
```

### Components

| Component | Purpose |
|-----------|---------|
| `SiteSettingsManager.tsx` | Admin UI for all site settings |
| `/api/admin/settings` | Protected API for GET/PUT settings |
| `/api/settings/maintenance` | Public cached endpoint for maintenance status |
| `SettingsService` | Singleton service with caching |
| `MaintenanceBanner` | Shows banner to admins during maintenance |
| `middleware.ts` | Enforces maintenance mode routing |

---

## File Locations

### New Files
- `frontend/src/app/api/admin/settings/route.ts` - Admin settings API
- `frontend/src/app/api/settings/maintenance/route.ts` - Public maintenance status
- `frontend/src/components/admin/SiteSettingsManager.tsx` - Settings UI component
- `frontend/src/app/admin/settings/page.tsx` - Admin settings page

### Modified Files
- `frontend/src/lib/settings/service.ts` - Added update methods
- `frontend/src/app/admin/page.tsx` - Added settings card
- `frontend/src/app/admin/layout.tsx` - Added sidebar navigation
- `frontend/src/components/MaintenanceBanner.tsx` - Checks actual status
- `frontend/src/app/maintenance/page.tsx` - Shows custom message
- `frontend/src/middleware.ts` - Database-driven maintenance check

---

## API Reference

### GET /api/admin/settings
Returns all site settings. Admin only.

**Response:**
```json
{
  "success": true,
  "data": {
    "siteName": "Veritable Games",
    "siteDescription": "Creating memorable gaming experiences",
    "maintenanceMode": false,
    "maintenanceMessage": "We are currently performing maintenance...",
    "registrationEnabled": true,
    "emailVerification": false,
    "wikiEnabled": true,
    "maxUploadSize": 5,
    "allowedFileTypes": "jpg,png,gif,pdf"
  }
}
```

### PUT /api/admin/settings
Updates site settings. Admin only.

**Request Body:** Partial `SiteSettings` object
**Response:** Updated settings object

### GET /api/settings/maintenance
Public endpoint for maintenance status. Cached for 30 seconds.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "message": ""
  }
}
```

---

## Maintenance Mode Behavior

Maintenance mode acts as a **lockdown switch**:
- **ON**: Site requires authentication - unauthenticated users redirected to `/auth/login`
- **OFF**: Site is publicly accessible to everyone

### Priority Order
1. **Environment variable override**: `NEXT_PUBLIC_MAINTENANCE_MODE=true` forces maintenance mode (emergency kill switch)
2. **Database setting**: `site_settings.maintenanceMode` from admin UI
3. **Default**: `true` (fail secure - requires login if API unavailable)

### Caching Strategy
- **Middleware**: 30-second in-memory cache
- **API endpoint**: 30-second server-side cache
- **Admin UI**: Forces refresh on load

### User Experience
- **Maintenance ON + Unauthenticated**: Redirected to `/auth/login`
- **Maintenance ON + Authenticated**: Full access, admins see yellow banner
- **Maintenance OFF**: Public access for everyone (no login required)

---

## Database Schema

Settings are stored in the `site_settings` table (system schema):

```sql
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);
```

### Settings Keys
- `siteName` - string
- `siteDescription` - string
- `maintenanceMode` - "true" | "false"
- `maintenanceMessage` - string
- `registrationEnabled` - "true" | "false"
- `emailVerification` - "true" | "false"
- `wikiEnabled` - "true" | "false"
- `maxUploadSize` - number (MB)
- `allowedFileTypes` - comma-separated string

---

## Security

- Admin-only access to `/api/admin/settings` via `withSecurity` middleware
- CSRF protection on all mutations
- Input validation on all setting values
- Public maintenance status endpoint has no sensitive data

---

## Usage

### Accessing Admin Settings
1. Navigate to `/admin` as an admin user
2. Click "Site Settings" card or sidebar link
3. Toggle settings as needed
4. Click "Save Changes"

### Emergency Maintenance
If database is unavailable, set environment variable:
```bash
NEXT_PUBLIC_MAINTENANCE_MODE=true
```

This overrides database settings and forces maintenance mode.

---

## Related Documentation
- [User Admin Management](./USER_ADMIN_MANAGEMENT.md)
- [Settings & User Management](./SETTINGS_USER_MANAGEMENT.md)
