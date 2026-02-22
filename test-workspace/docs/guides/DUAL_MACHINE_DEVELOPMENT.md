# Dual Machine Development Guide

**Status**: ✅ Configured (November 13, 2025)

Both the production server (192.168.1.15) and your local laptop (192.168.1.175) can push directly to GitHub, which triggers automatic Coolify deployments.

---

## Architecture Overview

```
Server (192.168.1.15) ──┐
                        ├──> GitHub (main branch) ──> Coolify Auto-Deploy
Laptop (Development) ───┘
```

### Key Points

- ✅ Both machines can commit and push to GitHub
- ✅ Coolify monitors GitHub main branch for changes
- ✅ Deployments trigger automatically on push (polling or webhook)
- ✅ SSH key authentication with passphrase protection
- ⚠️ No merge conflicts if you work on one machine at a time

---

## Machine Configuration

### Laptop (192.168.1.175)

**Repository Location**: `/home/user/Projects/veritable-games-main`
**Hostname**: `remote`
**Git Remote**: `https://github.com/Veritable-Games/veritable-games-site.git` (HTTPS via GitHub CLI)

**SSH Access to Server**:
```bash
ssh user@192.168.1.15
```

**Git Identity** (should be configured):
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Server (192.168.1.15)

**Repository Location**: `/home/user/veritable-games-site`
**Hostname**: `veritable-games-server`
**Git Remote**: `git@github.com:Veritable-Games/veritable-games-site.git` (SSH)

**SSH Access to Laptop**:
```bash
ssh user@192.168.1.175
```

**Git Identity**:
```bash
git config user.name "Veritable Games Server"
git config user.email "christopher@corella.com"
```

**SSH Setup** (server only):
```bash
# SSH agent should be running with key loaded
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519  # Enter passphrase once

# Verify GitHub access
ssh -T git@github.com
# Expected: "Hi Veritable-Games/veritable-games-site!"
```

---

## Standard Workflow

### From Either Machine (Server or Laptop)

```bash
# 1. Pull latest changes (if working from both machines)
git pull origin main

# 2. Make your changes
# ... edit files ...

# 3. Stage and commit
git add [files]
git commit -m "your commit message

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push to GitHub (triggers Coolify deployment)
git push origin main

# 5. Wait 2-5 minutes for Coolify to build and deploy

# 6. Verify deployment (server only)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
# Should show your latest commit hash
```

---

## SSH Agent Persistence

### Server Configuration

**For persistent ssh-agent across terminal sessions**, add to `~/.bashrc`:

```bash
# Start ssh-agent if not running
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)"
    ssh-add ~/.ssh/id_ed25519 2>/dev/null
fi
```

Then reload: `source ~/.bashrc`

### Laptop Configuration

The laptop uses GitHub CLI authentication (HTTPS), so SSH agent configuration is not required for git operations.

---

## Working from Both Machines

### Avoid Merge Conflicts

**Best Practice**: Always pull before starting work

```bash
# ALWAYS pull before starting work
git pull origin main

# Work on your changes
# ... make commits ...

# Push when done
git push origin main
```

### Resolving Merge Conflicts

**If you get merge conflicts**:

```bash
# Pull with rebase to avoid merge commits
git pull --rebase origin main

# Resolve conflicts if any
# 1. Edit conflicted files
# 2. Mark as resolved
git add [resolved-files]
git rebase --continue

# Push
git push origin main
```

**Conflict Resolution Tips**:
- Use a merge tool: `git mergetool`
- Check conflict markers: `<<<<<<<`, `=======`, `>>>>>>>`
- Test thoroughly after resolving conflicts
- Run `npm run type-check` before pushing

---

## Coolify Deployment

### Auto-Deploy Configuration

- **Monitors**: `Veritable-Games/veritable-games-site` (main branch)
- **Build time**: ~3-5 minutes
- **Method**: Webhook (if configured) or polling (every N minutes)
- **Container**: `m4s0kwo4kc4oooocck4sswc4`

### Manual Deployment Trigger

If auto-deploy fails:

1. **Via Coolify UI**:
   - Access Coolify UI: http://192.168.1.15:8000
   - Navigate to application
   - Click "Deploy" button

2. **Via Coolify CLI**:
   ```bash
   coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
   ```

   See [COOLIFY_CLI_GUIDE.md](../deployment/COOLIFY_CLI_GUIDE.md) for complete CLI reference.

---

## Security Notes

### Deploy Key Configuration

- ✅ SSH key with passphrase protection (server)
- ✅ Write access enabled (required for push)
- ✅ Scoped to single repository
- ⚠️ If server compromised, attacker could push to GitHub

### Mitigation Strategies

- Server is behind firewall (local network only)
- SSH key requires passphrase (loaded in ssh-agent)
- GitHub branch protection (can require PR reviews if needed)
- Monitor GitHub push notifications
- Use GitHub CLI authentication on laptop (HTTPS)

---

## Troubleshooting

### Permission denied (publickey)

**Symptoms**: `git@github.com: Permission denied (publickey).`

**Solution** (server only):

```bash
# Check ssh-agent is running
ssh-add -l

# If empty, add key again
ssh-add ~/.ssh/id_ed25519

# Test GitHub connection
ssh -T git@github.com
```

**For laptop**: Ensure GitHub CLI is authenticated:

```bash
gh auth status
# If not logged in:
gh auth login
```

---

### ERROR: The key has been marked as read only

**Symptoms**: `ERROR: The key has been marked as read only`

**Solution**:

1. Go to: https://github.com/Veritable-Games/veritable-games-site/settings/keys
2. Find the deploy key
3. Edit the key and check "Allow write access"
4. Save changes
5. Try pushing again

---

### Push succeeded but no deployment

**Symptoms**: Git push succeeds, but Coolify doesn't deploy

**Diagnostic Steps**:

1. **Check Coolify logs**:
   - Access: http://192.168.1.15:8000
   - Navigate to application → Deployments
   - Check for errors

2. **Verify webhook configuration**:
   - GitHub → Settings → Webhooks
   - Check webhook is active and recent deliveries succeeded

3. **Manual trigger**:
   ```bash
   # Via UI
   # Coolify UI → Deploy button

   # Via CLI
   coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
   ```

4. **Check container status**:
   ```bash
   docker ps | grep m4s0k
   ```

---

### Deployment is behind latest commit

**Symptoms**: Latest code changes not visible in production

**Solution**:

```bash
# Check deployed commit (on server)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT

# Check latest commit
git log -1 --oneline

# If different, trigger manual deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
# OR use Coolify UI
```

---

### Git pull fails with conflicts

**Symptoms**: `error: Your local changes to the following files would be overwritten by merge`

**Solution**:

```bash
# Option 1: Stash changes, pull, reapply
git stash
git pull origin main
git stash pop

# Option 2: Commit changes first
git add .
git commit -m "WIP: Save local changes"
git pull origin main

# Option 3: Discard local changes (CAUTION)
git reset --hard origin/main
```

---

### SSH connection times out

**Symptoms**: `ssh: connect to host github.com port 22: Connection timed out`

**Solution** (server):

```bash
# Check SSH config uses HTTPS fallback
cat ~/.ssh/config

# Add if missing:
# Host github.com
#   Hostname ssh.github.com
#   Port 443
#   User git
```

**Solution** (laptop):

Already uses HTTPS via GitHub CLI - no action needed.

---

## Quick Reference

### Which Machine Am I On?

```bash
hostname && hostname -I | awk '{print $1}'
```

- **Laptop**: `remote` / `192.168.1.175`
- **Server**: `veritable-games-server` / `192.168.1.15`

### Common Commands

```bash
# Check git remote
git remote -v

# Check git status
git status

# View recent commits
git log --oneline -10

# Check if deployment is current (server)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

### Password for Both Machines

**SSH and sudo**: `Atochastertl25!`

---

## Related Documentation

- **[MACHINE_IDENTIFICATION.md](./MACHINE_IDENTIFICATION.md)** - Detailed machine-specific configuration
- **[COOLIFY_CLI_GUIDE.md](../deployment/COOLIFY_CLI_GUIDE.md)** - Coolify CLI commands
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](../deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production operations

---

**Last Updated**: November 16, 2025
