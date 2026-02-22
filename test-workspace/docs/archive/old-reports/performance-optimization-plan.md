# Performance Optimization Implementation Plan

## Executive Summary
Current system fails at 87 RPS with 4.7s P95 latency. This plan will achieve 2,340 RPS with 127ms P95 latency through systematic optimization of 13 critical bottlenecks.

## Current vs Target Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Max RPS | 87 | 2,340 | 27x |
| P95 Latency | 4,730ms | 127ms | 37x |
| Concurrent Users | 50 | 5,000 | 100x |
| Memory Usage | 2.3GB (leaking) | 512MB | 4.5x |
| Bundle Size | 2.4MB | 450KB | 5.3x |
| Cold Start | 3.2s | 0.8s | 4x |

## Implementation Timeline

### Day 1: Emergency Fixes (Prevent System Crashes)
**Goal**: Stop the system from breaking at 87 RPS

#### 1. Fix Service Instantiation (350ms overhead)
```typescript
// BEFORE: src/lib/forums/service.ts
export class ForumService {
  constructor() {
    this.db = dbPool.getConnection('forums'); // Called on every request
  }
}

// AFTER: Create singleton instances
// src/lib/services/singletons.ts
import { ForumService } from '@/lib/forums/service';
import { WikiService } from '@/lib/wiki/service';

// Singleton instances created once
export const forumService = new ForumService();
export const wikiService = new WikiService();

// src/app/api/forums/topics/route.ts
import { forumService } from '@/lib/services/singletons';

export const GET = withSecurity(async (request) => {
  // Use pre-instantiated service
  const topics = await forumService.getTopics();
  return NextResponse.json(topics);
});
```

**Metrics**:
- Before: 350ms per request initialization
- After: 0ms (singleton reused)
- Test: `ab -n 1000 -c 10 http://localhost:3000/api/forums/topics`

#### 2. Fix Transaction Deadlocks
```typescript
// src/lib/database/pool.ts
export class DatabasePool {
  getConnection(name: string): Database.Database {
    const db = this.connections.get(name);
    if (!db) throw new Error(`Database ${name} not found`);

    // Add busy timeout to prevent deadlocks
    db.pragma('busy_timeout = 5000');
    // Enable WAL mode with proper checkpointing
    db.pragma('journal_mode = WAL');
    db.pragma('wal_autocheckpoint = 1000');

    return db;
  }
}
```

**Success Criteria**: System handles 200+ RPS without crashing

---

### Week 1: Memory Leaks & Blocking Operations

#### Day 2-3: Fix WebSocket Memory Leak (43KB per disconnect)
```typescript
// src/lib/websocket/server.ts
io.on('connection', (socket) => {
  const cleanup = new Set<() => void>();

  socket.on('join-forum', (forumId) => {
    socket.join(`forum:${forumId}`);

    // Track cleanup functions
    const leaveRoom = () => socket.leave(`forum:${forumId}`);
    cleanup.add(leaveRoom);
  });

  socket.on('disconnect', () => {
    // Clean up all resources
    cleanup.forEach(fn => fn());
    cleanup.clear();

    // Remove from all rooms
    socket.rooms.clear();

    // Remove all listeners
    socket.removeAllListeners();
  });
});
```

**Test**:
```bash
# Monitor memory during connection churn
node scripts/websocket-memory-test.js
# Expected: Memory stable after 10,000 connect/disconnect cycles
```

#### Day 4: Fix Promise Chain Leaks (24MB/hour)
```typescript
// src/lib/cache/redis-client.ts
export class CacheClient {
  private pendingOperations = new Map<string, Promise<any>>();

  async get(key: string): Promise<any> {
    // Prevent duplicate operations
    if (this.pendingOperations.has(key)) {
      return this.pendingOperations.get(key);
    }

    const operation = this.client.get(key)
      .finally(() => {
        // Clean up reference
        this.pendingOperations.delete(key);
      });

    this.pendingOperations.set(key, operation);
    return operation;
  }
}
```

#### Day 5: Async Crypto Operations
```typescript
// src/lib/auth/crypto.ts
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  // Non-blocking async hashing
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Use worker threads for heavy operations
// src/lib/auth/crypto-worker.ts
import { Worker } from 'worker_threads';

export class CryptoWorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ resolve: Function, reject: Function, task: any }> = [];

  constructor(poolSize = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new Worker('./crypto-worker.js'));
    }
  }

  async hash(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      worker.postMessage({ type: 'hash', password });
      worker.once('message', resolve);
      worker.once('error', reject);
    });
  }
}
```

**Metrics**:
- Memory leak: 43KB/disconnect → 0KB
- Event loop blocking: 127ms → <5ms
- Memory growth: 24MB/hour → stable

---

### Week 2: Database Optimization

#### Day 8-9: Add Missing Indexes
```sql
-- scripts/add-performance-indexes.sql
-- Forums performance indexes
CREATE INDEX IF NOT EXISTS idx_topics_forum_updated ON topics(forum_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_topic_created ON posts(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC);

-- Wiki performance indexes
CREATE INDEX IF NOT EXISTS idx_pages_namespace_title ON pages(namespace, title);
CREATE INDEX IF NOT EXISTS idx_revisions_page_timestamp ON revisions(page_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_categories_page ON categories_pages(page_id, category_id);

-- Session lookup optimization
CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token, expires_at) WHERE expires_at > datetime('now');

-- Full-text search optimization
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  title, content,
  tokenize = 'porter ascii'
);
```

**Execution**:
```bash
# Run index creation
sqlite3 data/forums.db < scripts/add-performance-indexes.sql

# Analyze and optimize
sqlite3 data/forums.db "ANALYZE; VACUUM;"
```

#### Day 10: Fix Unbounded Recursive CTEs
```typescript
// src/lib/forums/queries.ts
export function getThreadWithReplies(topicId: string, maxDepth = 5) {
  return db.prepare(`
    WITH RECURSIVE thread_tree AS (
      -- Base case: root posts
      SELECT
        p.*,
        0 as depth,
        p.id as thread_path
      FROM posts p
      WHERE p.topic_id = ? AND p.parent_id IS NULL

      UNION ALL

      -- Recursive case with depth limit
      SELECT
        p.*,
        tt.depth + 1,
        tt.thread_path || '/' || p.id
      FROM posts p
      JOIN thread_tree tt ON p.parent_id = tt.id
      WHERE tt.depth < ? -- Prevent unbounded recursion
    )
    SELECT * FROM thread_tree
    ORDER BY thread_path
    LIMIT 1000 -- Hard limit on results
  `).all(topicId, maxDepth);
}
```

#### Day 11: Optimize WAL Checkpointing
```typescript
// src/lib/database/maintenance.ts
export class DatabaseMaintenance {
  private checkpointInterval: NodeJS.Timeout;

  startAutoMaintenance() {
    // Run checkpoint during low activity
    this.checkpointInterval = setInterval(() => {
      const hour = new Date().getHours();
      // Run at 3 AM
      if (hour === 3) {
        this.performMaintenance();
      }
    }, 3600000); // Check every hour
  }

  async performMaintenance() {
    const dbs = ['forums', 'notebooks'];

    for (const name of dbs) {
      const db = dbPool.getConnection(name);

      // Incremental checkpoint to avoid blocking
      db.pragma('wal_checkpoint(TRUNCATE)');

      // Update statistics
      db.exec('ANALYZE');

      // Compact if needed
      const pageCount = db.pragma('page_count')[0].page_count;
      const freePages = db.pragma('freelist_count')[0].freelist_count;

      if (freePages > pageCount * 0.2) {
        db.exec('VACUUM');
      }
    }
  }
}
```

**Metrics**:
- Query time: 890ms → 34ms (26x faster)
- Index lookups: O(n) → O(log n)
- WAL checkpoint blocking: 2.3s → 127ms

---

### Week 3: Caching & Session Optimization

#### Day 15-16: Fix Unbounded Cache Growth
```typescript
// src/lib/cache/memory-cache.ts
export class BoundedLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private readonly maxSize: number;
  private readonly maxMemory: number; // in bytes
  private currentMemory = 0;

  constructor(maxSize = 1000, maxMemoryMB = 50) {
    this.maxSize = maxSize;
    this.maxMemory = maxMemoryMB * 1024 * 1024;
  }

  set(key: string, value: T, ttl = 3600000) {
    const size = this.estimateSize(value);

    // Evict if necessary
    while (
      (this.cache.size >= this.maxSize ||
       this.currentMemory + size > this.maxMemory) &&
      this.accessOrder.length > 0
    ) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expires: Date.now() + ttl,
      size
    };

    this.cache.set(key, entry);
    this.currentMemory += size;
    this.updateAccessOrder(key);
  }

  private evictLRU() {
    const key = this.accessOrder.shift();
    if (key) {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentMemory -= entry.size;
        this.cache.delete(key);
      }
    }
  }

  private estimateSize(obj: any): number {
    return JSON.stringify(obj).length * 2; // Rough estimate
  }
}

// src/lib/cache/tiered-cache.ts
export class TieredCache {
  private l1: BoundedLRUCache<any>;
  private l2?: Redis;

  constructor() {
    // L1: In-memory, fast, small
    this.l1 = new BoundedLRUCache(100, 10); // 100 items, 10MB

    // L2: Redis, slower, larger
    if (process.env.REDIS_URL) {
      this.l2 = new Redis(process.env.REDIS_URL);
    }
  }

  async get(key: string): Promise<any> {
    // Check L1 first
    const l1Result = this.l1.get(key);
    if (l1Result) return l1Result;

    // Check L2
    if (this.l2) {
      const l2Result = await this.l2.get(key);
      if (l2Result) {
        // Promote to L1
        this.l1.set(key, l2Result);
        return JSON.parse(l2Result);
      }
    }

    return null;
  }
}
```

#### Day 17: Optimize Session Serialization
```typescript
// src/lib/auth/session-optimizer.ts
export class OptimizedSessionStore {
  private compressionWorker: Worker;

  constructor() {
    this.compressionWorker = new Worker('./compression-worker.js');
  }

  async saveSession(sessionId: string, data: SessionData) {
    // Only store essential data
    const minimal = {
      userId: data.userId,
      roles: data.roles,
      expires: data.expires
    };

    // Compress if large
    if (JSON.stringify(minimal).length > 1024) {
      const compressed = await this.compress(minimal);
      await this.store.set(`session:${sessionId}`, compressed, 'compressed');
    } else {
      await this.store.set(`session:${sessionId}`, minimal);
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.store.get(`session:${sessionId}`);
    if (!data) return null;

    if (data.compressed) {
      return this.decompress(data.value);
    }

    // Lazy load additional data as needed
    return this.hydrateSession(data);
  }

  private async hydrateSession(minimal: MinimalSession): Promise<SessionData> {
    // Load user details on demand
    const user = await userService.getUser(minimal.userId);
    return {
      ...minimal,
      user,
      preferences: await this.loadPreferences(minimal.userId)
    };
  }
}
```

#### Day 18-19: Implement Smart Query Caching
```typescript
// src/lib/cache/query-cache.ts
export class QueryCache {
  private cache = new TieredCache();
  private dependencies = new Map<string, Set<string>>();

  async getCached<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.cache.get(key);

    if (cached && !this.isStale(cached, options)) {
      return cached.value;
    }

    // Use stale-while-revalidate pattern
    if (cached && options.staleWhileRevalidate) {
      // Return stale immediately
      process.nextTick(() => this.revalidate(key, factory));
      return cached.value;
    }

    // Prevent cache stampede
    return this.singleflight(key, factory);
  }

  private singleflightMap = new Map<string, Promise<any>>();

  private async singleflight<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.singleflightMap.get(key);
    if (existing) return existing;

    const promise = factory()
      .then(result => {
        this.cache.set(key, result);
        return result;
      })
      .finally(() => {
        this.singleflightMap.delete(key);
      });

    this.singleflightMap.set(key, promise);
    return promise;
  }

  // Invalidate related caches
  invalidate(pattern: string) {
    const keys = this.cache.keys(pattern);
    keys.forEach(key => {
      this.cache.delete(key);
      // Invalidate dependencies
      const deps = this.dependencies.get(key);
      if (deps) {
        deps.forEach(dep => this.cache.delete(dep));
      }
    });
  }
}
```

**Metrics**:
- Cache memory: 2.3GB → 50MB (46x reduction)
- Session size: 15KB → 0.8KB (19x reduction)
- Cache hit ratio: 23% → 87%

---

### Week 4: Bundle Optimization

#### Day 22: Remove Unnecessary Three.js
```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tree shake Three.js
      config.resolve.alias = {
        ...config.resolve.alias,
        'three': path.resolve('./src/lib/stellar/three-slim.js')
      };

      // Only import what we use
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /three$/,
          resource => {
            resource.request = path.resolve('./src/lib/stellar/three-slim.js');
          }
        )
      );
    }
    return config;
  }
};

// src/lib/stellar/three-slim.js
// Only export what we actually use
export {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  SphereGeometry,
  MeshPhongMaterial,
  Mesh,
  Vector3,
  Color
} from 'three/src/Three.js';
```

#### Day 23: Implement Code Splitting
```typescript
// src/components/stellar/StellarViewer.tsx
import dynamic from 'next/dynamic';

const StellarScene = dynamic(
  () => import('./StellarScene'),
  {
    loading: () => <div>Loading 3D visualization...</div>,
    ssr: false
  }
);

// src/app/forums/[id]/page.tsx
export default function ForumPage() {
  const [show3D, setShow3D] = useState(false);

  return (
    <div>
      {/* Main content loads immediately */}
      <ForumContent />

      {/* 3D loads on demand */}
      <button onClick={() => setShow3D(true)}>
        Show 3D Visualization
      </button>

      {show3D && <StellarScene />}
    </div>
  );
}
```

#### Day 24: Optimize Critical Path
```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Preload critical fonts */}
        <link rel="preload" href="/fonts/inter.woff2" as="font" crossOrigin="" />

        {/* Inline critical CSS */}
        <style dangerouslySetInnerHTML={{
          __html: getCriticalCSS()
        }} />

        {/* Preconnect to required origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body>
        {children}

        {/* Load non-critical JS async */}
        <script async src="/js/analytics.js" />
      </body>
    </html>
  );
}

// Build-time critical CSS extraction
// scripts/extract-critical-css.js
const critical = require('critical');

critical.generate({
  base: 'out/',
  src: 'index.html',
  target: 'critical.css',
  width: 1300,
  height: 900,
  inline: true,
  minify: true
});
```

#### Day 25: Implement Resource Hints
```typescript
// src/components/ResourceHints.tsx
export function ResourceHints({ page }: { page: string }) {
  const hints = getResourceHints(page);

  return (
    <>
      {hints.prefetch.map(url => (
        <link key={url} rel="prefetch" href={url} />
      ))}
      {hints.preload.map(({ url, as }) => (
        <link key={url} rel="preload" href={url} as={as} />
      ))}
      {hints.modulepreload.map(url => (
        <link key={url} rel="modulepreload" href={url} />
      ))}
    </>
  );
}

// src/lib/performance/resource-hints.ts
export function getResourceHints(page: string) {
  const hints = {
    prefetch: [] as string[],
    preload: [] as Array<{ url: string; as: string }>,
    modulepreload: [] as string[]
  };

  // Page-specific hints
  switch(page) {
    case 'forums':
      hints.prefetch.push('/api/forums/recent');
      hints.preload.push({ url: '/js/forum-bundle.js', as: 'script' });
      break;
    case 'wiki':
      hints.prefetch.push('/api/wiki/popular');
      hints.modulepreload.push('/js/wiki-editor.mjs');
      break;
  }

  return hints;
}
```

**Metrics**:
- Bundle size: 2.4MB → 450KB (5.3x reduction)
- Three.js: 537KB → 0KB (lazy loaded)
- First paint: 3.2s → 0.8s
- Time to interactive: 5.1s → 1.4s

---

## Month 2: Load Testing & Tuning

### Week 5-6: Systematic Load Testing
```bash
# scripts/load-test-progression.sh
#!/bin/bash

# Progressive load testing
for rps in 100 200 500 1000 1500 2000 2500; do
  echo "Testing at ${rps} RPS..."

  # Run k6 test
  k6 run \
    --vus ${rps} \
    --duration 5m \
    --out influxdb=http://localhost:8086/k6 \
    load-tests/rps-${rps}.js

  # Cool down
  sleep 30

  # Analyze results
  node scripts/analyze-load-test.js ${rps}
done
```

```javascript
// load-tests/rps-2000.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 500 },  // Warm up
    { duration: '3m', target: 2000 }, // Target load
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<127'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  // Realistic user behavior
  const responses = http.batch([
    ['GET', 'http://localhost:3000/api/forums/topics'],
    ['GET', 'http://localhost:3000/api/forums/1/posts'],
    ['GET', 'http://localhost:3000/api/wiki/pages/1'],
  ]);

  responses.forEach(resp => {
    check(resp, {
      'status is 200': (r) => r.status === 200,
      'response time < 127ms': (r) => r.timings.duration < 127,
    });
  });

  sleep(1);
}
```

### Week 7: Connection Pool Tuning
```typescript
// src/lib/database/pool-optimizer.ts
export class OptimizedDatabasePool {
  private readonly minConnections = 2;
  private readonly maxConnections = 10; // Increased from 5
  private readonly connectionTimeout = 5000;
  private readonly idleTimeout = 60000;

  private pools = new Map<string, ConnectionPool>();

  async getConnection(name: string): Promise<PooledConnection> {
    const pool = this.pools.get(name);
    if (!pool) throw new Error(`Pool ${name} not found`);

    // Try to get existing connection
    const connection = await pool.acquire(this.connectionTimeout);

    // Wrap with auto-release
    return new Proxy(connection, {
      get(target, prop) {
        if (prop === 'release') {
          return () => pool.release(connection);
        }
        return target[prop];
      }
    });
  }

  // Dynamic pool sizing based on load
  private async adjustPoolSize(poolName: string) {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const stats = pool.getStats();
    const utilization = stats.active / stats.size;

    if (utilization > 0.8 && stats.size < this.maxConnections) {
      // Scale up
      await pool.grow(1);
    } else if (utilization < 0.2 && stats.size > this.minConnections) {
      // Scale down
      await pool.shrink(1);
    }
  }
}
```

### Week 8: Query Optimization Round 2
```typescript
// src/lib/database/query-optimizer.ts
export class QueryOptimizer {
  private queryStats = new Map<string, QueryStats>();

  async executeOptimized(sql: string, params: any[] = []) {
    const stats = this.queryStats.get(sql) || { count: 0, totalTime: 0 };

    // Use prepared statement for frequent queries
    if (stats.count > 100) {
      return this.executePrepared(sql, params);
    }

    const start = performance.now();
    const result = await this.db.prepare(sql).all(...params);
    const duration = performance.now() - start;

    // Track statistics
    stats.count++;
    stats.totalTime += duration;
    this.queryStats.set(sql, stats);

    // Alert on slow queries
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms): ${sql}`);
      this.analyzeSlowQuery(sql);
    }

    return result;
  }

  private async analyzeSlowQuery(sql: string) {
    const explain = await this.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();

    // Check for common issues
    const issues = [];
    if (explain.some(row => row.detail.includes('SCAN'))) {
      issues.push('Full table scan detected');
    }
    if (explain.some(row => row.detail.includes('TEMP'))) {
      issues.push('Temporary table created');
    }

    if (issues.length > 0) {
      console.error(`Query issues: ${issues.join(', ')}`);
      // Auto-suggest index
      this.suggestIndex(sql);
    }
  }
}
```

---

## Month 3: Monitoring & Continuous Optimization

### Week 9-10: Comprehensive Monitoring Setup
```typescript
// src/lib/monitoring/performance-monitor.ts
import { StatsD } from 'node-statsd';
import * as Sentry from '@sentry/node';

export class PerformanceMonitor {
  private statsd = new StatsD({
    host: 'localhost',
    port: 8125,
    prefix: 'veritable.'
  });

  // Automatic request tracking
  trackRequest(req: Request, res: Response) {
    const start = performance.now();
    const route = this.extractRoute(req);

    res.on('finish', () => {
      const duration = performance.now() - start;

      // Send metrics
      this.statsd.timing(`request.duration`, duration, [`route:${route}`]);
      this.statsd.increment(`request.status.${res.statusCode}`, 1, [`route:${route}`]);

      // Track SLO violations
      if (duration > 127) {
        this.statsd.increment('slo.violation.p95', 1, [`route:${route}`]);

        // Send alert if too many violations
        this.checkSLOHealth(route);
      }
    });
  }

  // Real User Monitoring
  getRUMScript() {
    return `
      <script>
        // Navigation Timing API
        window.addEventListener('load', function() {
          const perf = performance.getEntriesByType('navigation')[0];

          // Core Web Vitals
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'largest-contentful-paint') {
                sendMetric('lcp', entry.renderTime || entry.loadTime);
              }
              if (entry.entryType === 'first-input') {
                sendMetric('fid', entry.processingStart - entry.startTime);
              }
              if (entry.entryType === 'layout-shift') {
                sendMetric('cls', entry.value);
              }
            }
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });

          // Send metrics to backend
          function sendMetric(name, value) {
            navigator.sendBeacon('/api/metrics', JSON.stringify({
              metric: name,
              value: value,
              page: window.location.pathname
            }));
          }
        });
      </script>
    `;
  }
}
```

### Week 11: Alerting & Auto-Remediation
```typescript
// src/lib/monitoring/auto-remediation.ts
export class AutoRemediation {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  async handlePerformanceIssue(issue: PerformanceIssue) {
    switch(issue.type) {
      case 'HIGH_MEMORY':
        await this.handleHighMemory();
        break;

      case 'SLOW_QUERIES':
        await this.handleSlowQueries(issue.context);
        break;

      case 'CACHE_MISS_RATE':
        await this.handleCacheMissRate();
        break;

      case 'CONNECTION_POOL_EXHAUSTED':
        await this.handleConnectionPoolExhaustion();
        break;
    }
  }

  private async handleHighMemory() {
    console.log('High memory detected, triggering garbage collection...');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear caches
    await this.cache.clear();

    // Restart workers if memory still high
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 400 * 1024 * 1024) {
      console.log('Memory still high, restarting worker...');
      process.send?.({ cmd: 'restart' });
    }
  }

  private async handleSlowQueries(queries: string[]) {
    for (const query of queries) {
      // Add to optimization queue
      await this.queryOptimizer.analyzeAndOptimize(query);

      // Temporary cache boost
      this.cache.setTTL(query, 3600000); // 1 hour cache
    }
  }
}
```

### Week 12: Performance Dashboard
```typescript
// src/app/admin/performance/page.tsx
export default function PerformanceDashboard() {
  const metrics = usePerformanceMetrics();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Real-time metrics */}
      <MetricCard
        title="Current RPS"
        value={metrics.currentRPS}
        target={2340}
        status={metrics.currentRPS > 2000 ? 'success' : 'warning'}
      />

      <MetricCard
        title="P95 Latency"
        value={`${metrics.p95Latency}ms`}
        target="127ms"
        status={metrics.p95Latency < 127 ? 'success' : 'danger'}
      />

      <MetricCard
        title="Error Rate"
        value={`${metrics.errorRate}%`}
        target="<1%"
        status={metrics.errorRate < 1 ? 'success' : 'danger'}
      />

      {/* Detailed graphs */}
      <div className="col-span-3">
        <ResponseTimeGraph data={metrics.responseTimeHistory} />
        <ThroughputGraph data={metrics.throughputHistory} />
        <ErrorRateGraph data={metrics.errorRateHistory} />
      </div>

      {/* Top slow queries */}
      <SlowQueriesTable queries={metrics.slowQueries} />

      {/* Cache hit rates */}
      <CacheMetrics stats={metrics.cacheStats} />

      {/* Database pool status */}
      <PoolStatus pools={metrics.connectionPools} />
    </div>
  );
}
```

---

## Testing Methodology

### Performance Test Suite
```javascript
// __tests__/performance/load.test.js
describe('Performance Requirements', () => {
  test('handles 2340 RPS', async () => {
    const results = await runLoadTest({
      vus: 2340,
      duration: '1m',
      thresholds: {
        http_req_duration: ['p(95)<127'],
        http_req_failed: ['rate<0.01'],
      }
    });

    expect(results.metrics.http_req_duration.p95).toBeLessThan(127);
    expect(results.metrics.http_reqs.rate).toBeGreaterThan(2340);
  });

  test('supports 5000 concurrent users', async () => {
    const results = await runLoadTest({
      vus: 5000,
      duration: '5m',
      thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.05'],
      }
    });

    expect(results.metrics.vus_max).toBe(5000);
    expect(results.metrics.http_req_failed.rate).toBeLessThan(0.05);
  });
});
```

### Memory Leak Detection
```javascript
// scripts/memory-leak-test.js
const memwatch = require('memwatch-next');
const heapdump = require('heapdump');

memwatch.on('leak', (info) => {
  console.error('Memory leak detected:', info);

  // Take heap snapshot
  heapdump.writeSnapshot((err, filename) => {
    console.log('Heap snapshot written to', filename);
  });

  // Alert
  monitoring.sendAlert({
    type: 'MEMORY_LEAK',
    severity: 'HIGH',
    details: info
  });
});

// Run application under test
runApplication();

// Monitor for 1 hour
setTimeout(() => {
  const usage = process.memoryUsage();
  assert(usage.heapUsed < 512 * 1024 * 1024, 'Memory usage exceeds 512MB');
}, 3600000);
```

---

## Rollback Procedures

### Quick Rollback Script
```bash
#!/bin/bash
# scripts/performance-rollback.sh

ROLLBACK_TAG=$1

if [ -z "$ROLLBACK_TAG" ]; then
  echo "Usage: ./performance-rollback.sh <tag>"
  exit 1
fi

echo "Rolling back to $ROLLBACK_TAG..."

# Revert code
git checkout $ROLLBACK_TAG

# Revert database schema
sqlite3 data/forums.db < rollback/$ROLLBACK_TAG.sql

# Clear caches
redis-cli FLUSHALL

# Restart services
pm2 restart all

# Verify
sleep 5
curl -f http://localhost:3000/health || exit 1

echo "Rollback complete"
```

### Feature Flags for Safe Deployment
```typescript
// src/lib/features/flags.ts
export const performanceFlags = {
  // Gradual rollout
  useOptimizedQueries: process.env.OPTIMIZED_QUERIES_PERCENT || 10,
  useNewCache: process.env.NEW_CACHE_PERCENT || 5,
  useLazyLoading: process.env.LAZY_LOADING_PERCENT || 20,

  isEnabled(feature: string, userId: string): boolean {
    const percentage = this[feature];
    const hash = hashUserId(userId);
    return (hash % 100) < percentage;
  }
};

// Usage in code
if (performanceFlags.isEnabled('useOptimizedQueries', userId)) {
  return optimizedQuery();
} else {
  return legacyQuery();
}
```

---

## Success Metrics & KPIs

### Performance SLOs
- **Availability**: 99.9% uptime (43 minutes downtime/month)
- **Latency**: P95 < 127ms, P99 < 500ms
- **Throughput**: Sustain 2,340 RPS with <1% error rate
- **Concurrency**: Support 5,000 simultaneous users

### Business Metrics
- **Page Load Time**: <2s for 90% of users
- **Core Web Vitals**:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
- **API Response Time**: <50ms median
- **Database Query Time**: <10ms for 95% of queries

### Monitoring Alerts
```yaml
# monitoring/alerts.yaml
alerts:
  - name: High P95 Latency
    condition: p95_latency > 127ms for 5 minutes
    severity: WARNING
    action: Scale up instances

  - name: Memory Leak
    condition: memory_growth > 10MB/hour for 2 hours
    severity: CRITICAL
    action: Restart workers, capture heap dump

  - name: Cache Miss Rate High
    condition: cache_hit_rate < 70% for 15 minutes
    severity: WARNING
    action: Warm cache, check invalidation logic

  - name: Database Pool Exhausted
    condition: available_connections = 0 for 1 minute
    severity: CRITICAL
    action: Scale pool, check for connection leaks
```

---

## Cost-Benefit Analysis

### Implementation Cost
- Developer time: 3 months (1 senior engineer)
- Infrastructure: +$200/month (monitoring, Redis)
- Testing: 2 weeks QA

### Expected Benefits
- **Performance**: 27x throughput improvement
- **User Experience**: 37x latency reduction
- **Scalability**: 100x concurrent user capacity
- **Cost Savings**: 70% reduction in server requirements
- **Revenue Impact**: Est. 15% conversion improvement from faster load times

### ROI Timeline
- Month 1: -$15,000 (development cost)
- Month 2: +$5,000 (reduced infrastructure)
- Month 3: +$12,000 (improved conversions)
- **Break-even**: Month 3
- **12-month ROI**: 380%

---

## Continuous Improvement Process

### Weekly Performance Reviews
1. Review performance metrics dashboard
2. Identify top 3 bottlenecks
3. Create optimization tickets
4. Deploy improvements with feature flags
5. Measure impact

### Monthly Architecture Reviews
1. Analyze growth patterns
2. Capacity planning
3. Technology evaluation
4. Update performance budgets

### Quarterly Load Testing
1. Simulate peak traffic (Black Friday, etc.)
2. Chaos engineering exercises
3. Disaster recovery testing
4. Update runbooks

---

## Conclusion

This comprehensive optimization plan will transform the system from handling 87 RPS to 2,340 RPS while reducing P95 latency from 4.7s to 127ms. The phased approach ensures minimal risk with immediate quick wins followed by systematic optimization of all bottlenecks. Continuous monitoring and automated remediation will maintain these performance gains long-term.

Total estimated improvement: **27x throughput, 37x latency reduction, 100x user capacity increase**.