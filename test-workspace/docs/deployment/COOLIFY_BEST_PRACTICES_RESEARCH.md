# Coolify Best Practices Research

**Research Date**: November 9, 2025
**Purpose**: Solutions for Coolify deployment issues with domain routing and database connectivity

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Coolify Database Management](#coolify-database-management)
3. [Docker Networking Best Practices](#docker-networking-best-practices)
4. [Traefik Configuration in Coolify](#traefik-configuration-in-coolify)
5. [PostgreSQL in Docker/Coolify](#postgresql-in-dockercoolify)
6. [Common Issues and Solutions](#common-issues-and-solutions)
7. [Recommended Architecture Patterns](#recommended-architecture-patterns)
8. [Code Examples and Configurations](#code-examples-and-configurations)
9. [Resources and Documentation](#resources-and-documentation)

---

## Executive Summary

### Key Findings

1. **Database Network Isolation**: Coolify creates separate networks for each Docker Compose stack, which can prevent application-database communication
2. **Traefik Label Generation**: Coolify sometimes generates malformed Traefik labels causing routing failures
3. **Standalone vs Composed Resources**: Mixing standalone databases with Docker Compose applications requires special network configuration
4. **Persistence Issues**: PostgreSQL requires proper volume mounting to `/var/lib/postgresql/data`

### Critical Discovery

**90% of connection issues are firewall-related**, not configuration problems. However, the remaining 10% are architecture issues that require specific solutions.

---

## Coolify Database Management

### How Coolify Manages Databases

Coolify provides two approaches for database deployment:

#### 1. Standalone Databases (Recommended for Most Cases)

**How it works**:
- One-click deployment from "New Resource" menu
- Automatically configured with credentials
- Runs on Coolify's predefined network
- Built-in backup management via GUI
- Automatic SSL certificate management

**Pros**:
- Simple setup
- GUI-based backup scheduling
- Automatic network exposure to other resources
- Managed updates and monitoring

**Cons**:
- Less control over configuration
- Must use "Connect to Predefined Network" for Docker Compose apps
- Requires UUID-based service names for cross-stack connections

**Source**: [Coolify Database Documentation](https://coolify.io/docs/databases/)

#### 2. Database in Docker Compose

**How it works**:
- Database defined in `docker-compose.yml`
- Full control over configuration
- Runs in isolated network with application
- Manual backup configuration

**Pros**:
- Complete configuration control
- Application and database share network automatically
- Source of truth in version control
- No UUID-based naming required

**Cons**:
- No GUI backup management
- Must configure backups manually
- Requires understanding of Docker networking
- More complex troubleshooting

**Source**: [Coolify Docker Compose Documentation](https://coolify.io/docs/knowledge-base/docker/compose)

### Database Provisioning Methods

Coolify supports automatic provisioning for:
- PostgreSQL
- MySQL/MariaDB
- MongoDB
- Redis/KeyDB/DragonFly
- ClickHouse

**Auto-generated credentials** include:
- Instance name
- Username
- Password
- Connection URLs (internal and public)
- SSL configuration

**Source**: [Coolify Database Introduction](https://coolify.io/docs/databases/)

### Network Integration Best Practices

#### For Standalone Database + Application

```bash
# 1. Create standalone PostgreSQL database via Coolify GUI
# 2. Note the generated UUID (e.g., postgres-abc123)
# 3. In your application configuration:
#    - Enable "Connect to Predefined Network"
#    - Use connection string: postgresql://user:pass@postgres-abc123:5432/dbname
```

**Critical**: You MUST use the full service name with UUID when connecting across networks.

**Source**: [Coolify Discussion #2925](https://github.com/coollabsio/coolify/discussions/2925)

#### For Docker Compose with Database

```yaml
# docker-compose.yml
services:
  app:
    image: myapp:latest
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/dbname
    networks:
      - app-network

  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
```

**Note**: By default, each compose stack gets its own network (named with resource UUID). Services within the stack can communicate using service names.

**Source**: [Coolify Docker Compose Networking](https://coolify.io/docs/knowledge-base/docker/compose)

### Internal vs Public Database URLs

Coolify provides two connection URLs:

#### Internal URL (Recommended)
- Format: `postgresql://user:pass@servicename:5432/dbname`
- Only works within Docker network
- No port exposure required
- Faster (no proxy overhead)
- More secure

#### Public URL
- Exposes database to internet (or local network)
- Requires port mapping or Nginx TCP proxy
- Should be avoided for production
- Use SSH tunneling for external access instead

**Best Practice**: Always use internal URLs for application-database connections within Coolify.

**Source**: [Using Postgres on Coolify and Internal Database URL](https://zixianchen.com/blog/using-postgres-coolify-internal-database-url)

---

## Docker Networking Best Practices

### Coolify's Network Architecture

Coolify uses a sophisticated multi-network approach:

```
┌─────────────────────────────────────────────┐
│ Coolify Network Architecture                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │   Traefik    │      │   Coolify    │    │
│  │   Proxy      │◄────►│   Control    │    │
│  └──────────────┘      └──────────────┘    │
│         │                                   │
│         │ (coolify-proxy network)           │
│         │                                   │
│         ├──────────────┬──────────────┐    │
│         │              │              │     │
│  ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼────┐│
│  │ App Stack  │ │ Database   │ │ Service ││
│  │ (UUID-net) │ │ (predefined│ │ (UUID)  ││
│  └────────────┘ └────────────┘ └─────────┘│
│                                             │
└─────────────────────────────────────────────┘
```

**Key Networks**:
1. **coolify-proxy**: Traefik and exposed services
2. **Predefined network**: Standalone databases and resources
3. **Resource-specific networks**: Each compose stack (named with UUID)

**Source**: [Coolify Architecture](https://docs.coollabs.io/coolify/v3/architecture)

### Network Communication Patterns

#### Pattern 1: Within Same Docker Compose Stack

```yaml
services:
  app:
    image: myapp
    environment:
      DB_HOST: postgres  # Just use service name

  postgres:
    image: postgres:15
```

**Works because**: Docker Compose creates default network where services resolve by name.

#### Pattern 2: Across Different Stacks

```yaml
# Application stack
services:
  app:
    image: myapp
    environment:
      # Must use full name with UUID
      DB_HOST: postgres-abc123def456
    labels:
      - "coolify.connect_to_predefined_network=true"
```

**Requires**: Enabling "Connect to Predefined Network" option in Coolify UI.

**Source**: [Coolify Docker Compose Documentation](https://coolify.io/docs/knowledge-base/docker/compose)

#### Pattern 3: Service Isolation

```yaml
networks:
  frontend:
  backend:

services:
  proxy:
    networks:
      - frontend

  app:
    networks:
      - frontend
      - backend

  database:
    networks:
      - backend
```

**Use case**: Security isolation where proxy can't directly access database.

**Source**: [Docker Networking Documentation](https://docs.docker.com/compose/how-tos/networking/)

### Bridge vs Overlay Networks

#### Bridge Networks (Default in Coolify)
- **Use case**: Single-host deployments
- **Performance**: Faster (no encryption overhead)
- **Scope**: Limited to one Docker host
- **When to use**: All Coolify deployments on single server

#### Overlay Networks
- **Use case**: Multi-host Docker Swarm
- **Performance**: Slower (encryption overhead)
- **Scope**: Spans multiple Docker hosts
- **When to use**: NOT applicable to Coolify (not Swarm-based)

**Recommendation**: Stick with bridge networks for Coolify. Overlay networks are unnecessary complexity.

**Source**: [Docker Networking Best Practices](https://docs.docker.com/compose/how-tos/networking/)

### Container DNS Resolution

Docker provides automatic DNS resolution within networks:

```bash
# From inside 'app' container:
ping postgres          # Resolves to postgres container IP
ping postgres-abc123   # Resolves if on predefined network
ping 192.168.1.15      # Resolves to host machine
```

**Port Handling**:
- **CONTAINER_PORT**: Used for inter-container communication (e.g., 5432)
- **HOST_PORT**: Used for external access (e.g., 5433:5432 mapping)

**Critical**: Never use `localhost` or `127.0.0.1` for inter-container communication. Always use service names or container names.

**Source**: [Docker Networking](https://docs.docker.com/compose/how-tos/networking/)

---

## Traefik Configuration in Coolify

### How Coolify Generates Traefik Labels

Coolify automatically generates Traefik labels based on:
1. FQDN configuration
2. Port configuration
3. Network settings
4. SSL certificate settings

**Example auto-generated labels**:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myapp-abc123.rule=Host(`example.com`)"
  - "traefik.http.routers.myapp-abc123.entrypoints=https"
  - "traefik.http.routers.myapp-abc123.tls=true"
  - "traefik.http.routers.myapp-abc123.tls.certresolver=letsencrypt"
  - "traefik.http.services.myapp-abc123.loadbalancer.server.port=3000"
```

**Source**: [Coolify Traefik Overview](https://coolify.io/docs/knowledge-base/proxy/traefik/overview)

### Label-Based vs File-Based Routing

Coolify primarily uses **label-based routing**:

#### Label-Based (Coolify Default)
- **Pros**: Dynamic, updated on container restart, easy to manage
- **Cons**: Requires container restart for changes, can be overwritten by Coolify

#### File-Based
- **Pros**: Persistent across restarts, can be edited manually
- **Cons**: Requires manual management, bypasses Coolify automation

**Recommendation**: Use label-based routing (Coolify's default) unless you have specific needs for manual control.

**Workaround for manual control**:
```yaml
# Create /etc/traefik/dynamic/custom-routes.yml
http:
  routers:
    myapp-manual:
      rule: "Host(`example.com`)"
      service: myapp-service
      entryPoints:
        - https
      tls:
        certResolver: letsencrypt

  services:
    myapp-service:
      loadBalancer:
        servers:
          - url: "http://container-name:3000"
```

**Source**: [Fixing Traefik Misconfiguration](https://dev.to/danielbetterdevelopers/fixing-traefik-misconfiguration-when-changing-domains-2kof)

### Common FQDN Configuration Issues

#### Issue 1: Malformed Host Rule

**Problem**:
```
Traefik error: Host(``) && PathPrefix(`example.com`)
```

**Correct**:
```
Host(`example.com`)
```

**Cause**: Coolify bug in versions beta.418 and beta.434 where FQDN is treated as PathPrefix instead of Host.

**Solution**:
1. Update Coolify to latest version
2. Manually fix Traefik labels if issue persists:
   ```yaml
   labels:
     - "traefik.http.routers.myapp.rule=Host(`example.com`)"
   ```

**Source**: [GitHub Issue #5813](https://github.com/coollabsio/coolify/issues/5813), [GitHub Issue #6877](https://github.com/coollabsio/coolify/issues/6877)

#### Issue 2: Empty Host with Domain as PathPrefix

**Problem**: Domain shows as PathPrefix instead of Host
**Root Cause**: FQDN field left empty or improperly configured

**Solution**:
1. Set FQDN in Coolify UI to exact domain (e.g., `www.example.com`)
2. Ensure no trailing slashes
3. Redeploy application
4. Verify Traefik labels: `docker inspect <container> | grep traefik`

**Source**: [GitHub Issue #5814](https://github.com/coollabsio/coolify/issues/5814)

#### Issue 3: Multiple Domains/Routing Rules

**Pattern for multiple domains**:
```yaml
labels:
  - "traefik.http.routers.myapp.rule=Host(`example.com`) || Host(`www.example.com`)"
```

**Pattern for path-based routing**:
```yaml
labels:
  - "traefik.http.routers.api.rule=Host(`example.com`) && PathPrefix(`/api`)"
  - "traefik.http.routers.web.rule=Host(`example.com`) && PathPrefix(`/`)"
```

**Source**: [Coolify Traefik Redirects](https://coolify.io/docs/knowledge-base/proxy/traefik/redirects)

### Wildcard SSL Certificates

For SaaS applications with dynamic subdomains:

```yaml
labels:
  - "traefik.http.routers.myapp.rule=HostRegexp(`{subdomain:[a-zA-Z0-9-]+}.example.com`)"
  - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
  - "traefik.http.routers.myapp.tls.domains[0].main=example.com"
  - "traefik.http.routers.myapp.tls.domains[0].sans=*.example.com"
```

**Requires**: DNS challenge for wildcard cert (HTTP challenge won't work)

**Source**: [Coolify Wildcard SSL Certificates](https://coolify.io/docs/knowledge-base/proxy/traefik/wildcard-certs)

### Debugging Traefik Routing

#### Check Traefik Dashboard
```bash
# Enable Traefik dashboard in Coolify settings
# Access at: http://your-server:8080
```

#### Inspect Container Labels
```bash
docker inspect <container-id> | grep -A 20 traefik
```

#### Check Traefik Logs
```bash
docker logs coolify-proxy --tail 100 -f
```

#### Test DNS Resolution
```bash
nslookup example.com
dig example.com
```

#### Verify Port Binding
```bash
docker ps | grep <container-name>
# Should show port mapping if exposed
```

**Source**: [Coolify Troubleshooting](https://coolify.io/docs/troubleshoot/applications/gateway-timeout)

---

## PostgreSQL in Docker/Coolify

### Running PostgreSQL Without Breaking on Redeployments

#### Problem: Data Loss on Redeploy

**Root Cause**: PostgreSQL data directory not properly persisted

**Solution**: Named volumes

```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      # CRITICAL: Must mount to /var/lib/postgresql/data
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_DB: ${DB_NAME}

volumes:
  postgres-data:
    # Named volume managed by Docker
    # Persists across container recreations
```

**Why it works**: Docker manages named volumes separately from containers. Even if container is deleted, volume persists.

**Source**: [How to persist data in dockerized postgres](https://stackoverflow.com/questions/41637505/how-to-persist-data-in-a-dockerized-postgres-database-using-volumes)

#### Problem: Connection Refused After Redeploy

**Root Cause**: Application starts before PostgreSQL is ready

**Solution**: Health checks and depends_on

```yaml
services:
  postgres:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  app:
    depends_on:
      postgres:
        condition: service_healthy
```

**Why it works**: Application waits for PostgreSQL to be fully initialized before starting.

**Source**: [Coolify Health Checks](https://coolify.io/docs/knowledge-base/health-checks)

#### Problem: Network Changes After Redeploy

**Root Cause**: Coolify recreates networks with different names/IDs

**Solution**: Use service discovery instead of IPs

```bash
# ❌ WRONG: Hardcoded IP
DATABASE_URL=postgresql://user:pass@172.18.0.2:5432/db

# ✅ CORRECT: Service name
DATABASE_URL=postgresql://user:pass@postgres:5432/db

# ✅ ALSO CORRECT: Standalone database with UUID
DATABASE_URL=postgresql://user:pass@postgres-abc123:5432/db
```

**Why it works**: Docker DNS resolution always resolves service names, even if IPs change.

**Source**: [Docker Networking](https://docs.docker.com/compose/how-tos/networking/)

### Volume Mounting Strategies

#### Strategy 1: Named Volumes (Recommended)

```yaml
volumes:
  postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

**Pros**:
- Managed by Docker
- Portable across hosts
- Easy backup with `docker volume` commands
- Survives container deletion

**Cons**:
- Not easily accessible from host
- Requires Docker commands for backup/restore

**Use case**: Production deployments, best data safety

#### Strategy 2: Bind Mounts

```yaml
volumes:
  - ./postgres-data:/var/lib/postgresql/data
```

**Pros**:
- Direct access from host filesystem
- Easy manual backups
- Can edit files directly

**Cons**:
- Permission issues on host
- Less portable
- Must be backed up separately

**Use case**: Development, when you need direct file access

#### Strategy 3: Named Volume with Bind Mount for Backups

```yaml
volumes:
  - postgres-data:/var/lib/postgresql/data
  - ./backups:/backups

volumes:
  postgres-data:
```

**Pros**:
- Best of both worlds
- Safe primary storage
- Easy backup access

**Cons**:
- Slightly more complex

**Use case**: Production with automated backups

**Source**: [Best Practices for Running PostgreSQL in Docker](https://pankajconnect.medium.com/best-practices-for-running-postgresql-in-docker-containers-409c21dfb2cc)

### Connection Pooling and Initialization

#### Using PgBouncer with Coolify

```yaml
# docker-compose.yml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: ${DB_USER}
      DATABASES_PASSWORD: ${DB_PASSWORD}
      DATABASES_DBNAME: ${DB_NAME}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 100
      DEFAULT_POOL_SIZE: 20
    depends_on:
      - postgres

  app:
    environment:
      # Application uses pooler
      DATABASE_URL: postgresql://user:pass@pgbouncer:5432/db
      # Migrations use direct connection
      DIRECT_DATABASE_URL: postgresql://user:pass@postgres:5432/db
```

**Benefits**:
- Reduced connection overhead
- Better handling of connection spikes
- Prevents "too many connections" errors

**Source**: [How to install and run PgBouncer via Coolify](https://www.nico.fyi/blog/how-to-install-run-pgbouncer-via-coolify)

#### Database Initialization Scripts

```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
```

**init-scripts/01-init.sql**:
```sql
-- Runs ONLY on first initialization (when data dir is empty)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application schema
CREATE SCHEMA IF NOT EXISTS app;
```

**Important**: Init scripts only run when data directory is empty (first start).

**Source**: [How to properly initialize a Dockerized PostgreSQL database on Coolify](https://stackoverflow.com/questions/79632993/how-to-properly-initialize-a-dockerized-postgresql-database-on-coolify-with-cust)

### Backup and Restore

#### Coolify Managed Backups (Standalone Database)

```bash
# Enable in Coolify UI:
# Database > Configuration > Backups
# - Enable backups
# - Set S3 credentials
# - Set schedule (cron expression)
```

**Coolify creates**:
- Automatic scheduled backups
- Stored in S3-compatible storage
- One-click restore via GUI

**Limitation**: Only works with standalone databases, not Docker Compose databases.

**Source**: [Setting up PostgreSQL and backups on S3 with Coolify](https://eventuallymaking.io/2024/11/coolify-pgsql-s3)

#### Manual Backups (Docker Compose)

```bash
# Create backup
docker exec postgres-container pg_dump -U user -Fc dbname > backup.dump

# Restore backup
docker exec -i postgres-container pg_restore -U user -d dbname < backup.dump
```

**Automated backup script**:
```bash
#!/bin/bash
# backup-postgres.sh

CONTAINER_NAME="postgres-abc123"
DB_USER="myuser"
DB_NAME="mydb"
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

docker exec $CONTAINER_NAME pg_dump -U $DB_USER -Fc $DB_NAME > \
  $BACKUP_DIR/backup_${DB_NAME}_${DATE}.dump

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.dump" -mtime +7 -delete
```

**Source**: [How to persist and backup data of PostgreSQL Docker container](https://medium.com/codex/how-to-persist-and-backup-data-of-a-postgresql-docker-container-9fe269ff4334)

---

## Common Issues and Solutions

### Issue 1: "Connection Refused" to Database

#### Symptoms
- Application logs show: `ECONNREFUSED 127.0.0.1:5432`
- Database container is running
- Can connect from host machine

#### Root Causes

**Cause A**: Using `localhost` or `127.0.0.1`
```bash
# ❌ WRONG
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# ✅ CORRECT
DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

**Cause B**: Containers on different networks
```bash
# Check networks
docker inspect app-container | grep NetworkMode
docker inspect postgres-container | grep NetworkMode

# If different, enable "Connect to Predefined Network" in Coolify
```

**Cause C**: Application starts before database ready
```yaml
# Add healthcheck and depends_on (see PostgreSQL section)
```

**Source**: [Coolify Discussion #2925](https://github.com/coollabsio/coolify/discussions/2925)

### Issue 2: "Bad Gateway" After Deployment

#### Symptoms
- Application deployed successfully
- Traefik shows "502 Bad Gateway"
- Container is running and healthy

#### Root Causes

**Cause A**: Application listening on wrong address
```javascript
// ❌ WRONG: Only accessible from inside container
app.listen(3000, 'localhost');

// ✅ CORRECT: Accessible from Docker network
app.listen(3000, '0.0.0.0');
```

**Cause B**: Malformed Traefik labels
```bash
# Check labels
docker inspect container | grep traefik.http.routers

# Should show: Host(`example.com`)
# Not: Host(``) && PathPrefix(`example.com`)
```

**Cause C**: Wrong port in Traefik loadbalancer
```yaml
labels:
  # Must match container's listening port
  - "traefik.http.services.myapp.loadbalancer.server.port=3000"
```

**Solution**: Update Coolify, verify FQDN configuration, manually fix labels if needed.

**Source**: [How to Fix Coolify Bad Gateway Error](https://www.edopedia.com/blog/how-to-fix-coolify-bad-gateway-error/)

### Issue 3: Data Lost After Redeploy

#### Symptoms
- Fresh database after each deployment
- All data gone
- Migrations run again

#### Root Causes

**Cause A**: No volume persistence
```yaml
# ❌ WRONG: No volume
services:
  postgres:
    image: postgres:15
    # Data stored in container filesystem - deleted on redeploy

# ✅ CORRECT: Named volume
services:
  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

**Cause B**: Volume mounted to wrong path
```yaml
# ❌ WRONG: Parent directory
volumes:
  - postgres-data:/var/lib/postgresql

# ✅ CORRECT: Data directory
volumes:
  - postgres-data:/var/lib/postgresql/data
```

**Cause C**: Volume deleted manually
```bash
# Check if volume exists
docker volume ls | grep postgres

# If missing, was deleted - restore from backup
```

**Source**: [How to persist data in dockerized postgres](https://dev.to/iamrj846/how-to-persist-data-in-a-dockerized-postgres-database-using-volumes-15f0)

### Issue 4: Network Changes After Redeploy

#### Symptoms
- Application can't find database after redeploy
- Connection string unchanged
- Worked before redeploy

#### Root Causes

**Cause A**: Using IP addresses instead of service names
```bash
# ❌ WRONG: Hardcoded IP (changes on redeploy)
DATABASE_URL=postgresql://user:pass@172.18.0.2:5432/db

# ✅ CORRECT: Service name (DNS resolution)
DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

**Cause B**: Network UUID changed
```bash
# If using standalone database, UUID is stable
# If using compose database, service name is stable
# Only issue if manually specifying network names
```

**Solution**: Always use service names, never IPs. Docker DNS handles resolution.

### Issue 5: "Too Many Connections" Errors

#### Symptoms
- Application crashes under load
- PostgreSQL error: "FATAL: too many connections"
- Works fine with low traffic

#### Root Causes

**Cause A**: No connection pooling
```javascript
// ❌ WRONG: New connection per request
app.get('/api/users', async (req, res) => {
  const client = await pool.connect();
  // Connection never released properly
});

// ✅ CORRECT: Proper connection management
app.get('/api/users', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users');
    res.json(result.rows);
  } finally {
    client.release(); // Always release
  }
});
```

**Cause B**: Too many application instances
```yaml
# Each instance creates max_connections
# 3 instances × 20 connections = 60 connections
# PostgreSQL default max: 100

# Solution: Use PgBouncer (see PostgreSQL section)
```

**Cause C**: Connection leaks in code
```javascript
// ❌ WRONG: Connection not released on error
const result = await client.query('SELECT * FROM users');
client.release();

// ✅ CORRECT: Always release, even on error
try {
  const result = await client.query('SELECT * FROM users');
  return result;
} finally {
  client.release();
}
```

**Source**: [Best Practices for Running PostgreSQL in Docker](https://sliplane.io/blog/best-practices-for-postgres-in-docker)

### Issue 6: Firewall Blocking Connections

#### Symptoms
- Coolify connection unstable
- Random disconnections
- "Connection timed out" errors

#### Diagnosis

```bash
# Check UFW status
sudo ufw status numbered

# Check iptables
sudo iptables -L -v -n

# Check logs
tail -f /var/log/ufw.log
tail -f /var/log/auth.log
```

#### Common Issues

**Issue A**: Rate limiting SSH connections
```bash
# UFW LIMIT rule blocks too many connections
# Shows in logs as: [UFW BLOCK]

# Solution: Adjust UFW rules or use SSH keys
```

**Issue B**: Docker network conflicts with firewall
```bash
# Docker creates iptables rules that conflict with UFW

# Solution: Configure Docker to work with UFW
# /etc/docker/daemon.json
{
  "iptables": true,
  "ip-forward": true
}

sudo systemctl restart docker
```

**Source**: [Coolify Connection Unstable Troubleshooting](https://coolify.io/docs/troubleshoot/server/connection-issues)

---

## Recommended Architecture Patterns

### Pattern 1: Simple Single-App Deployment

**Use case**: Single application with database

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    environment:
      DATABASE_URL: postgresql://user:${DB_PASSWORD}@postgres:5432/mydb
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`example.com`)"
      - "traefik.http.routers.myapp.entrypoints=https"
      - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres-data:
```

**Pros**:
- Self-contained
- Easy to understand
- All configuration in one file

**Cons**:
- No GUI backup management
- Manual SSL configuration for database

**Best for**: Most applications

### Pattern 2: Standalone Database + Application

**Use case**: Multiple applications sharing one database, or need GUI backup management

**Step 1**: Create standalone PostgreSQL via Coolify GUI
- Note the UUID (e.g., `postgres-abc123`)
- Configure backups in Coolify UI
- Note internal connection URL

**Step 2**: Deploy application

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    environment:
      DATABASE_URL: postgresql://user:${DB_PASSWORD}@postgres-abc123:5432/mydb
    labels:
      # Enable connection to predefined network
      - "coolify.connect_to_predefined_network=true"
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`example.com`)"
      - "traefik.http.routers.myapp.entrypoints=https"
      - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"
```

**CRITICAL**: Enable "Connect to Predefined Network" in Coolify UI for this application.

**Pros**:
- GUI backup management
- Database shared across apps
- Automatic SSL for database
- Coolify monitors database health

**Cons**:
- Must use UUID in connection string
- Requires "Connect to Predefined Network" setting
- More complex troubleshooting

**Best for**: Production deployments, multiple apps using same database

### Pattern 3: Microservices with Shared Database

**Use case**: Multiple services, shared database, service-to-service communication

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    image: myapi:latest
    environment:
      DATABASE_URL: postgresql://user:${DB_PASSWORD}@postgres:5432/mydb
      AUTH_SERVICE_URL: http://auth:4000
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.example.com`)"
      - "traefik.http.routers.api.entrypoints=https"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=3000"
    depends_on:
      postgres:
        condition: service_healthy

  auth:
    image: myauth:latest
    environment:
      DATABASE_URL: postgresql://user:${DB_PASSWORD}@postgres:5432/mydb
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Host(`auth.example.com`)"
      - "traefik.http.routers.auth.entrypoints=https"
      - "traefik.http.routers.auth.tls.certresolver=letsencrypt"
      - "traefik.http.services.auth.loadbalancer.server.port=4000"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres-data:
```

**Pros**:
- All services in same network
- Service-to-service communication via service names
- Shared database
- Multiple domains

**Cons**:
- All services redeploy together
- No independent scaling
- Larger blast radius for failures

**Best for**: Small to medium microservices architectures

### Pattern 4: Production with Connection Pooling

**Use case**: High-traffic production application

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: myapp:latest
    environment:
      # Application connections go through pooler
      DATABASE_URL: postgresql://user:${DB_PASSWORD}@pgbouncer:5432/mydb
      # Migrations use direct connection
      DIRECT_DATABASE_URL: postgresql://user:${DB_PASSWORD}@postgres:5432/mydb
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`example.com`)"
      - "traefik.http.routers.myapp.entrypoints=https"
      - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"
    depends_on:
      pgbouncer:
        condition: service_started

  pgbouncer:
    image: pgbouncer/pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: user
      DATABASES_PASSWORD: ${DB_PASSWORD}
      DATABASES_DBNAME: mydb
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 100
      DEFAULT_POOL_SIZE: 20
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: mydb
      # Increase max connections for pooler
      POSTGRES_MAX_CONNECTIONS: 100
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres-data:
```

**Pros**:
- Handles high connection counts
- Better resource utilization
- Prevents "too many connections" errors
- Separate connection URL for migrations

**Cons**:
- More complex architecture
- Another service to monitor
- Transaction pooling has limitations (no prepared statements across requests)

**Best for**: High-traffic production applications

---

## Code Examples and Configurations

### Complete Docker Compose Example (Production-Ready)

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: ${IMAGE_NAME}:${IMAGE_TAG:-latest}
    restart: unless-stopped

    environment:
      # Database
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}

      # Application
      NODE_ENV: production
      PORT: 3000

      # Secrets (from Coolify environment)
      SESSION_SECRET: ${SESSION_SECRET}
      JWT_SECRET: ${JWT_SECRET}

    labels:
      # Traefik routing
      - "traefik.enable=true"
      - "traefik.http.routers.myapp.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.myapp.entrypoints=https"
      - "traefik.http.routers.myapp.tls=true"
      - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"

      # Service configuration
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"

      # Health check path
      - "traefik.http.services.myapp.loadbalancer.healthcheck.path=/health"
      - "traefik.http.services.myapp.loadbalancer.healthcheck.interval=10s"

      # Security headers
      - "traefik.http.middlewares.secure-headers.headers.sslredirect=true"
      - "traefik.http.middlewares.secure-headers.headers.stsSeconds=31536000"
      - "traefik.http.middlewares.secure-headers.headers.stsIncludeSubdomains=true"
      - "traefik.http.routers.myapp.middlewares=secure-headers"

    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

    depends_on:
      postgres:
        condition: service_healthy

    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped

    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      # Performance tuning
      POSTGRES_SHARED_BUFFERS: 256MB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
      POSTGRES_MAX_CONNECTIONS: 100

    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    networks:
      - app-network

    # Security: Don't expose port unless needed
    # ports:
    #   - "5432:5432"

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
    driver: local
```

### Environment Variables (.env)

```bash
# .env (configured in Coolify UI)

# Application
IMAGE_NAME=myapp
IMAGE_TAG=latest
DOMAIN=example.com
NODE_ENV=production

# Database
DB_USER=myapp_user
DB_PASSWORD=<generate-secure-password>
DB_NAME=myapp_production

# Secrets
SESSION_SECRET=<generate-random-32-bytes>
JWT_SECRET=<generate-random-32-bytes>
```

### Next.js Database Connection (TypeScript)

```typescript
// lib/database.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pooling configuration
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout after 2s
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release(); // CRITICAL: Always release
  }
}

export async function getClient() {
  return await pool.connect();
}

export default pool;
```

### Health Check Endpoint (Next.js App Router)

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET() {
  try {
    // Check database connectivity
    const client = await pool.connect();

    try {
      await client.query('SELECT 1');

      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
```

### Database Initialization Script

```sql
-- init-scripts/01-init.sql
-- Runs ONLY on first database initialization

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For similarity search

-- Application schema
CREATE SCHEMA IF NOT EXISTS app;

-- Set default schema
SET search_path TO app, public;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA app TO myapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO myapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO myapp_user;

-- Default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT ALL PRIVILEGES ON TABLES TO myapp_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA app
  GRANT ALL PRIVILEGES ON SEQUENCES TO myapp_user;
```

### Backup Script

```bash
#!/bin/bash
# scripts/backup-database.sh

set -e # Exit on error

# Configuration
CONTAINER_NAME="${1:-postgres}"
DB_USER="${2:-myapp_user}"
DB_NAME="${3:-myapp_production}"
BACKUP_DIR="/backups"
RETENTION_DAYS=7

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.dump"

echo "Starting backup of database '${DB_NAME}'..."

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Create backup using pg_dump (custom format for faster restore)
docker exec "${CONTAINER_NAME}" pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -Fc \
  > "${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "✓ Backup completed successfully: ${BACKUP_FILE} (${SIZE})"
else
  echo "✗ Backup failed: File not created"
  exit 1
fi

# Cleanup old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "backup_*.dump" -mtime +${RETENTION_DAYS} -delete

# List current backups
echo ""
echo "Current backups:"
ls -lh "${BACKUP_DIR}"/backup_*.dump

echo ""
echo "Backup process completed"
```

### Restore Script

```bash
#!/bin/bash
# scripts/restore-database.sh

set -e # Exit on error

# Configuration
CONTAINER_NAME="${1:-postgres}"
DB_USER="${2:-myapp_user}"
DB_NAME="${3:-myapp_production}"
BACKUP_FILE="${4}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 [container] [user] [database] <backup-file>"
  echo "Example: $0 postgres myapp_user myapp_production /backups/backup_20231109_120000.dump"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will restore '${DB_NAME}' from '${BACKUP_FILE}'"
echo "All existing data will be REPLACED!"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

echo "Starting restore..."

# Drop existing connections (optional, uncomment if needed)
# docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres -c \
#   "SELECT pg_terminate_backend(pg_stat_activity.pid)
#    FROM pg_stat_activity
#    WHERE pg_stat_activity.datname = '${DB_NAME}'
#      AND pid <> pg_backend_pid();"

# Restore database
cat "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" pg_restore \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --clean \
  --if-exists \
  --no-acl \
  --no-owner

echo "✓ Restore completed successfully"
```

### Coolify Configuration File

```yaml
# .coolify/config.yml (optional advanced configuration)

# Build configuration
build:
  pack: docker-compose
  base_directory: /

# Health check
health_check:
  enabled: true
  path: /health
  interval: 10
  timeout: 5
  retries: 3

# Environment variables
environment:
  # Loaded from Coolify UI environment settings
  # These are just documentation/defaults
  - NODE_ENV=production
  - PORT=3000

# Deployment strategy
deployment:
  strategy: rolling
  health_check_enabled: true

# Logging
logging:
  max_size: 10m
  max_file: 3

# Resource limits (if needed)
resources:
  limits:
    cpus: '2.0'
    memory: 2G
  reservations:
    cpus: '0.5'
    memory: 512M
```

---

## Resources and Documentation

### Official Documentation

1. **Coolify Documentation**
   - Main Docs: https://coolify.io/docs/
   - Database Guide: https://coolify.io/docs/databases/
   - Docker Compose: https://coolify.io/docs/knowledge-base/docker/compose
   - Traefik Configuration: https://coolify.io/docs/knowledge-base/proxy/traefik/overview
   - Troubleshooting: https://coolify.io/docs/troubleshoot/

2. **Docker Documentation**
   - Networking: https://docs.docker.com/compose/how-tos/networking/
   - Volumes: https://docs.docker.com/storage/volumes/
   - PostgreSQL Image: https://hub.docker.com/_/postgres

3. **Traefik Documentation**
   - Routing: https://doc.traefik.io/traefik/routing/routers/
   - Docker Provider: https://doc.traefik.io/traefik/providers/docker/
   - Let's Encrypt: https://doc.traefik.io/traefik/https/acme/

### Community Resources

1. **GitHub Discussions**
   - Database Networking: https://github.com/coollabsio/coolify/discussions/2925
   - Service Connections: https://github.com/coollabsio/coolify/discussions/1803
   - Docker Compose Issues: https://github.com/coollabsio/coolify/issues/1874

2. **Blog Posts**
   - [Setting up PostgreSQL and backups on S3 with Coolify](https://eventuallymaking.io/2024/11/coolify-pgsql-s3)
   - [Using Postgres on Coolify and Internal Database URL](https://zixianchen.com/blog/using-postgres-coolify-internal-database-url)
   - [Integrating Coolify into an existing Traefik setup](https://beaussan.io/blog/coolify-into-existing-traefik/)
   - [Deploy n8n with Coolify and PostgreSQL](https://mugane.hashnode.dev/deploy-n8n-on-coolify-with-postgresql-a-step-by-step-guide)

3. **Stack Overflow**
   - [How to connect to postgres through docker-compose network?](https://stackoverflow.com/questions/44316297/how-to-connect-to-postgres-through-docker-compose-network)
   - [How to persist data in dockerized postgres](https://stackoverflow.com/questions/41637505/how-to-persist-data-in-a-dockerized-postgres-database-using-volumes)
   - [PostgreSQL initialization on Coolify](https://stackoverflow.com/questions/79632993/how-to-properly-initialize-a-dockerized-postgresql-database-on-coolify-with-cust)

### Tutorials and Guides

1. **PostgreSQL in Docker**
   - [Best Practices for Running PostgreSQL in Docker](https://pankajconnect.medium.com/best-practices-for-running-postgresql-in-docker-containers-409c21dfb2cc)
   - [How to Use the Postgres Docker Official Image](https://www.docker.com/blog/how-to-use-the-postgres-docker-official-image/)
   - [Postgres with Docker and Docker compose guide](https://geshan.com.np/blog/2021/12/docker-postgres/)

2. **Coolify Deployment**
   - [Selfhosted PostgreSQL for 5 bucks with Coolify](https://webdock.io/en/docs/how-guides/app-installation-and-setup/selfhosted-postgresql-5-bucks-coolify)
   - [How to self-host n8n with Coolify](https://www.hostinger.com/tutorials/how-to-host-n8n-with-coolify)
   - [Using Coolify to Simplify Deployments](https://dev.to/matthewh/using-coolify-to-simplify-deployments-38mc)

3. **Traefik and Routing**
   - [Fixing Traefik Misconfiguration When Changing Domains](https://dev.to/danielbetterdevelopers/fixing-traefik-misconfiguration-when-changing-domains-2kof)
   - [How to Fix Coolify Bad Gateway Error](https://www.edopedia.com/blog/how-to-fix-coolify-bad-gateway-error/)

### Known Issues and Workarounds

1. **Coolify GitHub Issues**
   - [Malformed Traefik routing labels (beta.434)](https://github.com/coollabsio/coolify/issues/6877)
   - [Incorrect Traefik Rule (beta.418)](https://github.com/coollabsio/coolify/issues/5813)
   - [Docker Compose cannot join coolify network](https://github.com/coollabsio/coolify/issues/1874)
   - [Connect to predefined network issues](https://github.com/coollabsio/coolify/issues/5597)

### Tools and Utilities

1. **Database Management**
   - pgAdmin: https://www.pgadmin.org/
   - DBeaver: https://dbeaver.io/
   - psql (command line)

2. **Monitoring**
   - Traefik Dashboard (built into Coolify)
   - Docker logs: `docker logs <container>`
   - PostgreSQL logs: Check container logs

3. **Backup Solutions**
   - S3-compatible storage (recommended)
   - Restic: https://restic.net/
   - Duplicati: https://www.duplicati.com/

---

## Comparison of Approaches

### Database Deployment: Standalone vs Docker Compose

| Feature | Standalone Database | Docker Compose Database |
|---------|-------------------|------------------------|
| **Setup Complexity** | ⭐ Simple (one-click) | ⭐⭐ Moderate (YAML config) |
| **Backup Management** | ✅ GUI-based, automated | ❌ Manual scripts required |
| **Network Configuration** | ⭐⭐ Requires "Connect to Predefined Network" | ⭐ Automatic (same network) |
| **Connection String** | Uses UUID: `postgres-abc123` | Uses service name: `postgres` |
| **Version Control** | ❌ Configuration in Coolify DB | ✅ YAML in git repository |
| **Multiple Apps Access** | ✅ Easy to share | ⭐⭐ Requires network setup |
| **Coolify Monitoring** | ✅ Full integration | ⭐⭐ Basic monitoring |
| **Update Management** | ✅ Coolify handles | ⭐⭐ Manual image updates |
| **SSL Configuration** | ✅ Automatic | ⭐⭐ Manual setup |
| **Restore Process** | ⭐ One-click in UI | ⭐⭐ Manual script execution |

**Recommendation**:
- **Production with GUI preference**: Standalone database
- **Infrastructure as Code preference**: Docker Compose database
- **Multiple apps, single database**: Standalone database
- **Microservices (all in one stack)**: Docker Compose database

### Routing: Label-Based vs File-Based

| Feature | Label-Based (Default) | File-Based |
|---------|---------------------|------------|
| **Management** | ⭐ Automatic via Coolify | ⭐⭐⭐ Manual configuration |
| **Dynamic Updates** | ✅ Updates on redeploy | ❌ Requires manual editing |
| **Persistence** | ⭐⭐ Can be overwritten | ✅ Persists across redeploys |
| **Coolify Integration** | ✅ Full integration | ❌ Bypasses Coolify |
| **Debugging** | ⭐⭐ Check container labels | ⭐ Check config files |
| **Flexibility** | ⭐⭐ Limited by Coolify | ✅ Full Traefik features |
| **Version Control** | ❌ In container metadata | ✅ Can be in git |
| **Malformed Label Risk** | ⚠️ Coolify bugs possible | ✅ Manual control |

**Recommendation**:
- **Default**: Use label-based (Coolify managed)
- **Advanced routing needs**: Use file-based as supplement
- **Coolify bugs encountered**: Temporary file-based workaround

### Network Approaches

| Approach | Use Case | Complexity | Isolation |
|----------|----------|------------|-----------|
| **Default Compose Network** | Single app + database | ⭐ Simple | ⭐⭐ Medium |
| **Predefined Network** | Multiple apps, shared database | ⭐⭐ Moderate | ⭐ Low |
| **Custom Networks** | Microservices with isolation | ⭐⭐⭐ Complex | ⭐⭐⭐ High |
| **Multiple Networks** | Security-critical separation | ⭐⭐⭐⭐ Very Complex | ⭐⭐⭐⭐ Very High |

**Recommendation**:
- Start with default Compose network
- Use predefined network only when needed for cross-stack communication
- Avoid custom networks unless you have specific security requirements

---

## Conclusion and Next Steps

### Key Takeaways

1. **Network Configuration is Critical**
   - Always use service names, never IPs
   - Understand network isolation between stacks
   - Enable "Connect to Predefined Network" when needed

2. **Database Persistence Requires Proper Volumes**
   - Always use named volumes for PostgreSQL
   - Mount to exact path: `/var/lib/postgresql/data`
   - Verify volume persistence after redeploy

3. **Traefik Labels Must Be Correct**
   - FQDN should generate `Host(\`domain\`)` rule
   - Check for malformed labels after deployment
   - Update Coolify if encountering label generation bugs

4. **Health Checks Prevent Deployment Issues**
   - Implement health checks for all services
   - Use `depends_on` with `condition: service_healthy`
   - Ensure application listens on `0.0.0.0`, not `localhost`

5. **Firewall Issues Are Common**
   - 90% of connection issues are firewall-related
   - Check UFW and iptables configurations
   - Review logs in `/var/log/ufw.log` and `/var/log/auth.log`

### Recommended Implementation Steps

For your Veritable Games deployment:

#### Step 1: Choose Database Approach

**Option A: Standalone PostgreSQL (Recommended)**
1. Create PostgreSQL database via Coolify GUI
2. Note the UUID and internal connection URL
3. Configure S3 backups in Coolify UI
4. Enable "Connect to Predefined Network" for application
5. Update `DATABASE_URL` to use UUID-based connection string

**Option B: Docker Compose PostgreSQL**
1. Add PostgreSQL service to `docker-compose.yml`
2. Configure named volume for data persistence
3. Add health checks for both services
4. Update connection string to use service name
5. Set up manual backup scripts

#### Step 2: Fix Traefik Configuration

1. Set exact FQDN in Coolify UI: `www.veritablegames.com`
2. Verify Traefik labels after deployment:
   ```bash
   docker inspect <container> | grep traefik.http.routers
   ```
3. If malformed, manually fix or update Coolify
4. Ensure application listens on `0.0.0.0:3000`

#### Step 3: Implement Health Checks

1. Add `/health` endpoint to application
2. Add health check to `docker-compose.yml`:
   ```yaml
   healthcheck:
     test: ["CMD", "wget", "--spider", "http://localhost:3000/health"]
     interval: 10s
     timeout: 5s
     retries: 3
   ```
3. Configure PostgreSQL health check
4. Add `depends_on` with `condition: service_healthy`

#### Step 4: Test Deployment

1. Deploy with new configuration
2. Verify database connectivity:
   ```bash
   docker exec <app-container> psql $DATABASE_URL -c "SELECT 1"
   ```
3. Verify domain routing: `curl -I https://www.veritablegames.com`
4. Check logs for errors: `docker logs <container> --tail 100`
5. Test data persistence: Redeploy and verify data remains

#### Step 5: Set Up Backups

**If using standalone database**:
- Configure backups in Coolify UI
- Set S3 credentials
- Set backup schedule (e.g., `0 2 * * *` for 2 AM daily)

**If using Docker Compose**:
- Set up backup script (see Code Examples section)
- Add cron job for automated backups
- Test restore process

### Monitoring and Maintenance

1. **Regular Health Checks**
   - Monitor Traefik dashboard
   - Check application health endpoint
   - Review database connection pool metrics

2. **Log Monitoring**
   - Set up log aggregation (if needed)
   - Monitor for connection errors
   - Watch for Traefik routing errors

3. **Backup Verification**
   - Regularly test restore process
   - Verify backup file integrity
   - Monitor backup storage usage

4. **Updates**
   - Keep Coolify updated
   - Update PostgreSQL image regularly
   - Monitor for security updates

### Additional Resources for Your Project

Based on your CLAUDE.md, you're using:
- Next.js 15.5.6 with App Router
- PostgreSQL (production)
- Coolify deployment

**Specific recommendations**:

1. Use standalone PostgreSQL for easier backup management
2. Implement PgBouncer if you expect high traffic
3. Use environment variable for `DATABASE_URL` (already done)
4. Add health check endpoint at `/api/health`
5. Ensure Traefik labels are correct for `www.veritablegames.com`
6. Monitor connection pool usage (currently using `dbPool`)

### Contact and Support

- Coolify Community: https://github.com/coollabsio/coolify/discussions
- Coolify Discord: https://discord.gg/coolify
- Docker Community: https://forums.docker.com/

---

**Document Version**: 1.0
**Last Updated**: November 9, 2025
**Maintainer**: Claude Code Research
**Status**: Active Research Document
