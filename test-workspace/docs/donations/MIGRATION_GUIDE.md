# Database Migration Guide - Donations System

**IMPORTANT**: Read this guide completely before running any commands.

---

## Prerequisites

- [x] SSH access to server (192.168.1.15)
- [x] PostgreSQL running (veritable-games-postgres container)
- [x] Database: `veritable_games`
- [x] Migration file: `database/migrations/donations-schema.sql`

---

## Step 1: Copy Migration File to Server

From your laptop (or the machine with the migration file):

```bash
# Copy migration to server
scp /home/user/Projects/veritable-games-main/database/migrations/donations-schema.sql \
  user@192.168.1.15:/tmp/donations-schema.sql
```

---

## Step 2: Backup Existing Database (CRITICAL)

```bash
# SSH to server
ssh user@192.168.1.15

# Backup current database
docker exec veritable-games-postgres pg_dump -U postgres -d veritable_games \
  | gzip > ~/backups/veritable_games_pre_donations_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify backup created
ls -lh ~/backups/ | tail -1
# Should show a .sql.gz file with recent timestamp
```

---

## Step 3: Dry Run (Test Migration)

```bash
# Check if donations schema already exists
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\\dn"
# If "donations" schema exists, skip to Step 5 (Verify)

# Test migration (doesn't commit)
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games << 'EOF'
BEGIN;
\i /tmp/donations-schema.sql
ROLLBACK;
EOF

# If no errors, proceed to Step 4
# If errors, STOP and review migration file
```

---

## Step 4: Apply Migration (PRODUCTION)

```bash
# Apply migration
docker exec -i veritable-games-postgres psql -U postgres -d veritable_games < /tmp/donations-schema.sql

# Check for errors
# If "ERROR" appears, immediately restore from backup (see Step 7)
```

---

## Step 5: Verify Migration Success

```bash
# 1. Verify schema exists
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\\dn" | grep donations
# Should output: donations | postgres

# 2. Verify all 7 tables exist
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'donations'
  ORDER BY table_name;
"
# Should output:
#  donation_allocations
#  donations
#  expense_categories
#  expenses
#  funding_goals
#  funding_projects
#  monthly_summaries

# 3. Verify funding projects populated (should be 5)
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT name, slug, is_active
  FROM donations.funding_projects
  ORDER BY display_order;
"
# Should output:
#  NOXII          | noxii          | t
#  AUTUMN         | autumn         | t
#  DODEC          | dodec          | t
#  ON COMMAND     | on-command     | t
#  COSMIC KNIGHTS | cosmic-knights | t

# 4. Verify expense categories (should be 5)
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT name, slug
  FROM donations.expense_categories
  ORDER BY display_order;
"
# Should output:
#  Taxes          | taxes
#  Assets         | assets
#  API Services   | api-services
#  Infrastructure | infrastructure
#  Development    | development

# 5. Verify indexes created
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT indexname
  FROM pg_indexes
  WHERE schemaname = 'donations'
  ORDER BY indexname;
"
# Should show 20+ indexes
```

---

## Step 6: Test API Routes (After Deployment)

```bash
# From laptop or any machine

# 1. Test funding goals endpoint
curl -s https://www.veritablegames.com/api/funding-goals | jq '.success'
# Should output: true

# 2. Test transparency metrics endpoint
curl -s https://www.veritablegames.com/api/transparency/metrics | jq '.success'
# Should output: true

# 3. Test recent donations (should be empty initially)
curl -s https://www.veritablegames.com/api/donations | jq '.success'
# Should output: true
```

---

## Step 7: Rollback (If Something Goes Wrong)

**Only use if migration failed or corrupted data.**

```bash
# SSH to server
ssh user@192.168.1.15

# Find latest backup
ls -lht ~/backups/ | head -5

# Restore from backup (REPLACES ENTIRE DATABASE)
gunzip -c ~/backups/veritable_games_pre_donations_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres -d veritable_games

# Verify restoration
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "\\dn" | grep donations
# Should NOT show donations schema if restoration successful
```

---

## Step 8: Add Environment Variables (Coolify)

After migration is successful:

1. Open Coolify: http://192.168.1.15:8000
2. Navigate to your application
3. Go to Environment tab
4. Add these variables:

```bash
# BTCPay Webhook Secret (generate with: openssl rand -hex 32)
BTCPAY_WEBHOOK_SECRET=your_generated_secret_here

# Stripe API Keys (get from Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_...   # Test mode initially
STRIPE_WEBHOOK_SECRET=whsec_... # From Stripe webhook settings
```

5. Save and trigger redeploy

---

## Step 9: Trigger Deployment

```bash
# From laptop (in veritable-games-main directory)
git add .
git commit -m "Add donations system - Phase 1 complete"
git push origin main

# Wait 3-5 minutes for Coolify to build and deploy

# Verify deployment
docker ps | grep m4s0kwo4kc4oooocck4sswc4
# Should show: Up X seconds (healthy)
```

---

## Troubleshooting

### Error: "schema donations already exists"

**Cause**: Migration was already run.

**Solution**: Skip migration, proceed to Step 5 (Verify).

---

### Error: "relation funding_projects already exists"

**Cause**: Partial migration (schema exists but incomplete).

**Solution**:
```bash
# Drop schema and re-run migration
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  DROP SCHEMA donations CASCADE;
"

# Re-run migration from Step 4
```

---

### Error: "foreign key constraint violation"

**Cause**: Referenced table `content.projects` doesn't have matching rows.

**Solution**:
```bash
# Verify projects exist
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT id, title, slug FROM content.projects
  WHERE slug IN ('noxii', 'autumn', 'dodec', 'on-command', 'cosmic-knights')
  ORDER BY id;
"

# If missing projects, the INSERT at end of migration will fail
# This is OK - manually add projects later or update migration file
```

---

### Error: Container crash-looping after deployment

**Symptoms**: `docker ps` shows container restarting repeatedly.

**Diagnosis**:
```bash
# Check logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100

# Look for TypeScript errors
# Common: Missing imports, type errors
```

**Solution**:
```bash
# Run type-check locally first
cd frontend
npm run type-check

# Fix any errors before pushing
```

---

## Success Criteria

✅ Migration applied without errors
✅ All 7 tables created
✅ 5 funding projects populated
✅ 5 expense categories populated
✅ API endpoints return `success: true`
✅ Container healthy (not restarting)

**If all checks pass, proceed to Phase 2 (BTCPay deployment) or Phase 3 (UI components).**

---

## Cleanup

```bash
# After successful migration, remove temp file
ssh user@192.168.1.15 "rm /tmp/donations-schema.sql"
```

---

**Questions? Check**:
- `docs/donations/IMPLEMENTATION_STATUS.md` - Overall status
- `docs/TROUBLESHOOTING.md` - General troubleshooting
- `docs/database/DATABASE.md` - Database architecture

**Estimated Time**: 15-30 minutes (including verification)
