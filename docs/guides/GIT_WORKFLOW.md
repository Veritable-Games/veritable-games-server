# Git Workflow: Server to GitHub

**Last Updated:** 2025-11-12
**Status:** Manual patch transfer (SSH not working)

---

## Overview

This guide explains how to get code changes from the server (where Claude works) to GitHub (for Coolify deployment).

**Architecture:**
```
Server (192.168.1.15)
  ↓ Make changes, commit locally
  ↓ Create git patch
  ↓
Manual transfer (copy-paste)
  ↓
Laptop (192.168.1.175)
  ↓ Apply patch, push to GitHub
  ↓
GitHub
  ↓ Coolify auto-deploys
  ↓
Production Container
```

---

## Current Workflow: Manual Patch Transfer

### Step 1: Server - Make Changes and Create Patch

**On server (Claude Code):**

1. **Make changes:**
   ```bash
   cd /home/user/veritable-games-migration/frontend
   # Edit files, run migrations, etc.
   ```

2. **Commit changes:**
   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   Your commit message here

   Details:
   - What changed
   - Why it changed

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

3. **Create patch:**
   ```bash
   git format-patch -1 HEAD -o /tmp/
   # Creates: /tmp/0001-your-commit-message.patch
   ```

4. **Display patch:**
   ```bash
   cat /tmp/0001-*.patch
   ```

5. **Tell user:** "Patch ready - please copy the patch content and apply on your laptop"

---

### Step 2: Laptop - Apply Patch and Push

**On laptop (user):**

1. **Navigate to project:**
   ```bash
   cd ~/Projects/veritable-games-main
   ```

2. **Save patch:**
   ```bash
   # Create file
   nano temp-patch.patch

   # Paste the patch content from server
   # Save: Ctrl+O, Enter
   # Exit: Ctrl+X
   ```

3. **Apply patch:**
   ```bash
   git am temp-patch.patch
   ```

4. **Verify:**
   ```bash
   git log -1
   git status
   ```

5. **Push to GitHub:**
   ```bash
   git push
   ```

6. **Clean up:**
   ```bash
   rm temp-patch.patch
   ```

---

### Step 3: Verify Deployment

**On server (Claude Code):**

1. **Wait for Coolify to deploy** (~2-5 minutes)

2. **Check deployed commit:**
   ```bash
   docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
   ```

3. **Compare with local:**
   ```bash
   git log --oneline -1
   ```

4. **Check application logs:**
   ```bash
   docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50
   ```

5. **Test in browser:**
   - Visit https://www.veritablegames.com
   - Verify changes are live

---

## Role Separation

### Server Model (Claude Code) - Responsibilities

**Can do:**
- ✅ Make code changes
- ✅ Edit files in `/home/user/veritable-games-migration/frontend/`
- ✅ Commit to local git repository
- ✅ Create git patches
- ✅ Run database migrations
- ✅ Execute Python scripts
- ✅ Inspect containers
- ✅ Verify deployments

**Cannot do:**
- ❌ Push to GitHub (no credentials)
- ❌ SSH to laptop (SSH not working)
- ❌ Directly trigger Coolify deployments

**Reason:** Server is isolated from GitHub for security. Laptop acts as git gatekeeper.

---

### Remote Model (Laptop) - Responsibilities

**Can do:**
- ✅ Apply git patches
- ✅ Review code changes
- ✅ Commit to git
- ✅ Push to GitHub
- ✅ Trigger Coolify deployments

**Cannot do:**
- ❌ Execute database migrations (no direct database access)
- ❌ Run Python scripts (not on laptop)
- ❌ Inspect production containers (no server access needed)

**Reason:** Laptop has GitHub credentials and acts as code review checkpoint.

---

## Git Patch Format

**Example patch file:**

```patch
From 67d2f57a8b9c1d2e3f4g5h6i7j8k9l0m1n2o3p4q Mon Sep 17 00:00:00 2001
From: christopher@corella.com
Date: Tue, 12 Nov 2025 00:00:00 -0800
Subject: [PATCH] Implement unified tag schema

Details:
- Created shared.tags table
- Migrated library tags
- Added triggers for usage_count

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
---
 scripts/migrations/001-unified-tag-schema.sql | 150 ++++++++++++++++++
 1 file changed, 150 insertions(+)
 create mode 100644 scripts/migrations/001-unified-tag-schema.sql

diff --git a/scripts/migrations/001-unified-tag-schema.sql b/scripts/migrations/001-unified-tag-schema.sql
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/scripts/migrations/001-unified-tag-schema.sql
@@ -0,0 +1,150 @@
+-- Unified Tag Schema Migration
+CREATE SCHEMA IF NOT EXISTS shared;
...
```

---

## Common Issues

### Patch Won't Apply

**Error:** `error: patch failed: ...`

**Cause:** Patch doesn't match current code (diverged)

**Fix:**
```bash
# On laptop, check current state
git status
git log --oneline -5

# On server, check what commit patch is based on
git log --oneline -5

# If diverged, rebase or create new patch
```

### Wrong Commit Author

**Issue:** Commits show wrong author on GitHub

**Fix on server:**
```bash
# Configure git
git config user.name "Your Name"
git config user.email "your@email.com"
```

### Push Rejected

**Error:** `! [rejected] master -> master (non-fast-forward)`

**Cause:** GitHub has commits laptop doesn't have

**Fix on laptop:**
```bash
git pull --rebase
git push
```

---

## Alternative: If SSH Gets Fixed

**If server-to-laptop SSH starts working:**

### Automated Patch Transfer

**On server:**
```bash
# Create patch
git format-patch -1 HEAD -o /tmp/

# Transfer to laptop
scp /tmp/0001-*.patch laptop:~/Projects/veritable-games-main/

# Apply on laptop via SSH
ssh laptop 'cd ~/Projects/veritable-games-main && git am 0001-*.patch && git push'
```

**See:** [SSH_SETUP_TROUBLESHOOTING.md](../operations/SSH_SETUP_TROUBLESHOOTING.md)

---

## Best Practices

**Do:**
- ✅ Create patches frequently (don't batch too many changes)
- ✅ Write clear commit messages
- ✅ Test changes on server before creating patch
- ✅ Verify deployment after push
- ✅ Clean up old patch files

**Don't:**
- ❌ Commit secrets or API keys
- ❌ Include large binary files
- ❌ Skip testing before creating patches
- ❌ Push directly from server (can't - no GitHub access)

---

## Quick Reference

### Server Commands

```bash
# Create patch
cd /home/user/veritable-games-migration/frontend
git format-patch -1 HEAD -o /tmp/

# Display patch
cat /tmp/0001-*.patch

# Create multi-commit patch
git format-patch -3 HEAD -o /tmp/  # Last 3 commits
```

### Laptop Commands

```bash
# Apply patch
cd ~/Projects/veritable-games-main
git am patch.patch

# If patch has conflicts
git am --abort  # Start over
# Or
git am --resolved  # After fixing conflicts

# Push
git push

# View what will be pushed
git log origin/master..HEAD
```

---

## Related Documentation

- **[SSH_SETUP_TROUBLESHOOTING.md](../operations/SSH_SETUP_TROUBLESHOOTING.md)** - Why SSH doesn't work
- **[DEVELOPMENT.md](../DEVELOPMENT.md)** - Development workflow overview
- **[CLAUDE.md](../../CLAUDE.md#role-separation)** - Server vs remote roles
- **[CONTAINER_WORKFLOW.md](CONTAINER_WORKFLOW.md)** - Container best practices

---

**Workflow Status:** Manual patch transfer (working)
**SSH Status:** Not working (see troubleshooting doc)
**Recommendation:** Continue with manual workflow - it's simple and reliable
