# Coolify CLI Guide

**Status**: ✅ Configured on both machines (November 13, 2025)

The Coolify CLI provides command-line control over deployments for the Veritable Games platform. Both the server and laptop have the CLI installed and configured.

---

## Configuration

**Installed Location**: `~/.local/bin/coolify` (both machines)
**Coolify Server**: http://192.168.1.15:8000
**Application UUID**: `m4s0kwo4kc4oooocck4sswc4`
**Context Name**: `production`

---

## Essential Commands

### Deployment

```bash
# Trigger immediate deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# Alternative (if context is set)
coolify deploy
```

### Status & Information

```bash
# Check application status
coolify app get m4s0kwo4kc4oooocck4sswc4

# List all resources
coolify resource list

# View environment variables
coolify app env list m4s0kwo4kc4oooocck4sswc4
```

### Context Management

```bash
# List all contexts
coolify context list

# Verify CLI connection
coolify context verify

# Switch context (if multiple configured)
coolify context use production

# Show current context
coolify context current
```

---

## Complete Deployment Workflow

### From Either Machine (Laptop or Server)

```bash
# 1. Navigate to repository
cd ~/Projects/veritable-games-main  # Laptop
# OR
cd ~/veritable-games-site           # Server

# 2. Make your code changes
# ... edit files ...

# 3. Commit and push to GitHub
git add .
git commit -m "your commit message"
git push origin main

# 4. (Optional) Trigger immediate deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
# Note: Auto-deploy may trigger automatically via webhook

# 5. Monitor deployment (wait 2-5 minutes)
coolify app get m4s0kwo4kc4oooocck4sswc4

# 6. Verify deployed commit (on server only)
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

---

## Installation Guide

**If you need to install on a new machine:**

### Step 1: Download and Install

```bash
# Download
cd /tmp
curl -L "https://github.com/coollabsio/coolify-cli/releases/download/v1.0.4/coolify-cli_1.0.4_linux_amd64.tar.gz" -o coolify-cli.tar.gz

# Extract
tar -xzf coolify-cli.tar.gz

# Install to user bin
mkdir -p ~/.local/bin
mv coolify ~/.local/bin/
chmod +x ~/.local/bin/coolify

# Cleanup
rm coolify-cli.tar.gz LICENSE README.md
```

### Step 2: Add to PATH

```bash
# Add to .bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# Reload
source ~/.bashrc

# Verify installation
which coolify
# Should output: /home/user/.local/bin/coolify
```

### Step 3: Configure Context

```bash
# Add production context
coolify context add production http://192.168.1.15:8000 "1|tLPU4pyaVmpCCPG1ZjnydvMqT4M0immHP0yCIlvM87dccbef"

# Set as default
coolify context use production

# Verify connection
coolify context verify
```

---

## API Token

**Token**: `1|tLPU4pyaVmpCCPG1ZjnydvMqT4M0immHP0yCIlvM87dccbef`

**Details**:
- **Created**: November 13, 2025
- **Scope**: Full access to Coolify instance at 192.168.1.15:8000
- **Shared**: Same token used on both laptop and server
- **Location**: Stored in `~/.config/coolify/config.json`

**Regenerating Token** (if compromised):

1. Access Coolify UI: http://192.168.1.15:8000
2. Navigate to: Profile → API Tokens
3. Delete old token
4. Create new token
5. Update on both machines:
   ```bash
   coolify context add production http://192.168.1.15:8000 "NEW_TOKEN" --force
   ```

---

## Advanced Usage

### Environment Variable Management

```bash
# List all environment variables
coolify app env list m4s0kwo4kc4oooocck4sswc4

# Add environment variable (via UI recommended for security)
# Coolify UI → Application → Environment Variables

# Environment variables are stored in PostgreSQL and injected at build time
```

### Monitoring Deployments

```bash
# Get application details (includes deployment status)
coolify app get m4s0kwo4kc4oooocck4sswc4

# Output includes:
# - Current deployment state
# - Build status
# - Container health
# - Last deployment timestamp
```

### Resource Management

```bash
# List all resources across all contexts
coolify resource list

# Filter by type
coolify resource list --type application
coolify resource list --type database
coolify resource list --type service
```

---

## Integration with Dual Machine Workflow

The Coolify CLI integrates seamlessly with the dual-machine development workflow:

### Laptop Workflow

```bash
# 1. Develop locally
npm run dev  # Test changes

# 2. Commit and push
git add .
git commit -m "feat: Add new feature"
git push origin main

# 3. Trigger deployment (optional, auto-deploy may handle)
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# 4. Monitor
coolify app get m4s0kwo4kc4oooocck4sswc4
```

### Server Workflow

```bash
# 1. SSH to server
ssh user@192.168.1.15

# 2. Navigate to repo
cd ~/veritable-games-site

# 3. Make hotfix
git pull
# ... edit files ...
git add .
git commit -m "fix: Critical bug fix"
git push origin main

# 4. Trigger immediate deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4

# 5. Monitor logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 -f
```

---

## Troubleshooting

### "Unauthenticated" error

**Symptoms**: `Error: Unauthenticated` when running commands

**Solution**:

```bash
# Reconfigure context with force flag
coolify context add production http://192.168.1.15:8000 "1|tLPU4pyaVmpCCPG1ZjnydvMqT4M0immHP0yCIlvM87dccbef" --force

# Set as active
coolify context use production

# Verify
coolify context verify
```

---

### CLI not in PATH

**Symptoms**: `command not found: coolify`

**Solution**:

```bash
# Add to current session
export PATH="$HOME/.local/bin:$PATH"

# Add permanently to .bashrc
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
which coolify
```

---

### Connection timeout

**Symptoms**: `Error: timeout waiting for response`

**Possible Causes**:
1. Coolify server is down
2. Network connectivity issues
3. Server is overloaded

**Diagnostic Steps**:

```bash
# 1. Check Coolify is running (on server)
ssh user@192.168.1.15 "docker ps | grep coolify"

# 2. Check network connectivity
ping 192.168.1.15

# 3. Access Coolify UI
curl -I http://192.168.1.15:8000

# 4. Check Coolify logs (on server)
ssh user@192.168.1.15 "docker logs coolify --tail 50"
```

---

### Deployment stuck

**Symptoms**: Deployment shows "In Progress" but never completes

**Solution**:

```bash
# 1. Check deployment logs in Coolify UI
# http://192.168.1.15:8000 → Application → Deployments

# 2. Check build logs (on server)
ssh user@192.168.1.15 "docker ps -a | grep build"

# 3. Cancel stuck deployment (via UI)
# Coolify UI → Application → Cancel Deployment

# 4. Trigger new deployment
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

---

### Invalid UUID error

**Symptoms**: `Error: Invalid UUID`

**Cause**: Application UUID changed or misconfigured

**Solution**:

```bash
# Get current UUID from Coolify UI
# http://192.168.1.15:8000 → Application → Settings

# Or list all resources
coolify resource list

# Current UUID should be: m4s0kwo4kc4oooocck4sswc4
```

---

## Configuration Files

### Context Configuration

**Location**: `~/.config/coolify/config.json`

**Example**:
```json
{
  "contexts": {
    "production": {
      "url": "http://192.168.1.15:8000",
      "token": "1|tLPU4pyaVmpCCPG1ZjnydvMqT4M0immHP0yCIlvM87dccbef"
    }
  },
  "current_context": "production"
}
```

**Backup Configuration**:

```bash
# Backup
cp ~/.config/coolify/config.json ~/.config/coolify/config.json.backup

# Restore
cp ~/.config/coolify/config.json.backup ~/.config/coolify/config.json
```

---

## Quick Reference

### One-Liner Commands

```bash
# Deploy and monitor
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4 && sleep 5 && coolify app get m4s0kwo4kc4oooocck4sswc4

# Check status
coolify context verify && coolify app get m4s0kwo4kc4oooocck4sswc4

# Verify installation
which coolify && coolify --version && coolify context verify
```

### Health Check Script

```bash
#!/bin/bash
# Save as: coolify-health-check.sh

echo "=== Coolify CLI Health Check ==="

echo "1. CLI Installation:"
which coolify && echo "✓ CLI found" || echo "✗ CLI not found"

echo -e "\n2. Context Configuration:"
coolify context list && echo "✓ Context configured" || echo "✗ Context not configured"

echo -e "\n3. Server Connection:"
coolify context verify && echo "✓ Connection OK" || echo "✗ Connection failed"

echo -e "\n4. Application Status:"
coolify app get m4s0kwo4kc4oooocck4sswc4 && echo "✓ App accessible" || echo "✗ App not accessible"

echo -e "\n=== Health Check Complete ==="
```

---

## Related Documentation

- **[DUAL_MACHINE_DEVELOPMENT.md](../guides/DUAL_MACHINE_DEVELOPMENT.md)** - Git workflow and deployment
- **[COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** - Initial setup
- **[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)** - Production operations
- **[DEPLOYMENT_DOCUMENTATION_INDEX.md](./DEPLOYMENT_DOCUMENTATION_INDEX.md)** - All deployment docs

---

**Last Updated**: November 16, 2025
