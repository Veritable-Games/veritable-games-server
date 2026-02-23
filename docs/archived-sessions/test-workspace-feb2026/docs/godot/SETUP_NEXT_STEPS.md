# Godot Projects Architecture - Setup & Next Steps

## ✅ Completed

### Phase 1-3: Infrastructure & Configuration
- [x] Updated `service.ts` to use environment variables (lines 47-53)
- [x] Updated `.gitignore` to exclude godot projects and builds
- [x] Added environment variable documentation to `.env.example`
- [x] Created `.gitkeep` to track empty `godot-projects/` directory
- [x] Created comprehensive architecture documentation

### Phase 4: Database & Project Registration
- [x] Created Godot schema migration (`010-godot-schema.sql`)
- [x] Ran migration successfully (created 7 tables + indexes)
- [x] Registered 3 projects in database:
  - **NOXII**: 4 versions (v0.01 - v0.04, Godot 4.5)
  - **NOXII-LEGACY**: 28 versions (0.01 - 0.28, Godot 4.4)
  - **ENACT**: 9 versions (0.01 - 0.09, Godot 4.4)
- [x] Set v0.04 (NOXII) and 0.09 (ENACT) as active versions
- [x] All 41 versions have extracted_path pointing to `/data/projects/{PROJECT}/{VERSION}/`

### Phase 5: Script Indexing Tool
- [x] Created `scripts/index-all-godot-projects.js`
- [x] Implements full GDScript parser (matches parser-service.ts logic)
- [x] Tool is ready to parse all 41 versions and build dependency graphs
- [x] Gracefully handles missing SSHFS mounts with clear error messages

### Database Status
```
✓ All 7 Godot tables created in content schema:
  - godot_projects
  - godot_versions
  - godot_scripts
  - godot_dependency_graph
  - godot_runtime_events
  - godot_github_sync
  - godot_scenes

✓ 3 projects registered
✓ 41 versions registered
✓ Ready for script indexing
```

---

## 🔧 Next Steps (Manual User Actions Required)

### Step 1: Set Up SSHFS Mount (Required for Script Indexing)

The Godot projects are on the production server at `/data/projects/`. To develop locally with transparent access:

```bash
# 1. Install SSHFS (one-time)
sudo apt-get install sshfs

# 2. Create mount point
mkdir -p ~/mnt/godot-projects

# 3. Mount server directory
sshfs user@192.168.1.15:/data/projects ~/mnt/godot-projects

# 4. Verify mount
ls ~/mnt/godot-projects/
# Should show: ENACT/  NOXII/  NOXII-LEGACY/

# 5. Create symlink in project (optional, for convenience)
ln -s ~/mnt/godot-projects frontend/godot-projects
```

**To unmount when done:**
```bash
fusermount -u ~/mnt/godot-projects
```

**Auto-mount on login (optional):**
Add to `/etc/fstab`:
```
user@192.168.1.15:/data/projects /home/user/mnt/godot-projects fuse.sshfs defaults,_netdev,allow_other 0 0
```

Then mount all: `mount -a`

---

### Step 2: Index All Project Scripts

Once SSHFS mount is set up:

```bash
cd frontend
node scripts/index-all-godot-projects.js
```

**Expected output:**
```
✓ Found 41 registered versions
✓ Indexed 1000+ scripts
✓ Built dependency graphs
✓ Stored metadata in database
✨ All versions indexed successfully!
```

This process:
- Parses all `.gd` files from `/data/projects/`
- Extracts dependencies, functions, signals, exports
- Builds dependency graphs (3D visualization data)
- Stores metadata in `content.godot_scripts` and `content.godot_dependency_graph`
- Takes 5-10 minutes for all 41 versions

---

### Step 3: Configure Production Docker Volumes

For production deployment (Coolify):

**Add to `docker-compose.yml` or Coolify configuration:**

```yaml
volumes:
  godot-projects:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/projects

  godot-builds:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/builds

services:
  app:
    volumes:
      - godot-projects:/app/godot-projects
      - godot-builds:/app/godot-builds
    # Also ensure symlink exists
    entrypoint: sh -c "ln -sf /app/godot-builds /app/public/godot-builds && ..."
```

---

### Step 4: Test Phase 3 Functionality

Once indexing is complete:

```bash
npm run dev
```

**In browser, press backtick (`) to open Godot overlay**

Verify:
- [ ] **Project Selector**: Shows "noxii", "noxii-legacy", "enact"
- [ ] **Version Selector**: Lists all versions for selected project
- [ ] **Dependency Graph**: Visualizes script relationships in Three.js
- [ ] **Monaco Editor**: Loads and edits .gd scripts
- [ ] **Save Functionality**: Changes persist to `/data/projects/` on server

---

## 🛠️ Environment Variables

### Development (Already Configured)

The app will automatically use these paths:

```bash
# From .env.local or defaults
GODOT_PROJECTS_PATH=/home/user/mnt/godot-projects (after SSHFS mount)
GODOT_BUILDS_PATH=/home/user/Projects/veritable-games-main/frontend/public/godot-builds
```

**Or manually set in .env.local:**
```bash
GODOT_PROJECTS_PATH=/home/user/mnt/godot-projects
GODOT_BUILDS_PATH=/home/user/Projects/veritable-games-main/frontend/public/godot-builds
```

### Production

Automatically uses Docker volume mounts:
```
GODOT_PROJECTS_PATH=/app/godot-projects
GODOT_BUILDS_PATH=/app/godot-builds
```

---

## 📊 Database Schema

All Godot tables are in the `content` schema:

### godot_projects
```sql
id | project_slug  | title         | description | created_at | updated_at
-- | noxii         | NOXII         | ...         | 2025-12-26 | 2025-12-26
-- | noxii-legacy  | NOXII Legacy  | ...         | 2025-12-26 | 2025-12-26
-- | enact         | ENACT         | ...         | 2025-12-26 | 2025-12-26
```

### godot_versions
```sql
id | project_slug | version_tag | is_active | extracted_path                   | build_status | created_at
-- | noxii        | v0.01       | false     | /data/projects/NOXII/v0.01       | pending      | 2025-12-26
-- | noxii        | v0.02       | false     | /data/projects/NOXII/v0.02       | pending      | 2025-12-26
-- | noxii        | v0.03       | false     | /data/projects/NOXII/v0.03       | pending      | 2025-12-26
-- | noxii        | v0.04       | TRUE      | /data/projects/NOXII/v0.04       | pending      | 2025-12-26
...
```

### godot_scripts
```sql
id | version_id | file_path           | script_name | content  | dependencies | functions | signals | exports | created_at
-- | 1          | res://Player.gd     | Player      | ...      | [...]        | [...]     | [...]   | [...]   | 2025-12-26
-- | 2          | res://Enemy.gd      | Enemy       | ...      | [...]        | [...]     | [...]   | [...]   | 2025-12-26
```

### godot_dependency_graph
```sql
id | version_id | graph_data (JSONB)     | parsed_at  | updated_at
-- | 1          | {"nodes": [...], ...}  | 2025-12-26 | 2025-12-26
```

---

## 🔄 Workflow After Setup

### Editing a Script

1. **Dev Overlay** (Press backtick)
   - Select project, version, script
   - Edit in Monaco editor
   - Click **Save**

2. **File Updates**
   - Script content stored in database
   - Also written to `/data/projects/{PROJECT}/{VERSION}/{FILE}.gd`
   - Accessible via SSHFS mount during development

3. **Dependency Graph Update**
   - Automatically reparsed on save
   - Graph cached in `godot_dependency_graph` table
   - Three.js visualization updates

### Building a Version

1. Press **Build** in overlay
2. Godot CLI exports to `/data/builds/{project}/{version}/`
3. HTML5 runtime loads in embedded iframe
4. Changes persist on server

### GitHub Integration (Future)

```bash
# Commit changes to GitHub
curl -X POST http://localhost:3000/api/godot/projects/noxii/github/commit \
  -d '{"versionId": 1, "message": "Update Player.gd", "branch": "main"}'

# Push to remote
curl -X POST http://localhost:3000/api/godot/projects/noxii/github/push \
  -d '{"branch": "main"}'
```

---

## 🚀 Quick Reference

### Commands

```bash
# Check migration status
npm run db:migrate

# Check database health
npm run db:health

# Index all scripts (after SSHFS mount)
node scripts/index-all-godot-projects.js

# Start dev server
npm run dev

# Format & check types
npm run format && npm run type-check
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/godot/service.ts` | Main Godot service with env var support |
| `src/lib/godot/parser-service.ts` | GDScript parser (functions, signals, deps) |
| `scripts/index-all-godot-projects.js` | Bulk script indexing tool |
| `scripts/migrations/010-godot-schema.sql` | Database schema |
| `docs/godot/ARCHITECTURE_UPDATE_DEC_2025.md` | Architecture decisions |

---

## ⚠️ Troubleshooting

### "Path does not exist" errors when indexing

**Cause**: SSHFS mount not set up
**Fix**: Follow Step 1 (Set Up SSHFS Mount)

### Godot tables not found in database

**Cause**: Migration didn't run
**Fix**:
```bash
npm run db:migrate
# Check: SELECT * FROM content.godot_projects;
```

### Scripts not saving to server

**Cause**: `GODOT_PROJECTS_PATH` not set correctly
**Fix**: Verify in `.env.local`:
```bash
GODOT_PROJECTS_PATH=/home/user/mnt/godot-projects
```

### SSHFS mount timeout

**Fix**: Increase connection timeout:
```bash
sshfs user@192.168.1.15:/data/projects ~/mnt/godot-projects -o ServerAliveInterval=60
```

---

## 📅 Timeline

- ✅ **Dec 26**: Architecture setup, database schema, migration runner
- ⏭️ **Next**: SSHFS mount, script indexing, Phase 3 testing
- 🔮 **Future**: Docker volume production config, GitHub integration, build system

---

## 📚 Related Documentation

- Plan: `/home/user/.claude/plans/agile-wibbling-meteor.md`
- Architecture: `/docs/godot/ARCHITECTURE_UPDATE_DEC_2025.md`
- Reference Pattern: `/frontend/src/lib/anarchist/service.ts` (Docker volumes)

---

**Status**: Ready for SSHFS mount and script indexing
**Last Updated**: December 26, 2025
**Next Review**: After Step 2 (Script Indexing) completion
