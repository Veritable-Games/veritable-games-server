# CLAUDE.md Audit & Refactoring Strategy

**Goal**: Keep CLAUDE.md lean and high-signal (~600-650 lines) by strategically offloading details to specialized reference files.

---

## Current State
- **Current lines**: 732
- **Target lines**: 600-650 (compact but complete)
- **Approach**: Extract, consolidate, link

---

## Section-by-Section Analysis

### ✅ KEEP IN CLAUDE.md (Essential - 450-500 lines)

**Why**: These sections are accessed constantly and provide decision-making guidance.

#### 1. **Date Handling** (5 lines)
- Status: ✅ KEEP
- Reason: Critical one-line rule that affects many files
- Action: No change

#### 2. **Table of Contents** (10 lines)
- Status: ✅ KEEP
- Reason: Navigation aid for quick lookups
- Action: Condense slightly if needed

#### 3. **Start Here: First 5 Minutes** (28 lines)
- Status: ✅ KEEP (CRITICAL)
- Reason: New developers need this immediately
- Action: Keep as-is, this is the highest value section

#### 4. **Quick Decision Tree** (94 lines)
- Status: ✅ KEEP (CORE VALUE)
- Reason: **This IS the purpose of CLAUDE.md** - fast pattern lookup
- Action: Keep as-is; this is the heart of the document
- Note: This section alone prevents developers from making 10+ common mistakes

#### 5. **Repository Structure** (38 lines)
- Status: ✅ KEEP (simplified version)
- Reason: Context for file locations and monorepo layout
- Action: **TRIM**: Remove verbose comments, keep essential structure

#### 6. **Critical Workflow Rules** (4 lines)
- Status: ✅ KEEP
- Reason: Directory discipline prevents 95% of errors
- Action: No change

#### 7. **Development Commands** (75 lines - CURRENT)
- Status: ✅ KEEP (essential summary only)
- Reason: Developers need to know the top 10 commands immediately
- Action: **TRIM TO 30-40 LINES**
  - Keep only: dev, build, type-check, format, test, db:health
  - Move detailed commands table → docs/guides/COMMANDS_REFERENCE.md (already exists)
  - Move troubleshooting table → docs/TROUBLESHOOTING.md (already exists)

#### 8. **CRITICAL PATTERNS (Quick Reference)** (10 lines)
- Status: ✅ KEEP
- Reason: 7-point checklist of must-know patterns
- Action: No change

#### 9. **Critical Architecture Rules** (142 lines - CURRENT)
- Status: ✅ PARTIAL KEEP
- Reason: Database access, API routes, params are too important to bury
- Action: **TRIM TO 80-100 LINES**
  - Keep: Database access (20 lines), API pattern (15 lines), Next.js params (10 lines)
  - Move workspace patterns → docs/features/WORKSPACE_ARCHITECTURE.md (already exists)
  - Move content sanitization → docs/SECURITY.md (new file)
  - Keep SHORT code examples only (2-3 lines max)

#### 10. **Platform Features** (148 lines - CURRENT)
- Status: ✅ PARTIAL KEEP
- Reason: Developers need to know what exists, not deep details
- Action: **TRIM TO 40-50 LINES (SUMMARY ONLY)**
  - Keep: 2-3 line feature description + link to full docs
  - Move everything else → feature-specific docs (already exist)
  - Example: "Forums: ✅ Fully functional (17 API endpoints, 6 services). See [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](./docs/forums/FORUMS_DOCUMENTATION_INDEX.md)"

#### 11. **Common Pitfalls** (20 lines)
- Status: ✅ KEEP
- Reason: Prevents costly mistakes
- Action: Keep as-is

#### 12. **React & Next.js Patterns** (6 lines)
- Status: ✅ KEEP
- Reason: Critical banned patterns must be immediately visible
- Action: **EXPAND TO 15-20 LINES** with banned pattern summary
  - Add 1-2 line description of why each was banned
  - Link to .claude/BANNED_PATTERNS.md (new file)

#### 13. **Important Notes** (8 lines)
- Status: ✅ KEEP
- Reason: Build system, path aliases, Web Workers
- Action: No change

#### 14. **Common Runtime Warnings** (12 lines)
- Status: ⚠️ CONDITIONAL KEEP
- Reason: Useful but not critical
- Action: Move to docs/TROUBLESHOOTING.md or keep as-is (decide based on space)

#### 15. **Recent Changes** (6 lines)
- Status: ❌ REMOVE
- Reason: Becomes stale; historical context not needed in quick ref
- Action: Delete - historical info goes in git log

#### 16. **Build & Deployment** (3 lines)
- Status: ✅ KEEP
- Reason: Single link reference is lightweight
- Action: No change

---

## Sections to CREATE (New Reference Files)

### 🆕 Priority 1 (Critical)

#### 1. **.claude/BANNED_PATTERNS.md** (NEW - 60-80 lines)
**Purpose**: Consolidated guide to patterns that MUST NOT be reintroduced

**Content**:
- ❌ template.tsx (why it was removed, symptoms)
- ❌ TanStack Query (why it was removed, what to use instead)
- ❌ Multiple client wrappers (why it causes issues, correct pattern)
- ❌ String concat in SQL (SQL injection risk)
- ❌ Creating Database instances directly (connection leaks)

**Why separate file**:
- Gets updated independently as new patterns become banned
- Can expand without bloating CLAUDE.md
- Easy to reference: "See .claude/BANNED_PATTERNS.md"

---

#### 2. **.claude/STATE_MANAGEMENT_PATTERNS.md** (NEW - 40-50 lines)
**Purpose**: Zustand examples (currently not documented)

**Content**:
- Zustand store creation example
- Using stores in Server Components (async access)
- Using stores in Client Components (hooks)
- Combining with Context for auth
- LRU Cache usage pattern

**Why separate file**:
- State management is a distinct concern
- Examples are code-heavy (best in dedicated file)
- Referenced from CLAUDE.md once

---

### 🆕 Priority 2 (Helpful)

#### 3. **.claude/DATABASE_QUERIES_QUICK_REF.md** (NEW - 30-40 lines)
**Purpose**: SQL patterns and prepared statements

**Content**:
- dbPool.getConnection() pattern
- Prepared statements (correct usage)
- Common query patterns
- Transaction patterns
- Error handling

**Why separate file**:
- Developers can reference while writing queries
- Reduces CLAUDE.md length
- Can grow independently

---

#### 4. **.claude/AGENT_USAGE.md** (NEW - 30-40 lines)
**Purpose**: When to use which Claude Code agent

**Content**:
- general-purpose agent (when to use)
- Explore agent (codebase navigation)
- security-auth-specialist (auth work)
- typescript-architecture-expert (type design)
- react-architecture-specialist (component design)
- performance-optimizer (speed issues)
- accessibility-compliance-auditor (a11y)
- devops-build-optimizer (build/CI issues)

**Why separate file**:
- Helps future Claude instances work more efficiently
- Not core to CLAUDE.md but valuable
- Easy to add more agents as they become available

---

## Files to TRIM/REORGANIZE

### docs/guides/COMMANDS_REFERENCE.md
- ✅ Already exists (279 lines)
- ✅ Has full command details
- Action: CLAUDE.md will link to this, remove detailed tables from CLAUDE.md

### docs/REACT_PATTERNS.md
- ✅ Already exists (90+ lines)
- ✅ Has React 19 patterns
- Action: CLAUDE.md will link to this

### docs/TROUBLESHOOTING.md
- ✅ Already exists
- Action: Move "Quick Troubleshooting Commands" table here; keep link in CLAUDE.md

### docs/DATABASE.md
- ✅ Already exists (comprehensive)
- Action: CLAUDE.md keeps short section; links for details

### docs/SECURITY_ARCHITECTURE.md
- ✅ Already exists
- Action: CLAUDE.md keeps brief summary; move content sanitization details here

---

## Proposed CLAUDE.md Structure (600-650 lines target)

```
1. Date Handling (5 lines)
2. Table of Contents (10 lines)
3. 🚀 Start Here (28 lines)
4. Quick Decision Tree (94 lines) ← CORE
5. Repository Structure (30 lines - TRIMMED)
6. Workflow Rules (4 lines)
7. Essential Commands (40 lines - TRIMMED, top 10 only)
8. CRITICAL PATTERNS (10 lines)
9. Critical Architecture Rules (100 lines - TRIMMED, code examples max 3 lines)
10. ⚠️ BANNED PATTERNS (20 lines - NEW, links to .claude/BANNED_PATTERNS.md)
11. Platform Features (50 lines - TRIMMED to summaries + links)
12. Common Pitfalls (20 lines)
13. React & Next.js Patterns (20 lines - EXPANDED with links)
14. Important Notes (8 lines)
15. Additional Documentation (15 lines - organized by topic)
16. Build & Deployment (3 lines)

TOTAL: ~530-570 lines
Headroom: 30-70 lines for minor additions
```

---

## Implementation Checklist

**Phase 1: Create New Files**
- [ ] .claude/BANNED_PATTERNS.md (Priority 1)
- [ ] .claude/STATE_MANAGEMENT_PATTERNS.md (Priority 1)
- [ ] .claude/DATABASE_QUERIES_QUICK_REF.md (Priority 2)
- [ ] .claude/AGENT_USAGE.md (Priority 2)

**Phase 2: Trim CLAUDE.md**
- [ ] Reduce Repository Structure (remove verbose comments)
- [ ] Compress Development Commands (keep top 10, move rest to link)
- [ ] Trim Critical Architecture Rules (short examples only, move Workspace/Content Sanitization)
- [ ] Compress Platform Features (2-3 lines per feature + link)
- [ ] Remove "Recent Changes" section
- [ ] Expand React & Next.js Patterns (add banned pattern link)

**Phase 3: Add References**
- [ ] Link to .claude/BANNED_PATTERNS.md in "React & Next.js Patterns"
- [ ] Link to .claude/STATE_MANAGEMENT_PATTERNS.md in Quick Decision Tree
- [ ] Link to .claude/DATABASE_QUERIES_QUICK_REF.md in Database Access section
- [ ] Link to .claude/AGENT_USAGE.md in "Additional Documentation"

**Phase 4: Verification**
- [ ] Run `wc -l CLAUDE.md` - confirm 600-650 range
- [ ] Test all cross-references work
- [ ] Verify Quick Decision Tree still comprehensive
- [ ] Ensure onboarding (first 5 minutes) still complete

---

## What Stays "Always in CLAUDE.md"

These sections must NEVER be moved to reduce bloat:

1. **Quick Decision Tree** - This is the primary value
2. **Start Here: First 5 Minutes** - Onboarding critical
3. **CRITICAL PATTERNS** - Quick checklist
4. **Common Pitfalls** - Prevents mistakes
5. **Repository Structure** - File layout context
6. **Workflow Rules** - Directory discipline

---

## Success Metrics

- ✅ CLAUDE.md stays under 650 lines
- ✅ Quick Decision Tree remains the centerpiece
- ✅ Onboarding time stays < 5 minutes
- ✅ All referenced files are organized in .claude/ or docs/
- ✅ Future Claude instances can find everything via links
