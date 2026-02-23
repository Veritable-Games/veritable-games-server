# Docker Networking Solutions: Comprehensive Guide

**Last Updated**: November 9, 2025

This guide provides comprehensive solutions for Docker networking issues in containerized deployment architectures, specifically focusing on PostgreSQL database connectivity, multi-network communication, and production best practices.

---

## Table of Contents

1. [Docker Networking Fundamentals](#docker-networking-fundamentals)
2. [Multi-Network Container Communication](#multi-network-container-communication)
3. [PostgreSQL Container Best Practices](#postgresql-container-best-practices)
4. [Real-World Troubleshooting](#real-world-troubleshooting)
5. [Health Check Patterns](#health-check-patterns)
6. [Connection Pooling with PgBouncer](#connection-pooling-with-pgbouncer)
7. [Backup and Recovery Strategies](#backup-and-recovery-strategies)
8. [Migration Strategies](#migration-strategies)

---

## Docker Networking Fundamentals

### How Docker Networks Work

Docker uses an **embedded DNS server** to manage name resolution for containers running on user-defined networks:

- **DNS Server Location**: `127.0.0.11` (internal resolver)
- **Resolution Process**: Container name → DNS lookup → IP address mapping
- **Scope**: DNS resolution works within the same Docker network only

### Network Types Comparison

| Network Type | Use Case | DNS Resolution | Isolation | Production Ready |
|--------------|----------|----------------|-----------|------------------|
| **Default Bridge** | Legacy/quick testing | ❌ No (IP only) | ❌ Poor | ❌ Not recommended |
| **User-Defined Bridge** | Single-host containers | ✅ Yes | ✅ Good | ✅ Recommended |
| **Overlay** | Multi-host swarm | ✅ Yes | ✅ Excellent | ✅ For swarm mode |
| **Host** | Direct host access | N/A | ❌ None | ⚠️ Special cases only |
| **None** | No networking | N/A | ✅ Complete | ⚠️ Special cases only |

### Default Bridge vs User-Defined Bridge

#### Key Differences

**1. DNS Resolution**
```bash
# Default bridge: NO automatic DNS resolution
# Must use IP addresses or legacy --link flag
docker run --name app1 --network bridge myapp
docker run --name app2 --network bridge myapp
# app2 cannot ping app1 by name

# User-defined bridge: YES automatic DNS resolution
docker network create my-network
docker run --name app1 --network my-network myapp
docker run --name app2 --network my-network myapp
# app2 CAN ping app1 by name
```

**2. Network Isolation**
- **Default Bridge**: All containers without `--network` specified share the same network (security risk)
- **User-Defined Bridge**: Each network is isolated; only explicitly connected containers can communicate

**3. Runtime Management**
- **Default Bridge**: Must stop/recreate container to change network settings
- **User-Defined Bridge**: Can connect/disconnect networks on running containers

**4. Configuration**
- **Default Bridge**: Global settings affect ALL containers on default bridge
- **User-Defined Bridge**: Per-network configuration (MTU, iptables rules, etc.)

#### Recommendation

**✅ ALWAYS use user-defined bridge networks for production**

```bash
# Create network
docker network create --driver bridge my-app-network

# Run containers on user-defined network
docker run -d --name postgres --network my-app-network postgres:15
docker run -d --name app --network my-app-network my-app
```

### Docker Compose Networking

Docker Compose **automatically creates a user-defined bridge network** for all services:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    # Automatically gets network: <project-name>_default

  app:
    image: my-app
    # Can access postgres by service name: postgres:5432
```

**Key Features**:
- Services discover each other by service name
- Automatic DNS resolution
- Network name: `<project-name>_default` or custom via `networks:` section

### DNS Resolution Deep Dive

#### How Container DNS Works

1. **Container makes DNS query** (e.g., `ping postgres`)
2. **Docker DNS server receives query** at `127.0.0.11`
3. **DNS server checks**:
   - Is `postgres` a container name on this network? → Return IP
   - Otherwise → Forward to upstream DNS servers
4. **Upstream DNS servers** (default: Google `8.8.8.8`, `8.8.4.4`)

#### DNS Configuration Options

```bash
# Use custom DNS servers
docker run --dns 8.8.8.8 --dns 1.1.1.1 my-container

# Set DNS search domains
docker run --dns-search example.com my-container

# Custom DNS options
docker run --dns-opt ndots:5 my-container
```

#### Docker Compose DNS Configuration

```yaml
services:
  app:
    image: my-app
    dns:
      - 8.8.8.8
      - 1.1.1.1
    dns_search:
      - example.com
    dns_opt:
      - ndots:5
```

---

## Multi-Network Container Communication

### The Challenge

**Problem**: Container A on `network1` cannot access Container B on `network2` by default.

```
┌─────────────────┐         ┌─────────────────┐
│   network1      │         │   network2      │
│                 │         │                 │
│  ┌──────────┐   │         │  ┌──────────┐   │
│  │  App A   │   │    X    │  │  App B   │   │
│  └──────────┘   │         │  └──────────┘   │
└─────────────────┘         └─────────────────┘
```

### Solution 1: Connect Container to Multiple Networks

**Best for**: Shared services (databases, message queues) that need to be accessible from multiple isolated networks

```bash
# Create networks
docker network create frontend-network
docker network create backend-network

# Run database on backend network
docker run -d --name postgres \
  --network backend-network \
  postgres:15

# Connect postgres to frontend network as well
docker network connect frontend-network postgres

# Now postgres is on BOTH networks
# Containers on frontend-network can access: postgres:5432
# Containers on backend-network can access: postgres:5432
```

**Verification**:
```bash
docker inspect postgres | grep -A 20 Networks
# Shows both frontend-network and backend-network
```

### Solution 2: Network Aliases

**Best for**: When you want different hostnames for the same container on different networks

```bash
# Connect with custom alias
docker network connect --alias db-frontend frontend-network postgres
docker network connect --alias db-backend backend-network postgres

# Now accessible as:
# - db-frontend:5432 from frontend-network
# - db-backend:5432 from backend-network
# - postgres:5432 from both networks
```

### Solution 3: Docker Compose Multi-Network Setup

**Best for**: Complex applications with multiple isolation boundaries

```yaml
version: '3.8'

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge

services:
  postgres:
    image: postgres:15
    networks:
      - backend
    environment:
      POSTGRES_PASSWORD: secret

  api:
    image: my-api
    networks:
      - frontend
      - backend
    depends_on:
      postgres:
        condition: service_healthy

  nginx:
    image: nginx
    networks:
      - frontend
    ports:
      - "80:80"
```

**Network Topology**:
```
┌──────────────────────────────────────────────┐
│  frontend network                            │
│                                              │
│  ┌────────┐         ┌────────┐              │
│  │ nginx  │────────▶│  api   │              │
│  └────────┘         └────┬───┘              │
│                          │                  │
└──────────────────────────┼──────────────────┘
                           │
┌──────────────────────────┼──────────────────┐
│  backend network         │                  │
│                          │                  │
│                     ┌────▼────┐             │
│                     │  api    │             │
│                     └────┬────┘             │
│                          │                  │
│                     ┌────▼────┐             │
│                     │postgres │             │
│                     └─────────┘             │
└──────────────────────────────────────────────┘
```

### Solution 4: Runtime Network Connection

**Best for**: Adding networks to already-running containers without restart

```bash
# Container is running
docker ps | grep my-container

# Connect to new network on-the-fly
docker network connect new-network my-container

# Disconnect from network
docker network disconnect old-network my-container

# Verify connections
docker network inspect new-network
```

### Advanced: Custom IP Addresses

```bash
# Create network with specific subnet
docker network create --subnet=172.20.0.0/16 my-network

# Connect container with specific IP
docker network connect --ip 172.20.0.100 my-network my-container
```

### Network Communication Patterns

#### Pattern 1: Shared Database (Recommended)

```yaml
# One PostgreSQL instance shared across networks
services:
  postgres:
    networks:
      - app-network
      - admin-network

  app:
    networks:
      - app-network

  pgadmin:
    networks:
      - admin-network
```

#### Pattern 2: Service Mesh

```yaml
# API gateway bridges multiple networks
services:
  gateway:
    networks:
      - public
      - services

  service-a:
    networks:
      - services

  service-b:
    networks:
      - services
```

---

## PostgreSQL Container Best Practices

### Production-Ready PostgreSQL Setup

#### Docker Compose Configuration

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: postgres-production
    restart: unless-stopped

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

    # Environment variables
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --lc-collate=en_US.UTF-8 --lc-ctype=en_US.UTF-8"
      # Performance tuning
      POSTGRES_MAX_CONNECTIONS: 200
      POSTGRES_SHARED_BUFFERS: 1GB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 3GB
      POSTGRES_WORK_MEM: 16MB
      POSTGRES_MAINTENANCE_WORK_MEM: 512MB

    # Named volume for persistence
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d:ro
      - ./backups:/backups

    # Health check
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    # Network
    networks:
      - database-network

    # Security
    security_opt:
      - no-new-privileges:true

    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/persistent/storage

networks:
  database-network:
    driver: bridge
```

### Volume Persistence Strategies

#### Strategy 1: Named Volumes (Recommended for Production)

**Advantages**:
- ✅ Fully managed by Docker
- ✅ Better performance on non-Linux systems
- ✅ Easier to backup/restore with Docker commands
- ✅ Platform-independent paths
- ✅ No permission issues

**Setup**:
```yaml
volumes:
  postgres-data:
    # Docker manages storage location

services:
  postgres:
    volumes:
      - postgres-data:/var/lib/postgresql/data
```

**Backup**:
```bash
# Backup named volume
docker run --rm \
  -v postgres-data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /source .

# Restore named volume
docker run --rm \
  -v postgres-data:/target \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /target
```

#### Strategy 2: Bind Mounts (Development/Custom Paths)

**Advantages**:
- ✅ Direct access from host
- ✅ Easy manual inspection
- ✅ Custom backup scripts

**Disadvantages**:
- ❌ Permission issues (container UID/GID vs host)
- ❌ Platform-specific paths
- ❌ Performance issues on Docker Desktop (Mac/Windows)

**Setup**:
```yaml
services:
  postgres:
    volumes:
      - /absolute/path/to/pgdata:/var/lib/postgresql/data

    # Fix permissions if needed
    user: "${UID}:${GID}"
```

**Permission Fix**:
```bash
# Create directory with correct ownership
mkdir -p /path/to/pgdata
chown -R 999:999 /path/to/pgdata  # PostgreSQL runs as UID 999

# Or use environment variables
export UID=$(id -u)
export GID=$(id -g)
docker-compose up
```

#### Strategy 3: Docker Managed Volumes with Specific Path

```yaml
volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /srv/postgresql/data
```

### PostgreSQL Configuration Tuning

#### Method 1: Environment Variables

```yaml
environment:
  POSTGRES_MAX_CONNECTIONS: 200
  POSTGRES_SHARED_BUFFERS: 1GB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 3GB
```

#### Method 2: Custom postgresql.conf

```yaml
volumes:
  - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro

command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

**postgresql.conf**:
```conf
# Connection settings
max_connections = 200
superuser_reserved_connections = 3

# Memory settings
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 512MB

# WAL settings
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_wal_size = 2GB
min_wal_size = 1GB

# Query planner
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200

# Logging
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = off
log_lock_waits = on
```

### Security Best Practices

#### 1. Use Secrets (Docker Swarm/Kubernetes)

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

#### 2. Restrict Network Access

```yaml
services:
  postgres:
    networks:
      - internal  # No external access
    # Don't publish ports in production
    # ports:
    #   - "5432:5432"  # DON'T DO THIS
```

#### 3. Run as Non-Root User

```yaml
services:
  postgres:
    user: postgres  # Default: runs as postgres user (UID 999)
    security_opt:
      - no-new-privileges:true
```

### Initialization Scripts

Place SQL scripts in `/docker-entrypoint-initdb.d/`:

```yaml
volumes:
  - ./init-scripts:/docker-entrypoint-initdb.d:ro
```

**init-scripts/01-create-databases.sql**:
```sql
-- Create multiple databases
CREATE DATABASE app_db;
CREATE DATABASE test_db;

-- Create users
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;
```

**init-scripts/02-create-extensions.sh**:
```bash
#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS btree_gin;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL
```

---

## Real-World Troubleshooting

### Common Error: EAI_AGAIN (DNS Resolution Failure)

#### What It Means

**Error**: `getaddrinfo EAI_AGAIN <hostname>`

**Translation**: "I tried to look up the hostname but the DNS server didn't respond in time"

#### Common Causes

1. **Container not on same network as database**
   ```bash
   # Check networks
   docker inspect app-container | grep -A 10 Networks
   docker inspect postgres-container | grep -A 10 Networks
   ```

2. **Hostname doesn't exist in Docker DNS**
   ```bash
   # List all containers on network
   docker network inspect my-network
   ```

3. **DNS server unreachable**
   ```bash
   # Check DNS configuration
   docker exec app-container cat /etc/resolv.conf
   # Should show: nameserver 127.0.0.11
   ```

4. **Network timing issues (Alpine images)**
   - Alpine-based images sometimes have DNS caching issues
   - Solution: Restart container or use non-Alpine base

#### Diagnostic Steps

**Step 1: Verify Container Exists**
```bash
docker ps | grep postgres
# postgres should be running
```

**Step 2: Check Networks**
```bash
# App network
docker inspect app-container --format '{{json .NetworkSettings.Networks}}' | jq

# Database network
docker inspect postgres --format '{{json .NetworkSettings.Networks}}' | jq

# Should show SAME network name
```

**Step 3: Test DNS Resolution**
```bash
# From app container, try to resolve database hostname
docker exec app-container nslookup postgres
# Should return IP address

# If nslookup not available
docker exec app-container ping -c 1 postgres
```

**Step 4: Test Connectivity**
```bash
# Try to connect to PostgreSQL port
docker exec app-container nc -zv postgres 5432
# Should show: postgres (172.20.0.2:5432) open
```

**Step 5: Check PostgreSQL Logs**
```bash
docker logs postgres --tail 50
# Look for connection attempts/errors
```

#### Solutions

**Solution 1: Connect to Same Network**
```bash
# If containers on different networks
docker network connect <network-name> <container-name>

# Example
docker network connect database-network app-container
```

**Solution 2: Use Custom DNS**
```bash
docker run --dns 8.8.8.8 --dns 1.1.1.1 my-app
```

**Solution 3: Use IP Address (Temporary)**
```bash
# Get postgres IP
POSTGRES_IP=$(docker inspect postgres --format '{{.NetworkSettings.Networks.my-network.IPAddress}}')

# Use IP instead of hostname (not recommended long-term)
DATABASE_URL=postgresql://user:pass@${POSTGRES_IP}:5432/db
```

**Solution 4: Restart Container (Alpine DNS Cache)**
```bash
docker restart app-container
```

### Connection Refused vs Connection Timeout

#### Connection Refused (`ECONNREFUSED`)

**Meaning**: "I found the host, but nothing is listening on that port"

**Causes**:
- PostgreSQL not running
- Wrong port number
- PostgreSQL listening only on localhost (not 0.0.0.0)

**Check**:
```bash
# Is PostgreSQL running?
docker exec postgres pg_isready
# postgres:5432 - accepting connections

# What ports is it listening on?
docker exec postgres netstat -tlnp | grep postgres
# Should show: 0.0.0.0:5432
```

**Fix**:
```yaml
# postgresql.conf or environment
listen_addresses = '*'  # Not just 'localhost'
```

#### Connection Timeout (`ETIMEDOUT`)

**Meaning**: "I can't reach the host at all"

**Causes**:
- Network not connected
- Firewall blocking
- Wrong hostname/IP

**Check**:
```bash
# Can we ping the host?
docker exec app-container ping postgres

# Network connectivity?
docker network inspect my-network
```

### Advanced Debugging Tools

#### Install Network Tools in Container

```bash
# For debugging, install tools
docker exec -it app-container sh

# Alpine
apk add --no-cache bind-tools curl netcat-openbsd

# Debian/Ubuntu
apt-get update && apt-get install -y dnsutils curl netcat

# Then test
nslookup postgres
curl -v telnet://postgres:5432
nc -zv postgres 5432
```

#### Inspect Network Traffic

```bash
# Install tcpdump
docker exec -it app-container sh
apk add tcpdump

# Capture traffic to postgres
tcpdump -i eth0 -n host postgres and port 5432
```

#### Docker Network Diagnostics

```bash
# Show all networks
docker network ls

# Inspect specific network
docker network inspect my-network

# Show which containers are on network
docker network inspect my-network --format '{{range .Containers}}{{.Name}} {{end}}'

# Show container's network details
docker inspect app-container --format '{{json .NetworkSettings}}' | jq
```

---

## Health Check Patterns

### PostgreSQL Health Check Configuration

#### Basic Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

#### Advanced Health Check (Database + Query)

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres && psql -U postgres -d mydb -c 'SELECT 1' || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

#### Health Check with Specific Database

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} && psql -lqt | cut -d \\| -f 1 | grep -qw ${POSTGRES_DB}"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 40s
```

### Health Check Parameters Explained

| Parameter | Description | Default | Recommendation |
|-----------|-------------|---------|----------------|
| `test` | Command to run | None | Use `pg_isready` |
| `interval` | Time between checks | 30s | 10s for DB |
| `timeout` | Max time for check | 30s | 5s |
| `retries` | Failures before unhealthy | 3 | 5 for DB |
| `start_period` | Grace period after start | 0s | 30-60s for DB |

### Dependent Service Health Checks

#### Wait for Database Before Starting App

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: my-app
    depends_on:
      postgres:
        condition: service_healthy  # WAIT for health check
    environment:
      DATABASE_URL: postgres://postgres:secret@postgres:5432/mydb
```

**Dependency Conditions**:
- `service_started`: Container started (default, not recommended for DB)
- `service_healthy`: Health check passed (recommended)
- `service_completed_successfully`: Container exited with code 0

### Custom Health Check Scripts

#### Advanced PostgreSQL Health Check Script

**scripts/pg-healthcheck.sh**:
```bash
#!/bin/bash
set -eo pipefail

# Check if PostgreSQL is accepting connections
pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q || exit 1

# Verify database exists and is accessible
psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT 1" > /dev/null 2>&1 || exit 1

# Check for required extensions
psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT 1 FROM pg_extension WHERE extname='pg_trgm'" | grep -q 1 || exit 1

# Check replication lag (if using replication)
# LAG=$(psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))")
# [ "${LAG%%.*}" -lt 60 ] || exit 1  # Fail if lag > 60 seconds

echo "PostgreSQL is healthy"
exit 0
```

**docker-compose.yml**:
```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - ./scripts/pg-healthcheck.sh:/usr/local/bin/healthcheck.sh:ro
    healthcheck:
      test: ["CMD", "/usr/local/bin/healthcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### Application-Level Health Checks

#### Node.js App with DB Connection Check

```yaml
services:
  app:
    image: node:18-alpine
    healthcheck:
      test: ["CMD", "node", "/app/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**healthcheck.js**:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

async function healthCheck() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
```

---

## Connection Pooling with PgBouncer

### Why Use PgBouncer?

**Problem**: Opening/closing PostgreSQL connections is expensive:
- Connection setup: ~10-20ms per connection
- Memory overhead: ~10MB per connection
- Max connections limit: Typically 100-200

**Solution**: PgBouncer maintains a pool of persistent connections:
- Reuses existing connections
- Memory usage: ~2KB per connection
- Can handle thousands of client connections with 20-50 server connections

### PgBouncer Docker Setup

#### Docker Compose with PgBouncer

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgbouncer:
    image: edoburu/pgbouncer:1.21.0
    container_name: pgbouncer
    environment:
      # Database connection
      DATABASE_URL: postgres://myuser:mypassword@postgres:5432/mydb

      # PgBouncer settings
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: 50
      MAX_CLIENT_CONN: 1000
      SERVER_IDLE_TIMEOUT: 600

      # Authentication
      AUTH_TYPE: scram-sha-256

    depends_on:
      postgres:
        condition: service_healthy

    networks:
      - backend
      - frontend

    healthcheck:
      test: ["CMD", "psql", "-h", "localhost", "-p", "6432", "-U", "myuser", "-d", "mydb", "-c", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    image: my-app
    environment:
      # Connect to PgBouncer, not directly to PostgreSQL
      DATABASE_URL: postgres://myuser:mypassword@pgbouncer:6432/mydb
    depends_on:
      pgbouncer:
        condition: service_healthy
    networks:
      - frontend

volumes:
  postgres-data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
```

### PgBouncer Configuration

#### Pool Modes

| Mode | Description | Use Case | Transaction Handling |
|------|-------------|----------|---------------------|
| **session** | Connection held for entire session | Default apps, unprepared statements | Multiple transactions per connection |
| **transaction** | Connection held per transaction | High concurrency, REST APIs | One transaction per connection |
| **statement** | Connection held per query | Very specific use cases | One query per connection |

**Recommendation**: Use `transaction` mode for most web applications

#### Custom pgbouncer.ini

**pgbouncer.ini**:
```ini
[databases]
mydb = host=postgres port=5432 dbname=mydb
* = host=postgres port=5432

[pgbouncer]
# Connection settings
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
reserve_pool_timeout = 5
max_client_conn = 1000
max_db_connections = 100
max_user_connections = 100

# Timeouts
server_lifetime = 3600
server_idle_timeout = 600
server_connect_timeout = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
idle_transaction_timeout = 0

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
stats_period = 60

# Performance
pkt_buf = 4096
listen_backlog = 128
sbuf_loopcnt = 5

# Admin
admin_users = myuser
stats_users = myuser
```

**userlist.txt** (SCRAM-SHA-256):
```
"myuser" "SCRAM-SHA-256$4096:salt$hash:serverkey"
```

Generate with:
```bash
docker exec postgres psql -U myuser -d mydb -c "SELECT concat('\"', usename, '\" \"', passwd, '\"') FROM pg_shadow WHERE usename = 'myuser'"
```

#### Mount Custom Config

```yaml
services:
  pgbouncer:
    image: edoburu/pgbouncer:1.21.0
    volumes:
      - ./pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
      - ./userlist.txt:/etc/pgbouncer/userlist.txt:ro
```

### Connection Pooling Best Practices

#### 1. Size Your Pool Correctly

**Formula**:
```
Optimal Pool Size = ((Core Count * 2) + Effective Spindle Count)

For SSD: Pool Size ≈ (CPU Cores * 2)
For HDD: Pool Size ≈ (CPU Cores * 2) + Spindle Count

Example: 4-core server with SSD = ~10-20 connections
```

#### 2. Monitor Pool Usage

```bash
# Connect to PgBouncer admin console
docker exec -it pgbouncer psql -h localhost -p 6432 -U myuser pgbouncer

# Show pools
SHOW POOLS;

# Show client connections
SHOW CLIENTS;

# Show server connections
SHOW SERVERS;

# Show statistics
SHOW STATS;
```

#### 3. Application Configuration

**Node.js (pg)**:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  // Connect to PgBouncer
  host: 'pgbouncer',
  port: 6432,
  database: 'mydb',
  user: 'myuser',
  password: 'mypassword',

  // Application-level pooling (optional with PgBouncer)
  max: 20,  // Keep low since PgBouncer handles pooling
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

**Python (psycopg2)**:
```python
import psycopg2.pool

pool = psycopg2.pool.SimpleConnectionPool(
    minconn=1,
    maxconn=20,  # Keep low since PgBouncer handles pooling
    host='pgbouncer',
    port=6432,
    dbname='mydb',
    user='myuser',
    password='mypassword'
)
```

---

## Backup and Recovery Strategies

### Backup Methods Comparison

| Method | Size | Speed | Compression | Point-in-Time Recovery | Use Case |
|--------|------|-------|-------------|------------------------|----------|
| **pg_dump (SQL)** | Large | Slow | No | No | Schema migrations, version control |
| **pg_dump (Custom)** | Medium | Medium | Yes | No | Production backups, selective restore |
| **pg_dumpall** | Large | Slow | No | No | Full cluster backup including roles |
| **pg_basebackup** | Large | Fast | Yes | Yes (with WAL) | PITR, replication setup |
| **Volume snapshot** | Medium | Very Fast | Yes | No | Quick backups, container migration |

### Method 1: pg_dump (Custom Format)

**Best for**: Regular production backups with compression

```bash
# Backup single database (custom format)
docker exec -t postgres pg_dump \
  -U myuser \
  -d mydb \
  -F c \
  -f /backups/mydb-$(date +%Y%m%d-%H%M%S).dump

# Copy backup from container
docker cp postgres:/backups/mydb-20251109-120000.dump ./backups/

# Backup with compression level
docker exec postgres pg_dump \
  -U myuser \
  -d mydb \
  -F c \
  -Z 9 \
  > mydb-backup.dump
```

**Restore**:
```bash
# Copy backup to container
docker cp ./backups/mydb-backup.dump postgres:/tmp/

# Restore (drop existing database first)
docker exec postgres dropdb -U myuser mydb
docker exec postgres createdb -U myuser mydb
docker exec postgres pg_restore \
  -U myuser \
  -d mydb \
  --clean \
  --if-exists \
  --verbose \
  /tmp/mydb-backup.dump
```

### Method 2: pg_dumpall (Complete Cluster)

**Best for**: Backing up all databases + roles + settings

```bash
# Backup entire cluster
docker exec -t postgres pg_dumpall \
  -U postgres \
  --clean \
  --if-exists \
  | gzip > postgres-cluster-$(date +%Y%m%d).sql.gz

# Restore entire cluster
gunzip -c postgres-cluster-20251109.sql.gz | \
  docker exec -i postgres psql -U postgres
```

### Method 3: Automated Backup with Cron

#### Docker Compose with Backup Container

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data

  backup:
    image: prodrigestivill/postgres-backup-local
    restart: unless-stopped
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword

      # Backup schedule (cron format)
      SCHEDULE: "0 2 * * *"  # Daily at 2 AM

      # Retention
      BACKUP_KEEP_DAYS: 7
      BACKUP_KEEP_WEEKS: 4
      BACKUP_KEEP_MONTHS: 6

      # Compression
      POSTGRES_EXTRA_OPTS: "-Z9 --schema=public --blobs"

    volumes:
      - ./backups:/backups
    depends_on:
      - postgres
```

**Alternative: kartoza/pg-backup**:
```yaml
services:
  backup:
    image: kartoza/pg-backup:15.0
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DBNAME: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASS: mypassword

      # Daily backup at 2 AM
      CRON_SCHEDULE: "0 2 * * *"

      # Retention (days)
      REMOVE_BEFORE: 7

    volumes:
      - ./backups:/backups
```

### Method 4: Point-in-Time Recovery (PITR)

**Best for**: Production systems requiring recovery to specific timestamp

#### Enable WAL Archiving

**postgresql.conf**:
```conf
# WAL settings
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /wal_archive/%f && cp %p /wal_archive/%f'
archive_timeout = 300  # Force archive every 5 minutes
max_wal_senders = 3
wal_keep_size = 1GB
```

**docker-compose.yml**:
```yaml
services:
  postgres:
    image: postgres:15
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - wal-archive:/wal_archive
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf

volumes:
  postgres-data:
  wal-archive:
```

#### Base Backup

```bash
# Create base backup
docker exec postgres pg_basebackup \
  -U postgres \
  -D /backups/base \
  -F tar \
  -z \
  -P \
  -X stream

# Copy base backup from container
docker cp postgres:/backups/base ./backups/pitr-base-$(date +%Y%m%d)
```

#### Restore to Point in Time

```bash
# Stop PostgreSQL
docker-compose stop postgres

# Clear data directory
docker volume rm postgres-data
docker volume create postgres-data

# Restore base backup
docker run --rm \
  -v postgres-data:/var/lib/postgresql/data \
  -v $(pwd)/backups/pitr-base:/backup \
  postgres:15 \
  tar xzf /backup/base.tar.gz -C /var/lib/postgresql/data

# Create recovery.signal
docker run --rm \
  -v postgres-data:/var/lib/postgresql/data \
  postgres:15 \
  touch /var/lib/postgresql/data/recovery.signal

# Configure recovery
cat > recovery.conf <<EOF
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2025-11-09 12:00:00'
EOF

docker cp recovery.conf postgres:/var/lib/postgresql/data/

# Start PostgreSQL (will recover to specified time)
docker-compose start postgres
```

### Method 5: Volume Snapshots

**Best for**: Quick backups, container migration

```bash
# Stop PostgreSQL (ensure consistent state)
docker-compose stop postgres

# Backup volume as tar
docker run --rm \
  -v postgres-data:/source:ro \
  -v $(pwd)/backups:/backup \
  alpine \
  tar czf /backup/postgres-volume-$(date +%Y%m%d).tar.gz -C /source .

# Restart PostgreSQL
docker-compose start postgres
```

**Restore**:
```bash
# Stop and remove old volume
docker-compose down
docker volume rm postgres-data
docker volume create postgres-data

# Restore volume
docker run --rm \
  -v postgres-data:/target \
  -v $(pwd)/backups:/backup \
  alpine \
  tar xzf /backup/postgres-volume-20251109.tar.gz -C /target

# Start PostgreSQL
docker-compose up -d
```

### Backup Automation Script

**scripts/backup-postgres.sh**:
```bash
#!/bin/bash
set -euo pipefail

# Configuration
CONTAINER_NAME="postgres"
BACKUP_DIR="./backups"
DB_NAME="${POSTGRES_DB:-mydb}"
DB_USER="${POSTGRES_USER:-myuser}"
RETENTION_DAYS=7

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Generate filename
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}-${TIMESTAMP}.dump"

echo "Starting backup: ${BACKUP_FILE}"

# Perform backup
docker exec -t "${CONTAINER_NAME}" pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -Z 9 \
  > "${BACKUP_FILE}"

# Verify backup
if [ -f "${BACKUP_FILE}" ]; then
  SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  echo "Backup completed successfully: ${BACKUP_FILE} (${SIZE})"
else
  echo "ERROR: Backup failed"
  exit 1
fi

# Remove old backups
echo "Removing backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "${DB_NAME}-*.dump" -mtime +${RETENTION_DAYS} -delete

# List remaining backups
echo "Current backups:"
ls -lh "${BACKUP_DIR}"

exit 0
```

**Usage**:
```bash
chmod +x scripts/backup-postgres.sh
./scripts/backup-postgres.sh
```

**Cron job** (run daily at 2 AM):
```bash
crontab -e
# Add:
0 2 * * * /path/to/scripts/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

---

## Migration Strategies

### Scenario 1: Standalone PostgreSQL → Docker PostgreSQL

#### Step 1: Backup Existing Database

```bash
# On standalone server
pg_dump -U myuser -d mydb -F c -f mydb-migration.dump

# Or for entire cluster
pg_dumpall -U postgres > postgres-migration.sql
```

#### Step 2: Setup Docker PostgreSQL

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"  # Temporary for migration

volumes:
  postgres-data:
```

```bash
docker-compose up -d postgres
```

#### Step 3: Restore Data

```bash
# Copy dump to container
docker cp mydb-migration.dump postgres:/tmp/

# Restore
docker exec postgres pg_restore \
  -U myuser \
  -d mydb \
  --clean \
  --if-exists \
  --verbose \
  /tmp/mydb-migration.dump

# Or for full cluster
docker exec -i postgres psql -U postgres < postgres-migration.sql
```

#### Step 4: Update Application

```yaml
# Before (standalone)
DATABASE_URL=postgres://myuser:password@192.168.1.100:5432/mydb

# After (Docker)
DATABASE_URL=postgres://myuser:password@postgres:5432/mydb
```

#### Step 5: Verify and Clean Up

```bash
# Test application connectivity
docker-compose logs app

# Remove temporary port exposure
# Edit docker-compose.yml: Remove ports: - "5432:5432"
docker-compose up -d postgres
```

### Scenario 2: SQLite → PostgreSQL Migration

#### Option A: Use pgloader

**pgloader.load**:
```
LOAD DATABASE
  FROM sqlite://./data/mydb.db
  INTO postgresql://myuser:password@postgres:5432/mydb

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
```

**Run migration**:
```bash
docker run --rm \
  -v $(pwd)/data:/data \
  -v $(pwd)/pgloader.load:/tmp/pgloader.load \
  --network my-network \
  dimitri/pgloader:latest \
  pgloader /tmp/pgloader.load
```

#### Option B: Custom Migration Script

**scripts/sqlite-to-postgres.js** (Node.js):
```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const sqliteDb = new sqlite3.Database('./data/mydb.db');
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  // Get SQLite data
  const rows = await new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM users', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  // Insert into PostgreSQL
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    for (const row of rows) {
      await client.query(
        'INSERT INTO users (id, username, email) VALUES ($1, $2, $3)',
        [row.id, row.username, row.email]
      );
    }

    await client.query('COMMIT');
    console.log(`Migrated ${rows.length} users`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

migrate().catch(console.error);
```

### Scenario 3: Multi-Container Network Migration

**Problem**: App container needs to access newly Dockerized PostgreSQL

#### Current State
```
┌──────────────┐
│   App        │
│  (Native)    │
│              │
│  connects to │
│  localhost   │
└──────────────┘
       │
       ▼
  PostgreSQL
  (localhost:5432)
```

#### Target State
```
┌─────────────────────────────┐
│  Docker Network             │
│                             │
│  ┌──────────┐  ┌──────────┐│
│  │   App    │──│PostgreSQL││
│  │(Container)│  │(Container)││
│  └──────────┘  └──────────┘│
└─────────────────────────────┘
```

#### Migration Steps

**Step 1: Dockerize PostgreSQL** (see Scenario 1)

**Step 2: Make PostgreSQL Accessible to Native App**

```yaml
services:
  postgres:
    ports:
      - "5432:5432"  # Expose to host
```

**Step 3: Update App Connection String**

```bash
# Temporary: Connect to Docker PostgreSQL from native app
DATABASE_URL=postgres://myuser:password@localhost:5432/mydb
```

**Step 4: Dockerize App**

```yaml
services:
  postgres:
    # Remove port exposure after app is Dockerized
    # ports:
    #   - "5432:5432"
    networks:
      - app-network

  app:
    image: my-app
    environment:
      # Internal Docker networking
      DATABASE_URL: postgres://myuser:password@postgres:5432/mydb
    networks:
      - app-network
    depends_on:
      postgres:
        condition: service_healthy

networks:
  app-network:
    driver: bridge
```

### Scenario 4: Zero-Downtime Migration

**Requirements**: Migrate to Docker without service interruption

#### Architecture: Dual-Write Pattern

```
┌──────────┐     Write      ┌────────────────┐
│   App    │───────────────▶│ PostgreSQL OLD │
│          │                │  (Standalone)  │
│          │                └────────────────┘
│          │                         │
│          │     Write               │ Replication
│          │───────────────┐         │
│          │                │        ▼
│          │                │  ┌────────────────┐
│          │     Read       │  │ PostgreSQL NEW │
│          │◀───────────────┘  │   (Docker)     │
└──────────┘                   └────────────────┘
```

#### Step 1: Setup Docker PostgreSQL as Replica

**On standalone PostgreSQL** (primary):
```conf
# postgresql.conf
wal_level = replica
max_wal_senders = 5
```

**Setup replication user**:
```sql
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'secret';
```

**pg_hba.conf**:
```
host replication replicator 0.0.0.0/0 scram-sha-256
```

**On Docker PostgreSQL** (replica):
```bash
# Create base backup
docker exec postgres pg_basebackup \
  -h standalone-host \
  -U replicator \
  -D /var/lib/postgresql/data \
  -P \
  -X stream
```

#### Step 2: Monitor Replication Lag

```sql
-- On primary
SELECT pg_current_wal_lsn();

-- On replica
SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```

#### Step 3: Switchover (Low-Traffic Window)

```bash
# 1. Stop writes to primary
# (Maintenance mode or read-only)

# 2. Wait for replica to catch up
# (Monitor replication lag = 0)

# 3. Promote Docker PostgreSQL to primary
docker exec postgres pg_ctl promote

# 4. Update application connection string
DATABASE_URL=postgres://user:pass@postgres:5432/mydb

# 5. Restart application
docker-compose restart app
```

---

## Summary: Production Checklist

### ✅ Network Configuration
- [ ] Use user-defined bridge networks (not default bridge)
- [ ] Verify all containers on same network can resolve by name
- [ ] Use `docker network connect` for multi-network access
- [ ] Implement network aliases for different contexts
- [ ] Document network topology in docker-compose.yml

### ✅ PostgreSQL Configuration
- [ ] Use named volumes for data persistence
- [ ] Pin PostgreSQL image to specific version (e.g., `postgres:15.4`)
- [ ] Configure resource limits (CPU, memory)
- [ ] Tune PostgreSQL settings (shared_buffers, work_mem, etc.)
- [ ] Enable health checks with `pg_isready`
- [ ] Use secrets for passwords (not environment variables)
- [ ] Restrict network access (no published ports in production)
- [ ] Configure logging (retention, format)

### ✅ Health Checks
- [ ] PostgreSQL: `pg_isready` + query test
- [ ] Application: Database connection + endpoint test
- [ ] Set appropriate `start_period` (30-60s for databases)
- [ ] Use `depends_on` with `service_healthy` condition
- [ ] Monitor health check status in production

### ✅ Connection Pooling
- [ ] Consider PgBouncer for high-concurrency applications
- [ ] Use `transaction` pool mode for web apps
- [ ] Size pool based on CPU cores: `(cores * 2) + spindles`
- [ ] Monitor pool usage with `SHOW POOLS`
- [ ] Configure application pool size (keep low with PgBouncer)

### ✅ Backup & Recovery
- [ ] Implement automated backups (cron or backup container)
- [ ] Test restore procedure regularly
- [ ] Use `pg_dump` custom format for compression
- [ ] Configure retention policy (7 days, 4 weeks, 6 months)
- [ ] Enable WAL archiving for PITR (production only)
- [ ] Store backups off-host (S3, NFS, etc.)
- [ ] Document recovery procedures

### ✅ Troubleshooting
- [ ] Document all container names and network names
- [ ] Keep network debugging tools available (nc, nslookup, curl)
- [ ] Monitor Docker logs: `docker-compose logs -f`
- [ ] Use `docker inspect` for network diagnostics
- [ ] Set up alerts for container health check failures
- [ ] Document common errors and solutions

### ✅ Security
- [ ] Use secrets management (Docker secrets, Kubernetes secrets)
- [ ] Run containers as non-root users
- [ ] Enable `no-new-privileges` security option
- [ ] Don't expose PostgreSQL port to host in production
- [ ] Use strong passwords (generated, not hardcoded)
- [ ] Keep images updated (vulnerability scanning)
- [ ] Implement network segmentation (frontend/backend networks)

---

## Additional Resources

### Official Documentation
- [Docker Networking Overview](https://docs.docker.com/network/)
- [PostgreSQL Docker Official Image](https://hub.docker.com/_/postgres)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
- [PgBouncer Documentation](https://www.pgbouncer.org/config.html)

### Tools
- **pgAdmin**: Web-based PostgreSQL administration
- **pg_activity**: Top-like activity monitor for PostgreSQL
- **pgBadger**: PostgreSQL log analyzer
- **Docker Compose**: Multi-container orchestration
- **Portainer**: Docker management UI

### Monitoring
- **Prometheus + Grafana**: Metrics and dashboards
- **postgres_exporter**: PostgreSQL metrics for Prometheus
- **pg_stat_statements**: Query performance tracking
- **Datadog/New Relic**: Full-stack monitoring

---

**End of Docker Networking Solutions Guide**

For project-specific implementation, see:
- [CLAUDE.md](/home/user/Projects/veritable-games-main/CLAUDE.md) - Project patterns
- [CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](/home/user/Projects/veritable-games-main/docs/deployment/CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md) - Production operations
- [TROUBLESHOOTING.md](/home/user/Projects/veritable-games-main/docs/TROUBLESHOOTING.md) - Project-specific troubleshooting
