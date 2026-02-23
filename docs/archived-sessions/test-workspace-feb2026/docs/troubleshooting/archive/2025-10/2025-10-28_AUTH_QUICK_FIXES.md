# Auth System - Quick Fix Guide

**Problem**: Cannot login as admin or test user

**Root Causes Identified**:
1. Admin password unknown (test credentials in UI may not match database)
2. JSON parse error on API calls
3. Users split across two databases (auth.db has 2 users, users.db has 19 users)

---

## 🚀 Immediate Fixes (5 minutes)

### Step 1: Reset Admin Password

```bash
cd frontend
node reset-admin-password.js
```

**Output**:
```
✅ ADMIN PASSWORD RESET SUCCESSFUL

📋 Login Credentials:
   Username: admin
   Password: Admin123!

🌐 Login URL:
   http://localhost:3001/auth/login
```

### Step 2: Test Login

1. Open browser: http://localhost:3001
2. Should redirect to: http://localhost:3001/auth/login
3. Enter credentials:
   - Username: `admin`
   - Password: `Admin123!`
4. Click "Login"

**If successful**: You'll be redirected to the homepage (stellar viewer)

**If JSON parse error**:
- Open DevTools (F12) → Console tab
- Copy the error message
- Open Network tab → Find failed request (red)
- Click it → Response tab
- Screenshot the response
- Report back with details

### Step 3: Fix Database Inconsistency

Once logged in as admin, consolidate all users into auth.db:

```bash
cd frontend
node consolidate-users.js
```

This migrates 17 orphaned users from users.db → auth.db so they can login.

### Step 4: Create Invitation Tokens

To allow new user registration:

```bash
cd frontend
node create-invitation-token.js
```

Copy the token and use it when registering new users at `/auth/login` (Create Account tab).

---

## 🐛 Debugging JSON Parse Error

If you encounter: `JSON.parse: unexpected character at line 1 column 1`

**Cause**: API route returning HTML error page instead of JSON

**Debug Steps**:

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Attempt login**
4. **Find failed request** (shows as red)
5. **Click the request**
6. **Check Response tab**

**Common Scenarios**:

| Response Contains | Likely Cause | Fix |
|-------------------|--------------|-----|
| `<!DOCTYPE html>` | Next.js error page | Check server console for errors |
| Empty response | Route crashed before sending response | Check server console |
| `<html>` | 500 error rendered as HTML | Add try-catch to route |
| Plain text error | Error thrown before JSON.stringify | Wrap in errorResponse() |

**Fix in API route**:

```typescript
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Your logic here
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[API] Error:', error); // Check server logs
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
});
```

---

## 📊 Database State

**Before Consolidation**:

| Database | Users | Can Login? |
|----------|-------|------------|
| auth.db | 2 | ✅ Yes |
| users.db | 19 | ❌ No |

**After Consolidation**:

| Database | Users | Can Login? |
|----------|-------|------------|
| auth.db | 21 | ✅ Yes |
| users.db | 19 | ⚠️ Archived (not used) |

---

## 🔧 Scripts Reference

### reset-admin-password.js

**What it does**:
- Sets admin password to `Admin123!`
- Updates password_hash in auth.db
- Displays login credentials

**When to use**:
- Can't remember admin password
- Need immediate admin access
- Initial system setup

### create-invitation-token.js

**What it does**:
- Generates 64-character hex token
- Inserts into invitations table
- Expires in 7 days
- Single use

**When to use**:
- Can't access admin panel yet
- Need to register test users
- Want to invite new users

### consolidate-users.js

**What it does**:
- Finds users in users.db not in auth.db
- Migrates them to auth.db with all data
- Preserves IDs, roles, passwords
- Runs in transaction (safe)

**When to use**:
- After initial admin login
- When users can't login
- Before PostgreSQL migration

---

## ✅ Verification Checklist

After running fixes:

- [ ] Admin can login with `Admin123!`
- [ ] No JSON parse errors on login
- [ ] Redirected to homepage after login
- [ ] Can access `/admin` panel
- [ ] Can create invitation tokens
- [ ] New users can register with tokens
- [ ] All 21 users can now login

---

## 🆘 If Still Having Issues

**Collect this information**:

```bash
# 1. Check server is running
curl http://localhost:3001/api/health

# 2. Check database state
node check-auth.js

# 3. Check environment
cat .env.local | grep -E "(NODE_ENV|DATABASE|MAINTENANCE)"

# 4. Check logs
# Look in terminal where server is running for errors
```

**Then**:
1. Screenshot any errors in browser console
2. Screenshot failed API requests in Network tab
3. Copy server console output
4. Report back with details

---

## 📚 Next Steps

After admin access is working:

1. ✅ Change admin password via `/settings`
2. ✅ Create invitation tokens via `/admin`
3. ✅ Test user registration flow
4. ✅ Verify all features accessible
5. ⏳ Continue PostgreSQL migration

See `AUTH_ARCHITECTURE_ANALYSIS.md` for complete architectural details.
