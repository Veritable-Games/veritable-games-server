# SSH Key Setup & Git Access - February 2026

**Last Updated**: February 24, 2026
**Status**: ✅ Operational

## Overview

The production server uses SSH authentication for git operations. This document describes the current setup, how it works, and how to troubleshoot issues.

## Current Configuration

### SSH Key Details

**Key File**: `~/.ssh/id_ed25519`
- **Type**: ED25519 (elliptic curve)
- **Fingerprint**: `SHA256:vVAHBc6oSxZ2RxBPmMt+7mLJ2ipIIVqBZojYwCXFBNY`
- **User**: `christopher@corella.com`
- **Registered**: February 14, 2026

**Public Key**:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGuxVSTFJFIIEpVEx/IcuFlY7dHlqKqp/ZQ13q3m093S christopher@corella.com
```

### Repository Access Matrix

| Repository | Remote URL | Auth Method | Deploy Key | Status |
|---|---|---|---|---|
| `veritable-games-server` | `git@github.com:Veritable-Games/veritable-games-server.git` | SSH | Yes (write access) | ✅ Working |
| `veritable-games-site` | `https://github.com/Veritable-Games/veritable-games-site.git` | HTTPS + gh token | N/A | ✅ Working |

### GitHub Setup

**Deploy Keys Registered**:
- **veritable-games-server**: ID `142959403`
  - Key: `veritable-games-server`
  - Permissions: Read + Write
  - Created: Feb 14, 2026

**GitHub CLI Authentication**:
- **Status**: ✅ Authenticated as `cwcorella-git`
- **Token Scope**: `gist`, `read:org`, `repo`
- **Method**: Cached credentials (Feb 24, 2026)

## How It Works

### Server Repository (SSH)

```bash
cd /home/user
git remote -v
# git@github.com:Veritable-Games/veritable-games-server.git (SSH)

git push origin main
# Uses SSH key → GitHub → Deploy Key validation → Push succeeds ✅
```

**Flow**:
1. Git reads SSH remote URL
2. SSH client loads `~/.ssh/id_ed25519`
3. SSH authenticates to `git@github.com`
4. GitHub validates against registered deploy key
5. Push/pull succeeds with repo permissions

### Site Repository (HTTPS + Token)

```bash
cd /home/user/projects/veritable-games/site
git remote -v
# https://github.com/Veritable-Games/veritable-games-site.git (HTTPS)

git push origin main
# Uses cached gh token → GitHub → Token validation → Push succeeds ✅
```

**Flow**:
1. Git reads HTTPS remote URL
2. Git credential manager provides cached token
3. Token was created via `gh auth login --web=false`
4. GitHub validates token scope (`repo` includes push)
5. Push succeeds

## Verification

### Check SSH Key Access

```bash
# Test SSH authentication to GitHub
ssh -T git@github.com

# Expected output:
# Hi Veritable-Games/veritable-games-server! You've successfully authenticated,
# but GitHub does not provide shell access.
```

### Check gh Authentication

```bash
# Verify gh CLI is authenticated
gh auth status

# Expected output:
# github.com
#   ✓ Logged in to github.com account cwcorella-git
#   - Active account: true
#   - Git operations protocol: ssh
#   - Token: gho_****...
#   - Token scopes: 'gist', 'read:org', 'repo'
```

### Test Push Operations

```bash
# Server repo (SSH)
cd /home/user
git push origin main --dry-run

# Site repo (HTTPS)
cd /home/user/projects/veritable-games/site
git push origin main --dry-run
```

## Deployment Flow

When commits are pushed:

1. **Developer pushes** to GitHub (`git push origin main`)
2. **GitHub webhook** fires (configured via GitHub App)
3. **Coolify** receives deployment notification
4. **Coolify** auto-deploys container with new commit
5. **Application URL** reflects deployment (https://www.veritablegames.com)

**Deployment time**: 2-5 minutes typically

## Troubleshooting

### Issue: SSH Permission Denied

**Symptoms**:
```
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Diagnosis**:
```bash
# Check SSH key is readable
ls -la ~/.ssh/id_ed25519
# Should show: -rw------- (mode 600)

# Check SSH key is working
ssh -vvv git@github.com
# Look for "Authentications that can continue: publickey"
```

**Solution**:
```bash
# Ensure key has correct permissions
chmod 600 ~/.ssh/id_ed25519

# Verify key is registered on GitHub
gh repo deploy-key list --repo Veritable-Games/veritable-games-server

# Test push
git push origin main
```

### Issue: HTTPS Token Expired

**Symptoms**:
```
fatal: Authentication failed for 'https://github.com/...'
```

**Solution**:
```bash
# Re-authenticate gh CLI
gh auth login -h github.com --web=false

# This will display a device code
# Open https://github.com/login/device in browser
# Enter the code when prompted
```

### Issue: Divergent Branch History

**Symptoms**:
```
! [rejected]        main -> main (non-fast-forward)
```

**Solution**:
```bash
# Pull remote changes first
git pull origin main

# Then push
git push origin main
```

## Adding New SSH Keys

To add additional SSH keys for other users:

1. **Generate key** (on server or client):
   ```bash
   ssh-keygen -t ed25519 -C "user@hostname"
   ```

2. **Register on GitHub**:
   ```bash
   gh repo deploy-key add /path/to/key.pub \
     --repo Veritable-Games/veritable-games-server \
     --title "descriptive-name" \
     --allow-write
   ```

3. **Verify**:
   ```bash
   gh repo deploy-key list --repo Veritable-Games/veritable-games-server
   ```

## Key Security Notes

⚠️ **Important**:
- SSH key is stored in `/home/user/.ssh/id_ed25519`
- Key has write access to production repositories
- Keep key private and secure
- Do NOT commit key to any repository
- Do NOT expose in logs or error messages
- Rotate key periodically (consider every 6 months)

## References

- **GitHub Deploy Keys**: https://docs.github.com/en/developers/overview/managing-deploy-keys
- **GitHub CLI Reference**: https://cli.github.com/manual
- **SSH Key Setup**: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

## Related Documentation

- `/home/user/CLAUDE.md` - Server-level instructions (Git workflow section)
- `/home/user/projects/veritable-games/site/CLAUDE.md` - Project-specific guidance
- `/home/user/docs/server/CONTAINER_TO_GIT_AUTOMATION.md` - Deployment automation

---

**Maintenance Log**

| Date | Action | User | Notes |
|---|---|---|---|
| Feb 14, 2026 | SSH key registered | Deploy system | Initial setup |
| Feb 24, 2026 | Verified & documented | Claude | Working configuration confirmed |
