# Deployment and Operations Guide

## Deployment Architecture

### Local Development → Server → Production

```
┌─────────────────────────────────────────────────────────────┐
│              LOCAL DEVELOPMENT MACHINE                       │
│  ├─ Make code changes                                        │
│  ├─ Run tests locally                                        │
│  ├─ Commit to GitHub                                         │
│  └─ Push to main branch                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Git webhook triggers
┌────────────────────────────────────────────────────────────┐
│              COOLIFY (Deployment Automation)               │
│  ├─ Detects git push to main                              │
│  ├─ Clones repository                                      │
│  ├─ Runs build process (npm install, npm run build)       │
│  ├─ Starts Docker containers (docker-compose up)          │
│  ├─ Exposes ports (80, 443)                               │
│  └─ Mounts volumes (anarchist-library)                    │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ↓ Port binding
┌────────────────────────────────────────────────────────────┐
│            PRODUCTION SERVER (192.168.1.15)                │
│  ├─ Docker containers running                             │
│  ├─ PostgreSQL database with anarchist schema             │
│  ├─ Node.js app server                                    │
│  ├─ Docker volume: /var/lib/docker/volumes/anarchist-...  │
│  └─ 24,599 markdown files accessible                      │
└────────────────────────────────────────────────────────────┘
```

## Initial Deployment Steps (Reference)

These steps have already been completed. This is for reference only.

### 1. Prepare Code (Completed ✅)
```bash
# Created TypeScript service layer
frontend/src/lib/anarchist/types.ts       # Type definitions
frontend/src/lib/anarchist/service.ts    # Service implementation
frontend/src/lib/search/unified-service.ts # Cross-archive search

# Created database schema
frontend/src/lib/database/migrations/002-create-anarchist-schema.sql

# Updated configuration files
docker-compose.yml                        # Added volume config
.gitignore                               # Added exclusions
.dockerignore                            # Added exclusions
```

### 2. Prepare Data (Completed ✅)
```bash
# On server (user@192.168.1.15):
~/converted-markdown/
├── anarchist_library_texts_en/   # 14,549 files
├── anarchist_library_texts_pl/   # 1,597 files
├── anarchist_library_texts_fr/   # 970 files
└── ... (24 more language directories)

# Docker volume:
/var/lib/docker/volumes/anarchist-library/_data/
└── (same structure, mirrored for production access)
```

### 3. Deploy Database Schema (Completed ✅)
```bash
# Connected to server PostgreSQL
docker exec veritable-games-postgres psql \
  -U postgres -d veritable_games \
  -f /path/to/002-create-anarchist-schema.sql

# Verified tables created
SELECT COUNT(*) FROM anarchist.documents;
SELECT * FROM pg_tables WHERE schemaname = 'anarchist';
```

### 4. Import Documents (Completed ✅)
```bash
# Used Python script to bulk import
python3 simple_import.py

# Result: 24,599 documents imported in ~15 minutes
# Success rate: 99.8%
```

### 5. Deploy Code (Completed ✅)
```bash
# Committed changes
git add frontend/src/lib/anarchist/
git add docker-compose.yml
git commit -m "Add Anarchist Library integration"

# Pushed to GitHub
git push origin main

# Coolify automatically deployed
# - Cloned repo
# - Built Docker image
# - Started containers
# - Mounted volumes
```

## Ongoing Operations

### Daily Monitoring

#### Check System Health
```bash
# SSH to server
ssh user@192.168.1.15

# Check Docker containers
docker-compose ps
# Expected output:
#  NAME                      STATE
#  veritable-games-app       Up (healthy)
#  veritable-games-postgres  Up (healthy)

# Check disk space
df -h /var/lib/docker
# Should have > 500 MB free

# Check PostgreSQL
docker exec veritable-games-postgres pg_isready
# Expected: accepting connections
```

#### Monitor Database
```bash
# Count documents
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'

# Check index health
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes WHERE schemaname = "anarchist";'

# Check table size
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||"."||tablename)) FROM pg_tables WHERE schemaname = "anarchist" ORDER BY pg_total_relation_size DESC;'
```

#### Monitor Application
```bash
# Check recent logs
docker logs veritable-games-app --tail 50

# Watch logs in real-time
docker logs -f veritable-games-app

# Search for errors
docker logs veritable-games-app | grep -i error | tail -20

# Search for anarchist-specific logs
docker logs veritable-games-app | grep -i anarchist | tail -20
```

### Weekly Maintenance

#### 1. Backup Database
```bash
# Backup PostgreSQL schema
docker exec veritable-games-postgres pg_dump \
  -U postgres -d veritable_games \
  -t anarchist.documents \
  -t anarchist.tags \
  -t anarchist.document_tags > anarchist_backup.sql

# Backup markdown files
tar -czf anarchist_backup.tar.gz \
  /var/lib/docker/volumes/anarchist-library/_data/
```

#### 2. Verify Data Integrity
```bash
# Count documents
EXPECTED=24599
ACTUAL=$(docker exec veritable-games-postgres psql -U postgres -d veritable_games -t -c \
  'SELECT COUNT(*) FROM anarchist.documents;' | xargs)

if [ "$ACTUAL" -eq "$EXPECTED" ]; then
  echo "✓ Document count correct"
else
  echo "✗ Document count mismatch: expected $EXPECTED, got $ACTUAL"
fi

# Verify all languages present
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(DISTINCT language) FROM anarchist.documents;'
# Should return 27
```

#### 3. Analyze Query Performance
```bash
# Analyze table statistics
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'ANALYZE anarchist.documents;'

# Check index usage
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT * FROM pg_stat_user_indexes WHERE schemaname = "anarchist" ORDER BY idx_scan DESC;'
```

#### 4. Review Application Logs
```bash
# Get last 1000 lines
docker logs veritable-games-app | tail -1000 > weekly_logs.txt

# Summarize errors
grep ERROR weekly_logs.txt | wc -l
grep WARN weekly_logs.txt | wc -l
```

### Monthly Review

#### 1. Usage Statistics
```bash
# Most viewed documents
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT slug, title, view_count FROM anarchist.documents ORDER BY view_count DESC LIMIT 20;'

# Language breakdown
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT language, COUNT(*) FROM anarchist.documents GROUP BY language ORDER BY COUNT(*) DESC;'

# View count distribution
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) as count, view_count FROM anarchist.documents GROUP BY view_count ORDER BY view_count DESC LIMIT 10;'
```

#### 2. Performance Review
```bash
# Query performance check
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;'

# Index bloat check
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) FROM pg_stat_user_indexes WHERE schemaname = "anarchist";'
```

#### 3. Storage Review
```bash
# Database size
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT pg_size_pretty(pg_database_size("veritable_games"));'

# Volume size
du -sh /var/lib/docker/volumes/anarchist-library/_data/

# Disk usage
df -h /var/lib/docker/
```

## Scaling Operations

### When to Scale

**Scale up if:**
- Query response time exceeds 1 second
- Database CPU usage exceeds 80% sustained
- Disk space drops below 1 GB
- Connection pool reaches capacity

### Scaling Strategies

#### 1. Database Optimization
```sql
-- Rebuild indexes
REINDEX INDEX CONCURRENTLY idx_anarchist_documents_fulltext;

-- Vacuum
VACUUM ANALYZE anarchist.documents;

-- Check and fix table bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'anarchist'
ORDER BY pg_total_relation_size DESC;
```

#### 2. Query Optimization
```typescript
// Use pagination to reduce load
const results = await anarchistService.getDocuments({
  limit: 50,
  page: 1
});

// Use language filters
const results = await anarchistService.getDocuments({
  language: 'en',
  query: 'something'
});

// Cache language list
const languages = await anarchistService.getAvailableLanguages();
// Cache for 24 hours
```

#### 3. Caching Strategy
```typescript
// Implement Redis caching
const cacheKey = `anarchist:${language}:${query}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const results = await anarchistService.getDocuments({
  language, query
});

await redis.setex(cacheKey, 3600, JSON.stringify(results));
return results;
```

#### 4. CDN Strategy
```
Static markdown files → CloudFront/Cloudflare cache
Metadata queries → In-application cache
Full-text search → Database query with caching
```

## Disaster Recovery

### Scenario: Database Corruption

```bash
# 1. Stop the application
docker-compose down

# 2. Restore from backup
psql -U postgres -d veritable_games < anarchist_backup.sql

# 3. Restart
docker-compose up -d

# 4. Verify
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'
```

### Scenario: Lost Docker Volume

```bash
# 1. Check if files still exist
ssh user@192.168.1.15 "ls ~/converted-markdown/anarchist_library_texts_en/ | head -20"

# 2. Recreate Docker volume
docker volume rm anarchist-library
docker volume create anarchist-library

# 3. Copy files back
docker run -v anarchist-library:/data -v ~/converted-markdown:/source alpine \
  cp -r /source/. /data/

# 4. Verify
find /var/lib/docker/volumes/anarchist-library/_data -name '*.md' | wc -l
# Should show 24599
```

### Scenario: PostgreSQL Failure

```bash
# 1. Check PostgreSQL status
docker-compose ps veritable-games-postgres

# 2. View logs
docker logs veritable-games-postgres | tail -50

# 3. Restart PostgreSQL
docker-compose restart veritable-games-postgres

# 4. Wait and verify
sleep 10
docker exec veritable-games-postgres pg_isready

# 5. Check data integrity
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'
```

## Updating the System

### Code Updates
```bash
# Local development
git pull origin main
npm install
npm run build
npm run dev

# Push to production
git add .
git commit -m "Update: description"
git push origin main
# Coolify automatically deploys

# Verify deployment
ssh user@192.168.1.15 "docker logs veritable-games-app | tail -20"
```

### Data Updates (Add New Documents)

```bash
# Add single document
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'INSERT INTO anarchist.documents (slug, title, language, file_path, category) VALUES (...)'

# Bulk import new batch
python3 import_new_documents.py

# Verify
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'
```

### Major Upgrades

Before upgrading:
1. Backup database: `pg_dump -U postgres -d veritable_games > backup.sql`
2. Backup files: `tar -czf backup.tar.gz /var/lib/docker/volumes/`
3. Test upgrade locally
4. Schedule maintenance window
5. Execute upgrade
6. Verify all systems operational
7. Test search functionality

## Future: Marxists.org Integration

When Marxists.org scraper completes (500,000+ documents):

1. Create `marxist` schema (follow same pattern)
2. Import documents to `marxist.documents`
3. Update `UnifiedSearchService` for 3-way search
4. Total archive: 750,000+ documents
5. No changes needed to `AnarchistService`
6. Scale operations accordingly

## Emergency Contacts & Resources

**Documentation:**
- `/home/user/Projects/veritable-games-main/docs/` - All guides
- `TECHNICAL_ARCHITECTURE.md` - System design
- `IMPLEMENTATION_GUIDE.md` - Developer reference
- `TROUBLESHOOTING.md` - Common issues

**Server Information:**
- Address: `user@192.168.1.15`
- PostgreSQL: Port 5432 (internal)
- Application: Port 3000 (internal)
- HTTP/HTTPS: Ports 80/443 (Coolify)

**Key Commands:**
```bash
# Status check
ssh user@192.168.1.15 "docker-compose ps"

# View logs
ssh user@192.168.1.15 "docker logs veritable-games-app | tail -50"

# Database check
ssh user@192.168.1.15 "docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM anarchist.documents;'"

# Restart services
ssh user@192.168.1.15 "docker-compose restart"
```

---

For detailed troubleshooting, see `TROUBLESHOOTING.md`
