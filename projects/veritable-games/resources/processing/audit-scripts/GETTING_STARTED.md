# Getting Started: Document Library Audit & Cleanup System

**Created**: February 23, 2026
**Status**: Phase 1 Ready, Phase 2-3 Planned
**Updated by**: Claude Code AI

## Overview

This guide walks you through the complete workflow for auditing, cleaning, and deduplicating the Veritable Games document library.

**Current Status**:
- ✅ Phase 1: Metadata Audit - READY FOR USE
- 🔄 Phase 2: Content Cleanup - Planned
- 🔄 Phase 3: Duplicate Detection - Planned

---

## Phase 1: Metadata Audit (2-3 weeks)

### What You're Doing

Reviewing metadata quality for ~2,561 documents in the Library collection. The system will:
1. Calculate quality scores (0-100) for each document
2. Identify missing/invalid metadata
3. Track formatting artifacts
4. Let you mark documents as fixed/reviewed/skipped
5. Create checkpoints for progress tracking

### Step-by-Step Setup

#### 1. Apply Database Migration

First, create the audit tables in PostgreSQL:

```bash
# Connect to the production database
docker exec veritable-games-postgres psql -U postgres -d veritable_games

# Run the migration (paste into psql prompt)
# Or run it directly:
docker exec veritable-games-postgres psql -U postgres -d veritable_games < \
  /home/user/projects/veritable-games/resources/sql/007-create-metadata-audit-and-duplicate-detection-schema.sql

# Verify tables were created
SELECT tablename FROM pg_tables WHERE schemaname = 'library' AND tablename LIKE '%audit%';
```

**Expected Output**:
```
     tablename
------------------
 metadata_audit_log
 audit_checkpoints
```

#### 2. Initialize the Audit

This scans all ~2,561 Library documents and calculates quality scores (10-15 minutes):

```bash
cd /home/user/projects/veritable-games/resources/processing/audit-scripts

# Set database URL (if not already set in environment)
export DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games"

# Run initialization
python3 metadata_audit.py init --schema library
```

**Expected Output**:
```
INFO - Initializing metadata audit for schema: library
INFO - Found 2561 documents in library schema
INFO - Cleared previous audit data for library
INFO - Processed 100/2561 documents
...
INFO - Audit Statistics:
  Total Documents: 2561
  Average Quality Score: 52.3
  CRITICAL (0-39): 1193
  POOR (40-59): 527
  GOOD (60-79): 468
  EXCELLENT (80-100): 373
```

#### 3. Check Your Progress

```bash
python3 metadata_audit.py status
```

**Expected Output**:
```
=== Audit Status ===
Total Documents: 2561
Pending: 2561
In Review: 0
Reviewed: 0
Fixed: 0
Skipped: 0

Quality Scores:
  Average: 52.3
  Min: 0
  Max: 100

Priority Distribution:
  CRITICAL (0-39): 1193
  POOR (40-59): 527
  GOOD (60-79): 468
  EXCELLENT (80-100): 373
```

### Reviewing Documents

#### Basic Workflow

```bash
# 1. Get next batch to review (10 documents, lowest quality first)
python3 metadata_audit.py next --count 10

# Output will show:
# ID: 123 (library.document-slug-123)
#   Quality Score: 15
#   Issues: 4
#     - [critical] missing_author: Author field is empty
#     - [critical] missing_publication_date: Publication date is empty
#     - [high] insufficient_content: Content too short (42 words, minimum 100)
```

#### For Each Document

1. **Look up in database**:
   ```sql
   SELECT * FROM library.library_documents WHERE slug = 'document-slug-123';
   ```

2. **Try to fix metadata** (if you can find info):
   - Search for the author online
   - Find publication year
   - Improve title if needed

3. **Update the database**:
   ```sql
   UPDATE library.library_documents
   SET author = 'Author Name',
       publication_date = '2020'
   WHERE slug = 'document-slug-123';
   ```

4. **Mark as fixed**:
   ```bash
   python3 metadata_audit.py mark-fixed 123 --notes "Added author and publication year"
   ```

5. **Or if already good**, mark as reviewed:
   ```bash
   python3 metadata_audit.py mark-reviewed 123 --notes "Metadata already correct"
   ```

6. **Or if can't fix**, skip it:
   ```bash
   python3 metadata_audit.py mark-skipped 123 --reason "Author unknown, couldn't verify"
   ```

#### Focusing on Critical Issues

Start with the worst documents to get quick wins:

```bash
# Get 50 CRITICAL documents (score 0-39)
python3 metadata_audit.py next --count 50 --max-score 39

# After fixing 10 documents, mark them
for i in {1..10}; do
    python3 metadata_audit.py mark-fixed $i --notes "Batch 1: Fixed"
done

# Then get next batch
python3 metadata_audit.py next --count 50 --max-score 39
```

### Progress Checkpoints

**After each batch** (e.g., every 50 documents), save progress:

```bash
python3 metadata_audit.py finalize-round --name "Library_Critical_Batch_1" \
  --notes "Reviewed 50 CRITICAL documents, 40 fixed"
```

This creates a checkpoint you can reference later.

### Monitoring Progress

```bash
# Quick status check
python3 metadata_audit.py status

# See which issues are most common
docker exec veritable-games-postgres psql -U postgres -d veritable_games << 'EOF'
SELECT
    jsonb_array_elements(issues_detected)->>'type' as issue_type,
    COUNT(*) as count
FROM library.metadata_audit_log,
     jsonb_array_elements(issues_detected)
WHERE audit_status = 'pending'
GROUP BY issue_type
ORDER BY count DESC;
EOF
```

### Timeline for Phase 1

**Realistic Schedule** (assuming 8 hours/day work):
- **1,193 CRITICAL documents**: 10-15 docs/hour = 80-120 hours = 1.5-2 weeks
- **527 POOR documents**: 15-20 docs/hour = 26-35 hours = 1-2 days
- **468 GOOD documents**: 20-30 docs/hour = 15-23 hours = 1 day
- **373 EXCELLENT documents**: 30-40 docs/hour = 9-12 hours = 2-4 hours

**Total**: 2-3 weeks of part-time work

---

## Phase 2: Content Cleanup (In Development)

### What You'll Be Doing

Removing formatting artifacts and fixing content quality issues.

**Tier 1: Structural Cleanup** (2-3 hours, automated)
- Remove page markers (`## Page 5`)
- Remove image references
- Remove HTML anchors
- Status: ✅ Ready to use (run cleanup_pdf_artifacts.py with `--tier 1`)

**Tier 2: Formatting Review** (4-6 hours, manual approval)
- Fix broken sentences
- Fix inappropriate code blocks
- Unicode normalization
- Status: 🔄 In development

**Tier 3: Manual Polish** (8-12 hours, review only)
- OCR correction
- Smart header detection
- Status: 🔄 Planned (after Phase 1)

### Timeline

Can run in parallel with Phase 1:
- After Phase 1 initialization (10-15 min), run Tier 1
- During Phase 1 review, integrate Tier 2 results
- After Phase 1 complete, do Tier 3 on flagged documents

---

## Phase 3: Duplicate Detection (In Development)

### What You'll Be Doing

Identifying and merging ~1,200-1,900 duplicate documents across all 4 collections.

**3 Detection Layers**:
1. **Exact Match** (confidence 1.0) - ~500-800 duplicates
2. **Fuzzy Match** (confidence 0.75-0.95) - ~400-600 duplicates
3. **Near Duplicate** (confidence 0.70-0.90) - ~300-500 duplicates

### Timeline

1-2 weeks total:
- Fingerprint generation: 20-30 min
- Duplicate detection: 10-15 min
- Manual review: 40-80 hours
- Merging: 5-10 hours

---

## Common Tasks

### Update Document Metadata

```sql
-- Update author and publication date
UPDATE library.library_documents
SET author = 'Author Name',
    publication_date = '2020-05-15'
WHERE slug = 'document-slug';

-- Verify the change
SELECT slug, author, publication_date
FROM library.library_documents
WHERE slug = 'document-slug';
```

### Find Documents with Specific Issues

```sql
-- Find all documents with missing authors
SELECT id, slug, quality_score
FROM library.metadata_audit_log
WHERE issues_detected @> '[{"type": "missing_author"}]'
ORDER BY quality_score ASC;

-- Find all documents with formatting artifacts
SELECT id, slug,
       jsonb_array_length(issues_detected) as issue_count
FROM library.metadata_audit_log
WHERE issues_detected @> '[{"type": "page_markers"}]'
ORDER BY id;
```

### Batch Update Status

```bash
# Mark multiple documents as reviewed
for audit_id in 1 2 3 4 5; do
    python3 metadata_audit.py mark-reviewed $audit_id --notes "Batch review"
done

# Finalize the round
python3 metadata_audit.py finalize-round --name "Library_Review_$(date +%Y%m%d)"
```

### Check Audit History

```bash
# See all audit rounds
docker exec veritable-games-postgres psql -U postgres -d veritable_games << 'EOF'
SELECT round_number, round_name, total_documents, reviewed_count, fixed_count,
       average_quality_score, created_at
FROM library.audit_checkpoints
ORDER BY round_number DESC;
EOF
```

### Reset if Needed

```bash
# Clear all audit data (WARNING: Deletes all progress!)
docker exec veritable-games-postgres psql -U postgres -d veritable_games << 'EOF'
DELETE FROM library.metadata_audit_log;
DELETE FROM library.audit_checkpoints;
EOF

# Remove progress file
rm /home/user/projects/veritable-games/resources/logs/audit_progress.json

# Re-initialize
python3 metadata_audit.py init --schema library
```

---

## Troubleshooting

### Error: "relation 'library.metadata_audit_log' does not exist"

The migration hasn't been applied yet. Run:

```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games < \
  /home/user/projects/veritable-games/resources/sql/007-create-metadata-audit-and-duplicate-detection-schema.sql
```

### Error: "DATABASE_URL environment variable not set"

Set it in your shell:

```bash
export DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games"
```

Or add to `.bashrc` for persistence:

```bash
echo 'export DATABASE_URL="postgresql://postgres:postgres@veritable-games-postgres:5432/veritable_games"' >> ~/.bashrc
source ~/.bashrc
```

### Documents not showing issues after init

Issues are calculated during `init`. If you just added data, run init again:

```bash
python3 metadata_audit.py init --schema library
```

### Want to audit a different collection

Currently Library is the focus. To add other collections:

```bash
# Anarchist
python3 metadata_audit.py init --schema anarchist

# Then review
python3 metadata_audit.py next --count 10 --max-score 39
```

### Slow database queries

Add indexes if not present:

```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games << 'EOF'
CREATE INDEX IF NOT EXISTS idx_audit_status ON library.metadata_audit_log(audit_status);
CREATE INDEX IF NOT EXISTS idx_quality_score ON library.metadata_audit_log(quality_score);
CREATE INDEX IF NOT EXISTS idx_issues_count ON library.metadata_audit_log(issues_count);
EOF
```

---

## File Locations Reference

```
/home/user/projects/veritable-games/resources/processing/audit-scripts/
├── metadata_audit.py              # Main CLI tool
├── issue_detectors.py             # Issue detection algorithms
├── generate_document_fingerprints.py  # Phase 3: Fingerprint generation
├── detect_duplicates.py           # Phase 3: Duplicate detection
├── merge_duplicates.py            # Phase 3: Merging duplicates
├── README.md                      # Full documentation
├── IMPLEMENTATION_PLAN.md         # Complete architecture
├── GETTING_STARTED.md             # This file
└── __pycache__/                   # Python cache (ignore)

Logs:
/home/user/projects/veritable-games/resources/logs/
├── metadata_audit.log             # Phase 1 audit log
├── fingerprint_generation.log     # Phase 3 fingerprint log
├── duplicate_detection.log        # Phase 3 detection log
├── duplicate_merge.log            # Phase 3 merge log
└── audit_progress.json            # Phase 1 progress checkpoint

Database:
postgresql://veritable-games-postgres/veritable_games
├── library.metadata_audit_log     # Phase 1 audit tracking
├── library.audit_checkpoints      # Phase 1 progress snapshots
├── shared.document_fingerprints   # Phase 3 hashes
├── shared.duplicate_clusters      # Phase 3 identified clusters
└── shared.cluster_documents       # Phase 3 cluster membership
```

---

## Success Checklist

### Phase 1 Completion
- ✅ Database migration applied
- ✅ Audit initialized (2,561 documents scanned)
- ✅ Quality scores calculated
- ✅ Reviewed and fixed 80%+ of CRITICAL documents (1,193)
- ✅ Reviewed and fixed 80%+ of POOR documents (527)
- ✅ Author completion: 95%+
- ✅ Publication date completion: 80%+

### Phase 2 Completion
- ✅ Tier 1 cleanup: All documents processed
- ✅ Tier 2 cleanup: 30% of documents reviewed and fixed
- ✅ Tier 3 cleanup: Flagged documents reviewed
- ✅ Average file size reduction: 10-15%

### Phase 3 Completion
- ✅ Fingerprints generated for all 93,000 documents
- ✅ 1,200-1,900 duplicate clusters identified
- ✅ Manual review of high-confidence clusters complete
- ✅ 3-5% corpus reduction achieved
- ✅ 100% tag preservation verified

---

## Next Steps

1. **Now**: Apply database migration
2. **Today**: Initialize audit on Library collection
3. **This week**: Start reviewing CRITICAL documents
4. **Next week**: Continue with POOR and GOOD documents
5. **Week 3**: Complete audit, start Phase 2 cleanup
6. **Week 4**: Start Phase 3 duplicate detection

---

## Help & Documentation

- **README.md** - Complete feature documentation
- **IMPLEMENTATION_PLAN.md** - Full architecture and design
- **Logs** - Check `/home/user/projects/veritable-games/resources/logs/` for detailed logs
- **Database** - Query tables directly for detailed information

---

## Contact

Created by: Claude Code AI
Last Updated: February 23, 2026
Questions? Check the documentation files above.
