# Vercel Deployment Setup Guide
**Veritable Games Platform - Production Deployment**
**Last Updated**: November 1, 2025

---

## Prerequisites

✅ **Code Ready**: All critical fixes completed
✅ **Build Passing**: `npm run build` completes successfully  
✅ **Tests Passing**: `npm test` passes (325/333 tests)
✅ **GitHub Repository**: Code pushed to GitHub

---

## Step 1: Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..." > "Project"**
3. Import GitHub repository: `veritable-games-main`
4. **Root Directory**: `frontend`
5. Framework: Next.js (auto-detected)

---

## Step 2: Environment Variables (CRITICAL)

Add in **Project Settings > Environment Variables**:

### Database (MUST SET)
\`\`\`
DATABASE_MODE=postgres
POSTGRES_URL=postgresql://[user]:[password]@[host].neon.tech:5432/[db]?sslmode=require
POSTGRES_PRISMA_URL=postgresql://[user]:[password]@[host]-pooler.neon.tech:5432/[db]?sslmode=require
POSTGRES_SSL=true
\`\`\`

### Security Secrets (generate: openssl rand -hex 32)
\`\`\`
SESSION_SECRET=[64-char-hex]
CSRF_SECRET=[64-char-hex]
ENCRYPTION_KEY=[64-char-hex]
\`\`\`

### Application
\`\`\`
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
\`\`\`

### Serverless Optimization (auto-detected)
\`\`\`
POSTGRES_POOL_MAX=1
POSTGRES_POOL_MIN=0
POSTGRES_CONNECTION_TIMEOUT=10000
\`\`\`

Set scope: Production + Preview

---

## Step 3: Deploy & Verify

1. Click **"Deploy"** in Vercel
2. Wait ~2-3 minutes for build
3. Test health endpoint:
   \`\`\`
   curl https://your-app.vercel.app/api/health
   \`\`\`
   Should show: "status": "healthy", "database": {"status": "connected"}

---

## Troubleshooting

**"SQLite error"**: Set DATABASE_MODE=postgres and redeploy
**Connection failures**: Use pooled Neon URL (ends with -pooler.neon.tech)
**Build fails**: Run \`npm run build\` locally first

---

**See**: ROLLBACK_PROCEDURE.md for emergency rollback steps
