# Vercel + Neon Deployment Documentation (Archived)

**Archived Date**: November 2, 2025
**Reason**: Project moved to self-hosted Coolify deployment

---

## Why These Docs Are Archived

This directory contains documentation for deploying Veritable Games Platform to **Vercel** (serverless hosting) with **Neon** (cloud PostgreSQL).

The project has shifted to **self-hosted deployment using Coolify** with local PostgreSQL for the following reasons:

1. **Cost Control**: Vercel Pro tier required for production features
2. **Full Control**: Self-hosting provides complete control over infrastructure
3. **No Vendor Lock-in**: Open-source stack (Coolify + PostgreSQL)
4. **Learning Opportunity**: Hands-on experience with server management

---

## Current Deployment Approach

**See**: `docs/deployment/COOLIFY_LOCAL_HOSTING_GUIDE.md`

---

## Contents of This Archive

**Documentation**:
- `VERCEL_SETUP_GUIDE.md` - Vercel project setup steps
- `VERCEL_DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist
- `DEPLOYMENT_RUNBOOK_VERCEL_NEON.md` - Complete deployment runbook
- `NEON_SETUP_GUIDE.md` - Neon PostgreSQL setup
- `NEON_POSTGRESQL_SETUP_GUIDE.md` - Detailed Neon configuration
- `DNS_CONFIGURATION_REFERENCE.md` - DNS setup for custom domain

**Configuration Files**:
- `vercel.json` - Vercel project configuration (build settings, cron jobs, headers)

**GitHub Workflows** (Disabled):
- `.github/workflows/deploy.yml.disabled` - Automated Vercel deployment workflow

---

## If You Need to Use Vercel + Neon

These docs are still valid and can be followed if you decide to:
- Deploy to cloud instead of self-hosting
- Set up a staging environment on Vercel
- Migrate from Coolify back to Vercel

All technical details and environment variable configurations remain accurate as of November 2025.

---

## Migration Path (Coolify → Vercel)

If you ever need to migrate **from Coolify to Vercel**:

1. Export PostgreSQL database from local server
2. Import to Neon using their import tool
3. Follow `VERCEL_SETUP_GUIDE.md`
4. Update environment variables to use Neon connection string
5. Deploy via Vercel dashboard or GitHub integration

**Estimated time**: 2-4 hours
