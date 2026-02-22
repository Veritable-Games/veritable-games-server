📍 **Navigation**: [CLAUDE.md](../CLAUDE.md) > [docs/](./README.md) > Troubleshooting

---

# Troubleshooting Guide - Anarchist Library Integration

## Quick Reference

| Problem | Check | Solution |
|---------|-------|----------|
| No database connection | `docker-compose ps` | `docker-compose up -d` |
| No documents in DB | `SELECT COUNT(*)` | Re-run `python3 simple_import.py` |
| Service errors | `docker logs` | Check service layer connectivity |
| Slow queries | `EXPLAIN ANALYZE` | Rebuild indexes, add caching |
| File not found | `find /volume/` | Copy files to Docker volume |
| Search returns nothing | Database state | Verify documents imported |

---

## Database Issues

### PostgreSQL Connection Failed
**Error:** `Error: connect ECONNREFUSED`

```bash
docker-compose ps veritable-games-postgres
docker-compose up -d veritable-games-postgres
docker exec veritable-games-postgres pg_isready
```

### Anarchist Schema Not Found
**Error:** `relation "anarchist.documents" does not exist`

```bash
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < \
  frontend/src/lib/database/migrations/002-create-anarchist-schema.sql

docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'
```

### No Documents in Database
**Error:** All queries return zero results

```bash
ssh user@192.168.1.15 "python3 simple_import.py"
tail -f import.log
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'
```

---

## File System Issues

### File Not Found
**Error:** `ENOENT: no such file or directory` loading documents

```bash
docker volume ls | grep anarchist-library
ssh user@192.168.1.15 "find /var/lib/docker/volumes/anarchist-library/_data -name '*.md' | wc -l"

# If missing, copy files
docker run -v anarchist-library:/data -v ~/converted-markdown:/source alpine \
  cp -r /source/. /data/
```

---

## Service Layer Issues

### Type Errors
```bash
npm run type-check
ls frontend/src/lib/anarchist/service.ts
ls frontend/src/lib/anarchist/types.ts
```

### Empty Search Results
```typescript
// Test connectivity
try {
  const result = await dbAdapter.query(
    'SELECT COUNT(*) FROM anarchist.documents',
    [],
    { schema: 'anarchist' }
  );
  console.log('Count:', result.rows[0].count);
} catch (error) {
  console.error('Failed:', error.message);
}
```

---

## Deployment Issues

### Coolify Deployment Fails
```bash
ssh user@192.168.1.15
cd ~/Projects/veritable-games-main
git pull origin main
docker-compose down
docker-compose up -d
```

---

## Emergency Commands

```bash
# Status check
docker-compose ps

# View logs
docker logs veritable-games-app | tail -100
docker logs veritable-games-postgres | tail -100

# Database check
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'

# Disk space
df -h /var/lib/docker/

# Restart services
docker-compose restart

# Rebuild indexes
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'REINDEX SCHEMA anarchist;'
```

---

## Full System Reset

```bash
docker-compose down
tar -czf backup-$(date +%s).tar.gz /var/lib/docker/volumes/anarchist-library/_data
docker volume rm veritable-games-postgres
docker-compose up -d

# Re-apply schema
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < \
  frontend/src/lib/database/migrations/002-create-anarchist-schema.sql

# Re-import documents
python3 simple_import.py
```

See `DEPLOYMENT_AND_OPERATIONS.md` for detailed procedures.
