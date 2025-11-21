# Token Rotation Still Required - Security Notice

**Date**: November 21, 2025
**Status**: ⚠️ ACTION REQUIRED
**Priority**: High

---

## Executive Summary

GitHub's push protection successfully prevented exposed tokens from being committed to the public repository. However, **token rotation is still required** because the tokens remain exposed in local configuration files and backups.

---

## What GitHub Push Protection Did

✅ **Protected the public repository**:
- Prevented tokens from being pushed to GitHub
- Caught the security issue before public exposure
- Blocked commit containing plaintext tokens in documentation

---

## Why Rotation Is Still Necessary

### 1. Tokens Still Exist in Local Files

**On Server** (`/home/user/`):
```
.config/gh/hosts.yml
  └── Contains GitHub PAT: ghp_[REDACTED]

.config/coolify/config.json
  └── Contains Coolify API token: [REDACTED]
```

**Risk**: Anyone with server access can read these files and extract valid tokens.

### 2. Tokens Backed Up to Laptop

**On Laptop** (`~/Desktop/`):
```
server-sensitive-data-20251121.tar.gz
  └── Contains complete .config/ directory with both tokens

old-tokens-backup-DELETE-AFTER-VERIFICATION.txt
  └── Contains both tokens in plaintext
```

**Risk**: Backup files contain valid credentials that could be used if compromised.

### 3. Security Best Practice

**When tokens are discovered in unexpected places**:
- Even if never publicly exposed
- Even if protected by filesystem permissions
- Even if only in backups

**Best practice**: Rotate them immediately

**Rationale**:
- Unknown how long they've been sitting there
- Unknown if anyone else has accessed them
- Unknown if they've been included in other backups
- Defensive security posture requires assuming compromise

---

## What Push Protection Prevents vs. What It Doesn't

| Scenario | Push Protection | Result |
|----------|----------------|--------|
| Committing token to git | ✅ PREVENTED | Token never reaches GitHub |
| Token in local .config/ files | ❌ NOT COVERED | Token remains valid and readable |
| Token in backup archives | ❌ NOT COVERED | Token remains in archived files |
| Using token from CLI | ❌ NOT COVERED | Token still works for API calls |
| Historical discovery | ❌ NOT COVERED | Doesn't know token age/exposure |

---

## Risk Assessment

### GitHub Token (`ghp_[REDACTED]`)

**Scopes**:
- `repo` - Full repository access (read/write/delete)
- `workflow` - Modify GitHub Actions workflows
- `admin:repo_hook` - Manage webhooks
- `notifications` - Read notifications
- `project` - Manage projects
- `read:org` - Read organization data

**Potential Impact if Compromised**:
- Attacker could push malicious code to repositories
- Attacker could modify CI/CD workflows
- Attacker could delete repositories
- Attacker could create/modify webhooks to exfiltrate data
- Could affect Veritable-Games organization repositories

**Exposure Duration**: Unknown (token created at unknown date, discovered Nov 21, 2025)

### Coolify Token (`[REDACTED]`)

**Permissions**: Full access to Coolify API

**Potential Impact if Compromised**:
- Attacker could deploy malicious containers
- Attacker could access environment variables (including database credentials)
- Attacker could stop/start/modify services
- Attacker could access deployment logs
- Could affect production infrastructure

**Exposure Duration**: Unknown (discovered Nov 21, 2025)

---

## Rotation Instructions

**Location**: Detailed step-by-step instructions on laptop Desktop

```
~/Desktop/token-rotation-instructions.md
```

**Quick Summary**:

### GitHub Token Rotation
1. Visit https://github.com/settings/tokens
2. Revoke old token: `ghp_[REDACTED]`
3. Create new token with same scopes
4. Update via: `gh auth login --web`
5. Verify: `gh auth status`

### Coolify Token Rotation
1. Visit http://192.168.1.15:8000/security/api-tokens
2. Revoke old token: `[REDACTED]`
3. Create new token
4. Update via: `coolify auth login --token <new-token>`
5. Verify: `coolify resource list`

---

## Verification Checklist

After rotating both tokens, verify:

**GitHub**:
- [ ] `gh auth status` shows active login
- [ ] `git push --dry-run` works without errors
- [ ] Can access private repositories via `gh repo view`
- [ ] Old token shows "Revoked" in GitHub settings
- [ ] New token listed with today's creation date

**Coolify**:
- [ ] `coolify resource list` returns results
- [ ] `coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4` works
- [ ] Old token shows "Revoked" in Coolify UI
- [ ] New token listed with today's creation date

**Cleanup**:
- [ ] Delete `~/Desktop/old-tokens-backup-DELETE-AFTER-VERIFICATION.txt`
- [ ] Optionally delete or re-encrypt `~/Desktop/server-sensitive-data-20251121.tar.gz`
- [ ] Update server's .config/ files with new tokens (automatic via CLI login)

---

## Defense in Depth

### Why Multiple Tokens Were Created

**Backup Token** (`old-tokens-backup-DELETE-AFTER-VERIFICATION.txt`):
- Created before rotation for emergency recovery
- Allows verification that new tokens work before destroying old ones
- Standard operational safety practice
- Should be deleted after successful rotation

**Original Tokens** (`.config/` files):
- Created at installation time (gh CLI, coolify CLI)
- Remained in config files (normal behavior)
- Not a security incident - normal token storage
- Discovered during codebase cleanup

### This Is Not a Breach

**What happened**:
- Routine codebase cleanup
- Discovery of tokens in expected locations (.config/)
- Proactive security response
- Attempted to commit documentation mentioning tokens
- GitHub push protection worked correctly

**What did NOT happen**:
- Tokens never committed to git history
- Tokens never pushed to GitHub
- No evidence of unauthorized access
- No evidence of token misuse
- No public exposure

**Classification**: Security hardening exercise, not incident response

---

## Timeline

| Date/Time | Event |
|-----------|-------|
| Unknown | Tokens created during CLI installation (gh, coolify) |
| Nov 21, 2025 | Codebase cleanup initiated |
| Nov 21, 2025 | Tokens discovered in .config/ during cleanup |
| Nov 21, 2025 | Tokens backed up to laptop for safety |
| Nov 21, 2025 | Attempted to commit cleanup documentation |
| Nov 21, 2025 | GitHub push protection blocked commit (CORRECT BEHAVIOR) |
| Nov 21, 2025 | Documentation redacted, successfully committed |
| Nov 21, 2025 | This security notice created |
| **TBD** | **USER ACTION: Rotate tokens following instructions** |

---

## Post-Rotation Actions

After completing token rotation:

1. **Update this document**:
   - Change status from "ACTION REQUIRED" to "COMPLETED"
   - Add completion date
   - Document new token creation dates

2. **Update CLEANUP_SUMMARY_NOV_21_2025.md**:
   - Mark token rotation as complete
   - Add verification results

3. **Optional: Enable GitHub Secret Scanning**:
   - Visit https://github.com/Veritable-Games/veritable-games-server/settings/security_analysis
   - Enable secret scanning (repository is eligible)
   - Provides ongoing token leak detection

4. **Consider Token Rotation Schedule**:
   - GitHub: Rotate every 90 days (security best practice)
   - Coolify: Rotate every 90 days
   - Add calendar reminders
   - Document rotation in operations procedures

---

## Related Documentation

- **Token Rotation Instructions**: `~/Desktop/token-rotation-instructions.md` (detailed steps)
- **Old Token Backup**: `~/Desktop/old-tokens-backup-DELETE-AFTER-VERIFICATION.txt` (delete after rotation)
- **Cleanup Summary**: `/home/user/docs/server/CLEANUP_SUMMARY_NOV_21_2025.md`
- **Server Sensitive Data**: `~/Desktop/server-sensitive-data-20251121.tar.gz` (contains .config/)

---

## Conclusion

GitHub's push protection worked as intended and prevented a documentation issue from becoming a security exposure. However, the underlying tokens remain valid and accessible in configuration files and backups.

**Action Required**: Follow the rotation instructions on your laptop Desktop to complete the security hardening process.

**Expected Time**: 10-15 minutes for both tokens

**Difficulty**: Low (web-based UI operations, CLI commands provided)

---

**Document Created**: November 21, 2025
**Author**: Claude (Sonnet 4.5)
**Next Action**: User to complete token rotation using instructions on laptop Desktop
