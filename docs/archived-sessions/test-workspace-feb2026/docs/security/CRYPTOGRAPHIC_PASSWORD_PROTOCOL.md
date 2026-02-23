# Cryptographic Password Generation Protocol

**MANDATORY FOR ALL CLAUDE CODE OPERATIONS**

---

**Last Updated**: February 16, 2026
**Status**: MANDATORY FOR ALL CLAUDE CODE OPERATIONS
**Author**: Claude Code Security Initiative

---

## Critical Rule

⚠️ **Claude Code MUST ALWAYS use this protocol when generating passwords.**
⚠️ **NEVER use weak passwords like "TestPassword123!", "AdminPassword123", etc.**
⚠️ **This applies to: admin passwords, test/dev passwords, user resets, ALL passwords.**

---

## Protocol Requirements

### Password Specifications

- **Minimum Length**: 15 characters (user requirement)
- **Recommended Length**: 20 characters for admin/service accounts (NIST compliance)
- **Character Set**: Alphanumeric only (A-Z, a-z, 0-9) = 62 characters
- **Entropy**: ~89 bits (15 chars) or ~119 bits (20 chars)
- **Format Example**: `OiOs3uSoxpckzoV` (15 chars) or `3kR9mPx2vL8nQ4tY6wZa` (20 chars)

### Entropy Calculation

```
Entropy = length × log₂(character_set_size)
15 chars × log₂(62) ≈ 15 × 5.95 ≈ 89.4 bits
20 chars × log₂(62) ≈ 20 × 5.95 ≈ 119 bits
```

**Brute Force Resistance:**
- **15 characters**: 62^15 ≈ 7.68 × 10^26 combinations (~24 million years at 1 trillion/sec)
- **20 characters**: 62^20 ≈ 7.04 × 10^35 combinations (~22 quadrillion years at 1 trillion/sec)

---

## Scientific Foundation

### Random.org Methodology

This protocol is inspired by Random.org's approach to true randomness:

- **True Randomness**: Physical phenomena (atmospheric noise from lightning)
- **Rate**: ~40 lightning flashes/second worldwide generate electromagnetic noise
- **Nondeterministic**: Not based on algorithms, truly unpredictable
- **Extraction**: Amplitude variations in electromagnetic noise converted to random bits
- **Quality**: Aperiodic (never repeats) unlike pseudorandom generators

**Sources:**
- [RANDOM.ORG - Introduction to Randomness](https://www.random.org/randomness/)

### NIST 2026 Guidelines (SP 800-90Ar1)

- ✅ Minimum 20 bits entropy for authentication secrets
- ✅ Service accounts: 32+ characters with cryptographic RNG
- ✅ Automated random passwords preferred over human-generated
- ✅ Use cryptographically strong RNGs from OS (not library PRNGs)
- ✅ Storage: bcrypt with salt (implemented in this project)

**Sources:**
- [NIST Special Publication 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [NIST Password Guidelines: 2026 Updates](https://www.strongdm.com/blog/nist-password-guidelines)

---

## Generation Methods

### Method 1: Automated Script (PREFERRED)

**Usage:**

```bash
cd frontend/
npm run security:generate-password          # 15-character password
npm run security:generate-password -- 20    # 20-character password
npm run security:generate-password -- 32    # 32-character password
```

**Output:**

```
🔐 Cryptographic Password Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated Password (15 characters):
OiOs3uSoxpckzoV

Entropy: 89.4 bits
Character Set: Alphanumeric (62 chars)
Method: Node.js crypto.randomBytes() (CSPRNG)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bcrypt Hash (cost 12):
$2b$12$bVNAoCUJphOIWWGZXxQfSOOxcAGaKA1VmbCEuhOQkOdjIAJ6xkZMu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQL UPDATE Statement (users.users):
UPDATE users.users
SET password_hash = '$2b$12$bVNAoCUJphOIWWGZXxQfSOOxcAGaKA1VmbCEuhOQkOdjIAJ6xkZMu',
    updated_at = NOW()
WHERE username = 'admin';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  SAVE THIS PASSWORD IMMEDIATELY TO YOUR PASSWORD MANAGER
⚠️  Once you close this terminal, the password cannot be recovered
```

**Implementation:** See `frontend/scripts/security/generate-password.js`

### Method 2: Manual Generation (Random.org)

**Steps:**

1. Visit: https://www.random.org/strings/
2. Configure:
   - **Number**: 1
   - **Length**: 15 (or 20 for admin accounts)
   - **Characters**: Alphanumeric
   - **Format**: Plain text
3. Click "Get Strings"
4. Copy password immediately to password manager
5. Generate bcrypt hash manually (see below)

### Method 3: Manual Generation (OpenSSL)

**⚠️ DEPRECATED - Use automated script instead**

```bash
# Old method (still works but not recommended)
openssl rand -base64 24 | tr -d '/+=' | tr 'IOl' '123' | head -c 16
```

**Why Deprecated:**
- Complex shell pipeline prone to errors
- Character substitution reduces entropy
- Manual bcrypt hashing required
- No validation of output quality

---

## Manual Bcrypt Hashing

If using Method 2 or 3, hash the password:

```bash
cd frontend/
node -e "const bcrypt = require('bcryptjs'); const hash = bcrypt.hashSync('YOUR_PASSWORD_HERE', 12); console.log(hash);"
```

---

## Password Storage Requirements

### Production Environment

- **Database**: PostgreSQL `users.users` table
- **Column**: `password_hash` (TEXT)
- **Schema**: `users` schema (NOT `auth`)
- **Format**: bcrypt hash starting with `$2b$12$`
- **Length**: 60 characters exactly

### Development Environment

- **Database**: SQLite `frontend/data/auth.db`
- **Table**: `users`
- **Format**: Same bcrypt format

---

## Validation Checklist

Before using any generated password:

- [ ] Length ≥ 15 characters (preferably 20+)
- [ ] Character set is alphanumeric (A-Z, a-z, 0-9)
- [ ] Generated using cryptographically secure RNG
- [ ] Password saved to password manager IMMEDIATELY
- [ ] Bcrypt hash verified (60 chars, starts with $2b$12$)
- [ ] SQL UPDATE statement tested
- [ ] Login tested immediately after setting

---

## Security Principles

### DO ✅

- Use Node.js crypto.randomBytes() for generation
- Generate 15-20+ character passwords
- Test login immediately after setting
- Store passwords in password manager
- Use bcrypt cost factor 12 for production

### DO NOT ❌

- Use Math.random() (NOT cryptographically secure)
- Use simple patterns ("Password123!", "TestPassword123!")
- Use dictionary words or names
- Reuse passwords across accounts
- Store passwords in plain text files or git
- Use cost factor < 10 (too weak) or > 14 (too slow)

---

## Character Distribution Validation

The automated script validates good character distribution:

- ✅ Contains uppercase letters
- ✅ Contains lowercase letters
- ✅ Contains digits
- ✅ No character appears > 20% of the time
- ⚠️ Regenerates if distribution is poor

**Example:**

```javascript
Password: "AAAAAAAAAAAAAAA" (15 chars)
Validation: FAIL - 'A' appears 15/15 = 100% (> 20% threshold)

Password: "OiOs3uSoxpckzoV" (15 chars)
Validation: PASS
- Has uppercase: O, O, V (✓)
- Has lowercase: i, s, u, o, x, p, c, k, z, o (✓)
- Has digits: 3 (✓)
- Max frequency: 'o' appears 3/15 = 20% (✓)
```

---

## Compliance

This protocol satisfies:

- ✅ **OWASP Password Guidelines**: 15+ chars, random generation
- ✅ **NIST SP 800-90Ar1**: CSPRNG, 20-bit entropy minimum
- ✅ **NIST SP 800-63B**: Memorized secret recommendations
- ✅ **Industry Best Practices**: Bcrypt hashing, no reuse

---

## Why This Protocol Exists

### Historical Context

On February 16, 2026, production authentication failed due to corrupted password hashes. During emergency recovery, a weak password "TestPassword123!" was used, violating security best practices and NIST guidelines.

**Incident Report**: [2026-02-16 Login Failure](../incidents/2026-02-16-login-failure-corrupted-passwords.md)

### The Problem with Weak Passwords

**Weak Password Example**: `TestPassword123!`
- Entropy: ~47 bits (dictionary word + common pattern)
- Brute force time: Minutes to hours with modern GPUs
- Violations: Uses dictionary word, predictable pattern, common substitutions

**Strong Password Example**: `OiOs3uSoxpckzoV`
- Entropy: 89 bits (cryptographically random)
- Brute force time: 24 million years at 1 trillion/sec
- Compliance: NIST SP 800-90Ar1, OWASP guidelines

---

## Related Documentation

- [PASSWORD_MANAGEMENT.md](./PASSWORD_MANAGEMENT.md) - Legacy methods (being deprecated)
- [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) - Security patterns
- [Incident 2026-02-16](../incidents/2026-02-16-login-failure-corrupted-passwords.md) - Why weak passwords are dangerous
- [CLAUDE.md](../../CLAUDE.md) - Main documentation (references this protocol)

---

## References

### NIST Publications
- [NIST SP 800-63B](https://pages.nist.gov/800-63-3/sp800-63b.html) - Digital Identity Guidelines
- [NIST Password Guidelines 2026](https://www.strongdm.com/blog/nist-password-guidelines) - Latest updates
- [NIST Password Rule Changes](https://cyberunit.com/insights/nist-password-guidelines-2026-update/) - 2026 updates

### Random.org
- [RANDOM.ORG - Introduction to Randomness](https://www.random.org/randomness/) - True randomness methodology

---

**REMEMBER**: Claude Code must ALWAYS use this protocol. No exceptions.
