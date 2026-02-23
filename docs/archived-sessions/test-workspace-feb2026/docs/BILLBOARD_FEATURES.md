# Billboard/Placeholder Features Documentation

**Last Updated**: November 30, 2025

This document catalogs all "billboard" features in the Veritable Games platform - UI elements that appear functional but use mock data, localStorage-only storage, or are marked as "Coming Soon".

---

## Summary

| Category | Count | Impact |
|----------|-------|--------|
| Mock Data (Fake) | 0 features | All removed |
| LocalStorage Only | ~20 settings | Won't sync across devices/browsers |
| Coming Soon | 1 feature | Disabled UI with badges |

**Recently Implemented (No Longer Billboard)**:
- Two-Factor Authentication (TOTP) - Fully functional as of November 29, 2025
- Backup Codes - Fully functional as of November 29, 2025

**Recently Removed (No Longer Shown)**:
- Security Score Overview - Removed November 30, 2025 (was fake/misleading)
- Active Sessions List - Removed November 30, 2025 (was hardcoded mock data)
- Login History - Removed November 30, 2025 (was hardcoded mock data)
- Session Sign Out Actions - Removed November 30, 2025 (were fake simulations)

---

## ~~1. Mock Data Features (Fake Data)~~ - ALL REMOVED

All mock data features have been removed from the Security Settings page as of November 30, 2025.

Previously, the following fake features were displayed:
- ~~Active Sessions List~~ - Showed hardcoded fake devices/locations
- ~~Login History~~ - Showed fabricated login attempts
- ~~Security Score~~ - Showed misleading "strong password" indicators
- ~~Sign Out Session/All~~ - Were just setTimeout simulations

These have been completely removed from `frontend/src/components/settings/SecuritySettingsForm.tsx`.

---

## 2. LocalStorage-Only Features

These settings appear to save but only persist to the browser's localStorage. They will **not sync across devices** or persist if localStorage is cleared.

### Location
`frontend/src/components/settings/PreferencesSettingsForm.tsx`

The form explicitly states at line 588-589:
> "Preferences are currently stored locally. Backend integration coming soon."

### All LocalStorage-Only Settings

#### Time & Date
- `timezone` - User's timezone selection
- `dateFormat` - MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD
- `timeFormat` - 12-hour or 24-hour
- `weekStartsOn` - Sunday or Monday

#### Display
- `displayDensity` - compact, comfortable, or spacious
- `itemsPerPage` - 10, 25, 50, or 100
- `showRelativeTimestamps` - Show "2 hours ago" vs exact timestamps
- `enableAnimations` - Toggle UI animations

#### Content
- `defaultForumSort` - latest, popular, or active
- `autoExpandSpoilers` - Auto-reveal spoiler content
- `showSignatures` - Display user signatures
- `enableMarkdownPreview` - Live preview when writing

#### Notifications (These specific toggles)
- `emailNotifications.newMessages`
- `emailNotifications.forumReplies`
- `emailNotifications.mentions`
- `desktopNotifications`
- `notificationDigest` - instant, daily, weekly, or never

**Note**: The email notification preferences in **Account Settings** (`/api/settings/email`) DO persist to the database. The ones in Preferences are duplicates that only save locally.

#### Accessibility
- `highContrastMode`
- `reduceMotion`
- `largerTextSize`
- `focusIndicators` - always or keyboard-only

### Storage Mechanism
```tsx
// Save (line 215)
localStorage.setItem(`preferences_${user.id}`, JSON.stringify(preferences));

// Load (lines 89-101)
const saved = localStorage.getItem(`preferences_${user.id}`);
```

---

## 3. "Coming Soon" Features

These features have UI elements that are **disabled** with "Coming Soon" badges.

### ~~3.1 Two-Factor Authentication (2FA)~~ - IMPLEMENTED
**Status**: ✅ Fully functional as of November 29, 2025

### ~~3.2 Backup Codes~~ - IMPLEMENTED
**Status**: ✅ Fully functional as of November 29, 2025

### ~~3.3 View Full Login History~~ - REMOVED
**Status**: ❌ Removed November 30, 2025 (along with the fake login history section)

### 3.4 Recovery Phone
**Location**: `SecuritySettingsForm.tsx` (Account Recovery section)

**What Users See**: "Add Phone" button for account recovery, disabled with "Coming Soon" badge.

**Backend Status**: No phone verification system exists. This is the only remaining "Coming Soon" feature.

---

## 4. What IS Connected to Backend

For reference, these settings **do** persist to the PostgreSQL database:

### Account Settings (`/api/settings/account`)
- Password change - Uses `authService.changePassword()`

### Profile Settings (`/api/settings/profile`)
- Display name, bio, avatar (URL, position, scale)
- Location
- All social links (11 platforms): github, twitter, linkedin, discord, steam, xbox, psn, bluesky, mastodon, website

### Privacy Settings (`/api/settings/privacy`)
- Profile visibility (public/members/private)
- Activity visibility
- Email visibility
- Show online status, show last active
- Allow messages
- Show reputation details
- Show forum/wiki activity

### Email Preferences (`/api/settings/email`)
- Newsletter opt-in
- Marketing opt-in
- Notification opt-in

---

## Recommendations

### ~~High Priority~~ - COMPLETED
1. ~~**Remove or clearly label mock session data**~~ - ✅ REMOVED November 30, 2025
2. ~~**Add real session management**~~ - Deferred (mock data removed instead)
3. **Implement backend for preferences** - Allow settings to sync across devices (still needed)

### ~~Medium Priority~~ - MOSTLY COMPLETED
4. ~~**Implement 2FA**~~ - ✅ IMPLEMENTED November 29, 2025
5. ~~**Add real login history tracking**~~ - Deferred (mock data removed instead)
6. **Consolidate notification preferences** - Remove duplicate localStorage toggles (still needed)

### Low Priority
7. **Implement recovery phone** - Additional account recovery option (only remaining Coming Soon)
8. ~~**Add backup codes**~~ - ✅ IMPLEMENTED November 29, 2025 (part of 2FA)

---

## Database Schema Gaps

To implement these features, the following tables would need to be created:

```sql
-- Real session tracking
CREATE TABLE users.user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users.users(id),
  session_token TEXT NOT NULL,
  device_info JSONB,
  ip_address TEXT,
  location TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_current BOOLEAN DEFAULT false
);

-- Real login history
CREATE TABLE users.login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users.users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  location TEXT,
  status TEXT NOT NULL, -- 'success' or 'failed'
  failure_reason TEXT
);

-- User preferences (backend)
CREATE TABLE users.user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users.users(id),
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## File References

| Feature | File | Status |
|---------|------|--------|
| ~~Mock Sessions~~ | `SecuritySettingsForm.tsx` | ❌ REMOVED |
| ~~Mock Login History~~ | `SecuritySettingsForm.tsx` | ❌ REMOVED |
| ~~Session Sign Out Simulation~~ | `SecuritySettingsForm.tsx` | ❌ REMOVED |
| ~~Security Score Overview~~ | `SecuritySettingsForm.tsx` | ❌ REMOVED |
| LocalStorage Preferences | `PreferencesSettingsForm.tsx` | Still uses localStorage |
| 2FA (TOTP) | `SecuritySettingsForm.tsx` | ✅ IMPLEMENTED |
| Recovery Phone Coming Soon | `SecuritySettingsForm.tsx` | Still Coming Soon |
| Backup Codes | `SecuritySettingsForm.tsx` | ✅ IMPLEMENTED |
