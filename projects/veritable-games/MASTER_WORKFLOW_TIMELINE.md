# Veritable Games Library: Master Workflow & Timeline
**Created:** November 28, 2025
**Status:** 🔄 IN PROGRESS - Stage 1 Active
**Purpose:** Complete roadmap from content acquisition to production deployment

---

## 🎯 Vision: The Complete Library System

Transform 4,449 scattered documents into a fully-tagged, searchable library with:
- **Source PDFs** for all documents
- **Clean markdown** conversions
- **Complete metadata** (authors, dates, tags)
- **Unified tag schema** across collections
- **Production deployment** on https://www.veritablegames.com

---

## 📊 Current State (December 1, 2025)

### Content Inventory
| Collection | Total Docs | Sourced PDFs | Converted | Metadata | Tags |
|------------|-----------|--------------|-----------|----------|------|
| **Anarchist Library** | 24,643 | ✅ Complete | ✅ Complete | ✅ High | ✅ 19,952 tags |
| **User Library (RFR)** | 2,576 | ✅ Has PDFs | ✅ 2,539 converted | ✅ Backed up | ⏳ Pending |
| **NSD High-Value** | 114 | 🔄 33 sourced | 🔄 In queue | 📁 Archived | 📁 Archived |
| **TOTAL** | **27,333** | **~27,300** | **27,182** | **Varies** | **19,952** |

### Progress Metrics
- **NSD Status**: ❌ REMOVED (Nov 30, 2025) - Low quality HTML scrapes deleted
- **NSD Archive**: 1,873 docs + 14,225 tags archived to `nsd-final-archive/`
- **NSD Sourcing**: 33/114 high-value docs sourced (29%) - 295 PDFs in conversion queue
- **PDF Conversion**: ✅ 2,539/2,834 converted (89.6%) - 295 remaining
- **Metadata Extraction**: Ready (527/3,880 historical success = 13.6%)
- **Tag Schema**: ✅ Implemented (194,664 - 14,225 = 180,439 associations remaining)
- **Database**: ✅ Production ready (shared.tags, triggers installed)

---

## 🗺️ The Complete 5-Stage Pipeline

### **STAGE 1: Content Acquisition** 🔄 IN PROGRESS

**Goal:** Obtain source PDFs and convert to clean markdown

#### 1A: NSD Document Sourcing ❌ ARCHIVED (November 30, 2025)

**Status**: REMOVED - Low quality HTML scrapes deleted from database
**Archive**: `/home/user/projects/veritable-games/resources/processing/nsd-final-archive/`

**What happened:**
- 1,873 NSD documents were low-quality HTML scrapes with broken formatting
- Deleted from database, metadata archived to CSV files
- 85 already-sourced PDFs moved to main conversion queue

**If resuming NSD sourcing in future:**
- Use `nsd_documents_metadata.csv` to identify needed documents
- Source PDFs and add to `reconversion-pdfs/` directory
- Process through standard PDF→markdown pipeline

---

#### 1B: PDF Conversion (RFR Documents) 🔄 ACTIVE
**Current**: 900/2,535 documents (35.5%)
**Remaining**: 1,635 documents
**Time**: ~24-48 hours (at 3.5 min/PDF avg)
**Status**: Running with v3 fixes (memory management + proper tracking)

**Process:**
1. Convert PDF → markdown (marker_single w/ GPU)
2. Apply cleanup (75% artifact removal rate)
3. Track progress (resumed from 900)

**Improvements (v3):**
- ✅ Fixed tracking (attempted_failed vs bogus failures)
- ✅ Memory monitoring (kills at 12GB to prevent OOM)
- ✅ Better error detection (timeout/OOM identification)

**Documentation:**
- `/home/user/projects/veritable-games/resources/processing/reconversion-scripts/README_COMPLETE_WORKFLOW.md`
- `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`

**Scripts:**
- Active: `phase2b_convert_pdfs_v3_fixed.sh`
- Monitor: `tail -f /home/user/projects/veritable-games/resources/logs/phase2b_v3_nohup.log`

**Success Criteria:**
- ✅ <1% failure rate (currently 0%)
- ✅ Readable markdown output
- ✅ Artifact cleanup applied

---

### **STAGE 2: Metadata Extraction** ⏳ READY (Awaits Stage 1)

**Goal:** Extract authors, dates, tags from markdown content

#### 2A: Metadata Extraction from Content
**Input:** Converted markdown files (Stage 1B output)
**Output:** Structured metadata (JSON)
**Time:** ~2-4 hours for 2,535 documents
**Success Rate:** 78.7% (historical from 527/3,880 Phase 1)

**Extraction Strategies** (ranked by confidence):
1. **Structured Metadata** (85-95% accuracy) - "By [Author], Date: [date]"
2. **Footer Author** (60-70%) - Standalone author in footer
3. **Date Patterns** (40-50%) - Standard date formats
4. **"Written by"** (40-60%) - Explicit authorship statements
5. **Academic Format** (40-50%) - Name-only in header
6. **Filename Mining** (30-40%) - Extract from PDF filename

**Documentation:**
- `/home/user/docs/veritable-games/LIBRARY_METADATA_EXTRACTION_REPORT.md`
- `/home/user/docs/veritable-games/PHASE_2_DIRECT_EXTRACTION_REPORT.md`
- `/home/user/docs/veritable-games/PHASE_3_ENHANCED_EXTRACTION_REPORT.md`

**Script:**
- `extract_library_metadata.py` (adapt for RFR documents)
- Located in: `/home/user/projects/veritable-games/resources/scripts/`

**What Gets Extracted:**
- Author(s)
- Publication date
- Title (cleaned)
- Source URL (if embedded)

---

#### 2B: Tag Extraction
**Input:** Converted markdown + metadata
**Output:** Tags → shared.tags schema
**Time:** ~1-2 hours for 2,535 documents

**Process:**
1. Keyword extraction from content
2. Deduplicate against existing 19,952 tags
3. Create tag associations
4. Update usage_count (automatic via triggers)

**Documentation:**
- `/home/user/docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md`

**Script:**
- Adapt: `extract_and_import_anarchist_tags.py`
- Database: Uses shared.tags (already set up)

**Tag Schema:**
- Table: `shared.tags` (19,952 existing tags)
- Associations: `library.document_tags` (links to documents)
- Triggers: ✅ Auto-update usage_count

---

### **STAGE 3: Database Import** ⏳ READY (Awaits Stage 2)

**Goal:** Import reconverted documents with metadata to production database

#### 3A: RFR Document Updates (Phase 3-6 Workflow)
**Input:**
- Cleaned markdown from Phase 2b
- Metadata from Stage 2
- Original metadata backup (Phase 1a)

**Output:** Updated library.documents table

**Workflow** (Already Scripted - 6 Phases):

**Phase 3: Metadata Injection** (~15 minutes)
- Inject YAML frontmatter into markdown
- Script: `phase3_inject_metadata.py`
- Output: `/home/user/projects/veritable-games/resources/processing/reconversion-output-final/*.md`

**Phase 4: Database Updates** (~30 minutes)
- Generate UPDATE statements
- Execute with transaction safety
- Script: `phase4_generate_update_sql.py`
- Safety: NSD documents auto-skipped (database trigger)

**Phase 5: Verification** (~20 minutes)
- Verify metadata preservation
- Check reconversion_status
- Script: `phase5_verify_metadata.py`
- Output: Comprehensive verification report

**Phase 6: Cleanup** (~5 minutes)
- Archive logs/progress
- Remove temporary files
- Script: `phase6_cleanup_and_report.py`
- Option: Keep/remove NSD trigger

**Documentation:**
- Complete 6-phase guide: `/home/user/projects/veritable-games/resources/processing/reconversion-scripts/README_COMPLETE_WORKFLOW.md`

**Success Criteria:**
- ✅ All RFR documents updated
- ✅ 100% metadata preservation
- ✅ NSD documents protected/unchanged
- ✅ reconversion_status = 'reconverted'

---

#### 3B: NSD Document Import (New Workflow)
**Input:**
- Sourced PDFs (from Stage 1A)
- Metadata extraction (from Stage 2)

**Process:**
1. Convert sourced PDFs to markdown
2. Extract metadata
3. Insert into library.documents
4. Update source_status = 'sourced'
5. Link tags

**Time:** ~4-6 hours for 400 documents

**Script:** TBD (adapt Phase 3-6 workflow)

**Success Criteria:**
- ✅ Clean markdown import
- ✅ Metadata extracted
- ✅ Source PDF linked
- ✅ source_status updated

---

### **STAGE 4: Tag System Completion** ⏳ READY (Awaits Stage 3)

**Goal:** Complete unified tag coverage for all 29,092 documents

#### 4A: Tag Extraction for RFR Documents
**Input:** 2,535 reconverted RFR documents
**Output:** New tags → shared.tags, associations → library.document_tags
**Time:** ~2-3 hours

**Process:**
1. Extract keywords from content
2. Add new tags to shared.tags
3. Create document_tags associations
4. Triggers auto-update usage_count

---

#### 4B: Tag Extraction for NSD Documents
**Input:** 400 newly sourced documents
**Output:** Tags + associations
**Time:** ~30-60 minutes

**Total Expected:**
- Current tags: 19,952
- Estimated new: 5,000-8,000 (many will be duplicates)
- Final: ~25,000 unique tags

---

### **STAGE 5: Production Deployment** ⏳ READY (Awaits Stage 4)

**Goal:** Deploy complete library to production site

#### 5A: API Verification
**Check:**
- ✅ Anarchist tags API: `/api/documents/anarchist/[slug]/tags`
- ✅ Library tags API: `/api/library/documents/[slug]/tags`
- ✅ Tag search/filter endpoints
- ✅ Document listing with tag counts

**Status:** Already deployed (from previous work)

---

#### 5B: Frontend Integration
**Verify:**
- ✅ Document pages show tags
- ✅ Tag filtering works
- ✅ Tag pages list documents
- ✅ Search includes tag-based results

**Testing:**
- https://www.veritablegames.com/library
- https://www.veritablegames.com/anarchist-library

---

#### 5C: Final Deployment
**Process:**
1. Verify all database migrations complete
2. Run production verification scripts
3. Update documentation
4. Deploy via git push → Coolify

**Documentation:**
- Site CLAUDE.md: `/home/user/projects/veritable-games/site/CLAUDE.md`
- Deployment guide (in site docs)

**Success Criteria:**
- ✅ All 29,092 documents accessible
- ✅ Tags working across both collections
- ✅ Search functional
- ✅ No broken links/missing content

---

## ⏰ Complete Timeline

### Immediate (Next 48 Hours)
- 🔄 **Stage 1A**: Finish NSD sourcing (22 docs to 400) - 2-4 hours
- 🔄 **Stage 1B**: Complete PDF conversion (1,635 remaining) - 24-48 hours

### Short-term (3-7 Days)
- ⏳ **Stage 2A**: Extract metadata from 2,535 docs - 2-4 hours
- ⏳ **Stage 2B**: Extract tags - 1-2 hours
- ⏳ **Stage 3A**: Import RFR documents (Phase 3-6) - 2 hours
- ⏳ **Stage 3B**: Import NSD documents - 4-6 hours

### Medium-term (1-2 Weeks)
- ⏳ **Stage 4**: Complete tag extraction for all documents - 4-6 hours
- ⏳ **Stage 5**: Production verification and deployment - 4-6 hours

### **TOTAL ESTIMATED TIME TO COMPLETION: 1-2 weeks**

---

## 📁 Documentation Structure (Organized)

### Master Documents
```
/home/user/projects/veritable-games/
├── MASTER_WORKFLOW_TIMELINE.md         ← THIS FILE (master roadmap)
├── CLAUDE.md                            ← Updated with workflow references
└── site/
    └── CLAUDE.md                        ← VG site development guide
```

### Stage-Specific Documentation
```
/home/user/docs/veritable-games/
├── LIBRARY_METADATA_EXTRACTION_REPORT.md    # Stage 2A
├── UNIFIED_TAG_SCHEMA_STATUS.md             # Stage 2B, 4
├── PHASE_2_DIRECT_EXTRACTION_REPORT.md      # Stage 2A details
├── PHASE_3_ENHANCED_EXTRACTION_REPORT.md    # Stage 2A advanced
├── LIBRARY_IMPORT_VERIFICATION_COMPLETE.md  # Stage 3 verification
└── CONTENT_COLLECTIONS.md                   # Overall collections info
```

### Workflow Guides
```
/home/user/projects/veritable-games/resources/
├── processing/
│   ├── reconversion-scripts/
│   │   └── README_COMPLETE_WORKFLOW.md      # Stage 3A (Phase 3-6)
│   └── nsd-cleanup-scripts/
│       └── (sourcing scripts)                # Stage 1A
└── data/
    └── PDF_CONVERSION_WORKFLOW.md            # Stage 1B
```

### Logs & Progress
```
/home/user/projects/veritable-games/resources/logs/
├── phase2b_v3_nohup.log                     # Stage 1B active log
├── phase2b_conversion.log                   # Stage 1B detailed
└── nsd-cleanup/
    └── phase3/                              # Stage 1A logs & reports
```

---

## 🚀 Quick Action Guide

### Check Current Progress
```bash
# Stage 1B: PDF Conversion
tail -f /home/user/projects/veritable-games/resources/logs/phase2b_v3_nohup.log

# Check progress file
cat /home/user/projects/veritable-games/resources/processing/reconversion-scripts/phase2b_progress.json | python3 -m json.tool
```

### Run Next Stage (When Ready)
```bash
# Stage 2A: Extract metadata
cd /home/user/projects/veritable-games/resources/scripts
python3 extract_library_metadata.py  # (adapt for RFR docs)

# Stage 3A: Import RFR documents (Phases 3-6)
cd /home/user/projects/veritable-games/resources/processing/reconversion-scripts
python3 phase3_inject_metadata.py
python3 phase4_generate_update_sql.py --execute
python3 phase5_verify_metadata.py
python3 phase6_cleanup_and_report.py
```

### Monitor Database
```bash
# Check document counts
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT
  reconversion_status,
  COUNT(*)
FROM library.documents
GROUP BY reconversion_status;
"

# Check tag coverage
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
SELECT
  COUNT(DISTINCT dt.document_id) as docs_with_tags,
  (SELECT COUNT(*) FROM library.documents) as total_docs
FROM library.document_tags dt;
"
```

---

## 🎯 Decision Points

### Decision 1: NSD Sourcing Target
**Options:**
- **A)** Stop at 400 (achievable, 21.2% coverage)
- **B)** Push to 500 (stretch, 26.5% coverage, +20-30 hours)
- **C)** Accept 378 and move forward (current, 20.0%)

**Recommendation:** Option A (finish to 400, then proceed)

---

### Decision 2: Tag Extraction Timing
**Options:**
- **A)** Extract tags immediately after each stage (incremental)
- **B)** Extract all tags at once after all imports (batch)

**Recommendation:** Option B (batch processing more efficient)

---

### Decision 3: NSD Trigger Removal
**When:** After Stage 3A complete (RFR documents imported)
**Options:**
- **A)** Keep trigger permanently (safety)
- **B)** Remove trigger (allow NSD updates in future)

**Recommendation:** Option B (remove after import verified)

---

## 📋 Success Criteria

### Stage 1 Success
- ✅ 400+ NSD documents sourced
- ✅ 2,535 PDFs converted to clean markdown
- ✅ <1% conversion failure rate
- ✅ All progress tracked and resumable

### Stage 2 Success
- ✅ 70%+ metadata extraction rate
- ✅ Tags extracted from all documents
- ✅ Deduplicated against shared.tags

### Stage 3 Success
- ✅ All RFR documents updated in database
- ✅ All NSD documents imported to database
- ✅ 100% metadata preservation verified
- ✅ reconversion_status/source_status updated

### Stage 4 Success
- ✅ All 29,092 documents have tags
- ✅ shared.tags has ~25,000 unique tags
- ✅ Tag associations created
- ✅ usage_count accurate

### Stage 5 Success
- ✅ Production deployment verified
- ✅ All documents accessible on site
- ✅ Tag search/filter working
- ✅ No broken links

---

## 🔥 Emergency Procedures

### Stage 1B Failed (PDF Conversion)
```bash
# Check what failed
cat /home/user/projects/veritable-games/resources/processing/reconversion-scripts/phase2b_progress.json

# Resume from where it stopped
cd /home/user/projects/veritable-games/resources/processing/reconversion-scripts
bash phase2b_convert_pdfs_v3_fixed.sh
```

### Database Rollback
```bash
# Restore from Phase 1c backup
gunzip -c /home/user/projects/veritable-games/resources/processing/reconversion-scripts/phase1c_backup.sql.gz | \
  docker exec -i veritable-games-postgres psql -U postgres -d veritable_games
```

### Out of Disk Space
```bash
# Check space
df -h

# Clear Docker cache
docker system prune -a

# Archive old logs
mv /home/user/projects/veritable-games/resources/logs/*.log.old /external/drive/
```

---

## 📞 Support & References

**This Master Document:** `/home/user/projects/veritable-games/MASTER_WORKFLOW_TIMELINE.md`

**Stage Guides:**
- Stage 1A: NSD sourcing reports in `/home/user/projects/veritable-games/resources/logs/nsd-cleanup/phase3/`
- Stage 1B: `/home/user/projects/veritable-games/resources/data/PDF_CONVERSION_WORKFLOW.md`
- Stage 2A: `/home/user/docs/veritable-games/LIBRARY_METADATA_EXTRACTION_REPORT.md`
- Stage 2B/4: `/home/user/docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md`
- Stage 3A: `/home/user/projects/veritable-games/resources/processing/reconversion-scripts/README_COMPLETE_WORKFLOW.md`

**Server Guide:** `/home/user/CLAUDE.md` (server operations)
**Site Guide:** `/home/user/projects/veritable-games/site/CLAUDE.md` (development)

---

**Last Updated:** November 30, 2025
**Status:** Active - Stage 1B (PDF conversion) in progress
**Next Milestone:** Complete Stage 1B (2,626 PDFs in queue)
**Estimated Completion:** December 10-15, 2025

---

*This is your master reference document. All future Claude sessions should start here to understand the complete pipeline.*
