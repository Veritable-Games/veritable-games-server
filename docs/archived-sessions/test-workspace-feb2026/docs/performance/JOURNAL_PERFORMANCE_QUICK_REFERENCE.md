# Journal Performance - Quick Reference
**Date**: February 15, 2026
**Status**: 🔴 NEEDS OPTIMIZATION
**Priority**: HIGH - User Experience Impact

---

## 🎯 Problem Statement

**User Report**: "Takes a moment or two for journals to load as you click between them"

**Measured Performance**:
- First click: 0ms (instant) ✅
- Subsequent clicks: **300-500ms** (perceived delay) ❌

---

## 🔍 Root Cause Analysis

```
User clicks journal
    ↓
Check if in initial server data? ──YES→ Load instantly (0ms) ✅
    ↓ NO
Fetch from API (/api/journals/[slug])
    ↓
Execute database query (6.4ms)
    ↓
Network round-trip (200-300ms)
    ↓
Parse and render (50-100ms)
    ↓
Total: 300-500ms ❌
```

**Issue**: No client-side content cache, so every "uncached" journal requires a full API round-trip.

---

## 📊 Performance Breakdown

| Component | Time | % of Total |
|-----------|------|------------|
| Network latency | 200-300ms | 60-70% |
| Database query (planning) | 6.2ms | 2% |
| Database query (execution) | 0.1ms | <1% |
| React rendering | 50-100ms | 15-20% |
| **TOTAL** | **300-500ms** | **100%** |

---

## 🚀 Optimization Strategy

### Phase 1: Client-Side Cache (HIGH IMPACT - 4 hours)

**Implement in-memory content cache**:
```typescript
// Zustand store addition
contentCache: Record<string, {
  content: string;
  timestamp: number;
  revision_timestamp: string | null;
}>
```

**Expected Result**:
- Cache hit rate: 70-80%
- Cache hit time: **0ms** (instant)
- Cache miss time: 300-500ms → 50-100ms (after query optimization)

**Performance Gain**:
- 70% of clicks: 300-500ms → 0ms (**83% faster**)
- 30% of clicks: 300-500ms → 50-100ms (**83% faster**)

### Phase 2: Database Optimizations (MEDIUM IMPACT - 1 hour)

#### A. Add Missing Index
```sql
CREATE INDEX idx_journals_updated_at ON wiki.journals (updated_at DESC);
```
**Impact**: 50-100ms faster for sorted lists (1000+ journals)

#### B. Optimize Query (LATERAL JOIN)
```sql
-- Replace correlated subquery with LATERAL JOIN
LEFT JOIN LATERAL (
  SELECT id, content, revision_timestamp
  FROM wiki_revisions
  WHERE page_id = j.id
  ORDER BY id DESC
  LIMIT 1
) r ON true
```
**Impact**: 6.4ms → 1.7ms (3-4x faster planning time)

### Phase 3: Full-Text Search (MEDIUM IMPACT - 4 hours)

```sql
-- Add GIN index for fast search
ALTER TABLE wiki.journals ADD COLUMN search_vector tsvector;
CREATE INDEX idx_journals_search ON wiki.journals USING GIN(search_vector);
```
**Impact**: 50-200ms → 20-50ms (search queries)

---

## 📈 Expected Results

### Before Optimization
```
┌─────────────────────┐
│ Initial Page Load   │ 200-300ms ✅
├─────────────────────┤
│ First Click         │   0ms    ✅
├─────────────────────┤
│ Subsequent Clicks   │ 300-500ms ❌ ← PROBLEM
├─────────────────────┤
│ Search              │  50-200ms ⚠️
└─────────────────────┘
```

### After Optimization
```
┌─────────────────────┐
│ Initial Page Load   │ 150-200ms ✅ (50ms faster)
├─────────────────────┤
│ First Click         │   0ms    ✅ (no change)
├─────────────────────┤
│ Cached Clicks (70%) │   0ms    ✅ ← INSTANT
├─────────────────────┤
│ Uncached (30%)      │  50-100ms ✅ ← 83% FASTER
├─────────────────────┤
│ Search              │  20-50ms ✅ (60% faster)
└─────────────────────┘
```

---

## ✅ Implementation Checklist

### Today (4 hours)
- [ ] **Add index**: `CREATE INDEX idx_journals_updated_at ON wiki.journals (updated_at DESC)`
- [ ] **Implement cache** in `/frontend/src/stores/journalsStore.ts`:
  - Add `contentCache` state
  - Add `getCachedContent()` method
  - Add `setCachedContent()` method
- [ ] **Update client** in `/frontend/src/app/wiki/category/journals/JournalsPageClient.tsx`:
  - Check cache before API call
  - Store fetched content in cache
- [ ] **Optimize query** in `/frontend/src/app/api/journals/[slug]/route.ts`:
  - Replace correlated subquery with LATERAL JOIN
- [ ] **Test**: Verify 400-500ms improvement on subsequent clicks

### Next Week (4 hours)
- [ ] Add full-text search GIN index
- [ ] Move category fetch to server-side
- [ ] Add performance monitoring

---

## 🎯 Success Metrics

**Target**: 95% of journal clicks load in <100ms

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Average click time | 300ms | 50ms | **83% faster** |
| P95 click time | 500ms | 100ms | **80% faster** |
| Instant loads | 30% | 80% | **+50%** |

---

## 🔗 Related Files

### High Priority
- `/frontend/src/stores/journalsStore.ts` - Add cache state
- `/frontend/src/app/wiki/category/journals/JournalsPageClient.tsx` - Check cache
- `/frontend/src/app/api/journals/[slug]/route.ts` - Optimize query

### Database
- Production: `ssh user@10.100.0.1 "docker exec veritable-games-postgres psql ..."`
- Schema: `wiki.journals`, `wiki.wiki_revisions`, `wiki.journal_categories`

### Documentation
- Full audit: `/docs/performance/JOURNAL_SYSTEM_PERFORMANCE_AUDIT_2026_02_15.md`

---

## 💡 Key Insight

**The issue isn't slow queries - it's unnecessary queries.**

- Query time: 6.4ms (fast)
- Network time: 200-300ms (unavoidable)
- **Solution**: Don't make the query at all (use cache)

**Result**: 70-80% of clicks will be instant (0ms) instead of delayed (500ms).
