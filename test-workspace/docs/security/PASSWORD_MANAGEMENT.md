# Production Password Management Guide

**CRITICAL**: This is a PUBLIC-FACING WEBSITE. Password security is paramount.

---

## ⚠️ IMPORTANT: New Password Protocol Available

**For all new password generation, use the new cryptographic protocol:**
- **Documentation**: [CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](./CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md)
- **Command**: `npm run security:generate-password`
- **Why**: Automated, cryptographically secure, NIST-compliant

**This document remains for reference but the methods below are DEPRECATED.**

---

## Core Principle

**DO NOT CHANGE THE ADMIN PASSWORD TO SOMETHING LESS SECURE**

The current admin password is a cryptographically secure 15-character random string generated from a restricted character set (base58, no ambiguous characters).

---

## Password Requirements

### Production Passwords MUST

- ✅ Use cryptographically secure random generation
- ✅ Minimum 15 characters (preferably 16+)
- ✅ Use base58 character set (1-9, A-Z excluding I,O, a-z excluding l) to avoid confusion
- ✅ Be tested immediately after setting to ensure bcryptjs hashing works correctly
- ✅ Be stored in a password manager

### Production Passwords MUST NOT

- ❌ Use simple passwords like "AdminPassword123" or "TestPassword123!"
- ❌ Be committed to version control
- ❌ Be hardcoded in code
- ❌ Be shared insecurely (plain text email, chat, etc.)
- ❌ Use dictionary words or common patterns

---

## Why This Matters

### Security Risks

- **This is a PUBLIC-FACING WEBSITE**
- A compromised admin account could lead to data breach
- Simple passwords can be cracked in seconds with modern tools
- Rate limiting won't help against brute force attacks if password is weak
- Admin access grants full control over user data, content, and system configuration

### Attack Vectors

1. **Brute Force**: Automated attempts with common passwords
2. **Dictionary Attacks**: Using word lists and variations
3. **Rainbow Tables**: Precomputed hash lookups for common passwords
4. **Credential Stuffing**: Using leaked credentials from other breaches
5. **Social Engineering**: Tricking users into revealing passwords

---

## Password Storage

### Production Environment

**Location**: PostgreSQL `users.users` table
**Format**: bcrypt hash (cost factor 10)
**Schema**: `users` schema (NOT `auth` schema)

**Example**:
```sql
SELECT id, username, password_hash FROM users.users WHERE username = 'admin';
-- password_hash looks like: $2b$10$abc...xyz
```

### Development Environment

**Location**: SQLite `frontend/data/auth.db`
**Format**: bcrypt hash (cost factor 10)
**Table**: `users` table

**Note**: Development and production databases are SEPARATE. Password changes on localhost do NOT affect production.

---

## Generating Secure Passwords

### ✅ RECOMMENDED: Automated Cryptographic Protocol (NEW)

```bash
# Use the new automated script (PREFERRED)
npm run security:generate-password          # 15-char password
npm run security:generate-password -- 20    # 20-char admin password
```

**See**: [CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](./CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md)

**Advantages:**
- Cryptographically secure RNG (crypto.randomBytes)
- Automatic bcrypt hash generation
- Character distribution validation
- SQL UPDATE statement generation
- NIST SP 800-90Ar1 compliant

### ⚠️ DEPRECATED: Manual Methods

The methods below still work but are NO LONGER RECOMMENDED:

#### Method 1: base58 (DEPRECATED)

```bash
# Old method - still works but use automated script instead
openssl rand -base64 24 | tr -d '/+=' | tr 'IOl' '123' | head -c 16
```

**Why base58 (historical reference)?**
- Excludes similar-looking characters: 0/O, 1/I/l
- Safe for URLs and file systems
- Easy to read and type manually
- Still cryptographically strong

**Why deprecated?** Complex shell pipeline, manual bcrypt hashing required.

#### Method 2: Full Random (DEPRECATED)

```bash
# Old method - still works but use automated script instead
openssl rand -hex 16
```

**Why deprecated?** Manual bcrypt hashing required, no validation.

### DO NOT Use

```bash
# ❌ Simple patterns
password123
admin2025
MySecurePassword!

# ❌ Dictionary words
correcthorsebatterystaple

# ❌ Personal information
johnsmith1985
```

---

## Changing Admin Password

### Step 1: Generate New Password

```bash
# Generate secure password
NEW_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | tr 'IOl' '123' | head -c 16)
echo "New Password: $NEW_PASSWORD"

# IMMEDIATELY save to password manager
# DO NOT lose this before Step 3
```

### Step 2: Hash Password (for manual DB update)

If updating database directly:

```javascript
// In Node.js REPL or script
const bcrypt = require('bcryptjs');
const password = 'YOUR_NEW_PASSWORD_HERE';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
// Output: $2b$10$...
```

### Step 3: Update Production Database

**Option A: Using password reset script (RECOMMENDED)**

```bash
# On server or via SSH
cd /home/user/veritable-games-site/frontend
npm run user:reset-admin-password

# Follow prompts
# Enter new password when prompted
# Password will be hashed and stored automatically
```

**Option B: Direct database update (ADVANCED)**

```bash
# Connect to PostgreSQL container
docker exec -it <postgres-container-id> psql -U user -d veritable_games

# Update password hash
UPDATE users.users
SET password_hash = '$2b$10$...'
WHERE username = 'admin';

# Verify update
SELECT username, password_hash FROM users.users WHERE username = 'admin';

# Exit
\q
```

### Step 4: Test Immediately

```bash
# Test login on production
curl -X POST http://192.168.1.15:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_NEW_PASSWORD"}'

# Should return: {"success":true, ...}
# If fails: Immediately roll back or investigate
```

### Step 5: Update Documentation

Update the "Current Password" reference in your password manager with:
- New password
- Date changed
- Changed by whom

---

## Emergency Access Recovery

### Lost Admin Password

If you've lost the admin password and cannot log in:

```bash
# 1. SSH to server
ssh user@192.168.1.15

# 2. Navigate to repository
cd /home/user/veritable-games-site/frontend

# 3. Run password reset script
npm run user:reset-admin-password

# 4. Enter new secure password
# (Generate with: openssl rand -base64 24 | tr -d '/+=' | tr 'IOl' '123' | head -c 16)

# 5. Test login immediately
```

### Locked Out (Too Many Failed Attempts)

If rate limiting has locked you out:

```bash
# 1. SSH to server
ssh user@192.168.1.15

# 2. Connect to database
docker exec -it <postgres-container-id> psql -U user -d veritable_games

# 3. Clear login attempts
DELETE FROM auth.login_attempts WHERE username = 'admin';

# 4. Try logging in again
```

---

## Standard Development Passwords

**For localhost development only** (NOT production):

```
Admin:
  Username: admin
  Password: euZe3CTvcDqqsVz

Test User:
  Username: testuser
  Password: m8vBmxHEtq5MT6
```

**To sync these to production** (if testing):

```bash
# From laptop
scp frontend/scripts/user-management/sync-passwords-to-production.js user@192.168.1.15:/tmp/sync.js

# Execute on production
ssh user@192.168.1.15 "docker cp /tmp/sync.js m4s0kwo4kc4oooocck4sswc4:/app/sync.js && \
  docker exec m4s0kwo4kc4oooocck4sswc4 node sync.js && \
  rm /tmp/sync.js"
```

**⚠️ WARNING**: Only use these passwords for development/testing. NEVER use them in production.

---

## Password Reset Scripts

### Location

`frontend/scripts/user-management/`

### Available Scripts

```bash
# Reset admin password (production-safe)
npm run user:reset-admin-password

# Sync development passwords to production (testing only)
# Script: frontend/scripts/user-management/sync-passwords-to-production.js
```

### Creating Custom Reset Script

```javascript
// frontend/scripts/user-management/reset-custom-user.js
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
});

async function resetPassword(username, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);

  await pool.query(
    'UPDATE users.users SET password_hash = $1 WHERE username = $2',
    [hash, username]
  );

  console.log(`✓ Password updated for: ${username}`);
}

// Usage
resetPassword('admin', 'YOUR_NEW_SECURE_PASSWORD')
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
```

---

## bcrypt Configuration

### Current Settings

- **Cost Factor**: 10
- **Algorithm**: bcrypt (via bcryptjs)
- **Hash Format**: `$2b$10$...`

### Why bcrypt?

- Industry standard for password hashing
- Adaptive: can increase cost factor as hardware improves
- Resistant to rainbow table attacks
- Includes salt automatically

### Hash Structure

```
$2b$10$N9qo8uLOickgx2ZMRZoMye
│ │  │  │
│ │  │  └─ Hash (53 characters)
│ │  └──── Salt (22 characters)
│ └─────── Cost factor (2^10 = 1024 rounds)
└──────── Algorithm variant (2b = bcrypt)
```

---

## Compliance Considerations

### OWASP Guidelines

✅ Password length minimum 15 characters
✅ No password reuse
✅ Secure password storage (bcrypt)
✅ No plain text storage
✅ Protected against brute force (rate limiting)

### Best Practices Followed

- Cryptographically secure random generation
- No password hints or recovery questions
- No email transmission of passwords
- Limited failed login attempts
- Session invalidation on password change
- Audit logging of password changes

---

## Troubleshooting

### Password not working after change

```bash
# 1. Verify password was saved correctly
# Test with curl:
curl -X POST http://192.168.1.15:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}'

# 2. Check database hash
docker exec -it <postgres-container-id> psql -U user -d veritable_games
SELECT username, password_hash FROM users.users WHERE username = 'admin';

# 3. Verify bcrypt hash format
# Should start with $2b$10$

# 4. Try resetting again
npm run user:reset-admin-password
```

### Different password on localhost vs production

**This is expected**. The databases are separate:
- Localhost: SQLite files
- Production: PostgreSQL database

To sync:
1. Set password on localhost
2. Use sync script to push to production
3. OR set passwords independently on each environment

See [DATABASE_ENVIRONMENTS.md](../database/DATABASE_ENVIRONMENTS.md) for details.

---

## Security Checklist

### When Creating New Passwords

- [ ] Generated using cryptographically secure method
- [ ] Minimum 15 characters (preferably 16+)
- [ ] Uses base58 character set (no ambiguous characters)
- [ ] Saved in password manager IMMEDIATELY
- [ ] Never written down or stored in plain text
- [ ] Tested immediately after setting
- [ ] Old password discarded securely

### When Changing Passwords

- [ ] Reason for change documented
- [ ] New password generated securely
- [ ] Database updated successfully
- [ ] Login tested on production
- [ ] Password manager updated
- [ ] Team notified if shared account
- [ ] Old sessions invalidated (if applicable)

### Regular Maintenance

- [ ] Review password strength quarterly
- [ ] Check for leaked credentials (haveibeenpwned.com)
- [ ] Audit login attempts logs
- [ ] Verify rate limiting is active
- [ ] Confirm bcrypt cost factor is appropriate

---

## Related Documentation

- **[CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md](./CRYPTOGRAPHIC_PASSWORD_PROTOCOL.md)** - NEW: Automated password generation (RECOMMENDED)
- **[DATABASE_ENVIRONMENTS.md](../database/DATABASE_ENVIRONMENTS.md)** - Database differences (localhost vs production)
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](../deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production access procedures
- **[CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)** - Security patterns

---

**Last Updated**: February 16, 2026
