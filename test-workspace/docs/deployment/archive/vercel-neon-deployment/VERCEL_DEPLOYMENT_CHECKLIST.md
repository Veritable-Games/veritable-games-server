# Vercel Deployment Checklist

**Prerequisites**: Neon PostgreSQL migration complete, Vercel account linked to GitHub

**Estimated Time**: 30-45 minutes

---

## Pre-Deployment Checklist

- [ ] Neon database populated with data
- [ ] TypeScript validation passes: \`npm run type-check\`
- [ ] Build succeeds locally: \`npm run build\`
- [ ] GitHub repository pushed
- [ ] Environment variable values ready

---

## Step 1: Prepare Environment Variables

From \`.env.local\`, copy these values:
- \`DATABASE_URL\` (Neon pooler connection)
- \`DIRECT_URL\` (Neon direct connection)  
- \`SESSION_SECRET\` (64-char hex)
- \`CSRF_SECRET\` (64-char hex)
- \`ENCRYPTION_KEY\` (64-char hex)

---

## Step 2: Create Vercel Project

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Click "Import"

---

## Step 3: Configure Settings

**CRITICAL**: Set Root Directory to \`frontend\`

Settings:
- Framework: Next.js
- Root Directory: \`frontend\` ⚠️
- Build Command: \`npm run build\`
- Output Directory: \`.next\`

---

## Step 4: Add Environment Variables

In Vercel project settings, add:

| Variable | Environment | Notes |
|----------|-------------|-------|
| DATABASE_URL | Production, Preview, Development | Neon pooler |
| DIRECT_URL | Production, Preview, Development | Neon direct |
| SESSION_SECRET | All | 64-char hex |
| CSRF_SECRET | All | 64-char hex |
| ENCRYPTION_KEY | All | 64-char hex |
| NODE_ENV | Production | Set to "production" |
| NEXT_PUBLIC_APP_URL | Production | https://your-app.vercel.app |

---

## Step 5: Deploy

Click "Deploy" and wait 5-10 minutes.

---

## Step 6: Verify

- [ ] Homepage loads
- [ ] Can log in
- [ ] Wiki pages load
- [ ] Forums accessible
- [ ] Projects load

---

## Troubleshooting

**Build fails**: Check root directory = \`frontend\`
**Database errors**: Verify DATABASE_URL
**500 errors**: Check Vercel function logs

---

## Custom Domain (Optional)

1. Add domain in Vercel settings
2. Add DNS records to Squarespace:
   - A record: @ → 76.76.21.21
   - CNAME record: www → cname.vercel-dns.com
3. Update NEXT_PUBLIC_APP_URL

---

**Last Updated**: October 31, 2025
