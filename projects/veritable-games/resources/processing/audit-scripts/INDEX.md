# Document Audit & Cleanup System - Complete Index

**Status**: ✅ Phase 1 READY | 🔄 Phase 2-3 PLANNED
**Created**: February 23, 2026
**Updated**: February 23, 2026

---

## 📚 Documentation Files

### Quick Start
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** ← START HERE
  - Step-by-step setup instructions
  - Common tasks and workflows
  - Troubleshooting guide
  - Timeline and checklist

### Full Documentation
- **[README.md](./README.md)** - Complete feature guide
  - What each phase does
  - Quality scoring algorithm
  - Issue types and detection
  - Database schema overview

- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Architecture & design
  - Full 3-phase workflow
  - Technical architecture
  - Success criteria
  - Risk mitigation

### This File
- **[INDEX.md](./INDEX.md)** - Documentation index (you are here)

---

## 🛠️ Scripts & Tools

### Phase 1: Metadata Audit ✅ READY

**Main CLI Tool**:
```bash
python3 metadata_audit.py [command] [options]
```

**Commands**:
- `init` - Initialize audit (scan all documents)
- `next` - Get next batch to review
- `mark-fixed` - Mark as fixed
- `mark-reviewed` - Mark as reviewed
- `mark-skipped` - Mark as skipped
- `status` - Show progress
- `finalize-round` - Create checkpoint

**Module**:
```bash
python3 issue_detectors.py
```
- Issue detection algorithms
- Quality scoring (0-100)
- Formatting artifact detection

### Phase 3: Duplicate Detection 🔄 READY

**Fingerprint Generation**:
```bash
python3 generate_document_fingerprints.py --source [library|anarchist|youtube|marxist|all]
```
- Generates MD5, SHA256, SimHash
- Calculates Soundex hashes
- ~500 docs/second

**Duplicate Detection**:
```bash
python3 detect_duplicates.py --layer [exact|fuzzy|simhash]
```
- Layer 1: Exact matches (confidence 1.0)
- Layer 2: Fuzzy matches (confidence 0.75-0.95)
- Layer 3: Near-duplicates (confidence 0.70-0.90)

**Merge Duplicates**:
```bash
python3 merge_duplicates.py [info|merge|auto-merge] [options]
```
- Merge high-confidence clusters
- Preserve tags from all versions
- Complete audit trail

---

## 📊 Database Schema

### Phase 1 Tables

**library.metadata_audit_log** (2,561+ rows)
- Audit status (pending, in_review, reviewed, fixed, skipped)
- Quality score (0-100)
- Issues detected (JSON array)
- Reviewer notes and timestamp

**library.audit_checkpoints** (versioned snapshots)
- Round number and name
- Statistics (total, pending, reviewed, fixed)
- Average quality score
- Timestamp and notes

### Phase 3 Tables

**shared.document_fingerprints** (93,000+ rows)
- MD5, SHA256, normalized MD5
- Soundex hashes (title, author)
- 64-bit SimHash fingerprint
- Word count, created/updated times

**shared.duplicate_clusters** (1,200-1,900 rows)
- Cluster type (exact_match, fuzzy_match, near_duplicate)
- Confidence score (0.00-1.00)
- Review status (pending, confirmed, false_positive, merged)
- Reviewer and timestamp

**shared.cluster_documents** (junction table)
- Links documents to clusters
- Marks canonical document

---

## 🎯 Phase 1: Metadata Audit

### What It Does

Identifies and tracks quality issues in document metadata:
- Missing/invalid authors
- Missing/invalid publication dates
- Title problems
- Content quality issues
- Formatting artifacts

### Quality Scoring (0-100)

| Issue | Deduction | Type |
|-------|-----------|------|
| Missing author | -40 | CRITICAL |
| Placeholder author ("Unknown") | -40 | CRITICAL |
| Missing publication date | -30 | CRITICAL |
| Invalid date format | -30 | CRITICAL |
| Future date (>2026) | -25 | HIGH |
| Truncated author | -25 | HIGH |
| Missing title | -20 | CRITICAL |
| Wiki suffix in title | -10 | MEDIUM |
| Insufficient content (<100 words) | -10 | HIGH |
| Other issues | -5 to -15 | LOW/MEDIUM |

### Priority Distribution (Library Collection)

| Category | Score | Count | Percentage | Action |
|----------|-------|-------|-----------|--------|
| CRITICAL | 0-39 | 1,193 | 46.6% | **IMMEDIATE REVIEW** |
| POOR | 40-59 | 527 | 20.6% | Review this week |
| GOOD | 60-79 | 468 | 18.3% | Review if time |
| EXCELLENT | 80-100 | 373 | 14.6% | Spot-check only |

### Workflow

```
1. Init audit (10-15 min) → Scan all 2,561 documents
   ↓
2. Get next batch → `python3 metadata_audit.py next --count 10`
   ↓
3. For each document:
   a. Look up in database
   b. Try to fix metadata (search online)
   c. Update database (SQL or UI)
   d. Mark as fixed/reviewed/skipped
   ↓
4. After batch → `finalize-round` to create checkpoint
   ↓
5. Repeat → Continue with next batch
```

### Timeline

- **CRITICAL** (1,193 docs): 80-120 hours = 1.5-2 weeks @ 8h/day
- **POOR** (527 docs): 26-35 hours = 1-2 days
- **GOOD** (468 docs): 15-23 hours = 1 day
- **EXCELLENT** (373 docs): 9-12 hours = 2-4 hours

**Total**: 2-3 weeks part-time work

---

## 🔄 Phase 2: Content Cleanup

### Tier 1: Structural (100% Safe, Automated)

Removes known artifacts:
- Page markers (`## Page 5`)
- Image references (`![...](images/...)`)
- HTML anchors
- Form feeds, excessive blank lines

**Time**: 2-3 hours (all 2,561 docs)
**Status**: ✅ Existing cleanup_pdf_artifacts.py

### Tier 2: Formatting (Manual Review)

Fixes formatting issues:
- Inappropriate code blocks
- Header hierarchy
- Broken sentences
- Unicode normalization
- Punctuation spacing

**Time**: 4-6 hours (~30% of docs)
**Status**: 🔄 In development

### Tier 3: Manual Polish

Reviews content for OCR and hyphenation issues:
- OCR corruption
- Broken words
- Smart header detection

**Time**: 8-12 hours (flagged docs)
**Status**: 🔄 Planned

---

## 🔍 Phase 3: Duplicate Detection

### Detection Layers

| Layer | Method | Confidence | Count | Examples |
|-------|--------|-----------|-------|----------|
| 1: Exact Match | MD5 hash | 1.0 (100%) | 500-800 | Identical content |
| 2: Fuzzy Match | Levenshtein + Soundex | 0.75-0.95 | 400-600 | "Lenin" vs "Vladimir Ilyich" |
| 3: Near-Duplicate | SimHash fingerprint | 0.70-0.90 | 300-500 | One paragraph added |

### Merging Strategy

- **Auto-merge**: >0.95 confidence
- **Manual review**: 0.75-0.95 confidence
- **Skip**: <0.75 confidence

**Result**: 3-5% corpus reduction (~2,800-5,000 docs removed)
**Tags**: 100% preserved from all versions

### Timeline

- Fingerprints: 20-30 min
- Detection: 10-15 min
- Manual review: 40-80 hours
- Merging: 5-10 hours

---

## 📍 File Locations

```
/home/user/projects/veritable-games/resources/
├── processing/audit-scripts/
│   ├── metadata_audit.py                    ← Main Phase 1 CLI
│   ├── issue_detectors.py                   ← Issue detection
│   ├── generate_document_fingerprints.py    ← Phase 3 fingerprints
│   ├── detect_duplicates.py                 ← Phase 3 detection
│   ├── merge_duplicates.py                  ← Phase 3 merging
│   ├── README.md                            ← Full docs
│   ├── IMPLEMENTATION_PLAN.md               ← Architecture
│   ├── GETTING_STARTED.md                   ← Setup guide
│   └── INDEX.md                             ← This file
├── sql/
│   └── 007-create-metadata-audit-and-duplicate-detection-schema.sql
├── logs/
│   ├── metadata_audit.log
│   ├── fingerprint_generation.log
│   ├── duplicate_detection.log
│   ├── duplicate_merge.log
│   └── audit_progress.json
└── scripts/
    └── cleanup_pdf_artifacts.py             ← Phase 2 cleanup
```

---

## 🚀 Quick Start

### 1. Initialize (First Time Only)

```bash
# Apply database migration
docker exec veritable-games-postgres psql -U postgres -d veritable_games < \
  /home/user/projects/veritable-games/resources/sql/007-create-metadata-audit-and-duplicate-detection-schema.sql

# Go to script directory
cd /home/user/projects/veritable-games/resources/processing/audit-scripts

# Set database URL
export DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games"

# Initialize audit
python3 metadata_audit.py init --schema library
```

### 2. Start Reviewing

```bash
# Get next 10 CRITICAL documents
python3 metadata_audit.py next --count 10 --max-score 39

# For each document, look it up and fix metadata
# Then mark as fixed/reviewed/skipped
python3 metadata_audit.py mark-fixed 123 --notes "Added author and year"
```

### 3. Check Progress

```bash
python3 metadata_audit.py status
```

### 4. Save Checkpoints

```bash
python3 metadata_audit.py finalize-round --name "Round_$(date +%Y%m%d)" \
  --notes "Reviewed X documents"
```

---

## ✅ Success Metrics

### Phase 1
- Author field: 95%+ complete
- Publication date: 80%+ complete
- Content quality: 95%+ >100 words
- Issue tracking: 100% of documents scanned

### Phase 2
- File size reduction: 10-15%
- Readability improvement: 95%+ documents
- Artifact removal: 100% page markers, images
- Meaning preservation: 100%

### Phase 3
- Deduplication rate: 3-5% corpus reduction
- Data loss: 0% (100% tag preservation)
- Confidence: 100% on >0.95 confidence merges
- Tag preservation: 100% from all merged versions

---

## 📞 Help & Support

**Questions?** Read:
1. [GETTING_STARTED.md](./GETTING_STARTED.md) - Setup and workflow
2. [README.md](./README.md) - Features and details
3. [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Architecture

**Stuck?** Check:
1. Log files in `/home/user/projects/veritable-games/resources/logs/`
2. Database queries for details: `SELECT ... FROM library.metadata_audit_log`
3. Troubleshooting section in GETTING_STARTED.md

---

## 📋 Workflow Overview

```
PHASE 1: METADATA AUDIT (2-3 weeks)
├─ Initialize (15 min)
├─ Review CRITICAL (1,193 docs, 120 hours)
├─ Review POOR (527 docs, 35 hours)
├─ Review GOOD (468 docs, 23 hours)
└─ Review EXCELLENT (373 docs, 12 hours)

PHASE 2: CONTENT CLEANUP (1-2 weeks, parallel)
├─ Tier 1: Structural (3 hours, automated)
├─ Tier 2: Formatting (6 hours, manual review)
└─ Tier 3: Polish (12 hours, manual review)

PHASE 3: DUPLICATE DETECTION (1 week)
├─ Generate fingerprints (30 min)
├─ Detect duplicates (15 min)
├─ Manual review (80 hours)
└─ Merge (10 hours)

TOTAL TIME: 3-4 weeks
```

---

## 🎓 Learning Resources

**Understanding Quality Scores**:
- Read issue_detectors.py for full scoring algorithm
- Check README.md Issue Types table
- Query database to see examples of each issue

**Understanding Duplicate Detection**:
- Read IMPLEMENTATION_PLAN.md Phase 3 section
- Review detect_duplicates.py for layer implementations
- Check confidence thresholds and examples

**Understanding Database**:
- Query library.metadata_audit_log to see audit data
- Query shared.document_fingerprints to see fingerprints
- Query shared.duplicate_clusters to see clusters

---

## 📅 Schedule Recommendations

**Week 1-2**: Phase 1 metadata audit
- Days 1-10: CRITICAL documents (1,193)
- Days 10-12: POOR documents (527)

**Week 2-3**: Phase 1 + Phase 2 cleanup
- Days 1-3: Finish GOOD/EXCELLENT documents
- Days 3-5: Run Tier 1 cleanup (automated)
- Days 5-7: Run Tier 2 cleanup (manual review)

**Week 4**: Phase 3 duplicate detection
- Day 1: Generate fingerprints + detect duplicates
- Days 2-6: Manual review of clusters
- Days 6-7: Merge and verify

---

**Created by**: Claude Code AI
**Status**: Phase 1 ✅ READY | Phase 2-3 🔄 PLANNED
**Last Updated**: February 23, 2026
