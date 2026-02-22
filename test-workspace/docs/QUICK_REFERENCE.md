# Quick Reference - Anarchist Library Integration

## What Was Built

✅ **24,599 anarchist documents** across 27 languages  
✅ **PostgreSQL database** with full-text search  
✅ **Docker volume** for persistent file storage  
✅ **Service layer** with 10+ methods for querying  
✅ **Unified search** combining library + anarchist  
✅ **Production deployment** via Coolify  

---

## Files Created

### TypeScript Service Layer
- `frontend/src/lib/anarchist/types.ts` - Type definitions
- `frontend/src/lib/anarchist/service.ts` - AnarchistService (507 lines)
- `frontend/src/lib/search/unified-service.ts` - Cross-archive search

### Database
- `frontend/src/lib/database/migrations/002-create-anarchist-schema.sql` - Schema
- `frontend/src/lib/database/migrations/create_anarchist_tables.sql` - Tables

### Configuration
- `docker-compose.yml` - Updated with volume config
- `.gitignore` - Added data exclusions
- `.dockerignore` - Added build exclusions

### Documentation
- `docs/ANARCHIST_LIBRARY_PROJECT_OVERVIEW.md` - Project summary
- `docs/TECHNICAL_ARCHITECTURE.md` - System design
- `docs/IMPLEMENTATION_GUIDE.md` - Developer reference
- `docs/DEPLOYMENT_AND_OPERATIONS.md` - Operations guide
- `docs/TROUBLESHOOTING.md` - Common issues

---

## Key Statistics

| Metric | Value |
|--------|-------|
| Total Documents | 24,599 |
| Languages Supported | 27 |
| Largest Language | English (14,549 docs) |
| Conversion Success Rate | 100% (24,643/24,643) |
| Import Success Rate | 99.8% (24,599/24,643) |
| Storage Size | 1.3 GB markdown + 150 MB DB |
| Disk Space Remaining | 879 GB |
| Import Time | ~15 minutes |

---

## Essential Commands

### Check Status
```bash
# All containers
docker-compose ps

# Database
docker exec veritable-games-postgres pg_isready

# Document count
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'

# Application logs
docker logs veritable-games-app | tail -50
```

### Database Operations
```bash
# Connect to database
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games

# Count by language
SELECT language, COUNT(*) FROM anarchist.documents GROUP BY language ORDER BY COUNT(*) DESC;

# Test full-text search
SELECT slug, title FROM anarchist.documents WHERE title ILIKE '%anarchism%' LIMIT 5;

# Check indexes
SELECT indexname FROM pg_indexes WHERE schemaname = 'anarchist';

# Rebuild indexes
REINDEX SCHEMA anarchist;
```

### Service Layer Usage
```typescript
import { anarchistService } from '@/lib/anarchist/service';

// Search documents
const results = await anarchistService.getDocuments({
  query: 'mutual aid',
  language: 'en',
  limit: 20
});

// Get single document
const doc = await anarchistService.getDocumentBySlug('slug');

// Get available languages
const languages = await anarchistService.getAvailableLanguages();

// Get statistics
const stats = await anarchistService.getArchiveStats();
```

### Deployment
```bash
# Push code to production
git add .
git commit -m "Update: description"
git push origin main
# Coolify automatically deploys

# Manual deployment if needed
ssh user@192.168.1.15
cd ~/Projects/veritable-games-main
git pull && docker-compose down && docker-compose up -d
```

---

## Debugging

### Quick Diagnostics
```bash
#!/bin/bash
echo "=== System Status ==="
docker-compose ps

echo -e "\n=== Database Connection ==="
docker exec veritable-games-postgres pg_isready

echo -e "\n=== Document Count ==="
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'

echo -e "\n=== Language Breakdown ==="
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT language, COUNT(*) FROM anarchist.documents GROUP BY language ORDER BY COUNT(*) DESC LIMIT 5;'

echo -e "\n=== Recent Errors ==="
docker logs veritable-games-app 2>&1 | grep -i error | tail -5

echo -e "\n=== Disk Space ==="
df -h /var/lib/docker/
```

---

## Architecture Summary

```
User Request
    ↓
Next.js API Route
    ↓
AnarchistService
    ↓
dbAdapter (PostgreSQL)
    ↓
anarchist.documents table (24,599 rows)
    ↓
Results + File Content (from Docker volume)
    ↓
Response to User
```

---

## Language Support

| Code | Language | Documents |
|------|----------|-----------|
| en | English | 14,549 |
| pl | Polish | 1,597 |
| ru | Russian | 1,098 |
| fr | French | 970 |
| sea | Southeast Asian | 835 |
| de | German | 737 |
| pt | Portuguese | 673 |
| sr | Serbian | 603 |
| es | Spanish | 603 |
| sv | Swedish | 579 |
| tr | Turkish | 538 |
| ro | Romanian | 470 |
| ja | Japanese | 226 |
| nl | Dutch | 214 |
| fi | Finnish | 205 |
| mk | Macedonian | 165 |
| ko | Korean | 162 |
| it | Italian | 145 |
| + 9 more | Other languages | 170 |

---

## Common Operations

### Add New Documents
```bash
# Add single document to database
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'INSERT INTO anarchist.documents (slug, title, language, file_path, category) VALUES ("slug", "Title", "en", "path", "anarchist-en");'

# Bulk import new batch
python3 import_new_documents.py
```

### Monitor Imports
```bash
# Watch import progress
ssh user@192.168.1.15
tail -f simple_import.log

# Check current count
watch -n 5 'docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "SELECT COUNT(*) FROM anarchist.documents;"'
```

### Performance Tuning
```bash
# Analyze table statistics
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'ANALYZE anarchist.documents;'

# Check index usage
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = "anarchist";'

# Add caching in service layer
const cache = new Map();
const key = `${query}:${language}`;
if (cache.has(key)) return cache.get(key);
const results = await anarchistService.getDocuments({...});
cache.set(key, results);
```

---

## Service Methods Reference

| Method | Purpose | Returns |
|--------|---------|---------|
| `getDocuments(params)` | Flexible search | Array of documents |
| `getDocumentBySlug(slug)` | Load with content | Document + markdown content |
| `search(query, limit)` | Full-text search | Top N results |
| `getDocumentsByLanguage(lang)` | Filter by language | Language-specific docs |
| `getAvailableLanguages()` | List languages | Array of language info |
| `getArchiveStats()` | Overall statistics | Archive metadata |
| `getRecentDocuments(limit)` | Latest additions | Recent documents |
| `getMostViewedDocuments(limit)` | Popular documents | Sorted by views |
| `getRelatedDocuments(id)` | Discovery | Similar documents |
| `incrementViewCount(id)` | Track usage | Void |

---

## Endpoints to Implement

```
GET /api/anarchist/search?q=query&lang=en&limit=20
GET /api/anarchist/documents
GET /api/anarchist/documents/[slug]
GET /api/anarchist/authors
GET /api/anarchist/languages
GET /api/anarchist/statistics
GET /api/search (unified)
```

---

## Environment Variables

```bash
# .env (server)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritable_games
ANARCHIST_LIBRARY_PATH=/app/anarchist-library

# Development
NODE_ENV=development
DEBUG=*

# Production
NODE_ENV=production
```

---

## Emergency Contacts

- **Documentation:** `/home/user/Projects/veritable-games-main/docs/`
- **Server:** `user@192.168.1.15`
- **PostgreSQL:** Port 5432 (internal)
- **Application:** Port 3000 (internal)
- **Web:** Ports 80/443 (Coolify)

---

## Document Data Fetching Quick Reference

### The Bottom Line

✅ **YES - Preview/description data IS being fetched and used**

- Library documents use `description` field
- Anarchist documents use `notes` field
- Both are loaded in list/grid views
- Both are rendered in DocumentCard components
- UI shows first 150 characters as preview text

### Where Preview Data Lives

**In the Database:**

Library Table (`library_documents`):
```
description TEXT  ← Preview text
```

Anarchist Table (`anarchist.documents`):
```
notes TEXT  ← Preview text
```

**In Code Types:**

Unified Interface:
```typescript
interface UnifiedDocument {
  description?: string;  // Maps to both source types
}
```

### How It's Fetched

**Step 1: Database Query**
```sql
SELECT * FROM library_documents d  -- Gets description
SELECT * FROM anarchist.documents d  -- Gets notes
```

**Step 2: Service Layer Normalization**
```typescript
// Library
{ ...doc, description: doc.description }

// Anarchist
{ ...doc }  // notes already in doc
```

**Step 3: UI Rendering**
```typescript
const preview = doc.description?.substring(0, 150) + '...'
// Rendered as gray text under title
```

### Data Flow Diagram

```
Database
    ↓
Service (queries SELECT *)
    ↓
Controller/API (normalizes fields)
    ↓
Frontend (UnifiedDocument)
    ↓
DocumentCard Component
    ↓
Rendered Preview (150 chars)
```

### Key Locations

| What | Where |
|------|-------|
| Type Definition | `/lib/documents/types.ts` |
| Service Query | `/lib/library/service.ts` (lines 149-161) |
| Service Query | `/lib/anarchist/service.ts` (lines 145-157) |
| UI Component | `/components/library/DocumentCard.tsx` (lines 28-34) |
| Database Schema | `/scripts/seeds/schemas/library.sql` |
| Database Schema | `/lib/database/migrations/002-create-anarchist-schema.sql` |

### Summary Table

| Feature | Library | Anarchist |
|---------|---------|-----------|
| Preview fetched | ✅ Yes | ✅ Yes |
| Preview shown | ✅ Yes | ✅ Yes |
| Tags loaded | ✅ Yes | ❌ No |
| Content loaded (list) | ❌ No | ❌ No |

For complete details, see `docs/investigations/DOCUMENT_DATA_INVESTIGATION.md`

---

## Next Steps

1. **Test API endpoints** - Create REST endpoints for search, browse, view
2. **Build UI components** - Create React components for search interface
3. **Monitor performance** - Track query times and optimize if needed
4. **Plan Marxist integration** - Prepare for 500,000+ document archive

See `ANARCHIST_LIBRARY_PROJECT_OVERVIEW.md` for complete details.
