# PostgreSQL Setup Checklist

**Quick reference for setting up PostgreSQL on Coolify**

**Time**: 30-50 minutes | **Date**: November 5, 2025

---

## Pre-Flight Check

- [ ] Coolify running at http://192.168.1.15:8000
- [ ] Veritable Games application deployed successfully
- [ ] Have Coolify admin credentials ready
- [ ] Can access application terminal in Coolify

---

## Phase 1: Create Database (5 minutes)

### In Coolify Dashboard

- [ ] Go to Veritable Games project
- [ ] Click "Add Resource" → "Database" → "PostgreSQL"
- [ ] Configure:
  - [ ] Name: `veritable-games-db`
  - [ ] Version: PostgreSQL 15
  - [ ] Database: `veritable_games`
  - [ ] Username: `postgres`
  - [ ] Password: Generate with `openssl rand -base64 32`
  - [ ] Port: 5432
- [ ] Click "Create"
- [ ] Wait for status: "Running" (green)
- [ ] Copy internal connection string

**Connection String Format**:
```
postgresql://postgres:PASSWORD@veritable-games-db:5432/veritable_games
```

---

## Phase 2: Configure Environment (5 minutes)

### In Coolify → Application → Environment Variables

- [ ] Add `DATABASE_MODE=postgres`
- [ ] Add `POSTGRES_URL=postgresql://postgres:PASSWORD@veritable-games-db:5432/veritable_games`
- [ ] Add `POSTGRES_SSL=false`
- [ ] Add `POSTGRES_POOL_MAX=20`
- [ ] Add `POSTGRES_POOL_MIN=2`
- [ ] Add `POSTGRES_IDLE_TIMEOUT=30000`
- [ ] Add `POSTGRES_CONNECTION_TIMEOUT=10000`
- [ ] Verify `NODE_ENV=production` exists
- [ ] Verify security secrets exist (SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY)

### Test Connection (Optional)

- [ ] Go to Application → Terminal
- [ ] Run: `cd frontend && node scripts/test-postgres-connection.js`
- [ ] Verify: "✓ Connection successful"

---

## Phase 3: Run Migrations (20-40 minutes)

### In Coolify → Application → Terminal

**Step 1: Create Schemas** (~30 seconds)
```bash
cd frontend
npm run pg:create-schemas
```
- [ ] Verify: "✓ All schemas created successfully!"
- [ ] Should see: Created 10 schemas (auth, forums, wiki, users, content, library, messaging, system, cache, main)

**Step 2: Migrate Schema** (~2-5 minutes)
```bash
npm run pg:migrate-schema
```
- [ ] Verify: "✓ Schema migration completed!"
- [ ] Should see: "Total tables: 155, Total indexes: 273"

**Step 3: Migrate Data** (~5-30 minutes)
```bash
npm run pg:migrate-data
```
- [ ] Watch progress bars for large tables
- [ ] Verify: "✓ Data migration completed!"
- [ ] Should see: "Total rows migrated: 51,833" (or similar)

---

## Phase 4: Verify Setup (5 minutes)

### Database Health Check

```bash
# Still in Application → Terminal
npm run db:health
```

- [ ] Verify: "Mode: postgres"
- [ ] Verify: "Connection: OK"
- [ ] Verify: All 10 schemas listed with table counts
- [ ] Verify: "✓ All checks passed!"

### Restart Application

- [ ] Go to Application → Actions
- [ ] Click "Restart"
- [ ] Wait for status: "Running"
- [ ] Check logs for "Database mode: postgres"

---

## Phase 5: Test Application (10 minutes)

### Open Application

- [ ] Visit: http://192.168.1.15:3000
- [ ] Verify: Homepage loads

### Test Features

- [ ] **Login**: Log in with existing account
- [ ] **Forums**: View topics, create post
- [ ] **Wiki**: View pages, edit page
- [ ] **Projects**: View project, check gallery
- [ ] **Search**: Test forum search, wiki search
- [ ] **Profile**: View user profile

### Check Logs

- [ ] Go to Application → Logs
- [ ] Verify: No error messages
- [ ] Verify: See "Connected to PostgreSQL"
- [ ] Verify: No "Using SQLite" messages

---

## Success Criteria

✅ All checks must pass:

- [ ] PostgreSQL database status: Running
- [ ] Environment variables configured
- [ ] 10 schemas created
- [ ] 155 tables created
- [ ] 51,833+ rows migrated
- [ ] `npm run db:health` passes
- [ ] Application loads at http://192.168.1.15:3000
- [ ] Can log in successfully
- [ ] Forums work (view, post)
- [ ] Wiki works (view, edit)
- [ ] Projects work (view, gallery)
- [ ] Search works (full-text)
- [ ] No errors in application logs

---

## If Something Goes Wrong

### Rollback to SQLite

1. **In Coolify** → Application → Environment Variables
2. Change: `DATABASE_MODE=sqlite`
3. Restart application
4. Application will use SQLite (data preserved)
5. Fix issue, then retry with `DATABASE_MODE=postgres`

### Common Issues

**Connection refused**:
- Check database is running
- Check connection string format
- Verify password is correct

**Migration fails**:
- Run `npm run pg:cleanup`
- Retry from Step 1 (create schemas)

**App still uses SQLite**:
- Verify `DATABASE_MODE=postgres` is set
- Restart application
- Check logs for database mode

### Get Help

- See: `docs/deployment/COOLIFY_POSTGRESQL_SETUP.md` (full guide)
- Check: Application → Logs (detailed error messages)
- Test: `node scripts/test-postgres-connection.js`

---

## Post-Migration Tasks

### After Confirming Everything Works

- [ ] Set up PostgreSQL backups (see full guide)
- [ ] Monitor performance for 24-48 hours
- [ ] Optional: Remove SQLite files (after 30 days)
- [ ] Optional: Configure pgAdmin for management

---

## Quick Commands Reference

```bash
# All commands run from frontend/ directory in Application Terminal

# Test connection
node scripts/test-postgres-connection.js

# Migration (in order)
npm run pg:create-schemas    # 1. Create schemas
npm run pg:migrate-schema    # 2. Create tables
npm run pg:migrate-data      # 3. Copy data

# Verification
npm run db:health            # Check health

# Emergency reset (DESTRUCTIVE)
npm run pg:cleanup          # Drops all schemas
```

---

## Timeline Estimate

| Phase | Time | Difficulty |
|-------|------|------------|
| Create Database | 5 min | Easy |
| Configure Environment | 5 min | Easy |
| Run Migrations | 20-40 min | Medium |
| Verify Setup | 5 min | Easy |
| Test Application | 10 min | Easy |
| **Total** | **45-65 min** | **Medium** |

---

**Ready to start?** Open Coolify dashboard and begin with Phase 1!

**Full guide**: `docs/deployment/COOLIFY_POSTGRESQL_SETUP.md`

---

**Last Updated**: November 5, 2025
