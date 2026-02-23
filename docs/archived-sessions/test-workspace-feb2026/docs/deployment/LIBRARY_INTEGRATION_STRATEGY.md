# Large Library Integration Strategy (Anarchist & Marxists)

**Status**: Planning for future integration
**Date**: November 10, 2025
**Purpose**: Strategy for integrating large document libraries (24K+ anarchist, 500K+ marxists texts)

---

## Overview

### Current State
- **Anarchist Library**: 24,643 documents across 27 languages (READY to integrate)
- **Marxists.org**: 500,000+ documents scraping in progress (future)
- **Current Status**: Both have empty Docker volumes created, but no files mounted

### Problem
These libraries are too large to:
- Include in Docker image (bloats deployment)
- Store in git (impossible, not source code)
- Build from scratch (requires hours of scraping/importing)

### Solution
Same externalized volume approach as uploads, but with optimizations for read-heavy access.

---

## Architecture Overview

### Three-Tier Library System

```
Tier 1: Source Documents
├── Anarchist Library (24,643 texts, 27 languages)
│   ├── French (3,000+ docs)
│   ├── Spanish (2,500+ docs)
│   ├── English (8,000+ docs)
│   └── ... (24 more languages)
└── Marxists Archive (500,000+ documents)
    ├── Theoretical works (50,000 docs)
    ├── Historical documents (200,000 docs)
    └── Contemporary analysis (250,000 docs)

Tier 2: Docker Volumes (Persistent Storage)
├── anarchist-library volume (20-50 GB)
└── marxists-library volume (100-200 GB)

Tier 3: Database Index (PostgreSQL)
├── library_documents table (metadata only)
├── library_categories table
├── library_search_index (full-text search)
└── library_sync_log (track imports)
```

### Why This Approach Works

✅ **No Docker Image Bloat**: Libraries not included in image
✅ **Fast Deployments**: Code deploys independent of 500GB of documents
✅ **Independent Updates**: Scraper can run independently, sync to volume
✅ **Search Performance**: Database index separate from document storage
✅ **Disaster Recovery**: Volumes are backed up, documents preserved

---

## Current Investigation Results

### Anarchist Library Status
```
Volume Name:   anarchist-library
Created:       November 8, 2025
Current Size:  4.0 KB (EMPTY)
Expected Size: 20-50 GB
Mount Status:  Volume created but NOT mounted in container
Documents:     0 (should be 24,643)
```

### Marxists Library Status
```
Volume Name:   marxists-library
Created:       November 8, 2025
Current Size:  4.0 KB (EMPTY)
Expected Size: 100-200 GB
Mount Status:  Volume created but NOT mounted in container
Documents:     0 (should be 500,000+)
Scraper:       Running on server (/home/user/scraper.pid)
```

### What's Missing
1. ❌ Documents not imported to volumes
2. ❌ Volumes not mounted in application container
3. ❌ Database tables not populated with metadata
4. ❌ Search indexes not built
5. ❌ File serving routes not configured

---

## Implementation Strategy

### Phase 1: Anarchist Library Integration (Recommended First)

#### 1.1 Obtain Document Source

**Option A: Pre-built dataset** (Fastest)
```bash
# Contact Anarchist Library Archive project for bulk export
# Download pre-packaged 24,643 documents in standardized format
# Each document: title, authors, languages, text content
```

**Option B: Parse existing database**
```bash
# If already imported somewhere, extract from that source
# Usually JSON or XML format from library website
```

**Option C: Scrape from source**
```bash
# Last resort: write scraper for anarchist-library.org
# Takes 24-48 hours to scrape all languages
# Requires careful rate limiting
```

#### 1.2 Import to Server Volume

```bash
# 1. Transfer documents to server (choose method)
# A) Direct upload (if < 1GB per transfer)
scp anarchist-library.tar.gz user@192.168.1.15:/tmp/

# B) rsync for large transfers
rsync -avz --progress \
  /local/anarchist-library/ \
  user@192.168.1.15:/tmp/anarchist-library/

# 2. Extract to Docker volume
ssh user@192.168.1.15 << 'EOF'
# Create staging directory
mkdir -p /tmp/anarchist-staging

# Extract files
tar xzf /tmp/anarchist-library.tar.gz -C /tmp/anarchist-staging

# Copy to volume
docker run --rm \
  -v anarchist-library:/mnt/library \
  -v /tmp/anarchist-staging:/mnt/staging \
  alpine cp -r /mnt/staging/* /mnt/library/

# Verify
docker run --rm -v anarchist-library:/mnt/library alpine \
  sh -c 'find /mnt/library -type f | wc -l && du -sh /mnt/library'

# Cleanup
rm -rf /tmp/anarchist-staging /tmp/anarchist-library.tar.gz
EOF
```

#### 1.3 Configure Coolify Volume Mount

**In Coolify Dashboard:**

Add volume:
```
Source:      anarchist-library
Mount Path:  /app/lib/anarchist
Mode:        Read-only
```

Or via docker-compose:
```yaml
services:
  veritable-games:
    volumes:
      - anarchist-library:/app/lib/anarchist:ro
```

#### 1.4 Populate Database Index

**SQL Script** (`frontend/scripts/library/index-anarchist-library.ts`):

```typescript
import { dbAdapter } from '@/lib/database/adapter';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface AnarchistDocument {
  id: string;
  title: string;
  authors: string[];
  language: string;
  year: number;
  content: string;
  url?: string;
}

async function indexAnarchistLibrary() {
  const libraryPath = '/app/lib/anarchist';

  try {
    // Read all documents
    const languages = await readdir(libraryPath);

    for (const language of languages) {
      const langPath = join(libraryPath, language);
      const documents = await readdir(langPath);

      for (const docFile of documents) {
        if (!docFile.endsWith('.json')) continue;

        const docPath = join(langPath, docFile);
        const rawContent = await readFile(docPath, 'utf-8');
        const doc: AnarchistDocument = JSON.parse(rawContent);

        // Insert into database
        await dbAdapter.query(
          `INSERT INTO library.documents
           (id, title, authors, language, year, content, source, imported_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (id) DO UPDATE
           SET updated_at = NOW()`,
          [
            doc.id,
            doc.title,
            JSON.stringify(doc.authors),
            language,
            doc.year || null,
            doc.content,
            'anarchist-library'
          ]
        );
      }

      console.log(`✓ Indexed ${documents.length} documents from ${language}`);
    }

    // Build full-text search index
    await dbAdapter.query(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY library_search_index;
    `);

    console.log('✓ Search index built');
  } catch (error) {
    console.error('Index error:', error);
    throw error;
  }
}

// Run: npm run library:index:anarchist
```

#### 1.5 Test Access

```bash
# 1. Verify files exist in container
ssh user@192.168.1.15
docker exec m4s0kwo4kc4oooocck4sswc4 ls /app/lib/anarchist/ | head -10

# 2. Test database queries
npm run db:query "SELECT COUNT(*) FROM library.documents WHERE source = 'anarchist-library'"
# Should return: 24643

# 3. Test API endpoint
curl "https://www.veritablegames.com/api/library/search?q=anarchism&source=anarchist"
# Should return search results
```

---

### Phase 2: Marxists Library Integration

#### 2.1 Complete Scraping

**Current Status**:
- Scraper running on server (`/home/user/scraper.pid`)
- No documents imported yet to volume

**Steps**:

```bash
# 1. Check scraper status
ssh user@192.168.1.15
ps aux | grep scraper
cat /home/user/scraper.pid

# 2. Monitor scraping progress
tail -f /home/user/scraping/scraper.log

# 3. When complete (500,000+ documents), import to volume
npm run library:import:marxists

# 4. Index to database
npm run library:index:marxists
```

#### 2.2 Import to Volume

Similar to Anarchist, but larger transfer:

```bash
# Transfer 100-200GB (will take several hours)
rsync -avz --progress \
  /home/user/scraping/marxists/ \
  user@192.168.1.15:/tmp/marxists-staging/

# Copy to volume
docker run --rm \
  -v marxists-library:/mnt/library \
  -v /tmp/marxists-staging:/mnt/staging \
  --memory 4gb \
  alpine cp -r /mnt/staging/* /mnt/library/
```

#### 2.3 Configure Volume Mount

```yaml
services:
  veritable-games:
    volumes:
      - marxists-library:/app/lib/marxists:ro
```

---

## Database Schema

### Library Documents Table

```sql
CREATE TABLE IF NOT EXISTS library.documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors JSONB,                    -- ["Author 1", "Author 2"]
  language VARCHAR(5),              -- en, fr, es, etc.
  year INTEGER,
  categories JSONB,                 -- ["theory", "history"]
  source VARCHAR(50),               -- 'anarchist-library' or 'marxists'
  content TEXT,                     -- Full text (can be large)
  content_preview VARCHAR(500),     -- First 500 chars for preview
  word_count INTEGER,
  file_size INTEGER,
  file_path TEXT,                   -- Path on volume
  import_status VARCHAR(20),        -- indexed, pending, error
  full_text_search TSVECTOR,        -- PostgreSQL FTS index
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_at TIMESTAMP
);

-- Search index
CREATE INDEX idx_library_search ON library.documents
  USING GIN(full_text_search);

CREATE INDEX idx_library_source ON library.documents(source);
CREATE INDEX idx_library_language ON library.documents(language);
CREATE INDEX idx_library_year ON library.documents(year);

-- Full-text search materialized view
CREATE MATERIALIZED VIEW library_search_index AS
SELECT
  id,
  title,
  authors,
  language,
  source,
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', content_preview), 'B') as full_text_search
FROM library.documents
WHERE import_status = 'indexed';
```

---

## API Routes for Libraries

### Search Library

```typescript
// GET /api/library/search?q=query&source=anarchist&language=en
export const GET = withSecurity(async (request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const source = searchParams.get('source') || 'anarchist-library';
  const language = searchParams.get('language');

  const result = await dbAdapter.query(
    `SELECT id, title, authors, language, year, content_preview
     FROM library.documents
     WHERE full_text_search @@ plainto_tsquery($1)
     AND source = $2
     ${language ? 'AND language = $3' : ''}
     LIMIT 50`,
    language ? [query, source, language] : [query, source]
  );

  return successResponse(result.rows);
});
```

### Get Document

```typescript
// GET /api/library/documents/:id
export const GET = async (request, context) => {
  const params = await context.params;
  const { id } = params;

  const result = await dbAdapter.query(
    `SELECT * FROM library.documents WHERE id = $1`,
    [id]
  );

  if (!result.rows.length) {
    return errorResponse('Document not found', 404);
  }

  return successResponse(result.rows[0]);
};
```

---

## File Organization on Volumes

### Anarchist Library

```
anarchist-library volume (20-50 GB)
├── en/                           (English texts)
│   ├── bakunin-god-state.json
│   ├── kropotkin-mutual-aid.json
│   └── ...
├── es/                           (Spanish)
├── fr/                           (French)
└── ... (27 languages total)

Each document:
{
  "id": "bakunin-god-state-en-1882",
  "title": "God and the State",
  "authors": ["Mikhail Bakunin"],
  "language": "en",
  "year": 1882,
  "content": "...",
  "url": "..."
}
```

### Marxists Library

```
marxists-library volume (100-200 GB)
├── authors/                      (Organized by author)
│   ├── marx/
│   ├── engels/
│   ├── lenin/
│   └── ...
├── categories/                   (Alternative organization)
│   ├── theory/
│   ├── history/
│   └── ...
└── chronological/                (By publication date)
```

---

## Performance Considerations

### Database Indexing

```sql
-- Full-text search index
CREATE INDEX CONCURRENTLY idx_library_fts
ON library.documents USING GIN(full_text_search);

-- Source filtering (frequently used)
CREATE INDEX idx_library_source_language
ON library.documents(source, language);

-- Year filtering
CREATE INDEX idx_library_year_source
ON library.documents(year, source);
```

### Query Optimization

```typescript
// Good: Uses indexes
const fastQuery = await dbAdapter.query(
  `SELECT id, title FROM library.documents
   WHERE source = $1 AND language = $2
   AND full_text_search @@ $3
   LIMIT 10`,
  ['anarchist-library', 'en', 'bakunin']
);

// Slow: Full table scan
const slowQuery = await dbAdapter.query(
  `SELECT id, title FROM library.documents
   WHERE content LIKE '%bakunin%'`
);
```

### Caching Strategy

```typescript
// Cache search results for 1 hour
const cacheKey = `library:search:${source}:${query}:${language}`;

const cached = await cache.get(cacheKey);
if (cached) return successResponse(cached);

const results = await dbAdapter.query(...);
await cache.set(cacheKey, results, { ttl: 3600 });

return successResponse(results);
```

---

## Backup Strategy

### Volume Backups

```bash
# Daily backup of anarchist library
0 3 * * * docker run --rm \
  -v anarchist-library:/mnt/source \
  -v /var/backups/anarchist-$(date +\%Y\%m\%d):/mnt/backup \
  alpine cp -r /mnt/source /mnt/backup

# Keep last 30 days
find /var/backups/anarchist-* -mtime +30 -type d -exec rm -rf {} \;
```

---

## Timeline & Resources

### Anarchist Library (2-4 weeks)
- [ ] Week 1: Obtain source documents (24,643 texts)
- [ ] Week 1-2: Transfer to server (10-50 GB)
- [ ] Week 2: Mount volume and configure access
- [ ] Week 2-3: Build database index (24K documents)
- [ ] Week 3: Test search and API
- [ ] Week 3-4: Production deployment

### Marxists Library (4-8 weeks)
- [ ] Week 1-2: Complete scraping (500K documents)
- [ ] Week 2-3: Transfer to server (100-200 GB)
- [ ] Week 3: Mount volume
- [ ] Week 3-4: Build database index (500K documents)
- [ ] Week 4-5: Optimize search performance
- [ ] Week 5-6: Test at scale
- [ ] Week 6-8: Production deployment

---

## Success Metrics

✅ **Anarchist Library Live**
- 24,643 documents indexed
- Full-text search working
- All 27 languages accessible
- Average search < 100ms

✅ **Marxists Library Live**
- 500,000+ documents indexed
- Full-text search working
- Browsing by author/category
- Average search < 200ms

✅ **Performance**
- Deployments < 2 minutes (independent of library size)
- No impact on application startup time
- Database queries < 500ms for common searches

---

## Related Documentation

- **[EXTERNALIZED_FILES_ARCHITECTURE.md](./EXTERNALIZED_FILES_ARCHITECTURE.md)** - Base architecture
- **[FILE_SYNC_WORKFLOW.md](./FILE_SYNC_WORKFLOW.md)** - File sync patterns
- **[ANARCHIST_LIBRARY_ARCHITECTURE.md](../ANARCHIST_LIBRARY_ARCHITECTURE.md)** - Current implementation

---

**Status**: Ready for planning
**Estimated Total Effort**: 6-12 weeks (both libraries)
**Impact**: Unlock 524,000+ documents, zero deployment impact

