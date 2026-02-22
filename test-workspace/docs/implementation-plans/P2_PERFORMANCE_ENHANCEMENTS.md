# P2 Performance Enhancements - Implementation Plan

**Priority:** P2 (Medium - Performance Optimization)
**Estimated Time:** 23 hours
**Impact:** Improved performance, better user experience, reduced server load

---

## Overview

This document outlines performance optimization opportunities identified during the architectural analysis. These enhancements will improve response times, reduce database load, and enhance the overall user experience.

---

## Enhancement 1: Response Caching Layer

**Current State:** Every request hits PostgreSQL, even for identical queries
**Target State:** Frequently accessed data cached in Redis/memory
**Impact:** 80-95% reduction in database load for repeated queries

### Implementation Plan

**Time Estimate:** 8-10 hours

**Step 1: Choose Caching Strategy** (1 hour)

**Options:**
1. **Redis** (Recommended for production)
   - Persistent cache across restarts
   - Shared cache for horizontal scaling
   - Built-in TTL and eviction policies
   - Requires Redis container

2. **In-Memory (LRU Cache)**
   - Simple, no external dependencies
   - Works for single-instance deployment
   - Lost on restart
   - Good for development/staging

**Recommendation:** Implement both with abstraction layer, use Redis in production

**Step 2: Set Up Redis Container** (1 hour)

Add to Coolify or docker-compose:

```yaml
# docker-compose.yml (for local development)
services:
  redis:
    image: redis:7-alpine
    container_name: veritable-games-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - veritable-games-network
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis-data:
```

**Environment Variables:**
```env
REDIS_URL=redis://veritable-games-redis:6379
CACHE_ENABLED=true
CACHE_TTL_DEFAULT=300 # 5 minutes
```

**Step 3: Create Cache Abstraction Layer** (2 hours)

Create `/frontend/src/lib/cache.ts`:

```typescript
import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';

interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}

// Redis adapter
class RedisAdapter implements CacheAdapter {
  private client: Redis;

  constructor(url: string) {
    this.client = new Redis(url);
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async flush(): Promise<void> {
    await this.client.flushall();
  }
}

// In-memory adapter (fallback)
class MemoryAdapter implements CacheAdapter {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache({
      max: 500, // 500 items
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    this.cache.set(key, value, { ttl: ttl * 1000 });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }
}

// Create cache instance
export const cache: CacheAdapter = process.env.REDIS_URL
  ? new RedisAdapter(process.env.REDIS_URL)
  : new MemoryAdapter();

// Helper function for cache-aside pattern
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss, fetch from source
  const value = await fetcher();

  // Store in cache
  await cache.set(key, value, ttl);

  return value;
}
```

**Step 4: Apply Caching to Services** (3 hours)

Update anarchist service:

```typescript
// /frontend/src/lib/anarchist/service.ts
import { getCachedOrFetch, cache } from '@/lib/cache';

export async function getDocuments(params: GetAnarchistDocumentsParams): Promise<GetAnarchistDocumentsResult> {
  // Generate cache key from params
  const cacheKey = `anarchist:docs:${JSON.stringify(params)}`;

  return getCachedOrFetch(
    cacheKey,
    async () => {
      // Original database query logic
      const results = await queryDatabase(params);
      return results;
    },
    300 // 5 minute TTL
  );
}

export async function getDocumentBySlug(slug: string): Promise<AnarchistDocument | null> {
  const cacheKey = `anarchist:doc:${slug}`;

  return getCachedOrFetch(
    cacheKey,
    async () => {
      const result = await query(/* ... */);
      return result.rows[0] || null;
    },
    600 // 10 minute TTL (individual documents change less frequently)
  );
}

// Invalidate cache when documents change
export async function updateDocument(id: number, data: any): Promise<void> {
  await performUpdate(id, data);

  // Invalidate affected cache keys
  await cache.del(`anarchist:doc:${data.slug}`);
  await cache.flush(); // Or selective invalidation
}
```

**Step 5: Cache Warming Strategy** (1 hour)

Create background job to pre-populate cache:

```typescript
// /frontend/src/lib/cache-warmer.ts
import { getTopAnarchistTags } from '@/lib/anarchist/tags-service';
import { getDocuments } from '@/lib/anarchist/service';

export async function warmCache() {
  console.log('Starting cache warming...');

  // Warm popular tags
  await getTopAnarchistTags(100);

  // Warm first page of documents (most accessed)
  await getDocuments({
    page: 1,
    limit: 20,
    sort_by: 'downloads',
    sort_order: 'desc'
  });

  // Warm popular languages
  for (const lang of ['en', 'es', 'de', 'fr']) {
    await getDocuments({
      language: lang,
      page: 1,
      limit: 20
    });
  }

  console.log('Cache warming complete');
}

// Run on server startup
if (process.env.CACHE_WARM_ON_STARTUP === 'true') {
  warmCache().catch(console.error);
}
```

**Step 6: Add Cache Monitoring** (1 hour)

```typescript
// Cache hit/miss tracking
export class CacheMonitor {
  private hits = 0;
  private misses = 0;

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: hitRate.toFixed(2) + '%'
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
  }
}

export const cacheMonitor = new CacheMonitor();
```

**Step 7: Add Tests** (1-2 hours)

```typescript
describe('Cache Layer', () => {
  beforeEach(async () => {
    await cache.flush();
  });

  it('caches responses', async () => {
    const fetcher = jest.fn(() => Promise.resolve({ data: 'test' }));

    const result1 = await getCachedOrFetch('test-key', fetcher);
    const result2 = await getCachedOrFetch('test-key', fetcher);

    expect(result1).toEqual({ data: 'test' });
    expect(result2).toEqual({ data: 'test' });
    expect(fetcher).toHaveBeenCalledTimes(1); // Only called once
  });

  it('respects TTL', async () => {
    const fetcher = jest.fn(() => Promise.resolve({ data: 'test' }));

    await getCachedOrFetch('test-key', fetcher, 1); // 1 second TTL
    await sleep(1100); // Wait for expiry
    await getCachedOrFetch('test-key', fetcher, 1);

    expect(fetcher).toHaveBeenCalledTimes(2); // Called twice after expiry
  });

  it('invalidates on update', async () => {
    await cache.set('test-key', { data: 'old' });
    await cache.del('test-key');

    const value = await cache.get('test-key');
    expect(value).toBeNull();
  });
});
```

---

## Enhancement 2: Database Query Optimization

**Current State:** N+1 queries, missing indexes, inefficient joins
**Target State:** Optimized queries with proper indexing and batch loading
**Impact:** 50-70% reduction in query time

### Implementation Plan

**Time Estimate:** 6-8 hours

**Step 1: Identify N+1 Query Problems** (2 hours)

Enable query logging in PostgreSQL:

```sql
-- Enable slow query logging
ALTER DATABASE veritable_games SET log_min_duration_statement = 100; -- Log queries >100ms

-- Check slow queries
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

**Common N+1 patterns to fix:**

```typescript
// BAD: N+1 query (fetches tags for each document separately)
const documents = await getDocuments();
for (const doc of documents) {
  doc.tags = await getTags(doc.id); // N queries!
}

// GOOD: Join query (fetches all tags in one query)
const documents = await query(`
  SELECT
    d.*,
    json_agg(json_build_object(
      'id', t.id,
      'name', t.name
    )) as tags
  FROM anarchist.documents d
  LEFT JOIN anarchist.document_tags dt ON d.id = dt.document_id
  LEFT JOIN shared.tags t ON dt.tag_id = t.id
  GROUP BY d.id
`);
```

**Step 2: Optimize Common Queries** (2-3 hours)

**Query 1: Document List with Tags**
```typescript
// Before: 2 queries (documents + tags)
const docs = await getDocuments();
const tags = await getTagsForDocuments(docs.map(d => d.id));

// After: 1 query with join
export async function getDocumentsWithTags(params: GetAnarchistDocumentsParams) {
  const sql = `
    SELECT
      d.id,
      d.title,
      d.slug,
      d.authors,
      d.year,
      d.language,
      d.category,
      d.preview_text,
      json_agg(
        DISTINCT jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'normalized_name', t.normalized_name
        )
      ) FILTER (WHERE t.id IS NOT NULL) as tags
    FROM anarchist.documents d
    LEFT JOIN anarchist.document_tags dt ON d.id = dt.document_id
    LEFT JOIN shared.tags t ON dt.tag_id = t.id
    WHERE ${buildWhereClause(params)}
    GROUP BY d.id
    ORDER BY ${buildOrderBy(params)}
    LIMIT ${params.limit} OFFSET ${params.offset}
  `;

  return query(sql);
}
```

**Query 2: Search with Full-Text**
```sql
-- Before: LIKE queries (slow, no index use)
SELECT * FROM anarchist.documents
WHERE title LIKE '%anarchism%' OR authors LIKE '%anarchism%';

-- After: Full-text search (fast, indexed)
SELECT * FROM anarchist.documents
WHERE
  to_tsvector('english', title || ' ' || coalesce(authors, ''))
  @@ to_tsquery('english', 'anarchism')
ORDER BY
  ts_rank(
    to_tsvector('english', title || ' ' || coalesce(authors, '')),
    to_tsquery('english', 'anarchism')
  ) DESC;

-- With index:
CREATE INDEX idx_anarchist_docs_search_fts ON anarchist.documents
USING gin(to_tsvector('english', title || ' ' || coalesce(authors, '')));
```

**Step 3: Implement Connection Pooling** (1 hour)

```typescript
// /frontend/src/lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Monitor pool health
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export async function query(sql: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(sql, params);
  const duration = Date.now() - start;

  // Log slow queries
  if (duration > 100) {
    console.warn('Slow query detected:', {
      sql: sql.substring(0, 100),
      duration,
      rows: result.rowCount
    });
  }

  return result;
}

// Health check
export async function checkDatabaseHealth() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return { healthy: true, poolSize: pool.totalCount, idle: pool.idleCount };
  } finally {
    client.release();
  }
}
```

**Step 4: Add Query Performance Monitoring** (1-2 hours)

```typescript
// /frontend/src/lib/query-monitor.ts
interface QueryStats {
  query: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
}

class QueryMonitor {
  private stats = new Map<string, QueryStats>();

  recordQuery(query: string, duration: number) {
    const key = query.substring(0, 100); // Use first 100 chars as key

    const existing = this.stats.get(key) || {
      query: key,
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0
    };

    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    existing.maxTime = Math.max(existing.maxTime, duration);

    this.stats.set(key, existing);
  }

  getSlowQueries(threshold: number = 100): QueryStats[] {
    return Array.from(this.stats.values())
      .filter(s => s.avgTime > threshold)
      .sort((a, b) => b.avgTime - a.avgTime);
  }

  reset() {
    this.stats.clear();
  }
}

export const queryMonitor = new QueryMonitor();
```

---

## Enhancement 3: Frontend Performance

**Current State:** Large bundle size, no code splitting, blocking resources
**Target State:** Optimized bundles, lazy loading, improved Core Web Vitals
**Impact:** 30-50% improvement in page load time

### Implementation Plan

**Time Estimate:** 5-7 hours

**Step 1: Bundle Analysis** (1 hour)

```bash
# Analyze bundle size
npm run build
npx @next/bundle-analyzer

# Look for:
# - Large dependencies (>100KB)
# - Duplicate dependencies
# - Unused code
```

**Step 2: Implement Code Splitting** (2 hours)

```typescript
// Before: Import everything upfront
import { AnarchistLibrary } from '@/components/AnarchistLibrary';
import { LibraryView } from '@/components/LibraryView';

// After: Dynamic imports
const AnarchistLibrary = dynamic(() => import('@/components/AnarchistLibrary'), {
  loading: () => <Skeleton />,
  ssr: false // Client-side only if needed
});

const LibraryView = dynamic(() => import('@/components/LibraryView'));
```

**Step 3: Optimize Images** (1 hour)

```typescript
// Use Next.js Image component
import Image from 'next/image';

// Before: Regular img tag
<img src="/cover.jpg" alt="Book cover" />

// After: Optimized Image
<Image
  src="/cover.jpg"
  alt="Book cover"
  width={300}
  height={400}
  loading="lazy"
  placeholder="blur"
  blurDataURL={blurData}
/>
```

**Step 4: Implement Virtual Scrolling Optimization** (1-2 hours)

Already using react-virtuoso, but optimize configuration:

```typescript
// /frontend/src/components/DocumentList.tsx
<Virtuoso
  data={documents}
  overscan={200} // Render 200px beyond viewport
  increaseViewportBy={400} // Preload buffer
  itemContent={(index, doc) => <DocumentCard document={doc} />}
  components={{
    Footer: () => isLoading ? <LoadingSpinner /> : null,
    EmptyPlaceholder: () => <EmptyState />
  }}
/>
```

**Step 5: Add Resource Hints** (30 minutes)

```typescript
// /frontend/src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preconnect to API */}
        <link rel="preconnect" href="https://www.veritablegames.com" />
        <link rel="dns-prefetch" href="https://www.veritablegames.com" />

        {/* Preload critical resources */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Step 6: Measure Core Web Vitals** (30 minutes)

```typescript
// /frontend/src/lib/analytics.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);
  onFCP(console.log);
  onTTFB(console.log);

  // Send to analytics service
  onLCP((metric) => {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify(metric)
    });
  });
}
```

---

## Enhancement 4: Pagination Optimization

**Current State:** Offset-based pagination (slow for large offsets)
**Target State:** Cursor-based pagination for better performance
**Impact:** Consistent query time regardless of page number

### Implementation Plan

**Time Estimate:** 4-6 hours

**Step 1: Implement Cursor Pagination** (2-3 hours)

```typescript
// /frontend/src/lib/anarchist/service.ts
export interface CursorPaginationParams {
  cursor?: string; // Base64 encoded: {id:123,sort_value:'2024-01-01'}
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export async function getDocumentsCursor(params: CursorPaginationParams) {
  const { cursor, limit = 20, sort_by = 'id', sort_order = 'desc' } = params;

  let whereClauses: string[] = [];
  let queryParams: any[] = [];

  // Decode cursor
  if (cursor) {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());

    if (sort_order === 'desc') {
      whereClauses.push(`(${sort_by}, id) < ($1, $2)`);
    } else {
      whereClauses.push(`(${sort_by}, id) > ($1, $2)`);
    }

    queryParams.push(decoded.sort_value, decoded.id);
  }

  const sql = `
    SELECT *
    FROM anarchist.documents
    ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
    ORDER BY ${sort_by} ${sort_order}, id ${sort_order}
    LIMIT ${limit + 1}
  `;

  const result = await query(sql, queryParams);
  const hasMore = result.rows.length > limit;
  const documents = hasMore ? result.rows.slice(0, -1) : result.rows;

  // Generate next cursor
  let nextCursor = null;
  if (hasMore) {
    const lastDoc = documents[documents.length - 1];
    nextCursor = Buffer.from(JSON.stringify({
      id: lastDoc.id,
      sort_value: lastDoc[sort_by]
    })).toString('base64');
  }

  return {
    documents,
    nextCursor,
    hasMore
  };
}
```

**Step 2: Update Frontend Components** (1-2 hours)

```typescript
// Frontend infinite scroll with cursor
function DocumentList() {
  const [documents, setDocuments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    const response = await fetch(`/api/anarchist/documents?cursor=${cursor}&limit=20`);
    const data = await response.json();

    setDocuments(prev => [...prev, ...data.documents]);
    setCursor(data.nextCursor);
    setHasMore(data.hasMore);
  };

  return (
    <Virtuoso
      data={documents}
      endReached={loadMore}
      itemContent={(index, doc) => <DocumentCard document={doc} />}
    />
  );
}
```

**Step 3: Create Compound Index for Cursor Pagination** (30 minutes)

```sql
-- Create compound index for efficient cursor pagination
CREATE INDEX idx_anarchist_docs_cursor_downloads
ON anarchist.documents(downloads DESC, id DESC);

CREATE INDEX idx_anarchist_docs_cursor_year
ON anarchist.documents(year DESC, id DESC);

CREATE INDEX idx_anarchist_docs_cursor_title
ON anarchist.documents(title ASC, id ASC);
```

**Step 4: Add Tests** (1 hour)

```typescript
describe('Cursor Pagination', () => {
  it('returns first page without cursor', async () => {
    const result = await getDocumentsCursor({ limit: 10 });

    expect(result.documents).toHaveLength(10);
    expect(result.nextCursor).toBeTruthy();
    expect(result.hasMore).toBe(true);
  });

  it('returns next page with cursor', async () => {
    const page1 = await getDocumentsCursor({ limit: 10 });
    const page2 = await getDocumentsCursor({
      cursor: page1.nextCursor,
      limit: 10
    });

    expect(page2.documents).toHaveLength(10);
    expect(page2.documents[0].id).not.toBe(page1.documents[0].id);
  });

  it('returns hasMore=false on last page', async () => {
    // Get cursor for last page
    const lastPageCursor = '...';
    const result = await getDocumentsCursor({
      cursor: lastPageCursor,
      limit: 10
    });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
```

---

## Performance Testing Plan

### Load Testing

**Tool:** k6 or Apache Bench

```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // 50 virtual users
  duration: '5m',
};

export default function () {
  // Test document list
  const res1 = http.get('https://www.veritablegames.com/api/anarchist/documents?limit=20');
  check(res1, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);

  // Test search
  const res2 = http.get('https://www.veritablegames.com/api/anarchist/documents?query=anarchism');
  check(res2, {
    'search status is 200': (r) => r.status === 200,
    'search time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### Cache Performance

```bash
# Measure cache hit rate
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses

# Calculate hit rate
# hit_rate = hits / (hits + misses) * 100
```

### Database Performance

```sql
-- Monitor query performance
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%anarchist.documents%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Monitor cache hit rate
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;
```

---

## Success Metrics

### Response Time Goals
- **Document List (uncached):** <200ms
- **Document List (cached):** <50ms
- **Search (uncached):** <500ms
- **Search (cached):** <100ms
- **Individual Document:** <100ms

### Cache Performance Goals
- **Hit Rate:** >80% after warm-up period
- **Memory Usage:** <512MB Redis
- **Eviction Rate:** <5% of requests

### Database Performance Goals
- **Connection Pool Utilization:** <70% average
- **Slow Queries (>100ms):** <1% of all queries
- **Query Cache Hit Rate:** >90%

### Frontend Performance Goals
- **LCP (Largest Contentful Paint):** <2.5s
- **FID (First Input Delay):** <100ms
- **CLS (Cumulative Layout Shift):** <0.1
- **Bundle Size:** <500KB gzipped

---

## Deployment Checklist

- [ ] Redis container deployed and tested
- [ ] Cache abstraction layer implemented
- [ ] Caching applied to all services
- [ ] Query optimization complete
- [ ] Connection pooling configured
- [ ] Code splitting implemented
- [ ] Image optimization applied
- [ ] Cursor pagination implemented
- [ ] Performance tests passing
- [ ] Monitoring dashboards created
- [ ] Documentation updated

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-17
**Author:** Claude Code (Performance Analysis)
