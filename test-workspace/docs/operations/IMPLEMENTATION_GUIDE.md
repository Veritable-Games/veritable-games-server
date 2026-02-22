# Implementation Guide - Anarchist Library Integration

## Quick Start for Developers

### Prerequisites
- Node.js 18+ installed
- PostgreSQL running (Docker container)
- Access to server at `user@192.168.1.15`
- 1.5 GB disk space for documents

### Step 1: Code Review
```bash
# Review the service layer implementation
cat frontend/src/lib/anarchist/types.ts
cat frontend/src/lib/anarchist/service.ts
cat frontend/src/lib/search/unified-service.ts

# Check database schema
cat frontend/src/lib/database/migrations/002-create-anarchist-schema.sql
```

### Step 2: Local Development
```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Start development server
npm run dev

# Test service layer directly
node -e "import('./frontend/src/lib/anarchist/service.ts').then(m => console.log('Service loaded'))"
```

### Step 3: Verify Production Status
```bash
# SSH to server
ssh user@192.168.1.15

# Check PostgreSQL
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c \
  'SELECT COUNT(*) FROM anarchist.documents;'

# Check Docker volume
find /var/lib/docker/volumes/anarchist-library/_data -name '*.md' | wc -l

# Check service logs
docker logs veritable-games-app | grep -i anarchist | tail -20
```

## File Structure Guide

### Service Layer Files

#### `frontend/src/lib/anarchist/types.ts`
**Purpose:** TypeScript type definitions
**Lines:** ~150
**Key Types:**
- `AnarchistDocument` - Single document metadata
- `AnarchistDocumentWithContent` - Document + full text
- `AnarchistSearchParams` - Query parameters
- `AnarchistSearchResult` - Query results
- `AnarchistLanguage` - Language metadata

**When to Edit:**
- Adding new fields to documents
- Changing search parameters
- Modifying result structure

#### `frontend/src/lib/anarchist/service.ts`
**Purpose:** Main service layer
**Lines:** ~507
**Key Methods:**
1. `getDocuments()` - Flexible search and filter
2. `getDocumentBySlug()` - Load single document with content
3. `search()` - Full-text search
4. `getDocumentsByLanguage()` - Filter by language
5. `getAvailableLanguages()` - List languages
6. `getArchiveStats()` - Overall statistics
7. `getRecentDocuments()` - Recent additions
8. `getMostViewedDocuments()` - Popularity ranking
9. `getRelatedDocuments()` - Discovery feature
10. `incrementViewCount()` - Usage tracking

**When to Edit:**
- Adding new query methods
- Changing search logic
- Modifying result sorting
- Optimizing performance

#### `frontend/src/lib/search/unified-service.ts`
**Purpose:** Cross-archive search
**Lines:** ~200+
**Key Methods:**
1. `searchAll()` - Search across library + anarchist
2. `getArchiveStats()` - Combined statistics
3. `getRecent()` - Recent from both archives
4. `getMostViewed()` - Popular from both archives

**When to Edit:**
- Changing result ranking
- Modifying parallel queries
- Adding new archives (Marxist, etc.)
- Optimizing search performance

#### `frontend/src/lib/database/migrations/002-create-anarchist-schema.sql`
**Purpose:** PostgreSQL schema definition
**Contains:**
- Table definitions (documents, tags, document_tags)
- Index creation
- Trigger functions
- Constraints

**When to Use:**
- First-time deployment
- Schema updates
- Adding new features

### Configuration Files

#### `docker-compose.yml`
**Volume Configuration:**
```yaml
volumes:
  anarchist-library:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/docker/volumes/anarchist-library/_data
```

**When to Edit:**
- Changing volume location
- Adjusting permissions
- Adding new volumes

#### `.gitignore`
**Anarchist Library Entries:**
```
anarchist-library/
/anarchist-library/
converted-markdown/
/converted-markdown/
*.muse
/processing/
anarchist_library_texts_*/
anarchist_library_urls_*.json
```

**When to Edit:**
- Adding new data directories
- Excluding build artifacts
- Protecting secrets

#### `.dockerignore`
**Purpose:** Prevent Docker build bloat

**When to Edit:**
- Optimizing build size
- Excluding large files
- Speeding up deployments

## Database Operations

### Check Database Status
```sql
-- Connected to Docker PostgreSQL
docker exec veritable-games-postgres psql -U postgres -d veritable_games

-- Check documents count
SELECT COUNT(*) FROM anarchist.documents;

-- Count by language
SELECT language, COUNT(*)
FROM anarchist.documents
GROUP BY language
ORDER BY COUNT(*) DESC;

-- Test full-text search
SELECT slug, title
FROM anarchist.documents
WHERE title ILIKE '%anarchism%'
LIMIT 5;

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'anarchist';

-- Check largest tables
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'anarchist'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Add New Document Manually
```sql
INSERT INTO anarchist.documents (
  slug, title, author, language, file_path, category
) VALUES (
  'test-document',
  'Test Document Title',
  'Test Author',
  'en',
  'test-document.md',
  'anarchist-en'
);
```

### Update Document
```sql
UPDATE anarchist.documents
SET title = 'New Title', updated_at = NOW()
WHERE slug = 'some-document';
```

### Delete Document
```sql
DELETE FROM anarchist.documents WHERE slug = 'some-document';
```

## Service Layer Usage Examples

### Example 1: Search for Documents
```typescript
import { anarchistService } from '@/lib/anarchist/service';

// Search for "mutual aid" in English
const results = await anarchistService.getDocuments({
  query: 'mutual aid',
  language: 'en',
  limit: 20
});

console.log(`Found ${results.total} documents`);
results.documents.forEach(doc => {
  console.log(`- ${doc.title} by ${doc.author}`);
});
```

### Example 2: Get Single Document with Content
```typescript
const document = await anarchistService.getDocumentBySlug(
  'the-conquest-of-bread'
);

if (document) {
  console.log(document.title);
  console.log(document.content.substring(0, 500)); // First 500 chars
  console.log(document.frontmatter); // YAML metadata
}
```

### Example 3: Get All Documents in Language
```typescript
const polishDocs = await anarchistService.getDocumentsByLanguage('pl');
console.log(`Polish documents: ${polishDocs.documents.length}`);
```

### Example 4: Get Language List
```typescript
const languages = await anarchistService.getAvailableLanguages();

languages.forEach(lang => {
  console.log(`${lang.name} (${lang.code}): ${lang.document_count} docs`);
});
```

### Example 5: Get Archive Statistics
```typescript
const stats = await anarchistService.getArchiveStats();

console.log(`Total documents: ${stats.total_documents}`);
console.log(`Languages: ${stats.total_languages}`);
console.log(`Total authors: ${stats.total_authors}`);
console.log(`Date range: ${stats.oldest_publication} to ${stats.newest_publication}`);
```

### Example 6: Track View Usage
```typescript
// When user views a document
await anarchistService.incrementViewCount(documentId);

// Later, get most viewed
const popular = await anarchistService.getMostViewedDocuments(10);
console.log('Top 10 most viewed:');
popular.forEach(doc => {
  console.log(`- ${doc.title}: ${doc.view_count} views`);
});
```

### Example 7: Unified Search
```typescript
import { unifiedSearchService } from '@/lib/search/unified-service';

const results = await unifiedSearchService.searchAll('anarchism', 50);

console.log(`Total results: ${results.summary.total}`);
console.log(`From library: ${results.summary.from_library}`);
console.log(`From anarchist: ${results.summary.from_anarchist}`);

results.results.forEach(doc => {
  console.log(`[${doc.source.toUpperCase()}] ${doc.title}`);
});
```

## Creating API Endpoints

### REST API Example: Search
```typescript
// pages/api/anarchist/search.ts
import { anarchistService } from '@/lib/anarchist/service';

export default async function handler(req, res) {
  const { q, lang, limit = 20 } = req.query;

  try {
    const results = await anarchistService.getDocuments({
      query: q,
      language: lang,
      limit: Math.min(parseInt(limit), 500)
    });

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
}
```

**Usage:**
```
GET /api/anarchist/search?q=anarchism&lang=en&limit=20
```

### REST API Example: Get Document
```typescript
// pages/api/anarchist/documents/[slug].ts
import { anarchistService } from '@/lib/anarchist/service';

export default async function handler(req, res) {
  const { slug } = req.params;

  try {
    const document = await anarchistService.getDocumentBySlug(slug);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Increment view count
    await anarchistService.incrementViewCount(document.id);

    res.status(200).json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load document' });
  }
}
```

**Usage:**
```
GET /api/anarchist/documents/the-conquest-of-bread
```

## Testing

### Unit Test Example
```typescript
// __tests__/lib/anarchist/service.test.ts
import { anarchistService } from '@/lib/anarchist/service';

describe('AnarchistService', () => {
  test('getDocuments returns array', async () => {
    const result = await anarchistService.getDocuments({ limit: 5 });
    expect(Array.isArray(result.documents)).toBe(true);
  });

  test('search finds documents', async () => {
    const result = await anarchistService.getDocuments({
      query: 'anarchism'
    });
    expect(result.total).toBeGreaterThan(0);
  });

  test('getAvailableLanguages returns 27 languages', async () => {
    const languages = await anarchistService.getAvailableLanguages();
    expect(languages.length).toBe(27);
  });
});
```

### Integration Test Example
```typescript
// __tests__/integration/anarchist.test.ts
describe('Anarchist Archive Integration', () => {
  test('End-to-end search and view', async () => {
    // Search for documents
    const searchResults = await anarchistService.getDocuments({
      query: 'mutual aid',
      language: 'en',
      limit: 1
    });

    expect(searchResults.total).toBeGreaterThan(0);

    // Load document with content
    const doc = await anarchistService.getDocumentBySlug(
      searchResults.documents[0].slug
    );

    expect(doc.content).toBeDefined();
    expect(doc.content.length).toBeGreaterThan(100);

    // Track view
    const oldCount = doc.view_count || 0;
    await anarchistService.incrementViewCount(doc.id);
    // In real scenario, refetch and verify count increased
  });
});
```

## Performance Optimization

### Query Optimization Tips

1. **Always paginate results**
```typescript
// Bad - loads entire result set
const allDocs = await anarchistService.getDocuments({});

// Good - paginated
const page1 = await anarchistService.getDocuments({ limit: 50, page: 1 });
const page2 = await anarchistService.getDocuments({ limit: 50, page: 2 });
```

2. **Use language filters to reduce scope**
```typescript
// Fast - limited to one language
const englishDocs = await anarchistService.getDocuments({
  language: 'en',
  query: 'something'
});

// Slower - searches all 27 languages
const allDocs = await anarchistService.getDocuments({
  query: 'something'
});
```

3. **Cache results when possible**
```typescript
// Cache language list (doesn't change often)
const languages = await anarchistService.getAvailableLanguages();
// Store in memory, Redis, or CDN for 24 hours
```

4. **Use exact slug lookups for single documents**
```typescript
// Fast - uses unique index
const doc = await anarchistService.getDocumentBySlug('slug');

// Slower - full text search
const docs = await anarchistService.getDocuments({
  query: 'exact title'
});
```

## Debugging

### Check Service Logs
```bash
# Development
npm run dev 2>&1 | grep -i anarchist

# Production
docker logs veritable-games-app | grep -i anarchist | tail -50
```

### Debug Database Queries
```typescript
// Add logging to service methods
console.log('Query:', query);
console.log('Params:', params);
const result = await dbAdapter.query(...);
console.log('Result count:', result.rows.length);
```

### Verify File Paths
```bash
# Check if markdown files exist
ssh user@192.168.1.15

# List some files
ls -la /var/lib/docker/volumes/anarchist-library/_data/anarchist_library_texts_en/ | head -20

# Count files
find /var/lib/docker/volumes/anarchist-library/_data -name '*.md' | wc -l

# Verify a specific file
cat /var/lib/docker/volumes/anarchist-library/_data/anarchist_library_texts_en/the-conquest-of-bread.md | head -50
```

## Common Issues & Solutions

### Issue: Service returns no results
1. Check database is running: `docker-compose ps`
2. Verify documents imported: `docker exec veritable-games-postgres psql -U postgres -d veritable_games -c 'SELECT COUNT(*) FROM anarchist.documents;'`
3. Check service logs for errors
4. Verify search query is valid

### Issue: Document content is null
1. Check file exists in volume: `find /var/lib/docker/volumes/anarchist-library/_data -name 'filename.md'`
2. Verify file_path in database: `SELECT file_path FROM anarchist.documents WHERE slug = 'slug';`
3. Check file permissions: `ls -la /var/lib/docker/volumes/anarchist-library/_data/`

### Issue: Slow search queries
1. Check index exists: `SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'anarchist';`
2. Run ANALYZE: `ANALYZE anarchist.documents;`
3. Check query plan: `EXPLAIN SELECT ... FROM anarchist.documents ...`
4. Consider adding caching for popular queries

### Issue: Coolify deployment fails
1. Check git status: `git status`
2. Verify .gitignore excludes large files
3. Check Docker disk space: `docker system df`
4. Review Coolify logs for errors

## Future Development

### Planned Features
1. **UI Components** - Browse, search, view interface
2. **Recommendations** - "Related documents" feature
3. **User Annotations** - Highlighting and notes
4. **Export** - PDF/EPUB generation
5. **Advanced Search** - Boolean operators, phrase search

### Marxists.org Integration (Phase 2)
Follow identical architecture for 500,000+ documents:
1. Create `marxist` schema
2. Build `MarcxistService` (same pattern)
3. Extend `UnifiedSearchService` to 3-way search
4. Add Marxists-specific UI components

---

See related documentation:
- `TECHNICAL_ARCHITECTURE.md` - System design
- `DEPLOYMENT_GUIDE.md` - Server setup
- `TROUBLESHOOTING.md` - Common issues
