# Deployment Documentation Index

**Master reference for deploying Veritable Games Platform**

**Last Updated**: February 16, 2026
**Status**: ✅ Successfully deployed to production (self-hosted Coolify) + Environment variables guide added
**Deployment Date**: November 5, 2025
**Latest Update**: February 16, 2026 (Environment variables guide added after donation system deployment)

---

## 🎯 Quick Start - Choose Your Path

### Option 1: Self-Hosted with Coolify (Recommended)

**Best for**: Cost control, full infrastructure control, learning experience

**Guide**: [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)

**What you'll get**:
- ✅ Zero monthly hosting costs (electricity only: ~$5-15/month)
- ✅ Full control over hardware and software
- ✅ Local PostgreSQL database (instant latency)
- ✅ No vendor lock-in
- ✅ Auto-deployment from GitHub via Coolify
- ✅ Built-in monitoring and SSL certificates
- ✅ Public access via Cloudflare Tunnel or port forwarding

**Requirements**:
- Ubuntu 22.04/24.04 LTS server (dedicated machine or VM)
- 2 CPU cores, 4GB RAM, 50GB storage
- Static IP or dynamic DNS (for public access)

**Estimated setup time**: 1-2 hours

**Perfect for**:
- 👨‍💻 Learning and development projects
- 🏠 Personal or internal sites
- 💰 Budget-conscious deployments
- 🔧 Those who want complete infrastructure control

---

### Option 2: Cloud Hosting (Archived)

**Note**: Cloud-specific documentation has been archived as the project moved to self-hosted deployment.

**Archived location**: [archive/vercel-neon-deployment/](./archive/vercel-neon-deployment/)

**Still valid for**:
- Setting up cloud staging environments
- Enterprise deployments requiring global CDN
- Teams preferring managed infrastructure
- Migration from self-hosted back to cloud

**Why archived**: Cloud hosting requires paid tiers for production features, project shifted to cost-effective self-hosting.

---

## 📚 Complete Documentation Map

### Deployment Guides

#### ⚠️ CRITICAL: Pre-Deployment Requirements

**[PRE_DEPLOYMENT_CHECKLIST.md](./PRE_DEPLOYMENT_CHECKLIST.md)** - **READ BEFORE EVERY DEPLOY** ⚠️
- **MANDATORY** checklist for all production deployments
- Database schema migration validation
- Production testing requirements
- Common failure scenarios and prevention
- Rollback procedures
- **Created**: February 12, 2026 (after journals/categories incident)
- **Use this**: EVERY TIME before `git push origin main`
- **Incident**: [2026-02-12 Schema Migration Failure](../incidents/2026-02-12-journals-missing-columns.md)

#### Primary Deployment

**[COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)** - **ACTUAL DEPLOYMENT RECORD** ✅
- **This is what actually worked** - deployed November 5, 2025
- Complete step-by-step with real issues and solutions
- Critical configuration: Base Directory, nixpacks.toml
- Build issues encountered and fixes applied
- Environment variables configuration
- TypeScript fixes required
- Deployment success confirmation
- **Read time**: 25 minutes
- **Status**: Production deployment successful
- **Use this guide for**: Understanding the real deployment process, troubleshooting

**[COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)** - GENERAL DEPLOYMENT GUIDE
- Complete self-hosted deployment with Coolify
- Ubuntu installation and setup
- Local PostgreSQL configuration
- GitHub integration and auto-deployment
- Public access setup (Cloudflare Tunnel, Tailscale, port forwarding)
- Backup automation
- Monitoring and maintenance
- Cost analysis and troubleshooting
- **Updated**: November 5, 2025 with critical deployment details
- **Read time**: 20 minutes
- **Setup time**: 1-2 hours
- **Use this guide for**: General reference and planning

#### Database Information

**[POSTGRESQL_MIGRATION_COMPLETE.md](./POSTGRESQL_MIGRATION_COMPLETE.md)**
- PostgreSQL migration completion report
- 155 tables, 51,833 rows successfully migrated
- Data integrity verification results
- Migration statistics and performance metrics

**[DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)**
- Complete system architecture overview
- Database schema organization (10 databases)
- Connection pooling and optimization
- Security considerations

#### Deployment Status & Planning

**[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)**
- Current deployment readiness status
- Feature completeness
- Infrastructure preparation

**[ROLLBACK_PROCEDURE.md](./ROLLBACK_PROCEDURE.md)**
- Emergency rollback steps
- Data recovery procedures
- Backup restoration guide

---

### Supporting Documentation

#### Setup Guides

**[../guides/GITHUB_MCP_SETUP.md](../guides/GITHUB_MCP_SETUP.md)**
- Enable Claude Code to directly access GitHub APIs
- Real-time CI/CD monitoring
- Automated PR management
- **Setup time**: 5-10 minutes

**[../guides/COMMANDS_REFERENCE.md](../guides/COMMANDS_REFERENCE.md)**
- All 80+ npm scripts documented
- Database management commands
- Development and testing commands
- Deployment and production commands

**[../guides/TESTING.md](../guides/TESTING.md)**
- Complete testing guide
- Unit, integration, and E2E testing
- CI/CD pipeline overview

#### Operations & Monitoring

**[COOLIFY_CLI_GUIDE.md](./COOLIFY_CLI_GUIDE.md)** - **NEW** (November 16, 2025)
- Complete Coolify CLI reference
- Deployment automation commands
- Environment variable management
- Installation and configuration
- Troubleshooting common issues

**[COOLIFY_ENVIRONMENT_VARIABLES_GUIDE.md](./COOLIFY_ENVIRONMENT_VARIABLES_GUIDE.md)** - **NEW** (February 16, 2026) ⚠️
- **How environment variables work in Coolify**
- **Critical: Variables load during deployment, not restart**
- Database schema and flags explained
- Complete troubleshooting guide
- Real-world examples from donation system deployment
- Best practices for production variables
- **Read this if**: Variables in database but not loading in container
- **Incident**: [2026-02-16 STRIPE_WEBHOOK_SECRET not loading](../incidents/2026-02-16-stripe-webhook-secret-not-loading.md)

**[PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md](./PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md)** - **LATEST** (December 29, 2025) ✅
- **Complete incident resolution documentation**
- CLAUDE.md restoration (73→404 lines) with Dec 2025 updates
- Coolify deployment issue diagnosis and fix
- Root cause: nixpacks configuration detecting wrong startup command
- **Solution**: Added explicit `[phases.start]` to nixpacks.toml
- Verification steps and current production status
- Prevention strategies for future deployments
- Timeline, key learnings, and critical commands
- **Read this after any deployment issue for reference pattern**

**[DEPLOYMENT_TEST_VERIFICATION_DECEMBER_29_2025.md](./DEPLOYMENT_TEST_VERIFICATION_DECEMBER_29_2025.md)** - **NEW** (December 29, 2025) ✅
- **Complete post-deployment test validation**
- TypeScript type-checking: PASSED (0 errors)
- Jest unit tests: 333 PASSED, 77 FAILED (non-critical godot-router)
- Production build verification: SUCCESSFUL
- Container health check: HEALTHY
- Public domain accessibility: ACCESSIBLE (HTTP 307)
- Performance metrics and response times
- Deployment stability assessment
- **Use this to verify deployment stability after any release**

**[PRODUCTION_SMOKE_TEST_DECEMBER_29_2025.md](./PRODUCTION_SMOKE_TEST_DECEMBER_29_2025.md)** - **LATEST** (December 29, 2025) ✅
- **Production smoke test validation - 11 tests, 0 failures**
- Domain connectivity: ✅ HTTPS responding
- Health endpoint: ✅ healthy (0ms response)
- Database: ✅ Connected and responding
- Security headers: ✅ All present (CSP, HSTS, X-Frame, etc.)
- API endpoints: ✅ Projects and Library responding
- Container health: ✅ Stable and healthy
- Performance: Excellent (avg 19ms response time)
- **Use this to verify production is operational after deployment**

**[COOLIFY_GITHUB_API_DEPLOYMENT_DECEMBER_2025.md](./COOLIFY_GITHUB_API_DEPLOYMENT_DECEMBER_2025.md)** - **NEW** (December 29, 2025)
- **GitHub API "Not Found" error troubleshooting**
- Root cause analysis and verification steps
- Remote server access guide (SSH, WireGuard)
- GitHub token management and refresh procedures
- Coolify configuration verification
- Real-time diagnostics from production server
- **Critical for resolving GitHub integration failures**

**[DECEMBER_2025_DATABASE_DNS_FIX.md](./DECEMBER_2025_DATABASE_DNS_FIX.md)** - **NEW** (December 30, 2025) ✅
- **Docker DNS configuration fix for database connection timeouts**
- Issue: `connect ETIMEDOUT 192.168.1.15:5432` on application startup
- Root cause: DATABASE_URL using host IP instead of Docker DNS
- Solutions: Updated migration script + Coolify environment configuration
- Docker networking concepts and best practices
- Prevention strategies and testing checklist
- Complete diagnostic steps and verification procedures
- **Critical for fixing application startup database connection failures**

**[CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md](./CLAUDE_CODE_PRODUCTION_ACCESS_GUIDE.md)**
- SSH access and credentials
- Docker container operations
- Database operations and backups
- Coolify configuration
- Traefik debugging
- Complete troubleshooting

**[COOLIFY_502_TROUBLESHOOTING.md](./COOLIFY_502_TROUBLESHOOTING.md)** - **NEW** (February 12, 2026)
- **Coolify 502 Bad Gateway troubleshooting when website is still live**
- Network access diagnosis (local network vs VPN)
- Coolify container status verification
- Common causes: OOM, disk space, database corruption, network split-brain
- Resolution steps and prevention strategies
- Quick reference commands for emergency diagnosis
- **Critical for diagnosing Coolify-specific issues while app remains functional**

**[../guides/DUAL_MACHINE_DEVELOPMENT.md](../guides/DUAL_MACHINE_DEVELOPMENT.md)** - **NEW** (November 16, 2025)
- Git workflow for dual-machine development
- SSH key management
- Conflict resolution strategies
- Coolify auto-deployment integration

**[../guides/MACHINE_IDENTIFICATION.md](../guides/MACHINE_IDENTIFICATION.md)** - **NEW** (November 16, 2025)
- Environment detection and configuration
- Machine-specific paths and settings
- Network topology reference

**[../operations/PRODUCTION_OPERATIONS.md](../operations/PRODUCTION_OPERATIONS.md)**
- Health monitoring and metrics
- Incident response procedures
- Database backup and recovery
- Performance troubleshooting
- **Essential for production deployments**

**[../ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md](../ci-cd-documentation/CI_CD_DOCUMENTATION_INDEX.md)**
- GitHub Actions workflows
- Build optimization
- Deployment automation
- CI/CD troubleshooting
- **Central reference for CI/CD operations**

#### Documentation Organization

**[../DOCUMENTATION_REORGANIZATION_COMPLETE.md](../DOCUMENTATION_REORGANIZATION_COMPLETE.md)**
- Complete record of November 2, 2025 reorganization
- What was added, archived, and why
- Database options comparison (Neon vs Local PostgreSQL)
- Impact on CI/CD workflows

---

## 🗺️ Deployment Path Comparison

### Self-Hosted (Coolify) vs Cloud (Vercel + Neon)

| Aspect | Coolify (Self-Hosted) | Cloud Hosting |
|--------|----------------------|---------------------|
| **Monthly Cost** | ~$5-15 (electricity) | $0-40 (free tiers + Pro) |
| **Initial Setup** | 1-2 hours | 30-60 minutes |
| **Control** | Complete | Limited to platform |
| **Scalability** | Manual (upgrade hardware) | Automatic |
| **Maintenance** | Self-managed | Fully managed |
| **Database** | Local PostgreSQL | Cloud PostgreSQL |
| **Latency** | Instant (localhost) | Network dependent |
| **Backups** | Manual (scripted) | Automatic |
| **Learning Value** | High (server management) | Low (abstracted) |
| **Best For** | Personal projects, learning | Production, teams |

---

## 🚀 Quick Start Checklists

### Coolify Self-Hosted Deployment

**Prerequisites**:
- [x] Ubuntu 22.04/24.04 LTS server ready ✅
- [x] SSH access to server ✅
- [x] GitHub repository access ✅
- [x] 1-2 hours available ✅

**Steps** (✅ = Completed November 5, 2025):
1. [x] Install Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash` ✅
2. [x] Access Coolify dashboard: `http://192.168.1.15:8000` ✅
3. [x] Create new application from GitHub ✅
4. [x] **CRITICAL**: Set Base Directory to `frontend` ✅
5. [x] **CRITICAL**: Create nixpacks.toml with build dependencies ✅
6. [x] Configure environment variables ✅
7. [x] Deploy and verify ✅ (Deployed successfully November 5, 2025)
8. [x] Set up local PostgreSQL database ✅ (Completed November 2025 - 50,646 rows migrated)
9. [ ] (Optional) Set up public access via Cloudflare Tunnel

**Status**: Application successfully deployed and running on http://192.168.1.15:3000

**Detailed guides**:
- **For actual deployment steps**: [COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md](./COOLIFY_ACTUAL_DEPLOYMENT_NOVEMBER_2025.md)
- **For general reference**: [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)

---

### Cloud Deployment (Archived)

**Prerequisites**:
- [ ] Cloud platform account
- [ ] PostgreSQL database
- [ ] GitHub repository access
- [ ] 30-60 minutes available

**Steps**:
1. [ ] Create PostgreSQL database
2. [ ] Get POSTGRES_URL connection string
3. [ ] Create cloud project
4. [ ] Configure environment variables
5. [ ] Set root directory to `frontend`
6. [ ] Deploy and verify

**Detailed guide**: See archived documentation in [archive/vercel-neon-deployment/](./archive/vercel-neon-deployment/)

---

## 🔑 Key Deployment Information

### Technology Stack

- **Frontend**: Next.js 15.5.6 + React 19.1.1
- **Backend**: Next.js API routes (App Router)
- **Database**: PostgreSQL 15 (local or Neon)
- **Language**: TypeScript 5.7.2
- **Build Tool**: Turbopack
- **3D Visualization**: Three.js 0.180.0

### Database Architecture

**10 Specialized Databases**:
- `forums` - Forum discussions and topics
- `wiki` - Wiki pages and revisions
- `users` - User profiles and settings
- `auth` - Sessions and authentication
- `content` - Projects, news, workspaces
- `library` - Document management
- `messaging` - Private messaging
- `system` - System configuration
- `cache` - Caching layer (reserved)
- `main` - Legacy archive (read-only)

**Migration Status**: 100% complete (155 tables, 51,833 rows, 0 errors)

### Critical Configuration

**Environment Variables** (`.env.local` or `.env`):
```bash
# Database (choose one)
DATABASE_URL=postgresql://user:pass@localhost:5432/db  # Local PostgreSQL
POSTGRES_URL=postgresql://user:pass@host:port/db       # Cloud PostgreSQL

# Security (generate with: openssl rand -hex 32)
SESSION_SECRET=your-64-char-hex-string
CSRF_SECRET=your-64-char-hex-string
ENCRYPTION_KEY=your-64-char-hex-string

# Node environment
NODE_ENV=production
```

---

## 📊 Documentation Statistics

| Document Type | Count | Total Pages |
|--------------|-------|------------|
| Deployment Guides | 12 | ~150 |
| Architecture Docs | 32 | ~200 |
| Feature Docs | 15 | ~100 |
| Reference Guides | 8 | ~80 |
| **Total** | **67+** | **~530+** |

---

## 🎓 Learning Path for Deployment

**Recommended reading order**:

1. **Start**: This file (you're here!) - Overview of options
2. **Choose your path**:
   - Self-hosted → [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md)
   - Cloud → [archive/vercel-neon-deployment/](./archive/vercel-neon-deployment/)
3. **Understand architecture**: [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md)
4. **Database details**: [../database/DATABASE.md](../database/DATABASE.md)
5. **Reference**: [../../CLAUDE.md](../../CLAUDE.md) - Complete project guide

---

## 📞 Getting Help

### Coolify Deployment Issues

**For Any Deployment Problem**:
- **First**: Read [PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md](./PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md)
- Includes: Real example of nixpacks startup command issue, diagnosis process, and resolution
- Has prevention strategies and critical debugging commands
- Timeline showing how to approach any deployment failure

**GitHub API "Not Found" Error**:
- See: [COOLIFY_GITHUB_API_DEPLOYMENT_DECEMBER_2025.md](./COOLIFY_GITHUB_API_DEPLOYMENT_DECEMBER_2025.md) ⭐ **PRIMARY REFERENCE**
- Includes: GitHub token verification, remote server access, SSH troubleshooting
- Root cause analysis with 6 possible causes and detection methods

**Container Not Starting / Wrong Command Running**:
- See: [PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md](./PRODUCTION_DEPLOYMENT_SUCCESS_DECEMBER_29_2025.md) - Phase 3 section
- Diagnosis: Check docker inspect, container logs, and startup command
- Solution: Verify nixpacks.toml has explicit [phases.start] configuration

**Coolify 502 Error (Website Still Live)**:
- See: [COOLIFY_502_TROUBLESHOOTING.md](./COOLIFY_502_TROUBLESHOOTING.md) ⭐ **PRIMARY REFERENCE**
- Symptoms: Coolify interface shows 502, but main website accessible
- Diagnosis: Network access issues, Coolify container down, or need VPN
- Includes: Quick reference commands, resolution matrix, and prevention strategies

**General Coolify Issues**:
- See: [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md) - Troubleshooting section
- Check: Coolify community docs at https://coolify.io/docs

### GitHub MCP Setup Issues
- See: [../guides/GITHUB_MCP_SETUP.md](../guides/GITHUB_MCP_SETUP.md) - Troubleshooting section

### Database Issues
- See: [../database/DATABASE.md](../database/DATABASE.md)
- See: [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

### General Questions
- Check: [../../CLAUDE.md](../../CLAUDE.md) - Main project guide
- Check: [../COMMON_PITFALLS.md](../COMMON_PITFALLS.md)

---

## 🔄 Migration Between Deployment Methods

### From Coolify to Cloud

1. Export PostgreSQL database: `pg_dump > backup.sql`
2. Import to cloud PostgreSQL database
3. Follow archived cloud setup guide
4. Update environment variables to use cloud connection string
5. Deploy via cloud platform dashboard

**Estimated time**: 2-4 hours

### From Cloud to Coolify

1. Export cloud database: Use cloud provider's export feature
2. Import to local PostgreSQL: `psql < backup.sql`
3. Follow Coolify setup guide
4. Update environment variables to use local PostgreSQL
5. Deploy via Coolify dashboard

**Estimated time**: 1-2 hours

---

## ✨ Deployment Success Criteria

You'll know deployment is successful when:

- [ ] Application accessible at configured URL
- [ ] All 10 database schemas are connected
- [ ] User authentication works (can log in/out)
- [ ] Forum posts can be created and viewed
- [ ] Wiki pages can be created and edited
- [ ] Project galleries display images
- [ ] 3D stellar visualization loads
- [ ] No console errors in browser
- [ ] API routes return expected data
- [ ] SSL certificate is valid (if using HTTPS)

---

## 🚀 Ready to Deploy?

### For Self-Hosted Deployment
**Next step**: Open [COOLIFY_LOCAL_HOSTING_GUIDE.md](./COOLIFY_LOCAL_HOSTING_GUIDE.md) and start with Section 1!

### For Cloud Deployment
**Next step**: Review archived docs at [archive/vercel-neon-deployment/](./archive/vercel-neon-deployment/) for cloud platform setup

---

**This deployment documentation is complete, tested, and ready for production.**

**Primary deployment method**: Self-hosted with Coolify + Local PostgreSQL
**Alternative method**: Cloud hosting with managed PostgreSQL (archived but still valid)

**Last Updated**: February 12, 2026
