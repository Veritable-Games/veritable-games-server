# Coolify Deployment Investigation Session - November 27, 2025

**Date**: November 27, 2025
**Time**: 02:35 UTC - 04:02 UTC
**Duration**: ~1.5 hours
**Server**: veritable-games-server (192.168.1.15)

---

## Initial Problem Report

**User Report**: Deployment failed with error logs showing database connection issues during build.

**Error from logs** (timestamp 02:35:51 UTC):
```
Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
Error occurred prerendering page "/donate"
```

**Deployment UUID**: `z484o0w8okc4osoc8g40gos4`

---

## Investigation Timeline

### Phase 1: Initial Assessment (02:35-03:00 UTC)

**Findings**:
- Error logs were from deployment at 02:35:51 UTC
- Previous session had already resolved this issue at 02:43 UTC by fixing `POSTGRES_URL` environment variable (`is_preview = false`)
- New deployment (`zss00gwwwgc4wg4g40ck0ww4`) completed successfully at 02:44 UTC
- Container status: `healthy`, running commit `a05a4a0`
- **Critical observation**: Website returning HTTP 404 despite healthy container

### Phase 2: Traefik Routing Investigation (03:00-03:15 UTC)

**Container inspection revealed**:
```
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule: Host(``) && PathPrefix(...)
                                                               ^^^^^ EMPTY
```

**Root cause identified**: Corrupted Traefik labels in Coolify database

**Database query**:
```sql
SELECT custom_labels FROM applications WHERE id = 1;
```

**Decoded custom_labels** (base64):
- Found: `Host(\`\`) && PathPrefix(\`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io\`)`
- Expected: `Host(\`www.veritablegames.com\`) && PathPrefix(\`/\`)`
- Also found: `gzip` middleware reference (non-existent)

**Actions taken**:
1. Created correct Traefik labels configuration
2. Base64 encoded new configuration
3. Updated `applications.custom_labels` in Coolify database
4. Triggered new deployment: `ewccwcogg8w8g0ow880gs4cw`

**Observation**: Deployment finished but labels issue persisted (deployment used cached configuration).

### Phase 3: Container Recreation (03:06-03:18 UTC)

**Discovery**: Coolify deployment kept reusing old Traefik labels despite database update.

**Attempts**:
1. Manually recreated container with correct labels
2. Removed `gzip` middleware references (causing errors)
3. Container temporarily worked (HTTP 200)
4. New deployment (`r4sssssw08o84c8s0kww0s8c`) overwrote manual fixes

**Key observation**: Deployments completing in <1 minute (cached builds)

**Critical insight**: User questioned fast deployment times - correctly identified as abnormal (should be 5-10 minutes)

### Phase 4: Next.js Configuration Investigation (03:18-03:30 UTC)

**Documentation review**:
- Read `/home/user/projects/veritable-games/site/CLAUDE.md`
- Read `/home/user/projects/veritable-games/site/docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md`
- Read `frontend/next.config.js`
- Read `frontend/package.json`
- Read `frontend/Dockerfile`

**Critical finding in container logs**:
```
⚠ "next start" does not work with "output: standalone" configuration.
Use "node .next/standalone/server.js" instead.
```

**Configuration mismatch identified**:
- `next.config.js` line 10: `output: 'standalone'`
- `package.json` line 15: `"start": "next start"` ← Incompatible
- `Dockerfile` line 79: `CMD ["node", "server.js"]` ← Correct for standalone

### Phase 5: First Fix Attempt - Change Start Command (03:30-03:35 UTC)

**Git commit**: `1b76657`

**Changes**:
```json
// package.json line 15
- "start": "node scripts/migrations/fix-truncated-password-hashes.js && next start",
+ "start": "node scripts/migrations/fix-truncated-password-hashes.js && node server.js",
```

**Deployment**: `ygco048ko4w0o444sgcss8sg`

**Result**: Container crash-looped
```
Error: Cannot find module '/app/server.js'
```

**Analysis**: `server.js` located in `.next/standalone/` directory, not root.

### Phase 6: Second Fix Attempt - Correct Path (03:35-03:42 UTC)

**Git commit**: `ab389ee`

**Changes**:
```json
// package.json line 15
- "start": "node server.js",
+ "start": "node .next/standalone/server.js",
```

**Deployment**: `vgskwos8swgosos8ksgksocg`

**Container status**: Running but `unhealthy`

**Container logs analysis**:
```
✓ Ready in 163ms
Local:  http://a6e333464a79:3000  ← Container ID, not 0.0.0.0
```

**Problem**: Next.js binding to container hostname instead of `0.0.0.0`, making it inaccessible.

**Port check**: `netstat -tlnp | grep 3000` returned empty (nothing listening)

### Phase 7: Build System Investigation (03:42-03:50 UTC)

**Discovery**: Coolify using **Nixpacks**, not Dockerfile

**Database check**:
```sql
SELECT build_pack, dockerfile_location FROM applications WHERE id = 1;
-- Result: nixpacks, /Dockerfile
```

**Key insight**:
- `output: 'standalone'` mode designed for Dockerfile builds
- Nixpacks doesn't handle standalone mode correctly
- November 2025 deployment used Nixpacks with standard Next.js (no standalone)

### Phase 8: Third Fix Attempt - Switch to Dockerfile (03:50-03:52 UTC)

**Database update**:
```sql
UPDATE applications
SET build_pack = 'dockerfile',
    dockerfile_location = 'frontend/Dockerfile'
WHERE id = 1;
```

**Deployment**: `hgg4sgccsok48okw0ks88kss`

**Result**: Build failed after ~2 minutes

**Analysis**: Dockerfile build path issues with Coolify's build context.

### Phase 9: Final Fix - Revert to Working Configuration (03:52-04:02 UTC)

**Git commit**: `c59ad1d`

**Changes**:
1. Removed `output: 'standalone'` from `next.config.js`
2. Restored `next start` in `package.json`
3. Set Coolify back to Nixpacks

**Rationale**: Match November 2025 working deployment configuration

**Database update**:
```sql
UPDATE applications
SET build_pack = 'nixpacks',
    dockerfile_location = '/Dockerfile'
WHERE id = 1;
```

**Deployment**: `ng4oo84w0oogwcs80kg8k4oc`
- Started: 03:57 UTC
- Duration: ~5 minutes (proper build time)
- Finished: 04:02 UTC

**Final container state**:
- Status: `Up 3 minutes (healthy)`
- Commit: `c59ad1d5ca4149231d9580fac4da49186ba6d35e`
- HTTP response: 200 (redirects to /auth/login)

---

## All Git Commits Made

1. **`1b76657`** - "Fix: Use standalone server.js instead of next start"
   - Changed `package.json` start command
   - Incompatible with file location

2. **`ab389ee`** - "Fix: Correct standalone server.js path"
   - Updated path to `.next/standalone/server.js`
   - Resulted in unhealthy container

3. **`c59ad1d`** - "Revert to standard Next.js output (remove standalone)" ✅
   - Removed `output: 'standalone'` from next.config.js
   - Restored `next start` in package.json
   - **Current production commit**

---

## Database Modifications

### Coolify Database (`coolify-db` container)

**1. Custom Labels Update** (attempted fix, later overwritten):
```sql
UPDATE applications
SET custom_labels = '<base64_encoded_correct_traefik_labels>'
WHERE id = 1;
```

**2. Build Pack Changes**:
```sql
-- Switch to Dockerfile
UPDATE applications SET build_pack = 'dockerfile', dockerfile_location = 'frontend/Dockerfile' WHERE id = 1;

-- Revert to Nixpacks (final)
UPDATE applications SET build_pack = 'nixpacks', dockerfile_location = '/Dockerfile' WHERE id = 1;
```

**3. Environment Variables** (from previous session):
- `POSTGRES_URL`: Changed `is_preview = false` (already completed before this session)

---

## Container Operations

### Containers Inspected

**Primary application container**:
- Name: `m4s0kwo4kc4oooocck4sswc4`
- Image: `m4s0kwo4kc4oooocck4sswc4:<commit_sha>`
- Networks: `coolify`, `veritable-games-network`
- Ports: `0.0.0.0:3000->3000/tcp`

**Database container**:
- Name: `veritable-games-postgres`
- Image: `postgres:15-alpine`
- Purpose: Production PostgreSQL database

**Coolify infrastructure**:
- `coolify` - Main application
- `coolify-db` - PostgreSQL for Coolify data
- `coolify-proxy` - Traefik reverse proxy
- `coolify-redis` - Redis cache
- `coolify-sentinel` - Health monitoring
- `coolify-realtime` - WebSocket server

### Container Recreations

**Manual recreation attempts** (before understanding root cause):
- Recreated `m4s0kwo4kc4oooocck4sswc4` with corrected Traefik labels
- Each subsequent deployment overwrote manual configuration
- Led to discovery that configuration must be in Coolify database

---

## Deployment History

| UUID | Timestamp | Status | Notes |
|------|-----------|--------|-------|
| `z484o0w8okc4osoc8g40gos4` | 02:35:51 | failed | Original error (before session) |
| `zc00oo88wgskos40o4w4ow0w` | 03:09:03 | finished | Fast deployment, 404 errors |
| `ewccwcogg8w8g0ow880gs4cw` | 03:13:05 | finished | After custom_labels update, still 404 |
| `r4sssssw08o84c8s0kww0s8c` | 03:18:30 | finished | Overwrote manual fixes, <1 min |
| `ygco048ko4w0o444sgcss8sg` | 03:24:48 | finished | Commit 1b76657, crash-looped |
| `vgskwos8swgosos8ksgksocg` | 03:34:08 | finished | Commit ab389ee, unhealthy |
| `hgg4sgccsok48okw0ks88kss` | 03:52:48 | failed | Dockerfile build attempt |
| `ng4oo84w0oogwcs80kg8k4oc` | 03:57:00 | finished | Commit c59ad1d, healthy (current) |

---

## Technical Discoveries

### 1. Nixpacks vs Dockerfile Incompatibility

**Finding**: `output: 'standalone'` in Next.js is designed for Dockerfile-based deployments.

**Nixpacks behavior**:
- Auto-detects Node.js and Next.js
- Runs `npm install && npm run build && npm start`
- Does NOT understand standalone output structure
- Expects standard Next.js server

**Standalone mode**:
- Creates `.next/standalone/` directory
- Requires `node .next/standalone/server.js`
- Includes minimal dependencies (optimized for Docker)
- Incompatible with `next start` command

**Resolution**: Use standard Next.js output with Nixpacks OR use Dockerfile exclusively.

### 2. Coolify Custom Labels Corruption

**Observation**: `custom_labels` field in database contained corrupted Traefik configuration.

**Corrupted data**:
```
Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`)
```

**Expected data**:
```
Host(`www.veritablegames.com`) && PathPrefix(`/`)
```

**Cause**: Unknown (possibly from previous configuration attempt or Coolify bug)

**Impact**: Every deployment applied broken routing rules, causing 404 errors despite healthy container.

### 3. Fast Deployments Indicate Build Cache Usage

**Normal deployment**: 5-10 minutes (full npm install + Next.js build)

**Cached deployment**: <1 minute (skip build, reuse Docker image)

**Cache trigger**: Same git commit SHA + same configuration

**Problem**: Cache prevented configuration fixes from taking effect.

**User observation**: Correctly identified fast deployments as abnormal - led to discovering root cause.

### 4. Container Health vs Application Functionality

**Container health check**: `curl -f http://localhost:3000/api/health`

**Observations**:
- Container can be "healthy" but app non-functional
- Health check only verifies process running, not correct configuration
- 404 errors despite healthy status indicated routing/binding issues

### 5. Environment Variable Binding

**Critical environment variables**:
- `HOST=0.0.0.0` - Required for external access
- `HOSTNAME=0.0.0.0` - Next.js binding
- `PORT=3000` - Application port

**Problem encountered**: Container binding to container ID hostname instead of `0.0.0.0`

**Symptom**: Health checks pass internally, but no external connectivity.

---

## Configuration Files Changed

### 1. frontend/package.json

**Line 15 - start script**:

Original (working):
```json
"start": "node scripts/migrations/fix-truncated-password-hashes.js && next start"
```

Attempt 1 (failed):
```json
"start": "node scripts/migrations/fix-truncated-password-hashes.js && node server.js"
```

Attempt 2 (unhealthy):
```json
"start": "node scripts/migrations/fix-truncated-password-hashes.js && node .next/standalone/server.js"
```

**Final (current)**:
```json
"start": "node scripts/migrations/fix-truncated-password-hashes.js && next start"
```

### 2. frontend/next.config.js

**Lines 6-10**:

Before session:
```javascript
// Monorepo configuration
outputFileTracingRoot: require('path').join(__dirname),

// Enable standalone output for Docker deployment
output: 'standalone',
```

**Current**:
```javascript
// Monorepo configuration
outputFileTracingRoot: require('path').join(__dirname),
```

**Removed**: `output: 'standalone'` line entirely

---

## Coolify Configuration State

### Current Settings (Working)

```
Build Pack: nixpacks
Dockerfile Location: /Dockerfile
Base Directory: frontend
Branch: main
Port: 3000
```

### Environment Variables (Verified)

**Critical variables present**:
- `POSTGRES_URL`: `postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games`
- `DATABASE_MODE`: `postgres`
- `NODE_ENV`: `production`
- `HOST`: `0.0.0.0`
- `PORT`: `3000`
- `SESSION_SECRET`: (64-char hex)
- `ENCRYPTION_KEY`: (64-char hex)

**Build-time variables**:
- `POSTGRES_URL` flags: `is_preview=false`, `is_buildtime=true`, `is_runtime=true`

---

## Potential Issues Identified

### 1. Custom Labels Corruption

**Issue**: Database `custom_labels` field contains corrupted Traefik configuration.

**Current state**: Unknown if still corrupted (deployment currently works)

**Recommendation**: Verify and clean `custom_labels` field in database.

**Verification query**:
```sql
SELECT custom_labels FROM applications WHERE id = 1;
```

### 2. Library Document Loading

**User report**: "library isn't loading any documents"

**Possible causes**:
1. Database schema issues (anarchist/library tables)
2. API endpoints not deployed correctly
3. Frontend routing configuration
4. Missing environment variables for library features
5. Database migration not run after deployment

**Not investigated during this session**.

**Recommended investigation**:
```bash
# Check database tables
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt anarchist.*"
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dt library.*"

# Check document count
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM anarchist.documents;"

# Check API endpoint
curl -s https://www.veritablegames.com/api/library/documents | head -50

# Check container logs for errors
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep -i "library\|anarchist\|error"
```

### 3. Deployment Cache Management

**Issue**: Coolify caches Docker images aggressively.

**Impact**: Configuration changes may not take effect if git commit SHA unchanged.

**Workaround**: Manual deployment trigger forces rebuild.

**Recommendation**: Document cache behavior in deployment procedures.

### 4. Missing Architectural Hardening

**Observation**: Multiple deployment issues suggest incomplete production setup.

**Areas not verified**:
1. Database backups automation
2. Health monitoring alerts
3. Log aggregation
4. Performance monitoring
5. Security headers verification
6. SSL certificate auto-renewal
7. Backup restoration procedures

**User concern**: "setup/architectural hardening we may have missed"

### 5. Traefik Middleware Configuration

**Issue**: References to `gzip` middleware that doesn't exist.

**Current state**: Removed from container labels, but may exist in database.

**Impact**: Traefik errors in logs (non-fatal).

**Recommendation**: Create proper middleware or clean references.

---

## Files Created/Modified Summary

### Git Repository Changes

**Modified files** (3 commits):
1. `frontend/package.json` - Start script changes
2. `frontend/next.config.js` - Removed standalone output

**No new files created**.

### Database Changes

**Coolify database** (`coolify` PostgreSQL):
- `applications` table modified (build_pack, dockerfile_location)
- `custom_labels` attempted modification (reverted by deployments)

**No production database changes**.

---

## Current System State (04:02 UTC)

### Application Container

```
Name: m4s0kwo4kc4oooocck4sswc4
Status: Up 3 minutes (healthy)
Image: m4s0kwo4kc4oooocck4sswc4:c59ad1d5ca4149231d9580fac4da49186ba6d35e
Commit: c59ad1d (Revert to standard Next.js output)
Networks: coolify, veritable-games-network
Ports: 0.0.0.0:3000->3000/tcp
Health: Healthy
```

### Website Access

```
https://www.veritablegames.com/ → HTTP 200 (redirects to /auth/login)
http://192.168.1.15:3000/ → HTTP 307 (redirects to HTTPS)
```

### Coolify Configuration

```
Build Pack: nixpacks
Base Directory: frontend
Branch: main
Auto-deploy: Enabled (GitHub webhook)
Deployment time: ~5 minutes (normal)
```

### Database

```
Container: veritable-games-postgres
Status: Healthy
Connection: Verified from application container
```

---

## Recommended Next Steps

### Immediate

1. **Verify library functionality**
   - Check document loading in frontend
   - Verify API endpoints responding
   - Check database table contents

2. **Clean custom_labels corruption**
   - Export current custom_labels
   - Verify Traefik configuration
   - Clean or recreate if corrupted

3. **Document deployment procedures**
   - Update CLAUDE.md with Nixpacks requirements
   - Add troubleshooting section for fast deployments
   - Document cache invalidation procedures

### Short-term

1. **Implement monitoring**
   - Container health alerts
   - Deployment failure notifications
   - Website uptime monitoring

2. **Automate backups**
   - Daily PostgreSQL dumps
   - Configuration backups
   - Verification procedures

3. **Security hardening**
   - Review security headers
   - Verify SSL configuration
   - Audit environment variables

### Long-term

1. **Improve deployment reliability**
   - Consider CI/CD pipeline
   - Automated testing before deployment
   - Rollback procedures

2. **Documentation updates**
   - Architecture diagrams
   - Runbooks for common issues
   - Disaster recovery procedures

---

## Session Artifacts

### Commands Run

**Total commands executed**: ~100+

**Primary tools used**:
- `docker` - Container management and inspection
- `git` - Version control operations
- `coolify` - CLI deployment triggers
- `psql` - Database queries (via docker exec)
- `curl` - HTTP endpoint testing

### Log Files

**Container logs reviewed**:
- `m4s0kwo4kc4oooocck4sswc4` - Application container
- `coolify` - Deployment system
- `coolify-proxy` - Traefik reverse proxy

**Database queries**: ~20 SQL queries to Coolify database

---

## Lessons Learned

1. **Configuration consistency is critical**
   - Mismatched Next.js output mode and start command caused cascade of issues
   - Documentation must specify build system requirements

2. **Build system selection matters**
   - Nixpacks vs Dockerfile have different capabilities
   - Standalone mode requires Dockerfile
   - Can't mix-and-match configurations

3. **Fast deployments are a warning sign**
   - Sub-minute deployments indicate caching
   - May prevent configuration changes from taking effect
   - User correctly identified this as abnormal

4. **Manual container changes are ephemeral**
   - All configuration must be in version control or Coolify database
   - Manual fixes will be overwritten on next deployment

5. **Health checks ≠ functionality**
   - Container can be healthy but application broken
   - Need comprehensive testing beyond health endpoint

---

## Open Questions

1. **Why was `output: 'standalone'` added?**
   - When was it introduced?
   - What was the intended benefit?
   - Was it ever tested with Nixpacks?

2. **Custom labels corruption source**
   - How did Traefik labels become corrupted?
   - Is this a Coolify bug or configuration error?
   - Could it happen again?

3. **Library document loading issue**
   - Is this related to deployment changes?
   - Database migration needed?
   - Frontend or backend issue?

4. **What architectural hardening is missing?**
   - What specific features or configurations?
   - Security, monitoring, backups?
   - Need requirements clarification

---

## Documentation References

**Files consulted during session**:
1. `/home/user/CLAUDE.md` - Server-level guidance
2. `/home/user/projects/veritable-games/site/CLAUDE.md` - Project development guide
3. `/home/user/projects/veritable-games/site/docs/deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md`
4. `/home/user/projects/veritable-games/site/frontend/next.config.js`
5. `/home/user/projects/veritable-games/site/frontend/package.json`
6. `/home/user/projects/veritable-games/site/frontend/Dockerfile`

**External documentation referenced**:
- Next.js standalone output documentation
- Nixpacks documentation
- Coolify deployment documentation

---

## Conclusion

**Session outcome**: Deployment system restored to working state matching November 2025 configuration.

**Key fix**: Reverted `output: 'standalone'` configuration incompatible with Nixpacks build system.

**Current status**:
- Container: Healthy
- Website: Accessible (HTTP 200)
- Deployment: Normal timing (~5 minutes)

**Outstanding issues**:
- Library document loading (reported but not investigated)
- Architectural hardening gaps (to be identified)
- Custom labels corruption (may still exist in database)

**Time to resolution**: ~1.5 hours (including investigation, multiple fix attempts, and documentation review)

---

**Document created**: November 27, 2025 04:02 UTC
**Session end**: November 27, 2025 04:02 UTC
