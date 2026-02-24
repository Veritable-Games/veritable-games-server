# Multi-Collection Audit Status - February 23, 2026

**Updated**: February 23, 2026 - Both Library and Marxist audits now active  
**Status**: Library ✅ COMPLETE | Marxist ⏳ IN PROGRESS | YouTube ⏳ READY | Anarchist ❌ BLOCKED

---

## 📊 Collection-by-Collection Status

### 1. Library Collection ✅ COMPLETE

**Status**: All 2,561 documents audited

```
Total:    2,561 documents
Fixed:    2,373 (92.7%) - Metadata improvements applied
Reviewed: 186 (7.3%)   - Legitimate stubs/excerpts
Skipped:  2 (0.07%)    - Unfixable stubs

Quality:  44.6/100 average
Critical: 1,198 documents (46.8%) - High improvement potential
Good:     1,306 documents (51.0%) - Satisfactory quality
```

**Next**: Deduplication review via admin UI (`/admin/duplicates`)

---

### 2. Marxist Collection ⏳ IN PROGRESS

**Status**: Audit initialized, first batch being reviewed

```
Total Documents:    12,728
Initialized:        ✅ Complete
Current Batch:      First 10 critical documents
All Pending:        12,728 (ready for review)

Quality:            54.3/100 average
Critical (0-39):    2,030 documents (15.9%)
Poor (40-59):       5,309 documents (41.7%)
Good (60-79):       3,105 documents (24.4%)
Excellent (80-100): 2,284 documents (17.9%)
```

**First Batch Observations**:
- Many documents have "Archive" as placeholder author (needs real author)
- Missing publication dates (need to research)
- Some documents have minimal content or unknown titles
- Similar metadata issues to Library collection

**How to Resume**:
```bash
cd /home/user/projects/veritable-games/resources/processing/audit-scripts
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veritable_games"

# Get next batch of critical documents
python3 marxist_metadata_audit.py next --count 10 --max-score 39

# After fixing in database
python3 marxist_metadata_audit.py mark-fixed AUDIT_ID --notes "Fixed author and date"

# Save progress every ~50 docs
python3 marxist_metadata_audit.py finalize-round --name "Marxist_Batch_$(date +%Y%m%d_%H%M%S)"
```

**Estimated Effort**: 20-30 hours @ 8h/day (Similar to Library audit just completed)

---

### 3. YouTube Collection ⏳ READY TO START

**Status**: Fingerprints generated, duplicates detected, audit system ready

```
Total Transcripts:  60,544
Fingerprints:       ✅ 60,544 generated (Phase 3A)
Duplicates:         217 documents in clusters (Phase 3B)
Audit Script:       ⏳ Ready to create (similar to Marxist)
Current Quality:    Unknown (not yet audited)
```

**Differences from Library/Marxist**:
- These are YouTube transcripts, not documents
- Focus on: channel info, upload dates, speaker names
- Already have structured metadata (upload_date, channel_name)
- May have different quality metrics

**Estimated Effort**: 30-40 hours @ 8h/day (More structured data = potentially faster)

---

### 4. Anarchist Collection ❌ BLOCKED

**Status**: Content files missing from disk

```
Total Documents:    24,643
Content Files:      ❌ Missing from /data/archives/veritable-games/anarchist_library_texts/
Fingerprinting:     ⏭️ Skipped (Phase 3A) - cannot fingerprint without content
Audit:              ⏳ Blocked until files restored
```

**Issue**:
- Database has 24,643 records with `file_path` column
- Expected files don't exist on current server
- Can be re-added to deduplication if files are restored

**Resolution Path**:
- Check if files are available on backup drives
- If files exist elsewhere, restore them to `/data/archives/veritable-games/anarchist_library_texts/`
- Re-run Phase 3A fingerprinting
- Include in Phase 4C audit

---

## 🔄 Workflow Summary

### Completed This Session
1. ✅ Library audit completion confirmed (2,561/2,561 documents)
2. ✅ Phase 3C duplicate review UI created and deployed
3. ✅ Marxist audit initialized (12,728 documents)
4. ✅ First batch of Marxist documents ready for review
5. ✅ Comprehensive documentation created

### Currently Active
- 🔍 **User Task**: Review 621 duplicate clusters via `/admin/duplicates`
- ⏳ **Claude Task**: Marxist collection audit in progress
- ⏳ **Ready**: YouTube audit can begin after Marxist batch

### Timeline & Effort
```
Library Audit:      ✅ Complete  (40-50 hours estimated)
Marxist Audit:      ⏳ 1-2 weeks  (20-30 hours estimated)
YouTube Audit:      ⏳ 2-3 weeks  (30-40 hours estimated)
Deduplication:      ⏳ 1-2 weeks  (varies based on strategy)
─────────────────────────────────────
Total Remaining:    ⏳ 8-12 weeks (estimated)
```

---

## 📋 Common Marxist Metadata Issues (First Batch)

Based on first 10 critical documents:

### Issue 1: Placeholder Author ("Archive")
- **Severity**: Critical (−40 points)
- **How to fix**: Research document, find real author, update database
- **Example**:
  ```sql
  UPDATE marxist.documents 
  SET author = 'Bhagat Singh'
  WHERE id = 38317;
  ```

### Issue 2: Missing Publication Date
- **Severity**: Critical (−30 points)
- **How to fix**: Look in document content or external sources
- **Example**:
  ```sql
  UPDATE marxist.documents 
  SET publication_date = '1927-03-23'
  WHERE id = 38317;
  ```

### Issue 3: Unknown or Missing Title
- **Severity**: High (−15 points)
- **How to fix**: Extract from content or research external sources
- **Example**:
  ```sql
  UPDATE marxist.documents 
  SET title = 'Why I Am an Atheist'
  WHERE id = 38315;
  ```

### Issue 4: No Content
- **Severity**: Critical (−30 points)
- **Notes**: Some documents may be legitimate stubs
- **Options**:
  1. Find full text and update
  2. Mark as reviewed if it's a legitimate excerpt
  3. Mark as skipped if unfixable

---

## 🛠️ Scripts Available

### Library Collection (✅ Complete)
- `metadata_audit.py` - Full audit tool
- Status: All 2,561 documents processed

### Marxist Collection (⏳ In Progress)
- `marxist_metadata_audit.py` - Marxist-specific audit tool
- Status: Audit initialized, first batch ready

### YouTube Collection (📋 Ready to Create)
- `youtube_metadata_audit.py` - To be created
- Plan: Similar structure to Marxist script
- Differences: Focus on transcript-specific fields

---

## 💡 Optimization Tips for Multi-Collection Audit

### For Faster Processing
1. **Batch by language/type**: Process similar documents together
2. **Bookmark research sources**: Common patterns emerge
3. **Use browser tabs**: Have search open for quick research
4. **Save every 50 docs**: Use `finalize-round` to checkpoint progress

### For Better Quality
1. **Start with CRITICAL tier**: Biggest impact on average quality
2. **Follow a research strategy**: Define approach for each issue type
3. **Take notes**: Document patterns and common fixes
4. **Review samples**: Check work periodically for consistency

### For Maintaining Momentum
1. **Set daily/hourly goals**: "Fix 20 documents per session"
2. **Rotate collections**: Avoid fatigue by switching between collections
3. **Celebrate milestones**: Notice quality improvements as you work
4. **Track progress**: Watch average quality score improve in real-time

---

## 📊 Expected Outcomes (After All Audits)

**Library** (✅ 92% complete):
- Average quality: 44.6 → 85+/100
- Authors complete: 53% → 95%+
- Dates complete: 0% → 80%+

**Marxist** (⏳ in progress):
- Expected similar improvements
- Start quality: 54.3/100
- Target: 80+/100 average

**YouTube** (📋 ready):
- Transcripts already structured
- Focus on channel/speaker metadata
- Target: 75+/100 average

**Total Impact**:
- 75,829 documents with improved metadata
- ~414,000 tags properly associated
- Deduplication down to 74,300+ unique documents
- Much more searchable and usable collection

---

## 🔗 Related Documentation

- `/home/user/CLAUDE.md` - Server-level Phase 3 status
- `/home/user/docs/veritable-games/LIBRARY_AUDIT_COMPLETION_FEB23_2026.md` - Session summary
- `/home/user/docs/veritable-games/UNIFIED_TAG_SCHEMA_STATUS.md` - Tag system status
- `/home/user/projects/veritable-games/resources/processing/audit-scripts/README.md` - Full script documentation

---

**Last Updated**: February 23, 2026  
**Status**: 3.4% complete (2,561 of 75,829 documents) → Increasing to include Marxist progress
