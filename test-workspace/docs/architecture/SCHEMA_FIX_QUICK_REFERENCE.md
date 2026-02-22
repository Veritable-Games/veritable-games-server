# Forum Schema Fix - Quick Reference

**Generated:** 2025-10-12
**Issue:** TypeScript interfaces expect columns that don't exist in database

---

## TL;DR

**Problem:** Missing 8 columns total (4 per table) causing production errors.

**Fix:** Run migration script to add missing columns.

**Time:** 5 minutes to run, automatic backup included.

---

## Quick Fix Command

```bash
# From frontend directory
cd /home/user/Projects/web/veritable-games-main/frontend

# Preview changes (safe)
node scripts/fix-forum-schema-mismatches.js --dry-run

# Apply fix
node scripts/fix-forum-schema-mismatches.js

# Verify
node scripts/inspect-forum-schema.js
```

---

## What's Missing

### forum_topics (4 columns)
```sql
deleted_by INTEGER DEFAULT NULL     -- Who deleted the topic
last_edited_at DATETIME DEFAULT NULL -- When last edited
last_edited_by INTEGER DEFAULT NULL  -- Who last edited
author_id INTEGER                    -- Copy of user_id for TS compatibility
```

### forum_replies (4 columns)
```sql
deleted_by INTEGER DEFAULT NULL     -- Who deleted the reply
last_edited_at DATETIME DEFAULT NULL -- When last edited
last_edited_by INTEGER DEFAULT NULL  -- Who last edited
author_id INTEGER                    -- Copy of user_id for TS compatibility
```

---

## Error Messages This Fixes

```
❌ Error: no such column: deleted_by
❌ Error: no such column: author_id
❌ Error: no such column: last_edited_at
❌ Error: no such column: last_edited_by
```

---

## Migration Details

### What the script does:
1. ✅ Checks which columns are missing
2. ✅ Adds missing columns with proper defaults
3. ✅ Copies `user_id` to `author_id` for existing rows
4. ✅ Verifies all changes applied correctly
5. ✅ Shows before/after stats

### Safety:
- ✅ WAL mode enabled (no locking)
- ✅ Transaction-based (all-or-nothing)
- ✅ Dry-run option to preview changes
- ✅ Automatic verification after migration
- ✅ No data deletion or modification

---

## Verification

After running the migration, verify:

```bash
# Check forum_topics columns
node -e "
const db = require('better-sqlite3')('data/forums.db');
const cols = db.prepare('PRAGMA table_info(forum_topics)').all();
console.log('forum_topics columns:', cols.map(c => c.name).join(', '));
db.close();
"

# Check forum_replies columns
node -e "
const db = require('better-sqlite3')('data/forums.db');
const cols = db.prepare('PRAGMA table_info(forum_replies)').all();
console.log('forum_replies columns:', cols.map(c => c.name).join(', '));
db.close();
"
```

Expected output should include:
- `deleted_by`
- `last_edited_at`
- `last_edited_by`
- `author_id`

---

## Column Details

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `deleted_by` | INTEGER | NULL | User ID who performed soft delete |
| `last_edited_at` | DATETIME | NULL | Timestamp of last edit |
| `last_edited_by` | INTEGER | NULL | User ID who made last edit |
| `author_id` | INTEGER | (user_id) | Matches user_id, for TS compatibility |

---

## Impact

### Before Fix
```typescript
// ❌ These queries fail
const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(1);
console.log(topic.deleted_by);    // undefined → ERROR
console.log(topic.author_id);     // undefined → ERROR
console.log(topic.last_edited_at); // undefined → ERROR
```

### After Fix
```typescript
// ✅ These queries work
const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(1);
console.log(topic.deleted_by);    // null or number
console.log(topic.author_id);     // matches user_id
console.log(topic.last_edited_at); // null or ISO string
```

---

## Rollback (If Needed)

SQLite doesn't support `DROP COLUMN`, so rollback requires:

1. **Option A:** Restore from backup
   ```bash
   cp data/forums.db.backup data/forums.db
   ```

2. **Option B:** Recreate table (complex, not recommended)

**Recommendation:** Test with `--dry-run` first to avoid needing rollback.

---

## Related Files

### Documentation
- `FORUM_SCHEMA_MISMATCH_REPORT.md` - Full detailed analysis
- `SCHEMA_COMPARISON_SUMMARY.md` - Comprehensive comparison
- `SCHEMA_FIX_QUICK_REFERENCE.md` - This file (quick guide)

### Scripts
- `scripts/fix-forum-schema-mismatches.js` - Migration script
- `scripts/inspect-forum-schema.js` - Schema inspection tool
- `scripts/add-forums-soft-delete.js` - Original soft delete migration (incomplete)

### Schema Definitions
- `src/lib/database/pool.ts` (lines 454-658) - Pool schema definition
- `scripts/init-forums-db.js` (lines 197-341) - Init script schema
- `src/lib/forums/types.ts` (lines 96-229) - TypeScript interfaces

---

## FAQ

**Q: Will this break existing code?**
A: No, it adds missing columns that code already expects. It fixes breakage.

**Q: Will this lose data?**
A: No, it only adds columns. Existing data remains untouched.

**Q: Can I undo this?**
A: Yes, restore from backup. But you shouldn't need to - this fixes errors.

**Q: Do I need to restart the server?**
A: No, changes are immediate. But restart recommended to clear any caches.

**Q: What if the script fails?**
A: Transaction-based, so either all changes apply or none do. No partial state.

**Q: Why author_id and user_id?**
A: TypeScript interfaces expect `author_id`, database has `user_id`. Migration adds `author_id` as copy for compatibility.

---

## Timeline

| Step | Time | Command |
|------|------|---------|
| Preview changes | 10 sec | `node scripts/fix-forum-schema-mismatches.js --dry-run` |
| Apply migration | 2-5 sec | `node scripts/fix-forum-schema-mismatches.js` |
| Verify changes | 10 sec | `node scripts/inspect-forum-schema.js` |
| **Total** | **< 1 min** | |

---

## Success Indicators

After running the migration, you should see:

```
✅ SCHEMA FIX COMPLETED SUCCESSFULLY!

Database stats:
  Topics: X (X with author_id)
  Replies: Y (Y with author_id)

forum_topics verification:
  ✅ deleted_by
  ✅ last_edited_at
  ✅ last_edited_by
  ✅ author_id

forum_replies verification:
  ✅ deleted_by
  ✅ last_edited_at
  ✅ last_edited_by
  ✅ author_id
```

---

## Next Steps After Migration

1. ✅ Test topic creation (should work immediately)
2. ✅ Test reply creation (should work immediately)
3. ✅ Test soft delete (now tracks deleted_by)
4. ✅ Implement edit tracking in update endpoints
5. ✅ Update code to prefer `author_id` over `user_id`

---

## Support

**Full Report:** See `FORUM_SCHEMA_MISMATCH_REPORT.md` for detailed analysis

**Summary:** See `SCHEMA_COMPARISON_SUMMARY.md` for complete comparison

**Issues:** If migration fails, check:
1. Database file exists at `data/forums.db`
2. Database is not locked (close other connections)
3. WAL mode is enabled (should be automatic)
