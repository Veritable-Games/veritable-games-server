# Coolify Implementation Guide

**Comprehensive Guide to Coolify Architecture, Best Practices, and Troubleshooting**

**Created**: November 9, 2025 (verified from system date)
**Status**: Complete Reference Implementation
**Audience**: Developers deploying with Coolify self-hosted

---

## Table of Contents

1. [Understanding Coolify Architecture](#understanding-coolify-architecture)
2. [Database Management in Coolify](#database-management-in-coolify)
3. [Network Architecture & Service Communication](#network-architecture--service-communication)
4. [Traefik Integration & Routing](#traefik-integration--routing)
5. [Deployment & Redeployment Process](#deployment--redeployment-process)
6. [Environment Variables & Build Configuration](#environment-variables--build-configuration)
7. [Persistent Storage & Data Management](#persistent-storage--data-management)
8. [Health Checks & Monitoring](#health-checks--monitoring)
9. [Backup & Disaster Recovery](#backup--disaster-recovery)
10. [Common Issues & Solutions](#common-issues--solutions)
11. [Production Best Practices](#production-best-practices)
12. [Complete Implementation Checklist](#complete-implementation-checklist)

---

## Understanding Coolify Architecture

### What is Coolify?

Coolify is an open-source, self-hosted Platform-as-a-Service (PaaS) alternative to Heroku, Netlify, and Vercel. It provides:

- **One-click deployments** from Git repositories
- **Automatic SSL certificates** via Let's Encrypt
- **Built-in reverse proxy** (Traefik or Caddy)
- **Database management** (PostgreSQL, MySQL, MongoDB, Redis, etc.)
- **Docker-based** containerization
- **GitHub/GitLab integration** with automatic webhooks

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Coolify Core System                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Coolify    │  │   Coolify    │  │   Traefik    │       │
│  │   Frontend   │  │   Backend    │  │   Proxy      │       │
│  │   (Port 8000)│◄─┤   (Laravel)  │◄─┤ (Port 80/443)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                  │                  │               │
│         └──────────────────┴──────────────────┘               │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │         Docker Engine                  │
        │                                        │
        │  ┌──────────┐  ┌──────────┐           │
        │  │   Your   │  │   Your   │           │
        │  │   App    │◄─┤ Database │           │
        │  │Container │  │Container │           │
        │  └──────────┘  └──────────┘           │
        │                                        │
        │  Docker Networks & Volumes             │
        └────────────────────────────────────────┘
```

### Coolify's Data Flow

1. **User pushes code** → GitHub/GitLab
2. **Webhook triggers** → Coolify backend
3. **Coolify pulls code** → Starts build process
4. **Nixpacks/Dockerfile** → Builds Docker image
5. **Container created** → Deployed to destination network
6. **Traefik proxy** → Routes traffic to container
7. **User accesses** → Via domain or IP

---

## Database Management in Coolify

### Database Deployment Options

Coolify offers **two primary methods** for database deployment:

#### Option 1: Standalone Database (Recommended for Production)

**What it is**: Database created via Coolify's "New Database" interface

**Advantages**:
- ✅ **GUI-managed backups** - Schedule automated backups via Coolify UI
- ✅ **Monitoring built-in** - Health checks and status visible in dashboard
- ✅ **Easy configuration** - Connection strings auto-generated
- ✅ **Isolated lifecycle** - Database persists even if application is deleted
- ✅ **S3 backup integration** - Direct connection to object storage

**Disadvantages**:
- ❌ Managed separately from application
- ❌ Requires manual network configuration for cross-service access

**When to use**:
- Production databases requiring backup management
- Databases shared across multiple applications
- Long-term data persistence needs

**Implementation**:
```bash
# In Coolify Dashboard:
1. Go to "Databases" → "New Database"
2. Select "PostgreSQL 15"
3. Name: veritable-games-db
4. Username: veritable_user
5. Password: [Generated strong password]
6. Port: 5432 (internal)
7. Click "Create"

# Coolify generates connection string:
postgresql://veritable_user:PASSWORD@UUID:5432/veritable_db

# Where UUID is the container name (e.g., postgres-j4g44okskok04cks4kwogkkg)
```

#### Option 2: Docker Compose Database

**What it is**: Database defined in your `docker-compose.yml` file

**Advantages**:
- ✅ **Version-controlled** - Database configuration in git
- ✅ **Same network** - Automatic service discovery
- ✅ **Infrastructure as code** - Reproducible across environments
- ✅ **Simpler networking** - No need to enable "Connect to Predefined Network"

**Disadvantages**:
- ❌ **No GUI backup management** - Backups must be scripted manually
- ❌ More complex configuration
- ❌ Not recommended for beginners

**When to use**:
- Development/staging environments
- When application and database lifecycle are tightly coupled
- Infrastructure-as-code requirements

**Implementation**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@db:5432/veritable_db
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: veritable_db

volumes:
  postgres-data:
```

### Database Naming Convention

**Critical Understanding**: Coolify renames database containers to include UUIDs

**Why**: Prevents name collisions when multiple projects use common names like "postgres"

**Pattern**:
```
Database name in Coolify: veritable-games-db
Container name: postgres-j4g44okskok04cks4kwogkkg
            └─────────┬─────────┘
                   UUID
```

**Impact on Connection Strings**:
```bash
# ❌ WRONG - Using the friendly name
DATABASE_URL=postgresql://user:pass@veritable-games-db:5432/db

# ✅ CORRECT - Using the UUID container name
DATABASE_URL=postgresql://user:pass@postgres-j4g44okskok04cks4kwogkkg:5432/db

# ✅ BEST - Use Coolify-provided connection string
# Copy from: Database → Overview → "Postgres URL (internal)"
```

### PostgreSQL Internal Connection Format

Coolify provides **two connection string formats**:

**Internal URL** (for containers in same/connected network):
```
postgresql://username:password@postgres-UUID:5432/database_name
```

**External URL** (if database is made publicly accessible):
```
postgresql://username:password@192.168.1.15:5432/database_name
```

**Which to use**: Always use **Internal URL** for application-to-database communication

---

## Network Architecture & Service Communication

### Docker Network Fundamentals in Coolify

Coolify creates **isolated Docker networks** for each resource deployment:

```
┌─────────────────────────────────────────────────────────────┐
│                  Coolify Network (coolify)                   │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Coolify    │  │   Traefik    │  │   Coolify    │       │
│  │   App        │  │   Proxy      │  │   DB         │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Application Network (UUID-based)                     │
│                                                               │
│  ┌──────────────┐                                            │
│  │   Your App   │  ← Isolated by default                     │
│  │  Container   │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Database Network (UUID-based)                        │
│                                                               │
│  ┌──────────────┐                                            │
│  │  PostgreSQL  │  ← Isolated by default                     │
│  │  Container   │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### Default Network Behavior

**Key Principle**: Each resource (application, database, service) is deployed to its **own isolated network**

**Network naming**: `coolify-{resource-uuid}`

**Consequences**:
- ❌ Application in Network A **cannot** communicate with Database in Network B
- ✅ Services in the same Docker Compose stack **can** communicate
- ✅ Traefik proxy is in `coolify` network and bridges to your resources

### Enabling Cross-Network Communication

**Problem**: Application needs to connect to standalone database (different networks)

**Solution**: Enable "Connect to Predefined Network"

**How it works**:
1. Your application joins the `coolify` network (in addition to its own network)
2. Database is also in `coolify` network
3. Communication possible via Docker DNS

**Configuration**:
```bash
# In Coolify Application Settings:
1. Go to: Application → General → Advanced
2. Find: "Connect to Predefined Network"
3. Toggle: Enable
4. Redeploy application
```

**Important Notes**:
- ✅ Application now has **two networks**: its own + `coolify`
- ✅ Use database's **container name** (UUID format) as hostname
- ⚠️ May affect Docker DNS resolution in some edge cases

### Destinations Explained

**What is a Destination?**: A Docker network endpoint where resources are deployed

**Default Destination**: Every Coolify installation has a default destination (the `coolify` network)

**Why it matters**:
- All resources go to destinations
- Destinations define network isolation
- Resources in same destination can communicate
- Resources in different destinations need "Connect to Predefined Network"

### Network Communication Patterns

#### Pattern 1: Same Docker Compose Stack
```yaml
services:
  app:
    # Can reach db via hostname "db"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/mydb
  db:
    image: postgres:15
```

**Communication**: ✅ Automatic via service names

#### Pattern 2: Standalone Database + Standalone Application
```
Application: coolify-{app-uuid} network
Database: coolify-{db-uuid} network
```

**Communication**: ❌ Cannot communicate by default

**Fix**: Enable "Connect to Predefined Network" on application

#### Pattern 3: Application + Database Both in Coolify Network
```
Application: coolify network (via "Connect to Predefined Network")
Database: coolify network (standalone database)
```

**Communication**: ✅ Use database container name (UUID format)

**Connection string**:
```bash
DATABASE_URL=postgresql://user:pass@postgres-j4g44okskok04cks4kwogkkg:5432/db
```

### Custom Docker Networks

**Advanced Use Case**: Define custom network CIDR ranges

**Configuration**: Set during Coolify installation via environment variables

```bash
# During installation:
COOLIFY_NETWORK_CIDR=10.0.0.0/8
COOLIFY_ADDRESS_POOL=10.0.0.0/16

curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**When to use**: If default Docker network ranges conflict with your infrastructure

---

## Traefik Integration & Routing

### Traefik's Role in Coolify

**Traefik** is Coolify's default reverse proxy that:
- Routes incoming HTTP/HTTPS traffic to containers
- Handles SSL/TLS certificate management (Let's Encrypt)
- Provides automatic service discovery via Docker labels
- Manages load balancing and health checks

```
Internet
   │
   ▼
Cloudflare/DNS → Port 80/443
   │
   ▼
Traefik Proxy (coolify-proxy container)
   │
   ├─ Host(`example.com`) → App Container 1
   ├─ Host(`api.example.com`) → App Container 2
   └─ Host(`db.example.com`) → Database Container
```

### How Coolify Generates Traefik Labels

When you deploy an application, Coolify automatically adds **Docker labels** to your container:

```bash
# Example labels generated by Coolify:
traefik.enable=true
traefik.http.routers.http-0-UUID.rule=Host(`www.example.com`)
traefik.http.routers.http-0-UUID.entrypoints=http
traefik.http.routers.http-0-UUID.middlewares=gzip
traefik.http.services.UUID.loadbalancer.server.port=3000
```

### FQDN Configuration (CRITICAL)

**FQDN** = Fully Qualified Domain Name (your domain, e.g., `www.example.com`)

**Critical Understanding**: FQDN determines how Traefik generates routing rules

#### Scenario 1: FQDN is NULL (Direct Port Access Only)

**Configuration**:
```
FQDN: [empty/NULL]
Port Mappings: 3000:3000
```

**Result**:
- ✅ Application accessible via `http://SERVER_IP:3000`
- ❌ No domain routing (Traefik generates malformed labels)
- ⚠️ Common error: `Host(\`\`)` with empty value

**Coolify behavior**:
```bash
# Generated label (BROKEN):
traefik.http.routers.http-0-UUID.rule=Host(``) && PathPrefix(`UUID.sslip.io`)
                                           └─────┬─────┘
                                          EMPTY - causes error
```

#### Scenario 2: FQDN is Set (Domain Routing)

**Configuration**:
```
FQDN: www.example.com
Port Mappings: [empty or 3000:3000]
```

**Result**:
- ✅ Application accessible via `https://www.example.com`
- ✅ Traefik generates proper routing rules
- ✅ SSL certificate auto-generated (if Let's Encrypt enabled)

**Coolify behavior**:
```bash
# Generated label (CORRECT):
traefik.http.routers.http-0-UUID.rule=Host(`www.example.com`)
                                           └────────┬────────┘
                                              Proper domain
```

### Common Traefik Label Issues

#### Issue 1: Empty Host Matcher

**Error in Traefik logs**:
```
error: empty args for matcher Host
```

**Cause**: FQDN is NULL in Coolify's database

**Fix**:
```sql
-- Update FQDN in Coolify database
docker exec -i coolify-db psql -U coolify -d coolify <<EOF
UPDATE applications
SET fqdn = 'www.example.com'
WHERE uuid = 'YOUR_APP_UUID';
EOF

# Then redeploy application
```

#### Issue 2: FQDN in PathPrefix Instead of Host

**Bug**: Coolify versions beta.418 and earlier had a bug where FQDN appeared in PathPrefix

**Broken label**:
```bash
traefik.http.routers.http-0-UUID.rule=Host(``) && PathPrefix(`www.example.com`)
```

**Fix**: Upgrade Coolify to latest version or manually set correct FQDN

#### Issue 3: Missing LoadBalancer Port

**Error in Traefik logs**:
```
no available server
```

**Cause**: Missing `traefik.http.services.UUID.loadbalancer.server.port` label

**Fix**: Ensure application's exposed port is configured in Coolify

```bash
# In Coolify:
Application → General → Port Exposes: 3000
```

### Traefik Label Customization

**Custom labels** can be added via Coolify's "Container Labels" field:

```bash
# Example: Add basic authentication
traefik.http.middlewares.my-auth.basicauth.users=user:$apr1$...
traefik.http.routers.http-0-UUID.middlewares=my-auth

# Example: Add CORS headers
traefik.http.middlewares.my-cors.headers.accesscontrolallowmethods=GET,POST,PUT
```

**Important**: Custom labels must not conflict with Coolify-generated labels

### Debugging Traefik Routing

**Step 1: Check container labels**
```bash
docker inspect YOUR_CONTAINER_NAME --format '{{range $key, $value := .Config.Labels}}{{if (hasPrefix $key "traefik")}}{{printf "%s = %s\n" $key $value}}{{end}}{{end}}'
```

**Step 2: Check Traefik logs**
```bash
docker logs coolify-proxy --tail 100 2>&1 | grep -E '(error|Host|rule)'
```

**Step 3: Verify Traefik sees the service**
```bash
# Access Traefik dashboard (if enabled)
# Or check Traefik API
curl http://localhost:8080/api/http/routers
```

---

## Deployment & Redeployment Process

### Understanding Deploy vs Restart vs Redeploy

**Restart**:
- Stops and starts **existing** container
- No rebuild of Docker image
- Environment variables reloaded
- **Use when**: Changing runtime environment variables only

**Redeploy**:
- Pulls latest code from Git
- Rebuilds Docker image
- Creates new container
- **Use when**: Code changes, dependency updates

**Deploy** (first time):
- Same as redeploy, but for initial deployment

### Redeployment Step-by-Step

When you click "Redeploy" or push to GitHub (with webhook), Coolify:

1. **Git Pull**
   ```bash
   git clone --depth 1 --branch main https://github.com/user/repo.git
   ```

2. **Build Preparation**
   - Reads `nixpacks.toml` or `Dockerfile`
   - Loads build environment variables
   - Determines build pack (Nixpacks, Docker, Docker Compose)

3. **Build Phase**
   ```bash
   # For Nixpacks:
   nixpacks build . --name APP_NAME

   # For Dockerfile:
   docker build -t APP_NAME .
   ```

4. **Image Tagging**
   ```bash
   docker tag APP_NAME:latest REGISTRY/APP_NAME:COMMIT_SHA
   ```

5. **Container Deployment**
   - Stops old container (if exists)
   - Creates new container with updated image
   - Applies Traefik labels
   - Starts new container

6. **Health Check**
   - Waits for container to be healthy
   - Checks configured health endpoint
   - Times out after configured duration

7. **Cleanup**
   - Removes old container
   - Optionally removes old images (based on retention settings)

### Build Caching

**Coolify caches**:
- ✅ Docker layers (incremental builds)
- ✅ npm/pip packages (if using cache volumes)

**Cache is cleared when**:
- ❌ You click "Force Deploy Without Cache"
- ❌ Base image changes
- ❌ Nixpacks version updates

**To force clean build**:
```bash
# In Coolify:
Application → Deployments → Force Deploy Without Cache
```

### Git Webhook Integration

**Automatic Setup** (GitHub App):
1. Install Coolify GitHub App
2. Authorize repository access
3. Webhook auto-created at `https://coolify.example.com/api/v1/webhooks/github`

**Manual Setup**:
```bash
# Get webhook URL from Coolify:
Application → Webhooks → Copy URL

# In GitHub:
Repository → Settings → Webhooks → Add webhook
Payload URL: [Coolify webhook URL]
Content type: application/json
Secret: [From Coolify]
Events: Just the push event
```

**Webhook triggers on**:
- Push to configured branch
- Pull request merge (if enabled)

### Multi-Server Deployment

**Scenario**: Deploy to multiple servers simultaneously

**Configuration**:
```bash
# In Coolify:
Servers → Add Server
Name: Production-2
IP: 192.168.1.20
SSH Key: [Your key]

# In Application:
General → Deploy to Multiple Servers: Enable
Select servers: Production-1, Production-2
```

**Deployment flow**:
1. Build on main server (or dedicated build server)
2. Push image to Docker registry
3. All servers pull image and deploy

**Use cases**:
- High availability
- Load balancing
- Geographic distribution

---

## Environment Variables & Build Configuration

### Build-Time vs Runtime Variables

**Critical Understanding**: Environment variables work differently during build vs runtime

#### Build-Time Variables

**When they're used**: During `npm install`, `npm run build`, etc.

**How to set in Coolify**:
```bash
# In Coolify:
Application → Environment Variables → Add Variable
Name: NEXT_PUBLIC_API_URL
Value: https://api.example.com
☑ Build Variable (CHECK THIS BOX)
```

**Examples that need build-time access**:
- `NEXT_PUBLIC_*` variables in Next.js
- API endpoints embedded in frontend
- Feature flags that affect build output

**Important**: Build variables are **embedded** in the final Docker image

#### Runtime Variables

**When they're used**: When container starts and runs

**How to set in Coolify**:
```bash
# In Coolify:
Application → Environment Variables → Add Variable
Name: DATABASE_URL
Value: postgresql://...
☐ Build Variable (UNCHECKED)
```

**Examples that need runtime access**:
- Database connection strings
- API keys
- Session secrets
- Feature flags that can change without rebuild

**Important**: Runtime variables are **injected** into container environment

### Nixpacks Configuration

**Nixpacks** is Coolify's default build pack (alternative to Dockerfile)

**Configuration file**: `nixpacks.toml` in repository root

**Example configuration**:
```toml
# nixpacks.toml

# Set Node.js version
[variables]
NIXPACKS_NODE_VERSION = "20"

# Install system packages
[phases.setup]
aptPkgs = ["python3", "build-essential", "libpq-dev"]

# Custom install command
[phases.install]
cmds = [
  "npm ci --prefer-offline --no-audit"
]

# Custom build command
[phases.build]
cmds = [
  "npm run build"
]

# Custom start command
[start]
cmd = "npm run start"
```

**Why use nixpacks.toml**:
- ✅ Version-controlled (in git)
- ✅ More reliable than environment variables
- ✅ Supports complex configurations
- ✅ Easier for team collaboration

### Environment Variable Injection

**How Coolify injects variables**:

1. **During Build** (if "Build Variable" checked):
   ```bash
   docker build --build-arg VAR_NAME=value ...
   ```

2. **During Runtime**:
   ```bash
   docker run -e VAR_NAME=value ...
   ```

3. **Via .env file** (for Docker Compose):
   ```bash
   # Coolify generates .env file with all runtime variables
   docker compose --env-file .env up
   ```

### Next.js Specific Configuration

**Problem**: Next.js requires some environment variables at build time

**Solution**: Use `NEXT_PUBLIC_` prefix for client-side variables

```bash
# Build-time (embedded in JavaScript bundle):
NEXT_PUBLIC_API_URL=https://api.example.com

# Runtime (server-side only):
DATABASE_URL=postgresql://...
SESSION_SECRET=...
```

**Important for Coolify**:
```bash
# Mark NEXT_PUBLIC_* as build variables:
☑ Build Variable

# Keep secrets as runtime variables:
☐ Build Variable
```

### Docker Compose Environment Variables

**How Docker Compose handles variables**:

```yaml
# docker-compose.yml
services:
  app:
    environment:
      # Direct value
      NODE_ENV: production

      # Reference from Coolify environment
      DATABASE_URL: ${DATABASE_URL}

      # With default
      PORT: ${PORT:-3000}
```

**Coolify creates `.env` file**:
```bash
# Auto-generated by Coolify:
DATABASE_URL=postgresql://...
PORT=3000
SECRET_KEY=...
```

**Important**: Don't use "Build Variable" checkbox for Docker Compose projects

---

## Persistent Storage & Data Management

### Volume Types in Coolify

#### Docker Volumes (Recommended)

**What they are**: Docker-managed storage outside containers

**Advantages**:
- ✅ Automatic UUID namespacing (prevents conflicts)
- ✅ Survives container deletion
- ✅ Portable across Docker hosts
- ✅ Coolify manages lifecycle

**Configuration**:
```bash
# In Coolify:
Application → Storage → Add Persistent Storage
Name: uploads
Mount Path: /app/uploads
Source: [auto-generated: UUID-uploads]
```

**Result**:
```bash
# Docker creates volume:
docker volume ls
# DRIVER    VOLUME NAME
# local     coolify-UUID-uploads

# Mounted in container at:
/app/uploads
```

#### Bind Mounts

**What they are**: Direct host filesystem paths mounted to containers

**Advantages**:
- ✅ Easy to access from host
- ✅ Direct file editing possible
- ✅ Familiar filesystem structure

**Disadvantages**:
- ❌ Path must exist on host
- ❌ Permission issues common
- ❌ Less portable

**Configuration**:
```bash
# In Coolify:
Application → Storage → Add Persistent Storage
Name: config
Mount Path: /app/config
Source: /opt/app-config  # Absolute path on host
```

### Persistence Across Redeployments

**Critical Understanding**: By default, container filesystems are ephemeral

**What's preserved**:
- ✅ Data in Docker volumes
- ✅ Data in bind mounts
- ✅ External databases

**What's lost on redeploy**:
- ❌ Files written to container filesystem (outside volumes)
- ❌ In-memory data
- ❌ Running processes

**Example problem**:
```bash
# User uploads file during runtime:
POST /api/upload → Saves to /app/uploads/image.jpg

# You redeploy application:
# Container is recreated → /app/uploads is empty!

# Solution: Configure persistent volume for /app/uploads
```

### Volume Naming & UUID Management

**Problem**: Coolify adds UUIDs to volume names to prevent collisions

**Example**:
```bash
# You configure:
Volume Name: postgres-data
Mount Path: /var/lib/postgresql/data

# Coolify creates:
Volume Name: coolify-m4s0kwo4kc4oooocck4sswc4-postgres-data
            └──────────┬──────────┘
                     UUID
```

**Why this matters**:
- Each deployment gets unique volumes
- Old volumes remain even after deletion
- Can lead to disk space issues over time

**Best Practice**: Use Coolify's volume cleanup tools periodically

### Volume Retention Issues

**Known Issue**: Some Coolify versions created new volumes on every redeploy

**Symptoms**:
```bash
docker volume ls
# Shows multiple volumes with different UUIDs:
coolify-old-uuid-postgres-data
coolify-new-uuid-postgres-data
```

**Fix**: Use persistent volume IDs (introduced in newer Coolify versions)

**Workaround** (older versions):
```bash
# Manually specify volume in docker-compose.yml:
services:
  db:
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
    external: true
    name: my-persistent-postgres-data
```

### File Permissions in Volumes

**Common Problem**: Container cannot write to volume

**Cause**: Host filesystem permissions don't match container user

**Example**:
```bash
# Container runs as user www-data (uid 33)
# Host directory owned by root (uid 0)
# Result: Permission denied
```

**Solutions**:

**Option 1: Fix host permissions**
```bash
sudo chown -R 33:33 /var/lib/docker/volumes/UUID-uploads/_data
```

**Option 2: Use Docker's user directive**
```yaml
# docker-compose.yml
services:
  app:
    user: "33:33"  # www-data
    volumes:
      - uploads:/app/uploads
```

**Option 3: Set permissions in Dockerfile**
```dockerfile
RUN mkdir -p /app/uploads && \
    chown -R www-data:www-data /app/uploads
```

---

## Health Checks & Monitoring

### Container Health Checks

**What they do**: Periodically check if container is running correctly

**How Traefik uses them**: Routes traffic only to healthy containers

**Configuration in Dockerfile**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

**Configuration in Coolify**:
```bash
# Application → Health Check
Enabled: ☑
Path: /api/health
Port: 3000
Response Code: 200
Interval: 30s
Timeout: 5s
Retries: 3
```

**Health Check Endpoint Example**:
```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database connectivity
    await db.query('SELECT 1');

    // Check critical services
    const checks = {
      database: 'ok',
      timestamp: new Date().toISOString(),
    };

    return Response.json(checks, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: 'unhealthy' },
      { status: 503 }
    );
  }
}
```

### Health Check Requirements

**Important**: Container must have `curl` or `wget` installed

```dockerfile
# If using Alpine:
RUN apk add --no-cache curl

# If using Debian/Ubuntu:
RUN apt-get update && apt-get install -y curl
```

### Monitoring Container Status

**Check container health**:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
# Shows:
# NAME                STATUS
# my-app             Up 2 hours (healthy)
# my-db              Up 2 hours (healthy)
```

**Check for unhealthy containers**:
```bash
docker ps --filter "health=unhealthy"
```

**View health check logs**:
```bash
docker inspect --format='{{json .State.Health}}' CONTAINER_NAME | jq
```

### Coolify's Built-in Monitoring

**What Coolify monitors**:
- ✅ Container status (running/stopped/restarting)
- ✅ CPU usage
- ✅ Memory usage
- ✅ Disk usage
- ✅ Network I/O
- ✅ Backup status (for databases)

**Alerts** (if configured):
- Email notifications
- Webhook notifications
- Slack/Discord integration

### Third-Party Monitoring

**Recommended tools for production**:

**Option 1: Netdata** (easy setup with Coolify)
```bash
# Deploy Netdata via Coolify:
Services → One Click Services → Netdata
```

**Option 2: Prometheus + Grafana**
```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
```

**Option 3: Uptime Kuma** (status page)
```bash
# Deploy via Coolify:
Services → One Click Services → Uptime Kuma
```

---

## Backup & Disaster Recovery

### Database Backup Strategies

#### Built-in Coolify Backup (Recommended)

**For standalone databases only**:

```bash
# In Coolify:
Database → Backups → Configure
Frequency: Daily
Time: 02:00 AM
Retention: 30 days
S3 Storage: Configure...
```

**S3 Configuration**:
```bash
# Coolify supports S3-compatible storage:
Provider: AWS S3 / Wasabi / Backblaze / MinIO
Region: us-east-1
Bucket: veritable-games-backups
Access Key: YOUR_ACCESS_KEY
Secret Key: YOUR_SECRET_KEY
```

**How it works**:
1. Coolify runs `pg_dump` in container
2. Compresses dump with gzip
3. Uploads to S3 via MinIO client (mc)
4. Deletes backups older than retention period

#### Manual Backup Script

**For Docker Compose databases or custom backup logic**:

```bash
#!/bin/bash
# /opt/backup-db.sh

BACKUP_DIR="/var/backups/veritable-games"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="postgres-UUID"  # Replace with actual container name
DB_NAME="veritable_games"
DB_USER="postgres"

mkdir -p $BACKUP_DIR

# Create backup
docker exec $CONTAINER pg_dump -U $DB_USER -Fc $DB_NAME | \
  gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://your-bucket/backups/

# Keep only last 30 days locally
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Schedule with cron**:
```bash
sudo chmod +x /opt/backup-db.sh

sudo crontab -e
# Add:
0 2 * * * /opt/backup-db.sh >> /var/log/db-backup.log 2>&1
```

### Application Data Backup

**What to backup**:
- Docker volumes (uploads, user data)
- Configuration files
- SSL certificates (if not using Let's Encrypt)

**Backup Docker volumes**:
```bash
#!/bin/bash
# Backup all application volumes

VOLUME_NAME="coolify-UUID-uploads"
BACKUP_DIR="/var/backups/volumes"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Stop container (optional, for consistency)
docker stop YOUR_CONTAINER

# Backup volume
docker run --rm \
  -v $VOLUME_NAME:/source:ro \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/${VOLUME_NAME}_$DATE.tar.gz -C /source .

# Restart container
docker start YOUR_CONTAINER

echo "Volume backed up to ${VOLUME_NAME}_$DATE.tar.gz"
```

### Restore Procedures

#### Restore Database from Backup

```bash
# Restore from gzipped SQL dump
gunzip -c backup_20251109_020000.sql.gz | \
  docker exec -i postgres-UUID psql -U postgres -d veritable_games

# Restore from custom format (pg_dump -Fc)
docker exec -i postgres-UUID pg_restore \
  -U postgres -d veritable_games -c /backup/backup.dump
```

#### Restore Docker Volume

```bash
# Extract volume backup
docker run --rm \
  -v coolify-UUID-uploads:/target \
  -v /var/backups/volumes:/backup:ro \
  alpine sh -c "cd /target && tar xzf /backup/volume_backup.tar.gz"
```

### Disaster Recovery Plan

**1. Regular Testing**:
```bash
# Quarterly: Test restore on separate environment
# Verify application functionality after restore
# Document any issues encountered
```

**2. Off-Site Backups**:
```bash
# Primary: S3 (or equivalent)
# Secondary: Different geographic region
# Tertiary: Local encrypted backup drive
```

**3. Recovery Time Objective (RTO)**:
```bash
# Define acceptable downtime
# Document step-by-step recovery procedures
# Maintain contact list for emergencies
```

**4. Backup Verification**:
```bash
# Automated checks:
# - Backup file size (should be consistent)
# - Backup file integrity (checksum)
# - S3 upload success confirmation
```

---

## Common Issues & Solutions

### Issue 1: Application Crash Loop After Redeploy

**Symptoms**:
```bash
docker ps
# Shows: Restarting (1) 3 seconds ago
```

**Common Causes**:

**Cause 1: Database Connection Failure**
```bash
# Check database container:
docker ps | grep postgres
# If stopped, start it:
docker start postgres-UUID

# Check connection string in environment:
docker inspect APP_CONTAINER | grep DATABASE_URL
```

**Cause 2: Missing Environment Variables**
```bash
# Container logs show:
Error: SESSION_SECRET is required

# Fix: Add missing environment variable in Coolify
```

**Cause 3: Port Already in Use**
```bash
# Check port availability:
sudo netstat -tulpn | grep 3000

# If port occupied, either:
# - Change application port in Coolify
# - Stop conflicting service
```

**Debugging**:
```bash
# View container logs:
docker logs YOUR_CONTAINER --tail 100

# Check container exit code:
docker inspect YOUR_CONTAINER --format='{{.State.ExitCode}}'
```

### Issue 2: Domain Returns 502 Bad Gateway

**Symptoms**:
- `https://www.example.com` returns 502
- `http://SERVER_IP:3000` works fine

**Root Cause**: Traefik routing misconfiguration

**Diagnosis Steps**:

**Step 1: Check FQDN Configuration**
```sql
docker exec -i coolify-db psql -U coolify -d coolify <<EOF
SELECT uuid, name, fqdn, ports_mappings
FROM applications
WHERE name = 'your-app-name';
EOF

-- If fqdn is NULL, that's the problem
```

**Step 2: Check Traefik Labels**
```bash
docker inspect YOUR_CONTAINER --format '{{range $key, $value := .Config.Labels}}{{if (hasPrefix $key "traefik")}}{{printf "%s = %s\n" $key $value}}{{end}}{{end}}' | grep rule
```

**Step 3: Check Traefik Logs**
```bash
docker logs coolify-proxy --tail 50 2>&1 | grep -i error
```

**Solutions**:

**Solution 1: Set FQDN**
```sql
docker exec -i coolify-db psql -U coolify -d coolify <<EOF
UPDATE applications
SET fqdn = 'www.example.com'
WHERE uuid = 'YOUR_UUID';
EOF
```

**Solution 2: Fix Port Configuration**
```bash
# In Coolify:
Application → General → Port Exposes: 3000
# Save and redeploy
```

**Solution 3: Check Network Configuration**
```bash
# Ensure app is listening on 0.0.0.0, not 127.0.0.1
# In Next.js: server.js or next.config.js
server: {
  host: '0.0.0.0',  // NOT 'localhost'
  port: 3000
}
```

### Issue 3: Build Fails with "next: not found"

**Symptoms**:
```bash
Build log shows:
npm i ran in root and only installed 1 package
next: not found
```

**Root Cause**: Base Directory not set for monorepo

**Solution**:
```bash
# In Coolify:
Application → General → Base Directory: frontend
# Save and redeploy
```

### Issue 4: Build Fails with Python/GCC Errors

**Symptoms**:
```bash
npm error gyp ERR! find Python
# OR
make: cc: No such file or directory
```

**Root Cause**: Native dependencies require build tools

**Solution**: Create `nixpacks.toml`
```toml
[phases.setup]
aptPkgs = ["python3", "build-essential"]
```

### Issue 5: Deployment Stuck in Queue

**Symptoms**:
```bash
# In Coolify:
Status: Queued
# For more than 5 minutes, doesn't progress
```

**Common Causes**:

**Cause 1: Previous Deployment Still Running**
```bash
# Check for running deployments:
docker ps | grep build

# If found, cancel it:
docker stop CONTAINER_ID
```

**Cause 2: Server at 100% CPU**
```bash
# Check CPU usage:
top
# Or:
htop

# If high, restart server or wait for completion
```

**Solution**:
```bash
# In Coolify:
Deployment → Cancel
# Then:
Deployment → Force Start
```

### Issue 6: Environment Variables Not Working

**Symptoms**:
```bash
console.log(process.env.MY_VAR)
// Prints: undefined
```

**Common Causes**:

**Cause 1: Build Variable Checkbox Incorrect**
```bash
# For runtime variables, ensure:
☐ Build Variable is UNCHECKED

# For build-time variables (Next.js NEXT_PUBLIC_*):
☑ Build Variable is CHECKED
```

**Cause 2: Next.js Requires Rebuild**
```bash
# NEXT_PUBLIC_* variables are embedded at build time
# Solution: Force rebuild without cache
Application → Force Deploy Without Cache
```

**Cause 3: Docker Compose Variable Syntax**
```yaml
# ❌ WRONG:
environment:
  MY_VAR: $MY_VAR  # Single $, may not interpolate

# ✅ CORRECT:
environment:
  MY_VAR: ${MY_VAR}  # Curly braces required
```

### Issue 7: Cannot Connect to Database

**Symptoms**:
```bash
Error: connect ECONNREFUSED
# OR
Error: getaddrinfo ENOTFOUND postgres-UUID
```

**Diagnosis**:

**Step 1: Verify Database Running**
```bash
docker ps | grep postgres
# Should show: Up X minutes (healthy)
```

**Step 2: Check Network Configuration**
```bash
# Both containers should be in same network:
docker inspect APP_CONTAINER | grep NetworkMode
docker inspect DB_CONTAINER | grep NetworkMode

# If different, enable "Connect to Predefined Network"
```

**Step 3: Verify Connection String**
```bash
# Should use UUID container name:
postgresql://user:pass@postgres-j4g44okskok04cks4kwogkkg:5432/db
                        └───────────┬───────────┘
                              Container name (not friendly name)
```

**Solution**:
```bash
# In Coolify:
1. Application → General → Connect to Predefined Network: Enable
2. Copy database connection string from:
   Database → Overview → Postgres URL (internal)
3. Update DATABASE_URL environment variable
4. Redeploy application
```

### Issue 8: Volume Data Lost After Redeploy

**Symptoms**:
```bash
# Uploaded files disappear after redeploy
# Database is empty after container recreation
```

**Root Cause**: Persistent volume not configured

**Solution**:
```bash
# In Coolify:
Application → Storage → Add Persistent Storage
Name: uploads
Mount Path: /app/uploads  # Where app writes files
Source: [auto-generated]

# Save and redeploy
```

**Verify Volume Persists**:
```bash
# Check volume exists:
docker volume ls | grep uploads

# Upload test file via application

# Redeploy application

# Verify file still exists:
docker exec YOUR_CONTAINER ls -la /app/uploads
```

---

## Production Best Practices

### 1. Database Configuration

**Use Standalone Databases for Production**:
```bash
# ✅ DO: Create database via Coolify UI
Database → New Database → PostgreSQL 15

# ❌ DON'T: Embed database in docker-compose.yml for production
```

**Enable Automated Backups**:
```bash
Database → Backups
Frequency: Daily
Time: 02:00 (low-traffic period)
Retention: 30 days minimum
S3 Storage: Configure
```

**Use Connection Pooling**:
```bash
# PostgreSQL configuration:
max_connections = 100
shared_buffers = 256MB

# Application configuration (Node.js example):
POSTGRES_POOL_MAX=10
POSTGRES_POOL_MIN=2
POSTGRES_CONNECTION_TIMEOUT=30000
```

### 2. Environment Variables

**Secrets Management**:
```bash
# ✅ DO: Use strong random secrets
SESSION_SECRET=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# ❌ DON'T: Use simple/predictable secrets
SESSION_SECRET=my-secret-key  # BAD
```

**Environment Variable Organization**:
```bash
# Group by category:
# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_SIZE=10

# Authentication
SESSION_SECRET=...
CSRF_SECRET=...
JWT_SECRET=...

# External Services
SMTP_HOST=...
S3_BUCKET=...
```

### 3. Resource Limits

**Set Container Resource Limits**:
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

**Monitor Resource Usage**:
```bash
# Check container resource usage:
docker stats

# Set up alerts for high usage:
# - CPU > 80% for 5 minutes
# - Memory > 90%
# - Disk > 85%
```

### 4. Health Checks

**Implement Comprehensive Health Checks**:
```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    storage: await checkStorage(),
    timestamp: new Date().toISOString(),
  };

  const allHealthy = Object.values(checks)
    .filter(v => typeof v === 'string')
    .every(v => v === 'ok');

  return Response.json(checks, {
    status: allHealthy ? 200 : 503
  });
}
```

### 5. Logging

**Structured Logging**:
```typescript
// Use structured logs for easier parsing
logger.info('User logged in', {
  userId: user.id,
  timestamp: Date.now(),
  ip: request.ip
});
```

**Log Retention**:
```bash
# Configure Docker log rotation:
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 6. Security

**Use HTTPS Only**:
```bash
# In Coolify:
Application → General → Force HTTPS: Enable
```

**Security Headers**:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Strict-Transport-Security', 'max-age=31536000');

  return NextResponse.next({ headers });
}
```

**Regular Updates**:
```bash
# Monthly security updates:
npm audit
npm audit fix

# Update dependencies:
npm update

# Update Coolify:
# Coolify auto-updates, or manually:
docker exec coolify-coolify-1 php artisan update
```

### 7. Deployment Strategy

**Use Git Tags for Versioning**:
```bash
# Create release tag:
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# In Coolify, you can deploy specific tags
```

**Staged Rollouts**:
```bash
# Deploy to staging first:
Branch: staging → Auto-deploy to staging environment

# After testing, merge to main:
Branch: main → Auto-deploy to production
```

**Rollback Plan**:
```bash
# Keep previous container images:
# In Coolify settings:
Image Retention: 5 versions

# To rollback:
Application → Deployments → History → Deploy Previous Version
```

### 8. Monitoring & Alerts

**Set Up Uptime Monitoring**:
```bash
# Use services like:
# - UptimeRobot (free tier)
# - Uptime Kuma (self-hosted)
# - Pingdom
# - StatusCake
```

**Configure Alerts**:
```bash
# In Coolify:
Settings → Notifications
Email: your-email@example.com
Webhook: https://hooks.slack.com/...

Alert on:
☑ Deployment failures
☑ Container crashes
☑ Disk space > 85%
☑ Backup failures
```

### 9. Documentation

**Maintain Deployment Documentation**:
```markdown
# DEPLOYMENT.md

## Production Environment

- URL: https://www.example.com
- Server: 192.168.1.15
- Coolify: http://192.168.1.15:8000

## Deployment Process

1. Create PR with changes
2. Merge to main after review
3. Automatic deployment via webhook
4. Monitor deployment logs
5. Verify deployment on production

## Rollback Procedure

1. Coolify → Application → Deployments → History
2. Select previous successful deployment
3. Click "Redeploy"
4. Monitor rollback completion

## Emergency Contacts

- DevOps: devops@example.com
- Database Admin: dba@example.com
```

---

## Complete Implementation Checklist

### Pre-Deployment

- [ ] Server provisioned (Ubuntu 22.04 LTS recommended)
- [ ] Docker installed
- [ ] Coolify installed and accessible
- [ ] GitHub repository connected
- [ ] Base directory configured (for monorepos)
- [ ] nixpacks.toml created (if needed for native dependencies)

### Database Setup

- [ ] PostgreSQL database created
- [ ] Strong password generated
- [ ] Connection string copied
- [ ] DATABASE_URL environment variable set
- [ ] Database backups configured
- [ ] S3 storage configured (for backups)
- [ ] Test backup/restore procedure

### Application Configuration

- [ ] FQDN configured (if using domain routing)
- [ ] Port mapping set (3000:3000 or as needed)
- [ ] Environment variables configured:
  - [ ] SESSION_SECRET
  - [ ] CSRF_SECRET
  - [ ] ENCRYPTION_KEY
  - [ ] DATABASE_URL
  - [ ] NODE_ENV=production
- [ ] Build variables marked correctly (NEXT_PUBLIC_* etc.)
- [ ] Persistent volumes configured:
  - [ ] Uploads directory
  - [ ] User data directory
  - [ ] Any other stateful directories
- [ ] Health check endpoint implemented
- [ ] Health check configured in Coolify

### Network & Routing

- [ ] Traefik labels verified
- [ ] FQDN properly set in database
- [ ] Domain DNS configured (if using domain)
- [ ] SSL certificate generated (Let's Encrypt)
- [ ] Force HTTPS enabled
- [ ] "Connect to Predefined Network" enabled (if needed)

### Security

- [ ] Strong secrets generated (64+ characters)
- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Firewall configured (UFW or equivalent)
- [ ] SSH key authentication only (disable password auth)
- [ ] fail2ban installed and configured
- [ ] Regular security updates scheduled

### Monitoring & Alerts

- [ ] Health checks enabled
- [ ] Uptime monitoring configured
- [ ] Email alerts configured
- [ ] Webhook notifications set up (Slack/Discord)
- [ ] Log aggregation configured
- [ ] Resource monitoring enabled

### Backup & Recovery

- [ ] Database backups scheduled
- [ ] Volume backups scheduled
- [ ] Off-site backup storage configured
- [ ] Backup verification automated
- [ ] Restore procedure tested
- [ ] Disaster recovery plan documented

### Testing

- [ ] Application accessible via domain
- [ ] Application accessible via IP (if configured)
- [ ] Database connectivity verified
- [ ] File uploads persist across redeploys
- [ ] Environment variables accessible
- [ ] Health check endpoint returns 200
- [ ] SSL certificate valid
- [ ] Automatic deployments working (webhook)
- [ ] Rollback procedure tested

### Documentation

- [ ] Deployment procedure documented
- [ ] Environment variables documented
- [ ] Rollback procedure documented
- [ ] Emergency contact list created
- [ ] Architecture diagram created
- [ ] Monitoring access documented

### Post-Deployment

- [ ] Monitor deployment logs for first 24 hours
- [ ] Verify backups running successfully
- [ ] Test all critical application features
- [ ] Load testing performed (if high traffic expected)
- [ ] Performance baseline established
- [ ] Incident response plan reviewed

---

## Comparison: Before vs After Correct Configuration

### Before (Broken Configuration)

```yaml
# Coolify Database State:
applications:
  uuid: m4s0kwo4kc4oooocck4sswc4
  name: veritable-games
  fqdn: NULL  # ← PROBLEM
  ports_mappings: "3000:3000"

# Generated Traefik Labels (BROKEN):
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(``) && PathPrefix(`m4s0kwo4kc4oooocck4sswc4.sslip.io`)
                                                                   └─────┬─────┘
                                                                  EMPTY - Error!

# Result:
# ❌ Domain access: 502 Bad Gateway
# ✅ IP access: Works (via direct port)
# Traefik logs: "error: empty args for matcher Host"
```

### After (Correct Configuration)

```yaml
# Coolify Database State:
applications:
  uuid: m4s0kwo4kc4oooocck4sswc4
  name: veritable-games
  fqdn: www.veritablegames.com  # ← FIXED
  ports_mappings: "3000:3000"

# Generated Traefik Labels (CORRECT):
traefik.http.routers.http-0-m4s0kwo4kc4oooocck4sswc4.rule = Host(`www.veritablegames.com`)
                                                                   └──────────┬──────────┘
                                                                        Proper domain

# Result:
# ✅ Domain access: Works
# ✅ IP access: Works (via direct port)
# Traefik logs: No errors, routing successful
```

---

## Summary

This guide provides comprehensive coverage of Coolify's architecture, configuration, and troubleshooting procedures. Key takeaways:

1. **Database Management**: Use standalone databases with GUI backup management for production
2. **Network Architecture**: Understand UUID-based network isolation and "Connect to Predefined Network"
3. **Traefik Routing**: FQDN configuration is critical for domain routing
4. **Environment Variables**: Distinguish between build-time and runtime variables
5. **Persistent Storage**: Configure Docker volumes to prevent data loss
6. **Health Checks**: Implement comprehensive health endpoints for reliability
7. **Backups**: Automate database and volume backups with S3 storage
8. **Monitoring**: Set up alerts and health checks for production deployments

**For Veritable Games Platform Specifically**:
- Base Directory: `frontend`
- Build Dependencies: nixpacks.toml with python3 and build-essential
- Database: PostgreSQL 15 (standalone)
- Persistent Volumes: Uploads, user data, wiki content
- Health Check: /api/health endpoint

**Related Documentation**:
- [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./deployment/COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md) - Real-world deployment experience
- [COOLIFY_LOCAL_HOSTING_GUIDE.md](./deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md) - Step-by-step setup guide
- [CLOUDFLARE_DOMAIN_ROUTING_FIX.md](./deployment/CLOUDFLARE_DOMAIN_ROUTING_FIX.md) - Domain routing troubleshooting

---

**Document Version**: 1.0
**Last Updated**: November 9, 2025
**Status**: Complete and Production-Ready
