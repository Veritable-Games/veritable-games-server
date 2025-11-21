# Dual-Machine Git Workflow

**Updated:** November 13, 2025 - Simplified workflow, no laptop checkpoint required

## Architecture

```
Server (veritable-games-server) ──┐
  ├── Location: /home/user/projects/veritable-games/site/
  ├── SSH: Direct push to GitHub enabled
  ├── Git: Can commit and push directly     ├──> GitHub (main branch)
  └── Role: Full development access              │
                                                  ↓
Laptop (Development Machine) ──────┘         Coolify
  ├── Location: ~/Projects/veritable-games-main  │
  ├── Git: Can commit and push directly          ↓
  └── Role: Full development access          Production Container
```

## Key Changes from Previous Workflow

**OLD:** Server → Laptop checkpoint → GitHub → Coolify
**NEW:** Server → GitHub → Coolify (direct push enabled)
**NEW:** Laptop → GitHub → Coolify (same workflow)

## Benefits

- ✅ Simpler workflow (no patch files, no scp transfers)
- ✅ Both machines can develop independently
- ✅ Direct GitHub push from server
- ✅ Faster iteration cycle
- ✅ Automatic Coolify deployments on push

## Security Considerations

- ⚠️ Server has write access to GitHub
- ✅ SSH key requires passphrase (mitigates compromise)
- ✅ Server behind firewall (local network only: 192.168.1.15)
- ✅ Deploy key scoped to single repository
- ✅ GitHub branch protection available if needed

## Server Responsibilities

### Full Development Capabilities
- ✅ Code changes (Next.js, React, TypeScript, etc.)
- ✅ Git operations (commit, push to GitHub)
- ✅ Database operations (PostgreSQL migrations, backups)
- ✅ Python script execution (imports, scraping, conversions)
- ✅ Container operations (inspection, logs, debugging)
- ✅ Direct deployment triggering (via GitHub push)

### Server-Specific Operations

**Database Operations:**
- PostgreSQL migrations via `docker exec`
- Database backups and verification
- Creating SQL migration scripts
- Installing triggers, functions, indexes
- Querying database for validation

**Python Script Execution:**
- Tag extraction (`extract_and_import_anarchist_tags.py`)
- Document imports (`import_anarchist_documents_postgres.py`)
- Web scraping (`scrape_marxists_org.py`)
- Format conversion (`convert_anarchist_muse_to_markdown.py`)

**Container Operations:**
- Docker inspection and debugging
- Container log analysis
- Environment variable verification
- Deployed commit verification

**Git Operations (Full Access):**
- Edit files in `/home/user/projects/veritable-games/site/`
- Commit changes
- Push directly to GitHub
- Pull latest changes
- Manage branches

### Critical Rules for Server
- ✅ MUST edit files in git repository (`/home/user/projects/veritable-games/site/`)
- ✅ MUST commit and push to GitHub after changes
- ✅ MUST pull before starting work to avoid conflicts
- ✅ MUST verify database state after operations
- ❌ MUST NOT modify files inside containers (changes are ephemeral)
- ❌ MUST NOT use docker exec to edit files
- ❌ MUST NOT use the archived repository

## Laptop Responsibilities

### Full Development Capabilities
- ✅ Code changes (Next.js, React, TypeScript, etc.)
- ✅ Git operations (commit, push to GitHub)
- ✅ Direct deployment triggering (via GitHub push)
- ⚠️ Limited server access (no SSH, no database, no containers)

### Code Changes
- Creating/modifying Next.js API routes
- Updating React components
- Changing TypeScript files
- Modifying configuration files
- Adding new features

### Git Operations (Full Access)
- Edit files in `~/Projects/veritable-games-main`
- Commit changes
- Push directly to GitHub
- Pull latest changes
- Manage branches

### Deployment
- Triggering Coolify deployments via GitHub push
- Verifying deployment success (via logs/monitoring)

### Critical Rules for Laptop
- ✅ MUST pull before starting work to avoid conflicts
- ✅ MUST test code changes locally before pushing
- ✅ MUST push to GitHub after changes
- ✅ MUST verify deployments after pushing
- ❌ Cannot execute database migrations (no server access)
- ❌ Cannot run Python import scripts (not on laptop)
- ❌ Cannot inspect production containers (no SSH access)

## Workflow Coordination

### When Working from Both Machines

**1. Always pull before starting work:**
```bash
git pull origin main
```

**2. Communicate about simultaneous work:**
- If both machines are being used simultaneously, coordinate to avoid conflicts
- Use feature branches if working on different features at the same time

**3. Resolve conflicts if they occur:**
```bash
git pull --rebase origin main
# Resolve any conflicts
git rebase --continue
git push origin main
```

## Specialized Operations by Machine

| Operation | Server | Laptop |
|-----------|--------|--------|
| Code changes | ✅ Yes | ✅ Yes |
| Git operations | ✅ Yes | ✅ Yes |
| Database operations | ✅ Yes | ❌ No |
| Python scripts | ✅ Yes | ❌ No |
| Container operations | ✅ Yes | ❌ No |
| Trigger deployments | ✅ Yes (via push) | ✅ Yes (via push) |

## Best Practices

### Feature Branch Workflow (Optional)

If working on same codebase simultaneously:

```bash
# On server or laptop - create feature branch
git checkout -b feature/my-feature
# Make changes, commit
git add .
git commit -m "Add my feature"
# Push feature branch
git push origin feature/my-feature
# Create PR, review, merge
```

### Communication

- Coordinate major changes before starting
- Use descriptive commit messages
- Document breaking changes
- Tag releases for rollback points

### Testing Before Push

**From Server:**
- Run database migrations in test mode first
- Verify Python scripts on sample data
- Check container logs after changes

**From Laptop:**
- Run local development server
- Test in browser
- Run linters and type checks
- Verify builds complete successfully
