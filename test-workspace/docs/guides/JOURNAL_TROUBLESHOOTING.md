# Journal Operations Troubleshooting Guide

**Last Updated**: November 8, 2025
**Category**: Troubleshooting Guide
**Keywords**: journals, deletion, creation, errors

---

## Quick Troubleshooting Matrix

| Symptom | Status Code | Root Cause | Solution |
|---------|-------------|-----------|----------|
| "Failed to delete journals" | 403 | User doesn't own journal | Check `created_by` matches user ID |
| "Some journals not found" | 404 | Journal IDs don't exist | Verify IDs in database |
| "Failed to create journal" | 500 | WikiService error | Check wiki schema and permissions |
| "Invalid journal IDs" | 400 | Empty or non-array input | Ensure journalIds is non-empty array |
| Console: "Parameter count mismatch" | N/A | Placeholder/param count differs | Check SQL placeholder format |

---

## Common Issues & Solutions

### Issue 1: Journal Deletion Returns 403 Forbidden

#### Symptoms
- User clicks delete on journal
- Dialog confirms deletion
- Request fails with 403 error
- Message: "You can only delete your own journals"

#### Root Causes

**Cause A: Type Mismatch in `created_by`**
```javascript
// Problem
created_by = "123" (string from database)
user.id = 123 (number)
"123" !== 123 → true (fails authorization)
```

**Cause B: NULL `created_by` Value**
```javascript
// Problem
created_by = null
Number(null) = 0
0 !== user.id → true (fails authorization)
```

**Cause C: Wrong User Logged In**
- Journal belongs to user A
- Currently logged in as user B
- Expected behavior: 403 Forbidden

#### Solutions

**For Cause A (Type Mismatch)** ✅ FIXED
- See: `/frontend/src/app/api/journals/bulk-delete/route.ts:72-75`
- Uses string comparison: `String(created_by) === String(user.id)`

**For Cause B (NULL Values)** ✅ FIXED
- See: `/frontend/src/app/api/journals/bulk-delete/route.ts:67-69`
- Explicit check: `if (j.created_by == null) return false;`

**For Cause C (Wrong User)**
- Log out and log in as the correct user
- Check your user ID: Developer Tools Console → check logs for `userId`

#### Verification
1. Open DevTools Console (F12)
2. Attempt deletion
3. Look for `[Journals Delete]` logs
4. Check these specific logs:
   ```
   [Journals Delete] Found journals: { count: 1, journals: [...] }
   [Journals Delete] Ownership check for journal: {
     created_by: ???,
     normalized: '???',
     userId: ???,
     isAuthorized: ???
   }
   ```
5. If `isAuthorized: false`, values don't match

---

### Issue 2: Journal Not Appearing in Sidebar

#### Symptoms
- Journal was created successfully
- Journal doesn't appear in sidebar
- No error message

#### Root Causes
1. Page not refreshed after creation
2. Browser cache issue
3. Journal not being returned by API
4. Wrong namespace (not 'journals')

#### Solutions

**Step 1: Clear Cache & Refresh**
```bash
# Hard refresh in browser
Ctrl+Shift+R  (Windows/Linux)
Cmd+Shift+R   (Mac)
```

**Step 2: Check API Response**
1. Open DevTools Network tab
2. Create a new journal
3. Look for POST `/api/journals` request
4. Check response includes: `{ success: true, data: { id, slug, title, namespace: 'journals' } }`

**Step 3: Verify Database**
```sql
SELECT id, slug, title, namespace
FROM wiki_pages
WHERE namespace = 'journals'
ORDER BY created_at DESC
LIMIT 10;
```

**Step 4: Check Journal Fetching**
1. Open DevTools Console
2. Look for successful journal list fetch
3. Verify journals array includes your new journal

---

### Issue 3: "Parameter Count Mismatch" in Logs

#### Symptoms
```
[DatabaseAdapter] Parameter count mismatch:
Object { placeholders: 0, params: 1 }
```

#### Root Cause
SQL has N placeholders (`?`) but N+1 or N-1 parameters were provided

#### Example
```typescript
// Bad: 1 placeholder but 2 parameters
const query = "SELECT * FROM journals WHERE id = ?";
const params = [123, 456]; // 2 params for 1 placeholder
```

#### Solution
Ensure placeholder count matches parameter count:

```typescript
// Good: 1 placeholder, 1 parameter
const journalIds = [123];
const placeholders = journalIds.map(() => '?').join(','); // produces "?"
const query = `SELECT * FROM journals WHERE id IN (${placeholders})`;
const params = journalIds; // [123]
```

---

### Issue 4: Journal Creation Fails

#### Symptoms
- Click "Add Journal"
- Modal appears
- Submit journal
- Error dialog appears
- Journal not created

#### Root Causes
1. Title validation failed
2. WikiService error
3. Database schema issue
4. User not authenticated

#### Solutions

**Step 1: Check Console for Errors**
```
Open DevTools Console (F12)
Look for error messages like:
- "Cannot call createPage on undefined"
- "Invalid title format"
- "Database connection failed"
```

**Step 2: Verify User is Logged In**
```javascript
// In Console:
// If no error, user is logged in
fetch('/api/journals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Test Journal' })
}).then(r => r.json()).then(console.log);
```

**Step 3: Check WikiService**
- File: `frontend/src/lib/wiki/services/WikiPageService.ts`
- Verify `createPage()` method exists
- Check wiki schema exists in database

**Step 4: Validate Title**
- Must be string (non-empty recommended)
- Max length: depends on schema (usually 255)
- No special characters needed (automatically sanitized)

---

### Issue 5: Multiple Deletions Fail Partially

#### Symptoms
- Select 3 journals for deletion
- Only 2 get deleted
- 1 remains but no error shown

#### Root Causes
1. Third journal has different `created_by` value
2. Third journal was deleted by another user
3. Database constraint violation

#### Solutions

**Step 1: Check Console Logs**
```
[Journals Delete] Authorization check for journal: {
  journalId: 789,
  created_by: 2,      ← Different user!
  userId: 1,
  isAuthorized: false
}
```

**Step 2: Filter Selection**
- Don't mix journals from different users
- Select only journals you created

**Step 3: Verify Database Consistency**
```sql
SELECT id, slug, created_by, created_at
FROM wiki_pages
WHERE id IN (123, 456, 789)
ORDER BY created_by;
```

---

## Debug Procedures

### Enable Full Logging

**Browser Console Filter**:
```javascript
// Show only journal deletion logs
console.log = (function(log) {
  return function() {
    const msg = Array.from(arguments).join(' ');
    if (msg.includes('[Journals Delete]')) {
      log.apply(console, arguments);
    }
  };
})(console.log);
```

### Common Log Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `Input validation passed` | Request is valid | ✅ Continue |
| `Query completed, found journals` | Journals found in DB | ✅ Continue |
| `Authorization check passed` | All journals belong to user | ✅ Continue |
| `Delete successful` | Deletion completed | ✅ Success |
| `Authorization failed` | User doesn't own journals | ❌ Stop & check ownership |
| `Not all journals found` | Some journal IDs missing | ❌ Stop & verify IDs |
| `Parameter count mismatch` | SQL error | ❌ Check code |

### Manual Testing with curl

```bash
# Get CSRF token first
curl http://localhost:3000 -i | grep csrf_token

# Create journal
curl -X POST http://localhost:3000/api/journals \
  -H "Content-Type: application/json" \
  -b "csrf_token=YOUR_TOKEN" \
  -d '{"title":"Test Journal"}'

# Delete journal
curl -X DELETE http://localhost:3000/api/journals/bulk-delete \
  -H "Content-Type: application/json" \
  -b "csrf_token=YOUR_TOKEN" \
  -d '{"journalIds":[123]}'
```

---

## When to Contact Support

If after trying all solutions above:

1. ✅ Check: [JOURNAL_DELETION_FIX.md](../JOURNAL_DELETION_FIX.md) for detailed fix info
2. ✅ Check: [DATABASE.md](../DATABASE.md) for schema details
3. ✅ Check: [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) for db access patterns
4. ❌ Still failing? Collect:
   - Full console output with `[Journals Delete]` logs
   - HTTP response body from failed request
   - Database query results for affected journals
   - User ID and journal IDs involved

---

## Related Resources

- **Main Fix Documentation**: [JOURNAL_DELETION_FIX.md](../JOURNAL_DELETION_FIX.md)
- **Database Architecture**: [DATABASE.md](../DATABASE.md)
- **API Reference**: [api/README.md](../api/README.md)
- **Critical Patterns**: [architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)
- **Common Pitfalls**: [COMMON_PITFALLS.md](../COMMON_PITFALLS.md)

---

## Changelog

| Date | Issue | Status | Notes |
|------|-------|--------|-------|
| 2025-11-08 | Journal deletion returns 403 | ✅ FIXED | Type mismatch + NULL handling |
| 2025-11-08 | Poor error messages | ✅ FIXED | Now shows actual API error |
| 2025-11-08 | No logging | ✅ FIXED | Comprehensive logging added |

---

**Last Updated**: November 8, 2025
**Maintainer**: Claude Code
**Status**: Active & Current
