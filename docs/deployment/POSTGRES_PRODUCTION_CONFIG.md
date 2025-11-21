# PostgreSQL Production Configuration

**Server:** veritable-games-server (192.168.1.15)
**Last Updated:** November 21, 2025
**Container:** `veritable-games-postgres`
**Database:** `veritable_games`

---

## Table of Contents

1. [Container Configuration](#container-configuration)
2. [Database Structure](#database-structure)
3. [Network Configuration](#network-configuration)
4. [Backup Procedures](#backup-procedures)
5. [Recovery Procedures](#recovery-procedures)
6. [Maintenance Tasks](#maintenance-tasks)
7. [Performance Tuning](#performance-tuning)
8. [Security Configuration](#security-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Container Configuration

### Current Production Container

**Container Name:** `veritable-games-postgres`
- **Container ID:** 71595bf31622
- **Image:** `postgres:15-alpine`
- **Status:** Up 6 days (healthy)
- **Restart Policy:** Always
- **Health Check:** `pg_isready -U postgres`
- **Health Interval:** 30 seconds
- **Health Timeout:** 5 seconds
- **Health Retries:** 3

### Creation Command

**Original creation** (as inferred from configuration):
```bash
docker run -d \
  --name veritable-games-postgres \
  --restart always \
  --network veritable-games-network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  -p 5432:5432 \
  --health-cmd="pg_isready -U postgres" \
  --health-interval=30s \
  --health-timeout=5s \
  --health-retries=3 \
  postgres:15-alpine
```

**Then connected to Coolify network:**
```bash
docker network connect coolify veritable-games-postgres
```

### Environment Variables

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres  # ⚠️ TODO: Change to secure password
POSTGRES_DB=veritable_games
PGDATA=/var/lib/postgresql/data
```

**⚠️ Security Note:** The default password `postgres` is currently in use. This should be changed to a strong password for production. See [Security Configuration](#security-configuration) section.

### Data Location

**Container Internal Path:** `/var/lib/postgresql/data`
**Host Path:** Data is stored in Docker's internal volume management

**To find host path:**
```bash
docker inspect veritable-games-postgres | grep -A 10 "Mounts"
```

**Note:** Production data is NOT stored in a named Docker volume. It's using Docker's internal volume management. Consider migrating to a named volume for better backup control.

---

## Database Structure

### Database Information

**Database Name:** `veritable_games`
- **Owner:** postgres
- **Encoding:** UTF8
- **Collate:** en_US.utf8
- **Ctype:** en_US.utf8
- **Locale Provider:** libc

**System Databases:**
- `postgres` - Default administrative database
- `template0` - Pristine template database
- `template1` - Modifiable template database

### Schema Overview

The `veritable_games` database contains **14 schemas**:

| Schema | Purpose | Est. Size | Key Tables |
|--------|---------|-----------|------------|
| `public` | Default schema | Small | Standard PostgreSQL schema |
| `anarchist` | Anarchist Library content | Large | documents (24,643 texts) |
| `auth` | Authentication & authorization | Medium | users, sessions, permissions |
| `cache` | Application caching | Small | cache entries (ephemeral) |
| `content` | General content management | Medium | articles, pages |
| `donations` | Donation system | Small | donations, donors |
| `forums` | Forum system | Medium | threads, posts, categories |
| `library` | General library content | Large | library_documents (3,880 docs) |
| `main` | Main application data | Medium | Core application tables |
| `messaging` | User messaging system | Small | messages, conversations |
| `shared` | Shared resources | Medium | tags (19,952), relationships |
| `system` | System configuration | Small | settings, metadata |
| `users` | User management | Medium | user profiles, preferences |
| `wiki` | Wiki system | Medium | wiki_pages (181), wiki_revisions (1,320) |

### Key Statistics

**Total Schemas:** 14
**Total Tables:** 170+ (estimated across all schemas)
**Total Rows:**
- Anarchist documents: 24,643
- Library documents: 3,880
- Wiki pages: 181
- Wiki revisions: 1,320
- Tags: 19,952
- Forum posts: Variable
- Users: Variable

**Database Size:**
```bash
# Check current database size
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT pg_size_pretty(pg_database_size('veritable_games'));"
```

---

## Network Configuration

### Dual-Network Setup

The PostgreSQL container is unique in that it's connected to **TWO Docker networks simultaneously**:

#### 1. `veritable-games-network` (Primary Local Network)
**Purpose:** Local development and direct database access
**Connected Containers:**
- `veritable-games-postgres` (this container)
- `veritable-games-pgadmin` (pgAdmin web interface)

**Allows:**
- pgAdmin access from local network
- Direct database connections from development tools
- Local backup scripts
- Direct psql access

#### 2. `coolify` (Production Platform Network)
**Purpose:** Production application connectivity
**Connected Containers:**
- `veritable-games-postgres` (this container)
- `m4s0kwo4kc4oooocck4sswc4` (Veritable Games app container)
- Coolify infrastructure containers

**Allows:**
- Production app to connect to database
- Coolify management access
- Other Coolify-deployed apps to connect if needed

### Connection Strings

**From Coolify-deployed apps (via coolify network):**
```
postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**From local development (via veritable-games-network):**
```
postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
```

**From host machine (port forwarded):**
```
postgresql://postgres:postgres@192.168.1.15:5432/veritable_games
```

**Environment Variable Names:**
- `DATABASE_URL` (used by app)
- `POSTGRES_URL` (alternative)

### Port Configuration

**Container Port:** 5432 (PostgreSQL default)
**Host Port:** 5432
**Exposure:** Published to host (accessible on LAN)

**Access Control:**
- Host firewall controls external access
- PostgreSQL `pg_hba.conf` controls authentication (default: trust on Docker networks)
- Should restrict to specific IPs in production

---

## Backup Procedures

### Manual Backup Commands

#### Full Database Backup (All Databases)

```bash
# Backup all databases including roles and globals
docker exec veritable-games-postgres pg_dumpall -U postgres > \
  /home/user/backups/postgres-$(date +%Y%m%d-%H%M%S).sql

# With compression
docker exec veritable-games-postgres pg_dumpall -U postgres | \
  gzip > /home/user/backups/postgres-$(date +%Y%m%d-%H%M%S).sql.gz
```

#### Single Database Backup

```bash
# Backup only veritable_games database (custom format, compressed)
docker exec veritable-games-postgres pg_dump -U postgres -F c -b -v \
  -f /tmp/veritable_games.dump veritable_games

# Copy out of container
docker cp veritable-games-postgres:/tmp/veritable_games.dump \
  /home/user/backups/veritable_games-$(date +%Y%m%d).dump
```

#### Schema-Specific Backups

```bash
# Backup specific schema (e.g., anarchist library)
docker exec veritable-games-postgres pg_dump -U postgres \
  -n anarchist -F c -f /tmp/anarchist-schema.dump veritable_games

docker cp veritable-games-postgres:/tmp/anarchist-schema.dump \
  /home/user/backups/anarchist-$(date +%Y%m%d).dump
```

#### SQL Format Backup (Human-Readable)

```bash
# SQL format for manual inspection/editing
docker exec veritable-games-postgres pg_dump -U postgres \
  veritable_games > /home/user/backups/veritable_games-$(date +%Y%m%d).sql
```

### Backup Strategy

**Frequency:**
- **Daily:** Full database backup (automated via cron)
- **Weekly:** Schema-specific backups (for granular recovery)
- **Before Migrations:** Manual backup before schema changes
- **Before Upgrades:** Manual backup before PostgreSQL version upgrades

**Retention:**
- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months
- Keep pre-migration backups indefinitely

**Storage Location:**
- Primary: `/home/user/backups/` (on sdb drive, 336 GB free)
- Remote: Should implement off-server backup (S3, rsync, etc.)

### Automated Backup Script

Create `/home/user/scripts/backup-postgres.sh`:

```bash
#!/bin/bash
# PostgreSQL Automated Backup Script
# Run daily via cron: 0 2 * * * /home/user/scripts/backup-postgres.sh

set -e  # Exit on error

BACKUP_DIR="/home/user/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Full database backup
echo "[$(date)] Starting PostgreSQL backup..."
docker exec veritable-games-postgres pg_dumpall -U postgres | \
  gzip > "$BACKUP_DIR/postgres-$TIMESTAMP.sql.gz"

# Check if backup succeeded
if [ $? -eq 0 ]; then
    echo "[$(date)] Backup completed: postgres-$TIMESTAMP.sql.gz"

    # Calculate backup size
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/postgres-$TIMESTAMP.sql.gz" | cut -f1)
    echo "[$(date)] Backup size: $BACKUP_SIZE"

    # Delete backups older than retention period
    find "$BACKUP_DIR" -name "postgres-*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
else
    echo "[$(date)] ERROR: Backup failed!" >&2
    exit 1
fi

echo "[$(date)] Backup process complete."
```

**Make executable and schedule:**
```bash
chmod +x /home/user/scripts/backup-postgres.sh

# Add to crontab (run at 2 AM daily)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/user/scripts/backup-postgres.sh >> /home/user/backups/backup.log 2>&1") | crontab -
```

---

## Recovery Procedures

### Full Database Recovery

#### From pg_dumpall Backup

```bash
# Stop application container (to prevent connections during restore)
docker stop m4s0kwo4kc4oooocck4sswc4

# Drop and recreate database
docker exec -it veritable-games-postgres psql -U postgres -c "DROP DATABASE IF EXISTS veritable_games;"
docker exec -it veritable-games-postgres psql -U postgres -c "CREATE DATABASE veritable_games;"

# Restore from SQL backup
cat /home/user/backups/postgres-20251121.sql.gz | gunzip | \
  docker exec -i veritable-games-postgres psql -U postgres

# Restart application
docker start m4s0kwo4kc4oooocck4sswc4
```

#### From pg_dump Custom Format

```bash
# Copy backup into container
docker cp /home/user/backups/veritable_games-20251121.dump \
  veritable-games-postgres:/tmp/restore.dump

# Stop application
docker stop m4s0kwo4kc4oooocck4sswc4

# Drop and recreate database
docker exec -it veritable-games-postgres psql -U postgres -c "DROP DATABASE IF EXISTS veritable_games;"
docker exec -it veritable-games-postgres psql -U postgres -c "CREATE DATABASE veritable_games;"

# Restore using pg_restore
docker exec -it veritable-games-postgres pg_restore -U postgres \
  -d veritable_games -v /tmp/restore.dump

# Restart application
docker start m4s0kwo4kc4oooocck4sswc4

# Verify data integrity
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT COUNT(*) FROM anarchist.documents;"
```

### Schema-Specific Recovery

```bash
# Restore only specific schema without affecting other data
docker cp /home/user/backups/anarchist-20251121.dump \
  veritable-games-postgres:/tmp/schema-restore.dump

# Drop and restore schema
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "DROP SCHEMA IF EXISTS anarchist CASCADE;"

docker exec veritable-games-postgres pg_restore -U postgres \
  -d veritable_games -n anarchist /tmp/schema-restore.dump
```

### Disaster Recovery Procedure

**Complete System Failure:**

1. **Reinstall PostgreSQL Container:**
```bash
docker run -d \
  --name veritable-games-postgres \
  --restart always \
  --network veritable-games-network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  -p 5432:5432 \
  --health-cmd="pg_isready -U postgres" \
  --health-interval=30s \
  postgres:15-alpine

docker network connect coolify veritable-games-postgres
```

2. **Restore from Latest Backup:**
```bash
# Find latest backup
LATEST_BACKUP=$(ls -t /home/user/backups/postgres-*.sql.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"

# Restore
gunzip < "$LATEST_BACKUP" | \
  docker exec -i veritable-games-postgres psql -U postgres
```

3. **Verify Data Integrity:**
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\dn+"
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT schemaname, COUNT(*) as tables FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') GROUP BY schemaname;"
```

4. **Restart Application:**
```bash
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

---

## Maintenance Tasks

### Daily Maintenance

**Automated Backups:**
- Runs via cron at 2 AM
- See [Automated Backup Script](#automated-backup-script)

**Health Check:**
```bash
docker exec veritable-games-postgres pg_isready -U postgres
```

### Weekly Maintenance

**Vacuum Database:**
```bash
# Analyze and vacuum all databases (reclaim space, update stats)
docker exec veritable-games-postgres vacuumdb -U postgres --all --analyze --verbose
```

**Check Database Size:**
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT schemaname, pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint)
   FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   GROUP BY schemaname ORDER BY sum(pg_total_relation_size(schemaname||'.'||tablename)) DESC;"
```

**Check Connection Count:**
```bash
docker exec veritable-games-postgres psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

### Monthly Maintenance

**Reindex Database:**
```bash
docker exec veritable-games-postgres reindexdb -U postgres --all --verbose
```

**Check for Bloat:**
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT schemaname, tablename,
   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 20;"
```

**Update PostgreSQL Statistics:**
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "ANALYZE VERBOSE;"
```

---

## Performance Tuning

### Current Configuration

**Default PostgreSQL 15 settings** (Alpine image)
- No custom tuning currently applied
- Using PostgreSQL defaults optimized for safety, not performance

### Recommended Tuning Parameters

**For a server with 8 GB RAM (typical):**

Create `/home/user/postgres-custom.conf`:

```conf
# Memory Configuration
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM
maintenance_work_mem = 512MB            # For VACUUM, CREATE INDEX
work_mem = 64MB                         # Per connection sort/hash

# Connection Configuration
max_connections = 100                   # Adjust based on app needs
shared_preload_libraries = 'pg_stat_statements'

# Checkpoint Configuration
checkpoint_completion_target = 0.9      # Spread out checkpoint I/O
wal_buffers = 16MB
default_statistics_target = 100

# Query Planner
random_page_cost = 1.1                  # Assuming SSD storage
effective_io_concurrency = 200          # SSD optimization

# Logging (for production monitoring)
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_statement = 'ddl'                   # Log DDL changes
log_min_duration_statement = 1000       # Log slow queries (>1s)
```

**Apply Custom Configuration:**

```bash
# Copy config into container
docker cp /home/user/postgres-custom.conf \
  veritable-games-postgres:/var/lib/postgresql/data/postgresql.conf

# Restart to apply
docker restart veritable-games-postgres

# Verify settings
docker exec veritable-games-postgres psql -U postgres -c "SHOW shared_buffers;"
docker exec veritable-games-postgres psql -U postgres -c "SHOW effective_cache_size;"
```

### Performance Monitoring

**Enable pg_stat_statements:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**View Slow Queries:**
```sql
SELECT query, calls, total_exec_time, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Security Configuration

### Current Security Issues

⚠️ **CRITICAL SECURITY ISSUES:**

1. **Weak Password:** Default `postgres` password is in use
2. **Published Port:** 5432 is exposed to host network
3. **No TLS:** Connections are not encrypted
4. **Trust Authentication:** Default pg_hba.conf allows passwordless local connections

### Recommended Security Hardening

#### 1. Change PostgreSQL Password

```bash
# Generate strong password
NEW_PASSWORD=$(openssl rand -base64 32)

# Change password
docker exec veritable-games-postgres psql -U postgres -c \
  "ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';"

# Update environment variable in Coolify
# (via Coolify UI under environment variables)
DATABASE_URL=postgresql://postgres:$NEW_PASSWORD@veritable-games-postgres:5432/veritable_games

# Redeploy application
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

#### 2. Configure pg_hba.conf for Password Authentication

```bash
# Create custom pg_hba.conf
cat > /home/user/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections (inside container)
local   all             all                                     trust

# Docker network connections (require password)
host    all             all             172.16.0.0/12           scram-sha-256
host    all             all             10.0.0.0/8              scram-sha-256

# Deny all other connections
host    all             all             0.0.0.0/0               reject
EOF

# Copy into container
docker cp /home/user/pg_hba.conf \
  veritable-games-postgres:/var/lib/postgresql/data/pg_hba.conf

# Reload configuration
docker exec veritable-games-postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

#### 3. Restrict Port Exposure

**Remove port publishing** (only allow Docker network access):

```bash
# This requires recreating the container
# First, backup database
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/pre-security-hardening.sql

# Recreate without -p flag
docker stop veritable-games-postgres
docker rm veritable-games-postgres

docker run -d \
  --name veritable-games-postgres \
  --restart always \
  --network veritable-games-network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=$NEW_PASSWORD \
  -e POSTGRES_DB=veritable_games \
  --health-cmd="pg_isready -U postgres" \
  postgres:15-alpine

docker network connect coolify veritable-games-postgres

# Restore data
cat /home/user/backups/pre-security-hardening.sql | \
  docker exec -i veritable-games-postgres psql -U postgres
```

**Note:** Removing `-p 5432:5432` means the database is only accessible via Docker networks, not from the host or external networks.

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker logs veritable-games-postgres --tail 100

# Common causes:
# - Data directory permissions
# - Corrupted data files
# - Port already in use
# - Insufficient disk space

# Check disk space
df -h /var/lib/docker

# Check if port is in use
sudo netstat -tulpn | grep 5432
```

#### Connection Refused

```bash
# Verify container is running and healthy
docker ps --filter name=veritable-games-postgres

# Check networks
docker inspect veritable-games-postgres | grep -A 20 "Networks"

# Test connection from app container
docker exec m4s0kwo4kc4oooocck4sswc4 \
  psql postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games -c "SELECT 1;"

# Check PostgreSQL logs
docker logs veritable-games-postgres --tail 100
```

#### Slow Queries

```bash
# Enable query logging
docker exec veritable-games-postgres psql -U postgres -c \
  "ALTER SYSTEM SET log_min_duration_statement = 1000;"  # Log queries > 1s

docker exec veritable-games-postgres psql -U postgres -c "SELECT pg_reload_conf();"

# Check slow queries in logs
docker logs veritable-games-postgres | grep "duration:"

# Analyze specific query
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "EXPLAIN ANALYZE SELECT * FROM anarchist.documents LIMIT 10;"
```

#### Database Corruption

```bash
# Check for corruption
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT datname, pg_database_size(datname) FROM pg_database;"

# If corruption detected, restore from backup
# See [Recovery Procedures](#recovery-procedures)
```

#### Out of Disk Space

```bash
# Check database size
docker exec veritable-games-postgres psql -U postgres -c \
  "SELECT pg_size_pretty(pg_database_size('veritable_games'));"

# Check host disk space
df -h /var/lib/docker

# Clean up old backups
find /home/user/backups -name "postgres-*.sql.gz" -mtime +30 -delete

# Vacuum to reclaim space
docker exec veritable-games-postgres vacuumdb -U postgres --all --full --analyze
```

---

## Migration to Named Volume (Recommended)

**Current State:** Database data is in Docker's internal volume management
**Recommended:** Migrate to named volume for better backup/management

**Migration Steps:**

```bash
# 1. Backup current data
docker exec veritable-games-postgres pg_dumpall -U postgres > /home/user/backups/pre-volume-migration.sql

# 2. Create named volume
docker volume create veritable-games-postgres-data

# 3. Stop and remove current container
docker stop veritable-games-postgres
docker rm veritable-games-postgres

# 4. Create new container with named volume
docker run -d \
  --name veritable-games-postgres \
  --restart always \
  --network veritable-games-network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=veritable_games \
  -v veritable-games-postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  --health-cmd="pg_isready -U postgres" \
  postgres:15-alpine

# 5. Connect to Coolify network
docker network connect coolify veritable-games-postgres

# 6. Restore data
cat /home/user/backups/pre-volume-migration.sql | \
  docker exec -i veritable-games-postgres psql -U postgres

# 7. Verify data integrity
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  "SELECT COUNT(*) FROM anarchist.documents;"
```

**Benefits:**
- Easier backups (just backup the named volume)
- Clearer data management
- Can mount volume in another container if needed
- Easier to migrate to another server

---

## See Also

- [INFRASTRUCTURE_INVENTORY.md](./INFRASTRUCTURE_INVENTORY.md) - Complete infrastructure overview
- [VOLUME_BACKUP_STRATEGY.md](./VOLUME_BACKUP_STRATEGY.md) - Volume backup procedures
- [/home/user/CLAUDE.md](../../CLAUDE.md) - Server-level documentation
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [Docker PostgreSQL Official Image](https://hub.docker.com/_/postgres)
