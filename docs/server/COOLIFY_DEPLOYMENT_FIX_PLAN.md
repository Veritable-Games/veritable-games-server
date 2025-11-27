# Coolify Deployment System Fix Plan

**Created**: November 27, 2025
**Status**: Ready for Implementation
**Priority**: P0 - Critical
**Estimated Time**: 45-60 minutes

---

## Executive Summary

The server cleanup/reorganization on November 27, 2025 wiped Coolify's storage directories, resulting in:
- **Lost SSH keys** preventing server connectivity
- **Empty storage directories** breaking deployment pipeline
- **Duplicate environment variables** (minor issue)
- **Incorrect application status** tracking

This plan restores Coolify's deployment capability through SSH key regeneration and storage structure repair.

---

## Root Cause Analysis

### What Happened
1. Server cleanup created `/data/coolify/` directories from scratch (timestamp: Nov 27 01:51)
2. All SSH keys in `/data/coolify/ssh/keys/` were deleted
3. Coolify container couldn't SSH to localhost (host.docker.internal)
4. Deployments fail with "Server is not functional"

### Why It Broke
- Coolify stores SSH keys on host filesystem: `/data/coolify/ssh/keys/`
- These keys are bind-mounted into container: `/var/www/html/storage/app/ssh/keys/`
- Without keys, Coolify cannot execute deployment commands on localhost
- The private_key in database is encrypted, separate from actual SSH key files

### Current State
✅ **Working**:
- Website accessible (manual container fix)
- Coolify UI operational
- Database intact with configuration
- Environment variables preserved
- Traefik routing restored

❌ **Broken**:
- SSH connectivity: Coolify → localhost
- Deployment pipeline (CLI & auto-deploy)
- GitHub webhook deployments

---

## Fix Plan Overview

### Phase 1: SSH Key Infrastructure (Critical)
1. Generate new SSH key pair for Coolify → localhost
2. Install public key in host authorized_keys
3. Store private key in Coolify's expected location
4. Set correct ownership and permissions
5. Test SSH connectivity

### Phase 2: Server Configuration Update
1. Verify server user configuration (root vs user)
2. Update Coolify database if needed
3. Clear validation errors

### Phase 3: Storage Directory Permissions
1. Fix ownership on mounted directories
2. Verify Coolify can write to storage

### Phase 4: Environment Variable Cleanup (Optional)
1. Remove duplicate environment variables
2. Optimize for single instance per key

### Phase 5: Deployment Testing
1. Test manual deployment via CLI
2. Verify auto-deploy from GitHub
3. Monitor deployment logs

---

## Detailed Fix Procedures

### Phase 1: SSH Key Infrastructure

**Objective**: Restore Coolify's ability to SSH to localhost

#### Step 1.1: Generate SSH Key Pair

```bash
# Navigate to Coolify SSH keys directory
cd /data/coolify/ssh/keys

# Generate new ed25519 key (Coolify default)
sudo ssh-keygen -t ed25519 -f ./id.root@host.docker.internal -N "" -C "coolify-localhost"

# Verify key generation
ls -la /data/coolify/ssh/keys/
# Expected: id.root@host.docker.internal and id.root@host.docker.internal.pub
```

**Expected Output**:
```
Generating public/private ed25519 key pair.
Your identification has been saved in ./id.root@host.docker.internal
Your public key has been saved in ./id.root@host.docker.internal.pub
```

#### Step 1.2: Install Public Key on Host

```bash
# Add Coolify's public key to root's authorized_keys
sudo mkdir -p /root/.ssh
sudo chmod 700 /root/.ssh
sudo cat /data/coolify/ssh/keys/id.root@host.docker.internal.pub | sudo tee -a /root/.ssh/authorized_keys
sudo chmod 600 /root/.ssh/authorized_keys

# Verify key installed
sudo grep "coolify-localhost" /root/.ssh/authorized_keys
```

**Expected Output**: Should show the public key with comment "coolify-localhost"

#### Step 1.3: Set Correct Permissions

```bash
# Fix ownership - Coolify container runs as root, but files should be readable
sudo chown root:root /data/coolify/ssh/keys/*
sudo chmod 600 /data/coolify/ssh/keys/id.root@host.docker.internal
sudo chmod 644 /data/coolify/ssh/keys/id.root@host.docker.internal.pub

# Verify permissions
ls -la /data/coolify/ssh/keys/
```

**Expected Output**:
```
-rw------- 1 root root [size] [date] id.root@host.docker.internal
-rw-r--r-- 1 root root [size] [date] id.root@host.docker.internal.pub
```

#### Step 1.4: Test SSH Connectivity from Coolify Container

```bash
# Test SSH from Coolify container to host
docker exec coolify sh -c "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /var/www/html/storage/app/ssh/keys/id.root@host.docker.internal root@host.docker.internal 'echo SSH_SUCCESS'"
```

**Expected Output**: `SSH_SUCCESS`

**If it fails**:
```bash
# Check if key is visible in container
docker exec coolify ls -la /var/www/html/storage/app/ssh/keys/

# Check SSH service is running on host
sudo systemctl status ssh

# Test connectivity
docker exec coolify sh -c "ping -c 3 host.docker.internal"
```

---

### Phase 2: Server Configuration Update

**Objective**: Ensure Coolify database has correct server configuration

#### Step 2.1: Verify Current Server Configuration

```bash
docker exec coolify-db psql -U coolify -d coolify -c "SELECT id, name, ip, port, \"user\", private_key_id FROM servers WHERE id = 0;"
```

**Current State**:
- User: root
- IP: host.docker.internal
- Port: 22
- Private Key ID: 0

#### Step 2.2: Update Server Configuration (if needed)

**Option A**: If SSH test in 1.4 succeeded with `root@host.docker.internal`:
```bash
# No change needed - configuration is correct
echo "Server configuration verified"
```

**Option B**: If you prefer to use `user` account instead of `root`:
```bash
# Update server user to 'user'
docker exec coolify-db psql -U coolify -d coolify -c "UPDATE servers SET \"user\" = 'user' WHERE id = 0;"

# Update authorized_keys for user account
sudo mkdir -p /home/user/.ssh
sudo chmod 700 /home/user/.ssh
sudo cat /data/coolify/ssh/keys/id.root@host.docker.internal.pub | sudo tee -a /home/user/.ssh/authorized_keys
sudo chown -R user:user /home/user/.ssh
sudo chmod 600 /home/user/.ssh/authorized_keys

# Rename the key file to match new user
cd /data/coolify/ssh/keys
sudo mv id.root@host.docker.internal id.user@host.docker.internal
sudo mv id.root@host.docker.internal.pub id.user@host.docker.internal.pub

# Test with new user
docker exec coolify sh -c "ssh -o StrictHostKeyChecking=no -i /var/www/html/storage/app/ssh/keys/id.user@host.docker.internal user@host.docker.internal 'echo SSH_SUCCESS'"
```

**Recommendation**: Use `root` to match Coolify defaults unless you have security requirements.

#### Step 2.3: Clear Server Validation Errors

```bash
# Clear validation logs
docker exec coolify-db psql -U coolify -d coolify -c "UPDATE servers SET validation_logs = NULL, unreachable_count = 0, is_validating = false WHERE id = 0;"

# Verify
docker exec coolify-db psql -U coolify -d coolify -c "SELECT id, name, unreachable_count, validation_logs FROM servers WHERE id = 0;"
```

---

### Phase 3: Storage Directory Permissions

**Objective**: Fix ownership on bind-mounted directories

#### Step 3.1: Check Current Ownership

```bash
# Check ownership of all Coolify storage
sudo ls -la /data/coolify/
```

**Current State**: All directories owned by `root:root`

#### Step 3.2: Determine Correct Ownership

```bash
# Check what user Coolify container runs as
docker exec coolify id

# Check storage/app ownership inside container
docker exec coolify ls -la /var/www/html/storage/app/
```

**Expected**: Container runs as `root`, but Laravel expects `www-data:www-data` for some directories

#### Step 3.3: Fix Permissions Selectively

```bash
# SSH keys must remain root-owned (security)
# Other directories can be www-data for Laravel

# Leave these as root:root (security-sensitive)
# - /data/coolify/ssh/

# These can be www-data:www-data (application storage)
# But since bind-mounted from root, keep as root with appropriate permissions
sudo chmod 755 /data/coolify/applications
sudo chmod 755 /data/coolify/backups
sudo chmod 755 /data/coolify/databases
sudo chmod 755 /data/coolify/services
sudo chmod 755 /data/coolify/webhooks-during-maintenance

# Verify
ls -la /data/coolify/
```

**Note**: Coolify handles permissions inside container. Host directories should be readable by container's root user.

---

### Phase 4: Environment Variable Cleanup (Optional)

**Objective**: Remove duplicate environment variables

#### Step 4.1: Identify Duplicates

```bash
docker exec coolify-db psql -U coolify -d coolify -c "
SELECT key, COUNT(*) as count, array_agg(id) as ids
FROM environment_variables
WHERE resourceable_type = 'App\\Models\\Application' AND resourceable_id = 1
GROUP BY key
HAVING COUNT(*) > 1
ORDER BY key;"
```

**Current Duplicates**:
- POSTGRES_URL (IDs: 110, 111)
- STRIPE_SECRET_KEY (IDs: 121, 122)
- NIXPACKS_APT_PKGS (IDs: 13, 14)
- Others...

#### Step 4.2: Remove Duplicates (Keep Higher ID = Newer)

```bash
# Remove older duplicate env vars (keep higher ID numbers)
docker exec coolify-db psql -U coolify -d coolify -c "
DELETE FROM environment_variables
WHERE id IN (
    SELECT MIN(id)
    FROM environment_variables
    WHERE resourceable_type = 'App\\Models\\Application' AND resourceable_id = 1
    GROUP BY key
    HAVING COUNT(*) > 1
);"

# Verify cleanup
docker exec coolify-db psql -U coolify -d coolify -c "
SELECT key, COUNT(*) as count
FROM environment_variables
WHERE resourceable_type = 'App\\Models\\Application' AND resourceable_id = 1
GROUP BY key
HAVING COUNT(*) > 1;"
```

**Expected Output**: (0 rows) - No more duplicates

---

### Phase 5: Deployment Testing

**Objective**: Verify deployment pipeline works end-to-end

#### Step 5.1: Test Manual Deployment

```bash
# Test Coolify CLI deployment
coolify deploy uuid m4s0kwo4kc4oooocck4sswc4

# Monitor deployment
watch -n 2 'docker ps -a --filter "name=m4s0kwo4kc4oooocck4sswc4"'
```

**Expected Behavior**:
1. Deployment queued successfully
2. Build container created
3. SSH connection to localhost succeeds
4. Code pulled from GitHub
5. Build completes
6. Container recreated with proper labels
7. Deployment status: finished

#### Step 5.2: Check Deployment Logs

```bash
# Get latest deployment UUID
DEPLOYMENT_UUID=$(docker exec coolify-db psql -U coolify -d coolify -t -c "SELECT deployment_uuid FROM application_deployment_queues ORDER BY created_at DESC LIMIT 1;" | xargs)

# Check deployment status
docker exec coolify-db psql -U coolify -d coolify -c "SELECT deployment_uuid, status, logs FROM application_deployment_queues WHERE deployment_uuid = '$DEPLOYMENT_UUID';"
```

**Success Indicators**:
- Status: `finished` (not `failed`)
- Logs contain: "Deployment successful"
- No SSH errors in logs

#### Step 5.3: Verify Application Container

```bash
# Check container is running
docker ps --filter "name=m4s0kwo4kc4oooocck4sswc4"

# Check Traefik labels are correct
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{json .Config.Labels}}' | jq -r 'to_entries[] | select(.key | startswith("traefik.http.routers")) | "\(.key)=\(.value)"'

# Test website
curl -I https://www.veritablegames.com
```

**Expected**:
- Container running and healthy
- Traefik labels include: `Host(\`www.veritablegames.com\`)`
- HTTP/2 307 redirect to /auth/login

#### Step 5.4: Test Auto-Deploy from GitHub

```bash
# Make a small commit to trigger webhook
cd /home/user/projects/veritable-games/site
echo "# Test deployment $(date)" >> .test-deploy
git add .test-deploy
git commit -m "Test: Verify auto-deployment working"
git push origin main

# Wait 2-5 minutes and check deployment
sleep 120
docker exec coolify-db psql -U coolify -d coolify -c "SELECT deployment_uuid, status, created_at FROM application_deployment_queues ORDER BY created_at DESC LIMIT 3;"
```

**Success**: New deployment triggered automatically, status = finished

---

## Verification Checklist

After completing all phases, verify:

- [ ] SSH: `docker exec coolify sh -c "ssh root@host.docker.internal echo OK"` returns "OK"
- [ ] Deployments: `coolify deploy uuid m4s0kwo4kc4oooocck4sswc4` succeeds
- [ ] Logs: No "Server is not functional" errors
- [ ] Container: Application container running with correct labels
- [ ] Website: https://www.veritablegames.com accessible
- [ ] Auto-deploy: Git push triggers deployment
- [ ] Database: Application status = "running:healthy"

---

## Rollback Procedures

### If SSH Setup Fails

```bash
# Remove broken keys
sudo rm -f /data/coolify/ssh/keys/*

# Remove from authorized_keys
sudo sed -i '/coolify-localhost/d' /root/.ssh/authorized_keys
sudo sed -i '/coolify-localhost/d' /home/user/.ssh/authorized_keys

# Website continues working (manual container still running)
# Retry fix from Step 1.1
```

### If Deployment Breaks Application

```bash
# Check if website is still accessible
curl -I https://www.veritablegames.com

# If down, recreate manual container (from emergency fix)
docker stop m4s0kwo4kc4oooocck4sswc4 && docker rm m4s0kwo4kc4oooocck4sswc4

docker run -d \
  --name m4s0kwo4kc4oooocck4sswc4 \
  --network coolify \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e DATABASE_MODE=postgres \
  -e POSTGRES_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games" \
  -e NEXT_PUBLIC_SITE_URL="https://www.veritablegames.com" \
  -l "traefik.enable=true" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.rule=Host(\`www.veritablegames.com\`) || Host(\`veritablegames.com\`)" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.entryPoints=https" \
  -l "traefik.http.routers.https-0-m4s0kwo4kc4oooocck4sswc4.tls=true" \
  -l "traefik.http.services.http-0-m4s0kwo4kc4oooocck4sswc4.loadbalancer.server.port=3000" \
  m4s0kwo4kc4oooocck4sswc4:f1d6c017b608e9033132dd83888a89fca288bdae
```

### If Database Corruption

```bash
# Restore application status
docker exec coolify-db psql -U coolify -d coolify -c "UPDATE applications SET status = 'running:healthy' WHERE id = 1;"

# Restore server config
docker exec coolify-db psql -U coolify -d coolify -c "UPDATE servers SET validation_logs = NULL, unreachable_count = 0 WHERE id = 0;"
```

---

## Post-Fix Validation

### Success Criteria

1. **Deployment Pipeline**: `coolify deploy uuid m4s0kwo4kc4oooocck4sswc4` completes successfully
2. **Auto-Deploy**: Git push triggers automatic deployment
3. **Website Stability**: No downtime during deployment
4. **Traefik Labels**: Automatically generated correctly
5. **Container Health**: Marked as "healthy" in Coolify database

### Performance Metrics

- **Deployment Time**: 2-5 minutes (build + deploy)
- **Downtime**: <30 seconds (container swap)
- **Success Rate**: Should be 100% for clean deployments

---

## Prevention Measures

### 1. Backup SSH Keys

```bash
# Create backup script
cat > /home/user/backups/scripts/backup-coolify-ssh.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/home/user/backups/coolify-ssh
mkdir -p "$BACKUP_DIR"
tar czf "$BACKUP_DIR/ssh-keys-$(date +%Y%m%d-%H%M%S).tar.gz" \
    /data/coolify/ssh/keys/ \
    /root/.ssh/authorized_keys \
    /home/user/.ssh/authorized_keys
echo "Coolify SSH keys backed up to $BACKUP_DIR"
EOF

chmod +x /home/user/backups/scripts/backup-coolify-ssh.sh

# Run weekly via cron
(crontab -l 2>/dev/null; echo "0 3 * * 0 /home/user/backups/scripts/backup-coolify-ssh.sh") | crontab -
```

### 2. Monitor Coolify Health

```bash
# Add to existing health check script
cat >> /home/user/wireguard-backups/coolify-diagnostic.sh << 'EOF'

# Check SSH keys exist
if [ ! -f /data/coolify/ssh/keys/id.root@host.docker.internal ]; then
    echo "❌ ERROR: Coolify SSH keys missing!"
    exit 1
fi

# Test SSH connectivity
if ! docker exec coolify sh -c "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@host.docker.internal echo OK" 2>/dev/null | grep -q OK; then
    echo "❌ ERROR: Coolify cannot SSH to localhost!"
    exit 1
fi

echo "✅ Coolify SSH connectivity OK"
EOF
```

### 3. Document Known-Good State

```bash
# Capture current configuration
cat > /home/user/docs/server/COOLIFY_BASELINE_CONFIG.md << 'EOF'
# Coolify Known-Good Configuration
**Date**: $(date)

## SSH Keys
- Location: /data/coolify/ssh/keys/
- Private Key: id.root@host.docker.internal
- Public Key: id.root@host.docker.internal.pub
- Authorized in: /root/.ssh/authorized_keys

## Server Configuration
- ID: 0
- User: root
- IP: host.docker.internal
- Port: 22
- Private Key ID: 0

## Application
- ID: 1
- Name: veritable-games
- UUID: m4s0kwo4kc4oooocck4sswc4
- FQDN: www.veritablegames.com
- Status: running:healthy
EOF
```

---

## Notes

- **Current Workaround**: Manual container creation is TEMPORARY
- **Deployment Required**: Must restore Coolify pipeline for sustainable operations
- **GitHub Auto-Deploy**: Currently broken, will be restored after fix
- **Environment Variables**: Duplicates are safe to remove but not critical
- **Application Status**: Already updated to "running:healthy"

---

## Timeline

**Estimated Implementation Time**: 45-60 minutes

| Phase | Task | Time | Difficulty |
|-------|------|------|------------|
| 1 | SSH Key Infrastructure | 20 min | Medium |
| 2 | Server Configuration | 10 min | Easy |
| 3 | Storage Permissions | 5 min | Easy |
| 4 | Env Var Cleanup (Optional) | 5 min | Easy |
| 5 | Deployment Testing | 15 min | Medium |

**Dependencies**: None - can start immediately

**Risk Level**: Low (rollback procedures available, website remains operational)

---

## Success Indicators

When fix is complete, you should be able to:
1. ✅ Run `coolify deploy uuid m4s0kwo4kc4oooocck4sswc4` without errors
2. ✅ Push to GitHub and see automatic deployment
3. ✅ See proper Traefik labels on deployed containers
4. ✅ Check Coolify UI and see "healthy" status

## Next Steps After Fix

1. Complete investigation Phases 2-5 (file system analysis, Traefik audit, risk assessment)
2. Review and improve backup strategies
3. Document cleanup procedures to prevent future issues
4. Consider Coolify upgrade to latest version
