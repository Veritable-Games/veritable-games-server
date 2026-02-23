# Invitation System

**Last Updated**: October 29, 2025
**Status**: ✅ Production Ready (95% Complete)

---

## Overview

The Invitation System provides secure, controlled user onboarding through cryptographic invitation tokens. Administrators can create time-limited, single-use or multi-use invitation links with optional email restrictions.

**Key Features:**
- 🔐 Cryptographically secure tokens (64-character hex, `crypto.randomBytes(32)`)
- ⏰ Expirable invitations (customizable expiration period)
- 📧 Email-restricted invitations (case-insensitive matching)
- ♻️ Multi-use invitations (configurable maximum uses)
- 🗑️ Soft delete with audit trail (tracks who revoked and when)
- 🧹 Automatic cleanup of expired invitations
- ✅ Comprehensive test coverage (25 unit + 28 integration + 8 E2E tests)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Invitation System                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────┐ │
│  │  Admin UI    │───>│  API Routes   │───>│   Service    │ │
│  │ /admin/users │    │ /api/admin/   │    │ Invitation   │ │
│  │              │    │  invitations  │    │  Service     │ │
│  └──────────────┘    └───────────────┘    └──────┬───────┘ │
│                                                    │          │
│  ┌──────────────┐    ┌───────────────┐           │          │
│  │ Registration │───>│  Auth API     │───────────┘          │
│  │    /auth/    │    │ /api/auth/    │                      │
│  │   register   │    │   register    │                      │
│  └──────────────┘    └───────────────┘                      │
│                                                              │
│                      ┌─────────────┐                        │
│                      │  Database   │                        │
│                      │  auth.db    │                        │
│                      │ invitations │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
frontend/
├── src/
│   ├── lib/
│   │   └── invitations/
│   │       ├── service.ts                    # Core service (242 lines)
│   │       ├── types.ts                      # TypeScript types
│   │       └── __tests__/
│   │           └── service.test.ts           # Unit tests (25 tests)
│   │
│   ├── app/
│   │   └── api/
│   │       ├── admin/
│   │       │   └── invitations/
│   │       │       ├── route.ts              # GET, POST endpoints
│   │       │       ├── [id]/
│   │       │       │   └── route.ts          # GET, DELETE by ID
│   │       │       └── __tests__/
│   │       │           └── route.test.ts     # Integration tests (28 tests)
│   │       │
│   │       └── auth/
│   │           └── register/
│   │               └── route.ts              # Uses invitation validation
│   │
│   └── components/
│       └── admin/
│           └── InvitationManager.tsx         # Admin UI component
│
├── e2e/
│   └── specs/
│       └── invitation-registration.spec.ts   # E2E tests (8 scenarios)
│
└── scripts/
    └── cleanup-expired-invitations.js        # Maintenance script (TBD)
```

---

## Database Schema

### invitations Table (auth.db)

```sql
CREATE TABLE invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,              -- 64-char hex token
  email TEXT,                               -- Optional email restriction
  expires_at TEXT NOT NULL,                 -- ISO 8601 datetime
  created_by_user_id INTEGER NOT NULL,      -- Admin who created
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  used_by_user_id INTEGER,                  -- User who registered
  used_at TEXT,                             -- When used
  revoked_at TEXT,                          -- When revoked (soft delete)
  revoked_by_user_id INTEGER,               -- Admin who revoked
  notes TEXT,                               -- Admin notes
  max_uses INTEGER DEFAULT 1,               -- Maximum times token can be used
  use_count INTEGER DEFAULT 0,              -- Current use count

  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (used_by_user_id) REFERENCES users(id),
  FOREIGN KEY (revoked_by_user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX idx_invitations_created_by ON invitations(created_by_user_id);
CREATE INDEX idx_invitations_email ON invitations(email);
```

**Column Details:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `token` | TEXT | Unique 64-character hex token (cryptographically secure) |
| `email` | TEXT | Optional email restriction (case-insensitive) |
| `expires_at` | TEXT | Expiration timestamp (ISO 8601) |
| `created_by_user_id` | INTEGER | FK to users table (admin who created) |
| `created_at` | TEXT | Creation timestamp |
| `used_by_user_id` | INTEGER | FK to users table (user who registered) |
| `used_at` | TEXT | Timestamp when invitation was used |
| `revoked_at` | TEXT | Soft delete timestamp |
| `revoked_by_user_id` | INTEGER | FK to users table (admin who revoked) |
| `notes` | TEXT | Admin notes about invitation purpose |
| `max_uses` | INTEGER | Maximum allowed uses (default: 1) |
| `use_count` | INTEGER | Current use count |

---

## API Endpoints

### Admin Endpoints (Require Admin Role)

#### `GET /api/admin/invitations`
List all invitations with filtering.

**Query Parameters:**
- `include_used` (boolean, default: true) - Include used invitations
- `include_revoked` (boolean, default: true) - Include revoked invitations

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "token": "abc123...def",
      "email": null,
      "expires_at": "2025-11-05T12:00:00Z",
      "created_by_user_id": 1,
      "created_at": "2025-10-29T12:00:00Z",
      "used_by_user_id": null,
      "used_at": null,
      "revoked_at": null,
      "revoked_by_user_id": null,
      "notes": "For new team member",
      "max_uses": 1,
      "use_count": 0
    }
  ],
  "count": 1
}
```

#### `POST /api/admin/invitations`
Create new invitation.

**Request Body:**
```json
{
  "email": "newuser@example.com",      // Optional
  "expires_in_days": 7,                // Optional, default: 7
  "notes": "For new team member",      // Optional
  "max_uses": 1                        // Optional, default: 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "token": "abc123...def",
    "email": "newuser@example.com",
    "expires_at": "2025-11-05T12:00:00Z",
    "created_by_user_id": 1,
    "created_at": "2025-10-29T12:00:00Z",
    "used_by_user_id": null,
    "used_at": null,
    "revoked_at": null,
    "revoked_by_user_id": null,
    "notes": "For new team member",
    "max_uses": 1,
    "use_count": 0
  },
  "message": "Invitation created successfully"
}
```

#### `GET /api/admin/invitations/[id]`
Get single invitation by ID.

**Response:**
```json
{
  "success": true,
  "data": { /* invitation object */ }
}
```

**Error Responses:**
- 404 - Invitation not found
- 400 - Invalid ID format

#### `DELETE /api/admin/invitations/[id]`
Revoke invitation (soft delete).

**Response:**
```json
{
  "success": true,
  "message": "Invitation revoked successfully"
}
```

**Error Responses:**
- 404 - Invitation not found
- 400 - Invalid ID format

### Authentication Endpoints

#### `POST /api/auth/register`
Register new user with invitation token.

**Request Body:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "token": "abc123...def"            // Invitation token
}
```

**Validation:**
1. Token exists and is valid
2. Token not expired
3. Token not revoked
4. Token has remaining uses (use_count < max_uses)
5. Email matches (if email-restricted)

**Response:**
```json
{
  "success": true,
  "user": { /* user object */ },
  "message": "Registration successful"
}
```

**Error Responses:**
- 400 - Invalid or expired token
- 403 - Email mismatch (for email-restricted invitations)
- 409 - Username/email already exists

---

## Security Features

### Token Generation
```typescript
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 characters
}
```

- **Cryptographically secure** using Node.js `crypto.randomBytes`
- **64-character hexadecimal** tokens (256-bit entropy)
- **Unique constraint** enforced at database level
- **Indexed** for fast lookup

### Email Validation
```typescript
// Case-insensitive email matching
const emailMatch = invitation.email &&
  invitation.email.toLowerCase() === providedEmail.toLowerCase();
```

### Expiration Checking
```typescript
const now = new Date();
const expiresAt = new Date(invitation.expires_at);
const isExpired = now > expiresAt;
```

### Use Count Tracking
```typescript
// Multi-use validation
const hasRemainingUses = invitation.use_count < invitation.max_uses;
```

### Soft Delete Audit Trail
```typescript
// Revocation preserves history
UPDATE invitations
SET revoked_at = CURRENT_TIMESTAMP,
    revoked_by_user_id = ?
WHERE id = ?;
```

---

## Usage Examples

### Admin: Create Standard Invitation

```typescript
import { invitationService } from '@/lib/invitations/service';

// Create 7-day single-use invitation
const invitation = invitationService.createInvitation({
  expiresInDays: 7,
  maxUses: 1
}, adminUserId);

console.log(`Share this link: /auth/register?token=${invitation.token}`);
```

### Admin: Create Email-Restricted Invitation

```typescript
// Create invitation for specific email
const invitation = invitationService.createInvitation({
  email: 'newuser@example.com',
  expiresInDays: 14,
  notes: 'For new team member John Doe'
}, adminUserId);
```

### Admin: Create Multi-Use Invitation

```typescript
// Create invitation for team of 5
const invitation = invitationService.createInvitation({
  maxUses: 5,
  expiresInDays: 30,
  notes: 'For new development team'
}, adminUserId);
```

### User: Register with Invitation

```typescript
// Registration form submission
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'SecurePassword123!',
    token: invitationToken
  })
});
```

### Admin: List Active Invitations

```typescript
// Get only active (unused, not revoked) invitations
const invitations = invitationService.getAllInvitations({
  includeUsed: false,
  includeRevoked: false
});
```

### Admin: Revoke Invitation

```typescript
// Soft delete with audit trail
const revoked = invitationService.revokeInvitation(
  invitationId,
  adminUserId
);
```

---

## Testing Strategy

### Unit Tests (25 tests)
**File**: `src/lib/invitations/__tests__/service.test.ts`

**Coverage:**
- ✅ Token generation (uniqueness, format)
- ✅ Invitation creation (all configurations)
- ✅ Token validation (all scenarios)
- ✅ Usage tracking (markAsUsed, use count)
- ✅ Admin operations (CRUD, revocation)
- ✅ Cleanup (expired invitations)

**Run:**
```bash
npm test -- invitations/service.test.ts
```

### Integration Tests (28 tests)
**File**: `src/app/api/admin/invitations/__tests__/route.test.ts`

**Coverage:**
- ✅ Authentication/authorization (8 tests)
- ✅ Input validation (3 tests)
- ✅ CRUD operations (9 tests)
- ✅ Query filtering (3 tests)
- ✅ Error handling (5 tests)

**Run:**
```bash
npm test -- invitations/__tests__/route.test.ts
```

### E2E Tests (8 scenarios)
**File**: `e2e/specs/invitation-registration.spec.ts`

**Coverage:**
- ✅ Valid token registration
- ✅ Invalid token rejection
- ✅ Expired token rejection
- ✅ Revoked token rejection
- ✅ Email restriction enforcement
- ✅ Multi-use support
- ✅ Fully-used rejection
- ✅ No-token behavior

**Run:**
```bash
npm run test:e2e -- invitation-registration.spec.ts
```

**Total Test Coverage**: 61 tests across 3 layers

---

## Configuration

### Environment Variables

No specific environment variables required. The system uses:
- `SESSION_SECRET` - For session management (already configured)
- `DATABASE_PATH` - For auth.db location (optional, defaults to `./data/auth.db`)

### Default Values

```typescript
const DEFAULTS = {
  EXPIRATION_DAYS: 7,        // Default expiration period
  MAX_USES: 1,               // Default single-use
  TOKEN_LENGTH: 64,          // 64-character hex tokens
  CLEANUP_INTERVAL: 86400    // Clean expired daily (in seconds)
};
```

### Customization

Administrators can customize per-invitation:
- `expiresInDays` - Custom expiration (e.g., 1, 7, 14, 30 days)
- `maxUses` - Single-use (1) or multi-use (2+)
- `email` - Optional email restriction
- `notes` - Admin notes for tracking

---

## Maintenance

### Manual Cleanup

```bash
# Run cleanup script (removes expired invitations)
npm run invitations:cleanup
```

### Scheduled Cleanup (Recommended)

**Cron Job** (Linux/Mac):
```bash
# Edit crontab
crontab -e

# Add daily cleanup at 2 AM
0 2 * * * cd /path/to/frontend && npm run invitations:cleanup >> logs/cleanup.log 2>&1
```

**Task Scheduler** (Windows):
```powershell
# Create scheduled task
schtasks /create /tn "InvitationCleanup" /tr "npm run invitations:cleanup" /sc daily /st 02:00
```

### Monitoring

**Check invitation status:**
```bash
# List all invitations
curl http://localhost:3000/api/admin/invitations

# Check specific invitation
curl http://localhost:3000/api/admin/invitations/[id]
```

**Database queries:**
```sql
-- Count active invitations
SELECT COUNT(*) FROM invitations
WHERE used_at IS NULL
  AND revoked_at IS NULL
  AND datetime(expires_at) > datetime('now');

-- Find expired invitations
SELECT * FROM invitations
WHERE datetime(expires_at) <= datetime('now');

-- Audit trail (who created what)
SELECT u.username, COUNT(*) as invitation_count
FROM invitations i
JOIN users u ON i.created_by_user_id = u.id
GROUP BY u.username;
```

---

## Troubleshooting

### Common Issues

**1. Invalid token error**
- **Cause**: Token expired, revoked, or doesn't exist
- **Solution**: Create new invitation

**2. Email mismatch error**
- **Cause**: Invitation restricted to different email
- **Solution**: Use correct email or create new unrestricted invitation

**3. Token fully used**
- **Cause**: Multi-use invitation reached max_uses
- **Solution**: Create new invitation or increase max_uses before first use

**4. Database errors**
- **Cause**: Missing invitations table
- **Solution**: Run database migration:
  ```bash
  npm run db:migrate
  ```

### Debug Mode

Enable debug logging:
```typescript
// In service.ts, add console.log statements
console.log('[Invitation] Validating token:', token);
console.log('[Invitation] Result:', validation);
```

---

## Future Enhancements

**Phase 1 Complete**:
- ✅ Core invitation system
- ✅ API endpoints
- ✅ Comprehensive testing

**Phase 2 Planned**:
- ⏳ Admin UI component
- ⏳ Cleanup script automation
- ⏳ Email notifications (invite sent, used)
- ⏳ Usage analytics dashboard
- ⏳ Bulk invitation creation
- ⏳ CSV export/import

**Phase 3 Future**:
- 📋 Custom invitation templates
- 📋 Role-based invitations (auto-assign role)
- 📋 Department/team-based invitations
- 📋 Invitation usage reports

---

## Related Documentation

- **Admin Guide**: [docs/guides/ADMIN_INVITATION_MANAGEMENT.md](../guides/ADMIN_INVITATION_MANAGEMENT.md)
- **API Reference**: [docs/API.md](../API.md)
- **Database Schema**: [docs/DATABASE.md](../DATABASE.md)
- **Testing Guide**: [docs/guides/TESTING.md](../guides/TESTING.md)
- **Security**: [docs/architecture/SECURITY_ARCHITECTURE.md](../architecture/SECURITY_ARCHITECTURE.md)

---

## Quick Reference

**Create Invitation:**
```typescript
invitationService.createInvitation({ expiresInDays: 7 }, adminId);
```

**Validate Token:**
```typescript
const validation = invitationService.validateToken(token, email);
if (validation.valid) { /* proceed with registration */ }
```

**List Invitations:**
```typescript
const invitations = invitationService.getAllInvitations({ includeUsed: false });
```

**Revoke Invitation:**
```typescript
invitationService.revokeInvitation(id, adminId);
```

**Clean Expired:**
```typescript
const count = invitationService.cleanupExpiredInvitations();
console.log(`Cleaned up ${count} expired invitations`);
```

---

**For questions or issues, see**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
