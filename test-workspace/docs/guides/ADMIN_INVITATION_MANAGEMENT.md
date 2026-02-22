# Admin Guide: Invitation Management

**Last Updated**: October 29, 2025
**Audience**: System Administrators
**Difficulty**: Beginner

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Creating Invitations](#creating-invitations)
4. [Managing Invitations](#managing-invitations)
5. [Best Practices](#best-practices)
6. [Common Scenarios](#common-scenarios)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Invitation System allows administrators to control user registration through secure, time-limited invitation tokens. This guide covers day-to-day invitation management tasks.

**What You Can Do:**
- ✅ Create single-use or multi-use invitations
- ✅ Set expiration dates (1-90 days)
- ✅ Restrict invitations to specific emails
- ✅ Add notes for tracking purposes
- ✅ Revoke invitations before use
- ✅ Monitor invitation usage

**Admin Access Required**: All invitation management requires admin role.

---

## Quick Start

### Creating Your First Invitation

**Option 1: Via API (Recommended)**

```bash
# Create a 7-day invitation
curl -X POST http://localhost:3000/api/admin/invitations \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=YOUR_SESSION" \
  -d '{
    "expires_in_days": 7,
    "notes": "For new team member"
  }'
```

**Option 2: Via Admin UI** (when available)

1. Navigate to `/admin/users` or `/admin/invitations`
2. Click "Create Invitation"
3. Fill in details
4. Copy generated link
5. Share with new user

**Option 3: Via Script**

```javascript
// scripts/create-invitation.js
import { invitationService } from './src/lib/invitations/service.js';

const invitation = invitationService.createInvitation({
  expiresInDays: 7,
  notes: 'For new team member'
}, adminUserId);

console.log(`Share this link: https://yourdomain.com/auth/register?token=${invitation.token}`);
```

---

## Creating Invitations

### Standard Invitation (7 days, single-use)

```bash
POST /api/admin/invitations
{
  "expires_in_days": 7,
  "notes": "Standard invitation"
}
```

**Use Case**: Most common scenario - one person, one week to register.

---

### Email-Restricted Invitation

```bash
POST /api/admin/invitations
{
  "email": "newuser@example.com",
  "expires_in_days": 14,
  "notes": "For John Doe - restricted to company email"
}
```

**Use Case**: When you know the exact email address (recommended for security).

**Benefits:**
- ✅ Prevents invitation from being used by wrong person
- ✅ Case-insensitive matching (JohnDoe@EXAMPLE.COM = johndoe@example.com)
- ✅ Clear error message if wrong email used

---

### Multi-Use Invitation (Team/Department)

```bash
POST /api/admin/invitations
{
  "max_uses": 5,
  "expires_in_days": 30,
  "notes": "For new development team (5 members)"
}
```

**Use Case**: Onboarding multiple users at once (teams, departments, events).

**Important Notes:**
- Token can be shared via email, Slack, etc.
- Each use increments `use_count`
- Becomes invalid when `use_count >= max_uses`
- Cannot increase max_uses after creation - create new invitation if needed

---

### Short-Lived Invitation (24 hours)

```bash
POST /api/admin/invitations
{
  "expires_in_days": 1,
  "notes": "Urgent onboarding - expires in 24h"
}
```

**Use Case**: Time-sensitive registrations, temporary access.

---

### Long-Lived Invitation (90 days)

```bash
POST /api/admin/invitations
{
  "expires_in_days": 90,
  "notes": "Rolling recruitment campaign"
}
```

**Use Case**: Job postings, long-term recruitment drives.

**Security Note**: Longer expiration = higher security risk. Monitor usage regularly.

---

## Managing Invitations

### Listing All Invitations

```bash
# Get all invitations (including used and revoked)
GET /api/admin/invitations

# Get only active invitations
GET /api/admin/invitations?include_used=false&include_revoked=false

# Get only used invitations (for audit)
GET /api/admin/invitations?include_used=true&include_revoked=false
```

**Response Fields:**
```json
{
  "id": 1,
  "token": "abc...def",
  "email": null,
  "expires_at": "2025-11-05T12:00:00Z",
  "created_by_user_id": 1,
  "created_at": "2025-10-29T12:00:00Z",
  "used_by_user_id": null,    // null = not yet used
  "used_at": null,
  "revoked_at": null,          // null = active
  "revoked_by_user_id": null,
  "notes": "For new team member",
  "max_uses": 1,
  "use_count": 0
}
```

---

### Checking Invitation Status

```bash
# Get specific invitation by ID
GET /api/admin/invitations/[id]
```

**Status Indicators:**

| Condition | Status |
|-----------|--------|
| `revoked_at` is set | **Revoked** - Cannot be used |
| `use_count >= max_uses` | **Fully Used** - Cannot be used |
| `expires_at` < now | **Expired** - Cannot be used |
| `used_at` is set & `use_count < max_uses` | **Partially Used** - Can still be used |
| None of above | **Active** - Ready to use |

---

### Revoking Invitations

**Why Revoke?**
- User no longer joining
- Security concern (token leaked)
- Mistake in invitation details
- Change of plans

**How to Revoke:**

```bash
DELETE /api/admin/invitations/[id]
```

**What Happens:**
- ✅ Sets `revoked_at` to current timestamp
- ✅ Records `revoked_by_user_id` (audit trail)
- ✅ Invitation remains in database (soft delete)
- ✅ Token immediately becomes invalid
- ❌ Does NOT delete used user accounts

**Audit Trail Example:**
```json
{
  "id": 1,
  "revoked_at": "2025-10-29T14:30:00Z",
  "revoked_by_user_id": 1,
  "notes": "Original: For new team member"
}
```

---

## Best Practices

### Security

**✅ DO:**
- Use email restrictions when possible
- Set reasonable expiration dates (7-14 days)
- Revoke unused invitations promptly
- Add descriptive notes for tracking
- Monitor invitation usage regularly
- Use HTTPS for invitation links in production

**❌ DON'T:**
- Share invitation links publicly (e.g., on social media)
- Create invitations with 90+ day expirations without monitoring
- Reuse old invitation tokens
- Create multi-use invitations unless necessary
- Forget to clean up expired invitations

---

### Tracking

**Add Descriptive Notes:**

```bash
# Good notes (descriptive, trackable)
"For John Doe - Engineering hire - Recruiter: Jane Smith"
"Q4 2025 recruitment drive - Marketing department"
"Emergency contractor access - Project X - Manager: Bob Johnson"

# Poor notes (not useful for tracking)
"new user"
"invitation"
"temp"
```

**Track Who Created What:**
```sql
-- Audit: Who created most invitations?
SELECT u.username, COUNT(*) as total_invitations
FROM invitations i
JOIN users u ON i.created_by_user_id = u.id
GROUP BY u.username
ORDER BY total_invitations DESC;
```

---

### Cleanup

**Regular Cleanup (Recommended):**

```bash
# Daily cron job at 2 AM
0 2 * * * cd /path/to/frontend && npm run invitations:cleanup
```

**Manual Cleanup:**

```bash
# Clean expired invitations
npm run invitations:cleanup

# View what would be deleted (dry run)
npm run invitations:cleanup -- --dry-run
```

---

## Common Scenarios

### Scenario 1: Onboarding New Employee

**Steps:**
1. Create email-restricted invitation
2. Set expiration to 7 days
3. Add note with employee name and department
4. Send link to employee's personal email
5. Monitor for registration
6. Verify registration completed

**Script:**
```bash
curl -X POST /api/admin/invitations \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@company.com",
    "expires_in_days": 7,
    "notes": "John Doe - Engineering - Start date: 2025-11-01"
  }'
```

---

### Scenario 2: Emergency Access

**Steps:**
1. Create short-lived invitation (1 day)
2. Add note explaining urgency
3. Share link via secure channel (Slack DM, encrypted email)
4. Monitor for registration
5. Revoke if not used within window

**Script:**
```bash
curl -X POST /api/admin/invitations \
  -d '{
    "expires_in_days": 1,
    "notes": "Emergency contractor - Project X critical fix - Approved by CTO"
  }'
```

---

### Scenario 3: Department Onboarding (5 people)

**Steps:**
1. Create multi-use invitation (max_uses: 5)
2. Set reasonable expiration (30 days)
3. Share link with hiring manager
4. Monitor use count
5. Revoke when all 5 have registered or deadline passes

**Script:**
```bash
curl -X POST /api/admin/invitations \
  -d '{
    "max_uses": 5,
    "expires_in_days": 30,
    "notes": "Marketing team - Q4 hires - Manager: Sarah Johnson"
  }'
```

---

### Scenario 4: Revoking Leaked Token

**Steps:**
1. Identify invitation ID
2. Revoke immediately
3. Check if already used
4. Create new invitation
5. Notify intended recipient

**Script:**
```bash
# 1. Revoke leaked invitation
curl -X DELETE /api/admin/invitations/123

# 2. Check usage
curl /api/admin/invitations/123
# Look for: used_by_user_id, used_at

# 3. Create replacement
curl -X POST /api/admin/invitations \
  -d '{ "email": "correct@email.com", "expires_in_days": 7 }'
```

---

## Monitoring & Analytics

### Daily Checks

**Active Invitations:**
```bash
# How many active invitations exist?
curl '/api/admin/invitations?include_used=false&include_revoked=false' | jq '.count'
```

**Recent Registrations:**
```sql
SELECT u.username, i.notes, i.used_at
FROM invitations i
JOIN users u ON i.used_by_user_id = u.id
WHERE datetime(i.used_at) > datetime('now', '-7 days')
ORDER BY i.used_at DESC;
```

---

### Weekly Reports

**Invitation Usage:**
```sql
-- Week summary
SELECT
  COUNT(*) as total_created,
  SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) as used,
  SUM(CASE WHEN revoked_at IS NOT NULL THEN 1 ELSE 0 END) as revoked,
  SUM(CASE WHEN datetime(expires_at) <= datetime('now') THEN 1 ELSE 0 END) as expired
FROM invitations
WHERE datetime(created_at) > datetime('now', '-7 days');
```

**Multi-Use Statistics:**
```sql
-- Multi-use invitation usage
SELECT id, notes, max_uses, use_count,
  ROUND(CAST(use_count AS FLOAT) / max_uses * 100, 2) as usage_percent
FROM invitations
WHERE max_uses > 1
ORDER BY usage_percent DESC;
```

---

### Monthly Audits

**Top Invitation Creators:**
```sql
SELECT u.username, COUNT(*) as invitations_created
FROM invitations i
JOIN users u ON i.created_by_user_id = u.id
WHERE datetime(i.created_at) > datetime('now', '-30 days')
GROUP BY u.username
ORDER BY invitations_created DESC
LIMIT 10;
```

**Unused Invitations:**
```sql
-- Find invitations never used (potential waste)
SELECT id, notes, created_at, expires_at
FROM invitations
WHERE used_at IS NULL
  AND revoked_at IS NULL
  AND datetime(created_at) < datetime('now', '-30 days')
ORDER BY created_at ASC;
```

---

## Troubleshooting

### User Reports: "Invalid invitation token"

**Possible Causes:**

1. **Token Expired**
   - Check: `expires_at` < now
   - Solution: Create new invitation

2. **Token Revoked**
   - Check: `revoked_at` is set
   - Solution: Create new invitation

3. **Token Fully Used**
   - Check: `use_count >= max_uses`
   - Solution: Create new invitation

4. **Typo in Token**
   - Check: Token length (should be 64 characters)
   - Solution: Send correct link

**Debug Steps:**
```bash
# 1. Get all invitations and search for token
curl /api/admin/invitations | jq '.data[] | select(.token | contains("partial_token"))'

# 2. Check specific invitation
curl /api/admin/invitations/[id]

# 3. Verify current time vs expiration
date -u  # Server time in UTC
```

---

### User Reports: "Email doesn't match invitation"

**Possible Causes:**

1. **Email-Restricted Invitation**
   - Check: `email` field is set
   - Solution: Use correct email OR create unrestricted invitation

2. **Case Sensitivity** (unlikely - system is case-insensitive)
   - Check: Email comparison is case-insensitive
   - Solution: Should work with any case

**Debug Steps:**
```bash
# Check invitation details
curl /api/admin/invitations/[id] | jq '{email, notes}'

# If wrong email restriction:
# 1. Revoke old invitation
# 2. Create new invitation with correct email or no restriction
```

---

### Database Issues

**Missing Invitations Table:**
```bash
# Check if table exists
sqlite3 data/auth.db "SELECT name FROM sqlite_master WHERE type='table' AND name='invitations';"

# If missing, run migration
npm run db:migrate
```

**Corrupted Data:**
```sql
-- Find invitations with invalid state
SELECT * FROM invitations
WHERE (used_at IS NOT NULL AND used_by_user_id IS NULL)
   OR (use_count > max_uses)
   OR (use_count < 0);
```

---

## Quick Reference

### Essential Commands

```bash
# Create invitation
POST /api/admin/invitations

# List invitations
GET /api/admin/invitations

# Get invitation
GET /api/admin/invitations/[id]

# Revoke invitation
DELETE /api/admin/invitations/[id]

# Cleanup expired
npm run invitations:cleanup
```

### Field Quick Reference

| Field | Purpose | Example |
|-------|---------|---------|
| `email` | Restrict to specific email | `"user@example.com"` |
| `expires_in_days` | Days until expiration | `7` (1-90) |
| `max_uses` | Maximum uses | `1` (single), `5` (multi) |
| `notes` | Admin notes | `"For John Doe - Engineering"` |

### Status Check

```bash
# Check invitation status
curl /api/admin/invitations/[id] | jq '{
  id,
  email,
  expires_at,
  used_count: .use_count,
  max_uses,
  is_used: (.used_at != null),
  is_revoked: (.revoked_at != null)
}'
```

---

## Related Documentation

- **Feature Overview**: [docs/features/INVITATION_SYSTEM.md](../features/INVITATION_SYSTEM.md)
- **API Reference**: [docs/API.md](../API.md)
- **Security Guide**: [docs/architecture/SECURITY_ARCHITECTURE.md](../architecture/SECURITY_ARCHITECTURE.md)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

## Support

For additional help:
- Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- Review [INVITATION_SYSTEM.md](../features/INVITATION_SYSTEM.md)
- Contact: System Administrator or DevOps team

---

**Document Version**: 1.0
**Last Reviewed**: October 29, 2025
