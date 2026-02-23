# Authentication Service Code Patches

**Date:** 2025-11-10 **File:** `src/lib/auth/service.ts`

## Patches to Apply

### Patch 1: Add last_login_at Tracking (REQUIRED)

**Location:** After password verification succeeds (around line 209)

**Current code (approximately):**

```typescript
// Verify password
const isValid = await safePasswordVerify(password, userRow.password_hash);

if (!isValid) {
  throw new Error('Invalid credentials');
}

// Create session
return await this.createSession(userRow.id);
```

**New code:**

```typescript
// Verify password
const isValid = await safePasswordVerify(password, userRow.password_hash);

if (!isValid) {
  throw new Error('Invalid credentials');
}

// ✨ NEW: Update login tracking
await dbAdapter.query(
  `UPDATE users
   SET last_login_at = NOW(),
       last_active = NOW(),
       login_count = COALESCE(login_count, 0) + 1,
       updated_at = NOW()
   WHERE id = $1`,
  [userRow.id],
  { schema: 'users' }
);

// Create session
return await this.createSession(userRow.id);
```

---

### Patch 2: OPTIONAL - Change Schema to auth.users

If you decide to use `auth.users` as authoritative instead of syncing password
hashes, apply this patch:

**Location:** User lookup query (around line 168-173)

**Current code:**

```typescript
const userResult = await dbAdapter.query(
  `SELECT * FROM users
   WHERE (username = $1 OR email = $1) AND is_active = true`,
  [username],
  { schema: 'users' } // ← Queries users.users
);
```

**New code:**

```typescript
const userResult = await dbAdapter.query(
  `SELECT * FROM users
   WHERE (username = $1 OR email = $1) AND is_active = true`,
  [username],
  { schema: 'auth' } // ← Changed to query auth.users
);
```

**⚠️ Important:** If you apply this patch, you MUST also update the login
tracking patch above to use `{ schema: 'auth' }` instead of
`{ schema: 'users' }`.

---

## How to Apply Patches

### Method 1: Manual Edit (Recommended)

1. **Wait for container to start running** (after adding DATABASE_URL to
   Coolify)

2. **Enter the container:**

   ```bash
   docker exec -it m4s0kwo4kc4oooocck4sswc4 /bin/bash
   ```

3. **Edit the file:**

   ```bash
   vi src/lib/auth/service.ts
   # Or use nano if vi is not available:
   nano src/lib/auth/service.ts
   ```

4. **Find the location** (search for "safePasswordVerify" or "createSession")

5. **Add the login tracking code** between password verification and session
   creation

6. **Save and restart:**

   ```bash
   # Exit container
   exit

   # Restart container or redeploy in Coolify
   ```

### Method 2: Create Patch File

If you want to apply the patch automatically:

1. **Wait for container to be running**

2. **Copy the current file:**

   ```bash
   docker cp m4s0kwo4kc4oooocck4sswc4:/app/src/lib/auth/service.ts ./service.ts.backup
   ```

3. **Edit locally** and apply the patches

4. **Copy back:**

   ```bash
   docker cp ./service.ts m4s0kwo4kc4oooocck4sswc4:/app/src/lib/auth/service.ts
   ```

5. **Restart:**
   ```bash
   docker restart m4s0kwo4kc4oooocck4sswc4
   ```

---

## Testing the Patches

After applying patches:

1. **Test login:**

   ```bash
   curl -X POST https://www.veritablegames.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"YOUR_PASSWORD"}'
   ```

2. **Verify last_login_at updated:**

   ```sql
   docker exec veritable-games-postgres-new psql -U postgres -d veritable_games \
     -c "SELECT username, last_login_at, login_count FROM users.users WHERE username = 'admin';"
   ```

3. **Check application logs:**
   ```bash
   docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep -i "login\|auth"
   ```

---

## Decision Tree: Which Schema to Use?

### Option A: Keep users.users (Easier - Just sync passwords)

- ✅ No code changes needed
- ✅ Existing sessions keep working
- ❌ Less logical naming ("users.users" is redundant)
- **Action:** Run `sync-user-password-hashes.sql` migration
- **Code:** Apply only Patch 1 (last_login_at tracking with `schema: 'users'`)

### Option B: Switch to auth.users (Better long-term)

- ✅ More logical naming
- ✅ Aligns with auth.sessions schema
- ❌ Requires code change
- ❌ May need to update other code that references users
- **Action:** Apply Patch 2 (change schema to 'auth')
- **Code:** Apply Patch 1 with `schema: 'auth'`

**Recommendation:** **Option A** for immediate fix, then plan migration to
Option B later.

---

## Rollback Procedure

If login breaks after applying patches:

1. **Revert code changes:**

   ```bash
   docker cp ./service.ts.backup m4s0kwo4kc4oooocck4sswc4:/app/src/lib/auth/service.ts
   docker restart m4s0kwo4kc4oooocck4sswc4
   ```

2. **Check logs:**

   ```bash
   docker logs m4s0kwo4kc4oooocck4sswc4 --tail 200
   ```

3. **Verify database connection:**
   ```bash
   docker exec m4s0kwo4kc4oooocck4sswc4 env | grep DATABASE
   ```

---

## Complete Implementation Checklist

- [ ] Add `DATABASE_URL` to Coolify environment variables
- [ ] Wait for container to start and stay running
- [ ] Run `sync-user-password-hashes.sql` to sync passwords
- [ ] Apply Patch 1 (last_login_at tracking) to `src/lib/auth/service.ts`
- [ ] Restart application container
- [ ] Test login with admin credentials
- [ ] Verify `last_login_at` updates in database
- [ ] Run `cleanup-orphaned-sessions.sql` to clean up old sessions
- [ ] Monitor application logs for errors
- [ ] Document the password for admin user

---

## Support Files Created

1. `AUTHENTICATION_FIX_GUIDE.md` - Comprehensive guide to all issues and fixes
2. `sync-user-password-hashes.sql` - SQL to sync passwords between schemas
3. `cleanup-orphaned-sessions.sql` - SQL to clean up old sessions
4. `auth-service-code-patches.md` - This file (code patches)

All files are in:
`/home/user/veritable-games-migration/frontend/scripts/migrations/`
