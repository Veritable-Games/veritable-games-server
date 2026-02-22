# Emergency Rollback Procedure
**Veritable Games Platform**
**Last Updated**: November 1, 2025

---

## When to Rollback

Trigger rollback immediately if:
- ❌ Error rate > 5% for 5+ minutes
- ❌ `/api/health` returns 503
- ❌ Database connectivity lost
- ❌ Critical feature completely broken
- ❌ Deployment causes data corruption

---

## Quick Rollback (2 minutes)

### Option 1: Deployment Platform Dashboard (FASTEST)

For Coolify:
1. Go to Coolify Dashboard > Deployments
2. Find last successful deployment (✅ green checkmark)
3. Click **"Redeploy"** or **"Rollback"**
4. Verify: Visit `/api/health` - should return 200

For other platforms:
1. Go to platform dashboard > Deployments
2. Find last successful deployment
3. Use platform's rollback feature
4. Verify deployment health

### Option 2: Git Revert + Redeploy

\`\`\`bash
# Find commit to revert to
git log --oneline -10

# Create revert commit
git revert [bad-commit-hash] --no-edit

# Push to trigger auto-deploy
git push origin main
\`\`\`

---

## Database Rollback (PostgreSQL)

### Point-in-Time Recovery (if data corrupted)

For local PostgreSQL:
1. Restore from backup: `psql < backup.sql`
2. Restart application
3. Verify data integrity

For cloud PostgreSQL:
1. Use cloud provider's restore feature
2. Select backup point before corruption
3. Update connection string if needed
4. Restart application

### Restore Time Windows
- Local: Depends on backup frequency
- Cloud: Varies by provider (typically 7-30 days)

---

## Post-Rollback Checklist

After rollback completes:

- [ ] Verify `/api/health` returns 200
- [ ] Test user login
- [ ] Check error logs (should be clear)
- [ ] Monitor for 30 minutes
- [ ] Document what went wrong
- [ ] Create fix plan before attempting redeploy

---

## Rollback Testing

**Test rollback procedure quarterly**:

1. Deploy to preview environment
2. Promote preview to production
3. Immediately rollback to previous
4. Verify process completes < 5 minutes

---

## Emergency Contacts

- **Coolify Support**: https://coolify.io/docs
- **PostgreSQL Support**: https://www.postgresql.org/support/
- **Project Docs**: /docs folder

---

**Generated**: November 1, 2025
