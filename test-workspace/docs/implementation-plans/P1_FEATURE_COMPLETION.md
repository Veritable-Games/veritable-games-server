# P1 Feature Completion - Implementation Plan

**Priority:** P1 (High - Feature Gaps)
**Estimated Time:** 4-6 hours
**Impact:** Missing features, incomplete implementations, cleanup

---

## Overview

This document outlines high-priority feature gaps that should be completed to bring the library system to a stable, production-ready state.

---

## Feature 1: Anarchist Tags API Endpoint

**Status:** Missing (deployed in container but not in git repository)
**Severity:** High
**Impact:** Frontend expects `/api/anarchist/tags` but it doesn't exist in source code

### Problem Description

The frontend code references `/api/anarchist/tags` endpoint for autocomplete and tag filtering, but this route doesn't exist in the git repository. It may have been created manually in the container (ephemeral) or was never implemented.

**Evidence:**
- Frontend likely calls this endpoint for tag autocomplete
- Unified tag schema suggests tags should be queryable
- Similar endpoint exists for library tags (verify)

### Implementation Plan

**Time Estimate:** 2-3 hours

**Step 1: Create Route File** (30 minutes)

Create `/frontend/src/app/api/anarchist/tags/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAnarchistTags } from '@/lib/anarchist/tags-service';
import { applyRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 100); // 100 req/min
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    const params = {
      query: searchParams.get('query') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      min_usage: parseInt(searchParams.get('min_usage') || '1'),
      sort_by: searchParams.get('sort_by') as 'name' | 'usage' | undefined,
    };

    const tags = await getAnarchistTags(params);

    return NextResponse.json({
      success: true,
      data: tags,
      count: tags.length
    });

  } catch (error) {
    console.error('Error fetching anarchist tags:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tags',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create Tags Service** (1 hour)

Create `/frontend/src/lib/anarchist/tags-service.ts`:

```typescript
import { query } from '@/lib/db';

export interface AnarchistTag {
  id: number;
  name: string;
  normalized_name: string;
  usage_count: number;
}

export interface GetAnarchistTagsParams {
  query?: string;
  limit?: number;
  min_usage?: number;
  sort_by?: 'name' | 'usage';
}

export async function getAnarchistTags(
  params: GetAnarchistTagsParams = {}
): Promise<AnarchistTag[]> {
  const {
    query: searchQuery,
    limit = 50,
    min_usage = 1,
    sort_by = 'usage'
  } = params;

  let sql = `
    SELECT
      t.id,
      t.name,
      t.normalized_name,
      COUNT(dt.document_id) as usage_count
    FROM shared.tags t
    INNER JOIN anarchist.document_tags dt ON t.id = dt.tag_id
    WHERE 1=1
  `;

  const queryParams: any[] = [];

  // Add search filter
  if (searchQuery) {
    queryParams.push(`%${searchQuery.toLowerCase()}%`);
    sql += ` AND t.normalized_name LIKE $${queryParams.length}`;
  }

  // Group by tag
  sql += `
    GROUP BY t.id, t.name, t.normalized_name
  `;

  // Filter by minimum usage
  if (min_usage > 1) {
    sql += ` HAVING COUNT(dt.document_id) >= ${min_usage}`;
  }

  // Sort
  if (sort_by === 'name') {
    sql += ` ORDER BY t.name ASC`;
  } else {
    sql += ` ORDER BY usage_count DESC, t.name ASC`;
  }

  // Limit
  sql += ` LIMIT ${limit}`;

  const result = await query(sql, queryParams);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    normalized_name: row.normalized_name,
    usage_count: parseInt(row.usage_count)
  }));
}

export async function getTopAnarchistTags(limit: number = 20): Promise<AnarchistTag[]> {
  return getAnarchistTags({
    limit,
    sort_by: 'usage',
    min_usage: 10 // Only show tags used at least 10 times
  });
}

export async function searchAnarchistTags(query: string, limit: number = 10): Promise<AnarchistTag[]> {
  return getAnarchistTags({
    query,
    limit,
    sort_by: 'usage'
  });
}
```

**Step 3: Add Tests** (1 hour)

```typescript
// __tests__/api/anarchist/tags.test.ts
describe('GET /api/anarchist/tags', () => {
  it('returns tags sorted by usage by default', async () => {
    const response = await GET(mockRequest);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toBeInstanceOf(Array);
    expect(data.data[0].usage_count).toBeGreaterThanOrEqual(data.data[1].usage_count);
  });

  it('filters tags by query parameter', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/tags?query=anarchism');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    data.data.forEach((tag: AnarchistTag) => {
      expect(tag.normalized_name).toContain('anarchism');
    });
  });

  it('respects limit parameter', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/tags?limit=5');
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.length).toBeLessThanOrEqual(5);
  });

  it('filters by minimum usage', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/tags?min_usage=100');
    const response = await GET(request);
    const data = await response.json();

    data.data.forEach((tag: AnarchistTag) => {
      expect(tag.usage_count).toBeGreaterThanOrEqual(100);
    });
  });

  it('sorts by name when requested', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/tags?sort_by=name');
    const response = await GET(request);
    const data = await response.json();

    const names = data.data.map((t: AnarchistTag) => t.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });
});
```

**Step 4: Verify in Production** (30 minutes)

After deployment:
```bash
# Test endpoint directly
curl https://www.veritablegames.com/api/anarchist/tags?limit=10

# Test with query
curl https://www.veritablegames.com/api/anarchist/tags?query=anarchism&limit=5

# Test sorting
curl https://www.veritablegames.com/api/anarchist/tags?sort_by=name&limit=20
```

---

## Feature 2: Filesystem Content Cleanup

**Status:** Orphaned markdown files on filesystem
**Severity:** Medium
**Impact:** Wasted disk space, potential confusion, no data integrity risk

### Problem Description

After importing documents into PostgreSQL, markdown files remain on the filesystem. These are no longer needed since content is stored in the database (verified by checking document retrieval - it reads from DB, not filesystem).

**Evidence:**
- `/home/user/projects/veritable-games/resources/data/converted-markdown/` contains 24,643 markdown files
- Document service reads from `anarchist.documents.content` column in PostgreSQL
- No code references filesystem markdown files for serving content

### Decision: Archive vs. Delete

**Option 1: Archive (Recommended)**
- Move to compressed archive: `anarchist-markdown-backup-2025-11.tar.gz`
- Keeps original source files for future reference
- Frees up disk space (compress ~90%)
- Can restore if needed

**Option 2: Delete**
- Permanently remove markdown files
- Maximum disk space savings
- Risk: Lose original source format

**Recommendation:** Archive, not delete

### Implementation Plan

**Time Estimate:** 1-2 hours

**Step 1: Verify No Code Dependencies** (30 minutes)

Search codebase for references to markdown files:

```bash
cd /home/user/projects/veritable-games/site

# Search for file system reads of markdown
grep -r "converted-markdown" frontend/src/
grep -r "\.md" frontend/src/lib/anarchist/
grep -r "readFile.*markdown" frontend/src/

# Expected: No results (content comes from DB)
```

**Step 2: Create Archive** (15 minutes)

```bash
cd /home/user/projects/veritable-games/resources/data

# Create compressed archive
tar -czf anarchist-markdown-backup-2025-11.tar.gz converted-markdown/

# Verify archive
tar -tzf anarchist-markdown-backup-2025-11.tar.gz | head -20

# Check file size
ls -lh anarchist-markdown-backup-2025-11.tar.gz
# Expected: ~300-400MB (from ~3.1GB)
```

**Step 3: Move Archive to Safe Location** (5 minutes)

```bash
# Move to archives directory
mv anarchist-markdown-backup-2025-11.tar.gz /home/user/projects/veritable-games/resources/archives/

# Update documentation
echo "Anarchist Library markdown files archived on 2025-11-17" >> /home/user/projects/veritable-games/resources/archives/README.md
```

**Step 4: Remove Original Files** (10 minutes)

```bash
# Only after verifying archive is good
cd /home/user/projects/veritable-games/resources/data

# Remove markdown directory
rm -rf converted-markdown/

# Verify disk space freed
df -h /home/user
```

**Step 5: Update Documentation** (15 minutes)

Update `/home/user/projects/veritable-games/resources/README.md`:

```markdown
## Archive History

### Anarchist Library Markdown (November 2025)
- **Status:** Archived
- **Location:** `/home/user/projects/veritable-games/resources/archives/anarchist-markdown-backup-2025-11.tar.gz`
- **Size:** ~350MB compressed (was ~3.1GB uncompressed)
- **Reason:** Content migrated to PostgreSQL, markdown files no longer needed for serving
- **Restore:** `tar -xzf anarchist-markdown-backup-2025-11.tar.gz`
```

---

## Feature 3: Database Index Optimization

**Status:** Missing optimal indexes
**Severity:** Low-Medium
**Impact:** Query performance degradation as data grows

### Missing Indexes

Based on common query patterns:

**1. Tag Search Index**
```sql
-- Currently missing (verify first)
CREATE INDEX IF NOT EXISTS idx_shared_tags_normalized_name
ON shared.tags(normalized_name);

-- For prefix searches (autocomplete)
CREATE INDEX IF NOT EXISTS idx_shared_tags_normalized_name_prefix
ON shared.tags(normalized_name text_pattern_ops);
```

**2. Document Search Indexes**
```sql
-- Full-text search on title (if not exists)
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_title_fts
ON anarchist.documents USING gin(to_tsvector('english', title));

-- Full-text search on authors
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_authors_fts
ON anarchist.documents USING gin(to_tsvector('english', authors));

-- Combined search (title + authors)
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_search
ON anarchist.documents USING gin(
  (to_tsvector('english', title) || to_tsvector('english', coalesce(authors, '')))
);
```

**3. Composite Indexes for Common Filters**
```sql
-- Language + category combination (common filter)
CREATE INDEX IF NOT EXISTS idx_anarchist_docs_lang_category
ON anarchist.documents(language, category)
WHERE language IS NOT NULL AND category IS NOT NULL;

-- Year range queries
CREATE INDEX IF NOT EXISTS idx_anarchist_docs_year
ON anarchist.documents(year)
WHERE year IS NOT NULL;
```

### Implementation Plan

**Time Estimate:** 1 hour

**Step 1: Verify Existing Indexes** (15 minutes)

```sql
-- Check what indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname IN ('anarchist', 'shared', 'library')
ORDER BY tablename, indexname;
```

**Step 2: Benchmark Current Query Performance** (15 minutes)

```sql
-- Turn on query timing
\timing

-- Test common queries
EXPLAIN ANALYZE
SELECT * FROM anarchist.documents
WHERE to_tsvector('english', title) @@ to_tsquery('anarchism')
LIMIT 20;

EXPLAIN ANALYZE
SELECT * FROM shared.tags
WHERE normalized_name LIKE 'anarch%'
LIMIT 10;
```

**Step 3: Create Missing Indexes** (20 minutes)

Create migration file: `004-optimize-indexes.sql`

```sql
-- Tag search optimization
CREATE INDEX IF NOT EXISTS idx_shared_tags_normalized_name
ON shared.tags(normalized_name);

CREATE INDEX IF NOT EXISTS idx_shared_tags_normalized_name_prefix
ON shared.tags(normalized_name text_pattern_ops);

-- Full-text search optimization
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_title_fts
ON anarchist.documents USING gin(to_tsvector('english', title));

CREATE INDEX IF NOT EXISTS idx_anarchist_documents_authors_fts
ON anarchist.documents USING gin(to_tsvector('english', coalesce(authors, '')));

-- Composite indexes for common filters
CREATE INDEX IF NOT EXISTS idx_anarchist_docs_lang_category
ON anarchist.documents(language, category)
WHERE language IS NOT NULL AND category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_anarchist_docs_year
ON anarchist.documents(year)
WHERE year IS NOT NULL;

-- Analyze tables to update statistics
ANALYZE anarchist.documents;
ANALYZE anarchist.document_tags;
ANALYZE shared.tags;
```

**Step 4: Re-benchmark After Indexing** (10 minutes)

```sql
-- Re-run same queries, compare performance
EXPLAIN ANALYZE
SELECT * FROM anarchist.documents
WHERE to_tsvector('english', title) @@ to_tsquery('anarchism')
LIMIT 20;

-- Should show "Index Scan" instead of "Seq Scan"
```

---

## Deployment Checklist

### Anarchist Tags API
- [ ] Route file created: `/frontend/src/app/api/anarchist/tags/route.ts`
- [ ] Service created: `/frontend/src/lib/anarchist/tags-service.ts`
- [ ] Tests written and passing
- [ ] Rate limiting applied
- [ ] Verified in staging environment
- [ ] Production endpoint tested

### Filesystem Cleanup
- [ ] Verified no code dependencies on markdown files
- [ ] Archive created and verified
- [ ] Archive moved to safe location
- [ ] Original files removed
- [ ] Disk space verified freed
- [ ] Documentation updated

### Index Optimization
- [ ] Existing indexes audited
- [ ] Baseline performance measured
- [ ] Migration file created
- [ ] Indexes created in staging
- [ ] Performance improvement verified
- [ ] Production migration scheduled

---

## Testing Plan

### Anarchist Tags API Testing

**Manual Testing:**
```bash
# Basic functionality
curl https://www.veritablegames.com/api/anarchist/tags

# Search
curl https://www.veritablegames.com/api/anarchist/tags?query=revolution

# Sorting
curl https://www.veritablegames.com/api/anarchist/tags?sort_by=name

# Pagination
curl https://www.veritablegames.com/api/anarchist/tags?limit=100

# Rate limiting
for i in {1..150}; do
  curl https://www.veritablegames.com/api/anarchist/tags
done
# Should see 429 after 100 requests
```

**Integration Testing:**
- Frontend autocomplete uses endpoint correctly
- Tag filtering in UI works end-to-end
- Results update in real-time as user types

### Filesystem Cleanup Testing

**Verification:**
```bash
# Verify archive integrity
tar -tzf anarchist-markdown-backup-2025-11.tar.gz | wc -l
# Should show 24,643 files

# Verify can extract
mkdir test-restore
tar -xzf anarchist-markdown-backup-2025-11.tar.gz -C test-restore
ls test-restore/converted-markdown/ | wc -l
# Should show 24,643 files

# Verify disk space
df -h /home/user
# Should show ~2.7GB freed
```

**Regression Testing:**
- Document retrieval still works (reads from DB)
- Search functionality unaffected
- Tag extraction unaffected (already in DB)

### Index Optimization Testing

**Performance Testing:**
```sql
-- Before and after comparison
-- Tag autocomplete (should be <10ms after indexing)
EXPLAIN ANALYZE
SELECT * FROM shared.tags
WHERE normalized_name LIKE 'anarch%'
LIMIT 10;

-- Full-text search (should be <50ms after indexing)
EXPLAIN ANALYZE
SELECT * FROM anarchist.documents
WHERE to_tsvector('english', title) @@ to_tsquery('anarchism')
LIMIT 20;

-- Filtered queries (should use composite index)
EXPLAIN ANALYZE
SELECT * FROM anarchist.documents
WHERE language = 'en' AND category = 'philosophy'
LIMIT 20;
```

---

## Rollback Procedures

### Anarchist Tags API
```bash
# Revert commit
git revert <commit-hash>

# Redeploy
git push origin main

# No data cleanup needed (read-only endpoint)
```

### Filesystem Cleanup
```bash
# Restore from archive
cd /home/user/projects/veritable-games/resources/data
tar -xzf ../archives/anarchist-markdown-backup-2025-11.tar.gz

# Verify restoration
ls converted-markdown/ | wc -l
# Should show 24,643
```

### Index Optimization
```sql
-- Drop indexes if causing issues
DROP INDEX IF EXISTS idx_shared_tags_normalized_name_prefix;
DROP INDEX IF EXISTS idx_anarchist_documents_title_fts;
-- etc.

-- Restore from backup if needed
-- (Indexes are metadata, no data loss)
```

---

## Success Metrics

### Anarchist Tags API
- **Before:** 404 error, no tag autocomplete
- **After:**
  - 200 response, tags returned
  - Autocomplete works in UI
  - <100ms response time
  - 100 req/min rate limit enforced

### Filesystem Cleanup
- **Before:** 3.1GB markdown files on disk
- **After:**
  - ~350MB compressed archive
  - ~2.7GB disk space freed
  - All content still accessible from DB

### Index Optimization
- **Before:** Slow queries (>500ms for complex searches)
- **After:**
  - Tag autocomplete: <10ms
  - Full-text search: <50ms
  - Filtered queries: <100ms
  - Index scans instead of sequential scans

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-17
**Author:** Claude Code (Feature Analysis)
