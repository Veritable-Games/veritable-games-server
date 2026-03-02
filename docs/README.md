# Documentation Index

**All documentation for Veritable Games server organized in one place.**

**Last updated:** March 2, 2026

---

## 📖 Start Here

- **[CLAUDE.md](/home/user/CLAUDE.md)** - Critical instructions for Claude Code models (READ THIS FIRST)

---

## 🔧 Reference Documentation

**Detailed technical documentation for all aspects of the system.**

### Core System Documentation

- **[architecture.md](reference/architecture.md)** - System architecture, database schemas, data pipeline
- **[troubleshooting.md](reference/troubleshooting.md)** - Common issues and solutions
- **[security-configuration.md](reference/security-configuration.md)** - Security headers, CSP, secrets management
- **[docker-build.md](reference/docker-build.md)** - Docker build process and Nixpacks configuration

### Development Documentation

- **[scripts-guide.md](reference/scripts-guide.md)** - Guide to 80+ utility scripts
- **[dual-machine-workflow.md](reference/dual-machine-workflow.md)** - Server/laptop git workflow

---

## 📦 Project-Specific Documentation

**Documentation organized by project.**

### Veritable Games - Active Workflows
- **[veritable-games/MARXIST_AUDIT_MASTER_WORKFLOW.md](veritable-games/MARXIST_AUDIT_MASTER_WORKFLOW.md)** ✅ COMPLETE - Marxist metadata enrichment (12,728 docs, 100% finished)
- **[veritable-games/MARXIST_AUDIT_SESSION_TRACKING.md](veritable-games/MARXIST_AUDIT_SESSION_TRACKING.md)** - Session-by-session tracking document
- **[veritable-games/YOUTUBE_AUDIT_MASTER_WORKFLOW.md](veritable-games/YOUTUBE_AUDIT_MASTER_WORKFLOW.md)** - YouTube transcript processing workflow
- **[veritable-games/YOUTUBE_AUDIT_SESSION_TRACKING.md](veritable-games/YOUTUBE_AUDIT_SESSION_TRACKING.md)** - YouTube session tracking
- **[veritable-games/LAPTOP_PDF_RECONVERSION_DECEMBER_2025.md](veritable-games/LAPTOP_PDF_RECONVERSION_DECEMBER_2025.md)** - PDF conversion workflow (830 PDFs, 174 xlarge converted)
- **[veritable-games/WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md](veritable-games/WIREGUARD_INCIDENT_RECOVERY_SESSION_MARCH_2_2026.md)** - Network incident analysis and recovery

### Veritable Games - Reference & Historical
- **[veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md](veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md)** - Unified tag system implementation (Nov 2025 - Feb 2026)
- **[veritable-games/FORENSIC_ANALYSIS_REPORT.md](veritable-games/FORENSIC_ANALYSIS_REPORT.md)** - Forensic analysis of past deployment issues
- **[veritable-games/SCHEMA_OVERRIDE_DIAGNOSIS.md](veritable-games/SCHEMA_OVERRIDE_DIAGNOSIS.md)** - Schema override diagnosis
- **[veritable-games/PROCESSING_CLEANUP_GUIDE.md](veritable-games/PROCESSING_CLEANUP_GUIDE.md)** - Processing script organization guide
- **[veritable-games/CONTENT_COLLECTIONS.md](veritable-games/CONTENT_COLLECTIONS.md)** - Collection overview and statistics
- **[veritable-games/LIBRARY_AUDIT_COMPLETION_FEB23_2026.md](veritable-games/LIBRARY_AUDIT_COMPLETION_FEB23_2026.md)** - Library deduplication completion (Feb 23, 2026)
- **[veritable-games/DEPLOYED_ANARCHIST_TAGS_API.ts](veritable-games/DEPLOYED_ANARCHIST_TAGS_API.ts)** - API endpoint reference code
- **[/home/user/projects/veritable-games/README.md](/home/user/projects/veritable-games/README.md)** - Project resources guide

### Deployment Infrastructure
- **[deployment/INFRASTRUCTURE_INVENTORY.md](deployment/INFRASTRUCTURE_INVENTORY.md)** (750 lines) - Complete Docker infrastructure map and container details
- **[deployment/POSTGRES_PRODUCTION_CONFIG.md](deployment/POSTGRES_PRODUCTION_CONFIG.md)** (600 lines) - PostgreSQL configuration, performance tuning, procedures
- **[deployment/VOLUME_BACKUP_STRATEGY.md](deployment/VOLUME_BACKUP_STRATEGY.md)** (650 lines) - Volume backup and disaster recovery procedures

### Server Management
- **[server/SERVER_PROJECT_INVENTORY.md](server/SERVER_PROJECT_INVENTORY.md)** ⭐ COMPLETE - Project inventory (18 projects, ~1.1 TB, includes 3 Godot, 1 Unity, 60+ websites)
- **[server/DRIVE_ARCHITECTURE.md](server/DRIVE_ARCHITECTURE.md)** - Dual-drive (477GB root, 5.5TB /data) architecture and file placement
- **[server/REPOSITORY_ARCHITECTURE.md](server/REPOSITORY_ARCHITECTURE.md)** - Repository organization (5.9GB tools, 16GB reference)
- **[server/CONTAINER_PROTECTION_AND_RECOVERY.md](server/CONTAINER_PROTECTION_AND_RECOVERY.md)** - 🚨 CRITICAL container safety protocols
- **[server/SSH_KEY_SETUP_FEBRUARY_2026.md](server/SSH_KEY_SETUP_FEBRUARY_2026.md)** - SSH authentication setup (ED25519 deploy key, GitHub integration)
- **[server/SSH_KEY_SECURITY_PLAN_2026.md](server/SSH_KEY_SECURITY_PLAN_2026.md)** - SSH key security strategy and rotation procedures
- **[server/CONTAINER_TO_GIT_AUTOMATION.md](server/CONTAINER_TO_GIT_AUTOMATION.md)** - Container-to-git workflow automation
- **[server/RECENT_WORK_DEC_2025.md](server/RECENT_WORK_DEC_2025.md)** - December 2025 storage migration summary (SSD failure recovery)
- **[server/COOLIFY_RESTORATION_NOV27_2025.md](server/COOLIFY_RESTORATION_NOV27_2025.md)** - Coolify restoration after drive failure
- **[server/MONITORING_AND_BACKUP_SYSTEM.md](server/MONITORING_AND_BACKUP_SYSTEM.md)** - Backup and health monitoring setup
- **[server/BTCPAY_DISASTER_RECOVERY_GUIDE.md](server/BTCPAY_DISASTER_RECOVERY_GUIDE.md)** - BTCPayServer disaster recovery
- **[server/BTCPAY_WALLET_BACKUP_CHECKLIST.md](server/BTCPAY_WALLET_BACKUP_CHECKLIST.md)** - Bitcoin wallet backup procedures
- **[server/TOKEN_ROTATION_REQUIRED.md](server/TOKEN_ROTATION_REQUIRED.md)** - ⚠️ Token security and rotation requirements
- **[server/tmate-setup-guide.md](server/tmate-setup-guide.md)** - Remote terminal access setup

---

## 📚 User Guides

**End-user and operator guides.**

- **[guides/](guides/)** - User and operator guides
- **[operations/](operations/)** - Operational procedures and runbooks

---

## 📁 Documentation Structure

```
/home/user/docs/
├── README.md (this file)                    # Documentation index
│
├── deployment/                              # Infrastructure & deployment
│   ├── INFRASTRUCTURE_INVENTORY.md          # Docker infrastructure map
│   ├── POSTGRES_PRODUCTION_CONFIG.md        # Database configuration
│   └── VOLUME_BACKUP_STRATEGY.md            # Backup procedures
│
├── reference/                               # Technical reference docs
│   ├── architecture.md                      # System architecture
│   ├── troubleshooting.md                   # Troubleshooting guide
│   ├── security-configuration.md            # Security details
│   ├── docker-build.md                      # Build process
│   ├── scripts-guide.md                     # Scripts reference
│   └── dual-machine-workflow.md             # Git workflow
│
├── veritable-games/                         # VG project docs (30+ files)
│   ├── MARXIST_AUDIT_MASTER_WORKFLOW.md     # ✅ COMPLETE audit workflow
│   ├── YOUTUBE_AUDIT_MASTER_WORKFLOW.md     # YouTube processing
│   ├── LAPTOP_PDF_RECONVERSION_*.md         # PDF conversion (active)
│   ├── WIREGUARD_INCIDENT_RECOVERY_*.md     # Network incident (Mar 2)
│   ├── UNIFIED_TAG_SCHEMA_STATUS.md         # Tag system implementation
│   ├── FORENSIC_ANALYSIS_REPORT.md          # Historical analysis
│   ├── SCHEMA_OVERRIDE_DIAGNOSIS.md         # Schema diagnosis
│   ├── PROCESSING_CLEANUP_GUIDE.md          # Script organization
│   ├── CONTENT_COLLECTIONS.md               # Collection overview
│   ├── LIBRARY_AUDIT_COMPLETION_*.md        # Deduplication completion
│   └── [Session logs, technical analysis, reference docs]
│
├── server/                                  # Server management docs (20+ files)
│   ├── SERVER_PROJECT_INVENTORY.md          # Project inventory
│   ├── DRIVE_ARCHITECTURE.md                # Storage architecture
│   ├── REPOSITORY_ARCHITECTURE.md           # Repo organization
│   ├── CONTAINER_PROTECTION_AND_RECOVERY.md # 🚨 Container safety
│   ├── SSH_KEY_SETUP_FEBRUARY_2026.md       # SSH authentication
│   ├── SSH_KEY_SECURITY_PLAN_2026.md        # Key security
│   ├── CONTAINER_TO_GIT_AUTOMATION.md       # Container workflow
│   ├── RECENT_WORK_DEC_2025.md              # Storage migration
│   ├── COOLIFY_RESTORATION_*.md             # Coolify recovery
│   ├── MONITORING_AND_BACKUP_SYSTEM.md      # Monitoring setup
│   ├── TOKEN_ROTATION_REQUIRED.md           # ⚠️ Token security
│   ├── BTCPAY_DISASTER_RECOVERY_*.md        # Recovery guides
│   ├── tmate-setup-guide.md                 # Remote access
│   └── [Incident reports, logs, historical docs]
│
├── guides/                                  # User guides
│   └── (user documentation)
│
└── operations/                              # Operational procedures
    └── (runbooks and procedures)
```

**Note**: `server/` and `veritable-games/` contain 45+ historical session logs beyond active reference docs listed above.

---

## 🗂️ Project Organization

### Root Directory Structure

```
/home/user/
├── projects/                    # Project organization
│   └── veritable-games/        # VG project
│       ├── site/               # VG production repository
│       └── resources/          # VG project resources
│           ├── data/           # Literature archives (3.1GB)
│           ├── scripts/        # Import scripts
│           ├── sql/            # Migrations
│           ├── logs/           # Script logs
│           └── docker-compose.yml  # Local DB
├── backups/                    # Database backups, configs, scripts
├── docs/                       # All documentation (you are here)
│   ├── veritable-games/
│   ├── server/
│   └── reference/
└── CLAUDE.md                   # Critical instructions for Claude
```

See `/home/user/projects/README.md` for detailed project organization guidelines.

---

## 🚀 Quick Reference

### Common Tasks

**Deploy changes:**
```bash
cd /home/user/projects/veritable-games/site
git add .
git commit -m "message"
git push origin main
coolify deploy by-uuid m4s0kwo4kc4oooocck4sswc4
```

**Database operations:**
```bash
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games
```

**Check logs:**
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100
```

### Critical Information

- **Application Container ID:** `m4s0kwo4kc4oooocck4sswc4`
- **Database Container:** `veritable-games-postgres`
- **Production URL:** https://www.veritablegames.com
- **Coolify UI:** http://192.168.1.15:8000

---

## 📝 Contributing to Documentation

**When creating new documentation:**

1. **Project-specific docs** → Add to `/home/user/docs/project-name/`
2. **Server management docs** → Add to `/home/user/docs/server/`
3. **Reference documentation** → Add to `/home/user/docs/reference/`
4. **User guides** → Add to `/home/user/docs/guides/`
5. **Operational procedures** → Add to `/home/user/docs/operations/`
6. **Update this index** → Add link to appropriate section above

**Documentation standards:**
- Use clear, descriptive filenames
- Include "Last updated" date at top of document
- Reference related documentation with links
- Include code examples where appropriate
- Keep CLAUDE.md concise - move details to reference docs
- Organize by project when documentation is project-specific

---

## 🔗 External Resources

- **GitHub Repository:** https://github.com/Veritable-Games/veritable-games-site
- **Next.js Documentation:** https://nextjs.org/docs
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **Docker Documentation:** https://docs.docker.com/
- **Coolify Documentation:** https://coolify.io/docs

---

## 📞 Support

For issues or questions:
1. Check troubleshooting guide: `docs/reference/troubleshooting.md`
2. Review relevant reference documentation
3. Check git history for similar issues
4. Consult CLAUDE.md for critical workflows
