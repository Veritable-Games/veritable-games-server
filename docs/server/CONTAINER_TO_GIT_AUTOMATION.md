# Container-to-Git Automation Research & Recommendations

**Date:** 2025-11-11
**Status:** Research Complete
**Priority:** HIGH - Prevents data loss

---

## TL;DR - The Best Solution

**DON'T sync containers back to git. Instead: Edit git directly, let Coolify build containers from git.**

**Recommended Approach:**
1. **VS Code Remote SSH** - Edit code in git repo on server via SSH
2. **Development docker-compose** - Test changes locally with mounted volumes
3. **Coolify Preview Deployments** - Test feature branches before production
4. **Pre-deployment checks** - Prevent commits being forgotten

---

## The Fundamental Problem

**Current Workflow (Problematic):**
```
Edit container → Extract → Commit to git → Redeploy
     ↓
  (Easy to forget extraction step = data loss)
```

**Recommended Workflow:**
```
Edit git repo → Commit → Coolify builds container from git
     ↓
  (Impossible to forget - changes are already in git)
```

---

## Solution 1: VS Code Remote SSH (PRIMARY RECOMMENDATION) ⭐

### What It Does
- Connect VS Code to your server via SSH
- Edit files directly in `/home/user/veritable-games-migration/frontend` (git repo)
- Changes happen in git, not containers
- Full IDE features (IntelliSense, debugging, extensions)

### Setup (5 Minutes)

**On Local Machine:**
1. Install VS Code: https://code.visualstudio.com/
2. Install "Remote - SSH" extension
3. Connect to server:
   - Press `F1` → "Remote-SSH: Connect to Host"
   - Enter: `user@veritable-games-server`
   - Authenticate with SSH key
4. Open folder: `/home/user/veritable-games-migration/frontend`

**That's it!** Now all edits happen in git repo.

### Pros
- ✅ **Solves the root problem** - no sync needed
- ✅ Industry best practice
- ✅ Full IDE experience
- ✅ Works with existing Coolify setup
- ✅ Zero infrastructure changes

### Cons
- Requires local VS Code installation
- Needs stable SSH connection

### When to Use
**ALL THE TIME** - This should be your primary development method.

---

## Solution 2: Development Docker Compose (RECOMMENDED) 🐳

### What It Does
- Mount git repo source code into development container
- Edit files on host (in git repo)
- Container picks up changes via volume mount
- Hot reload works perfectly

### Setup

**Create `/home/user/veritable-games-migration/frontend/docker-compose.dev.yml`:**

```yaml
version: '3.8'
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    volumes:
      - ./src:/app/src
      - ./pages:/app/pages
      - ./public:/app/public
      - ./styles:/app/styles
      - /app/node_modules    # Don't mount node_modules
      - /app/.next           # Don't mount .next cache
    environment:
      - NODE_ENV=development
      - WATCHPACK_POLLING=true
      - DATABASE_URL=postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games
    ports:
      - "3001:3000"  # Different port to avoid Coolify conflict
    command: npm run dev
    networks:
      - coolify

networks:
  coolify:
    external: true
```

**Update Dockerfile for multi-stage builds:**

```dockerfile
# Base stage
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage (existing)
FROM base AS production
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

**Usage:**

```bash
cd /home/user/veritable-games-migration/frontend

# Start development environment
docker-compose -f docker-compose.dev.yml up

# Edit files on host (via VS Code SSH or any editor)
# Changes automatically reflected in container

# When done, commit to git
git add .
git commit -m "Your changes"

# Coolify auto-deploys production build from git
```

### Pros
- ✅ Local testing before deployment
- ✅ Hot reload works
- ✅ Changes always in git
- ✅ Clear dev/prod separation

### Cons
- Requires additional docker-compose file
- Must remember to stop dev container before deploying

### When to Use
**For testing changes locally** before pushing to production.

---

## Solution 3: Pre-Deployment Safety Check (RECOMMENDED) 🛡️

### What It Does
- Prevents deployments if changes aren't committed to git
- Acts as safety net

### Setup

**Create `/home/user/scripts/pre-deploy-check.sh`:**

```bash
#!/bin/bash
set -e

REPO_PATH="/home/user/veritable-games-migration/frontend"
cd $REPO_PATH

echo "🔍 Checking git status..."

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "❌ ERROR: Uncommitted changes detected!"
    echo ""
    echo "Please commit or stash your changes before deploying:"
    echo ""
    git status -s
    echo ""
    exit 1
fi

# Verify commit exists in remote
if ! git ls-remote --exit-code --heads origin $(git branch --show-current) > /dev/null 2>&1; then
    echo "⚠️  WARNING: Current branch not pushed to remote"
    echo "Run: git push origin $(git branch --show-current)"
    exit 1
fi

echo "✅ All changes committed and pushed to git"
echo "✅ Safe to deploy"
```

**Make executable:**
```bash
chmod +x /home/user/scripts/pre-deploy-check.sh
```

**Usage:**

```bash
# Before triggering Coolify deployment
/home/user/scripts/pre-deploy-check.sh

# Or integrate with Coolify pre-deployment hooks (if supported)
```

### Pros
- ✅ Prevents data loss
- ✅ Forces good habits
- ✅ Simple to implement

### Cons
- Doesn't prevent the problem, just catches it
- Manual run required (unless integrated with Coolify)

### When to Use
**Before every deployment** as final safety check.

---

## Solution 4: Coolify Preview Deployments (RECOMMENDED) 🎭

### What It Does
- Deploy feature branches to separate preview URLs
- Test before merging to production
- Each branch gets own container

### Setup

**In Coolify UI:**
1. Go to your application settings
2. Enable "Preview Deployments"
3. Configure preview environment variables (if different from prod)

**Workflow:**

```bash
# Create feature branch
git checkout -b feature/my-changes

# Make changes in git repo (via VS Code SSH)
# Edit files in /home/user/veritable-games-migration/frontend

# Commit and push
git add .
git commit -m "Add my feature"
git push origin feature/my-changes

# Coolify automatically deploys preview
# Test at preview URL: https://preview-feature-my-changes.veritablegames.com

# Once tested, merge to main
git checkout master
git merge feature/my-changes
git push origin master

# Coolify deploys to production
```

### Pros
- ✅ Test changes before production
- ✅ Native Coolify feature
- ✅ Separate environments per feature
- ✅ Aligns with GitOps

### Cons
- Requires Coolify configuration
- Uses more server resources

### When to Use
**For new features and major changes** before merging to main.

---

## Solutions NOT Recommended ❌

### Gitwatch + inotify (Auto-commit container changes)

**Why Not:**
- Creates noisy commit history
- Doesn't work well with Docker volumes
- Requires container modifications
- Fights against Docker's design

**Use Case:** Emergency production hotfixes only

### Scheduled docker diff + extraction

**Why Not:**
- Not real-time
- Captures system files as well
- Requires extensive filtering
- Manual review still needed

**Use Case:** Transitional period only

### git-sync Sidecar Container

**Why Not:**
- Designed for git → container (not container → git)
- Adds complexity
- Not native to Coolify
- Overkill for this use case

**Use Case:** Only if migrating to Kubernetes

---

## Implementation Checklist

### Week 1: Get Started ✅

- [ ] Install VS Code locally
- [ ] Install "Remote - SSH" extension
- [ ] Connect to server via SSH
- [ ] Open `/home/user/veritable-games-migration/frontend` in VS Code
- [ ] Make a test edit and commit
- [ ] Verify Coolify auto-deploys
- [ ] Update CLAUDE.md with new workflow

### Week 2: Add Safety Nets 🛡️

- [ ] Create `docker-compose.dev.yml`
- [ ] Test local development environment
- [ ] Create `pre-deploy-check.sh` script
- [ ] Add to PATH or create alias
- [ ] Test pre-deployment check

### Week 3: Advanced Setup 🚀

- [ ] Enable Coolify preview deployments
- [ ] Test feature branch workflow
- [ ] Configure preview environment variables
- [ ] Document new workflow for team

### Month 2+: Optimization ⚡

- [ ] Implement pre-commit hooks
- [ ] Add automated tests
- [ ] Set up GitHub Actions CI/CD
- [ ] Enforce immutable infrastructure
- [ ] Regular security audits

---

## Quick Reference Commands

### Development Workflow

```bash
# 1. Connect to server (via VS Code SSH)
# 2. Edit files in /home/user/veritable-games-migration/frontend

# 3. Test locally (optional)
cd /home/user/veritable-games-migration/frontend
docker-compose -f docker-compose.dev.yml up

# 4. Commit changes
git add .
git commit -m "Your change description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 5. Push to git
git push origin main  # or feature branch

# 6. Coolify auto-deploys (or verify with pre-check)
/home/user/scripts/pre-deploy-check.sh
```

### Emergency Container Edit (Last Resort)

**If you MUST edit a container directly:**

```bash
# 1. Make change in container
docker exec -it m4s0kwo4kc4oooocck4sswc4 vi /app/src/file.ts

# 2. Test restart
docker restart m4s0kwo4kc4oooocck4sswc4

# 3. IMMEDIATELY extract to git
docker cp m4s0kwo4kc4oooocck4sswc4:/app/src/file.ts \
  /home/user/veritable-games-migration/frontend/src/file.ts

# 4. Commit to git
cd /home/user/veritable-games-migration/frontend
git add src/file.ts
git commit -m "Emergency hotfix: describe change"
git push

# 5. Trigger Coolify redeploy to get permanent build
```

---

## FAQ

**Q: What if I forget to extract changes from a container before redeploying?**
A: Changes are lost. This is why we recommend editing git directly via VS Code SSH.

**Q: Can I use a different editor instead of VS Code?**
A: Yes! You can SSH into the server and use vim, nano, or any editor. VS Code SSH just provides the best experience.

**Q: What about database changes?**
A: Database data persists across deployments (stored in volumes). Only code changes in containers are ephemeral.

**Q: Do user-uploaded files (images, etc.) survive redeployment?**
A: Yes, if stored in mounted volumes or database. Code changes don't affect user data.

**Q: Can I edit files from my local machine and sync to server?**
A: Yes, but it adds complexity. VS Code SSH edits directly on server, which is simpler.

**Q: What if my internet connection is unstable for SSH?**
A: Use `mosh` (mobile shell) instead of SSH for better connection stability.

---

## Resources

### Tools
- **VS Code**: https://code.visualstudio.com/
- **Remote SSH Extension**: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh
- **Coolify Docs**: https://coolify.io/docs
- **Docker Compose**: https://docs.docker.com/compose/

### Best Practices
- **12-Factor App**: https://12factor.net/
- **GitOps Principles**: https://www.gitops.tech/
- **Docker Development**: https://docs.docker.com/develop/dev-best-practices/

### Tutorials
- **VS Code Remote SSH Setup**: https://code.visualstudio.com/docs/remote/ssh-tutorial
- **Docker Multi-Stage Builds**: https://docs.docker.com/build/building/multi-stage/
- **Next.js with Docker**: https://nextjs.org/docs/deployment#docker-image

---

## Summary

**The key insight:** Docker containers are designed to be ephemeral and rebuilt from source. Don't fight this design - embrace it.

**Best Practice:**
1. Edit code in git repo (via VS Code SSH)
2. Commit to git
3. Let Coolify build and deploy from git
4. Never edit containers directly

**Result:** Zero data loss, industry-standard workflow, maintainable infrastructure.

---

**Last Updated:** 2025-11-11
**Author:** Claude Code Research Agent
