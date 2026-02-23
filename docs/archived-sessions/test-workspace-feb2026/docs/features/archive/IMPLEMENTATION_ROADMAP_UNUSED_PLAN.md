# Forums Backend Rebuild Roadmap

**Project:** Veritable Games Forums System Backend Refactor
**Version:** 0.37 → 1.0
**Created:** October 8, 2025
**Estimated Duration:** 12-16 days

---

## Table of Contents

1. [Phase 0: Preparation](#phase-0-preparation-1-2-days)
2. [Phase 1: Foundation](#phase-1-foundation-3-5-days)
3. [Phase 2: API Layer](#phase-2-api-layer-2-3-days)
4. [Phase 3: Migration](#phase-3-migration-2-3-days)
5. [Phase 4: Cutover](#phase-4-cutover-1-day)
6. [Testing Strategy](#testing-strategy)
7. [Development Workflow](#development-workflow)
8. [Migration Details](#migration-details)
9. [Rollback Plan](#rollback-plan)
10. [Success Criteria](#success-criteria)

---

## Overview

This roadmap outlines a **zero-downtime migration** from the current forums backend to a refactored architecture with:
- **Result pattern** for error handling (eliminating exceptions in service layer)
- **Performance monitoring** with metrics collection
- **Comprehensive test coverage** across all layers
- **Database indexes** on foreign keys and search columns
- **Rate limiting & CSRF protection** for all API endpoints
- **Cache warming** to eliminate cold start penalty

The strategy focuses on **parallel development** with feature flags, allowing the old system to remain operational while the new backend is built and tested alongside it.

**Note**: This roadmap describes a full rebuild approach. The project's current implementation uses an incremental improvement strategy instead.

---

## Phase 0: Preparation (1-2 days)

### Goals
- Finalize technical specifications
- Set up isolated development environment
- Create comprehensive test fixtures
- Document migration strategy

### Tasks

#### Day 1: API Contract & Schema Design
- [ ] **Finalize API contract** (0.5 days)
  - Document all 11 existing endpoints with request/response schemas
  - Define breaking vs non-breaking changes
  - Version API routes (`/api/forums-v2/` for new backend)
  - Create OpenAPI/Swagger specification
  - **Files to create:**
    - `/docs/api/FORUMS_API_CONTRACT_V2.md` - Complete API specification
    - `/frontend/src/lib/forums/api-contract.ts` - TypeScript contract types

- [ ] **Schema design review** (0.5 days)
  - Analyze current schema (forums.db: 924KB, needs cleanup)
  - Identify missing indexes (category_id, author_id, topic_id, status, is_pinned)
  - Design denormalized fields for performance (last_reply_user, topic_participant_count)
  - Plan FTS5 optimization (currently 115 rows indexed)
  - **Files to create:**
    - `/docs/database/FORUMS_SCHEMA_V2.sql` - New schema with indexes
    - `/docs/database/SCHEMA_MIGRATION_PLAN.md` - Migration steps

#### Day 2: Test Infrastructure
- [ ] **Set up test database** (0.25 days)
  - Create `forums-test.db` in `/frontend/data/test/`
  - Initialize with schema-v2.sql
  - Configure separate connection pool for tests
  - **Files to modify:**
    - `/frontend/src/lib/database/pool.ts` - Add test environment detection

- [ ] **Create test fixtures** (0.5 days)
  - Generate realistic test data (100 topics, 500 replies, 10 users, 6 categories)
  - Include edge cases (deep nesting, locked topics, deleted replies, orphaned data)
  - Create fixture loader utility
  - **Files to create:**
    - `/frontend/__tests__/fixtures/forums/topics.json` - Topic fixtures
    - `/frontend/__tests__/fixtures/forums/replies.json` - Reply fixtures
    - `/frontend/__tests__/fixtures/forums/users.json` - User fixtures
    - `/frontend/scripts/testing/load-forum-fixtures.ts` - Fixture loader

- [ ] **Document migration strategy** (0.25 days)
  - Data migration approach (incremental vs full copy)
  - Validation checkpoints (row counts, foreign key integrity, FTS5 index sync)
  - Rollback procedures (database restore, feature flag toggle)
  - **Files to create:**
    - `/docs/MIGRATION_STRATEGY.md` - Complete migration documentation

### Deliverables
✅ API contract v2 specification
✅ New database schema with performance indexes
✅ Test database with realistic fixtures
✅ Migration strategy document

---

## Phase 1: Foundation (3-5 days)

### Goals
- Build new database schema with indexes
- Implement repository layer with Result pattern
- Create comprehensive test suite
- Build service layer with monitoring

### Tasks

#### Day 3-4: Repository Layer (2 days)
- [ ] **Create new schema in test DB** (0.5 days)
  - Execute schema-v2.sql on forums-test.db
  - Add missing indexes:
    ```sql
    CREATE INDEX idx_topics_category_id ON forum_topics(category_id);
    CREATE INDEX idx_topics_author_id ON forum_topics(user_id);
    CREATE INDEX idx_topics_status ON forum_topics(status, is_pinned);
    CREATE INDEX idx_replies_topic_id ON forum_replies(topic_id);
    CREATE INDEX idx_replies_author_id ON forum_replies(user_id);
    CREATE INDEX idx_replies_parent_id ON forum_replies(parent_id);
    ```
  - Verify foreign key constraints enabled
  - **Files to create:**
    - `/frontend/scripts/forums/create-schema-v2.ts` - Schema creation script

- [ ] **Build repository layer** (1 day)
  - Implement Result pattern (Ok/Err) for all database operations
  - Use prepared statements exclusively (SQL injection prevention)
  - Batch operations for N+1 query prevention
  - Transaction support for multi-step operations
  - **Files to create:**
    - `/frontend/src/lib/forums-v2/repositories/topic-repository.ts`
    - `/frontend/src/lib/forums-v2/repositories/reply-repository.ts`
    - `/frontend/src/lib/forums-v2/repositories/category-repository.ts`
    - `/frontend/src/lib/forums-v2/repositories/tag-repository.ts`
    - `/frontend/src/lib/forums-v2/repositories/search-repository.ts`
    - `/frontend/src/lib/forums-v2/repositories/types.ts` - Repository interfaces
    - `/frontend/src/lib/forums-v2/repositories/index.ts` - Barrel export

- [ ] **Write repository tests** (0.5 days)
  - Test CRUD operations with fixtures
  - Test error cases (not found, duplicate, constraint violations)
  - Test transaction rollback
  - Test batch operations
  - Aim for 90%+ coverage
  - **Files to create:**
    - `/frontend/__tests__/lib/forums-v2/repositories/topic-repository.test.ts`
    - `/frontend/__tests__/lib/forums-v2/repositories/reply-repository.test.ts`
    - `/frontend/__tests__/lib/forums-v2/repositories/category-repository.test.ts`

#### Day 5-7: Service Layer (2-3 days)
- [ ] **Build core service layer** (1.5 days)
  - Implement ForumTopicServiceV2 with Result pattern
  - Implement ForumReplyServiceV2 with conversation grouping
  - Implement ForumCategoryServiceV2 with statistics
  - Implement ForumSearchServiceV2 with FTS5 + LIKE fallback
  - Implement ForumAnalyticsServiceV2 with performance tracking
  - Add performance monitoring (query timing, cache hit rates)
  - **Files to create:**
    - `/frontend/src/lib/forums-v2/services/ForumTopicServiceV2.ts`
    - `/frontend/src/lib/forums-v2/services/ForumReplyServiceV2.ts`
    - `/frontend/src/lib/forums-v2/services/ForumCategoryServiceV2.ts`
    - `/frontend/src/lib/forums-v2/services/ForumSearchServiceV2.ts`
    - `/frontend/src/lib/forums-v2/services/ForumAnalyticsServiceV2.ts`
    - `/frontend/src/lib/forums-v2/services/index.ts` - Factory pattern
    - `/frontend/src/lib/forums-v2/monitoring/metrics.ts` - Performance metrics

- [ ] **Write service tests** (1 day)
  - Test business logic with mocked repositories
  - Test error propagation (Result pattern)
  - Test transaction handling
  - Test cache invalidation
  - Test performance metrics collection
  - Aim for 95%+ coverage
  - **Files to create:**
    - `/frontend/__tests__/lib/forums-v2/services/ForumTopicServiceV2.test.ts`
    - `/frontend/__tests__/lib/forums-v2/services/ForumReplyServiceV2.test.ts`
    - `/frontend/__tests__/lib/forums-v2/services/ForumSearchServiceV2.test.ts`
    - `/frontend/__tests__/lib/forums-v2/services/ForumAnalyticsServiceV2.test.ts`

- [ ] **Implement caching layer** (0.5 days)
  - Extend reply tree cache with warming capability
  - Add cache metrics (hit rate, eviction count)
  - Implement cache warming for popular topics (top 20 by view count)
  - **Files to modify:**
    - `/frontend/src/lib/cache/replyTreeCache.ts` - Add warming
  - **Files to create:**
    - `/frontend/src/lib/forums-v2/cache/warming.ts` - Cache warming logic

### Deliverables
✅ New database schema with indexes (forums-test.db)
✅ Repository layer with Result pattern (5 repositories)
✅ Repository test suite (90%+ coverage)
✅ Service layer with monitoring (5 services)
✅ Service test suite (95%+ coverage)
✅ Caching layer with warming

---

## Phase 2: API Layer (2-3 days)

### Goals
- Build new API routes with v2 prefix
- Implement contract compliance tests
- Add integration tests
- Benchmark performance

### Tasks

#### Day 8-9: API Routes (1.5-2 days)
- [ ] **Build new API routes** (1.5 days)
  - Create versioned routes under `/api/forums-v2/`
  - Use existing validation schemas from `/lib/forums/validation-schemas.ts`
  - Implement proper error handling with custom error classes
  - Add request/response logging
  - Add rate limiting middleware
  - Add CSRF protection
  - **Routes to create:**
    - `/frontend/src/app/api/forums-v2/categories/route.ts` - List categories
    - `/frontend/src/app/api/forums-v2/topics/route.ts` - Create/list topics
    - `/frontend/src/app/api/forums-v2/topics/[id]/route.ts` - Get/update/delete topic
    - `/frontend/src/app/api/forums-v2/topics/[id]/pin/route.ts` - Pin/unpin
    - `/frontend/src/app/api/forums-v2/topics/[id]/lock/route.ts` - Lock/unlock
    - `/frontend/src/app/api/forums-v2/replies/route.ts` - Create reply
    - `/frontend/src/app/api/forums-v2/replies/[id]/route.ts` - Update/delete reply
    - `/frontend/src/app/api/forums-v2/replies/[id]/solution/route.ts` - Mark solution
    - `/frontend/src/app/api/forums-v2/search/route.ts` - Search topics/replies
    - `/frontend/src/app/api/forums-v2/stats/route.ts` - Forum statistics
  - **Files to create:**
    - `/frontend/src/lib/security/rate-limiter.ts` - Rate limiting implementation
    - `/frontend/src/lib/security/csrf-v2.ts` - CSRF token management

- [ ] **Contract compliance tests** (0.25 days)
  - Validate all request/response schemas match API contract
  - Test required fields, data types, constraints
  - Test error response format consistency
  - **Files to create:**
    - `/frontend/__tests__/api/forums-v2/contract-compliance.test.ts`

- [ ] **Integration tests** (0.5 days)
  - Test full request/response cycle with test database
  - Test authentication/authorization flows
  - Test optimistic locking (concurrent updates)
  - Test transaction rollback on errors
  - **Files to create:**
    - `/frontend/__tests__/api/forums-v2/topics.integration.test.ts`
    - `/frontend/__tests__/api/forums-v2/replies.integration.test.ts`
    - `/frontend/__tests__/api/forums-v2/search.integration.test.ts`

#### Day 10: Performance & Monitoring (1 day)
- [ ] **Performance benchmarks** (0.5 days)
  - Benchmark query performance (target: <50ms for topic list, <100ms for topic with replies)
  - Benchmark FTS5 search (target: <30ms)
  - Benchmark cache hit rate (target: >70%)
  - Compare v1 vs v2 performance
  - **Files to create:**
    - `/frontend/scripts/forums/benchmark-v2.ts` - Benchmark suite
    - `/docs/PERFORMANCE_BENCHMARKS.md` - Results documentation

- [ ] **Monitoring dashboard** (0.5 days)
  - Create metrics endpoint for monitoring
  - Track query counts, latencies, cache hit rates
  - Track error rates by type
  - **Files to create:**
    - `/frontend/src/app/api/forums-v2/metrics/route.ts` - Metrics endpoint
    - `/frontend/src/lib/forums-v2/monitoring/dashboard.ts` - Metrics aggregation

### Deliverables
✅ 11 API routes under `/api/forums-v2/`
✅ Contract compliance test suite
✅ Integration test suite
✅ Performance benchmarks (v1 vs v2 comparison)
✅ Monitoring dashboard with metrics

---

## Phase 3: Migration (2-3 days)

### Goals
- Build data migration scripts
- Validate data integrity
- Create backup/restore procedures
- Test rollback scenarios

### Tasks

#### Day 11-12: Migration Scripts (1.5-2 days)
- [ ] **Data migration scripts** (1 day)
  - Incremental migration approach (avoid locking database for long periods)
  - Migrate in batches of 1000 rows
  - Preserve all IDs (topics, replies, categories remain unchanged)
  - Rebuild FTS5 index with all existing data
  - Rebuild conversation metadata (conversation_id, participant_hash, reply_depth)
  - **Files to create:**
    - `/frontend/scripts/forums/migrate-to-v2.ts` - Main migration script
    - `/frontend/scripts/forums/migrate-categories.ts` - Category migration
    - `/frontend/scripts/forums/migrate-topics.ts` - Topic migration
    - `/frontend/scripts/forums/migrate-replies.ts` - Reply migration
    - `/frontend/scripts/forums/rebuild-fts5-v2.ts` - FTS5 index rebuild
    - `/frontend/scripts/forums/rebuild-metadata-v2.ts` - Conversation metadata rebuild

- [ ] **Validation scripts** (0.5 days)
  - Row count validation (ensure all records migrated)
  - Foreign key integrity checks
  - FTS5 index sync validation (search results match expected)
  - Conversation metadata validation (all fields populated correctly)
  - Performance regression tests (ensure v2 is faster or equal to v1)
  - **Files to create:**
    - `/frontend/scripts/forums/validate-migration.ts` - Validation suite
    - `/frontend/scripts/forums/validate-fts5-sync.ts` - FTS5 validation
    - `/frontend/scripts/forums/validate-metadata.ts` - Metadata validation

#### Day 13: Backup & Rollback (0.5-1 day)
- [ ] **Backup strategy** (0.25 days)
  - Automated pre-migration backup to `/frontend/data/backups/`
  - Retention policy (keep last 7 backups)
  - Backup verification (restore to temp DB and compare checksums)
  - **Files to create:**
    - `/frontend/scripts/forums/backup-before-migration.ts` - Pre-migration backup
    - `/frontend/scripts/forums/verify-backup.ts` - Backup verification

- [ ] **Rollback procedures** (0.25 days)
  - Database restore from backup
  - Feature flag toggle (instant revert to v1 API)
  - Cache invalidation (clear all v2 caches)
  - Monitoring alert on rollback
  - **Files to create:**
    - `/frontend/scripts/forums/rollback-migration.ts` - Rollback script
    - `/docs/ROLLBACK_PROCEDURES.md` - Rollback documentation

### Deliverables
✅ Data migration scripts (incremental, batched)
✅ Validation suite (row counts, foreign keys, FTS5, metadata)
✅ Backup/restore automation
✅ Rollback procedures with documentation

---

## Phase 4: Cutover (1 day)

### Goals
- Deploy new backend alongside old
- Run parallel testing with feature flags
- Monitor for errors and performance issues
- Switch traffic to v2
- Remove old code

### Tasks

#### Day 14: Deployment & Monitoring (1 day)
- [ ] **Deploy new backend alongside old** (0.25 days)
  - Deploy v2 API routes to production
  - Keep v1 routes operational
  - Enable feature flag system
  - **Files to create:**
    - `/frontend/src/lib/feature-flags/forums-v2.ts` - Feature flag management
  - **Environment variables to add:**
    ```bash
    ENABLE_FORUMS_V2=false  # Start disabled
    FORUMS_V2_ROLLOUT_PERCENTAGE=0  # Gradual rollout
    ```

- [ ] **Run both in parallel (feature flag)** (0.25 days)
  - Implement A/B testing (10% traffic to v2, 90% to v1)
  - Log all v2 requests for analysis
  - Compare v1 vs v2 response times
  - **Files to modify:**
    - `/frontend/src/components/forums/*` - Add feature flag checks

- [ ] **A/B test** (0.25 days)
  - Gradually increase v2 traffic: 10% → 25% → 50% → 100%
  - Monitor error rates at each step
  - Rollback if error rate >1% or latency >2x v1
  - **Monitoring:**
    - Error rate by API route
    - P50/P95/P99 latency
    - Cache hit rate
    - Database connection pool utilization

- [ ] **Monitor errors** (0.125 days)
  - Set up alerts for elevated error rates
  - Track database connection leaks
  - Monitor cache invalidation storms
  - Track FTS5 search failures

- [ ] **Switch over** (0.0625 days)
  - Set `ENABLE_FORUMS_V2=true` (100% traffic)
  - Update frontend to use `/api/forums-v2/` routes
  - Keep v1 routes active for 24 hours (safety buffer)

- [ ] **Remove old code** (0.125 days)
  - Remove v1 API routes after 24 hour observation period
  - Remove old service implementations
  - Archive old code to `_archive/forums-v1/`
  - Update documentation to remove v1 references
  - **Files to delete:**
    - `/frontend/src/app/api/forums/*` (old routes)
    - `/frontend/src/lib/forums/services/*` (old services)
  - **Files to archive:**
    - Move deleted files to `/frontend/_archive/forums-v1/`

### Deliverables
✅ v2 deployed alongside v1
✅ Feature flag system operational
✅ A/B testing completed (0% → 100% rollout)
✅ Monitoring dashboard active
✅ v1 code removed and archived

---

## Testing Strategy

### Unit Tests
**Coverage Target:** 95%+

**Scope:**
- Repository layer (CRUD operations, error cases, transactions)
- Service layer (business logic, Result pattern, cache invalidation)
- Validation schemas (Zod schema edge cases)
- Utility functions (color contrast, markdown rendering)

**Tools:**
- Jest 29.7.0
- @testing-library/react
- better-sqlite3 (in-memory DB for tests)

**Example Test Structure:**
```typescript
// __tests__/lib/forums-v2/repositories/topic-repository.test.ts
describe('TopicRepository', () => {
  let db: Database;
  let repo: TopicRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    // Load schema-v2.sql
    repo = new TopicRepository(db);
  });

  describe('createTopic', () => {
    it('should create topic with valid data', async () => {
      const result = await repo.createTopic({...});
      expect(result.isOk()).toBe(true);
      expect(result.value.id).toBeDefined();
    });

    it('should return Err on duplicate title', async () => {
      await repo.createTopic({title: 'Test'});
      const result = await repo.createTopic({title: 'Test'});
      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('DUPLICATE_TITLE');
    });
  });
});
```

### Integration Tests
**Coverage Target:** 80%+

**Scope:**
- API routes (full request/response cycle)
- Authentication/authorization flows
- Database transactions (multi-step operations)
- Cache invalidation (verify cache cleared on updates)

**Example:**
```typescript
// __tests__/api/forums-v2/topics.integration.test.ts
describe('POST /api/forums-v2/topics', () => {
  it('should create topic and invalidate cache', async () => {
    const response = await fetch('/api/forums-v2/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', content: 'Content', category_id: 1 })
    });

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.topic.id).toBeDefined();

    // Verify cache invalidated
    const cacheHit = cache.get(['forum', 'topics']);
    expect(cacheHit).toBeNull();
  });
});
```

### Contract Tests
**Coverage Target:** 100% of API endpoints

**Scope:**
- Request schema validation (all required fields, data types)
- Response schema validation (matches API contract)
- Error response format (consistent error structure)

**Example:**
```typescript
// __tests__/api/forums-v2/contract-compliance.test.ts
describe('API Contract Compliance', () => {
  it('POST /api/forums-v2/topics matches contract', async () => {
    const response = await fetch('/api/forums-v2/topics', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Content', category_id: 1 })
    });

    const json = await response.json();

    // Validate against OpenAPI schema
    expect(json).toMatchSchema(TopicResponseSchema);
  });
});
```

### Performance Tests
**Target Metrics:**
- Topic list: <50ms (P95)
- Topic with replies: <100ms (P95)
- FTS5 search: <30ms (P95)
- Cache hit rate: >70%

**Benchmark Script:**
```bash
npm run benchmark:forums-v2

# Output:
# Topic list (100 topics): 23ms (P50), 47ms (P95)
# Topic with replies (50 replies): 68ms (P50), 94ms (P95)
# FTS5 search: 12ms (P50), 28ms (P95)
# Cache hit rate: 73.2%
```

---

## Development Workflow

### Parallel Development Strategy

**Goal:** Develop v2 backend while v1 remains operational and receives bug fixes.

**Branch Strategy:**
```
main (production)
├── feature/forums-v2-foundation (Phase 1)
├── feature/forums-v2-api (Phase 2)
├── feature/forums-v2-migration (Phase 3)
└── feature/forums-v2-cutover (Phase 4)
```

**Workflow:**

1. **Create feature branch:**
   ```bash
   git checkout -b feature/forums-v2-foundation
   ```

2. **Develop in isolated directories:**
   - New code: `/frontend/src/lib/forums-v2/`
   - Tests: `/frontend/__tests__/lib/forums-v2/`
   - API routes: `/frontend/src/app/api/forums-v2/`
   - Old code remains untouched in `/frontend/src/lib/forums/`

3. **Run tests continuously:**
   ```bash
   npm test -- --watch forums-v2
   ```

4. **Commit frequently with descriptive messages:**
   ```bash
   git commit -m "feat(forums-v2): Add TopicRepository with Result pattern"
   ```

5. **Merge to main after each phase:**
   ```bash
   git checkout main
   git merge feature/forums-v2-foundation
   npm run type-check  # CRITICAL
   npm test
   git push
   ```

### Testing New Backend Before Cutover

**Feature Flag System:**
```typescript
// /frontend/src/lib/feature-flags/forums-v2.ts
export function useForumsV2(): boolean {
  if (process.env.ENABLE_FORUMS_V2 === 'true') {
    const rolloutPercentage = parseInt(process.env.FORUMS_V2_ROLLOUT_PERCENTAGE || '0');
    const userHash = hashUserId(getCurrentUserId());
    return userHash % 100 < rolloutPercentage;
  }
  return false;
}
```

**Component Integration:**
```typescript
// /frontend/src/components/forums/TopicList.tsx
'use client'
import { useForumsV2 } from '@/lib/feature-flags/forums-v2';

export function TopicList() {
  const useV2 = useForumsV2();
  const apiEndpoint = useV2 ? '/api/forums-v2/topics' : '/api/forums/topics';

  const { data } = useSWR(apiEndpoint, fetch);
  // ...
}
```

**Testing Procedure:**
1. Deploy with `ENABLE_FORUMS_V2=false` (0% traffic)
2. Manually test v2 endpoints with API client
3. Enable for internal team: `FORUMS_V2_ROLLOUT_PERCENTAGE=10`
4. Monitor for 24 hours, check error rates
5. Gradually increase: 25% → 50% → 100%
6. Rollback immediately if error rate >1%

### CI/CD Integration

**Pre-deployment Checks:**
```bash
# .github/workflows/test.yml
- name: Type Check
  run: cd frontend && npm run type-check

- name: Unit Tests
  run: cd frontend && npm test

- name: Integration Tests
  run: cd frontend && npm run test:integration

- name: Contract Tests
  run: cd frontend && npm run test:contract

- name: Performance Benchmarks
  run: cd frontend && npm run benchmark:forums-v2
```

**Deployment Gates:**
- All tests must pass (100%)
- Type-check must pass
- Performance benchmarks must not regress >10%
- Code coverage must be >90% for new code

---

## Migration Details

### Data Migration Strategy

**Approach:** Incremental migration with validation checkpoints

**Why Incremental?**
- Avoids locking database for extended periods
- Allows progress monitoring
- Enables partial rollback if needed
- Reduces risk of data corruption

**Migration Steps:**

#### Step 1: Pre-Migration Backup (5 minutes)
```bash
npm run forums:backup-before-migration

# Output:
# ✓ Backing up forums.db...
# ✓ Backup created: forums-backup-2025-10-15T10-30-00.db
# ✓ Verifying backup integrity...
# ✓ Backup verified (checksums match)
```

#### Step 2: Schema Creation (1 minute)
```bash
npm run forums:create-schema-v2

# Creates forums-v2.db with new schema
# Adds performance indexes
# Enables foreign key constraints
```

#### Step 3: Migrate Categories (10 seconds)
```sql
-- Migrate categories (small dataset, ~6 rows)
INSERT INTO forums_v2.forum_categories
SELECT * FROM forums.forum_categories;

-- Validation
SELECT COUNT(*) FROM forums_v2.forum_categories; -- Should match forums.forum_categories
```

#### Step 4: Migrate Topics (2-3 minutes)
```typescript
// Batch migration (1000 rows per batch)
const batchSize = 1000;
const totalTopics = db.prepare('SELECT COUNT(*) FROM forum_topics').get().count;

for (let offset = 0; offset < totalTopics; offset += batchSize) {
  const topics = db.prepare(`
    SELECT * FROM forum_topics
    LIMIT ? OFFSET ?
  `).all(batchSize, offset);

  const stmt = dbV2.prepare(`
    INSERT INTO forum_topics VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = dbV2.transaction((topics) => {
    for (const topic of topics) {
      stmt.run(...Object.values(topic));
    }
  });

  transaction(topics);

  console.log(`Migrated ${offset + topics.length}/${totalTopics} topics`);
}
```

#### Step 5: Migrate Replies (5-10 minutes)
```typescript
// Similar batched approach for replies (~500-1000 rows)
// Rebuild conversation metadata after migration
```

#### Step 6: Rebuild FTS5 Index (1-2 minutes)
```sql
-- Rebuild FTS5 search index
DELETE FROM forum_search_fts;

INSERT INTO forum_search_fts (content_id, content_type, title, content, author_username, category_name)
SELECT
  id, 'topic', title, content, username, category_name
FROM forum_topics;

INSERT INTO forum_search_fts (content_id, content_type, title, content, author_username, category_name)
SELECT
  id, 'reply', NULL, content, username, NULL
FROM forum_replies;

-- Verify index
SELECT COUNT(*) FROM forum_search_fts; -- Should match topics + replies
```

#### Step 7: Validation (1-2 minutes)
```bash
npm run forums:validate-migration

# Checks:
# ✓ Row counts match (categories, topics, replies)
# ✓ Foreign key integrity (no orphaned records)
# ✓ FTS5 index synced (search results match)
# ✓ Conversation metadata populated
# ✓ Performance regression test passed
```

#### Step 8: Cutover (instant)
```bash
# Rename databases (atomic operation)
mv forums.db forums-v1-archive.db
mv forums-v2.db forums.db

# Update feature flag
export ENABLE_FORUMS_V2=true

# Restart application
pm2 restart veritable-games
```

**Total Migration Time:** 10-20 minutes (depending on dataset size)

### Migration Validation Checklist

#### Data Integrity
- [ ] Row counts match for all tables
- [ ] Foreign keys are valid (no orphaned records)
- [ ] Primary keys are unique
- [ ] Timestamps are preserved
- [ ] User IDs match users.db

#### Search Functionality
- [ ] FTS5 index row count matches topics + replies
- [ ] Search results match expected (test queries)
- [ ] LIKE fallback works when FTS5 disabled
- [ ] Snippet generation works

#### Conversation Metadata
- [ ] All replies have conversation_id
- [ ] All replies have reply_depth
- [ ] All replies have thread_root_id (if nested)
- [ ] participant_hash is populated

#### Performance
- [ ] Topic list query <50ms (P95)
- [ ] Topic with replies <100ms (P95)
- [ ] Search query <30ms (P95)
- [ ] No N+1 queries

---

## Rollback Plan

### When to Rollback

**Immediate Rollback Triggers:**
- Error rate >5% for any API endpoint
- Latency >3x baseline for any operation
- Database corruption detected
- Data loss detected (row count mismatch)

**Consider Rollback:**
- Error rate 1-5% for >1 hour
- Latency 2-3x baseline for >1 hour
- Cache hit rate <50% (indicates cache invalidation storm)
- User-reported critical bugs

### Rollback Procedure

**Option 1: Feature Flag Rollback (Instant)**
```bash
# Revert to v1 API without database changes
export ENABLE_FORUMS_V2=false
pm2 restart veritable-games

# Verify v1 operational
curl http://localhost:3000/api/forums/topics
```

**Option 2: Database Rollback (5 minutes)**
```bash
# Stop application
pm2 stop veritable-games

# Restore from backup
npm run forums:rollback-migration

# Script does:
# 1. Rename forums.db → forums-v2-failed.db
# 2. Copy forums-backup-*.db → forums.db
# 3. Verify backup integrity
# 4. Clear all caches

# Restart application
pm2 start veritable-games

# Verify v1 operational
curl http://localhost:3000/api/forums/topics
```

**Option 3: Partial Rollback (10 minutes)**
```bash
# Keep v2 database, rollback specific table
# Example: Rollback replies only

# Restore replies from backup
npm run forums:rollback-table replies

# Re-run reply migration with fixes
npm run forums:migrate-replies

# Validate
npm run forums:validate-migration
```

### Post-Rollback Actions

1. **Incident Report:**
   - Document error rates, affected users, root cause
   - Create GitHub issue with postmortem
   - Update rollback procedures based on learnings

2. **Data Preservation:**
   - Archive failed migration database
   - Preserve logs for analysis
   - Export error reports

3. **Fix & Retry:**
   - Identify root cause from logs
   - Fix issue in development environment
   - Re-run full test suite
   - Schedule retry migration

### Rollback Testing

**Before Migration:**
```bash
# Test rollback procedure in staging
npm run forums:test-rollback

# Steps:
# 1. Run migration
# 2. Immediately rollback
# 3. Verify data integrity
# 4. Verify v1 operational
# 5. Time the rollback process
```

---

## Success Criteria

### Functional Success Metrics

**Must Have (Phase Gate):**
- [ ] All 11 API endpoints operational
- [ ] All unit tests pass (95%+ coverage)
- [ ] All integration tests pass (80%+ coverage)
- [ ] All contract tests pass (100% of endpoints)
- [ ] Zero data loss (row counts match exactly)
- [ ] Foreign key integrity maintained
- [ ] FTS5 search functional (115+ rows indexed)

**Should Have (Quality Metrics):**
- [ ] Error rate <0.1% in production
- [ ] P95 latency improvements vs v1:
  - Topic list: -20% (current: ~60ms → target: ~50ms)
  - Topic with replies: -30% (current: ~150ms → target: ~100ms)
  - Search: -40% (current: ~50ms → target: ~30ms)
- [ ] Cache hit rate >70% (current: ~70%, maintain or improve)

**Nice to Have (Stretch Goals):**
- [ ] Automated performance regression testing in CI
- [ ] Real-time monitoring dashboard
- [ ] Automated cache warming on deployment
- [ ] Zero-downtime schema migrations

### Technical Success Metrics

**Code Quality:**
- [ ] TypeScript strict mode enabled (no `any` types)
- [ ] All new code uses Result pattern (no thrown exceptions in services)
- [ ] All database queries use prepared statements
- [ ] No direct Database instantiation (100% dbPool usage)
- [ ] ESLint rules enforced (if re-enabled)

**Performance:**
- [ ] No N+1 queries (all batch fetches)
- [ ] Database indexes on all foreign keys
- [ ] Connection pool utilization <80%
- [ ] Memory usage stable (no leaks)

**Security:**
- [ ] Rate limiting on all API endpoints
- [ ] CSRF protection on state-changing operations
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention (prepared statements only)
- [ ] Authentication on protected routes

### Business Success Metrics

**User Experience:**
- [ ] Zero user-facing errors during migration
- [ ] No downtime during cutover
- [ ] Search results accuracy maintained
- [ ] Reply threading preserved
- [ ] Conversation grouping functional

**Operational:**
- [ ] Migration completed in <30 minutes
- [ ] Rollback procedure tested and <5 minutes
- [ ] Documentation complete and accurate
- [ ] Team trained on new architecture
- [ ] Monitoring alerts configured

### Post-Migration Review (Day 15)

**Review Checklist:**
- [ ] Compare actual vs estimated timelines
- [ ] Review error logs for unexpected issues
- [ ] Analyze performance benchmarks (before/after)
- [ ] Survey internal team for feedback
- [ ] Update documentation with learnings
- [ ] Plan for future improvements

**Success Criteria Review:**
```bash
npm run forums:migration-report

# Output:
# Migration Summary
# ================
# Duration: 18 minutes (estimated: 10-20)
# Data Loss: 0 rows
# Error Rate: 0.02% (target: <0.1%)
# Latency Improvement:
#   - Topic list: -35% (60ms → 39ms)
#   - Topic with replies: -42% (150ms → 87ms)
#   - Search: -55% (50ms → 23ms)
# Cache Hit Rate: 76% (target: >70%)
#
# ✓ All success criteria met
```

---

## Risk Assessment

### High Risk Areas

#### 1. Data Migration Integrity
**Risk:** Data loss or corruption during migration
**Mitigation:**
- Incremental migration with validation checkpoints
- Automated backup before migration
- Row count validation after each step
- Rollback procedure tested in staging

#### 2. Performance Regression
**Risk:** v2 slower than v1 due to new architecture
**Mitigation:**
- Performance benchmarks before migration
- Database indexes on all foreign keys
- Cache warming to eliminate cold start
- A/B testing to compare v1 vs v2 latency

#### 3. Breaking Frontend
**Risk:** API contract changes break existing components
**Mitigation:**
- API contract v2 maintains compatibility with v1 schemas
- Contract compliance tests (100% coverage)
- Feature flags allow instant rollback
- Parallel deployment (both v1 and v2 live)

### Medium Risk Areas

#### 4. Cache Invalidation Storms
**Risk:** Mass cache invalidation causes database overload
**Mitigation:**
- Gradual cache warming on deployment
- Rate limiting on cache rebuilds
- Monitoring for elevated cache miss rates

#### 5. FTS5 Index Sync Failures
**Risk:** FTS5 index out of sync with tables
**Mitigation:**
- Automated FTS5 rebuild in migration
- Triggers to keep index synced
- Fallback to LIKE queries if FTS5 fails
- Validation script checks index row count

### Low Risk Areas

#### 6. Feature Flag Logic Errors
**Risk:** Wrong users routed to v2 prematurely
**Mitigation:**
- Start with 0% rollout, test manually
- Gradual rollout (10% → 25% → 50% → 100%)
- Feature flag override for testing

---

## Appendix

### File Structure After Migration

```
frontend/
├── src/
│   ├── lib/
│   │   ├── forums/              # v1 (archived after cutover)
│   │   ├── forums-v2/           # v2 (becomes forums/ after cutover)
│   │   │   ├── repositories/
│   │   │   │   ├── topic-repository.ts
│   │   │   │   ├── reply-repository.ts
│   │   │   │   ├── category-repository.ts
│   │   │   │   ├── tag-repository.ts
│   │   │   │   ├── search-repository.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── ForumTopicServiceV2.ts
│   │   │   │   ├── ForumReplyServiceV2.ts
│   │   │   │   ├── ForumCategoryServiceV2.ts
│   │   │   │   ├── ForumSearchServiceV2.ts
│   │   │   │   ├── ForumAnalyticsServiceV2.ts
│   │   │   │   └── index.ts
│   │   │   ├── cache/
│   │   │   │   └── warming.ts
│   │   │   ├── monitoring/
│   │   │   │   ├── metrics.ts
│   │   │   │   └── dashboard.ts
│   │   │   ├── validation-schemas.ts  # Reuse existing
│   │   │   ├── branded-types.ts       # Reuse existing
│   │   │   └── types.ts               # Reuse existing
│   │   └── security/
│   │       ├── rate-limiter.ts        # NEW
│   │       └── csrf-v2.ts             # NEW
│   └── app/
│       └── api/
│           ├── forums/           # v1 (deleted after cutover)
│           └── forums-v2/        # v2 (becomes forums/ after cutover)
│               ├── categories/
│               │   └── route.ts
│               ├── topics/
│               │   ├── route.ts
│               │   └── [id]/
│               │       ├── route.ts
│               │       ├── pin/route.ts
│               │       └── lock/route.ts
│               ├── replies/
│               │   ├── route.ts
│               │   └── [id]/
│               │       ├── route.ts
│               │       └── solution/route.ts
│               ├── search/
│               │   └── route.ts
│               ├── stats/
│               │   └── route.ts
│               └── metrics/
│                   └── route.ts
├── __tests__/
│   ├── lib/
│   │   └── forums-v2/
│   │       ├── repositories/
│   │       │   ├── topic-repository.test.ts
│   │       │   ├── reply-repository.test.ts
│   │       │   └── category-repository.test.ts
│   │       └── services/
│   │           ├── ForumTopicServiceV2.test.ts
│   │           ├── ForumReplyServiceV2.test.ts
│   │           └── ForumSearchServiceV2.test.ts
│   ├── api/
│   │   └── forums-v2/
│   │       ├── contract-compliance.test.ts
│   │       ├── topics.integration.test.ts
│   │       ├── replies.integration.test.ts
│   │       └── search.integration.test.ts
│   └── fixtures/
│       └── forums/
│           ├── topics.json
│           ├── replies.json
│           └── users.json
├── scripts/
│   └── forums/
│       ├── create-schema-v2.ts
│       ├── migrate-to-v2.ts
│       ├── migrate-categories.ts
│       ├── migrate-topics.ts
│       ├── migrate-replies.ts
│       ├── rebuild-fts5-v2.ts
│       ├── rebuild-metadata-v2.ts
│       ├── validate-migration.ts
│       ├── backup-before-migration.ts
│       ├── rollback-migration.ts
│       └── benchmark-v2.ts
├── data/
│   ├── forums.db              # v1 (archived as forums-v1-archive.db)
│   ├── forums-v2.db           # v2 (renamed to forums.db)
│   ├── forums-test.db         # Test database
│   └── backups/
│       └── forums-backup-*.db
└── docs/
    ├── api/
    │   └── FORUMS_API_CONTRACT_V2.md
    ├── database/
    │   ├── FORUMS_SCHEMA_V2.sql
    │   └── SCHEMA_MIGRATION_PLAN.md
    ├── MIGRATION_STRATEGY.md
    ├── ROLLBACK_PROCEDURES.md
    └── PERFORMANCE_BENCHMARKS.md
```

### Environment Variables

```bash
# .env.local

# Feature Flags
ENABLE_FORUMS_V2=false              # Enable v2 backend (default: false)
FORUMS_V2_ROLLOUT_PERCENTAGE=0     # Gradual rollout percentage (0-100)

# Rate Limiting (NEW)
RATE_LIMIT_WINDOW_MS=60000         # 1 minute
RATE_LIMIT_MAX_REQUESTS=100        # 100 requests per window

# CSRF Protection (NEW)
CSRF_SECRET=your-csrf-secret-here  # 32-byte hex string

# Monitoring (NEW)
ENABLE_PERFORMANCE_MONITORING=true # Enable metrics collection
METRICS_RETENTION_DAYS=7           # Keep metrics for 7 days
```

### Dependencies to Add

```json
{
  "dependencies": {
    "@node-rs/bcrypt": "^1.9.0",     // Already installed
    "better-sqlite3": "^9.6.0",      // Already installed
    "zod": "^4.0.17"                 // Already installed
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8", // Already installed
    "jest": "^29.7.0",                // Already installed
    "@testing-library/react": "^14.1.2" // Already installed
  }
}
```

**No new dependencies required!** All necessary packages already installed.

### Key Commands

```bash
# Development
npm run dev                        # Start dev server
npm run type-check                 # TypeScript validation (CRITICAL)
npm test                           # Run all tests
npm test -- --watch forums-v2      # Watch mode for v2 tests

# Migration
npm run forums:create-schema-v2    # Create v2 schema
npm run forums:migrate-to-v2       # Run full migration
npm run forums:validate-migration  # Validate migration
npm run forums:rollback-migration  # Rollback to v1

# Performance
npm run benchmark:forums-v2        # Run performance benchmarks
npm run forums:migration-report    # Generate migration report

# Backup/Restore
npm run forums:backup-before-migration # Pre-migration backup
npm run forums:verify-backup           # Verify backup integrity
```

---

## Timeline Summary

| Phase | Duration | Start | End | Key Deliverables |
|-------|----------|-------|-----|------------------|
| Phase 0: Preparation | 1-2 days | Day 1 | Day 2 | API contract, schema design, test fixtures, migration plan |
| Phase 1: Foundation | 3-5 days | Day 3 | Day 7 | Repository layer, service layer, test suites (90%+ coverage) |
| Phase 2: API Layer | 2-3 days | Day 8 | Day 10 | 11 API routes, contract tests, integration tests, benchmarks |
| Phase 3: Migration | 2-3 days | Day 11 | Day 13 | Migration scripts, validation, backup/rollback procedures |
| Phase 4: Cutover | 1 day | Day 14 | Day 14 | A/B testing, monitoring, 100% rollout, old code removed |
| **Total** | **12-16 days** | **Day 1** | **Day 14** | **Production-ready forums v2 backend** |

**Post-Migration:** Day 15 - Review, retrospective, documentation updates

---

## Conclusion

This roadmap provides a **comprehensive, step-by-step plan** to rebuild the forums backend with:

✅ **Zero downtime** through parallel deployment and feature flags
✅ **Zero data loss** through incremental migration and validation
✅ **Zero breaking changes** through API contract compatibility
✅ **Comprehensive testing** (95%+ code coverage, contract tests, integration tests)
✅ **Performance improvements** (20-55% latency reduction)
✅ **Production-ready monitoring** (metrics dashboard, performance tracking)
✅ **Instant rollback** capability (feature flags + database backup)

The migration is designed to be **low-risk, incremental, and reversible** at every step. The parallel development approach ensures the existing system remains operational while the new backend is built, tested, and validated.

**Next Steps:**
1. Review and approve this roadmap
2. Begin Phase 0 (Preparation) immediately
3. Schedule daily standups during migration
4. Assign team members to phases
5. Set up monitoring dashboard before cutover

**Questions or Concerns?**
- Contact: Development Team
- Document: `/docs/IMPLEMENTATION_ROADMAP.md`
- Last Updated: October 8, 2025
