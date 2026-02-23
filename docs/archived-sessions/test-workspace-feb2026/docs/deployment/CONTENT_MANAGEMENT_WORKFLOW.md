# Content Management Workflow
## Veritable Games - Git as Source of Truth

**Last Updated:** November 5, 2025
**Philosophy:** Git is your backup. Server can die anytime. Everything must be in git.

---

## 🎯 Content Strategy

### Admin/Developer Content (You create)
- ✅ Wiki entries
- ✅ Project pages
- ✅ Gallery images
- ✅ Gallery videos
- ✅ Official documentation
- ✅ All visual assets

**ALL OF THIS IS IN GIT** ← Your backup

### User-Generated Content (External users create)
- ❌ Forum posts (community discussions)
- ❌ Forum user accounts

**Only forums are true "user data" - minimal for this project**

---

## 🔄 Primary Workflow: Local → Git → Production

This is your main workflow 90% of the time:

### 1. Add/Edit Content Locally

```bash
cd frontend

# Add images to project galleries
cp ~/Downloads/screenshot.png public/uploads/references/my-project/

# Edit wiki pages
code src/app/wiki/...

# Edit project pages
code src/app/projects/...
```

### 2. Commit to Git

```bash
git status  # See what changed
git add public/uploads/  # Add new images
git add src/app/  # Add code changes
git commit -m "Add new gallery images and wiki entry"
```

### 3. Push to GitHub

```bash
git push origin main
```

### 4. Auto-Deploy

**Happens automatically:**
- GitHub webhook triggers Coolify
- Coolify pulls latest code
- Builds new Docker container
- Deploys with all your content
- Takes ~3 minutes

**Verify:**
- Go to http://192.168.1.15:8000
- Check deployment logs
- Visit site to see changes live

---

## ⚠️ Secondary Workflow: Content Added via Web UI

Sometimes you might add content via the web interface (testing, quick edit, etc.)

**Problem:** That content is in the container/database, NOT in git yet.

**Solution:** Pull it back to local and commit to git.

### Pull Production Content Script

```bash
# From project root
./scripts/sync/pull-production-content.sh
```

**What it does:**
1. Syncs uploaded files from production → local
   - `/app/public/uploads/` → `frontend/public/uploads/`
   - `/app/data/uploads/` → `frontend/data/uploads/`

2. Exports database content to JSON
   - Wiki pages → `frontend/data/exports/wiki-pages.json`
   - Projects → `frontend/data/exports/projects.json`
   - Gallery metadata → `frontend/data/exports/gallery-images.json`

3. Shows what changed with `git status`

### After Pulling

```bash
# Review changes
git diff

# Commit everything
git add -A
git commit -m "Pull content from production"

# Push to GitHub (your backup)
git push origin main
```

---

## 💾 Database Content Management

### The Challenge

Database content (wiki entries, project metadata) can't be directly committed to git like files can.

**Solution:** Export/import via JSON

### Database Export (Already Handled)

The pull script exports database content to JSON files:
- `frontend/data/exports/wiki-pages.json`
- `frontend/data/exports/projects.json`
- `frontend/data/exports/gallery-images.json`

These JSON files ARE committed to git ✅

### Database Import (For Disaster Recovery)

If server dies, restore from git:

```bash
# 1. Fresh deploy from git (all files are there)
# 2. Import database content from JSON exports

cd frontend

# Import wiki pages
node scripts/import/import-wiki-from-json.js data/exports/wiki-pages.json

# Import projects
node scripts/import/import-projects-from-json.js data/exports/projects.json

# Import gallery metadata
node scripts/import/import-gallery-from-json.js data/exports/gallery-images.json
```

**Note:** These import scripts need to be created. See "TODO" section below.

---

## 📦 What's in Git vs Not

### ✅ In Git (Committed)

```
frontend/
├── public/
│   └── uploads/              ← All your images/videos
│       ├── references/
│       ├── concept-art/
│       └── history/
├── data/
│   ├── uploads/
│   │   └── avatars/          ← Profile pictures
│   └── exports/              ← Database exports (JSON)
│       ├── wiki-pages.json
│       ├── projects.json
│       └── gallery-images.json
├── src/                      ← All code
└── [everything else]
```

**Size consideration:** If a file is too big for git:
- Don't upload it in the first place
- Or use Git LFS (Large File Storage)
- Or host it externally (YouTube, Vimeo, etc.)

### ❌ Not in Git (Ephemeral)

- Docker containers (disposable)
- Build artifacts (`frontend/.next/`)
- Dependencies (`frontend/node_modules/`)
- PostgreSQL database itself (backed up via pg_dump, but not in git)
- Server configuration (Coolify manages this)

---

## 🔐 Disaster Recovery Scenarios

### Scenario 1: Server Dies Completely

**Recovery:**
1. Set up new server with Coolify
2. Connect to GitHub repo
3. Deploy (all files come from git) ✅
4. Set up PostgreSQL container
5. Run database import scripts (from JSON exports in git) ✅
6. Site is back online

**Time to recover:** ~30 minutes

### Scenario 2: Accidentally Deleted Files in Production

**Recovery:**
1. Pull production content (might recover some)
2. Or just redeploy from git (files will be restored)

**Time to recover:** ~5 minutes

### Scenario 3: Database Corrupted

**Recovery:**
1. Restore PostgreSQL from latest backup (pg_dump)
2. Or import from JSON exports in git
3. May lose recent changes (since last export/backup)

**Prevention:** Run pull script frequently (weekly? daily?)

---

## 🚀 Deployment Checklist

### Before Deploying Major Changes

- [ ] All content added locally and committed to git
- [ ] Tested locally with `npm run dev`
- [ ] TypeScript check passes: `npm run type-check`
- [ ] Committed with descriptive message
- [ ] Pushed to GitHub

### After Deployment

- [ ] Check Coolify deployment logs (green = success)
- [ ] Visit site to verify changes are live
- [ ] Test new features/content
- [ ] Pull production content back to git (if any web UI changes)

### Weekly Maintenance

- [ ] Run `./scripts/sync/pull-production-content.sh`
- [ ] Commit database exports to git
- [ ] Verify backups exist
- [ ] Check disk space on server

---

## 📊 File Size Guidelines

**Git repository size should stay reasonable:**

| File Type | Recommended Max | Why |
|-----------|----------------|-----|
| Images (PNG/JPG) | 2-5 MB each | Use compression/optimization |
| Videos (MP4) | 50 MB each | Use external hosting for longer videos |
| Total repo | < 1 GB | Keeps clone/push/pull fast |

**If files are too large:**
1. Optimize images (ImageOptim, TinyPNG, etc.)
2. Compress videos (Handbrake, ffmpeg)
3. Use external hosting (YouTube, Vimeo, Cloudinary)
4. Consider Git LFS for truly large assets

---

## 🛠️ TODO: Missing Import Scripts

The export functionality exists, but import scripts need to be created:

### Create These Scripts:

1. **`scripts/import/import-wiki-from-json.js`**
   - Read `data/exports/wiki-pages.json`
   - Insert into PostgreSQL `wiki.wiki_pages` table
   - Handle conflicts (update existing vs create new)

2. **`scripts/import/import-projects-from-json.js`**
   - Read `data/exports/projects.json`
   - Insert into PostgreSQL `content.projects` table
   - Handle conflicts

3. **`scripts/import/import-gallery-from-json.js`**
   - Read `data/exports/gallery-images.json`
   - Insert into PostgreSQL `content.project_gallery_images` table
   - Handle conflicts

**Need help creating these?** Let me know and I'll generate them.

---

## 🎯 Best Practices

### 1. Commit Often, Push Often

```bash
# After adding each major piece of content
git add .
git commit -m "Add screenshots for project X"
git push
```

**Why:** Git is your backup. Push = backed up to GitHub.

### 2. Pull from Production Regularly

```bash
# Weekly (or after making web UI changes)
./scripts/sync/pull-production-content.sh
git add data/exports/
git commit -m "Update database exports"
git push
```

**Why:** Keeps database exports current in git.

### 3. Descriptive Commit Messages

```bash
# Good
git commit -m "Add gallery images for Project Nebula (25 images)"
git commit -m "Update wiki page: Installation Guide"

# Bad
git commit -m "updates"
git commit -m "stuff"
```

**Why:** Helps you find content in git history.

### 4. Test Locally First

```bash
# Always test before pushing
cd frontend
npm run dev
# Test your changes at http://localhost:3000
# Then commit and push
```

**Why:** Catch issues before they hit production.

---

## 📞 Quick Reference

```bash
# Add content locally
cp images/* frontend/public/uploads/references/my-project/
git add frontend/public/uploads/
git commit -m "Add gallery images"
git push

# Pull content from production (after web UI edits)
./scripts/sync/pull-production-content.sh
git add -A
git commit -m "Pull production content"
git push

# Check deployment status
# Go to: http://192.168.1.15:8000
# Or: ssh user@192.168.1.15 "docker ps"

# View application logs
ssh user@192.168.1.15 "docker logs -f [container-name]"

# Check health
curl http://[your-domain]/api/health

# Emergency: Redeploy from git
# Coolify UI → Click "Redeploy"
```

---

## 🔄 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY WORKFLOW (90% of the time)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Add content locally (images, wiki pages, etc.)         │
│  2. git add, commit, push                                   │
│  3. GitHub webhook → Coolify auto-deploys                   │
│  4. Content is live in ~3 minutes                           │
│                                                              │
│  ✅ Git = Backup ✅                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SECONDARY WORKFLOW (Occasional web UI edits)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Edit content via web UI (testing/quick fixes)          │
│  2. Run: ./scripts/sync/pull-production-content.sh         │
│  3. Review changes: git diff                                │
│  4. Commit: git add -A && git commit && git push            │
│                                                              │
│  ✅ Content now backed up in Git ✅                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DISASTER RECOVERY (Server dies)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. New server + Coolify                                    │
│  2. Connect to GitHub repo                                  │
│  3. Deploy (files restored from git) ✅                     │
│  4. Import database from JSON exports ✅                    │
│  5. Back online in ~30 minutes                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Remember:** Git is not just version control - it's your backup, your disaster recovery, and your single source of truth. The server is temporary. Git is forever.

---

## Next Steps

1. ✅ Content workflow understood
2. ✅ Pull script created
3. ⏳ Create import scripts (for disaster recovery)
4. ⏳ Set up automated weekly pulls (optional)
5. ⏳ Configure Git LFS if needed (for very large files)

**Need help with any of these?** Just ask!
