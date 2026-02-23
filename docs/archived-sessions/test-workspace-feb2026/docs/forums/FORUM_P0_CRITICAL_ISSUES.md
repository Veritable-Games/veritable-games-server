# Forum System P0 Critical Issues - February 2026

**Document Date**: February 15, 2026
**Priority**: P0 (Critical - Requires Immediate Attention)
**Timeline**: 1-2 weeks for resolution
**Environment**: Production (https://www.veritablegames.com)

---

## Summary

This document identifies **4 confirmed bugs** and **3 critical security gaps** requiring immediate attention and comprehensive testing.

**Total P0 Issues**: 7 (4 bugs + 3 security gaps)
**Estimated Fix Effort**: 16 hours (bugs) + 50 hours (testing) = **66 hours total**

---

## Critical Bugs (4 Confirmed)

### Bug #1: Tag Filtering Broken in Search ⚠️

**Severity**: MEDIUM
**Priority**: P0
**Impact**: Medium (Feature degradation)
**Fix Effort**: 2 hours
**Test Effort**: 2 hours

**Description**:
Users cannot filter search results by tags. The search API accepts tag filters but doesn't apply them to the FTS5 query.

**Evidence**:
- **File**: `frontend/src/lib/forums/repositories/search-repository.ts`
- **Code Comment**: "tag filtering not implemented in repository, using basic search"
- **User Impact**: Cannot narrow search results by topic tags

**Root Cause**:
```typescript
// Current code accepts filters but doesn't apply tag filter
async search(query: string, filters?: SearchFilters) {
  let sql = 'SELECT * FROM forum_search_fts WHERE forum_search_fts MATCH ?';
  // filters.tags is ignored - NO JOIN to forum_topic_tags
}
```

**Proposed Fix**:
```typescript
async search(query: string, filters?: SearchFilters): Promise<Result<SearchResult[], RepositoryError>> {
  let sql = 'SELECT * FROM forum_search_fts WHERE forum_search_fts MATCH ?';
  const params = [query];

  // ADD TAG FILTER
  if (filters?.tags && filters.tags.length > 0) {
    sql += ` AND content_id IN (
      SELECT topic_id FROM forum_topic_tags
      WHERE tag_id IN (SELECT id FROM forum_tags WHERE name IN (${filters.tags.map(() => '?').join(',')}))
    )`;
    params.push(...filters.tags);
  }

  // ... rest of query
  const result = await dbAdapter.query(sql, params, { schema: 'forums' });
  return Ok(result.rows);
}
```

**Test Required**:
```typescript
// frontend/e2e/forums/search-complete.spec.ts
test('should filter search results by tags', async ({ page }) => {
  await page.goto('/forums/search?q=test&tags=bug,feature');

  // Verify only topics with 'bug' or 'feature' tags appear
  const results = await page.$$('[data-testid="search-result"]');
  for (const result of results) {
    const tags = await result.$$('[data-testid="topic-tag"]');
    const tagTexts = await Promise.all(tags.map(t => t.textContent()));
    expect(tagTexts.some(t => t === 'bug' || t === 'feature')).toBe(true);
  }
});
```

**Acceptance Criteria**:
- ✅ Tag filter parameter applied to FTS5 query
- ✅ Results only include topics with specified tags
- ✅ Multiple tags work (OR logic)
- ✅ Empty tag array returns all results
- ✅ Non-existent tag returns empty results

---

### Bug #2: Hidden Category Information Leakage 🔒

**Severity**: HIGH
**Priority**: P0 (Security Issue)
**Impact**: High (Information Disclosure)
**Fix Effort**: 1 hour
**Test Effort**: 3 hours

**Description**:
Admin-only categories (is_public=false) may leak information to non-admin users through the API. This is a security vulnerability.

**Evidence**:
- **File**: `frontend/src/app/api/forums/categories/[slug]/route.ts`
- **Issue**: API may not enforce visibility check before returning category data
- **Security Impact**: Non-admins can discover existence of hidden categories

**Current Code**:
```typescript
export const GET = withSecurity(async (request: NextRequest, context: RouteContext) => {
  const { slug } = await context.params;
  const category = await ForumCategoryService.getCategoryById(slug);

  // VULNERABILITY: May return data before checking visibility
  return NextResponse.json({ success: true, data: category });
});
```

**Proposed Fix**:
```typescript
export const GET = withSecurity(async (request: NextRequest, context: RouteContext) => {
  const { slug } = await context.params;
  const user = await getCurrentUser();

  const category = await ForumCategoryService.getCategoryById(slug);

  // ENFORCE VISIBILITY CHECK
  if (!category.is_public && user?.role !== 'admin') {
    // Return 404 (not 403) to prevent info leak
    throw new NotFoundError('Category', slug);
  }

  return NextResponse.json({ success: true, data: category });
});
```

**Why 404 instead of 403?**
- **403 Forbidden**: Confirms category exists, user lacks permission
- **404 Not Found**: Hides existence of hidden categories from non-admins
- **Security Best Practice**: Don't leak information about protected resources

**Tests Required**:
```typescript
// frontend/e2e/forums/security/authorization.spec.ts

test('anonymous user gets 404 for hidden category', async ({ request }) => {
  const response = await request.get('/api/forums/categories/admin-only');
  expect(response.status()).toBe(404); // Not 403
});

test('regular user gets 404 for hidden category', async ({ page, request }) => {
  await login(page, 'testuser1');
  const response = await page.request.get('/api/forums/categories/admin-only');
  expect(response.status()).toBe(404);
});

test('admin can access hidden category', async ({ page }) => {
  await login(page, 'admin');
  const response = await page.request.get('/api/forums/categories/admin-only');
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data.data.is_public).toBe(false);
});
```

**Acceptance Criteria**:
- ✅ Anonymous users get 404 for hidden categories
- ✅ Regular users get 404 for hidden categories
- ✅ Admin users can access hidden categories
- ✅ Hidden categories not listed for non-admins
- ✅ No information leak about category existence

---

### Bug #3: Multiple Solutions Allowed Per Topic 🐛

**Severity**: LOW
**Priority**: P0 (Data Integrity)
**Impact**: Medium (UX Confusion)
**Fix Effort**: 2 hours
**Test Effort**: 2 hours

**Description**:
Multiple replies can be marked as "solution" on the same topic, causing confusion about which reply is THE accepted solution.

**Evidence**:
- **File**: `frontend/src/lib/forums/services/ForumService.ts`
- **Method**: `markReplyAsSolution()`
- **Issue**: No check for existing solution before marking new one
- **Data Impact**: Multiple rows with is_solution=1 for same topic_id

**Current Code**:
```typescript
async markReplyAsSolution(replyId: ReplyId, userId: UserId): Promise<Result<Reply, ServiceError>> {
  // ... permission checks ...

  // PROBLEM: Directly sets is_solution=1 without checking existing
  await dbAdapter.query(
    'UPDATE forum_replies SET is_solution = 1 WHERE id = ?',
    [replyId],
    { schema: 'forums' }
  );

  return Ok(updatedReply);
}
```

**Proposed Fix**:
```typescript
async markReplyAsSolution(replyId: ReplyId, userId: UserId): Promise<Result<Reply, ServiceError>> {
  // ... existing permission checks ...

  // CHECK FOR EXISTING SOLUTION
  const existingSolution = await dbAdapter.query(
    'SELECT id FROM forum_replies WHERE topic_id = ? AND is_solution = 1 AND deleted_at IS NULL',
    [reply.topic_id],
    { schema: 'forums' }
  );

  if (existingSolution.rows.length > 0) {
    // UNMARK PREVIOUS SOLUTION (automatic toggle behavior)
    await dbAdapter.query(
      'UPDATE forum_replies SET is_solution = 0 WHERE topic_id = ? AND id != ?',
      [reply.topic_id, replyId],
      { schema: 'forums' }
    );
  }

  // Now mark new solution
  await dbAdapter.query(
    'UPDATE forum_replies SET is_solution = 1 WHERE id = ?',
    [replyId],
    { schema: 'forums' }
  );

  return Ok(updatedReply);
}
```

**Alternative Approach**: Add database constraint
```sql
-- Unique partial index to prevent multiple solutions
CREATE UNIQUE INDEX idx_one_solution_per_topic
ON forum_replies (topic_id)
WHERE is_solution = 1 AND deleted_at IS NULL;
```

**Test Required**:
```typescript
// frontend/e2e/forums/replies-crud.spec.ts

test('should prevent multiple solutions per topic', async ({ page }) => {
  await login(page, 'topicauthor');
  await page.goto('/forums/topics/1');

  // Mark first reply as solution
  await page.click('[data-testid="mark-solution-btn-1"]');
  await expect(page.locator('[data-testid="solution-badge-1"]')).toBeVisible();

  // Mark second reply as solution
  await page.click('[data-testid="mark-solution-btn-2"]');
  await expect(page.locator('[data-testid="solution-badge-2"]')).toBeVisible();

  // VERIFY: First reply solution badge should be gone
  await expect(page.locator('[data-testid="solution-badge-1"]')).not.toBeVisible();

  // Verify database only has one solution
  await page.reload();
  const solutions = await page.$$('[data-testid^="solution-badge"]');
  expect(solutions.length).toBe(1);
});
```

**Acceptance Criteria**:
- ✅ Only one reply marked as solution per topic
- ✅ Marking new solution auto-unmarks previous
- ✅ Database constraint prevents multiple solutions
- ✅ UI shows only one solution badge
- ✅ Unmarking solution works correctly

---

### Bug #4: Vote Count Drift Potential ⚡

**Severity**: MEDIUM
**Priority**: P0 (Data Integrity)
**Impact**: High (Inaccurate Vote Counts)
**Fix Effort**: 3 hours (requires database migration)
**Test Effort**: 4 hours

**Description**:
Concurrent votes may cause drift between `forum_votes` records and the aggregated `vote_count` column on `forum_replies`. This is a race condition.

**Evidence**:
- **File**: `frontend/src/app/api/forums/replies/[id]/vote/route.ts`
- **Issue**: Vote count updated via application code, not database trigger
- **Race Condition**: Two simultaneous votes may both read same count, then both write count+1

**Current Code**:
```typescript
// Pseudocode - simplified
export const POST = withSecurity(async (request, context) => {
  // 1. Insert vote record
  await dbAdapter.query('INSERT INTO forum_votes ...');

  // 2. Update vote_count (RACE CONDITION HERE)
  const currentCount = await dbAdapter.query('SELECT vote_count FROM forum_replies WHERE id = ?');
  const newCount = vote === 'up' ? currentCount + 1 : currentCount - 1;
  await dbAdapter.query('UPDATE forum_replies SET vote_count = ? WHERE id = ?', [newCount, replyId]);
});
```

**Race Condition Scenario**:
```
Time    User A                          User B
----    ------                          ------
T1      Read vote_count = 5
T2                                      Read vote_count = 5
T3      Write vote_count = 6
T4                                      Write vote_count = 6 (WRONG! Should be 7)
```

**Proposed Fix: Database Trigger**
```sql
-- frontend/scripts/migrations/0XX-vote-count-trigger.sql

-- PostgreSQL trigger to maintain vote_count accuracy
CREATE OR REPLACE FUNCTION update_reply_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_replies
  SET vote_count = (
    SELECT COALESCE(SUM(CASE
      WHEN vote_type = 'up' THEN 1
      WHEN vote_type = 'down' THEN -1
      ELSE 0
    END), 0)
    FROM forum_votes
    WHERE reply_id = COALESCE(NEW.reply_id, OLD.reply_id)
      AND deleted_at IS NULL
  )
  WHERE id = COALESCE(NEW.reply_id, OLD.reply_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT, UPDATE, DELETE of votes
CREATE TRIGGER vote_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON forum_votes
FOR EACH ROW
EXECUTE FUNCTION update_reply_vote_count();
```

**Updated Application Code**:
```typescript
export const POST = withSecurity(async (request, context) => {
  // Just insert/update vote record
  // Trigger automatically updates vote_count
  await dbAdapter.query(
    'INSERT INTO forum_votes (user_id, reply_id, vote_type) VALUES (?, ?, ?) ON CONFLICT (user_id, reply_id) DO UPDATE SET vote_type = ?',
    [userId, replyId, voteType, voteType]
  );

  // No manual vote_count update needed!
  return NextResponse.json({ success: true });
});
```

**Tests Required**:
```typescript
// frontend/e2e/forums/voting-complete.spec.ts

test('concurrent votes should be accurate', async ({ browser }) => {
  // Create two browser contexts (simulating concurrent users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  await login(page1, 'user1');
  await login(page2, 'user2');

  await page1.goto('/forums/topics/1');
  await page2.goto('/forums/topics/1');

  const initialCount = await getVoteCount(page1, 1);

  // Both users upvote simultaneously
  await Promise.all([
    vote(page1, 1, 'up'),
    vote(page2, 1, 'up')
  ]);

  // Wait for both requests to complete
  await page1.waitForTimeout(2000);
  await page2.waitForTimeout(2000);

  // Reload to get server state
  await page1.reload();
  const finalCount = await getVoteCount(page1, 1);

  // Verify count increased by exactly 2
  expect(finalCount).toBe(initialCount + 2); // Not +1 due to race!

  await context1.close();
  await context2.close();
});

test('vote count matches actual votes in database', async ({ page }) => {
  await login(page, 'admin');

  // Cast several votes
  await vote(page, 1, 'up');
  await vote(page, 1, 'down'); // Changes vote
  await vote(page, 1, 'down'); // Removes vote (same button)

  await page.waitForTimeout(1000);

  // Verify via API that vote_count matches SUM(votes)
  const response = await page.request.get('/api/forums/replies/1');
  const data = await response.json();

  // Should use database trigger to calculate
  expect(data.data.vote_count).toBeDefined();
});
```

**Acceptance Criteria**:
- ✅ Database trigger maintains vote_count automatically
- ✅ Concurrent votes don't cause drift
- ✅ vote_count always matches SUM(forum_votes)
- ✅ Application code simplified (no manual updates)
- ✅ Race conditions eliminated

---

## Critical Security Gaps Requiring Testing

### Security Gap #1: XSS Prevention Not Tested 🔒

**Severity**: CRITICAL
**Priority**: P0
**Risk**: Code Execution, Session Hijacking
**Test Effort**: 8 hours (10 tests)

**Description**:
Forum accepts user-generated content in titles and replies. While DOMPurify sanitization exists, it has never been tested against real XSS attack vectors.

**Attack Surface**:
- Topic titles (200 char limit)
- Reply content (unlimited, Markdown/HTML)
- Tag names (50 char limit)
- Search queries (reflected in results)

**Test Vectors Required**:
```typescript
// frontend/e2e/forums/security/xss-prevention.spec.ts

const XSS_PAYLOADS = [
  // Script injection
  '<script>alert("XSS")</script>',
  '<script>document.cookie</script>',
  '<script src="https://evil.com/xss.js"></script>',

  // Event handlers
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<body onload=alert(1)>',
  '<div onclick="alert(1)">Click</div>',
  '<input onfocus=alert(1) autofocus>',

  // JavaScript URLs
  '<a href="javascript:alert(1)">Click</a>',
  '<iframe src="javascript:alert(1)">',

  // Data URLs
  '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
  '<iframe src="data:text/html,<script>alert(1)</script>">',

  // CSS injection
  '<style>body { background: url("javascript:alert(1)") }</style>',
  '<div style="background: url(javascript:alert(1))">',

  // Encoded payloads
  '%3Cscript%3Ealert(1)%3C/script%3E',
  '&#60;script&#62;alert(1)&#60;/script&#62;',
  '\u003cscript\u003ealert(1)\u003c/script\u003e',
];
```

**Test Plan**:
1. **Topic Title XSS** (2 tests)
   - Submit XSS payload in title
   - Verify script tags removed/escaped

2. **Reply Content XSS** (3 tests)
   - Submit XSS in reply content
   - Verify event handlers removed
   - Verify JavaScript URLs blocked

3. **Tag Name XSS** (1 test)
   - Submit XSS in tag name
   - Verify sanitization

4. **Search Reflected XSS** (2 tests)
   - Submit XSS in search query
   - Verify results don't execute script

5. **Nested/Complex XSS** (2 tests)
   - Test nested tags
   - Test encoded payloads

**Acceptance Criteria**:
- ✅ No XSS payloads execute in browser
- ✅ All malicious scripts removed/escaped
- ✅ Safe HTML/Markdown preserved
- ✅ No console errors from sanitization

---

### Security Gap #2: SQL Injection Prevention Not Tested 🔒

**Severity**: CRITICAL
**Priority**: P0
**Risk**: Database Compromise, Data Breach
**Test Effort**: 4 hours (5 tests)

**Description**:
Forum uses parameterized queries, but SQL injection prevention has never been tested. FTS5 search queries are particularly concerning.

**Attack Surface**:
- Search query parameter
- Category filter parameter
- Topic ID in URLs
- Tag filters

**Test Vectors Required**:
```typescript
// frontend/e2e/forums/security/sql-injection.spec.ts

const SQL_INJECTION_PAYLOADS = [
  // Basic injection
  "' OR 1=1--",
  "' OR 'a'='a",
  "admin'--",

  // Union-based
  "' UNION SELECT * FROM users--",
  "' UNION SELECT id, password FROM auth.users--",

  // Stacked queries
  "'; DROP TABLE forum_topics;--",
  "'; DELETE FROM forum_replies WHERE 1=1;--",

  // Time-based blind
  "' AND SLEEP(5)--",
  "' OR BENCHMARK(10000000, MD5('A'))--",
];
```

**Test Plan**:
1. **Search Query Injection** (2 tests)
   - Submit SQL injection in search
   - Verify no database error
   - Verify safe query execution

2. **Filter Parameter Injection** (2 tests)
   - Inject into category filter
   - Inject into tag filter

3. **FTS5 Specific Injection** (1 test)
   - Test FTS5 syntax injection
   - Verify MATCH clause safety

**Acceptance Criteria**:
- ✅ All SQL injections safely handled
- ✅ No database errors exposed
- ✅ No unauthorized data access
- ✅ Parameterized queries used correctly

---

### Security Gap #3: Authorization Bypass Not Tested 🔒

**Severity**: CRITICAL
**Priority**: P0
**Risk**: Unauthorized Access, Privilege Escalation
**Test Effort**: 12 hours (15 tests)

**Description**:
Permission checks exist in the code, but comprehensive authorization testing has never been performed. API routes may be vulnerable to bypass.

**Attack Surface**:
- Direct API calls bypassing UI
- Permission checks on all CRUD operations
- Role-based access control
- Hidden category access

**Permission Matrix to Test**:

| Action | Anonymous | User | Moderator | Admin | Expected Result |
|--------|-----------|------|-----------|-------|-----------------|
| View public topic | ✅ | ✅ | ✅ | ✅ | 200 OK |
| View hidden topic | ❌ | ❌ | ❌ | ✅ | 404 / 200 |
| Create topic | ❌ | ✅ | ✅ | ✅ | 401 / 200 |
| Edit own topic | ❌ | ✅ | ✅ | ✅ | 401 / 200 |
| Edit others' topic | ❌ | ❌ | ✅ | ✅ | 401/403 / 200 |
| Delete own topic | ❌ | ✅ | ✅ | ✅ | 401 / 200 |
| Delete others' topic | ❌ | ❌ | ✅ | ✅ | 401/403 / 200 |
| Lock topic | ❌ | ❌ | ✅ | ✅ | 401/403 / 200 |
| Pin topic | ❌ | ❌ | ✅ | ✅ | 401/403 / 200 |
| Vote on reply | ❌ | ✅ | ✅ | ✅ | 401 / 200 |
| Vote on own reply | ❌ | ❌ | ❌ | ❌ | 403 |

**Test Plan**:
```typescript
// frontend/e2e/forums/security/authorization.spec.ts

test('anonymous user cannot create topic', async ({ request }) => {
  const response = await request.post('/api/forums/topics', {
    data: { title: 'Test', content: 'Test', category_id: 1 }
  });
  expect(response.status()).toBe(401);
});

test('user cannot edit another user\'s topic', async ({ page }) => {
  await login(page, 'user1');

  // user2 created topic ID 123
  const response = await page.request.patch('/api/forums/topics/123', {
    data: { title: 'Hacked' }
  });
  expect(response.status()).toBe(403);
});

test('user cannot perform moderator actions', async ({ page }) => {
  await login(page, 'regularuser');

  const lockResponse = await page.request.post('/api/forums/topics/1/lock');
  expect(lockResponse.status()).toBe(403);

  const pinResponse = await page.request.post('/api/forums/topics/1/pin');
  expect(pinResponse.status()).toBe(403);
});

test('non-admin cannot access hidden categories', async ({ page }) => {
  await login(page, 'regularuser');

  const response = await page.request.get('/api/forums/categories/admin-only');
  expect(response.status()).toBe(404); // Not 403 (info leak)
});
```

**Acceptance Criteria**:
- ✅ All permission checks enforced
- ✅ No bypass via direct API calls
- ✅ Proper HTTP status codes (401/403/404)
- ✅ Role-based access working correctly

---

## Action Plan

### Week 1: Security Testing & Bug Fixes

**Day 1-2** (16 hours):
- ✅ Complete this P0 document
- ✅ Set up test infrastructure
- Build helper functions
- Build page object models

**Day 3-4** (16 hours):
- Implement XSS prevention tests (10 tests)
- Implement SQL injection tests (5 tests)
- Implement authorization tests (15 tests)

**Day 5** (8 hours):
- Implement CSRF tests (3 tests)
- Implement rate limiting tests (2 tests)
- Fix all 4 confirmed bugs

### Week 2: Core Functionality Testing

**Day 1-3** (24 hours):
- Voting system tests (12 tests)
- Topic CRUD tests (10 tests)
- Reply system tests (10 tests)
- Validation tests (8 tests)

**Day 4-5** (16 hours):
- Run full test suite
- Fix any failures
- Document results
- Final report

---

## Success Metrics

**Bugs Fixed**: 4/4 (100%)
- ✅ Tag filtering
- ✅ Hidden category leak
- ✅ Multiple solutions
- ✅ Vote count drift

**Security Tests**: 35 tests
- XSS prevention: 10 tests
- SQL injection: 5 tests
- Authorization: 15 tests
- CSRF: 3 tests
- Rate limiting: 2 tests

**Core Tests**: 40 tests
- Voting: 12 tests
- Topics: 10 tests
- Replies: 10 tests
- Validation: 8 tests

**Total**: 75 E2E tests (from 15 baseline)

---

**Status**: ✅ P0 Issues Documented
**Last Updated**: February 15, 2026
**Next Steps**: Build test infrastructure and begin security testing
