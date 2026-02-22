# 🚨 CRITICAL SECURITY ISSUE: E2E Tests Overwriting Admin Password

**Discovered**: 2026-02-15 13:30 UTC
**Severity**: CRITICAL
**Status**: IDENTIFIED - FIX IN PROGRESS

---

## Issue Summary

The E2E test global setup script (`ensure-test-admin.js`) **overwrites the admin user's password to 'admin123'** on every test run. This is a critical security vulnerability.

---

## Affected Files

### Scripts That Set Weak Password
1. `/frontend/e2e/global-setup.ts` - Calls ensure-test-admin.js
2. `/frontend/scripts/user-management/ensure-test-admin.js` - **SETS PASSWORD TO 'admin123'**

### Test Files With Hardcoded Credentials
3. `/frontend/e2e/fixtures/auth-fixtures.ts` - Hardcoded 'admin123'
4. `/frontend/e2e/fixtures/workspace-fixtures.ts` - Hardcoded 'admin123'
5. `/frontend/e2e/specs/workspace-lock-api.spec.ts` - Hardcoded 'admin123'
6. `/frontend/e2e/specs/workspace-lock-elements.spec.ts` - Hardcoded 'admin123'
7. `/frontend/e2e/specs/workspace-json-export-import.spec.ts` - Hardcoded 'admin123'
8. `/frontend/e2e/specs/workspace-align-tools.spec.ts` - Hardcoded 'admin123'
9. `/frontend/e2e/specs/invitation-registration.spec.ts` - Hardcoded 'admin123'
10. `/frontend/e2e/specs/workspace-copy-paste.spec.ts` - Hardcoded 'admin123'

---

## Risk Assessment

### Production Impact
**Risk Level**: MEDIUM (mitigated by local DATABASE_URL)

**Factors**:
- ✅ Local `.env.local` points to `localhost:5432`, NOT production
- ✅ Test setup would only affect local development database
- ⚠️ **IF** someone ran tests with `DATABASE_URL` pointed to production, admin password would be compromised
- ⚠️ Admin user last updated 2026-02-13 07:35 (2 days ago) - unknown if this was from test script

**Verdict**:
- Production likely NOT affected (tests run against localhost)
- **However**, the PATTERN is extremely dangerous and must be fixed immediately

### Development Impact
**Risk Level**: HIGH

**Actual Impact**:
- Local admin password IS set to 'admin123' whenever E2E tests run
- All developers running E2E tests have weak admin password locally
- Developers may assume production also uses this password

---

## Root Cause Analysis

### How It Happens

1. **Test Execution**:
   ```bash
   npx playwright test
   ```

2. **Global Setup Runs** (`e2e/global-setup.ts`):
   ```javascript
   execAsync('node scripts/user-management/ensure-test-admin.js')
   ```

3. **Password Reset** (`ensure-test-admin.js`):
   ```javascript
   const TEST_PASSWORD = 'admin123';
   const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
   await pool.query(`UPDATE users.users SET password_hash = $1 WHERE id = $2`, [
     passwordHash,
     admin.id,
   ]);
   ```

### Why This Is Wrong

1. **Overwrites Production Data**: Modifies database without checking environment
2. **Weak Password**: Uses predictable, easily guessable password
3. **No Safeguards**: No confirmation, no environment check, no rollback
4. **Hardcoded**: Password is in source code, not environment variables
5. **Affects Admin**: Targets most privileged account, not test account

---

## Immediate Actions Taken

### 1. ✅ Testing Paused
- Stopped E2E test execution
- Created status document

### 2. ✅ Verified Production Database
- Checked production admin user
- Confirmed tests run against localhost (safe)
- Admin last updated 2026-02-13 (reason unknown)

### 3. ✅ Created .claude-credentials File
- Template created at `/.claude-credentials`
- Added to `.gitignore`
- Placeholder for proper test credentials

### 4. ✅ Documented Issue
- Created FORUM_TESTING_STATUS_FEB_15_2026.md
- Created this security issue document

---

## Required Fixes (IN PRIORITY ORDER)

### Fix 1: IMMEDIATE - Disable Password Reset in Global Setup

**File**: `/frontend/e2e/global-setup.ts`

**Change**:
```javascript
// BEFORE:
const { stdout, stderr } = await execAsync(
  'node scripts/user-management/ensure-test-admin.js'
);

// AFTER:
// Do NOT reset admin password - use .claude-credentials instead
// const { stdout, stderr } = await execAsync(
//   'node scripts/user-management/ensure-test-admin.js'
// );
console.log('  → Using .claude-credentials for test authentication');
```

### Fix 2: IMMEDIATE - Update ensure-test-admin.js

**File**: `/frontend/scripts/user-management/ensure-test-admin.js`

**Option A**: Delete the file (recommended)
```bash
rm scripts/user-management/ensure-test-admin.js
```

**Option B**: Add environment check (if keeping file)
```javascript
// At top of ensureTestAdmin():
if (process.env.DATABASE_MODE === 'production') {
  console.error('❌ CANNOT reset admin password in production!');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ CANNOT reset admin password in production environment!');
  process.exit(1);
}

// Require explicit confirmation
console.log('⚠️  WARNING: This will reset admin password to a TEST password!');
console.log('   This should ONLY run in local development.');
// ... etc
```

### Fix 3: Create Claude Test User

**Action**: Create dedicated test user (NOT admin)

**SQL** (run on production):
```sql
INSERT INTO users.users (username, email, password_hash, role, created_at, updated_at)
VALUES (
  'claude',
  'claude@veritablegames.com',
  '<strong-bcrypt-hash>',  -- Use npm run user:reset-admin-password pattern
  'user',  -- NOT admin
  NOW(),
  NOW()
);
```

**OR use script**:
```bash
# If create-user script exists:
npm run user:create -- --username claude --email claude@veritablegames.com --role user
```

### Fix 4: Update .claude-credentials

**File**: `/.claude-credentials`

**Action**: Set actual password
```bash
# Generate strong password
STRONG_PASS=$(openssl rand -base64 32)

# Update file
sed -i "s|<TO_BE_SET>|$STRONG_PASS|" .claude-credentials

# Create user in database with this password
# (use user creation script)
```

### Fix 5: Update Test Helpers to Use .claude-credentials

**File**: `/frontend/e2e/helpers/forum-helpers.ts`

**Add at top**:
```typescript
import * as fs from 'fs';
import * as path from 'path';

// Load .claude-credentials
const credentialsPath = path.join(process.cwd(), '..', '.claude-credentials');
const credentials = fs.existsSync(credentialsPath)
  ? Object.fromEntries(
      fs.readFileSync(credentialsPath, 'utf8')
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
    )
  : {};

const CLAUDE_USERNAME = credentials.CLAUDE_TEST_USERNAME || 'claude';
const CLAUDE_PASSWORD = credentials.CLAUDE_TEST_PASSWORD || '';

// Update login() function to use these credentials:
export async function login(page: Page, username?: string, password?: string) {
  const user = username || CLAUDE_USERNAME;
  const pass = password || CLAUDE_PASSWORD;

  if (!pass) {
    throw new Error('.claude-credentials not configured! See docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md');
  }

  // ... rest of login logic
}
```

### Fix 6: Update All Test Files

**Action**: Replace ALL instances of:
- `'admin'` → `'claude'` (or use `CLAUDE_USERNAME` from helper)
- `'admin123'` → Remove entirely, use credentials from helper

**Files to update**: 10+ test files listed above

---

## Verification Steps

After fixes are applied:

### 1. Verify Global Setup Doesn't Change Passwords
```bash
# Run global setup
npx playwright test --config=playwright.config.ts --grep "@never"
# (This runs global setup but no tests match)

# Check admin user wasn't changed
ssh user@10.100.0.1 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT username, updated_at FROM users.users WHERE username = 'admin';\""
# updated_at should NOT change
```

### 2. Verify Claude User Exists
```bash
ssh user@10.100.0.1 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \"SELECT username, email, role FROM users.users WHERE username = 'claude';\""
# Should show: claude | claude@veritablegames.com | user
```

### 3. Verify Credentials Work
```bash
# Try login via API
curl -X POST https://www.veritablegames.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"claude","password":"<from-.claude-credentials>"}'
# Should return success with session
```

### 4. Run Single Test
```bash
npx playwright test e2e/forums/security/authorization.spec.ts:25 --project=chromium
# Should use claude account, not admin
```

---

## Prevention Measures

### Immediate

1. ✅ Add `.claude-credentials` to `.gitignore`
2. ⏳ Add pre-commit hook to check for hardcoded passwords
3. ⏳ Add environment checks to all user management scripts

### Long-term

1. Create separate test database for E2E tests (never touch production)
2. Use Docker Compose for isolated test environment
3. Implement read-only test credentials (can't modify users)
4. Add automated security scanning for credentials in code
5. Document E2E testing best practices in CLAUDE.md

---

## Lessons Learned

### What Went Wrong

1. **No Environment Awareness**: Script doesn't check if it's running against production
2. **Privileged Account**: Uses admin instead of dedicated test account
3. **Hardcoded Secrets**: Password in source code, not config
4. **No Review**: Test setup scripts weren't reviewed for security
5. **Assumption**: Assumed DATABASE_URL always points to safe location

### Best Practices to Follow

1. ✅ **NEVER** modify production data in test scripts
2. ✅ **ALWAYS** check environment before destructive operations
3. ✅ **USE** dedicated test accounts with minimal privileges
4. ✅ **STORE** credentials in files (.env, .credentials), not code
5. ✅ **VERIFY** DATABASE_URL before running any script
6. ✅ **REQUIRE** explicit confirmation for dangerous operations
7. ✅ **SEPARATE** test and production databases completely

---

## Related Documents

- [FORUM_TESTING_STATUS_FEB_15_2026.md](./FORUM_TESTING_STATUS_FEB_15_2026.md) - Current testing status
- [FORUM_E2E_TEST_SUITE_SUMMARY.md](./FORUM_E2E_TEST_SUITE_SUMMARY.md) - Test suite overview
- `/.claude-credentials` - Test credentials (NOT in git)

---

## Sign-Off

**Issue Identified By**: Claude Code (Sonnet 4.5)
**Date**: 2026-02-15 13:30 UTC
**Status**: Documented, awaiting user approval for fixes
**Next Action**: Implement Fix 1 (disable password reset in global setup)
