# Coolify GitHub API "Not Found" Deployment Failure - December 2025

**Last Updated**: December 29, 2025

## Issue Overview

**Error**: `Deployment failed: GitHub API call failed: Not Found`

**When**: When attempting to deploy from Coolify using GitHub repository

**Repository**: `git@github.com:Veritable-Games/veritable-games-site.git:main`

**Status**: Diagnosing - GitHub API cannot locate or access the specified repository

---

## What This Error Means

When Coolify shows "GitHub API call failed: Not Found" (HTTP 404), it means:

1. Coolify attempted to access the GitHub repository via GitHub's REST API
2. The API responded with "404 Not Found"
3. This can happen for several reasons:
   - Repository doesn't exist at that path
   - Repository is private and Coolify lacks authentication
   - GitHub authentication token is invalid or expired
   - Repository was deleted or renamed
   - Wrong repository organization or name

**Note**: Rate limit is healthy (4996/5000 remaining), so this is NOT a rate limiting issue.

---

## Quick Diagnosis Checklist

**Before calling remote server**, verify locally:

### 1. Verify Repository Name

```bash
# From your local machine
cd /home/user/Projects/veritable-games-main

# Check current repository
git remote -v
# Expected output: origin  https://github.com/Veritable-Games/veritable-games-site.git

# Verify repository exists by checking GitHub
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/Veritable-Games/veritable-games-site
# Should return: {"id": ..., "name": "veritable-games-site", ...}
# If 404: repository doesn't exist or token lacks access
```

### 2. Check Coolify Configuration

**Via Coolify UI** (http://192.168.1.15:8000):
1. Navigate to **Applications → [Your App]**
2. Look at **Source** section
3. Verify:
   - **Repository**: `https://github.com/Veritable-Games/veritable-games-site.git` (correct format)
   - **Branch**: `main`
   - **GitHub Token** is set and hasn't expired

### 3. Check GitHub Authentication on Server

You need SSH access to production server. See "Remote Server Access" section below.

---

## Root Cause Analysis

The "GitHub API Not Found" error has these primary causes:

| Cause | How to Detect | Fix |
|-------|-------------|-----|
| **Repository doesn't exist** | `curl` returns 404 | Verify GitHub repo name is correct |
| **Wrong org/repo name** | Check Coolify configuration | Update to correct repository path |
| **GitHub token invalid** | Try API call without auth | Regenerate GitHub token in Coolify |
| **GitHub token expired** | Token created >1 year ago | Create new personal access token |
| **Insufficient permissions** | Token scope is too limited | Regenerate with `repo` scope |
| **Repository is private** | Token not provided to Coolify | Add valid GitHub token to Coolify |
| **Coolify GitHub integration broken** | Other deployments failing | Restart Coolify or verify connection |

---

## Troubleshooting Steps

### Step 1: Verify GitHub Repository Exists

```bash
# Test if repository is accessible (requires GitHub token)
# Replace YOUR_TOKEN with a valid GitHub personal access token

curl -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/Veritable-Games/veritable-games-site

# Success output:
# {"id": 12345, "name": "veritable-games-site", "full_name": "Veritable-Games/veritable-games-site", ...}

# If you see 404:
# {"message": "Not Found", "documentation_url": "..."}
# → Repository doesn't exist or token lacks access
```

### Step 2: Verify Coolify Configuration

**In Coolify UI** (http://192.168.1.15:8000):

1. **Check Repository URL Format**:
   - **Correct**: `https://github.com/Veritable-Games/veritable-games-site.git`
   - **WRONG**: `git@github.com:Veritable-Games/veritable-games-site.git` (SSH format, Coolify prefers HTTPS)
   - **WRONG**: `git@github.com:Veritable-Games/veritable-games-site.git:main` (branch shouldn't be in URL)

2. **Check GitHub Token**:
   - Go to **Applications → [Your App] → Settings**
   - Look for "GitHub Integration" or "GitHub Token"
   - If missing: See "Setting Up GitHub Token" below

3. **Check Branch**:
   - Branch field should be: `main`
   - NOT in repository URL

### Step 3: Check GitHub Token Status

**On your local machine**:

```bash
# If you have a GitHub token, test it
GITHUB_TOKEN="your_token_here"

# Test token is valid
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# Should show: {"login": "your-username", "id": 12345, ...}

# If 401 Unauthorized:
# → Token is invalid or expired
# → Need to regenerate in GitHub settings

# Check token scopes
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user \
  -v 2>&1 | grep X-OAuth-Scopes

# Should include: "repo" (at minimum)
```

### Step 4: Access Production Server

You need to SSH into the production server to diagnose further. See "Remote Server Access" section.

---

## Remote Server Access Guide

**Server Details**:
- **Host**: 192.168.1.15
- **Port**: 22
- **Access**: Via SSH from laptop (192.168.1.175)
- **Connection**: May require WireGuard tunnel setup

### Network Layout

```
┌─────────────────────────┐
│  Your Laptop            │
│  192.168.1.175          │
│  (wg0: 10.100.0.1)      │
└──────────┬──────────────┘
           │ SSH / WireGuard
           │
┌──────────▼──────────────┐
│  Production Server      │
│  192.168.1.15           │
│  (wg0: 10.100.0.2)      │
│  - Coolify at :8000     │
│  - App at :3000         │
│  - PostgreSQL at :5432  │
└─────────────────────────┘
```

### SSH Access from Laptop

```bash
# Direct access (if on same network)
ssh user@192.168.1.15

# Via WireGuard (if not on same network)
# First verify WireGuard is up
wg show

# Then SSH
ssh user@192.168.1.15

# If permission denied, try with explicit key
ssh -i ~/.ssh/id_rsa user@192.168.1.15
```

### Troubleshoot SSH Connection

```bash
# Test connectivity
ping -c 2 192.168.1.15

# Test SSH port
nc -zv 192.168.1.15 22

# If fails: Check WireGuard status
wg show

# If WireGuard is down, bring it up
sudo wg-quick up wg0

# Verify WireGuard interface
ip addr show wg0
```

---

## On the Production Server

Once you have SSH access:

### 1. Test GitHub Access from Server

```bash
# SSH into server
ssh user@192.168.1.15

# Try to clone the repository (testing GitHub auth)
cd /tmp
git clone https://github.com/Veritable-Games/veritable-games-site.git test-repo

# If successful: GitHub access works
# If fails: Check GitHub credentials or token

# Clean up test
rm -rf test-repo
```

### 2. Check Coolify Container Status

```bash
# List Coolify containers
docker ps | grep coolify

# Check Coolify logs for GitHub errors
docker logs coolify --tail 100 | grep -i "github\|api\|not found"

# Look for:
# - "GitHub API call failed"
# - "Not Found"
# - "401 Unauthorized"
# - "403 Forbidden"
```

### 3. Check Application Container Status

```bash
# Find application container ID (starts with m4s0kwo)
docker ps | grep m4s0kwo

# Check its logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 50

# Check container status
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{.State.Status}}'
```

### 4. Verify Coolify Has GitHub Token

```bash
# Check Coolify database for configured GitHub integration
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT app_id, git_repository FROM applications WHERE app_id IS NOT NULL LIMIT 5;"

# This shows configured repositories
# If your app is missing or has NULL git_repository, that's the issue

# Check GitHub credentials storage
docker exec coolify-db psql -U coolify -d coolify -c \
  "SELECT id, provider FROM git_sources;"

# This shows GitHub integrations configured in Coolify
```

### 5. Test API Access Directly

```bash
# Inside the server, test GitHub API with Coolify's potential token

# First, find any GitHub tokens in Coolify config
docker exec coolify env | grep -i github

# Or check Coolify's Docker volume for config files
docker inspect coolify --format='{{json .Mounts}}' | jq .

# Try API call (if you have token)
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/Veritable-Games/veritable-games-site
```

---

## Fixes by Root Cause

### Fix #1: Repository Name Wrong

**Symptom**: Repository doesn't exist when you test the URL

**On Coolify UI**:
1. Go to **Applications → [Your App] → Source**
2. Update **Repository** field
3. Use format: `https://github.com/Veritable-Games/veritable-games-site.git`
4. Click **Save**
5. Click **Deploy**

### Fix #2: GitHub Token Missing or Invalid

**Symptom**: Token field is empty or curl returns "401 Unauthorized"

**Steps**:

1. **Create New GitHub Token**:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Set scopes:
     - ✅ `repo` (full repository access)
     - ✅ `workflow` (if using GitHub Actions)
   - Create token, copy the value
   - ⚠️ Store it securely (won't be shown again)

2. **Add Token to Coolify**:
   - Go to **Coolify UI** → **Settings** (or **Account**)
   - Look for **GitHub Integration** or **Git Credentials**
   - Add new credential:
     - **Type**: GitHub
     - **Token**: Paste the token
     - **Save**

3. **Update Application**:
   - Go to **Applications → [Your App] → Source**
   - Select the GitHub credential
   - Save
   - Deploy

### Fix #3: GitHub Token Expired

**Symptom**: Token was created long ago; other deployments also failing

**Steps**:
1. Follow steps in Fix #2 to create and add new token
2. Remove old token from Coolify (if possible)
3. Redeploy

### Fix #4: Repository is Private but Token Missing

**Symptom**: Repository exists but Coolify can't access it

**Steps**:
1. Ensure GitHub token is added (Fix #2)
2. Verify token has `repo` scope
3. Ensure token owner has access to the private repository
4. Redeploy

### Fix #5: Coolify Configuration Broken

**Symptom**: Token is valid but deployment still fails; can reproduce with curl

**On Server** (`ssh user@192.168.1.15`):

```bash
# Restart Coolify to clear any cache
docker restart coolify

# Wait 30 seconds for restart
sleep 30

# Try deployment again via UI or CLI
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

---

## Setting Up GitHub Token Properly

If you don't have a GitHub token set up:

### 1. Create Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Fill in:
   - **Token name**: "Coolify Deployment"
   - **Expiration**: 90 days (then you'll need to refresh)
   - **Scopes**:
     - ✅ `repo` (all repository access)
     - ✅ `workflow` (GitHub Actions)
     - ✅ `admin:repo_hook` (webhooks, optional but recommended)
3. Generate and **copy** the token immediately
4. Store safely (password manager, etc.)

### 2. Add to Coolify

1. In **Coolify UI**, look for **Settings** → **GitHub Integration**
2. Click **Add GitHub Account** or **+ New**
3. Paste the token
4. Verify connection (should show ✅)

### 3. Configure Application

1. **Applications** → **[Your App]**
2. **Source** tab:
   - **Git Provider**: Select GitHub
   - **Repository**: `https://github.com/Veritable-Games/veritable-games-site.git`
   - **Branch**: `main`
3. **Save**
4. Click **Deploy**

---

## Verification Steps

After implementing fixes:

### 1. Verify Coolify Deployment

```bash
# Via Coolify UI
# - Watch the deployment progress
# - Should show "Deployment successful" within 2-5 minutes

# Via CLI
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

### 2. Verify Application Health

```bash
# SSH to server
ssh user@192.168.1.15

# Check container is running
docker ps | grep m4s0kwo

# Check health endpoint
docker exec m4s0kwo4kc4oooocck4sswc4 curl http://localhost:3000/api/health

# Expected: {"status":"healthy","database":{"status":"connected"}}
```

### 3. Verify Site Access

```bash
# External test (from your machine)
curl -I https://www.veritablegames.com

# Expected: HTTP 200
# If 502/503: Container may still be starting
# If 404: Traefik routing issue (different problem)

# Direct IP test
curl -I http://192.168.1.15:3000

# Expected: HTTP 200
```

---

## Prevention & Monitoring

### 1. Monitor Token Expiration

Add calendar reminder to refresh GitHub token:
- **When**: 80 days after creation
- **Action**: Generate new token, update Coolify
- **Remove**: Old token from GitHub settings

### 2. Monitor Deployment Status

```bash
# Weekly check
coolify app list | grep -E "status|health"

# Check last deployment
coolify app get m4s0kwo4kc4oooocck4sswc4 | grep -E "deploy|status"
```

### 3. Document Configuration

Keep a private note with:
- GitHub organization name
- Repository name
- Expected branch
- Token owner (whose account)
- Token creation date

---

## Common Scenarios

### Scenario A: Fresh Server Setup

**Situation**: New Coolify installation, first-time deployment

**Steps**:
1. Create GitHub token (follow "Setting Up GitHub Token" section)
2. In Coolify UI, add GitHub credential
3. Add application with:
   - Repository: `https://github.com/Veritable-Games/veritable-games-site.git`
   - Branch: `main`
4. Deploy

### Scenario B: Token Expired After Months

**Situation**: Deployment was working, suddenly fails with "GitHub API Not Found"

**Diagnosis**:
```bash
# Check when token was created
# (Only visible in GitHub account, not via API)

# Test current token in Coolify
curl -H "Authorization: token YOUR_COOLIFY_TOKEN" \
  https://api.github.com/user
# If 401: Token is expired
```

**Fix**:
1. Create new token (see Fix #2)
2. Update Coolify
3. Redeploy

### Scenario C: Wrong Repository Name

**Situation**: Deployment fails immediately with "Not Found", other repos work

**Check**:
```bash
# Test the specific repository
curl https://api.github.com/repos/Veritable-Games/veritable-games-site

# If 404: Repository name is wrong
# Verify correct name in GitHub web interface
```

**Fix**: Update repository URL in Coolify

---

## Escalation Path

**If these steps don't work**:

1. **Verify you can access GitHub from anywhere**:
   ```bash
   # From your machine
   curl -I https://github.com/Veritable-Games/veritable-games-site
   # Should return 200
   ```

2. **Check if GitHub is down**:
   - Visit https://www.githubstatus.com
   - Check for ongoing incidents

3. **Ask GitHub Support**:
   - If repository is private and you suspect access issues
   - Provide GitHub organization name and repository name

4. **Review Coolify Logs in Detail**:
   ```bash
   ssh user@192.168.1.15
   docker logs coolify --tail 500 | grep -C 10 "github"
   ```

5. **Consider Coolify Recreation**:
   - If Coolify integration is severely broken
   - Backup configuration first
   - Restart Coolify service
   - Reconfigure GitHub connection

---

## Related Documentation

- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Full SSH/access guide
- [CLAUDE_SERVER_ACCESS_ROUTING.md](./CLAUDE_SERVER_ACCESS_ROUTING.md) - Network routing details
- [COOLIFY_CLI_GUIDE.md](./COOLIFY_CLI_GUIDE.md) - Coolify command reference
- [TROUBLESHOOTING_QUICKSTART.md](./TROUBLESHOOTING_QUICKSTART.md) - General troubleshooting
- [COOLIFY_ENVIRONMENT_VARIABLES.md](./COOLIFY_ENVIRONMENT_VARIABLES.md) - Environment setup

---

## Quick Reference Commands

```bash
# Test GitHub repository access (local machine)
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/Veritable-Games/veritable-games-site

# SSH to production server
ssh user@192.168.1.15

# On server: Check Coolify logs
docker logs coolify --tail 100 | grep -i github

# On server: Test repository clone
git clone https://github.com/Veritable-Games/veritable-games-site.git /tmp/test-repo

# On server: Restart Coolify
docker restart coolify

# On server: Check application health
docker exec m4s0kwo4kc4oooocck4sswc4 curl http://localhost:3000/api/health

# On server: Deploy via CLI
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4
```

---

**Last Updated**: December 29, 2025
**For**: Veritable Games Production Deployment
**Status**: Active Reference
