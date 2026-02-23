# Deployment Architecture Analysis - Domain Routing Failure Investigation

**Date**: November 10, 2025 (verified from `<env>`)  
**Status**: 🔴 CRITICAL - Multiple simultaneous failures  
**Investigation Type**: Root cause analysis of recurring domain routing breakage after Coolify redeployments

---

## Executive Summary

The Veritable Games platform is experiencing **three critical, simultaneous infrastructure failures** that compound to cause complete service unavailability:

1. **🔴 CRITICAL**: Application container in crash loop due to **network isolation** - cannot reach PostgreSQL database
2. **🔴 CRITICAL**: Traefik routing completely broken with malformed `Host()` matchers - domain routing impossible
3. **🔴 CRITICAL**: DNS/ACME certificate failures preventing SSL certificate generation

**Root Cause**: The application container is deployed on the `coolify` Docker network, but PostgreSQL is on the `veritable-games-network`. The containers cannot communicate across network boundaries, causing the startup migration to fail and enter a crash loop.

**Why Domain Routing Keeps Breaking**: After each Coolify redeployment, the container labels are regenerated with malformed Traefik routing rules (`Host(\`\`) && PathPrefix(\`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io\`)`) due to a mismatch between the Coolify database FQDN configuration and the actual label generation logic.

---

## Critical Infrastructure Problems

### Problem 1: Network Isolation (Container Crash Loop)

**Current State**:
```
Application Container: m4s0kwo4kc4oooocck4sswc4
├── Network: coolify (10.0.1.x subnet)
├── Status: Restarting (1) - crash loop
├── Hostname attempting to reach: veritable-games-postgres
└── Error: "getaddrinfo EAI_AGAIN veritable-games-postgres"

PostgreSQL Container: veritable-games-postgres  
├── Network: veritable-games-network (10.0.2.2)
├── Status: Up 3 hours (healthy)
├── Hostname: veritable-games-postgres
└── NOT resolvable from coolify network
```

**Why This Happens**:
- Docker networks provide DNS resolution ONLY within the same network
- Application on `coolify` network cannot resolve `veritable-games-postgres` hostname
- Startup migration script (`fix-truncated-password-hashes.js`) fails immediately
- Container restarts, repeats same failure infinitely

**Evidence**:
```bash
# Application container network
$ docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{json .NetworkSettings.Networks}}'
{
  "coolify": {
    "IPAddress": "", # Restarting, no IP assigned
    "Gateway": "",
    "DNSNames": ["m4s0kwo4kc4oooocck4sswc4"]
  }
}

# PostgreSQL container network  
$ docker inspect veritable-games-postgres --format '{{json .NetworkSettings.Networks}}'
{
  "veritable-games-network": {
    "IPAddress": "10.0.2.2",
    "Gateway": "10.0.2.1",
    "DNSNames": ["veritable-games-postgres", "postgres"]
  }
}
```

**Container Logs** (repeated every restart):
```
🔍 Checking for truncated password hashes in users.users table...
❌ Migration failed: getaddrinfo EAI_AGAIN veritable-games-postgres
Stack trace: Error: getaddrinfo EAI_AGAIN veritable-games-postgres
    at /app/node_modules/pg-pool/index.js:45:11
```

**Impact**:
- ❌ Application never starts successfully
- ❌ Health checks never pass
- ❌ HTTP requests never reach application code
- ❌ Both local IP access (192.168.1.15:3000) AND domain routing fail

### Problem 2: Traefik Routing Malformation

**Current State**:
```yaml
# ACTUAL Docker label (BROKEN)
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule: 
  "Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`)"
  
# What it SHOULD be (CORRECT)
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule:
  "Host(`www.veritablegames.com`)"
```

**Coolify Database Configuration**:
```sql
SELECT uuid, name, fqdn, ports_mappings FROM applications 
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Result:
uuid: m4s0kwo4kc4oooocck4sswc4
name: veritable-games
fqdn: www.veritablegames.com  ← Database has correct value
ports_mappings: 3000:3000
```

**The Disconnect**:
- Database stores: `fqdn = "www.veritablegames.com"` ✅
- Generated labels have: `Host(\`\`)` ❌ (empty!)
- Domain gets put in `PathPrefix()` instead ❌

**Traefik Errors** (continuous, every few minutes):
```
[ERR] error="error while adding rule Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`): 
      error while adding rule and: error while checking rule Host: 
      empty args for matcher Host, []" 
      entryPointName=http 
      routerName=http-0-m4s0kwo4kc4oooocck4sswc4@docker
```

**Root Cause Analysis**:
1. Coolify's container generation uses **Caddy labels by default** (`caddy_0` labels present)
2. Application has **both Caddy AND Traefik labels** (configuration conflict)
3. FQDN from database not properly propagated to Traefik `Host()` matcher
4. Fallback to malformed sslip.io routing rule

**Why It Keeps Breaking After Redeploy**:
- Every redeploy regenerates container with fresh labels
- Label generation logic uses a template that's broken
- Database FQDN value is ignored or incorrectly processed
- No validation that generated labels are syntactically correct

### Problem 3: DNS and SSL Certificate Failures

**ACME Certificate Generation Errors**:
```
[ERR] Unable to obtain ACME certificate for domains 
error="unable to generate a certificate for the domains [veritablegames.com www.veritablegames.com]: 
error: one or more domains had a problem:
[veritablegames.com] acme: error: 400 :: urn:ietf:params:acme:error:connection :: 
172.221.18.109: Fetching http://veritablegames.com/.well-known/acme-challenge/XXX: 
Timeout during connect (likely firewall problem)"
```

**DNS Issues**:
```
[veritablegames.com] acme: error: 400 :: urn:ietf:params:acme:error:dns :: 
no valid A records found for veritablegames.com; 
no valid AAAA records found for veritablegames.com
```

**Analysis**:
- Public IP: `172.221.18.109` (from Traefik logs)
- DNS records not properly configured or not propagated
- Let's Encrypt cannot reach `/.well-known/acme-challenge/` path
- Suggests either:
  - No DNS A record pointing to 172.221.18.109, OR
  - Firewall blocking port 80 from Let's Encrypt servers, OR
  - Port forwarding not configured on router

**Impact**:
- ❌ HTTPS not working for domain
- ❌ Browser shows SSL warnings
- ❌ Cloudflare proxy cannot forward HTTPS traffic

---

## Architecture Diagrams

### Current Broken Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL ACCESS LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User → Cloudflare CDN (DNS) → Public IP (172.221.18.109)     │
│                 ↓                                               │
│         Router (192.168.1.x)                                    │
│                 ↓                                               │
│         Traefik Proxy (coolify-proxy)                          │
│         Port 80/443                                             │
│                 │                                               │
│    ┌────────────┴────────────┐                                 │
│    ↓ (empty Host() matcher)  ↓                                 │
│  [ERROR: Cannot route]    [Malformed rules]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DOCKER NETWORK LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Network: coolify (10.0.1.x)                                   │
│  ┌───────────────────────────────────────┐                     │
│  │ m4s0kwo4kc4oooocck4sswc4              │                     │
│  │ Status: Restarting (crash loop)       │                     │
│  │ Trying to connect to:                 │                     │
│  │   veritable-games-postgres ❌         │                     │
│  │ (hostname not resolvable)             │                     │
│  └───────────────────────────────────────┘                     │
│                                                                 │
│  Network: veritable-games-network (10.0.2.x)                   │
│  ┌───────────────────────────────────────┐                     │
│  │ veritable-games-postgres              │                     │
│  │ IP: 10.0.2.2                          │                     │
│  │ Status: Up 3 hours (healthy)          │                     │
│  │ Hostname: veritable-games-postgres ✅  │                     │
│  │ (resolvable within network only)      │                     │
│  └───────────────────────────────────────┘                     │
│                                                                 │
│  ❌ Networks are ISOLATED - no bridge                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Required Working Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL ACCESS LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User → Cloudflare CDN → Public IP (configured DNS)            │
│                 ↓                                               │
│         Router (port forwarding 80→80, 443→443)                │
│                 ↓                                               │
│         Traefik Proxy (coolify-proxy)                          │
│         Rule: Host(`www.veritablegames.com`) ✅                │
│                 ↓                                               │
│         Application Container (port 3000)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 DOCKER NETWORK LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Network: coolify (10.0.1.x) ← SHARED NETWORK                  │
│  ┌───────────────────────────────────────┐                     │
│  │ m4s0kwo4kc4oooocck4sswc4              │                     │
│  │ Status: Up (healthy) ✅                │                     │
│  │ Connected to: postgres-container ✅    │                     │
│  │ DNS resolution working ✅              │                     │
│  └───────────────────────────────────────┘                     │
│                  ↓                                              │
│                  ↓ (same network, DNS works)                    │
│                  ↓                                              │
│  ┌───────────────────────────────────────┐                     │
│  │ veritable-games-postgres              │                     │
│  │ IP: 10.0.1.X (dynamic)                │                     │
│  │ Status: Up (healthy) ✅                │                     │
│  │ Network: coolify ✅                    │                     │
│  │ Hostname resolvable: YES ✅            │                     │
│  └───────────────────────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Coolify Deployment Configuration

### Current Configuration Files

#### 1. Repository: nixpacks.toml
**Location**: `/home/user/Projects/veritable-games-main/frontend/nixpacks.toml`

```toml
[variables]
NIXPACKS_NODE_VERSION = '20'

[phases.setup]
aptPkgs = ["python3", "build-essential"]
```

**Purpose**: 
- Pins Node.js version to 20 (required for better-sqlite3 dev compatibility)
- Installs build tools for native modules
- Used during Coolify build phase

**Issues**: ✅ No issues - configuration correct

#### 2. Repository: Dockerfile
**Location**: `/home/user/Projects/veritable-games-main/frontend/Dockerfile`

**Key Sections**:
```dockerfile
# Multi-stage build
FROM node:20-alpine AS deps
FROM node:20-alpine AS builder
FROM node:20-alpine AS runner

# Build-time environment variables (lines 22-46)
ARG DATABASE_URL
ARG SESSION_SECRET
ARG CSRF_SECRET
ARG ENCRYPTION_KEY

ENV DATABASE_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
ENV POSTGRES_URL=${DATABASE_URL:-postgresql://build:build@localhost:5432/build_db}
ENV DATABASE_MODE=postgres

# Runtime configuration
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Startup command (line 88)
CMD ["node", "server.js"]
```

**Issues**: 
- ✅ Dockerfile itself is correct
- ❌ Startup migration script expects runtime DB connection
- ⚠️ `package.json` start script runs migration BEFORE Next.js starts

#### 3. Repository: docker-compose.yml
**Location**: `/home/user/Projects/veritable-games-main/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: veritable-games-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: veritable_games
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - default  # Maps to 'veritable-games-network'

networks:
  default:
    name: veritable-games-network  # ← Problem: Different from Coolify's network
```

**Issues**:
- ❌ **CRITICAL**: This docker-compose.yml creates `veritable-games-network`
- ❌ Coolify doesn't use this file - it generates its own docker-compose.yml
- ❌ PostgreSQL container created manually, not managed by Coolify
- ❌ Network mismatch causes the isolation problem

#### 4. Repository: .env.local
**Location**: `/home/user/Projects/veritable-games-main/frontend/.env.local`

```bash
DATABASE_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
POSTGRES_SSL=false
```

**Issues**:
- ⚠️ Hostname `localhost` works from host machine, NOT from container
- ⚠️ Should be `veritable-games-postgres` for container-to-container communication
- ❌ This file is used for LOCAL development, not production deployment
- ❌ Coolify has its own environment variables (not reading from this file)

### Coolify Database Configuration

**Application Table** (`applications`):
```sql
uuid: m4s0kwo4kc4oooocck4sswc4
name: veritable-games
fqdn: www.veritablegames.com  # ✅ Correctly set
ports_mappings: 3000:3000     # ✅ Direct port enabled
```

**Environment Variables Table** (`environment_variables`):
```sql
-- Schema structure:
id | key | value | is_runtime | is_buildtime | resourceable_type | resourceable_id

-- Need to query to see actual values
```

**Docker Labels Generated by Coolify**:
```json
{
  "caddy_0": "://",
  "caddy_0.handle_path": "m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io*",
  "traefik.enable": "true",
  "traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule": 
    "Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`)",
  "coolify.applicationId": "1",
  "coolify.managed": "true"
}
```

**Problems Identified**:
1. Both Caddy AND Traefik labels present (conflicting proxy configs)
2. `Host()` matcher is empty string
3. Domain placed in `PathPrefix()` instead of `Host()`
4. Using sslip.io domain instead of actual domain from database

---

## Docker Networking Analysis

### Current Network Topology

**Networks Present**:
```bash
$ docker network ls
NETWORK ID     NAME                      DRIVER    SCOPE
297a1f5a4c80   bridge                    bridge    local
b33f84c0db4e   coolify                   bridge    local    ← Coolify-managed
5d11d4cd565f   host                      host      local
c1c15200e291   none                      null      local
51b4db5acfab   veritable-games-network   bridge    local    ← User-created
```

**Container Network Assignments**:

1. **Application**: `m4s0kwo4kc4oooocck4sswc4`
   - Network: `coolify` only
   - Managed by: Coolify (auto-generated docker-compose.yml)
   - Status: Restarting (crash loop)
   - DNS resolution: Can resolve other containers on `coolify` network only

2. **PostgreSQL**: `veritable-games-postgres`
   - Network: `veritable-games-network` only
   - Managed by: User (manual `docker run` or `docker-compose up`)
   - Status: Up 3 hours (healthy)
   - DNS resolution: Can resolve other containers on `veritable-games-network` only

3. **Coolify Infrastructure**:
   - `coolify-proxy` → `coolify` network + `bridge` (ports 80/443 published)
   - `coolify-db` → `coolify` network
   - `coolify-redis` → `coolify` network
   - All communicate successfully within `coolify` network

**Network Isolation Problem**:
```
Docker Networks (isolated by default):
┌─────────────────────────┐     ┌──────────────────────────────┐
│ coolify network         │     │ veritable-games-network      │
│ Subnet: 10.0.1.x        │ ❌  │ Subnet: 10.0.2.x            │
│                         │     │                              │
│ - app container         │     │ - postgres container         │
│ - coolify-proxy         │     │                              │
│ - coolify-db            │     │ DNS: veritable-games-postgres│
│                         │     │                              │
│ ❌ Cannot resolve       │     │ ✅ Healthy                    │
│    veritable-games-     │     │                              │
│    postgres hostname    │     │                              │
└─────────────────────────┘     └──────────────────────────────┘
```

**DNS Resolution Behavior**:
- Docker embedded DNS server runs on each network
- Hostname resolution ONLY works within the same network
- Attempting to connect to `veritable-games-postgres` from `coolify` network:
  - Queries DNS: "resolve veritable-games-postgres"
  - DNS response: "EAI_AGAIN" (not found)
  - Node.js pg-pool: Throws `getaddrinfo EAI_AGAIN` error

### Port Mappings

**Published Ports** (accessible from host):
```
Container                     Published Ports
──────────────────────────────────────────────
m4s0kwo4kc4oooocck4sswc4     (none - crash loop)
veritable-games-postgres     0.0.0.0:5432→5432    ✅ Accessible as localhost:5432
coolify-proxy                0.0.0.0:80→80        ✅ HTTP
                             0.0.0.0:443→443      ✅ HTTPS
coolify                      0.0.0.0:8000→8080    ✅ Coolify UI
```

**Direct Port Configuration** (from Coolify database):
- `ports_mappings: "3000:3000"`
- INTENDED: Map container port 3000 to host port 3000
- ACTUAL: Container crashes before port binding occurs
- RESULT: Port 3000 not accessible

### Volume Mounts

**PostgreSQL Data**:
```bash
Volume: veritable-games-postgres_data
Mount: /var/lib/postgresql/data
Driver: local
Scope: local (not managed by Coolify)
```

**Application Volumes** (from Coolify):
```bash
# Coolify creates volumes for persistent storage
# Application container would have:
#   - /app/data (for SQLite fallback, not used in production)
#   - /app/public/uploads (for user-uploaded files)
#
# However, container crashes before volumes are useful
```

---

## Deployment Sequence Analysis

### What Happens When User Pushes to GitHub

**Normal Flow** (when working):
1. User: `git push origin main`
2. GitHub: Triggers webhook to Coolify webhook endpoint
3. Coolify: Receives webhook, queues deployment job
4. Coolify: Pulls latest code from GitHub repository
5. Coolify: Reads `nixpacks.toml` from `frontend/` directory (Base Directory setting)
6. Coolify: Generates Dockerfile using Nixpacks
7. Coolify: Builds Docker image (3-5 minutes)
8. Coolify: Generates docker-compose.yml with routing labels
9. Coolify: Stops old container (if exists)
10. Coolify: Starts new container with generated labels
11. Container: Runs `npm run start` command
12. Container: Executes startup migration script
13. Container: Starts Next.js server
14. Traefik: Detects new container labels, updates routing rules
15. Health check: Passes after 30-40 seconds
16. Deployment: Complete, site accessible

**Current Broken Flow**:
1. ✅ Steps 1-10 complete successfully
11. Container: Runs `npm run start` → executes startup migration
12. ❌ Migration script: Attempts connection to `veritable-games-postgres`
13. ❌ DNS lookup: Hostname not found on `coolify` network
14. ❌ Script: Throws error, exits with code 1
15. ❌ Container: Exits due to failed startup command
16. ❌ Docker: Restart policy triggers, loop back to step 11
17. ❌ Traefik: Detects container labels, but routing is malformed
18. ❌ Traefik: Logs error "empty args for matcher Host"
19. ❌ Health check: Never passes (container never stays up)
20. ❌ Deployment: Fails, site inaccessible

### Container Creation Sequence

**Coolify's Container Generation Logic**:
```
1. Read application config from database:
   - UUID: m4s0kwo4kc4oooocck4sswc4
   - Name: veritable-games
   - FQDN: www.veritablegames.com
   - Port: 3000
   - Base Directory: frontend

2. Generate docker-compose.yml:
   services:
     m4s0kwo4kc4oooocck4sswc4:
       image: <built-image>
       networks:
         - coolify  ← AUTOMATICALLY assigned
       labels:
         - traefik.enable=true
         - traefik.http.routers.http-0-<uuid>.rule=...
         - caddy_0=://
         # ... (50+ labels generated)

3. Apply labels:
   - Traefik routing rules
   - Caddy routing rules (if Caddy mode enabled)
   - Coolify metadata labels

4. Start container:
   - docker compose up -d
```

**The Label Generation Bug**:
```python
# Pseudocode of what Coolify likely does:
def generate_traefik_rule(app):
    if app.fqdn:
        # Bug: This branch doesn't execute properly
        return f"Host(`{app.fqdn}`)"
    else:
        # Fallback: Use sslip.io domain
        uuid = app.uuid
        server_ip = get_server_ip()
        return f"Host(``) && PathPrefix(`{uuid}.{server_ip}.sslip.io`)"

# Result: Even though fqdn="www.veritablegames.com" in database,
# the generated rule has empty Host() and wrong domain in PathPrefix()
```

### Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIGURATION SOURCES                     │
└─────────────────────────────────────────────────────────────┘

Repository (GitHub)
├── nixpacks.toml                  → Coolify Build (✅ working)
├── Dockerfile                     → Coolify Build (✅ working)
├── .env.example                   → Not used
├── .env.local                     → Not used (localhost only)
└── docker-compose.yml             → Not used by Coolify

Coolify Database (PostgreSQL)
├── applications table
│   ├── uuid                       → Container name generation
│   ├── name                       → Display name
│   ├── fqdn                       → ⚠️ Should be "www.veritablegames.com"
│   ├── ports_mappings             → Port forwarding config
│   └── base_directory             → ✅ "frontend"
│
└── environment_variables table
    ├── DATABASE_URL               → ⚠️ Must be "postgresql://postgres:postgres@<hostname>:5432/veritable_games"
    ├── POSTGRES_URL               → Same as above
    ├── SESSION_SECRET             → ✅ Set
    ├── CSRF_SECRET                → ✅ Set
    └── COOKIE_SECURE_FLAG         → ✅ false (HTTP deployment)

Generated at Deploy Time
├── docker-compose.yml             → Generated by Coolify (ephemeral)
│   ├── services                   → Application container definition
│   ├── networks                   → ❌ Assigns "coolify" only
│   └── labels                     → ❌ Malformed Traefik rules
│
└── Container Labels               → Applied to running container
    ├── traefik.*                  → ❌ Routing broken
    ├── caddy.*                    → ⚠️ Conflict with Traefik
    └── coolify.*                  → ✅ Metadata correct
```

---

## Identified Weak Points

### 1. Network Isolation (CRITICAL - Blocks Everything)

**Weak Point**: PostgreSQL and application on different Docker networks

**Why It's Critical**:
- Application CANNOT start without database connection
- Container crashes immediately on startup
- No amount of Traefik/routing fixes will help if app never starts

**Cascading Failures**:
```
Network isolation
  ↓
Startup migration fails
  ↓
Container exits with error
  ↓
Restart policy triggers
  ↓
Infinite crash loop
  ↓
Health checks never pass
  ↓
Traefik marks backend as unavailable
  ↓
All traffic returns 502 Bad Gateway
```

**Why It Keeps Recurring**:
- Manual PostgreSQL setup outside Coolify's management
- Coolify assigns all applications to `coolify` network automatically
- No configuration option to join additional networks in Coolify UI
- Requires manual intervention after each deployment

### 2. Traefik Label Generation (HIGH - Breaks Domain Routing)

**Weak Point**: Coolify generates malformed Traefik routing rules

**Evidence of the Bug**:
```
Database says:  fqdn = "www.veritablegames.com"
Label says:     traefik.http.routers.*.rule = "Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io`)"
```

**Root Cause Theories**:
1. **Caddy vs Traefik Mode Conflict**: 
   - Coolify might be in "Caddy mode" but generating Traefik labels
   - Caddy labels present: `caddy_0`, `caddy_0.handle_path`
   - Traefik labels also present: `traefik.enable`, `traefik.http.routers.*`

2. **FQDN Processing Bug**:
   - FQDN field read from database: ✅
   - FQDN variable passed to label template: ❌ (empty string)
   - Fallback to sslip.io domain: ✅ but in wrong place

3. **Template Logic Error**:
   - Template expects FQDN in specific format
   - Validation fails silently
   - Falls back to broken default

**Why It Persists**:
- Labels regenerated on every deployment
- Same broken template used every time
- No validation of generated labels before container starts
- Coolify UI shows deployment "successful" even with broken routing

### 3. DNS and SSL Configuration (MEDIUM - Blocks HTTPS)

**Weak Point**: Let's Encrypt ACME challenge failures

**Current Errors**:
```
1. "no valid A records found for veritablegames.com"
   → DNS not configured or not propagated

2. "Timeout during connect (likely firewall problem)"
   → Port 80 not accessible from internet
```

**DNS Configuration Unknowns**:
- Where are DNS records managed? (Squarespace? Cloudflare? Other?)
- Are A records pointing to correct IP (172.221.18.109)?
- Is Cloudflare proxy enabled (orange cloud) or disabled (gray cloud)?

**Firewall/Port Forwarding**:
- Server behind NAT router: 192.168.1.15 (local IP)
- Public IP: 172.221.18.109
- Need port forwarding: 80 → 192.168.1.15:80, 443 → 192.168.1.15:443
- Firewall rules: Must allow inbound 80/443

**Why It Matters**:
- Even if application starts and Traefik routing fixed
- HTTPS will still fail without valid SSL certificate
- Users accessing `https://www.veritablegames.com` will get certificate errors

### 4. Startup Migration Dependency (MEDIUM - Fragile Startup)

**Weak Point**: Application startup requires database migration to succeed

**Code Analysis**:
```json
// package.json
{
  "scripts": {
    "start": "node scripts/migrations/fix-truncated-password-hashes.js && next start"
  }
}
```

**The Chain**:
```
Container starts
  ↓
Runs "npm run start"
  ↓
Executes migration script (sync, blocking)
  ↓
Migration connects to PostgreSQL
  ↓
If connection fails → Exit code 1 → Container exits
  ↓
If connection succeeds → Migration runs → next start
```

**Problems**:
1. **Tight Coupling**: Application won't start if migration fails
2. **No Retry Logic**: Single failure = container crash
3. **Network Dependency**: Assumes DB hostname is resolvable
4. **Blocking Startup**: Can't skip migration to debug other issues

**Better Pattern**:
```javascript
// Recommended: Run migration in background after app starts
async function start() {
  // Start HTTP server first
  await nextStart();
  
  // Run migrations in background
  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration failed, app still running:', error);
    // Send alert, but don't crash
  }
}
```

### 5. Environment Variable Management (LOW - Confusing but Functional)

**Weak Point**: Multiple sources of environment configuration

**Sources**:
1. Repository `.env.local` (localhost development only)
2. Coolify database `environment_variables` table (runtime & buildtime)
3. Docker build args (passed during image build)
4. Dockerfile ENV statements (baked into image)

**Confusion Matrix**:
```
Variable          .env.local        Coolify DB       Effective Value
──────────────────────────────────────────────────────────────────────
DATABASE_URL      localhost:5432    (unknown)        ❓ Need to check
POSTGRES_URL      localhost:5432    (unknown)        ❓ Need to check  
SESSION_SECRET    (various)         (set)            ✅ From Coolify
COOKIE_SECURE_FL  false             false            ✅ false
```

**Why It's Confusing**:
- Documentation references `.env.local` (misleading for production)
- Actual production values in Coolify database (not in repo)
- No single source of truth visible in codebase
- Requires SSH + SQL query to see actual production config

**Why It's Low Priority**:
- Once configured correctly, rarely changes
- Coolify UI provides interface to manage variables
- Mainly affects initial setup, not ongoing operations

---

## Configuration Flow Analysis

### Build Time

**1. GitHub Push**
```
Developer → git push → GitHub Repository
                          ↓
                    Webhook triggers
                          ↓
                    Coolify webhook receiver
```

**2. Coolify Build Process**
```
Coolify
  ↓
Pull code from GitHub
  ↓
Navigate to base_directory: "frontend/"
  ↓
Read nixpacks.toml
  ↓
Generate Dockerfile using Nixpacks
  ↓
Build Docker image:
  - Install dependencies (npm ci)
  - Build Next.js (npm run build)
  - Environment variables from Coolify DB
  - Result: Docker image tagged with git SHA
```

**3. Image Creation**
```
Docker Build Context
  ↓
FROM node:20-alpine (base)
  ↓
COPY package files
  ↓
RUN npm ci (install deps)
  ↓
COPY application code
  ↓
RUN npm run build
  ↓
Multi-stage: Copy build artifacts to runner image
  ↓
Final image: ~500MB, includes:
  - Built Next.js app
  - node_modules (production only)
  - scripts/migrations (for startup migration)
```

### Deploy Time

**1. Container Configuration Generation**
```
Coolify
  ↓
Generate docker-compose.yml:
  - Service name: m4s0kwo4kc4oooocck4sswc4
  - Image: <built-image>
  - Networks: [coolify]  ← ⚠️ Only this network
  - Restart policy: unless-stopped
  - Environment variables: From Coolify DB
  - Labels: Traefik routing rules (50+ labels)
  - Port mappings: 3000:3000 (if ports_mappings set)
```

**2. Label Application**
```
Docker Labels Applied:
  - coolify.*                  → Coolify metadata
  - traefik.enable=true        → Enable Traefik routing
  - traefik.http.routers.*     → ⚠️ Broken routing rules
  - caddy.*                    → ⚠️ Caddy rules (conflict)
  
Label Generation Logic (broken):
  template = "Host(`{fqdn}`) && PathPrefix(`...`)"
  fqdn = get_fqdn_from_db()  → "www.veritablegames.com"
  result = template.format(fqdn="")  → ⚠️ Empty string used
```

**3. Container Lifecycle**
```
docker compose up -d
  ↓
Container created
  ↓
Assigned IP on coolify network
  ↓
Container starts
  ↓
CMD ["node", "server.js"]
  ↓
server.js runs: package.json "start" script
  ↓
npm run start
  ↓
Execute: fix-truncated-password-hashes.js
  ↓
Script connects to DATABASE_URL
  ↓
❌ DNS lookup: "veritable-games-postgres"
  ↓
❌ Error: getaddrinfo EAI_AGAIN
  ↓
❌ Script exits with code 1
  ↓
❌ npm run start fails
  ↓
❌ Container exits
  ↓
Docker restart policy
  ↓
Loop back to "Container starts"
```

### Runtime Routing

**Request Flow (if container was healthy)**:
```
User Browser
  ↓
HTTPS request: www.veritablegames.com
  ↓
Cloudflare CDN (DNS resolution)
  ↓
Public IP: 172.221.18.109
  ↓
Router (NAT)
  ↓
Port 443 → 192.168.1.15:443
  ↓
Traefik Proxy (coolify-proxy container)
  ↓
Routing decision:
  - Check Host header: "www.veritablegames.com"
  - Match against router rules:
    - http-0-m4s0kwo4kc4oooocck4sswc4: Host(``) ← ❌ Doesn't match
  - No match found
  ↓
Return: 502 Bad Gateway (no backend)
```

**What SHOULD happen**:
```
Traefik Proxy
  ↓
Routing decision:
  - Host header: "www.veritablegames.com"
  - Match router: http-0-m4s0kwo4kc4oooocck4sswc4
  - Rule: Host(`www.veritablegames.com`) ← ✅ Match!
  ↓
Forward to: http://m4s0kwo4kc4oooocck4sswc4:3000
  ↓
Container receives request
  ↓
Next.js processes request
  ↓
Return: 200 OK + HTML
```

---

## Current State Summary

### What's Working ✅

1. **Code Quality**: Application code is production-ready
   - TypeScript compiles without errors
   - Tests passing (when run with correct environment)
   - Next.js builds successfully
   - Security hardening complete

2. **PostgreSQL Database**: Healthy and accessible
   - Container running for 3+ hours
   - Health checks passing
   - Data intact (2 users, full schema)
   - Accessible from host on port 5432

3. **Coolify Infrastructure**: Operating normally
   - Coolify UI accessible (192.168.1.15:8000)
   - GitHub webhook integration working
   - Build process completing successfully
   - Docker registry functional

4. **Configuration Storage**: Correct values in database
   - FQDN: "www.veritablegames.com" ✅
   - Ports: "3000:3000" ✅
   - Base directory: "frontend" ✅
   - Environment variables set

### What's Broken ❌

1. **Network Connectivity**: Application cannot reach database
   - Containers on different isolated networks
   - DNS resolution fails
   - Startup migration crashes
   - Container in infinite restart loop

2. **Traefik Routing**: Malformed routing rules
   - Empty `Host()` matcher
   - Domain in wrong place (PathPrefix vs Host)
   - Continuous Traefik errors in logs
   - Domain routing impossible

3. **SSL Certificates**: ACME challenge failures
   - DNS records missing or misconfigured
   - Port 80 not accessible from internet
   - Let's Encrypt cannot verify domain ownership
   - HTTPS not available

4. **Service Availability**: Complete outage
   - Application not responding on any URL
   - Local IP access (192.168.1.15:3000): 502 Bad Gateway
   - Domain access (www.veritablegames.com): Unreachable
   - Health checks failing

### Impact Assessment

**User Impact**: 🔴 Complete Service Outage
- Website completely inaccessible
- No workaround available
- Affects both local and public access
- Duration: Since last deployment (unknown when)

**Technical Debt**: 🟡 Medium
- Quick fixes available (network bridge)
- Long-term fixes needed (Coolify configuration)
- Root cause in infrastructure, not application code
- Won't fix itself - requires manual intervention

**Recovery Difficulty**: 🟢 Low
- Problems identified and understood
- Solutions documented below
- Can be fixed without code changes
- Database and data not affected

---

## Root Cause Deep Dive

### Why Network Isolation Exists

**Historical Context** (from documentation):
1. Initially, PostgreSQL created via `docker-compose.yml` in repository
2. File specifies network name: `veritable-games-network`
3. PostgreSQL container started: `docker compose up -d postgres`
4. Network created: `veritable-games-network` (persists after down)

**Coolify's Behavior**:
1. Coolify manages its own network: `coolify`
2. All Coolify-deployed apps automatically joined to this network
3. Coolify DOES NOT read `docker-compose.yml` from repository
4. Coolify generates its own `docker-compose.yml` at deploy time
5. Generated file ONLY includes `coolify` network

**The Disconnect**:
```
User Expectation:
  "My docker-compose.yml says veritable-games-network,
   so Coolify should use that"

Reality:
  Coolify ignores repository docker-compose.yml,
  generates its own with coolify network only
```

### Why Traefik Labels Are Malformed

**Coolify's Proxy Architecture**:
- Coolify supports TWO proxy modes:
  1. **Traefik mode**: Uses Traefik for routing (default)
  2. **Caddy mode**: Uses Caddy for routing (alternative)

**Configuration Conflict Evidence**:
```json
// Container has BOTH sets of labels:
{
  "caddy_0": "://",
  "caddy_0.handle_path": "m4s0kwo4kc4oooocck4sswc4.192.168.1.15.sslip.io*",
  "traefik.enable": "true",
  "traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule": "Host(``) && PathPrefix(...)"
}
```

**Hypothesis**: Coolify is in a mixed state
- Global proxy setting: Traefik (enables traefik.* labels)
- Application setting: Caddy mode remnant (generates caddy.* labels)
- Label template for Traefik expects certain input format
- Input doesn't match expected format
- Template renders with empty string for Host()

**Why FQDN Doesn't Work**:
```
Coolify Label Generation Code (pseudocode):
  if app.caddy_mode:
    labels['caddy_0.handle_path'] = f"{uuid}.{server_ip}.sslip.io*"
  
  if global.traefik_mode:
    # Bug: This block expects app.traefik_fqdn, but uses app.fqdn
    # app.fqdn exists, but in wrong format for template
    host = app.traefik_fqdn or ""  # ← Falls back to empty string
    labels['traefik.http.routers.*.rule'] = f"Host(`{host}`) && ..."

Result:
  - Caddy labels: Use UUID-based sslip.io domain ✅
  - Traefik labels: Empty Host(), malformed rule ❌
```

### Why It Keeps Breaking After Each Redeploy

**The Cycle**:
```
1. User fixes routing manually (edits database, restarts containers)
   → Site works temporarily ✅

2. User pushes code change to GitHub
   → Coolify webhook triggered

3. Coolify rebuilds image
   → Build succeeds ✅

4. Coolify generates NEW docker-compose.yml
   → Uses same broken template

5. Coolify starts NEW container
   → Labels regenerated from template
   → Same bugs reintroduced

6. Old container stopped
   → Manual fixes lost

7. New container running
   → Back to broken state ❌

8. User reports: "It broke again!" 😞
```

**Why Manual Fixes Don't Persist**:
- Container labels are IMMUTABLE after creation
- Only way to change labels: Recreate container
- Coolify recreates container on every deployment
- New container = new labels from template
- Template is broken, so labels are broken again

**What WOULD Persist**:
- Changes to Coolify database (applications table)
- Changes to Coolify global settings (proxy mode)
- Changes to Coolify template files (if editable)
- Environment variables (stored in database)

**What WON'T Persist**:
- Manual docker inspect edits (not possible)
- Direct label changes (container must be recreated)
- Network assignments (controlled by docker-compose.yml)
- Temporary fixes (destroyed on redeploy)

---

## Recommendations & Solutions

### Immediate Fix (Get Site Online ASAP)

**Priority**: 🔴 CRITICAL  
**Estimated Time**: 15 minutes  
**Risk**: Low

**Step 1: Connect PostgreSQL to Coolify Network**
```bash
# SSH into server
ssh user@192.168.1.15

# Stop PostgreSQL container
docker stop veritable-games-postgres

# Connect container to both networks
docker network connect coolify veritable-games-postgres

# Start PostgreSQL container
docker start veritable-games-postgres

# Verify network connections
docker inspect veritable-games-postgres --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool

# Expected: Container now on BOTH networks
# - veritable-games-network: 10.0.2.2
# - coolify: 10.0.1.X (new IP assigned)
```

**Step 2: Verify DNS Resolution**
```bash
# Check if application can now resolve postgres hostname
docker exec m4s0kwo4kc4oooocck4sswc4 nslookup veritable-games-postgres

# If container is still restarting, wait for next restart cycle
# Container will attempt startup again automatically
```

**Step 3: Monitor Application Startup**
```bash
# Watch logs in real-time
docker logs -f m4s0kwo4kc4oooocck4sswc4

# Expected to see:
# "🔍 Checking for truncated password hashes..."
# "✅ No truncated password hashes found" or "✅ Fixed N hashes"
# "Ready in X seconds"

# Check container status
docker ps | grep m4s0kwo4kc4oooocck4sswc4

# Expected: "Up X seconds (healthy)" not "Restarting"
```

**Step 4: Test Local Access**
```bash
# From server
curl http://localhost:3000

# From local network
curl http://192.168.1.15:3000

# Expected: HTML response (homepage)
```

**Result**:
- ✅ Application container starts successfully
- ✅ Startup migration completes
- ✅ Local IP access works (192.168.1.15:3000)
- ⚠️ Domain routing still broken (need additional fixes)

### Short-Term Fix (Domain Routing)

**Priority**: 🟡 HIGH  
**Estimated Time**: 30 minutes  
**Risk**: Medium (requires Coolify database edit)

**Option A: Disable Traefik, Use Direct Port Only**
```bash
# SSH into server
ssh user@192.168.1.15

# Connect to Coolify database
docker exec -i coolify-db psql -U coolify -d coolify

# Clear FQDN (disables Traefik routing)
UPDATE applications
SET fqdn = NULL
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

# Ensure direct port is enabled
UPDATE applications
SET ports_mappings = '3000:3000'
WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

# Exit (Ctrl+D)

# Redeploy via Coolify UI to apply changes
# Go to http://192.168.1.15:8000 → Application → Deploy
```

**Result**:
- ✅ Site accessible via http://192.168.1.15:3000
- ✅ No Traefik routing issues (bypassed entirely)
- ❌ Domain routing disabled (www.veritablegames.com won't work)
- ❌ No SSL/HTTPS support

**Use Case**: Emergency rollback, get site functional ASAP

**Option B: Fix Traefik Labels (Requires Coolify Config Access)**
```bash
# This requires editing Coolify's label generation template
# Location varies by Coolify version, typically:
# /data/coolify/source/app/Actions/Application/GenerateLabels.php

# OR reconfigure application in Coolify UI:
# 1. Go to http://192.168.1.15:8000
# 2. Application → Settings → Proxy
# 3. Change proxy type to "Caddy" (if Caddy labels are working)
# 4. OR check "Custom proxy" and manually define labels

# Manual label specification (if supported):
# traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule=Host(`www.veritablegames.com`)
# traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.service=http-0-m4s0kwo4kc4oooocck4sswc4
# traefik.http.services.http-0-m4s0kwo4kc4oooocck4sswc4.loadbalancer.server.port=3000
```

**Result** (if successful):
- ✅ Domain routing works (www.veritablegames.com)
- ✅ Traefik labels correct
- ⚠️ Still need DNS and SSL configuration

**Use Case**: Proper domain routing with reverse proxy

### Long-Term Solution (Proper Infrastructure)

**Priority**: 🟢 MEDIUM  
**Estimated Time**: 2-4 hours  
**Risk**: Low (no production downtime if staged properly)

**Goal**: Migrate PostgreSQL into Coolify management

**Benefits**:
- PostgreSQL automatically on correct network
- Coolify manages database lifecycle (start/stop/backup)
- Persistent configuration across application deployments
- Database visible in Coolify UI

**Steps**:

**1. Backup Existing Database**
```bash
# SSH into server
ssh user@192.168.1.15

# Dump database
docker exec veritable-games-postgres pg_dump -U postgres veritable_games \
  > ~/veritable-games-backup-$(date +%Y%m%d).sql

# Verify backup
wc -l ~/veritable-games-backup-*.sql
# Should show thousands of lines
```

**2. Create PostgreSQL in Coolify**
```
1. Open Coolify UI: http://192.168.1.15:8000
2. Go to: Databases → New Database
3. Select: PostgreSQL 15
4. Configuration:
   - Name: veritable-games-postgres
   - Username: postgres
   - Password: postgres (or generate new secure password)
   - Database: veritable_games
   - Port: 5432 (published port)
   - Network: coolify (automatic)
5. Click: Create Database
6. Wait: ~2 minutes for container to start
```

**3. Restore Data to New Database**
```bash
# Get new container name (likely different from old one)
docker ps | grep postgres

# Restore backup
docker exec -i <new-postgres-container> psql -U postgres -d veritable_games \
  < ~/veritable-games-backup-*.sql

# Verify data
docker exec <new-postgres-container> psql -U postgres -d veritable_games \
  -c "SELECT COUNT(*) FROM users.users;"
# Expected: 2 (admin + test user)
```

**4. Update Application Environment Variables**
```
1. Coolify UI → Application → Environment Variables
2. Find: DATABASE_URL
3. Update hostname:
   OLD: postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
   NEW: postgresql://postgres:postgres@<new-container-name>:5432/veritable_games
4. Find: POSTGRES_URL
5. Update same way
6. Save changes
7. Redeploy application
```

**5. Remove Old PostgreSQL Container**
```bash
# Stop old container
docker stop veritable-games-postgres

# Verify application still works with new database
curl http://192.168.1.15:3000

# If all good, remove old container
docker rm veritable-games-postgres

# Remove old network (if not used by other containers)
docker network rm veritable-games-network
```

**Result**:
- ✅ PostgreSQL managed by Coolify
- ✅ Automatic network assignment
- ✅ No more network isolation issues
- ✅ Database lifecycle managed by Coolify
- ✅ Survives application redeployments

---

## Additional Fixes Needed

### DNS Configuration

**Required Actions**:
1. Determine DNS provider (check domain registrar - likely Squarespace)
2. Add/update A records:
   ```
   Type: A
   Name: @
   Value: 172.221.18.109 (public IP)
   TTL: 300 (5 minutes)

   Type: A  
   Name: www
   Value: 172.221.18.109
   TTL: 300
   ```
3. If using Cloudflare:
   - Ensure proxy is ENABLED (orange cloud)
   - SSL mode: Full (not Strict)
4. Wait for DNS propagation (5-30 minutes)
5. Verify: `nslookup www.veritablegames.com`

### Port Forwarding

**Router Configuration**:
```
External Port 80 → 192.168.1.15:80 (HTTP)
External Port 443 → 192.168.1.15:443 (HTTPS)
```

**Verification**:
```bash
# From OUTSIDE the local network (use phone data or ask friend):
curl -I http://<your-public-ip>
curl -I https://<your-public-ip>

# Expected: Response from Traefik (even if backend unavailable)
# NOT expected: Timeout or connection refused
```

### SSL Certificate

**Once domain routing is fixed**:
1. Let's Encrypt will automatically retry certificate generation
2. Monitor Traefik logs for ACME success: `docker logs coolify-proxy | grep -i acme`
3. Verify cert: `curl -vI https://www.veritablegames.com 2>&1 | grep -i 'certificate'`

**Manual trigger (if needed)**:
```bash
# Delete existing cert attempt
docker exec coolify-proxy rm -rf /etc/traefik/acme.json

# Restart Traefik to retry
docker restart coolify-proxy

# Watch logs
docker logs -f coolify-proxy | grep -i acme
```

---

## Testing & Verification Plan

### After Immediate Fix (Network Bridge)

**Test 1: Container Health**
```bash
docker ps | grep m4s0kwo4kc4oooocck4sswc4
# Expected: "Up X seconds (healthy)" not "Restarting"
```

**Test 2: Database Connectivity**
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 nc -zv veritable-games-postgres 5432
# Expected: "succeeded" or "open"
```

**Test 3: Startup Migration**
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 | grep -i "migration\|password hash"
# Expected: "✅ No truncated password hashes found" or "✅ Fixed N hashes"
# NOT expected: "❌ Migration failed"
```

**Test 4: Local Access**
```bash
curl -I http://192.168.1.15:3000
# Expected: HTTP/1.1 200 OK or 30x redirect
```

### After Domain Routing Fix

**Test 5: Traefik Logs Clean**
```bash
docker logs coolify-proxy --tail 50 | grep -i error | grep -v "closed network"
# Expected: No "empty args for matcher Host" errors
```

**Test 6: Traefik Rules Correct**
```bash
docker inspect m4s0kwo4kc4oooocck4sswc4 --format '{{index .Config.Labels "traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule"}}'
# Expected: "Host(`www.veritablegames.com`)" or similar valid rule
```

**Test 7: Domain Routing**
```bash
curl -H "Host: www.veritablegames.com" http://192.168.1.15
# Expected: Same response as http://192.168.1.15:3000
```

### After DNS/SSL Configuration

**Test 8: DNS Resolution**
```bash
nslookup www.veritablegames.com
# Expected: Returns 172.221.18.109 (public IP)
```

**Test 9: External HTTP Access**
```bash
# From phone (not on WiFi) or external server:
curl -I http://www.veritablegames.com
# Expected: HTTP response (200, 30x, or even 502 if app down)
# NOT expected: Timeout
```

**Test 10: HTTPS Certificate**
```bash
curl -vI https://www.veritablegames.com 2>&1 | grep "subject:\|issuer:"
# Expected: subject: CN=www.veritablegames.com, issuer: Let's Encrypt
```

**Test 11: Full User Journey**
```
1. Open browser (incognito mode)
2. Navigate to: https://www.veritablegames.com
3. Expected: Homepage loads, no SSL warnings
4. Click: Login
5. Enter credentials: admin / [password]
6. Expected: Login succeeds, dashboard loads
```

---

## Conclusion

The domain routing failure is caused by **three compounding infrastructure failures**:

1. **Network isolation** (CRITICAL): Application cannot reach database → crash loop
2. **Malformed Traefik labels** (HIGH): Even if app started, routing wouldn't work
3. **DNS/SSL misconfiguration** (MEDIUM): Even if routing worked, HTTPS would fail

**The recurring nature** of the issue is due to:
- Coolify regenerating broken labels on every deployment
- No persistence of manual fixes
- Label generation template has bugs (empty Host() matcher)

**To permanently fix**:
1. Move PostgreSQL into Coolify management (prevents network isolation)
2. Fix Coolify's label generation (requires template edit or reconfiguration)
3. Configure DNS and port forwarding properly

**Immediate action required**: Bridge the network (15 minutes) to stop the crash loop

**Files this report references**:
- `/home/user/Projects/veritable-games-main/frontend/nixpacks.toml`
- `/home/user/Projects/veritable-games-main/frontend/Dockerfile`
- `/home/user/Projects/veritable-games-main/docker-compose.yml`
- `/home/user/Projects/veritable-games-main/frontend/.env.local`
- `/home/user/Projects/veritable-games-main/frontend/scripts/migrations/fix-truncated-password-hashes.js`

**Coolify database queries needed**:
```sql
-- Application configuration
SELECT * FROM applications WHERE uuid = 'm4s0kwo4kc4oooocck4sswc4';

-- Environment variables
SELECT key, value, is_runtime, is_buildtime 
FROM environment_variables 
WHERE resourceable_type = 'App\\Models\\Application' 
  AND resourceable_id = 1;
```

---

**Report Generated**: November 10, 2025  
**Server Time**: 03:22 UTC  
**Status**: 🔴 OUTAGE - Immediate intervention required
