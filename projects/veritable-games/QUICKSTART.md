# YouTube + Marxist Integration - Quick Start Guide

## 🎯 TL;DR

✅ **What's Done**: Database, services, API routes, import scripts
🔄 **What's Running**: YouTube import (retry) - YouTube script will take 2-3 hours
⏳ **What's Next**: Monitor import, update frontend, deploy

## 📊 Current Status

### Background Task Running
```bash
# YouTube import (PID: bb5c2b6)
# Status: ~3 hours remaining
# Check progress:
tail -f /home/user/projects/veritable-games/resources/logs/youtube-import-retry-20260220.log
```

### Previous Result
```
Marxist: 342 documents ✅ (complete in ~3 minutes)
YouTube: 0 documents ❌ (fixed - retry in progress)
```

## ⏰ Timeline

| Time | Task |
|------|------|
| Now | YouTube import running |
| +2-3 hours | Import completes |
| +15 min | Verify database |
| +30 min | Update frontend |
| +15 min | Test locally |
| +5 min | Deploy to production |
| +5 min | Monitor Coolify |

## 🔍 Monitor Imports

### Check YouTube Progress
```bash
tail -f ~/projects/veritable-games/resources/logs/youtube-import-retry-20260220.log

# Look for:
# - "Processed X/65391 transcripts"
# - "Inserted Y transcripts in batch"
# - "IMPORT COMPLETE" when done
```

### Verify Results
```bash
# When import completes
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/veritable_games?sslmode=disable" \
psql << EOF
SELECT 'YouTube' source, COUNT(*) count FROM youtube.transcripts
UNION ALL
SELECT 'Marxist' source, COUNT(*) count FROM marxist.documents;
EOF

# Expected:
# YouTube: 65,391
# Marxist: 342 (already done)
```

## 🚀 After Import Completes

### Step 1: Update Frontend (10 minutes)
```bash
# Edit this file:
vim ~/projects/veritable-games/site/frontend/src/app/library/page.tsx

# Add to filter section:
# 1. Source filter: "All", "Library", "Anarchist", "YouTube", "Marxist"
# 2. Channel filter (YouTube)
# 3. Author filter (Marxist)
```

### Step 2: Type Check
```bash
cd ~/projects/veritable-games/site/frontend
npm run type-check
```

### Step 3: Test Locally
```bash
npm run dev
# Visit http://localhost:3000/library
# Test filters, search, detail pages
```

### Step 4: Deploy
```bash
cd ~/projects/veritable-games/site
git add .
git commit -m "Integrate YouTube and Marxist collections"
git push origin main
# Wait 2-5 minutes for Coolify
# Check https://www.veritablegames.com
```

## 📁 Key Files

### Created Today
- Database: `frontend/scripts/migrations/007-create-youtube-marxist-schemas.sql`
- Services: `frontend/src/lib/youtube/`, `frontend/src/lib/marxist/`
- API: `frontend/src/app/api/transcripts/youtube/[slug]/route.ts`
- API: `frontend/src/app/api/documents/marxist/[slug]/route.ts`

### To Edit Later
- Frontend: `frontend/src/app/library/page.tsx` (add filters)

## 🛠️ If Import Fails

### Check Logs
```bash
tail -100 ~/projects/veritable-games/resources/logs/youtube-import-retry-20260220.log
```

### Common Issues
1. **Database connection**: Check PostgreSQL is running
2. **Disk space**: `df -h` (check free space)
3. **Permission issues**: Check file permissions on logs directory

### Manual Re-run
```bash
cd ~/projects/veritable-games/resources
python3 scripts/import_youtube_transcripts.py \
  --source-dir data/transcripts.OLD \
  --database "postgresql://postgres:postgres@localhost:5432/veritable_games?sslmode=disable" \
  --batch-size 1000 \
  --log-file logs/youtube-import-$(date +%Y%m%d-%H%M%S).log
```

## 📚 Full Documentation

- **Implementation Details**: `IMPLEMENTATION_STATUS.md`
- **Architecture**: `YOUTUBE_MARXIST_INTEGRATION_SUMMARY.md`
- **Veriatable Games Dev Guide**: `site/CLAUDE.md`

## ✅ Success Criteria

Import complete when:
- ✅ Log shows "IMPORT COMPLETE"
- ✅ Database has 65,391 YouTube + 342 Marxist documents
- ✅ Tags are associated (1000K+ associations total)
- ✅ Frontend filters work
- ✅ Detail pages load content
- ✅ Production deployment successful

## 💡 Pro Tips

1. **Don't update frontend until import completes** - Results may be needed
2. **Keep the log terminal open** - Easy to monitor progress
3. **Test locally before deploying** - Catch UI issues early
4. **Monitor Coolify for deployment** - Usually takes 2-5 minutes

## 🎉 What You'll Have

Once complete:
- **110,000+ documents** searchable in one place
- **4 unified collections**: Library, Anarchist, YouTube, Marxist
- **Tag discovery** across all sources
- **Intelligent filtering** by source, language, tags, author/channel
- **Virtual scrolling** handles massive datasets efficiently

---

**Questions?** See IMPLEMENTATION_STATUS.md or YOUTUBE_MARXIST_INTEGRATION_SUMMARY.md for details.

**Happy integrating!** 🚀
