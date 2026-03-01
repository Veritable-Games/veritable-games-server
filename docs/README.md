# Documentation Index

**All documentation for Veritable Games server organized in one place.**

**Last updated:** March 1, 2026

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

### Veritable Games
- **[veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md](veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md)** - Unified tag system implementation (Nov 2025)
- **[veritable-games/FORENSIC_ANALYSIS_REPORT.md](veritable-games/FORENSIC_ANALYSIS_REPORT.md)** - Forensic analysis of past deployment issues
- **[veritable-games/SCHEMA_OVERRIDE_DIAGNOSIS.md](veritable-games/SCHEMA_OVERRIDE_DIAGNOSIS.md)** - Schema override diagnosis
- **[veritable-games/DEPLOYED_ANARCHIST_TAGS_API.ts](veritable-games/DEPLOYED_ANARCHIST_TAGS_API.ts)** - API endpoint reference code
- **[/home/user/projects/veritable-games/README.md](/home/user/projects/veritable-games/README.md)** - Project resources guide

### Server Management
- **[server/SERVER_PROJECT_INVENTORY.md](server/SERVER_PROJECT_INVENTORY.md)** ⭐ NEW - Complete project inventory (18 projects, ~1.1 TB, includes 3 Godot games, 1 massive Unity project, 60+ website versions)
- **[server/DRIVE_ARCHITECTURE.md](server/DRIVE_ARCHITECTURE.md)** - Dual-drive architecture strategy
- **[server/REPOSITORY_ARCHITECTURE.md](server/REPOSITORY_ARCHITECTURE.md)** - Tool archives & reference materials (5.6GB + 16GB)
- **[server/CONTAINER_TO_GIT_AUTOMATION.md](server/CONTAINER_TO_GIT_AUTOMATION.md)** - Container-to-git workflow automation
- **[server/tmate-setup-guide.md](server/tmate-setup-guide.md)** - Remote access setup

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
├── reference/                               # Technical reference docs
│   ├── architecture.md                      # System architecture
│   ├── troubleshooting.md                   # Troubleshooting guide
│   ├── security-configuration.md            # Security details
│   ├── docker-build.md                      # Build process
│   ├── scripts-guide.md                     # Scripts reference
│   └── dual-machine-workflow.md             # Git workflow
│
├── veritable-games/                         # VG project docs
│   ├── UNIFIED_TAG_SCHEMA_STATUS.md         # Tag system status
│   ├── FORENSIC_ANALYSIS_REPORT.md          # Historical analysis
│   ├── SCHEMA_OVERRIDE_DIAGNOSIS.md         # Schema diagnosis
│   └── DEPLOYED_ANARCHIST_TAGS_API.ts       # API reference
│
├── server/                                  # Server management docs
│   ├── CONTAINER_TO_GIT_AUTOMATION.md       # Container workflow
│   └── tmate-setup-guide.md                 # Remote access
│
├── guides/                                  # User guides
│   └── (user documentation)
│
└── operations/                              # Operational procedures
    └── (runbooks and procedures)
```

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
