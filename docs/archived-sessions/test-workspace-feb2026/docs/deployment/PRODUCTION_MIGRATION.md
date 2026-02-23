# Production Database Migration Commands

**Date**: November 9, 2025
**Purpose**: Run email verification schema migration on production database
**Environment**: 192.168.1.15 (Production server)

## Prerequisites
- SSH access to production server (user@192.168.1.15)
- Production container is running (m4s0kwo4kc4oooocck4sswc4)
- Latest code has been deployed via Coolify

## Step-by-Step Commands

### 1. SSH into Production Server
```bash
ssh user@192.168.1.15
```

### 2. Verify Container is Running
```bash
docker ps | grep m4s0k
```

**Expected Output**: Should show the container ID `m4s0kwo4kc4oooocck4sswc4` with status "Up"

### 3. Run Database Migration Inside Container
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 node scripts/run-migrations.js
```

**Expected Output**:
```
🚀 Starting migrations...
📦 Running migration: add_email_verification
✓ Migration complete: add_email_verification
✓ All migrations completed successfully!
```

### 4. Verify Migration Success
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 node scripts/verify-email-schema.js
```

**Expected Output**: All email columns, email_logs table, and indexes should be present

### 5. Check Database Health
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 npm run db:health
```

**Expected Output**: Should show "connected" for PostgreSQL

## Troubleshooting

### If Migration Fails

**Check Docker logs**:
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100
```

**Check container environment variables**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep SMTP
docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep DATABASE_URL
```

### If Schema Verification Shows Missing Columns

**Check what columns exist**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 psql $DATABASE_URL -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_schema='users' AND table_name='users'
   AND column_name LIKE 'email%' ORDER BY column_name;"
```

### If email_logs Table Doesn't Exist

**Manually create it**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 psql $DATABASE_URL << 'EOF'
CREATE TABLE IF NOT EXISTS system.email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON system.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON system.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent ON system.email_logs(sent_at DESC);
EOF
```

## Verification Checklist

After running migrations, verify:

- [ ] Migration script ran without errors
- [ ] All 6 email columns exist in users.users table
- [ ] system.email_logs table exists with 10 columns
- [ ] 4 indexes created on email_logs table
- [ ] Database health check shows "connected"
- [ ] No errors in Docker logs related to migration

## ✓ Success Criteria

Migration is successful when:
1. ✅ All migration commands complete without errors
2. ✅ Schema verification shows all tables and columns present
3. ✅ Database health check shows PostgreSQL connected
4. ✅ No error messages in container logs

Once verified, proceed to Step 4: Deploy via Coolify

---

## Quick Copy-Paste Script

If you prefer to run all commands together:

```bash
#!/bin/bash
echo "=== Verifying container ==="
docker ps | grep m4s0k

echo "=== Running migration ==="
docker exec m4s0kwo4kc4oooocck4sswc4 node scripts/run-migrations.js

echo "=== Verifying schema ==="
docker exec m4s0kwo4kc4oooocck4sswc4 node scripts/verify-email-schema.js

echo "=== Checking database health ==="
docker exec m4s0kwo4kc4oooocck4sswc4 npm run db:health

echo "=== Complete ==="
```

Save this as `run-production-migration.sh` and execute:
```bash
bash run-production-migration.sh
```
