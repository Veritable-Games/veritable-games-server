# Forum Delete System - Architecture Analysis

**Date**: 2025-10-12
**Status**: 🔴 **CRITICAL ARCHITECTURAL ISSUES FOUND**

## Executive Summary

The forum delete system has **significant architectural mismatches** between design intent and implementation. The system was designed for soft deletes but implements hard deletes, creating data loss, security issues, and inconsistent behavior.

---

## Critical Issues

### 1. 🔴 **Soft Delete vs Hard Delete Mismatch**

**Problem**: Types define soft delete fields, but repository performs hard deletes.

**Evidence**:
- **Types** (`src/lib/forums/types.ts:161-163`, `212-214`):
  ```typescript
  // Soft delete tracking
  readonly deleted_at: string | null;
  readonly deleted_by: UserId | null;
  ```

- **Implementation** (`src/lib/forums/repositories/topic-repository.ts:357-366`):
  ```typescript
  delete(id: TopicId): Result<boolean, RepositoryError> {
    return this.transaction('deleteTopic', (db) => {
      // Hard delete - PERMANENTLY removes data
      db.prepare('DELETE FROM forum_replies WHERE topic_id = ?').run(id);
      db.prepare('DELETE FROM forum_topics WHERE id = ?').run(id);
      return result.changes > 0;
    });
  }
  ```

**Impact**:
- ✅ Types promise soft deletes (recoverable, audit trail)
- ❌ Code performs hard deletes (permanent, no audit trail)
- **Data loss**: Deleted topics/replies are unrecoverable
- **No audit trail**: Can't track who deleted what or when
- **Type system lies**: TypeScript types don't match runtime behavior

---

### 2. 🔴 **Overly Restrictive Delete Permissions**

**Problem**: Topic authors cannot delete their own topics.

**Evidence** (`src/lib/forums/services/ForumService.ts:800-803`):
```typescript
private async canDeleteTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
  // Only moderators and admins can delete topics
  return await this.isModeratorOrAdmin(userId);
}
```

**Comparison with Edit Permissions** (lines 783-791):
```typescript
private async canEditTopic(userId: UserId, topic: ForumTopic): Promise<boolean> {
  // Author can always edit their own topic
  if (topic.author_id === userId) {
    return true;
  }
  // Moderators and admins can edit any topic
  return await this.isModeratorOrAdmin(userId);
}
```

**Impact**:
- Authors can edit their topics but not delete them
- Inconsistent with standard forum UX (authors usually can delete own content)
- Forces moderator intervention for user mistakes
- UI shows delete button to authors (`canEdit || canModerate`) but will fail with 403

---

### 3. 🔴 **Manual Cascade Deletes (Fragile)**

**Problem**: Reply cascades are manually implemented rather than using database foreign keys.

**Evidence** (`src/lib/forums/repositories/topic-repository.ts:359-360`):
```typescript
// Delete all replies first (if FK not set up)
db.prepare('DELETE FROM forum_replies WHERE topic_id = ?').run(id);
```

**Issues**:
- Comment says "if FK not set up" - suggests uncertainty
- Manual cascade is error-prone
- If transaction fails mid-execution, database could be left in inconsistent state
- Foreign keys would handle this automatically and atomically

**Database Schema Check** (`src/lib/database/pool.ts:46`):
```typescript
// Messaging database cannot enforce FKs due to cross-database references
if (dbName === 'messaging') {
  db.pragma('foreign_keys = OFF');
} else {
  db.pragma('foreign_keys = ON'); // Enabled for forums
}
```

**Contradiction**: Foreign keys are enabled for forums database, yet code manually cascades deletes.

---

### 4. 🟡 **Category Count Management Issues**

**Problem**: Category topic count is decremented in service layer, not database layer.

**Evidence** (`src/lib/forums/services/ForumService.ts:346-347`):
```typescript
// Decrement category topic count
await repositories.categories.decrementTopicCount(topic.category_id);
```

**Issues**:
- If service crashes before this line, count becomes inaccurate
- Not part of the delete transaction
- Count could become negative if called twice
- Should be handled by database triggers for consistency

---

### 5. 🟡 **FTS5 Search Index Consistency**

**Problem**: FTS5 triggers may not properly handle hard deletes.

**Database Triggers** (`src/lib/database/pool.ts:394-398`):
```typescript
CREATE TRIGGER IF NOT EXISTS forum_fts_topic_delete
AFTER DELETE ON forum_topics
BEGIN
  DELETE FROM forum_search_fts WHERE content_id = old.id AND content_type = 'topic';
END;
```

**Analysis**:
- Triggers exist and should work for hard deletes
- ✅ FTS5 will be cleaned up properly
- ❌ But if we switch to soft deletes, triggers won't fire (UPDATE vs DELETE)

---

### 6. 🟡 **No Undo or Recovery**

**Problem**: Deleted content is permanently lost.

**UI Confirmation** (`src/components/forums/TopicPostFooter.tsx:24`):
```typescript
if (!confirm('Are you sure you want to delete this topic? This action cannot be undone.')) {
```

**Impact**:
- Accidental deletions are permanent
- No "trash bin" or grace period
- Moderator mistakes have severe consequences
- Industry standard is 30-day soft delete period

---

### 7. 🟡 **Inconsistent Authorization Check**

**Problem**: Delete button visibility doesn't match backend permissions.

**UI** (`src/components/forums/TopicView.tsx:244`):
```typescript
canDelete={canEdit || canModerate || false}
```

**Backend** (`src/lib/forums/services/ForumService.ts:800-803`):
```typescript
// Only moderators and admins can delete
return await this.isModeratorOrAdmin(userId);
```

**Impact**:
- Authors see delete button but get 403 error
- Poor user experience (confusing error)
- Security through obscurity (UI doesn't enforce backend rules)

---

## Architectural Recommendations

### Option A: Implement Proper Soft Deletes (RECOMMENDED)

**Why**: Matches type definitions, provides audit trail, allows recovery.

**Changes Required**:
1. **Repository Layer** - Update delete methods:
   ```typescript
   delete(id: TopicId, userId: UserId): Result<boolean, RepositoryError> {
     return this.execute('deleteTopic', (db) => {
       const result = db.prepare(`
         UPDATE forum_topics
         SET deleted_at = CURRENT_TIMESTAMP,
             deleted_by = ?
         WHERE id = ?
       `).run(userId, id);
       return result.changes > 0;
     });
   }
   ```

2. **Query Filters** - Add `WHERE deleted_at IS NULL` to all topic/reply queries

3. **FTS5 Triggers** - Update to handle soft deletes:
   ```sql
   CREATE TRIGGER forum_fts_topic_soft_delete
   AFTER UPDATE ON forum_topics
   WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
   BEGIN
     DELETE FROM forum_search_fts WHERE content_id = OLD.id;
   END;
   ```

4. **Cleanup Job** - Add cron job to permanently delete after 30 days

**Benefits**:
- ✅ Audit trail (who deleted what when)
- ✅ Recovery possible within grace period
- ✅ Matches type system
- ✅ Industry standard practice

---

### Option B: Fix Hard Delete Implementation

**Why**: Simpler if recovery/audit trail not needed.

**Changes Required**:
1. Remove `deleted_at` and `deleted_by` from types
2. Set up proper foreign key cascades in schema
3. Remove manual cascade code
4. Fix permission checks to allow author deletes
5. Update UI to match backend permissions

**Benefits**:
- ✅ Simpler implementation
- ✅ No query filter overhead
- ✅ Immediate space reclamation

**Drawbacks**:
- ❌ No audit trail
- ❌ No recovery
- ❌ Doesn't match current type definitions

---

## Comparison Table

| Feature | Current (Broken) | Option A (Soft Delete) | Option B (Hard Delete) |
|---------|------------------|------------------------|------------------------|
| **Audit Trail** | ❌ No | ✅ Yes | ❌ No |
| **Recovery** | ❌ No | ✅ 30 days | ❌ No |
| **Type Safety** | ❌ Types lie | ✅ Matches types | ⚠️ Requires type changes |
| **Performance** | ✅ Fast queries | ⚠️ Filter overhead | ✅ Fast queries |
| **Complexity** | ⚠️ Manual cascades | ⚠️ Cleanup job needed | ✅ Simple |
| **Data Loss Risk** | ❌ High | ✅ Low | ❌ High |
| **Author Permissions** | ❌ Can't delete own | ✅ Can delete own | ✅ Can delete own |

---

## Implementation Priority

### Phase 1: Immediate Fixes (Critical)
1. **Fix permission check** - Allow authors to delete own topics
2. **Fix UI visibility** - Match button visibility to actual permissions
3. **Document current behavior** - Update comments to reflect hard delete

### Phase 2: Soft Delete Migration (Recommended)
1. Update repository delete methods to use UPDATE instead of DELETE
2. Add `WHERE deleted_at IS NULL` filters to all queries
3. Update FTS5 triggers for soft deletes
4. Add cleanup job for permanent deletion after 30 days
5. Add admin UI to view/restore deleted content

### Phase 3: Foreign Key Cleanup
1. Verify foreign keys are properly configured in schema
2. Remove manual cascade code if FKs handle it
3. Add tests for cascade behavior

---

## Security Implications

**Current Vulnerabilities**:
1. **Authorization bypass**: Frontend shows delete button to authors who lack permission
2. **No audit trail**: Can't track who deleted what (important for moderation disputes)
3. **Data loss**: Accidental deletions by moderators have no recovery

**Recommendations**:
- Implement soft deletes for audit trail
- Add role-based access logging
- Consider two-factor confirmation for moderator deletes

---

## Testing Gaps

**Missing Test Coverage**:
1. Permission boundary tests (author vs moderator vs admin)
2. Cascade delete tests (replies should be deleted with topic)
3. FTS5 consistency tests (search index cleanup)
4. Transaction rollback tests (partial delete failures)
5. Category count accuracy tests

---

## Related Files

**Core Implementation**:
- `src/lib/forums/services/ForumService.ts` (lines 310-372) - Delete logic
- `src/lib/forums/repositories/topic-repository.ts` (lines 357-366) - Hard delete
- `src/lib/forums/types.ts` (lines 161-163, 212-214) - Soft delete types
- `src/app/api/forums/topics/[id]/route.ts` (lines 114-157) - DELETE endpoint

**UI Components**:
- `src/components/forums/TopicPostFooter.tsx` - Delete button
- `src/components/forums/TopicView.tsx` (line 244) - Permission check

**Database**:
- `src/lib/database/pool.ts` (lines 394-443) - FTS5 triggers

---

## Conclusion

**Current State**: The delete system has a fundamental architectural mismatch between design (soft deletes) and implementation (hard deletes), combined with overly restrictive permissions.

**Recommended Path**: Implement Option A (proper soft deletes) to match type definitions, provide audit trails, and enable recovery. This is the industry standard for user-generated content platforms.

**Quick Win**: Fix permission check to allow authors to delete their own topics (5-line change, immediate UX improvement).

**Risk**: Without soft deletes, permanent data loss from accidental deletions is inevitable.
