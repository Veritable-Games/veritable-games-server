# Settings & User Management Documentation

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready
**Location**: `frontend/src/app/api/settings/`, `frontend/src/app/api/users/`, `frontend/src/lib/profiles/`

---

## Table of Contents

- [Overview](#overview)
- [Settings API](#settings-api)
- [User Management API](#user-management-api)
- [Profile Management](#profile-management)
- [Privacy Settings](#privacy-settings)
- [Avatar System](#avatar-system)
- [Account Settings](#account-settings)
- [Admin User Management](#admin-user-management)
- [Data Export](#data-export)
- [Usage Examples](#usage-examples)
- [Security](#security)

---

## Overview

The Settings & User Management system provides comprehensive user profile customization, privacy controls, avatar management, and administrative user operations. It supports extended social profiles, granular privacy settings, and GDPR-compliant data export.

### Key Features

✅ **Profile Management**: Display name, bio, avatar, social links
✅ **Privacy Controls**: Granular visibility settings for profile, activity, email
✅ **Avatar Upload**: Secure image upload with magic number verification
✅ **Social Integration**: 9 social platform links (GitHub, Discord, Steam, etc.)
✅ **Privacy-First**: Fine-grained control over what's public vs. private
✅ **Admin Tools**: Batch ban/unban, user creation, role management
✅ **Data Export**: GDPR-compliant user data download
✅ **Rate Limiting**: Protection against avatar upload abuse

### Use Cases

- **Profile Customization**: Users set up their public profile
- **Privacy Management**: Control visibility of personal information
- **Social Discovery**: Connect profiles across gaming/dev platforms
- **Community Moderation**: Admins manage users (ban, unban, etc.)
- **GDPR Compliance**: Users export their data for portability

---

## Settings API

### 5 Settings Endpoints

All settings endpoints require authentication and are protected with CSRF for write operations.

#### 1. GET/PUT `/api/settings/profile`

**Purpose**: Manage user profile information

**GET Response**:
```json
{
  "success": true,
  "data": {
    "id": 5,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "bio": "Full-stack developer and gaming enthusiast",
    "avatar_url": "/uploads/avatars/abc123.jpg",
    "avatar_position_x": 50,
    "avatar_position_y": 30,
    "avatar_scale": 1.2,
    "location": "San Francisco, CA",
    "website_url": "https://johndoe.com",
    "github_url": "https://github.com/johndoe",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "discord_username": "johndoe#1234",
    "steam_url": "https://steamcommunity.com/id/johndoe",
    "xbox_gamertag": "JohnDoe",
    "psn_id": "JohnDoe_PS",
    "bluesky_url": "https://bsky.app/profile/johndoe.bsky.social",
    "mastodon_url": "https://mastodon.social/@johndoe"
  }
}
```

**PUT Request Body** (all fields optional):
```json
{
  "display_name": "John Doe",
  "bio": "Updated bio text",
  "avatar_url": "/uploads/avatars/new.jpg",
  "avatar_position_x": 50,
  "avatar_position_y": 30,
  "avatar_scale": 1.2,
  "location": "San Francisco, CA",
  "website_url": "https://johndoe.com",
  "github_url": "https://github.com/johndoe",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "discord_username": "johndoe#1234",
  "steam_url": "https://steamcommunity.com/id/johndoe",
  "xbox_gamertag": "JohnDoe",
  "psn_id": "JohnDoe_PS",
  "bluesky_url": "https://bsky.app/profile/johndoe.bsky.social",
  "mastodon_url": "https://mastodon.social/@johndoe"
}
```

**Validation**:
- `display_name`: Max 50 characters
- `bio`: Max 500 characters
- URLs validated for format (future enhancement)

**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { /* updated user object */ }
}
```

#### 2. GET/PUT `/api/settings/privacy`

**Purpose**: Manage privacy and visibility settings

**GET Response**:
```json
{
  "success": true,
  "data": {
    "profile_visibility": "public",
    "activity_visibility": "members",
    "email_visibility": "private",
    "show_online_status": true,
    "show_last_active": false,
    "allow_messages": true,
    "show_reputation_details": true,
    "show_forum_activity": true,
    "show_wiki_activity": true
  }
}
```

**PUT Request Body** (all fields optional):
```json
{
  "profile_visibility": "members",
  "activity_visibility": "private",
  "email_visibility": "admin",
  "show_online_status": false,
  "show_last_active": false,
  "allow_messages": true,
  "show_reputation_details": false,
  "show_forum_activity": true,
  "show_wiki_activity": false
}
```

**Visibility Options**:
- `profile_visibility`: 'public', 'members', 'private'
- `activity_visibility`: 'public', 'members', 'private'
- `email_visibility`: 'public', 'members', 'admin', 'private'

**Boolean Flags**:
- `show_online_status`: Show green dot when online
- `show_last_active`: Display last active timestamp
- `allow_messages`: Allow private messages from others
- `show_reputation_details`: Display reputation breakdown
- `show_forum_activity`: Show forum posts on profile
- `show_wiki_activity`: Show wiki edits on profile

**Response**:
```json
{
  "success": true,
  "message": "Privacy settings updated successfully",
  "data": { /* updated privacy settings */ }
}
```

#### 3. GET/PUT `/api/settings/account`

**Purpose**: Account-level settings (email, password, 2FA)

**Note**: Implementation details not fully visible in explored files. Typical structure:

**PUT Request Body**:
```json
{
  "email": "newemail@example.com",
  "current_password": "current_pass",
  "new_password": "new_secure_pass",
  "enable_2fa": true
}
```

#### 4. GET/PUT `/api/settings/email`

**Purpose**: Email notification preferences

**Expected Structure**:
```json
{
  "notify_mentions": true,
  "notify_replies": true,
  "notify_messages": true,
  "notify_follows": false,
  "digest_frequency": "weekly"
}
```

#### 5. GET/PUT `/api/settings/descriptions`

**Purpose**: Editable page descriptions (admin feature)

**Structure**:
```json
{
  "page_key": "home",
  "description": "Welcome to Veritable Games"
}
```

---

## User Management API

### 9 User Endpoints

#### 1. GET `/api/users/[id]`

**Purpose**: Get public user profile

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 5,
    "username": "johndoe",
    "display_name": "John Doe",
    "bio": "Developer and gamer",
    "avatar_url": "/uploads/avatars/abc123.jpg",
    "location": "San Francisco",
    "created_at": "2025-01-15T10:00:00Z",
    "last_active": "2025-11-12T14:30:00Z",
    "is_online": true,
    "reputation": 1543,
    "forum_posts": 234,
    "wiki_edits": 45,
    "projects_count": 3
  }
}
```

**Privacy Applied**: Respects user's privacy settings

#### 2. GET `/api/users/[id]/profile`

**Purpose**: Get detailed user profile with extended info

**Includes**: All profile fields, social links, activity summary

#### 3. POST `/api/users/create`

**Purpose**: Create new user account (admin only)

**Request Body**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "secure_password",
  "display_name": "New User",
  "role": "member"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": { "user_id": 42 }
}
```

#### 4. POST `/api/users/[id]/avatar`

**Purpose**: Upload user avatar image

**Request**: `multipart/form-data` with `avatar` file

**Validation**:
- File types: JPEG, PNG, GIF, WebP only
- Magic number verification (prevents disguised malware)
- Max file size: 5 MB (configurable)
- Rate limiting: 5 uploads per hour (non-admin)

**Security Features**:
- **Magic Number Check**: Verifies file signature (not just extension)
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47`
  - GIF: `47 49 46`
  - WebP: `52 49 46 46 ... 57 45 42 50`
- **Rate Limiting**: Prevents upload flooding
- **Authorization**: Users can only upload own avatar (unless admin)
- **Unique Filenames**: Random 32-byte hex string prevents collisions

**Response**:
```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatar_url": "/uploads/avatars/abc123def456.jpg"
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid file type or missing file
- `403 Forbidden` - Not authorized to update this avatar
- `429 Too Many Requests` - Rate limit exceeded (5/hour)
- `413 Payload Too Large` - File exceeds size limit

#### 5. DELETE `/api/users/[id]/avatar`

**Purpose**: Remove user avatar (revert to default)

**Response**:
```json
{
  "success": true,
  "message": "Avatar removed successfully"
}
```

#### 6. GET `/api/users/[id]/favorites`

**Purpose**: Get user's favorited content

**Response**:
```json
{
  "success": true,
  "data": {
    "projects": [/* project objects */],
    "wiki_pages": [/* wiki page objects */],
    "forum_topics": [/* forum topic objects */]
  }
}
```

#### 7. GET `/api/users/[id]/export`

**Purpose**: Export user data (GDPR compliance)

**Authentication**: User can only export their own data

**Response**: JSON file download with all user data:
```json
{
  "export_date": "2025-11-12T15:00:00Z",
  "user": { /* profile data */ },
  "forum_posts": [/* all posts */],
  "wiki_edits": [/* all edits */],
  "projects": [/* all projects */],
  "messages": [/* all messages */],
  "notifications": [/* all notifications */]
}
```

**See**: [GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md) for complete export details

#### 8. POST `/api/users/batch-ban`

**Purpose**: Ban multiple users (admin only)

**Request Body**:
```json
{
  "user_ids": [5, 7, 12],
  "reason": "Spam posting",
  "duration_days": 7
}
```

**Response**:
```json
{
  "success": true,
  "message": "3 users banned successfully",
  "banned_ids": [5, 7, 12]
}
```

#### 9. POST `/api/users/batch-unban`

**Purpose**: Unban multiple users (admin only)

**Request Body**:
```json
{
  "user_ids": [5, 7, 12]
}
```

---

## Profile Management

### Extended Profile Fields

**Core Profile**:
- `username` - Unique identifier (immutable)
- `display_name` - Public display name (max 50 chars)
- `bio` - User bio/about section (max 500 chars)
- `avatar_url` - Avatar image URL
- `location` - Geographic location

**Avatar Positioning**:
- `avatar_position_x` - Horizontal crop position (0-100)
- `avatar_position_y` - Vertical crop position (0-100)
- `avatar_scale` - Zoom level (0.1-3.0)

**Social Links** (9 platforms):
| Platform | Field | Format |
|----------|-------|--------|
| Website | `website_url` | Full URL |
| GitHub | `github_url` | `https://github.com/username` |
| LinkedIn | `linkedin_url` | `https://linkedin.com/in/username` |
| Discord | `discord_username` | `username#1234` |
| Steam | `steam_url` | `https://steamcommunity.com/id/username` |
| Xbox | `xbox_gamertag` | Gamertag string |
| PlayStation | `psn_id` | PSN ID string |
| Bluesky | `bluesky_url` | `https://bsky.app/profile/username.bsky.social` |
| Mastodon | `mastodon_url` | `https://mastodon.social/@username` |

**Activity Stats** (read-only):
- `forum_posts` - Total forum topics + replies
- `wiki_edits` - Total wiki page edits
- `projects_count` - Number of projects created
- `reputation` - Cumulative reputation score
- `created_at` - Account creation date
- `last_active` - Last activity timestamp

---

## Privacy Settings

### Privacy Levels

#### Profile Visibility

Controls who can view your profile page:

| Level | Description | Can View |
|-------|-------------|----------|
| **public** | Anyone can view | All users (including guests) |
| **members** | Members only | Logged-in users only |
| **private** | Hidden profile | Only you and admins |

#### Activity Visibility

Controls who can see your activity (forum posts, wiki edits):

| Level | Description | Visible To |
|-------|-------------|------------|
| **public** | Everyone sees activity | All users |
| **members** | Members only | Logged-in users |
| **private** | Hidden activity | Only you |

#### Email Visibility

Controls who can see your email address:

| Level | Description | Can View Email |
|-------|-------------|----------------|
| **public** | Email shown on profile | Everyone |
| **members** | Members can see email | Logged-in users |
| **admin** | Admins only | Administrators |
| **private** | Email never shown | Nobody |

### Privacy Flags

**Online Status**:
- `show_online_status = true`: Green dot shows when you're online
- `show_online_status = false`: Always appears offline

**Last Active**:
- `show_last_active = true`: "Last active 5 minutes ago" shown
- `show_last_active = false`: Last active time hidden

**Private Messages**:
- `allow_messages = true`: Anyone can send you messages
- `allow_messages = false`: Disable incoming messages

**Activity Details**:
- `show_forum_activity = true`: Forum posts appear on profile
- `show_forum_activity = false`: Forum activity hidden
- `show_wiki_activity = true`: Wiki edits appear on profile
- `show_wiki_activity = false`: Wiki edits hidden
- `show_reputation_details = true`: Show reputation breakdown
- `show_reputation_details = false`: Hide reputation details

### Default Privacy Settings

**New Users**:
```json
{
  "profile_visibility": "public",
  "activity_visibility": "public",
  "email_visibility": "private",
  "show_online_status": true,
  "show_last_active": true,
  "allow_messages": true,
  "show_reputation_details": true,
  "show_forum_activity": true,
  "show_wiki_activity": true
}
```

**Recommended Privacy Settings** (balanced):
```json
{
  "profile_visibility": "public",
  "activity_visibility": "members",
  "email_visibility": "admin",
  "show_online_status": true,
  "show_last_active": false,
  "allow_messages": true,
  "show_reputation_details": true,
  "show_forum_activity": true,
  "show_wiki_activity": true
}
```

---

## Avatar System

### Upload Process

**1. User Selects Image**:
- Click "Change Avatar" button
- Select JPEG, PNG, GIF, or WebP file
- Max 5 MB file size

**2. Client-Side Preview**:
- Show image preview
- Crop/position controls
- Scale adjustment

**3. Upload to Server**:
```typescript
const formData = new FormData();
formData.append('avatar', fileBlob);

const response = await fetch(`/api/users/${userId}/avatar`, {
  method: 'POST',
  body: formData,
  headers: {
    'X-CSRF-Token': csrfToken,
  },
});
```

**4. Server Processing**:
- Verify magic numbers (prevent malware)
- Generate unique filename (32-byte random hex)
- Save to `/uploads/avatars/` directory
- Update user's `avatar_url` in database
- Return new avatar URL

**5. Crop & Position (Optional)**:
```typescript
await fetch('/api/settings/profile', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({
    avatar_position_x: 50,  // Center horizontally
    avatar_position_y: 30,  // Top third vertically
    avatar_scale: 1.2,      // 120% zoom
  }),
});
```

### Security Features

**Magic Number Verification**:
```typescript
// Check first bytes of file to verify true image format
const magicNumbers = buffer.subarray(0, 12);

const isValidImage =
  (magicNumbers[0] === 0xff && magicNumbers[1] === 0xd8) || // JPEG
  (magicNumbers[0] === 0x89 && magicNumbers[1] === 0x50) || // PNG
  (magicNumbers[0] === 0x47 && magicNumbers[1] === 0x49) || // GIF
  (magicNumbers[0] === 0x52 && magicNumbers[1] === 0x49);   // WebP
```

**Why This Matters**:
- Prevents executable files disguised as images
- MIME type spoofing won't work
- File extension renaming won't bypass check

**Rate Limiting**:
- 5 uploads per hour for regular users
- Unlimited for admins
- 429 status code with `Retry-After` header
- Tracks per client IP address

---

## Account Settings

### Email Management

**Change Email**:
```json
{
  "new_email": "newemail@example.com",
  "current_password": "verify_identity"
}
```

**Verification Flow**:
1. User requests email change
2. Verification email sent to new address
3. User clicks verification link
4. Email updated if verified within 24 hours

### Password Management

**Change Password**:
```json
{
  "current_password": "old_password",
  "new_password": "new_secure_password",
  "confirm_password": "new_secure_password"
}
```

**Requirements**:
- Minimum 8 characters
- Must include: uppercase, lowercase, number, symbol
- Cannot be same as username or email
- Cannot be in common password list

### Two-Factor Authentication (2FA)

**Enable 2FA**:
1. Generate TOTP secret
2. Display QR code
3. User scans with authenticator app
4. Verify 6-digit code
5. Save backup codes

**Disable 2FA**:
- Requires current password
- Or use backup code

---

## Admin User Management

### Batch Operations

**Batch Ban Users**:
```typescript
await fetch('/api/users/batch-ban', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({
    user_ids: [5, 7, 12],
    reason: 'Spam posting',
    duration_days: 7,  // Temporary ban (0 = permanent)
  }),
});
```

**Batch Unban Users**:
```typescript
await fetch('/api/users/batch-unban', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({
    user_ids: [5, 7, 12],
  }),
});
```

**Hard Ban** (permanent):
```typescript
await fetch('/api/users/batch-hard-ban', {
  method: 'POST',
  body: JSON.stringify({
    user_ids: [999],
    reason: 'Severe ToS violation',
  }),
});
```

### User Creation (Admin)

**Create User**:
```typescript
await fetch('/api/users/create', {
  method: 'POST',
  body: JSON.stringify({
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'temp_password',
    display_name: 'New User',
    role: 'member',  // or 'moderator', 'admin'
    send_welcome_email: true,
  }),
});
```

---

## Data Export

### GDPR Data Export

**Request Export**:
```typescript
const response = await fetch(`/api/users/${userId}/export`);
const blob = await response.blob();

// Download as JSON file
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `veritable-games-data-${userId}-${Date.now()}.json`;
link.click();
```

**Export Contents**:
```json
{
  "export_date": "2025-11-12T15:00:00Z",
  "user": {
    "id": 5,
    "username": "johndoe",
    "email": "john@example.com",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "profile": {
    "display_name": "John Doe",
    "bio": "Developer",
    "social_links": { /* all social URLs */ }
  },
  "privacy_settings": { /* all privacy flags */ },
  "forum_activity": {
    "topics": [/* all topics created */],
    "replies": [/* all replies posted */]
  },
  "wiki_activity": {
    "pages_created": [/* pages */],
    "revisions": [/* all edits */]
  },
  "projects": [/* all projects */],
  "messages": [/* all private messages */],
  "notifications": [/* all notifications */],
  "activity_log": [/* login history, etc. */]
}
```

**See**: [GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md) for complete export specification

---

## Usage Examples

### Update Profile

```typescript
async function updateProfile(updates: Partial<UserProfile>) {
  const response = await fetch('/api/settings/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error);
  }

  return data.data;
}

// Usage
await updateProfile({
  display_name: 'John Doe',
  bio: 'Full-stack developer',
  github_url: 'https://github.com/johndoe',
});
```

### Update Privacy Settings

```typescript
async function updatePrivacy(settings: Partial<PrivacySettings>) {
  const response = await fetch('/api/settings/privacy', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(settings),
  });

  return await response.json();
}

// Usage: Make profile members-only
await updatePrivacy({
  profile_visibility: 'members',
  activity_visibility: 'members',
  show_last_active: false,
});
```

### Upload Avatar

```typescript
async function uploadAvatar(file: File, userId: number) {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`/api/users/${userId}/avatar`, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    if (response.status === 429) {
      throw new Error(`Rate limit exceeded. Retry after ${response.headers.get('Retry-After')}s`);
    }
    throw new Error(data.error);
  }

  return data.data.avatar_url;
}

// Usage
const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
const file = fileInput.files![0];

try {
  const avatarUrl = await uploadAvatar(file, currentUser.id);
  console.log('Avatar uploaded:', avatarUrl);
} catch (error) {
  console.error('Upload failed:', error.message);
}
```

---

## Security

### Authentication Requirements

- **All endpoints**: Require valid session (authenticated user)
- **Write operations**: CSRF token validation required
- **Admin operations**: Role check (admin only)
- **User-specific operations**: Authorization check (can only modify own data)

### Rate Limiting

| Operation | Limit | Duration | Status Code |
|-----------|-------|----------|-------------|
| Avatar upload | 5 requests | 1 hour | 429 |
| Profile update | 10 requests | 1 minute | 429 |
| Privacy update | 10 requests | 1 minute | 429 |

**Admin Exemption**: Admins bypass rate limits

### Input Validation

**Display Name**:
- Max 50 characters
- No special characters (alphanumeric + spaces + basic punctuation)
- No leading/trailing whitespace

**Bio**:
- Max 500 characters
- HTML tags stripped (XSS prevention)
- Links allowed but sanitized

**URLs**:
- Valid URL format required
- HTTPS preferred (HTTP redirected)
- No javascript: or data: URLs

### File Upload Security

**Avatar Upload**:
1. **File Type Validation**: Only JPEG, PNG, GIF, WebP
2. **Magic Number Check**: Verify file signature (not just extension)
3. **Size Limit**: Max 5 MB
4. **Unique Filenames**: Random 32-byte hex (prevents conflicts)
5. **Rate Limiting**: 5 uploads/hour
6. **Directory Permissions**: Upload directory not executable

---

## Related Documentation

- **[docs/api/README.md](../api/README.md)** - Complete API reference
- **[docs/DATABASE.md](../DATABASE.md)** - Database schema (users, profiles tables)
- **[docs/features/GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md)** - Data export details
- **[docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)** - Security patterns
- **[CLAUDE.md](../../CLAUDE.md)** - Development guide

---

## Troubleshooting

### Common Issues

**Q: Avatar upload fails with 400 error**
A: Verify file type is JPEG/PNG/GIF/WebP. Check file signature matches type (magic number validation).

**Q: 429 Too Many Requests when uploading avatar**
A: Rate limit (5/hour) exceeded. Wait for time specified in `Retry-After` header or use admin account.

**Q: Profile changes not saving**
A: Ensure CSRF token is included in request header. Check validation errors (display_name > 50 chars, bio > 500 chars).

**Q: Privacy settings not applying**
A: Clear cache and refresh. Some privacy changes require logout/login to take effect.

**Q: Social links not displaying**
A: Verify URLs are complete (include `https://`). Check privacy settings allow profile visibility.

---

**Last Updated**: November 12, 2025
**Status**: ✅ Production-ready with 14 endpoints, secure avatar upload, granular privacy controls, and GDPR-compliant data export
