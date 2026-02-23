# User Admin Management Documentation

**Created:** 2025-10-28
**Status:** ✅ Implemented and Ready for Testing

## Overview

The User Admin Management system provides forum-style administrative controls for managing users on the Veritable Games platform. Admins and moderators can select multiple users, ban/unban them, and create new users - all with keyboard shortcuts and visual feedback matching the forums admin interface.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [User Interface](#user-interface)
4. [Ban System](#ban-system)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Testing Guide](#testing-guide)
8. [Implementation Details](#implementation-details)
9. [Future Enhancements](#future-enhancements)

---

## Features

### Core Functionality

- ✅ **Multi-select Users** - Ctrl+Click to select/deselect users (blue borders)
- ✅ **Keyboard Shortcuts** - Tab (soft ban), Delete (hard ban), Escape (clear)
- ✅ **Batch Operations** - Ban/unban multiple users at once
- ✅ **Admin Hints Panel** - Dynamic help text showing available shortcuts
- ✅ **Create Users** - Admin-only user creation with auto-generated passwords
- ✅ **Visual Status Indicators** - Color-coded icons for banned users
- ✅ **Profile Ban Banners** - Warning banners on banned user profiles
- ✅ **Activity Logging** - All ban actions logged to `unified_activity`

### Admin Controls

| Action | Keyboard Shortcut | Description |
|--------|------------------|-------------|
| Select User | Ctrl+Click | Toggle user selection (multi-select) |
| Soft Ban | Tab | Ban selected users (reversible) |
| Hard Ban | Delete | Permanently ban selected users |
| Clear Selection | Escape | Deselect all users |
| Create User | Button Click | Open create user dialog |

---

## Architecture

### Component Structure

```
src/
├── components/users/
│   ├── UserCard.tsx              # Individual user card with selection states
│   ├── UserListClient.tsx        # Main admin interface (client component)
│   ├── BanUserDialog.tsx         # Ban confirmation modal
│   └── CreateUserDialog.tsx      # User creation form modal
├── app/
│   ├── users/page.tsx            # Users index page (server component)
│   ├── profile/[id]/page.tsx     # Profile page with ban banners
│   └── api/users/
│       ├── batch-ban/route.ts    # Soft ban API
│       ├── batch-unban/route.ts  # Unban API
│       ├── batch-hard-ban/route.ts # Hard ban API
│       └── create/route.ts       # User creation API
└── lib/users/
    └── service.ts                # UserService with ban methods
```

### Service Layer

**UserService Methods Added:**

```typescript
// Soft ban (reversible)
async softBanUser(userId: number, bannedBy: number, reason?: string): Promise<void>

// Unban (restore to active)
async unbanUser(userId: number, unbannedBy: number): Promise<void>

// Hard ban (permanent)
async hardBanUser(userId: number, bannedBy: number, reason?: string): Promise<void>

// Batch operations
async batchBanUsers(userIds: number[], bannedBy: number, reason?: string): Promise<void>
async batchUnbanUsers(userIds: number[], unbannedBy: number): Promise<void>
async batchHardBanUsers(userIds: number[], bannedBy: number, reason?: string): Promise<void>

// Admin user creation
async createUserAsAdmin(
  username: string,
  email: string,
  generatedPassword: string,
  createdBy: number
): Promise<{ user: User; password: string }>
```

---

## User Interface

### Admin Hints Panel

Displayed at the top of the users page for admins/moderators:

```
┌─────────────────────────────────────────────────────────────┐
│ User Management                          [+ Create User]     │
│                                                               │
│ Ctrl+Click: Multi-select users                              │
│                                                               │
│ 3 selected | Tab: Soft Ban/Unban | Delete: Hard Ban | Esc: Clear │
└─────────────────────────────────────────────────────────────┘
```

### User Card States

**Normal:**
```
┌────────────────────────────────────┐
│ [Avatar] John Doe        [admin]   │
│          @johndoe                   │
│          Joined Jan 1, 2025         │
│ [View Profile] [Message]            │
└────────────────────────────────────┘
```

**Selected (Blue Border):**
```
┌────────────────────────────────────┐ ← Blue left border
│ [Avatar] John Doe        [admin]   │ ← Blue background tint
│          @johndoe                   │
│          Joined Jan 1, 2025         │
│ [View Profile] [Message]            │
└────────────────────────────────────┘
```

**Soft-Banned (Orange Icon):**
```
┌────────────────────────────────────┐
│ [Avatar] John Doe  [admin] [🚫👁️]  │ ← Eye-slash icon
│          @johndoe                   │
│          Joined Jan 1, 2025         │
│ [View Profile] [Message]            │
└────────────────────────────────────┘
```

**Hard-Banned (Red Icon):**
```
┌────────────────────────────────────┐
│ [Avatar] John Doe  [admin] [🚫]    │ ← Ban icon
│          @johndoe                   │
│          Joined Jan 1, 2025         │
│ [View Profile] [Message]            │
└────────────────────────────────────┘
```

### Profile Ban Banners

**Soft-Banned User Profile:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ User Temporarily Banned                                   │
│ This user has been temporarily banned and cannot create or   │
│ edit content.                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Hard-Banned User Profile:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🚫 User Permanently Banned                                    │
│ This user has been permanently banned from the platform.      │
└─────────────────────────────────────────────────────────────┘
```

### Color Coding

Following the forums admin pattern:

- 🔵 **Blue** (`bg-blue-900/20 border-l-4 border-blue-500`) - Selected users
- 🟠 **Orange** (`bg-orange-900/30 text-orange-400`) - Soft-banned users
- 🔴 **Red** (`bg-red-900/30 text-red-400`) - Hard-banned users

---

## Ban System

### Ban Types

#### Soft Ban (Tab Key)

**Status:** `status = 'banned'`

**Restrictions:**
- ❌ Cannot login
- ❌ Cannot create or edit content (forums, wiki, projects, etc.)
- ✅ Can send and receive messages (full messaging access)
- ✅ Profile remains visible
- ✅ Existing content remains visible

**Reversible:** Yes - Press Tab again to unban

**Use Cases:**
- Temporary suspension for rule violations
- Cooling-off period for disruptive users
- Warning/probation status

#### Hard Ban (Delete Key)

**Status:** `status = 'suspended'`

**Restrictions:**
- ❌ Cannot login
- ❌ Cannot send messages (can receive admin notifications)
- ⚠️ Profile shows permanent ban message
- ✅ Existing content remains visible (not anonymized)

**Reversible:** No - Requires manual admin intervention in database

**Use Cases:**
- Severe rule violations
- Spam accounts
- Abusive users requiring permanent removal

**Confirmation Required:**
- List of affected usernames shown
- Optional reason field
- Warning: "This action is permanent and cannot be easily reversed"
- Checkbox: "I understand this is irreversible"

### Ban Dialog Flow

**Soft Ban:**
```
1. Select users (Ctrl+Click)
2. Press Tab
3. Simple confirmation: "Ban 3 users? username1, username2, username3"
4. Optional reason field
5. Click "Soft Ban" button
6. Users banned, page refreshes
```

**Hard Ban:**
```
1. Select users (Ctrl+Click)
2. Press Delete
3. Warning dialog appears:
   - Red warning box with permanence notice
   - List of affected usernames
   - Optional reason field
   - Checkbox: "I understand this is irreversible"
4. Click "Hard Ban" button
5. Users permanently banned, page refreshes
```

**Unban:**
```
1. Select banned users (Ctrl+Click)
2. Press Tab (automatic unban detection)
3. Confirmation: "Unban 3 users? They will be able to login again."
4. Click "Unban Users" button
5. Users restored to active, page refreshes
```

---

## API Endpoints

### POST /api/users/batch-ban

Soft ban multiple users (reversible).

**Auth Required:** Admin or Moderator

**Request Body:**
```json
{
  "userIds": [123, 456, 789],
  "reason": "Violation of community guidelines" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully soft-banned 3 user(s)"
}
```

**Validation:**
- `userIds` must be non-empty array of numbers
- Cannot ban yourself
- All userIds must exist in database

---

### POST /api/users/batch-unban

Unban multiple users (restore to active status).

**Auth Required:** Admin or Moderator

**Request Body:**
```json
{
  "userIds": [123, 456, 789]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unbanned 3 user(s)"
}
```

---

### POST /api/users/batch-hard-ban

Permanently ban multiple users.

**Auth Required:** Admin or Moderator

**Request Body:**
```json
{
  "userIds": [123, 456, 789],
  "reason": "Severe rule violation" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully hard-banned 3 user(s) permanently"
}
```

**Validation:**
- `userIds` must be non-empty array of numbers
- Cannot ban yourself
- All userIds must exist in database

---

### POST /api/users/create

Admin-only endpoint to create new users.

**Auth Required:** Admin only (not moderators)

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "user",
    "status": "active"
  },
  "message": "User newuser created successfully.",
  "temporaryPassword": "aB3$xY9#mK5@pL2!" // Development only
}
```

**Password Generation:**
- 16 characters long
- Contains uppercase, lowercase, numbers, special characters
- Cryptographically secure random generation
- Currently logged to console (email sending not yet implemented)

**Validation:**
- Username: 3-30 characters, alphanumeric + underscore/hyphen
- Email: Valid email format
- Both must be unique

---

## Database Schema

### Users Table (users.db)

**Existing `status` field used:**

```sql
status TEXT DEFAULT 'active' CHECK(status IN ('active', 'banned', 'suspended', 'pending'))
```

**Status Values:**
- `'active'` - Normal user (default)
- `'banned'` - Soft-banned user (reversible)
- `'suspended'` - Hard-banned user (permanent)
- `'pending'` - Pending approval (unused for admin bans)

**No schema changes required** - Uses existing infrastructure.

### Activity Logging (users.db)

All ban/unban actions logged to `unified_activity` table:

```typescript
// Soft ban activity
{
  user_id: adminId,           // Admin who performed action
  activity_type: 'user_banned',
  entity_id: userId,          // Target user
  entity_type: 'user',
  action: 'soft_ban',
  metadata: JSON.stringify({
    reason: 'Community guidelines violation'
  })
}

// Hard ban activity
{
  user_id: adminId,
  activity_type: 'user_banned',
  entity_id: userId,
  entity_type: 'user',
  action: 'hard_ban',
  metadata: JSON.stringify({
    reason: 'Severe violation',
    permanent: true
  })
}

// Unban activity
{
  user_id: adminId,
  activity_type: 'user_unbanned',
  entity_id: userId,
  entity_type: 'user',
  action: 'unban'
}
```

---

## Testing Guide

### Prerequisites

1. Admin or moderator account
2. Dev server running: `cd frontend && npm run dev`
3. At least 3 test users in database

### Test Cases

#### 1. Multi-Select Functionality

**Steps:**
1. Navigate to `/users`
2. Ctrl+Click on first user → Should show blue border
3. Ctrl+Click on second user → Both should have blue borders
4. Ctrl+Click on first user again → First should deselect
5. Press Escape → All selections cleared

**Expected:**
- Blue borders toggle on/off correctly
- Admin hints panel shows "X selected"
- Escape clears all selections

---

#### 2. Soft Ban Workflow

**Steps:**
1. Select 2-3 users (Ctrl+Click)
2. Press Tab key
3. Verify dialog shows:
   - "Soft Ban Users" title
   - Description of soft ban effects
   - List of selected usernames
   - Optional reason field
4. Enter reason: "Test ban"
5. Click "Soft Ban" button
6. Page refreshes

**Expected:**
- Users show orange eye-slash icon
- Can still message banned users
- Banned users cannot login

---

#### 3. Hard Ban Workflow

**Steps:**
1. Select 2-3 users (Ctrl+Click)
2. Press Delete key
3. Verify dialog shows:
   - "Hard Ban Users (Permanent)" title
   - Red warning box
   - List of selected usernames
   - Optional reason field
   - Checkbox: "I understand this is irreversible"
4. Try clicking "Hard Ban" without checkbox → Should show error
5. Check the checkbox
6. Enter reason: "Test permanent ban"
7. Click "Hard Ban" button
8. Page refreshes

**Expected:**
- Users show red ban icon
- Profile pages show permanent ban banner
- Banned users cannot login

---

#### 4. Unban Workflow

**Steps:**
1. Select 1-2 soft-banned users (orange icons)
2. Press Tab key
3. Verify dialog shows:
   - "Unban Users" title
   - Description: "Restore access..."
   - List of usernames
4. Click "Unban Users" button
5. Page refreshes

**Expected:**
- Orange icons disappear
- Users can login again
- No ban banner on profile

---

#### 5. Create User Workflow

**Steps:**
1. Click "+ Create User" button
2. Enter username: "testuser123"
3. Enter email: "test@example.com"
4. Click "Create User" button
5. Check console logs for generated password

**Expected:**
- User created successfully
- Password logged to console (16 chars, meets requirements)
- User appears in users list with active status

**Email validation:**
- Try invalid email → Should show error
- Try existing email → Should show "Email already exists"

**Username validation:**
- Try < 3 chars → Should show error
- Try special chars → Should show error
- Try existing username → Should show "Username already exists"

---

#### 6. Profile Ban Banners

**Steps:**
1. Soft ban a user
2. Navigate to their profile: `/profile/{userId}`
3. Verify orange banner appears
4. Hard ban a different user
5. Navigate to their profile
6. Verify red banner appears

**Expected:**
- Soft-banned: Orange banner with "Temporarily Banned"
- Hard-banned: Red banner with "Permanently Banned"

---

#### 7. Keyboard Shortcuts

**Test all shortcuts:**
- Escape → Clear selection ✓
- Tab (no selection) → Nothing happens ✓
- Tab (with selection) → Soft ban dialog opens ✓
- Delete (no selection) → Nothing happens ✓
- Delete (with selection) → Hard ban dialog opens ✓
- Shortcuts disabled in input fields ✓

---

#### 8. Self-Ban Prevention

**Steps:**
1. Login as admin
2. Navigate to `/users`
3. Find your own user card
4. Ctrl+Click your own card
5. Press Tab or Delete

**Expected:**
- API returns error: "You cannot ban yourself"
- Shows error message in dialog

---

## Implementation Details

### Frontend Architecture

**Server Components (SSR):**
- `/app/users/page.tsx` - Fetches users, checks admin status
- `/app/profile/[id]/page.tsx` - Fetches profile data, checks ban status

**Client Components (Interactive):**
- `UserListClient.tsx` - Selection state, keyboard listeners, dialogs
- `UserCard.tsx` - Click handlers, visual states
- `BanUserDialog.tsx` - Form validation, API calls
- `CreateUserDialog.tsx` - Form validation, API calls

### State Management

**Local State (useState):**
```typescript
const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
const [showBanDialog, setShowBanDialog] = useState(false);
const [showHardBanDialog, setShowHardBanDialog] = useState(false);
const [showCreateDialog, setShowCreateDialog] = useState(false);
const [processing, setProcessing] = useState(false);
```

**No global state needed** - Component-local state sufficient for this feature.

### Keyboard Event Handling

```typescript
useEffect(() => {
  if (!isAdmin) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input/textarea
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (e.key === 'Escape' && selectedUsers.size > 0) {
      setSelectedUsers(new Set());
    }

    if (e.key === 'Tab' && selectedUsers.size > 0) {
      e.preventDefault();
      handleBatchBan();
    }

    if (e.key === 'Delete' && selectedUsers.size > 0) {
      handleBatchHardBan();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isAdmin, selectedUsers]);
```

### Security Considerations

**Server-Side Checks:**
- All API routes protected with `withSecurity()` middleware
- Admin/moderator role verification on every request
- Cannot ban yourself (prevented in API)
- All userIds validated as numbers

**Input Validation:**
- Username: Zod schema + regex validation
- Email: Zod schema + format validation
- Reason: Optional string (no XSS - sanitized by middleware)

**Activity Logging:**
- All actions logged with admin ID
- Metadata includes reason and action type
- Timestamped for audit trail

---

## Future Enhancements

### Phase 1: Email Integration
- [ ] Send welcome emails with generated passwords
- [ ] Use email service (SendGrid, AWS SES, Resend)
- [ ] Email template for new user accounts
- [ ] Password reset link in email

### Phase 2: Ban Metadata
- [ ] Add fields to users table:
  ```sql
  banned_at TEXT,
  banned_by INTEGER,
  ban_reason TEXT,
  ban_type TEXT CHECK(ban_type IN ('soft', 'hard'))
  ```
- [ ] Display ban reason on profile pages
- [ ] Show who banned the user (admin name)
- [ ] Show ban date/timestamp

### Phase 3: Ban History
- [ ] Create `user_bans` table for full audit trail
- [ ] Show ban/unban history on user profiles
- [ ] Admin dashboard showing recent bans
- [ ] Filter users by ban status in search

### Phase 4: Temporary Bans
- [ ] Add ban duration field
- [ ] Auto-unban after duration expires
- [ ] Cron job to check and expire bans
- [ ] Countdown timer on profile pages

### Phase 5: Content Filtering
- [ ] Hide forum posts from hard-banned users
- [ ] Hide wiki edits from hard-banned users
- [ ] Anonymize content (optional, configurable)
- [ ] Tombstone messages: "[Content removed: user banned]"

### Phase 6: Admin Dashboard
- [ ] Ban statistics widget
- [ ] Recent ban activity feed
- [ ] Most banned users report
- [ ] Ban reasons analytics

### Phase 7: Bulk Actions
- [ ] Import users from CSV
- [ ] Export ban list to CSV
- [ ] Bulk unban by date range
- [ ] Bulk ban by registration date

---

## Troubleshooting

### Issue: Keyboard shortcuts not working

**Solution:**
- Check that you're logged in as admin/moderator
- Verify you're not typing in an input field
- Check browser console for JavaScript errors

### Issue: "Cannot ban yourself" error

**Solution:**
- This is intentional - admins cannot ban themselves
- Deselect your own user card before pressing Tab/Delete

### Issue: Ban dialog doesn't show usernames

**Solution:**
- Check that users array is properly passed to dialog
- Verify selected user IDs match actual users in list

### Issue: Page doesn't refresh after ban

**Solution:**
- Currently uses `window.location.reload()`
- Check browser console for errors
- Verify API response is successful

### Issue: Generated password doesn't meet requirements

**Solution:**
- Password generation function guarantees requirements
- Check console logs for actual password
- Verify email sending (not yet implemented)

---

## Files Modified

**New Components:**
- `src/components/users/UserCard.tsx`
- `src/components/users/UserListClient.tsx`
- `src/components/users/BanUserDialog.tsx`
- `src/components/users/CreateUserDialog.tsx`

**New API Routes:**
- `src/app/api/users/batch-ban/route.ts`
- `src/app/api/users/batch-unban/route.ts`
- `src/app/api/users/batch-hard-ban/route.ts`
- `src/app/api/users/create/route.ts`

**Modified Files:**
- `src/lib/users/service.ts` - Added 7 new ban methods
- `src/app/users/page.tsx` - Integrated UserListClient component
- `src/app/profile/[id]/page.tsx` - Added ban status banners

---

## References

- Forum Admin Features: `docs/forums/FORUMS_ADMIN_FEATURES.md`
- User Types: `src/lib/users/types.ts`
- Auth Utils: `src/lib/auth/utils.ts`
- Security Middleware: `src/lib/security/middleware.ts`

---

**Last Updated:** 2025-10-28
**Implemented By:** Claude Code
**Status:** ✅ Ready for Testing
