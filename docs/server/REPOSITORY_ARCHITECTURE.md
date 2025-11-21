# Repository Architecture

**Last Updated:** November 14, 2025

## Overview

The `/home/user/repository/` directory contains curated third-party project archives organized for development reference. This is **NOT an active development project** - it's a well-organized library of 294 compressed archives (ZIP, TAR.XZ, TGZ) focused on AI/ML tools and development resources.

## Recent Reorganization (November 2025)

**Goals:**
- Separate active development tools from reference/learning materials
- Remove duplicates and unrelated content
- Align with server's production focus (Veritable Games)

**Results:**
- Deleted 46 duplicate files (~5.7GB)
- Reduced repository from 30GB → 5.6GB
- Deleted unrelated reference materials (16GB)
- Transferred 138.5MB of Godot archives to laptop
- Total space freed: 24GB (November 2025 cleanup + archives deletion)

---

## Current Structure

### `/home/user/repository/` - Active Development Tools (5.6GB)

**Purpose:** Tools and frameworks relevant to current/future server projects

```
repository/
├── AI-ML/ (3.4GB) - LLM/RAG tools for potential AI features
│   ├── LLM-Applications/ (1.1GB)
│   │   ├── RAG-Local/ (privateGPT, localGPT)
│   │   ├── RAG-Memory/ (mem0, letta, rag-stack)
│   │   ├── Chat-Interfaces/ (LibreChat, text-gen-webui)
│   │   ├── Code-Generation/ (gpt-engineer, AlphaCodium)
│   │   ├── Autonomous-Agents/ (AutoGPT, BabyAGI, MetaGPT)
│   │   └── Multimodal, Operating-Systems, etc.
│   ├── LLM-Frameworks/ (581MB) - LangChain, llama.cpp
│   ├── Audio/ (484MB) - Whisper, DeepSpeech, TTS, Bark
│   ├── LLM-Models/ (430MB) - StableLM, Qwen, Vicuna
│   ├── ML-Frameworks/ (363MB)
│   │   └── HuggingFace/ (transformers, accelerate, datasets, etc.)
│   ├── LLM-Tools/ (328MB) - Gradio, promptflow, aiconfig
│   ├── NLP/ (78MB)
│   │   ├── Libraries/Production-NLP/ (spaCy)
│   │   ├── Topic-Modeling/ (gensim)
│   │   └── Training-Tools/ (GloVe tools, not embeddings)
│   ├── Vector-Databases/ (40MB) - Chroma
│   └── ML-Tools/ (6.3MB)
│
├── Development-Tools/ (958MB)
│   ├── AI-Assistants/ (claude-code, Roo-Code, butterfish, etc.)
│   ├── Notebooks/ (JupyterHub, chapyter)
│   ├── Python/Tools/ (runhouse, PyHook, textbase)
│   ├── C-CPP/Windows/ (w64devkit)
│   ├── JavaScript/Runtimes/ (bun)
│   ├── Rust/Compiler/ (rust-master)
│   ├── Testing/ (shippie, betty)
│   └── Backend-Frameworks, Asset-Tools, etc.
│
├── Web-Development/ (200MB - after removing SharePoint)
│   ├── JavaScript-Frameworks/Virtual-DOM/ (million)
│   ├── Drawing-Tools/ (tldraw)
│   └── Community-Platforms/ (opencollective)
│
├── Documentation-Examples/ (1.5GB)
│   ├── blog-main.zip (556MB) - kept newer version
│   ├── docs.zip, examples-master.zip
│   └── licenses, abbyy docs
│
├── Data-Tools/ (37MB)
│   └── Search-Engines/OpenSearch/ - Could enhance VG search
│
├── Automation/ (25MB)
│   ├── Workflow-Automation/ (n8n)
│   └── Bots/ (youtube-announcement-bot)
│
├── System-Tools/ (10MB - removed drivers)
│   ├── Task-Scheduling/ (crontab)
│   └── Utilities/ (hysteria, steamdeck-tricks)
│
└── Metadata & Documentation
    ├── CLAUDE.md (8.1KB) - Repository-specific guidance
    ├── README.md (9.3KB)
    ├── CATEGORIZATION_SUMMARY.md (18KB)
    ├── ORGANIZATION_COMPLETED.md (11KB)
    ├── ORGANIZATION_GUIDE.md (11KB)
    ├── categorized_projects.md (10KB)
    ├── organize_archives.py (8.1KB) - Organization script
    ├── complete_archive_categorization.json (81KB)
    ├── archive_mapping.json (14KB)
    ├── archive_analysis_results.json (11KB)
    ├── archive_analysis_summary.md (6KB)
    └── duplicate_files_mapping.json (23KB)
```

---


## Transferred to Laptop

**Godot Archives (138.5MB):**
- Location: `~/Documents/godot-collection-2025-11-14.tar.gz` on laptop
- Contains 9 Godot engine plugins/tools extracted from repository
- Transfer completed: November 14, 2025

---

## Deleted Content

### Duplicates (46 files, 5.7GB):
- All files with "-duplicate" suffix removed
- Included large items like:
  - AI-For-Beginners-main-duplicate.zip (2.4GB)
  - stable-diffusion-webui-duplicate.zip (1.2GB)
  - stellarium-24.3-duplicate.tar.xz (313MB)
  - Plus 43 other duplicates

### Large Unrelated Files (2.9GB):
- SharePoint framework (2.0GB) - Not using SharePoint
- blog.zip (927MB) - Kept newer blog-main.zip instead

---

## Reorganization Rationale

### What Stayed in repository/

**Keep if:**
- Active development tools (AI assistants, notebooks, testing)
- Potentially useful for VG (LLM/RAG, search, automation)
- Frequently referenced (ML frameworks, language tools)
- Small enough to not burden server (<100MB per category)

**Kept Categories:**
- AI-ML/LLM tools (could enhance VG with AI features)
- Development-Tools (claude-code, testing, Python tools)
- Web-Development (Next.js related items)
- Data-Tools (OpenSearch could improve VG search)
- Automation (n8n for potential workflow automation)

### What Was Deleted

**Delete if:**
- Duplicate of existing file
- Clearly unrelated to any server purpose
- Large and replaceable (can re-download if needed)

---

## Server Architecture Alignment

### Current Server Projects

**Veritable Games:**
- Next.js/React application
- PostgreSQL database
- Literature archiving (anarchist, Marxist texts)
- Forums, wiki, library, galleries

### Repository Relevance

**Highly Relevant (kept in repository/):**
- LLM/RAG tools → Could add AI-powered search/recommendations to VG
- Development-Tools → Useful for ongoing development
- Web-Development tools → Next.js ecosystem
- Automation → Potential workflow enhancements

**Not Relevant (deleted):**
- Learning materials → Unrelated to VG production
- AI data files → Not needed for current projects
- Game development → Different domain entirely
- SharePoint → Enterprise tool, not using
- Duplicates → Redundant storage

---

## Disk Usage Impact

### Before Reorganization (October 2025)
- `/home/user/repository/`: 30GB
- Total server disk usage: 108GB / 468GB (23%)

### After Reorganization (November 2025)
- `/home/user/repository/`: 5.6GB (reduced 81%)
- Total server disk usage: 89GB / 468GB (19%)
- **Space freed:** 19GB

### Drive Allocation

Repository content is on:
- **sdb (477GB SSD)** - Root filesystem at `/home/user`
- Fast access for development reference
- Plenty of capacity (356GB free after reorganization)

See `/home/user/docs/server/DRIVE_ARCHITECTURE.md` for drive strategy.

---

## File Placement Rules

### When Adding New Archives

**Add to `/home/user/repository/` if:**
- Development tool or framework
- Relevant to VG projects
- Will be referenced frequently
- Under 200MB per archive

**Transfer to laptop if:**
- Personal projects (game dev, creative tools)
- Very large datasets not needed on server
- Experimental/hobby projects

**Delete if:**
- Duplicate of existing file
- Clearly obsolete or replaced
- Can be easily re-downloaded
- Takes >1GB and rarely accessed

---

## Maintenance

### Monthly Review

Check for:
- New duplicates introduced
- Archives that should be deleted (obsolete tools)
- Unrelated content that should be removed

### Quarterly Cleanup

Consider:
- Deleting replaced tool versions
- Transferring personal projects to laptop
- Removing tools for abandoned projects

---

## See Also

- `/home/user/repository/CLAUDE.md` - Repository-specific Claude guidance
- `/home/user/repository/README.md` - Repository overview and statistics
- `/home/user/CLAUDE.md` - Server-level Claude guidance
- `/home/user/docs/server/DRIVE_ARCHITECTURE.md` - Dual-drive setup
- `/home/user/docs/README.md` - Documentation index

---

**Last Updated:** November 14, 2025
**Reorganization Status:** Complete
**Next Review:** February 2026
