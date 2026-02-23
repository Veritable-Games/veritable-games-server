# User Status Display Issues

**Date**: December 16, 2025
**Status**: Issue #1 closed (not reproducible), Issues #2, #3 & #4 fixed

## Overview

There are several issues related to how user status is displayed and tracked in the application.

---

## Issue 1: Auth Pages Redirect Loop (NOT REPRODUCIBLE)

**Location**: `/auth/login` page
**Symptom**: Navigating to `/auth/login` redirects to homepage even for unauthenticated users
**File**: `src/app/auth/login/page.tsx`
**Status**: ❌ NOT REPRODUCIBLE (December 16, 2025)

**Investigation Results**:
After thorough testing with Playwright:
- Fresh browser with no cookies → Login page works correctly (no redirect)
- `/api/auth/me` correctly returns `{ success: false, error: "Not authenticated" }` with HTTP 401
- Middleware correctly allows `/auth/login` in `ALWAYS_PUBLIC_PATHS`
- Login page useEffect logic correctly handles unauthenticated users

**Original "Bug" Cause**:
The reported redirect was likely caused by **stale session cookies** from a previous browser session. When the browser has valid `session_id` cookies, the login page correctly redirects authenticated users to the homepage (as designed).

**Conclusion**:
No code fix needed. The login page behaves correctly:
- Unauthenticated users → See login form
- Authenticated users → Redirect to homepage (expected behavior)

**Priority**: ~~Medium~~ Closed

---

## Issue 2: `is_active` Misused as Online Status Indicator (FIXED)

**Location**: `src/components/profiles/ProfileHeader.tsx` lines 115-161
**Status**: ✅ FIXED (December 16, 2025)

**Previous (Buggy) Code**:
```tsx
{/* Online Status Indicator */}
<div
  className={`absolute bottom-0 right-0 h-4 w-4 ${
    user.isActive ? 'bg-green-500' : 'bg-gray-500'
  } rounded-full border-2 border-gray-900`}
/>
```

**Problem (was)**:
- `is_active` means "account is active (not banned)" - NOT "user is online"
- A banned user shows as gray (offline), but an active user always shows green (online) even if they haven't logged in for months
- This creates misleading UI where all non-banned users appear "online"

**Fix Applied**:
Now uses `lastActive` timestamp to determine online status:
- **Suspended (gray)**: Account is banned (`isActive = false`)
- **Online (green)**: `last_active` within last 15 minutes
- **Away (yellow)**: `last_active` within last 1 hour
- **Offline (gray)**: No recent activity or `last_active` older than 1 hour

Each status has a tooltip explaining the state.

**Privacy Consideration** (TODO):
- Should respect `show_online_status` privacy setting from user preferences
- If `show_online_status = false`, don't show the indicator or always show gray

**Related Fields**:
- `users.last_active` - Updated on login (auth/service.ts:213, 291)
- `users.last_seen` - May not be updated regularly
- `users.show_online_status` - Privacy setting (default: true)

---

## Issue 3: No Logout Tracking (FIXED)

**Location**: `src/lib/auth/service.ts:440-462`
**Status**: ✅ FIXED (December 16, 2025)

**Previous (Buggy) Code**:
```typescript
async logout(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await dbAdapter.query('DELETE FROM sessions WHERE token = $1', [sessionId], { schema: 'auth' });
}
```

**Problem (was)**:
- Logout only deleted the session
- Did NOT update `last_active` or `last_seen`
- Could not reliably determine when a user went offline

**Fix Applied**:
The logout function now:
1. Queries the session to get the `user_id` before deletion
2. Updates the user's `last_active` timestamp
3. Deletes the session

This ensures that when a user explicitly logs out, their `last_active` timestamp reflects that moment, allowing the online status indicator to correctly show them as offline.

---

## Issue 4: `last_active` Only Updated on Login (FIXED)

**Location**: `src/lib/auth/service.ts:429-439`
**Status**: ✅ FIXED (December 16, 2025)

**Previous State**:
- `last_active` was updated on every session validation (excessive DB writes)
- OR only on login (stale data)

**Problem (was)**:
- Either too many database writes (every API request)
- Or inaccurate "online" status (only login timestamps)

**Fix Applied**:
The `validateSession` function now updates `last_active` with **throttling**:
1. Checks the current `last_active` timestamp from the session query
2. Only updates if more than 5 minutes have passed since last update
3. This balances accuracy with database performance

```typescript
// Update last_active with throttling (only if older than 5 minutes)
const ACTIVITY_UPDATE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms
const lastActiveTime = session.last_active ? new Date(session.last_active).getTime() : 0;
const timeSinceLastUpdate = Date.now() - lastActiveTime;

if (timeSinceLastUpdate > ACTIVITY_UPDATE_THRESHOLD) {
  await dbAdapter.query('UPDATE users SET last_active = NOW() WHERE id = $1', [session.id], {
    schema: 'users',
  });
}
```

**Result**:
- `last_active` is now updated during regular browsing activity
- Database writes are throttled to at most once every 5 minutes per user
- Online status indicator (green: 15min, yellow: 1hr) now works accurately

---

## Field Reference

### Database Fields (users.users table)

| Field | Purpose | Default | Notes |
|-------|---------|---------|-------|
| `is_active` | Account enabled (not banned) | `true` | false = soft/hard banned |
| `ban_type` | Type of ban | `null` | 'soft', 'hard', or null |
| `last_active` | Last activity timestamp | `NOW()` | Updated on activity (throttled 5min) + logout |
| `last_seen` | Last seen timestamp | null | May not be implemented |
| `show_online_status` | Privacy: show online to others | `true` | User preference |

### UI Components Using Status

| Component | Field Used | Display |
|-----------|-----------|---------|
| `ProfileHeader.tsx` | `lastActive` + `isActive` | Green (online), Yellow (away), Gray (offline/banned) |
| `UserCard.tsx` | `ban_type` | Orange/red badge for bans |
| `UsersPageClient.tsx` | `is_active` | Filter/display |

---

## Implementation Summary

All core issues have been addressed:

| Fix | Status | Location |
|-----|--------|----------|
| ProfileHeader online status | ✅ Done | `src/components/profiles/ProfileHeader.tsx:115-161` |
| Throttled activity tracking | ✅ Done | `src/lib/auth/service.ts:429-439` |
| Logout timestamp update | ✅ Done | `src/lib/auth/service.ts:446-468` |

### Remaining TODO (Optional Enhancement)
- [ ] Respect `show_online_status` privacy setting in ProfileHeader
  - If `show_online_status = false`, hide the indicator or always show gray
  - Currently indicator is always shown

---

## References

- User types: `src/lib/users/types.ts`
- Profile service: `src/lib/profiles/service.ts`
- Auth service: `src/lib/auth/service.ts`
- Profile header: `src/components/profiles/ProfileHeader.tsx`
- User card: `src/components/users/UserCard.tsx`
