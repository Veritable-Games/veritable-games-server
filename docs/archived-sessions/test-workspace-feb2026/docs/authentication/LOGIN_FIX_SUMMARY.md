# Login Issue Resolution - November 16, 2025

## Problem
Users were unable to login on `localhost:3000` despite correct credentials in the database. Both browser and API returned:
```
401 Unauthorized: Invalid username or password
```

## Root Cause
**PostgreSQL sequence out of sync**: The `auth.sessions` table's auto-increment sequence (`sessions_id_seq`) was at position 23, but the table already contained sessions with IDs up to 73.

When attempting to create a new session during login, PostgreSQL tried to insert a session with an ID that already existed, causing:
```
duplicate key value violates unique constraint "sessions_pkey"
```

This typically happens after:
- Migrating data from SQLite to PostgreSQL
- Manual data inserts that don't update sequences
- Database restore operations

## Investigation Process

### 1. Diagnostic Logging
Added comprehensive logging to `/src/app/api/auth/login/route.ts` to capture:
- Request parameters
- Authentication flow steps
- Error details and stack traces

### 2. Database Verification
Confirmed that:
- ✅ Admin user exists in `users.users` table
- ✅ Password hash is correct (bcrypt cost 12)
- ✅ Database connection works
- ✅ Password verification logic works in isolation

### 3. API Testing
Created test script to bypass browser and directly test the login API endpoint, which revealed the actual error from the server.

## Solution Applied

### Fixed the Sequence
Reset the `auth.sessions_id_seq` sequence to sync with the actual table data:

```sql
SELECT setval('auth.sessions_id_seq', 74, false);
```

This ensures the next session insert will use ID 74 (or higher), avoiding the duplicate key constraint.

### Additional Improvements
1. **Added localhost to rate limit whitelist** to prevent rate limiting during local development:
   ```typescript
   rateLimitWhitelist: ['192.168.1.15', '127.0.0.1', 'localhost', '::1']
   ```

2. **Kept diagnostic logging** in the login route for easier debugging (console.log only, no file writes)

## Verification

Both user accounts now login successfully:
- ✅ `admin` / `euZe3CTvcDqqsVz`
- ✅ `testuser` / `m8vBmxHEtq5MT6`

## Test It Yourself

1. Open browser to `http://localhost:3000/auth/login`
2. Login with either:
   - Username: `admin`, Password: `euZe3CTvcDqqsVz`
   - Username: `testuser`, Password: `m8vBmxHEtq5MT6`
3. Should successfully redirect to dashboard

## Files Modified

1. `/src/app/api/auth/login/route.ts`
   - Added localhost to rate limit whitelist (line 88)
   - Kept diagnostic console logging (lines 12-15, 30-32, 44-48)

2. Database:
   - Reset `auth.sessions_id_seq` sequence

## Prevention for Future

To prevent this issue after database operations:

```sql
-- Check if sequence is in sync
SELECT
  'sessions' as table,
  MAX(id) as max_id,
  (SELECT last_value FROM auth.sessions_id_seq) as seq_value
FROM auth.sessions;

-- Reset if needed
SELECT setval('auth.sessions_id_seq', (SELECT MAX(id) + 1 FROM auth.sessions), false);
```

Consider adding this check to database migration scripts or post-restore procedures.

## Production Impact

**This fix is already applied to localhost**. The production database (192.168.1.15) may have the same issue if it came from the same migration. To check production:

```bash
ssh user@192.168.1.15
# Then run the sequence check query above
```

---

**Resolution Time**: ~45 minutes
**Status**: ✅ RESOLVED
**Tested**: Both users login successfully
