# Performance Monitoring

Comprehensive guide to using the performance monitoring system in Veritable Games.

## Overview

The performance monitoring system tracks:
- **Database Query Performance** - Execution time, slow queries, failures
- **API Request Latency** - Response times, slow requests, HTTP status codes
- **Cache Hit/Miss Rates** - Cache effectiveness, eviction rates
- **Memory Usage** - Heap usage, RSS, memory pressure

## Quick Start

### 1. Import the Performance Monitor

```typescript
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
```

### 2. Track Database Queries

```typescript
// Async query
const topics = await performanceMonitor.trackQuery('getAllTopics', async () => {
  return db.prepare('SELECT * FROM forum_topics').all();
});

// Sync query
const topic = performanceMonitor.trackQuerySync('getTopicById', () => {
  return db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(topicId);
});
```

### 3. Track API Requests

```typescript
export const GET = withSecurity(async (request: NextRequest) => {
  return performanceMonitor.trackRequest('GET', '/api/topics', async () => {
    const topics = await getTopics();
    return NextResponse.json({ topics });
  }, 200);
});
```

### 4. Track Cache Performance

```typescript
// Record cache hit
const cached = cache.get(key);
if (cached) {
  performanceMonitor.recordCacheHit();
  return cached;
}

// Record cache miss
performanceMonitor.recordCacheMiss();
const data = await fetchData();
cache.set(key, data);
```

## Viewing Performance Metrics

### Development Server

Access metrics at: `http://localhost:3000/api/metrics/performance`

### JSON Format (default)

```bash
curl http://localhost:3000/api/metrics/performance
```

Response:
```json
{
  "timestamp": "2025-10-08T12:00:00.000Z",
  "uptime": "3600s",
  "queries": {
    "total": 150,
    "slow": 5,
    "failed": 0,
    "averageDuration": "12.45ms",
    "slowest": [
      {
        "name": "searchTopics",
        "duration": "125.30ms",
        "timestamp": "2025-10-08T11:59:45.000Z",
        "success": true
      }
    ]
  },
  "requests": {
    "total": 75,
    "slow": 2,
    "failed": 1,
    "averageDuration": "250.15ms"
  },
  "cache": {
    "hits": 120,
    "misses": 30,
    "hitRate": "80.00%",
    "evictions": 5
  },
  "memory": {
    "heapUsed": "45.23 MB",
    "heapTotal": "60.00 MB",
    "rss": "120.50 MB",
    "heapUtilization": "75.4%"
  }
}
```

### Text Format

```bash
curl "http://localhost:3000/api/metrics/performance?format=text"
```

Response:
```
═══════════════════════════════════════════════════════════
                  PERFORMANCE REPORT
═══════════════════════════════════════════════════════════

📊 QUERIES
  Total: 150
  Slow (>100ms): 5
  Failed: 0
  Average Duration: 12.45ms

🌐 REQUESTS
  Total: 75
  Slow (>1000ms): 2
  Failed: 1
  Average Duration: 250.15ms

💾 CACHE
  Hits: 120
  Misses: 30
  Hit Rate: 80.00%
  Evictions: 5

🧠 MEMORY
  Heap Used: 45.23 MB
  Heap Total: 60.00 MB
  RSS: 120.50 MB

═══════════════════════════════════════════════════════════
```

### Reset Metrics

```bash
curl "http://localhost:3000/api/metrics/performance?reset=true"
```

## Integration Examples

### Forum Service Integration

```typescript
// src/lib/forums/topics-service.ts
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { dbPool } from '@/lib/database/pool';

export class TopicsService {
  async getAllTopics(categoryId?: string) {
    const db = dbPool.getConnection('forums');

    // Track query performance
    const topics = await performanceMonitor.trackQuery(
      `getTopics${categoryId ? ':category' : ':all'}`,
      () => {
        if (categoryId) {
          return db.prepare(`
            SELECT * FROM forum_topics
            WHERE category_id = ?
            ORDER BY is_pinned DESC, updated_at DESC
          `).all(categoryId);
        }
        return db.prepare(`
          SELECT * FROM forum_topics
          ORDER BY updated_at DESC
        `).all();
      }
    );

    return topics;
  }
}
```

### API Route Integration

```typescript
// src/app/api/forums/topics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';

export const GET = withSecurity(
  async (request: NextRequest) => {
    // Track the entire request
    return performanceMonitor.trackRequest(
      'GET',
      '/api/forums/topics',
      async () => {
        const topics = await topicsService.getAllTopics();
        return NextResponse.json({ topics });
      },
      200
    );
  },
  {
    rateLimiter: rateLimiters.search,
  }
);
```

### Cache Integration

```typescript
// src/lib/cache/cache-manager.ts
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';
import { LRUCache } from 'lru-cache';

export class CacheManager {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
      dispose: () => {
        performanceMonitor.recordCacheEviction();
      },
    });
  }

  get(key: string): any {
    const value = this.cache.get(key);

    if (value !== undefined) {
      performanceMonitor.recordCacheHit();
    } else {
      performanceMonitor.recordCacheMiss();
    }

    return value;
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }
}
```

## Performance Thresholds

### Default Thresholds

- **Slow Query**: > 100ms
- **Slow Request**: > 1000ms
- **Cache Hit Rate Target**: > 80%

### Alerts in Development

Slow queries and requests automatically log warnings in development:

```
[SLOW QUERY] searchTopics took 125.30ms
[SLOW REQUEST] GET /api/search took 1250.45ms
```

## Programmatic Access

### Get Statistics in Code

```typescript
import { performanceMonitor } from '@/lib/monitoring/performance-monitor';

// Get full statistics
const stats = performanceMonitor.getStats();

// Get formatted report
const report = performanceMonitor.getReport();
console.log(report);

// Reset metrics
performanceMonitor.reset();
```

### Custom Monitoring

```typescript
// Track custom operations
await performanceMonitor.trackQuery('customOperation', async () => {
  // Your custom logic
  return await someExpensiveOperation();
});
```

## Production Deployment

### Security Considerations

⚠️ **The metrics endpoint is disabled in production by default** for security reasons.

To enable in production (not recommended for public deployments):

```bash
# .env.production
ALLOW_METRICS=true
```

### Recommended Approach

Instead of exposing metrics publicly:

1. Use application performance monitoring (APM) tools:
   - New Relic
   - Datadog
   - Grafana + Prometheus

2. Export metrics to logs:
   ```typescript
   // In a cron job or scheduled task
   const stats = performanceMonitor.getStats();
   console.log(JSON.stringify(stats));
   ```

3. Create admin-only dashboard with authentication

## Troubleshooting

### High Memory Usage

If `memory.heapUtilization` > 90%:

1. Check for memory leaks
2. Reduce cache sizes (LRU max)
3. Clear metrics: `performanceMonitor.reset()`

### Low Cache Hit Rate

If `cache.hitRate` < 60%:

1. Review cache key strategy
2. Increase TTL (time-to-live)
3. Increase cache size
4. Check cache evictions

### Slow Queries

If many queries > 100ms:

1. Run `EXPLAIN QUERY PLAN` on slow queries
2. Add missing indexes (see `scripts/add-forum-indexes.js`)
3. Optimize query logic
4. Consider pagination for large result sets

## Best Practices

1. **Always track database queries** in services:
   ```typescript
   // ✅ Good
   const data = await performanceMonitor.trackQuery('getName', () => db.query());

   // ❌ Bad (no tracking)
   const data = db.query();
   ```

2. **Track API endpoints** for latency monitoring:
   ```typescript
   export const GET = withSecurity(async (req) => {
     return performanceMonitor.trackRequest('GET', '/api/data', async () => {
       // handler logic
     });
   });
   ```

3. **Monitor cache effectiveness**:
   ```typescript
   const cached = cache.get(key);
   if (cached) {
     performanceMonitor.recordCacheHit();
     return cached;
   }
   performanceMonitor.recordCacheMiss();
   ```

4. **Review metrics regularly**:
   - Check `/api/metrics/performance` daily in development
   - Monitor slow queries and fix with indexes
   - Optimize cache strategies based on hit rates

5. **Reset metrics periodically**:
   ```typescript
   // Reset daily or weekly to prevent unbounded growth
   performanceMonitor.reset();
   ```

## API Reference

### Methods

- `trackQuery<T>(name: string, queryFn: () => T): Promise<T>`
- `trackQuerySync<T>(name: string, queryFn: () => T): T`
- `trackRequest<T>(method: string, path: string, handler: () => T, statusCode?: number): Promise<T>`
- `recordCacheHit(): void`
- `recordCacheMiss(): void`
- `recordCacheEviction(): void`
- `getStats(): PerformanceStats`
- `getCacheStats(): CacheMetric`
- `reset(): void`
- `getReport(): string`

### Utility Functions

- `formatBytes(bytes: number): string` - Format bytes to human-readable
- `formatDuration(ms: number): string` - Format duration to human-readable

## Related Documentation

- [Database Architecture](./DATABASE.md)
- [Security Implementation](../CLAUDE.md#security-implementation)
- [Forum Services](./FORUMS.md)
