# SSH Key Security Architecture Plan

**Date Created**: February 24, 2026
**Priority**: HIGH
**Status**: PLANNING

---

## Executive Summary

Current SSH key setup is **functional but insecure**. Single production key with write access, no rotation policy, inconsistent authentication methods, and no audit trail create significant operational risk.

This plan establishes proper SSH key architecture with role-based separation, rotation procedures, audit logging, and emergency access protocols.

---

## 1. Current State Assessment

### Existing Configuration

**Production Key**:
- File: `~/.ssh/id_ed25519`
- Type: ED25519
- Fingerprint: `SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY`
- Registered: February 14, 2026
- Owner: `christopher@corella.com`
- Permissions: Read + Write
- Passphrase: None (unprotected)
- Rotation: Never

**Usage**:
- Server repo: SSH push/pull
- Site repo: HTTPS workaround (inconsistent)
- Coolify: GitHub App (separate)

### Security Issues Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| Single key for all operations | HIGH | Any compromise = full access |
| Write access on deploy key | HIGH | Deploy key shouldn't have write access |
| No passphrase protection | HIGH | Stolen key usable without password |
| No key rotation policy | MEDIUM | Old keys never retired or audited |
| Production email in key metadata | MEDIUM | Links key to personal account |
| Inconsistent auth methods | MEDIUM | Hard to audit and maintain |
| No emergency access fallback | HIGH | No recovery if primary key compromised |
| No audit logging | HIGH | Can't track who deployed what |
| SSH agent not used | MEDIUM | Key loaded in memory always |

---

## 2. Target Architecture

### Three-Tier Key System

```
SSH Key Architecture:
┌─────────────────────────────────────────────────────┐
│         Production Server (192.168.1.15)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─ Coolify Deploy (CI/CD)                         │
│  │  ├─ Read-only on both repos                     │
│  │  ├─ Auto-deployment only                        │
│  │  ├─ GitHub App (no SSH key)                     │
│  │  └─ Audit logged by GitHub                      │
│  │                                                 │
│  ┌─ Operator Key (Manual Operations)               │
│  │  ├─ For: git push, git pull, urgent fixes       │
│  │  ├─ Write access (controlled)                   │
│  │  ├─ Passphrase protected                        │
│  │  ├─ SSH agent with 1-hour timeout               │
│  │  ├─ Used by: developers, maintainers            │
│  │  └─ Rotated: Quarterly                          │
│  │                                                 │
│  ┌─ Emergency Key (Disaster Recovery)              │
│  │  ├─ Full access (backup only)                   │
│  │  ├─ Stored: Air-gapped, encrypted               │
│  │  ├─ Passphrase: Strong, separate from operator  │
│  │  ├─ Usage: Compromise recovery only             │
│  │  └─ Location: Secure vault (not on server)      │
│  │                                                 │
│  └─ Legacy Key (CURRENT - To Be Phased Out)        │
│     ├─ Status: Active until replacement ready     │
│     ├─ Rotation target: Q2 2026                    │
│     └─ Audit: All deployments logged              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Repository Authentication Matrix (Target)

| Repository | Purpose | Auth Method | Key | Permissions | Audit |
|---|---|---|---|---|---|
| veritable-games-server | Infrastructure | SSH | Operator | R+W | All commits |
| veritable-games-site | Application | SSH | Operator | R+W | All commits |
| veritable-games-server | Auto-deploy | GitHub App | N/A | R | Webhook logs |
| veritable-games-site | Auto-deploy | GitHub App | N/A | R | Webhook logs |

---

## 3. Implementation Plan

### Phase 1: Preparation (Week 1)

**Goal**: Design, document, and get approval before making changes

**Tasks**:
- [ ] Create key rotation schedule and maintenance calendar
- [ ] Document all infrastructure that depends on current key
- [ ] Design audit logging system (which operations log what)
- [ ] Create emergency access procedures
- [ ] Identify all locations where current key is used
- [ ] Create backup/restore procedures

**Deliverables**:
- Dependency map
- Rotation schedule
- Audit specification
- Recovery procedures

### Phase 2: Key Generation (Week 2)

**Goal**: Generate new keys locally, test, document

**Tasks**:
- [ ] Generate Operator Key (ED25519, passphrase-protected)
- [ ] Generate Emergency Key (ED25519, strong passphrase, air-gapped)
- [ ] Store Emergency Key securely (encrypted backup, physical media)
- [ ] Test all keys with sample repositories
- [ ] Verify passphrase entry works smoothly
- [ ] Create key revocation procedures

**Deliverables**:
- New operator key (tested)
- Emergency key (secured)
- Test verification report

**Security Note**: Keys generated in isolated environment, never transmitted in plaintext

### Phase 3: GitHub Configuration (Week 2-3)

**Goal**: Register new keys, verify access

**Tasks**:
- [ ] Register Operator Key on veritable-games-server (R+W)
- [ ] Register Operator Key on veritable-games-site (R+W)
- [ ] Verify GitHub App still works for auto-deploy
- [ ] Update deploy key metadata (service account email, not personal)
- [ ] Document all registered keys per repository
- [ ] Set up GitHub audit logging queries

**Verification**:
```bash
gh repo deploy-key list --repo Veritable-Games/veritable-games-server
gh repo deploy-key list --repo Veritable-Games/veritable-games-site
```

**Deliverables**:
- GitHub deploy keys registered
- Access verification report
- Audit query templates

### Phase 4: SSH Agent & Configuration (Week 3)

**Goal**: Set up SSH agent with timeout, configure git

**Tasks**:
- [ ] Configure SSH agent with 1-hour timeout
- [ ] Create ~/.ssh/config with agent settings
- [ ] Test SSH agent auto-load on shell startup
- [ ] Verify timeout enforcement
- [ ] Document SSH agent management commands
- [ ] Create alert for unloaded keys

**SSH Config Example**:
```bash
# ~/.ssh/config
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519-operator
    IdentitiesOnly yes
    AddKeysToAgent yes
    IgnoreUnknown AddKeysToAgent
```

**Deliverables**:
- SSH configuration
- Agent startup scripts
- Testing results

### Phase 5: Cutover (Week 4)

**Goal**: Switch to new keys, deprecate old key

**Tasks**:
- [ ] Set SSH_AUTH_SOCK environment variable
- [ ] Test git operations with new key
- [ ] Verify Coolify deployments still work (GitHub App)
- [ ] Update CLAUDE.md with new key location
- [ ] Log final commits with old key
- [ ] **Keep old key for 48 hours** (rollback window)
- [ ] Remove old key from GitHub
- [ ] Archive old key securely (backup)

**Testing**:
```bash
# Verify new key works
cd /home/user && git push origin main --dry-run
cd /home/user/projects/veritable-games/site && git push origin main --dry-run

# Verify old key is gone
ssh-add -L | grep old-key  # Should show nothing
```

**Deliverables**:
- Cutover verification report
- Old key backup
- Updated documentation

### Phase 6: Audit & Monitoring (Week 4+)

**Goal**: Set up continuous monitoring and compliance

**Tasks**:
- [ ] Create cron job to verify SSH agent is running
- [ ] Set up daily audit log review (GitHub API)
- [ ] Create alerts for: key age, key compromise, unusual deployments
- [ ] Document audit log analysis procedures
- [ ] Create monthly key audit checklist
- [ ] Set up calendar reminders for quarterly rotation

**Monitoring Script** (Daily):
```bash
#!/bin/bash
# /usr/local/bin/verify-ssh-keys.sh

# Check SSH agent is loaded
if ! ssh-add -L | grep -q "id_ed25519-operator"; then
    echo "ALERT: SSH agent not loaded or operator key missing"
    # Send alert
fi

# Check key age (should be < 90 days)
KEY_AGE=$(ssh-keygen -l -f ~/.ssh/id_ed25519-operator | awk '{print $1}')
if [ $KEY_AGE -gt 90 ]; then
    echo "WARNING: Operator key is $KEY_AGE days old, rotation due in Q2 2026"
    # Send reminder
fi
```

**Deliverables**:
- Monitoring scripts
- Alert configuration
- Audit procedures

---

## 4. Rotation Schedule

### Quarterly Rotation (Every 90 Days)

**Q1 2026 (Feb 24)**: Initial setup (this plan)
**Q2 2026 (May 24)**: First rotation
**Q3 2026 (Aug 24)**: Second rotation
**Q4 2026 (Nov 24)**: Third rotation

**Rotation Process**:
1. Generate new operator key (with passphrase)
2. Register on GitHub (both repos)
3. Test access for 48 hours
4. Switch SSH config to new key
5. Archive old key securely
6. Remove old key from GitHub
7. Document in changelog

**Time Estimate**: 2-3 hours per rotation

---

## 5. Emergency Access Plan

### Compromise Scenario

**If operator key is compromised**:
1. Immediately run `ssh-add -D` (clear agent)
2. Remove old key from GitHub immediately
3. Use Emergency Key from secure backup
4. Rotate all keys (follow rotation process)
5. Audit all deployments made with compromised key
6. Review application logs for unauthorized changes
7. Consider reverting recent deployments

**Emergency Key Usage**:
```bash
# Load emergency key (from air-gapped storage)
ssh-add /path/to/emergency-key

# Verify it works
ssh -T git@github.com

# Make critical push if needed
git push origin main

# Clear agent after use
ssh-add -D
```

**Recovery Time**: < 30 minutes if emergency key readily available

---

## 6. Audit & Compliance

### GitHub Audit Logging

**What to monitor**:
- All deploy key registrations/deletions
- SSH authentication failures
- Unusual push times or volumes
- Commits from unexpected branches

**Query Examples**:
```bash
# List all deploy key events in last 30 days
gh api graphql -f query='
  query {
    repository(owner:"Veritable-Games" name:"veritable-games-server") {
      ref(qualifiedName:"main") {
        target {
          ... on Commit {
            history(first:50) {
              edges {
                node {
                  author { name email date }
                  message
                }
              }
            }
          }
        }
      }
    }
  }
'
```

### Local Audit

**What to log locally**:
- SSH agent startup/shutdown
- Key age and rotation events
- Git operations (git log --all)
- Deployment triggers (Coolify logs)

**Log files**:
- `/var/log/auth.log` - SSH authentication
- `/home/user/.ssh/audit.log` - Key rotation events
- Coolify deployment logs - Auto-deploy events

---

## 7. Rollback Procedures

### If Something Goes Wrong

**Scenario A: New key doesn't work**
```bash
# Revert to old key (48-hour window)
rm ~/.ssh/id_ed25519-operator
cp ~/.ssh/id_ed25519-operator.backup ~/.ssh/id_ed25519-operator

# Re-register old key on GitHub
gh repo deploy-key add ~/.ssh/id_ed25519-operator.pub \
  --repo Veritable-Games/veritable-games-server \
  --title "operator-key" --allow-write

# Test
ssh -T git@github.com
```

**Scenario B: SSH agent not working**
```bash
# Kill agent
ssh-agent -k
unset SSH_AUTH_SOCK

# Restart
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519-operator

# Verify
ssh-add -L
```

**Scenario C: Cannot push to repository**
```bash
# Diagnose
ssh -vvv git@github.com

# Check key permissions
ssh-add -L

# Check GitHub deploy keys
gh repo deploy-key list --repo Veritable-Games/veritable-games-server

# If key expired, use emergency key (temporary)
ssh-add /path/to/emergency-key
git push origin main
```

---

## 8. Documentation Updates

### Files to Update

**After implementation**:
1. `/home/user/CLAUDE.md` - SSH section
   - Reference new key location
   - Update verification commands
   - Add SSH agent setup

2. `/home/user/docs/server/SSH_KEY_SETUP_FEBRUARY_2026.md` - Append
   - New architecture
   - Operator key details
   - Rotation schedule

3. Create new: `/home/user/docs/server/SSH_KEY_ROTATION_PROCEDURE.md`
   - Step-by-step rotation process
   - Checklist
   - Testing procedures

4. Create new: `/home/user/docs/server/EMERGENCY_ACCESS_PROCEDURES.md`
   - How to use emergency key
   - Compromise response
   - Recovery steps

---

## 9. Success Criteria

✅ **Implementation is complete when**:

- [ ] Operator key works for all git operations
- [ ] SSH agent auto-loads on shell startup
- [ ] Passphrase protection verified
- [ ] Emergency key stored securely (air-gapped)
- [ ] Rotation schedule documented and calendared
- [ ] Audit logging configured
- [ ] Both repositories use same authentication method
- [ ] Old key removed from GitHub
- [ ] All documentation updated
- [ ] Team trained on new procedures
- [ ] Monitoring alerts working
- [ ] Zero deployments failed after cutover

---

## 10. Timeline & Owners

| Phase | Duration | Owner | Status |
|-------|----------|-------|--------|
| 1. Preparation | 1 week | Infrastructure | 🟡 PENDING |
| 2. Key Generation | 3-5 days | Security | 🟡 PENDING |
| 3. GitHub Config | 3-5 days | Infrastructure | 🟡 PENDING |
| 4. SSH Agent Setup | 2-3 days | Infrastructure | 🟡 PENDING |
| 5. Cutover | 1 day | Infrastructure | 🟡 PENDING |
| 6. Monitoring | Ongoing | Operations | 🟡 PENDING |

**Total Implementation Time**: 3-4 weeks

---

## 11. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Failed cutover | LOW | HIGH | 48-hour rollback window |
| Key compromise | MEDIUM | CRITICAL | Emergency key, rapid revocation |
| SSH agent failure | LOW | MEDIUM | Monitoring + manual fallback |
| Audit logging gaps | MEDIUM | MEDIUM | Multiple logging sources |
| Key loss | LOW | CRITICAL | Encrypted backups + emergency key |
| Dependency miss | MEDIUM | MEDIUM | Phase 1 dependency mapping |

---

## 12. Future Improvements

**Beyond Phase 6**:

1. **Hardware Security Keys (YubiKey/Titan)**
   - Store keys on physical device
   - Requires physical interaction for deployment
   - Better security posture

2. **Certificate-Based Auth**
   - SSH certificates with short TTLs
   - Better audit trail
   - Easier rotation

3. **Multi-Signature Deployment**
   - Require approval from multiple keys
   - Prevent single-point compromise
   - Compliance requirement

4. **SSH Access Logging**
   - Centralized SSH audit logs
   - Real-time alerting
   - Compliance reporting

5. **Key Escrow System**
   - Automated key generation
   - Secure distribution
   - Rotation automation

---

## Approval & Sign-Off

**This plan requires approval from**:
- [ ] Infrastructure/DevOps lead
- [ ] Security team
- [ ] Project owner (cwcorella)

**Once approved**, implement according to timeline in Section 10.

---

## References

- [GitHub Deploy Keys](https://docs.github.com/en/developers/overview/managing-deploy-keys)
- [SSH Best Practices](https://wiki.mozilla.org/Security/Guidelines/OpenSSH)
- [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [CIS SSH Benchmark](https://www.cisecurity.org/benchmark/ssh/)
- SSH Agent: `man ssh-agent`
- SSH Config: `man ssh_config`

---

**Document Version**: 1.0
**Last Updated**: February 24, 2026
**Next Review**: March 24, 2026 (start of Phase 2)
