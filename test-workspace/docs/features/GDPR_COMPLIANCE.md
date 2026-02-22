# GDPR Compliance System

**Status**: ✅ Operational (Data Export complete, Account Deletion planned)
**Last Updated**: 2025-11-12
**Related Documentation**:
- [Settings & User Management](./SETTINGS_USER_MANAGEMENT.md)
- [Email System](./EMAIL_SYSTEM.md)
- [Database Architecture](../DATABASE.md)

---

## Table of Contents

1. [Overview](#overview)
2. [GDPR Rights Implementation](#gdpr-rights-implementation)
3. [Architecture](#architecture)
4. [Data Export System](#data-export-system)
5. [Right to Erasure (Planned)](#right-to-erasure-planned)
6. [Data Portability](#data-portability)
7. [Privacy by Design](#privacy-by-design)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [Security & Compliance](#security--compliance)
11. [Future Enhancements](#future-enhancements)
12. [Troubleshooting](#troubleshooting)

---

## Overview

The platform implements GDPR (General Data Protection Regulation) compliance features to give users control over their personal data. The system provides automated data export, comprehensive privacy controls, and data management capabilities.

### Key Features

- **Data Export**: Users can export all their data in machine-readable format (JSON)
- **Selective Exports**: Choose specific data categories (forums, wiki, library, activity)
- **Automatic Expiration**: Export files auto-delete after 7 days for security
- **Privacy Controls**: Granular visibility settings across all features
- **Audit Trail**: All data exports are logged with timestamps
- **Admin Oversight**: Admins can request exports for any user (compliance requests)

### GDPR Rights Covered

| Right | Status | Implementation |
|-------|--------|----------------|
| **Right to Access** | ✅ Complete | Data export system with full user data |
| **Right to Portability** | ✅ Complete | JSON format exports, machine-readable |
| **Right to Rectification** | ✅ Complete | Settings pages for profile updates |
| **Right to Erasure** | ⏳ Planned | Account deletion (see comment in account route) |
| **Right to Object** | ✅ Complete | Privacy settings control data processing |
| **Right to Information** | ✅ Complete | Privacy policy, terms of service |

---

## GDPR Rights Implementation

### 1. Right to Access (Article 15)

**Implementation**: DataExportService provides comprehensive data export

Users can request a complete copy of their personal data at any time. The export includes:

```typescript
interface UserDataExport {
  profile: any;                  // User profile information
  privacy_settings: any;         // Privacy preferences
  activity: any[];               // Activity logs (last 500 entries)
  wiki_pages?: any[];            // Created wiki pages
  wiki_revisions?: any[];        // Wiki contributions
  library_documents?: any[];     // Uploaded documents
  conversations?: any[];         // Private messages
  notifications?: any[];         // Notifications (last 500)
}
```

**Access Methods**:
- UI: Settings → Account → Export My Data
- API: `POST /api/users/{id}/export`

### 2. Right to Data Portability (Article 20)

**Implementation**: Structured JSON format with README

All exports are provided in JSON format with a README explaining the data structure:

```
user_data_export_123_1699564800000.zip
├── profile.json              # User profile
├── privacy_settings.json     # Privacy preferences
├── activity.json             # Activity history
├── wiki_pages.json           # Wiki contributions
├── wiki_revisions.json       # Edit history
├── library_documents.json    # Uploaded documents
├── conversations.json        # Messages
├── notifications.json        # Notifications
└── README.md                 # Export documentation
```

### 3. Right to Rectification (Article 16)

**Implementation**: Settings endpoints for all user data

Users can update their personal information at any time:

- **Profile**: `/api/settings/profile` - Name, bio, social links
- **Privacy**: `/api/settings/privacy` - Visibility settings
- **Email**: `/api/settings/email` - Email address updates
- **Account**: `/api/settings/account` - Password changes

### 4. Right to Erasure (Article 17)

**Status**: ⏳ Planned (comment in `/api/settings/account/route.ts:109`)

**Planned Implementation**:
```typescript
// Future: Account deletion request
if (action === 'delete-account') {
  // 1. Create deletion request with 30-day grace period
  // 2. Anonymize user data (replace with "Deleted User")
  // 3. Remove PII (email, IP addresses, etc.)
  // 4. Keep minimal data for legal compliance
  // 5. Send confirmation email
}
```

### 5. Right to Object (Article 21)

**Implementation**: Granular privacy controls

Users can control data processing through privacy settings:

```typescript
interface PrivacySettings {
  profile_visibility: 'public' | 'members' | 'private';
  email_visibility: 'public' | 'members' | 'private';
  show_online_status: boolean;
  show_activity_feed: boolean;
  allow_direct_messages: 'everyone' | 'members' | 'nobody';
  show_forum_activity: boolean;
  show_wiki_activity: boolean;
}
```

### 6. Right to Information (Articles 13-14)

**Implementation**: Transparency documentation

- Privacy policy linked in footer
- Terms of service acceptance on registration
- Clear consent flows for email communications
- Export README explains data collection

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User Request                          │
│                     (Web UI or API)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               API Route (/api/users/[id]/export)             │
│  • Authentication check (getCurrentUser)                     │
│  • Authorization (user or admin only)                        │
│  • Request validation                                        │
│  • CSRF protection (withSecurity)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│             DataExportService (Singleton)                    │
│  • requestDataExport() - Create request                      │
│  • processExportRequest() - Async processing                 │
│  • collectUserData() - Gather from all schemas               │
│  • generateExportFile() - Create ZIP archive                 │
│  • deleteExpiredExports() - Cleanup (cron job)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Database Adapter (Multi-Schema)                    │
│  • users schema: Profile, privacy, notifications             │
│  • wiki schema: Pages, revisions                             │
│  • library schema: Documents, annotations                    │
│  • messaging schema: Conversations                           │
│  • users schema: Activity logs                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   File System                                │
│  • exports/ directory                                        │
│  • ZIP archive creation (archiver)                           │
│  • Automatic cleanup after 7 days                            │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Request Phase**:
   ```
   User → API Route → Validation → DataExportService.requestDataExport()
   ```

2. **Processing Phase** (Asynchronous):
   ```
   Background Job → collectUserData() → Query all schemas → Aggregate results
   ```

3. **Generation Phase**:
   ```
   Aggregated data → generateExportFile() → Create ZIP → Update status
   ```

4. **Cleanup Phase** (Scheduled):
   ```
   Cron job → deleteExpiredExports() → Remove files older than 7 days
   ```

---

## Data Export System

### DataExportService Class

**Location**: `src/lib/users/export-service.ts`

**Singleton Pattern**: Single instance for all export operations

```typescript
export class DataExportService {
  // Public API methods
  async requestDataExport(userId: number, exportType?: string): Promise<string | null>
  async getUserDataExports(userId: number): Promise<ExportRequest[]>
  async getExportRequest(requestId: number): Promise<ExportRequest | null>
  async deleteExpiredExports(): Promise<void>

  // Private processing methods
  private async processExportRequest(requestId: number): Promise<void>
  private async collectUserData(userId: number, exportType: string): Promise<UserDataExport>
  private async generateExportFile(requestId: number, userData: UserDataExport): Promise<string>
  private async updateExportStatus(requestId: number, status: string, error?: string): Promise<void>
}
```

### Export Types

Users can request full or partial exports:

```typescript
type ExportType = 'full' | 'forums' | 'wiki' | 'library' | 'activity';
```

| Export Type | Description | Data Included |
|-------------|-------------|---------------|
| **full** | Complete data export | All user data across all schemas |
| **forums** | Forum activity only | Topics, replies, forum activity |
| **wiki** | Wiki contributions | Pages created, revisions, wiki activity |
| **library** | Library data | Uploaded documents, annotations |
| **activity** | Activity logs only | Activity feed, notifications |

### Request Lifecycle

```typescript
interface ExportRequest {
  id: number;
  user_id: number;
  request_type: 'full' | 'forums' | 'wiki' | 'library' | 'activity';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  expires_at?: string;        // 7 days from creation
  created_at: string;
  completed_at?: string;
  error_message?: string;
}
```

**Status Transitions**:

```
pending → processing → completed
                    ↘ failed
```

### Data Collection Process

#### 1. Profile Data

```typescript
const userResult = await dbAdapter.query(
  `SELECT id, username, email, display_name, bio, avatar_url, role,
          created_at, last_active, location, website_url, github_url,
          mastodon_url, linkedin_url, discord_username, steam_url,
          xbox_gamertag, psn_id, bluesky_url
   FROM users WHERE id = $1`,
  [userId],
  { schema: 'users' }
);
userData.profile = userResult.rows[0];
```

#### 2. Privacy Settings

```typescript
const privacyResult = await dbAdapter.query(
  `SELECT * FROM privacy_settings WHERE user_id = $1`,
  [userId],
  { schema: 'users' }
);
userData.privacy_settings = privacyResult.rows[0];
```

#### 3. Activity Logs

```typescript
const activityResult = await dbAdapter.query(
  `SELECT * FROM unified_activity
   WHERE user_id = $1
   ORDER BY created_at DESC
   LIMIT 500`,
  [userId],
  { schema: 'users' }
);
userData.activity = activityResult.rows;
```

#### 4. Conditional Data (Based on Export Type)

**Wiki Data** (if `exportType === 'full' || exportType === 'wiki'`):
```typescript
// Wiki pages
const wikiPagesResult = await dbAdapter.query(
  `SELECT * FROM pages WHERE created_by = $1`,
  [userId],
  { schema: 'wiki' }
);

// Wiki revisions
const wikiRevisionsResult = await dbAdapter.query(
  `SELECT * FROM revisions WHERE user_id = $1 ORDER BY created_at DESC`,
  [userId],
  { schema: 'wiki' }
);
```

**Library Data** (if `exportType === 'full' || exportType === 'library'`):
```typescript
const libraryDocsResult = await dbAdapter.query(
  `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
  [userId],
  { schema: 'library' }
);
```

**Messaging Data** (if `exportType === 'full'`):
```typescript
const conversationsResult = await dbAdapter.query(
  `SELECT c.*, cp.user_id as participant_id
   FROM conversations c
   JOIN conversation_participants cp ON c.id = cp.conversation_id
   WHERE cp.user_id = $1 OR c.created_by = $1
   ORDER BY c.created_at DESC`,
  [userId],
  { schema: 'messaging' }
);
```

**Notifications**:
```typescript
const notificationsResult = await dbAdapter.query(
  `SELECT * FROM notifications
   WHERE user_id = $1
   ORDER BY created_at DESC
   LIMIT 500`,
  [userId],
  { schema: 'users' }
);
```

### File Generation

**ZIP Archive Structure** (using `archiver` library):

```typescript
const archive = archiver('zip', { zlib: { level: 9 } }); // Maximum compression

// Add JSON files
archive.append(JSON.stringify(userData.profile, null, 2), { name: 'profile.json' });
archive.append(JSON.stringify(userData.privacy_settings, null, 2), { name: 'privacy_settings.json' });
archive.append(JSON.stringify(userData.activity, null, 2), { name: 'activity.json' });

// Conditional files
if (userData.wiki_pages) {
  archive.append(JSON.stringify(userData.wiki_pages, null, 2), { name: 'wiki_pages.json' });
}

// Add README
const readme = `# Your Data Export

This archive contains all your personal data from the platform.

## Files Included:
- **profile.json**: Your user profile information
- **privacy_settings.json**: Your privacy preferences
- **activity.json**: Your recent activity on the platform
...

## Data Format
All files are in JSON format and can be opened with any text editor.

## Privacy
This export was generated on ${new Date().toISOString()} and will be automatically deleted after 7 days.
`;
archive.append(readme, { name: 'README.md' });

archive.finalize();
```

**File Naming**: `user_data_export_{requestId}_{timestamp}.zip`

### Automatic Cleanup

**Scheduled Job**: Should run daily via cron or system scheduler

```typescript
async deleteExpiredExports(): Promise<void> {
  // 1. Find expired exports (expires_at < NOW())
  const expiredResult = await dbAdapter.query(
    `SELECT file_path FROM user_data_exports
     WHERE expires_at < NOW() AND file_path IS NOT NULL`,
    [],
    { schema: 'users' }
  );

  // 2. Delete files from filesystem
  for (const exp of expired) {
    await fs.unlink(exp.file_path);
  }

  // 3. Delete database records
  await dbAdapter.query(
    'DELETE FROM user_data_exports WHERE expires_at < NOW()',
    [],
    { schema: 'users' }
  );
}
```

**Cron Setup Example**:
```bash
# Run daily at 3:00 AM
0 3 * * * node /path/to/cleanup-exports.js
```

---

## Right to Erasure (Planned)

**Current Status**: Comment in `src/app/api/settings/account/route.ts:109`

```typescript
// Handle other account actions here in the future
// e.g., email changes, 2FA setup, account deletion requests
```

### Planned Implementation

**Phase 1**: Account Deletion Request
```typescript
if (action === 'delete-account') {
  // 1. Verify password
  const passwordValid = await authService.verifyPassword(userId, password);
  if (!passwordValid) {
    return error('Incorrect password');
  }

  // 2. Create deletion request with grace period
  const deletionRequest = await dbAdapter.query(
    `INSERT INTO account_deletion_requests
     (user_id, requested_at, scheduled_for)
     VALUES ($1, NOW(), NOW() + INTERVAL '30 days')
     RETURNING id`,
    [userId],
    { schema: 'users' }
  );

  // 3. Send confirmation email
  await emailService.sendAccountDeletionConfirmation(user.email, deletionDate);

  return { success: true, message: 'Account deletion scheduled for 30 days' };
}
```

**Phase 2**: Grace Period Cancellation
```typescript
if (action === 'cancel-deletion') {
  await dbAdapter.query(
    `DELETE FROM account_deletion_requests WHERE user_id = $1`,
    [userId],
    { schema: 'users' }
  );

  return { success: true, message: 'Account deletion cancelled' };
}
```

**Phase 3**: Data Anonymization (Scheduled Job)
```typescript
async processScheduledDeletions() {
  const pendingDeletions = await dbAdapter.query(
    `SELECT * FROM account_deletion_requests
     WHERE scheduled_for <= NOW() AND processed = false`,
    [],
    { schema: 'users' }
  );

  for (const request of pendingDeletions.rows) {
    await this.anonymizeUser(request.user_id);
  }
}

async anonymizeUser(userId: number) {
  // 1. Replace PII with generic values
  await dbAdapter.query(
    `UPDATE users SET
      username = 'deleted_user_' || $1,
      email = 'deleted_' || $1 || '@example.com',
      display_name = 'Deleted User',
      bio = NULL,
      avatar_url = NULL,
      location = NULL,
      website_url = NULL,
      github_url = NULL,
      mastodon_url = NULL,
      linkedin_url = NULL,
      discord_username = NULL
     WHERE id = $1`,
    [userId],
    { schema: 'users' }
  );

  // 2. Delete sessions
  await dbAdapter.query('DELETE FROM sessions WHERE user_id = $1', [userId], { schema: 'auth' });

  // 3. Keep content but anonymize attribution
  // (Forums posts, wiki edits remain but show "Deleted User")

  // 4. Delete private data
  await dbAdapter.query('DELETE FROM conversations WHERE created_by = $1', [userId], { schema: 'messaging' });
  await dbAdapter.query('DELETE FROM notifications WHERE user_id = $1', [userId], { schema: 'users' });
  await dbAdapter.query('DELETE FROM user_data_exports WHERE user_id = $1', [userId], { schema: 'users' });
}
```

### Legal Compliance Notes

**When NOT to delete**:
- Legal hold (litigation, investigation)
- Financial records retention (tax law compliance)
- Abuse prevention (ban evasion)

**What to keep**:
- Minimal identifier (for ban enforcement)
- Legal compliance records
- Anonymized analytics data

---

## Data Portability

### Export Format

**JSON Structure**: Human and machine-readable

```json
{
  "profile": {
    "id": 123,
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "bio": "Software developer",
    "created_at": "2024-01-15T10:30:00Z",
    "location": "San Francisco, CA"
  },
  "privacy_settings": {
    "profile_visibility": "public",
    "email_visibility": "private",
    "show_online_status": true
  },
  "activity": [
    {
      "id": 456,
      "activity_type": "topic_created",
      "entity_type": "topic",
      "entity_id": 789,
      "created_at": "2024-11-10T14:22:00Z"
    }
  ]
}
```

### Data Import to Other Platforms

**Standard Format**: JSON can be imported into:
- Other social platforms
- Personal data stores
- Analytics tools
- Backup systems

**Example Import Script** (Python):
```python
import json
import zipfile

# Extract export
with zipfile.ZipFile('user_data_export_123.zip', 'r') as zip_ref:
    zip_ref.extractall('user_data')

# Load profile
with open('user_data/profile.json', 'r') as f:
    profile = json.load(f)
    print(f"Username: {profile['username']}")
    print(f"Email: {profile['email']}")

# Load activity
with open('user_data/activity.json', 'r') as f:
    activity = json.load(f)
    print(f"Total activities: {len(activity)}")
```

---

## Privacy by Design

### Data Minimization

**Principle**: Collect only necessary data

```typescript
// ✅ GOOD: Collect only required fields
interface UserRegistration {
  username: string;    // Required
  email: string;       // Required
  password: string;    // Required
}

// ❌ BAD: Collect unnecessary data
interface UserRegistration {
  username: string;
  email: string;
  password: string;
  phone: string;          // Not needed
  social_security: string; // Privacy risk
}
```

### Purpose Limitation

**Principle**: Use data only for stated purposes

```typescript
// Email collected for authentication → Only use for:
// ✅ Login
// ✅ Password reset
// ✅ Security alerts
// ❌ Marketing (requires separate consent)
// ❌ Third-party sharing
```

### Storage Limitation

**Principle**: Keep data only as long as necessary

```typescript
// Automatic expiration policies
const EXPORT_EXPIRATION_DAYS = 7;
const SESSION_EXPIRATION_DAYS = 30;
const PASSWORD_RESET_TOKEN_HOURS = 1;
const EMAIL_VERIFICATION_TOKEN_DAYS = 3;
```

### Confidentiality

**Principle**: Protect data with encryption

```typescript
// ✅ Password hashing (bcrypt, 12 rounds)
const hashedPassword = await bcrypt.hash(password, 12);

// ✅ Session tokens (crypto random)
const sessionToken = crypto.randomBytes(32).toString('hex');

// ✅ HTTPS-only cookies
response.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Strict`);
```

---

## API Reference

### POST /api/users/[id]/export

**Request Data Export**

**Authentication**: Required (user or admin)
**CSRF Protection**: Enabled
**Rate Limiting**: 1 request per hour per user

**Request**:
```typescript
POST /api/users/123/export
Content-Type: application/json

{
  "export_type": "full"  // Optional: 'full' | 'forums' | 'wiki' | 'library' | 'activity'
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "request_id": "export_123_456",
    "message": "Data export request submitted. Processing will begin shortly.",
    "export_type": "full"
  }
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Unauthorized to export user data"
}
```

**Status Codes**:
- `200` - Request accepted
- `400` - Invalid request (bad user ID or export type)
- `401` - Authentication required
- `403` - Unauthorized (not user or admin)
- `500` - Server error

**Authorization Rules**:
```typescript
// Users can export their own data
if (currentUser.id === userId) { allow(); }

// Admins can export any user's data
if (currentUser.role === 'admin') { allow(); }

// Otherwise deny
return 403;
```

### GET /api/users/[id]/export

**List User's Export Requests**

**Authentication**: Required (user or admin)
**CSRF Protection**: Disabled (read-only)

**Request**:
```typescript
GET /api/users/123/export
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "user_id": 123,
      "request_type": "full",
      "status": "completed",
      "file_path": "/exports/user_data_export_456_1699564800000.zip",
      "file_size": 2048576,
      "expires_at": "2024-11-19T10:30:00Z",
      "created_at": "2024-11-12T10:30:00Z",
      "completed_at": "2024-11-12T10:32:00Z"
    },
    {
      "id": 457,
      "user_id": 123,
      "request_type": "wiki",
      "status": "processing",
      "created_at": "2024-11-12T14:20:00Z"
    }
  ]
}
```

**Fields**:
- `status`: `'pending'` | `'processing'` | `'completed'` | `'failed'`
- `file_path`: Available only when `status === 'completed'`
- `file_size`: Bytes (available when completed)
- `expires_at`: 7 days from completion
- `error_message`: Present when `status === 'failed'`

**Pagination**: Returns last 10 requests

---

## Database Schema

### users.user_data_exports

**Table**: `user_data_exports`
**Schema**: `users`

```sql
CREATE TABLE user_data_exports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('full', 'forums', 'wiki', 'library', 'activity')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_path TEXT,
  file_size BIGINT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_user_data_exports_user_id ON user_data_exports(user_id);
CREATE INDEX idx_user_data_exports_status ON user_data_exports(status);
CREATE INDEX idx_user_data_exports_expires_at ON user_data_exports(expires_at) WHERE file_path IS NOT NULL;
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL | Unique export request ID |
| `user_id` | INTEGER | User requesting export (FK to users.users) |
| `request_type` | VARCHAR(50) | Export scope: full, forums, wiki, library, activity |
| `status` | VARCHAR(50) | Current status: pending, processing, completed, failed |
| `file_path` | TEXT | Path to generated ZIP file (NULL until completed) |
| `file_size` | BIGINT | Size of ZIP file in bytes (NULL until completed) |
| `expires_at` | TIMESTAMP | When file will be auto-deleted (created_at + 7 days) |
| `created_at` | TIMESTAMP | When request was made |
| `completed_at` | TIMESTAMP | When processing finished (NULL if not complete) |
| `error_message` | TEXT | Error details if status = failed |

**Example Row**:
```sql
INSERT INTO user_data_exports (
  user_id, request_type, status, file_path, file_size,
  expires_at, created_at, completed_at
) VALUES (
  123,
  'full',
  'completed',
  '/exports/user_data_export_456_1699564800000.zip',
  2048576,
  '2024-11-19 10:30:00',
  '2024-11-12 10:30:00',
  '2024-11-12 10:32:00'
);
```

### users.account_deletion_requests (Planned)

**Future Schema**:

```sql
CREATE TABLE account_deletion_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP,
  processed_at TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_account_deletion_requests_scheduled ON account_deletion_requests(scheduled_for)
  WHERE processed = FALSE AND cancelled_at IS NULL;
```

---

## Security & Compliance

### Authentication & Authorization

**User Access**:
```typescript
// Users can only export their own data
if (currentUser.id !== userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

**Admin Override**:
```typescript
// Admins can export any user's data (compliance requests)
if (currentUser.role === 'admin') {
  // Allow export
}
```

### CSRF Protection

```typescript
export const POST = withSecurity(postHandler, {
  enableCSRF: true  // Prevent cross-site request forgery
});
```

### Rate Limiting

**Recommended Implementation**:
```typescript
// Limit to 1 export request per hour per user
const RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 1
};
```

### File Security

**Permissions**:
```bash
# Export directory should have restricted access
chmod 700 /path/to/exports/
chown www-data:www-data /path/to/exports/
```

**Access Control**:
```typescript
// Only authenticated users can download their exports
// Verify ownership before serving file
if (export.user_id !== currentUser.id && currentUser.role !== 'admin') {
  return 403;
}

// Serve file with appropriate headers
res.setHeader('Content-Type', 'application/zip');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
```

### Data Retention

**Automatic Deletion**:
- Export files: 7 days after generation
- Old export requests: Keep records for audit (file deleted, record remains)

**Manual Cleanup**:
```bash
# Run cleanup script daily
npm run gdpr:cleanup-exports
```

### Audit Trail

**Logging**:
```typescript
// Log all export requests
console.log(`[GDPR] User ${userId} requested ${exportType} export`);

// Log all export completions
console.log(`[GDPR] Export ${requestId} completed: ${fileSize} bytes`);

// Log all export downloads
console.log(`[GDPR] User ${userId} downloaded export ${requestId}`);

// Log all deletions
console.log(`[GDPR] Deleted expired export ${requestId}`);
```

### Compliance Documentation

**Required Records**:
- Export request logs (who, when, what)
- Processing logs (success/failure)
- Download logs (access audit)
- Deletion logs (retention compliance)

**Retention Period**: 3 years minimum (varies by jurisdiction)

---

## Future Enhancements

### Phase 1: Account Deletion (Q1 2025)

- [ ] Implement deletion request endpoint
- [ ] 30-day grace period
- [ ] Cancellation option
- [ ] Email confirmations
- [ ] Scheduled processing job
- [ ] Data anonymization script

### Phase 2: Enhanced Privacy Controls (Q2 2025)

- [ ] Granular consent management
- [ ] Email marketing opt-in/out
- [ ] Cookie preferences
- [ ] Third-party integrations control
- [ ] Data processing agreements

### Phase 3: Automated Compliance (Q3 2025)

- [ ] Automatic data minimization
- [ ] Purpose expiration tracking
- [ ] Consent renewal reminders
- [ ] Privacy impact assessments
- [ ] Compliance dashboard (admin)

### Phase 4: Advanced Features (Q4 2025)

- [ ] Data portability to specific platforms (Mastodon, etc.)
- [ ] Selective data deletion (keep some content)
- [ ] Data access logs (show what was accessed)
- [ ] Breach notification system
- [ ] CCPA compliance (California)

---

## Troubleshooting

### Export Request Fails

**Symptoms**:
```json
{
  "success": false,
  "error": "Failed to create export request"
}
```

**Causes & Solutions**:

1. **Database connection issue**:
   ```bash
   # Check database health
   npm run db:health
   ```

2. **Export directory not writable**:
   ```bash
   # Fix permissions
   mkdir -p exports
   chmod 700 exports
   ```

3. **User not found**:
   ```typescript
   // Verify user exists
   const user = await userService.getUserById(userId);
   if (!user) return 404;
   ```

### Export Stuck in "Processing"

**Symptoms**: Export status remains "processing" for hours

**Causes & Solutions**:

1. **Processing job crashed**:
   ```bash
   # Check server logs
   docker logs <container-id> --tail 100 | grep "Export processing"

   # Restart processing manually
   const export = await dataExportService.getExportRequest(requestId);
   await dataExportService.processExportRequest(requestId);
   ```

2. **Large dataset timeout**:
   ```typescript
   // Increase timeout for large exports
   const timeout = exportType === 'full' ? 600000 : 300000; // 10 or 5 minutes
   ```

3. **Database query timeout**:
   ```typescript
   // Check for slow queries
   // PostgreSQL:
   SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%user_data_exports%';
   ```

### Export File Not Found

**Symptoms**:
```json
{
  "status": "completed",
  "file_path": "/exports/user_data_export_456.zip",
  "error": "File not found"
}
```

**Causes & Solutions**:

1. **File expired and deleted**:
   ```typescript
   // Check expiration
   if (export.expires_at < new Date()) {
     return { error: 'Export has expired' };
   }
   ```

2. **Path mismatch**:
   ```bash
   # Verify export directory
   ls -la /path/to/exports/

   # Check file_path in database
   SELECT file_path FROM user_data_exports WHERE id = 456;
   ```

3. **Cleanup job ran too early**:
   ```typescript
   // Verify cleanup logic
   WHERE expires_at < NOW()  // Should be in the past
   ```

### Authorization Errors

**Symptoms**:
```json
{
  "success": false,
  "error": "Unauthorized to export user data"
}
```

**Causes & Solutions**:

1. **User trying to export another user's data**:
   ```typescript
   // Only allow self or admin
   if (currentUser.id !== userId && currentUser.role !== 'admin') {
     return 403;
   }
   ```

2. **Session expired**:
   ```typescript
   // Check session validity
   const currentUser = await getCurrentUser(request);
   if (!currentUser) return 401;
   ```

### Large Export Performance

**Symptoms**: Export takes too long or times out

**Optimizations**:

1. **Limit activity records**:
   ```typescript
   // Limit to last 500 activities instead of all
   LIMIT 500
   ```

2. **Paginate large collections**:
   ```typescript
   // Process in chunks
   for (let offset = 0; offset < total; offset += 1000) {
     const chunk = await query(`... LIMIT 1000 OFFSET ${offset}`);
     // Process chunk
   }
   ```

3. **Exclude large binary data**:
   ```typescript
   // Don't include file content, only metadata
   SELECT id, filename, size, mime_type FROM documents
   // NOT: SELECT * FROM documents (includes binary data)
   ```

### Cleanup Job Not Running

**Symptoms**: Old export files accumulating on disk

**Solution**:

1. **Setup cron job**:
   ```bash
   # Add to crontab
   0 3 * * * cd /path/to/app && npm run gdpr:cleanup-exports
   ```

2. **Manual cleanup**:
   ```bash
   # Run cleanup script
   npm run gdpr:cleanup-exports

   # Or directly in Node
   node -e "require('./src/lib/users/export-service').dataExportService.deleteExpiredExports()"
   ```

3. **Check cleanup logs**:
   ```bash
   # Verify cleanup is working
   grep "Cleaned up" /var/log/app.log
   # Should see: "Cleaned up X expired exports"
   ```

---

## Related Documentation

- [Settings & User Management](./SETTINGS_USER_MANAGEMENT.md) - Privacy settings, profile management
- [Email System](./EMAIL_SYSTEM.md) - Email notifications for exports
- [Database Architecture](../DATABASE.md) - Database schema details
- [API Security](../architecture/CRITICAL_PATTERNS.md) - withSecurity middleware

---

**Implementation Status**:
- ✅ Data export: Complete
- ✅ Privacy controls: Complete
- ⏳ Account deletion: Planned (Q1 2025)

For questions or compliance requests, contact: admin@veritablegames.com
