# Workspace Feature Capability Matrix - February 2026

**Analysis Date**: February 14, 2026
**Scope**: Complete feature parity analysis against industry leaders
**Goal**: Roadmap to progress from 35-40% → 75-80% feature parity by end of 2026
**Methodology**: Feature-by-feature scoring with effort estimates and impact ratings

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Feature Matrix](#core-feature-matrix)
3. [12 Core Feature Categories](#12-core-feature-categories)
4. [Gap Analysis](#gap-analysis)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Differentiation Strategy](#differentiation-strategy)
7. [Appendices](#appendices)

---

## 📊 Executive Summary

### Recalculated Feature Parity Scores

**Veritable Workspace Progress** (November 2025 → February 2026):

| Category | Nov 2025 | Feb 2026 | Change | Target Dec 2026 |
|----------|----------|----------|--------|-----------------|
| Canvas Manipulation | 50% | **60%** | +10% | 80% |
| Selection Tools | 65% | **70%** | +5% | 85% |
| Undo/Redo System | 0% | **75%** | +75% 🎉 | 90% |
| Copy/Paste/Clipboard | 10% | **25%** | +15% | 70% |
| Node/Object Types | 20% | **25%** | +5% | 60% |
| Styling Capabilities | 25% | **40%** | +15% | 70% |
| Connections/Arrows | 55% | **65%** | +10% | 80% |
| Collaboration | 0% | **5%** | +5% | 40% |
| Export/Import | 0% | **50%** | +50% 🎉 | 80% |
| Organization & Layout | 60% | **70%** | +10% | 85% |
| Advanced Features | 5% | **10%** | +5% | 30% |
| Performance | 65% | **75%** | +10% | 85% |
| **OVERALL AVERAGE** | **23%** | **39%** | **+16%** | **76%** |

**Key Achievements** (3 months):
- ✅ Undo/Redo: 0% → 75% (+75 points!)
- ✅ Export/Import: 0% → 50% (+50 points!)
- ✅ Toolbar redesign: Icon-only with controls modal
- ✅ AlignmentToolbar: Production-ready contextual UI
- ✅ Lock elements: Implemented
- ✅ WebSocket foundation: Deployed (needs stabilization)

**Major Remaining Gaps**:
- ❌ Collaboration: Only 5% (WebSocket not functional, no presence/awareness)
- ❌ Node Types: Only 25% (text-only, no shapes/images/embeds)
- ❌ Copy/Paste: Only 25% (stubbed, Ctrl+C/V not functional)
- ❌ Advanced Features: Only 10% (no templates, search, auto-layout)

---

### Strategic Findings

#### Quick-Win Opportunities

**1. Complete Undo/Redo**
Already at 75%, needs connection creation/deletion undo.

**2. Implement Copy/Paste**
Schema supports it, needs clipboard integration.

**3. PNG/SVG Export**
JSON export works, add canvas-to-image.

Critical for discoverability.

---

#### Long-Term Investments

**1. Shape Tools**
Rectangle, Circle, Diamond, Arrow with arrowheads. Requires new node type, renderer, styling UI.

**2. Real-Time Collaboration**
Fix WebSocket stability, implement presence/awareness, add conflict resolution.

**3. Templates System**
Save workspace as template, template library/picker, template variables.

---

#### Differentiation Focus

**1. Wiki Integration**
Link nodes to wiki pages, visual sitemap, bidirectional links.

**2. Forum Integration**
Link nodes to discussion topics, show comment counts, create topics from workspace.

**3. Library Integration**
Citation nodes, link to documents, export with bibliography.

---

### Competitive Positioning

**Veritable's Unique Value Proposition**:
> "Visual knowledge graph for game development & worldbuilding"
> - Markdown-first text nodes (Obsidian compatibility)
> - Per-user viewport persistence (multiplayer-ready architecture)
> - Integrated wiki/forum/library (ecosystem advantage)
> - Contextual toolbars (superior UX to Excalidraw/Miro)

**Don't Compete Head-to-Head On**:
- Generic whiteboarding (Miro's strength)
- Hand-drawn aesthetic (Excalidraw's niche)
- Design tool features (Figma's domain)

**Do Compete On**:
- Research visualization
- Game design documentation
- Worldbuilding organization
- Team brainstorming with follow-through (workspace → wiki → forum)

---

### Feature Parity Targets

**Conservative Path** (70% by December 2026):
- Focus on quick wins + differentiation
- Skip advanced features (auto-layout, AI, plugins)
- Strong core + unique features

**Aggressive Path** (80% by December 2026):
- Include quick wins + long-term investments + differentiation
- Competitive with Excalidraw/Miro on core features

**Recommended**: **Balanced path targeting 75-76%**
- Quick wins (18-24h)
- Essential long-term (shape tools, collaboration - 100h)
- Differentiation (50-65h)

---

## 📋 Core Feature Matrix

### Scoring Legend

**Implementation Status**:
- ✅ **Full** (100%) - Feature complete, production-ready
- ⚠️ **Partial** (50%) - Schema supports but UI incomplete, OR basic version only
- 🔍 **Planned** (25%) - Code exists but broken, OR stubbed with TODO
- ❌ **Missing** (0%) - Not implemented at all

**Effort Estimates**:

**Impact Ratings**:
- **High**: Critical for competitive parity or major user need
- **Medium**: Important but not critical, or niche use case
- **Low**: Nice-to-have, minor quality improvement

---

## 🎯 12 Core Feature Categories

### 1. Canvas Manipulation (~60% Complete)

**Current Score**: 60% (up from 50% in November)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Infinite canvas** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Pan (Space+drag)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Pan (middle mouse)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Zoom (Ctrl+scroll)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Zoom (pinch)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Zoom controls (+/-)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Reset zoom (R)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Fit to screen** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | High |
| **Zoom to selection** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | Medium |
| **Grid background** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Grid snapping** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | S | Medium |
| **Smart guides** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Rulers** | ✅ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Minimap** | ❌ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |

**Category Score**: 60% (9/14 full + 1/14 partial)

**Priority Improvements**:
1. **Fit to screen**) - Essential navigation feature
2. **Smart guides**) - Professional alignment aid
3. **Grid snapping**) - Schema ready, needs UI toggle

**Missing from Competitors**: Per-user viewport persistence (Veritable unique strength!)

---

### 2. Selection Tools (~70% Complete)

**Current Score**: 70% (up from 65%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Click to select** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Shift+click multi** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Box selection** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Lasso selection** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Ctrl+A select all** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | High |
| **Invert selection** | ✅ | ❌ | ✅ | ✅ | ❌ | 0% | XS | Low |
| **Selection bounding box** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Selection count display** | ❌ | ✅ | ✅ | ✅ | ❌ | 0% | XS | Low |
| **Select similar** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Medium |
| **ESC to clear** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |

**Category Score**: 70% (7/10 full)

**Priority Improvements**:
1. **Ctrl+A select all**) - Basic keyboard shortcut
2. **Select similar**) - Useful for bulk styling

**Strengths**: Box selection works perfectly, bounding box visualization excellent

---

### 3. Undo/Redo System (~75% Complete) 🎉

**Current Score**: 75% (up from 0%!)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Undo (Ctrl+Z)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Redo (Ctrl+Shift+Z)** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo toolbar button** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Redo toolbar button** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo node create** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo node delete** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo node move** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo node edit** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Undo connection create** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | High |
| **Undo connection delete** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | High |
| **Undo styling changes** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **History panel** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Named checkpoints** | ❌ | ❌ | ❌ | ✅ | ❌ | 0% | L | Low |

**Category Score**: 75% (9/13 full + 2/13 partial)

**Priority Improvements**:
1. **Undo connection create/delete**) - Complete the undo system
2. **History panel**) - Nice-to-have for power users

**Recent Win**: Undo/redo added February 2026! Major milestone 🎉

---

### 4. Copy/Paste/Clipboard (~25% Complete)

**Current Score**: 25% (up from 10%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Copy (Ctrl+C)** | ✅ | ✅ | ✅ | ✅ | 🔍 | 25% | S | High |
| **Paste (Ctrl+V)** | ✅ | ✅ | ✅ | ✅ | 🔍 | 25% | S | High |
| **Cut (Ctrl+X)** | ✅ | ✅ | ✅ | ✅ | 🔍 | 25% | S | High |
| **Duplicate (Ctrl+D)** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | High |
| **Paste in place** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | Medium |
| **Paste with offset** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | Low |
| **Copy as PNG** | ✅ | ✅ | ✅ | ❌ | ❌ | 0% | S | Medium |
| **Copy as SVG** | ✅ | ❌ | ✅ | ❌ | ❌ | 0% | S | Low |
| **Copy style** | ✅ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Paste style** | ✅ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |

**Category Score**: 25% (0/10 full + 5/10 partial)

**Priority Improvements**:
1. **Complete Ctrl+C/V/X**) - Stubbed, just needs implementation
2. **Duplicate keyboard shortcut**) - UI button exists, add Ctrl+D
3. **Copy as PNG**) - Useful for sharing

**Current State**: Duplicate button works, clipboard stubbed with "Coming soon"

**Implementation Notes**:
- Schema supports it (nodes can be cloned)
- Just needs clipboard API integration

---

### 5. Node/Object Types (~25% Complete) ⚠️ MAJOR GAP

**Current Score**: 25% (up from 20%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Text boxes** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Sticky notes** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Rectangles** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Circles/Ellipses** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Diamonds** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Triangles** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Lines** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | Medium |
| **Arrows** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | S | High |
| **Freehand drawing** | ✅ | ✅ | ✅ | ❌ | ❌ | 0% | L | Low |
| **Images** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Embeds (iframe)** | ❌ | ✅ | ⚠️ | ✅ | ❌ | 0% | L | Medium |
| **Code blocks** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Medium |
| **Tables** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Low |
| **Charts** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | XL | Low |
| **Frames/Containers** | ❌ | ✅ | ✅ | ✅ | ❌ | 0% | L | Medium |

**Category Score**: 25% (2/15 full + 1/15 partial)

**Critical Gap**: Only text-based nodes supported

**Priority Improvements** (MVP Shape Tools):
1. **Rectangles**) - Most common shape
2. **Circles**) - Essential for diagrams
3. **Arrows with heads**) - Connections need arrowheads
4. **Images**) - Upload and display


**Why This Matters**: Users coming from Excalidraw/Miro expect shape tools immediately

---

### 6. Styling Capabilities (~40% Complete)

**Current Score**: 40% (up from 25%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Background color** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Text color** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | High |
| **Border color** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Border width** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Border style** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Low |
| **Border radius** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Opacity** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Shadow** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | S | Low |
| **Font family** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | S | Medium |
| **Font size** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Bold/Italic/etc** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Text alignment** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Stroke style** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | Low |
| **Fill pattern** | ✅ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Gradients** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Low |

**Category Score**: 40% (3/15 full + 9/15 partial)

**Key Insight**: Schema supports most styling features, but UI doesn't expose them!

**Priority Improvements**:
1. **Text color picker**) - Schema ready, add to toolbar
2. **Border styling UI**) - Expose existing schema fields
3. **Opacity slider**) - Add to properties panel
4. **Font family dropdown**) - Replace hardcoded Arial

**Quick Win**: 2-3 hours to expose all schema-ready styling options

---

### 7. Connections/Arrows (~65% Complete)

**Current Score**: 65% (up from 55%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Create connections** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Anchor points** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Curved paths** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Straight lines** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Connection labels** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | S | High |
| **Arrowheads** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | High |
| **Line styles (dashed)** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Line color** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Line width** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |
| **Connection routing** | ✅ | ✅ | ✅ | ⚠️ | ❌ | 0% | M | Low |
| **Multi-point paths** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Self-connections** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | Low |
| **Bidirectional arrows** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | XS | Medium |

**Category Score**: 65% (3/13 full + 7/13 partial)

**Key Insight**: Connection schema is comprehensive, but UI is minimal

**Priority Improvements**:
1. **Arrowheads**) - Connections look unfinished without arrows
2. **Connection labels**) - Schema ready, add UI
3. **Straight line toggle**) - Option for non-curved

**Existing Strengths**:
- Smart anchor offset system (0.0-1.0 position) is excellent
- Bezier curve algorithm produces beautiful organic lines
- Cascade delete works perfectly

---

### 8. Collaboration Features (~5% Complete) ❌ CRITICAL GAP

**Current Score**: 5% (up from 0%, but barely functional)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Real-time sync** | ✅ | ✅ | ✅ | ✅ | 🔍 | 25% | L | High |
| **Presence/cursors** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **User avatars** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | Medium |
| **Live updates** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Conflict resolution** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Commenting** | ❌ | ✅ | ⚠️ | ✅ | ❌ | 0% | L | Medium |
| **Mentions** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Version history** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Medium |
| **Share/invite** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Permissions** | ❌ | ✅ | ⚠️ | ✅ | ❌ | 0% | L | Medium |
| **Offline mode** | ✅ | ❌ | ✅ | ❌ | ❌ | 0% | L | Low |

**Category Score**: 5% (0/11 full + 1/11 partial at 25%)

**Current State**:
- ✅ WebSocket server deployed (Nov 30, 2025)
- ✅ Yjs CRDT configured
- ❌ WebSocket connection unstable (recent fixes Feb 14)
- ❌ No presence/awareness API usage
- ❌ No live updates broadcasting

**Critical Gap**: WebSocket deployed but not functional for actual collaboration

**Priority Improvements**:
1. **Stabilize WebSocket**) - Fix connection drops, viewport sync bugs
2. **Implement presence**) - Show other users' cursors
3. **Live updates**) - Broadcast changes to all users
4. **Share/invite**) - UI for inviting collaborators


**Why This Matters**: Collaboration is table stakes for modern whiteboard tools

---

### 9. Export/Import (~50% Complete) 🎉

**Current Score**: 50% (up from 0%!)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Export JSON** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Import JSON** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Export PNG** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | High |
| **Export SVG** | ✅ | ❌ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Export PDF** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Low |
| **Import images** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Export selected** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | S | Medium |
| **Export with bg** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XS | Low |
| **Auto-save** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Manual save** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |

**Category Score**: 50% (4/10 full)

**Recent Win**: JSON export/import added February 13, 2026! 🎉

**Priority Improvements**:
1. **PNG export**) - Most common sharing format
2. **SVG export**) - Scalable graphics
3. **Export selected only**) - Partial workspace export

**Implementation**:
- PNG: html2canvas library (8-10 hours)
- SVG: dom-to-svg or manual SVG generation (10-12 hours)
- Export selected: Filter nodes before export (2-3 hours)

---

### 10. Organization & Layout (~70% Complete)

**Current Score**: 70% (up from 60%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Z-index/layers** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Bring to front** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Send to back** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Align left/right** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Align top/bottom** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Distribute H/V** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Grouping** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Medium |
| **Locking** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Auto-layout** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Medium |
| **Smart spacing** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | M | Low |
| **Layers panel** | ❌ | ✅ | ✅ | ✅ | ❌ | 0% | M | Low |

**Category Score**: 70% (8/11 full)

**Recent Win**: AlignmentToolbar contextual UI is excellent!

**Priority Improvements**:
1. **Grouping**) - Select group as unit, move together
2. **Auto-layout**)

**Existing Strengths**:
- AlignmentToolbar auto-appears (better than Excalidraw/Miro)
- Lock elements just added (Feb 13)

---

### 11. Advanced Features (~10% Complete)

**Current Score**: 10% (up from 5%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Templates** | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | 0% | XL | Medium |
| **Search nodes** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Medium |
| **Plugins** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XXL | Low |
| **Keyboard shortcut customization** | ❌ | ❌ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Custom themes** | ✅ | ⚠️ | ✅ | ✅ | ❌ | 0% | M | Low |
| **Libraries** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | L | Low |
| **AI features** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | XXL | Low |
| **Presentation mode** | ❌ | ✅ | ❌ | ✅ | ❌ | 0% | M | Low |
| **Recording** | ❌ | ✅ | ❌ | ❌ | ❌ | 0% | L | Low |
| **API/SDK** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | L | Medium |

**Category Score**: 10% (0/10 full + 1/10 partial)

**Strategic Decision**: **Skip most advanced features**

**Rationale**:
- Templates: Medium priority (30-40h effort)
- Search: Medium priority (15-20h effort)
- Plugins/AI: Low priority (avoid scope creep)
- API: Already have REST API, could add webhooks

**Focus Instead On**: Differentiation (wiki/forum/library integration)

---

### 12. Performance & Scalability (~75% Complete)

**Current Score**: 75% (up from 65%)

| Feature | Excalidraw | Miro | tldraw | Figma | Veritable | Status | Effort | Impact |
|---------|-----------|------|--------|-------|-----------|--------|--------|--------|
| **Viewport culling** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Debounced saves** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **requestAnimationFrame** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Batch operations** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Spatial indexing** | ✅ | ✅ | ✅ | ✅ | ✅ | 100% | - | - |
| **Canvas rendering** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XL | Medium |
| **Lazy loading** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | M | Medium |
| **Memory management** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | M | Medium |
| **60fps guarantee** | ✅ | ✅ | ✅ | ✅ | ⚠️ | 50% | L | High |
| **10,000+ objects** | ✅ | ✅ | ✅ | ✅ | ❌ | 0% | XL | Low |

**Category Score**: 75% (5/10 full + 3/10 partial)

**Current Performance**:
- 231 nodes: 96.91% smooth frames (96.91% >30fps)
- Expected 1000 nodes: 30-40fps (vs 60fps competitors)
- Bottleneck: DOM rendering (vs Canvas/WebGL)

**Performance Audit Findings** (Feb 13, 2026):
- ✅ React.memo implemented
- ✅ LRU cache for font calculations
- ✅ Lazy loading Tiptap editor
- ❌ Yjs deep cloning breaks memoization (+50% performance if fixed)
- ❌ Viewport culling O(n), should use QuadTree O(log n)

**Priority Improvements**:
1. **Fix Yjs deep cloning**) with direct Yjs subscriptions
2. **Implement QuadTree**) viewport queries
3. **Hybrid Canvas rendering**) - Use Canvas for static nodes, DOM for editing


---

## 🔍 Gap Analysis

### Critical Gaps (Immediate Blockers for Competitive Parity)

#### 1. No Shape Tools (25% Node Types vs 80-95% Competitors)

**Problem**: Only text nodes supported - users expect rectangles, circles, etc.

**Competitors**:
- Excalidraw: 9 shape types (rectangle, circle, diamond, arrow, line, freehand, etc.)
- Miro: 20+ shapes (basic + flowchart + BPMN + AWS + UML)
- tldraw: 8 shape types
- Figma: Unlimited (vector editor)

**Impact**: Users coming from Excalidraw/Miro immediately notice missing shapes

**Fix**: MVP shape tools (Rectangle, Circle, Arrow with heads, Image upload)

**Priority**: P0 Critical - **Must have for competitive parity**

---

#### 2. Collaboration Not Functional (5% vs 60-95% Competitors)

**Problem**: WebSocket deployed but not working for real-time collaboration

**Competitors**:
- Excalidraw: Real-time sync, presence cursors (60%)
- Miro: Full collaboration suite - cursors, comments, video, voting (95%)
- tldraw: Real-time sync, presence (70%)
- Figma: Industry-leading collaboration (98%)

**Current State**:
- WebSocket server: ✅ Deployed (Nov 30)
- Yjs CRDT: ✅ Configured
- Connection stability: ❌ Broken (recent viewport sync bug fixed Feb 14)
- Presence/awareness: ❌ Not implemented
- Live updates: ❌ Not broadcasting

**Impact**: "Multiplayer" is promised but doesn't work

**Priority**: P0 Critical - **Table stakes for modern whiteboard**

---

#### 3. No Copy/Paste (25% vs 100% Competitors)

**Problem**: Ctrl+C/V/X stubbed with "Coming soon" - basic clipboard operations missing

**Competitors**: ALL competitors support full clipboard operations

**Current State**:
- Context menu: "Copy" / "Paste" / "Cut" buttons exist
- Click handler: Shows "Coming soon" message
- Duplicate button: ✅ Works (offset copy)
- Schema: ✅ Supports cloning nodes

**Impact**: Frustrating for users expecting standard keyboard shortcuts

- Add keyboard shortcuts: 1 hour
**Priority**: P0 Critical - **Users expect this**

---

### Moderate Gaps (Quality Issues)

#### 4. PNG/SVG Export Missing (50% vs 95% Competitors)

**Problem**: Only JSON export available - cannot export as image

**Competitors**:
- Excalidraw: PNG, SVG, Clipboard (95%)
- Miro: PNG, PDF, many formats (95%)
- tldraw: PNG, SVG, JSON (90%)

- PNG export: html2canvas (8-10 hours)
- SVG export: dom-to-svg (10-12 hours)
**Priority**: P1 High - **Important for sharing**

---

#### 5. Styling UI Missing (40% vs 80-95% Competitors)

**Problem**: Schema supports styling (colors, borders, opacity, etc.) but UI doesn't expose it

**Current State**:
- ✅ Background color picker works
- ⚠️ Text color: Schema ready, no UI
- ⚠️ Border styling: Schema ready, no UI
- ⚠️ Opacity: Schema ready, no UI
- ⚠️ Font family: Hardcoded Arial, schema supports custom

- Text color picker: 0.5-1 hour
- Opacity slider: 0.5-1 hour
**Priority**: P1 High - **Quick win, schema already supports it**

---

#### 6. Connection Styling Missing (65% vs 85-95% Competitors)

**Problem**: Connections work but lack arrowheads, labels, and styling options

**Current State**:
- ✅ Curved bezier paths work beautifully
- ✅ Smart anchor offset system excellent
- ❌ No arrowheads (connections look unfinished)
- ⚠️ Connection labels: Schema ready, no UI
- ⚠️ Line styling: Schema ready, minimal UI

- Arrowheads: 6-8 hours (SVG markers + math for rotation)
**Priority**: P1 High - **Connections look incomplete without arrows**

---

### Nice-to-Have Gaps (Lower Priority)

#### 7. No Grouping (0% vs 80% Competitors)

**Problem**: Cannot group nodes to move together

**Fix**: 15-20 hours (group select, move as unit, ungroup)

**Priority**: P2 Medium - **Useful but not critical**

---

#### 8. No Search (0% vs 60% Competitors)

**Problem**: Large workspaces (231+ nodes) hard to navigate

**Fix**: 15-20 hours (search nodes by content, filter, highlight)

**Priority**: P2 Medium - **Helpful for large workspaces**

---

#### 9. No Templates (0% vs 70% Competitors)

**Problem**: Users must start from scratch every time

**Fix**: 30-40 hours (save as template, template library, variables)

**Priority**: P2 Medium - **Nice onboarding feature**

---

### Unique Strengths (Don't Change)

#### 1. Contextual Alignment Toolbar ✅

**Why Superior**:
- Auto-appears when 2+ nodes selected (vs Excalidraw left panel always there)
- Positioned at selection bounding box (vs Miro right-click menu)
- Auto-hides when <2 nodes (vs always visible clutter)


---

#### 2. Per-User Viewport Persistence ✅

**Why Unique**:
- Each user's pan/zoom saved to database
- Return to workspace = same view you left
- Competitors don't persist individual viewports (shared viewport only)

**Use Case**: Resume work exactly where you left off

**Recommendation**: **KEEP** - competitive differentiator

---

#### 3. Markdown-First Text Nodes ✅

**Why Unique**:
- Tiptap rich text editor with markdown shortcuts
- Export to markdown possible (schema supports it)
- Obsidian compatibility potential

**Use Case**: Knowledge workers who live in markdown

**Recommendation**: **KEEP** - strengthen this advantage

---

## 🗓️ Implementation Roadmap

### Q1 2026 (January - March): Foundation & Quick Wins

**Goal**: 35% → 50% (+15 points)

**Timeframe**: 12 weeks (Feb - March, Jan already past)


#### Week 1-2 (Feb 14-28): UI/UX Quick Wins

**Priority 1A: Fix Show Deleted Nodes**
- Implement filter
- 50% opacity + "DELETED" label
- Restore button

**Priority 1B: Complete Undo/Redo**
- Add connection create/delete to undo stack
- Test edge cases


#### Week 3-4 (Mar 1-14): Copy/Paste & Export

**Priority 2A: Implement Copy/Paste** (8-11 hours)
- Clipboard API integration
- Copy (Ctrl+C): Serialize selection
- Paste (Ctrl+V): Deserialize + offset
- Cut (Ctrl+X): Copy + delete
- Duplicate (Ctrl+D): Keyboard shortcut

**Priority 2B: PNG Export** (8-10 hours)
- html2canvas library integration
- Export entire workspace
- Export selected nodes only


#### Week 5-6 (Mar 15-28): Styling UI

**Priority 3A: Expose Styling Options** (4-7 hours)
- Text color picker
- Border styling panel (color, width, style)
- Opacity slider
- Font family dropdown (replace Arial)

**Priority 3B: Connection Styling** (12-17 hours)
- Arrowheads (SVG markers)
- Connection labels UI
- Line styling panel


#### Week 7-8 (Apr 1-14): Navigation Features

**Priority 4A: Fit to Screen** (2-3 hours)
- Calculate bounding box of all nodes
- Auto-zoom to fit viewport
- Center canvas on content

**Priority 4B: Zoom to Selection** (2-3 hours)
- Calculate selection bounding box
- Zoom to fit selected nodes

**Priority 4C: Ctrl+A Select All** (0.5-1 hour)
- Simple keyboard shortcut


#### Week 9-10 (Apr 15-28): Grid Snapping

**Priority 5A: Grid Snapping Toggle** (6-8 hours)
- Expose schema field `snapToGrid`
- Add toggle to toolbar
- Implement snap-on-drag logic (round to nearest 10px)

**Priority 5B: Smart Guides** (20-25 hours)
- Detect alignment with nearby nodes
- Show temporary guide lines
- Snap to guide when close


#### Week 11-12 (May 1-14): Performance Audit

**Priority 6A: Fix Yjs Deep Cloning** (6-8 hours)
- Replace `JSON.parse(JSON.stringify(yMap.toJSON()))` with direct references
- Preserves React.memo benefits (+50% performance)

**Priority 6B: Testing & Bug Fixes** (8-10 hours)
- Test all Q1 features
- Fix regressions
- Performance testing with 500+ nodes


**Q1 Total**: 86-116 hours (achievable)

**Expected Outcome**: 35% → 52% (+17 points) 🎯

---

### Q2 2026 (April - June): Core Feature Parity

**Goal**: 52% → 65% (+13 points)

**Timeframe**: 13 weeks


#### Month 1 (Apr): MVP Shape Tools

**Priority 1A: Rectangle & Circle Nodes** (18-22 hours)
- New node type schema (ShapeNode)
- Rectangle renderer (SVG rect)
- Circle renderer (SVG circle)
- Creation buttons in top toolbar
- Resize handles with proper persistence
- Styling integration (fill, stroke, opacity)

**Priority 1B: Improved Arrow Connections** (6-8 hours)
- Arrowhead rendering (already counted in Q1, verify completion)
- Bi-directional arrow option
- Multiple arrowhead styles (triangle, circle, diamond)

**Month 1 Total**: 24-30 hours

#### Month 2 (May): Image Support & Templates

**Priority 2A: Image Nodes** (12-15 hours)
- Image upload (drag-drop or file picker)
- Image node renderer
- Resize with aspect ratio lock
- Cloudflare R2 storage integration (or local uploads/uploads/)

**Priority 2B: Templates System** (30-40 hours)
- Save workspace as template
- Template library UI
- Template picker on empty workspace
- Template variables/placeholders (optional)
- Pre-made templates (flowchart, mind map, kanban, etc.)

**Month 2 Total**: 42-55 hours

#### Month 3 (Jun): Search & Organization

**Priority 3A: Search Nodes** (15-20 hours)
- Search input in toolbar
- Filter nodes by content (fuzzy search)
- Highlight matching nodes
- Jump to result on click

**Priority 3B: Grouping** (15-20 hours)
- Group selected nodes (Ctrl+G)
- Ungroup (Ctrl+Shift+G)
- Move group as unit
- Group bounding box visualization

**Priority 3C: Minimap** (12-16 hours)
- Minimap component (bottom-right)
- Show viewport rectangle
- Click to pan to location
- Toggle show/hide

**Month 3 Total**: 42-56 hours

**Q2 Total**: 108-141 hours

**Expected Outcome**: 52% → 66% (+14 points) 🎯

---

### Q3 2026 (July - September): Collaboration & Differentiation

**Goal**: 66% → 75% (+9 points)

**Timeframe**: 13 weeks


#### Month 1 (Jul): Stabilize Collaboration

**Priority 1A: Fix WebSocket Stability** (8-10 hours)
- Resolve connection drops
- Proper cleanup on unmount
- Reconnection logic with exponential backoff
- Connection status indicator UI

**Priority 1B: Implement Presence API** (15-20 hours)
- Yjs Awareness API integration
- Broadcast user cursor position
- Show other users' cursors on canvas
- User avatar + name label on cursor

**Priority 1C: Live Updates Broadcasting** (20-25 hours)
- Broadcast node create/update/delete
- Broadcast connection create/delete
- Optimistic UI updates (don't wait for server)
- Conflict resolution (last-write-wins or CRDT merge)

**Month 1 Total**: 43-55 hours

#### Month 2 (Aug): Wiki Integration (Unique Feature!)

**Priority 2A: Wiki Page Nodes** (20-25 hours)
- New node type: WikiPageNode
- Link to existing wiki pages (search/autocomplete)
- Bidirectional links (wiki page shows linked workspaces)
- Click node → opens wiki page in sidebar (iframe or modal)

**Priority 2B: Visual Sitemap** (25-30 hours)
- Auto-generate workspace from wiki hierarchy
- Tree/graph layout algorithm
- Create wiki page from workspace node
- Sync workspace structure → wiki categories

**Month 2 Total**: 45-55 hours

#### Month 3 (Sep): Forum & Library Integration

**Priority 3A: Forum Integration** (15-20 hours)
- Discussion topic nodes
- Link to forum threads
- Show comment count badge
- Create new forum topic from workspace
- Click node → opens thread in sidebar

**Priority 3B: Library Integration** (15-20 hours)
- Citation nodes
- Link to library documents
- Show document metadata (author, date, tags)
- Export workspace with bibliography (Markdown, BibTeX)

**Priority 3C: Mobile Optimization** (25-30 hours)
- Increase touch targets to 44×44px
- Implement long-press context menu
- Test on iOS and Android
- Mobile-specific toolbar layout
- Optimize anchor hit areas

**Month 3 Total**: 55-70 hours

**Q3 Total**: 143-180 hours

**Expected Outcome**: 66% → 76% (+10 points) 🎯

---

### Q4 2026 (October - December): Polish & Performance

**Goal**: 76% → 78% (+2 points) + Focus on quality over quantity

**Timeframe**: 13 weeks


#### Month 1 (Oct): Component Decomposition

**Priority 1A: Refactor WorkspaceCanvas** (12-16 hours)
- Extract TopToolbar component
- Extract BottomToolbar component
- Extract CanvasViewport component
- Extract SelectionOverlay component
- Result: 1,741 lines → 5 focused components (~300 lines each)

**Priority 1B: Add Error Boundaries** (4-6 hours)
- Workspace-level error boundary
- Component-level boundaries (nodes, connections)
- Error reporting UI (show user-friendly message)

**Month 1 Total**: 16-22 hours

#### Month 2 (Nov): Performance Optimizations

**Priority 2A: QuadTree Spatial Index** (20-25 hours)
- Implement QuadTree for viewport culling
- O(n) → O(log n) for large workspaces
- Expected: 60fps with 1000+ nodes (vs current 30-40fps)

**Priority 2B: Hybrid Canvas Rendering** (30-40 hours) [OPTIONAL]
- Use Canvas for static nodes (not being edited)
- Use DOM for active editing (Tiptap)
- Expected: 2-3x FPS improvement
- **Note**: Only if QuadTree insufficient

**Month 2 Total**: 20-65 hours (depending on if Hybrid Canvas needed)

#### Month 3 (Dec): Testing, Documentation, Launch Prep

**Priority 3A: Testing** (15-20 hours)
- Unit tests for core utilities (60% coverage goal)
- Integration tests for API routes
- E2E tests for critical user flows (create node, connect, save)

**Priority 3B: User Documentation** (10-12 hours)
- User guide (how to create nodes, connections, etc.)
- Video tutorial (2-3 minutes)
- Keyboard shortcuts reference card
- FAQ

**Priority 3C: Bug Bash & Polish** (15-20 hours)
- User testing with real users
- Fix reported bugs
- Final UI polish (animations, transitions, micro-interactions)

**Month 3 Total**: 40-52 hours

**Q4 Total**: 76-139 hours

**Expected Outcome**: 76% → 78% (+2 points, focus on quality) 🎯

---

### 2026 Summary

**Effort Distribution**:
- Q1: 86-116 hours (Foundation)
- Q2: 108-141 hours (Features)
- Q3: 143-180 hours (Differentiation)
- Q4: 76-139 hours (Polish)

**Feature Parity Progress**:
- Start: 35% (Feb 2026)
- Q1: 52% (+17)
- Q2: 66% (+14)
- Q3: 76% (+10)
- Q4: 78% (+2)
- **Target Achieved**: 76-78% (exceeds 75% goal!) 🎉

**Realistic Estimate**: Assuming 15-20 hours/week dedicated to workspace
- **Achievable**: Yes, with buffer for unexpected issues

---

## 🎯 Differentiation Strategy

### Don't Chase 100% Parity

**Why Not**:
- Diminishing returns (80/20 rule)
- Excalidraw/Miro/Figma have 5-10 year head starts
- Features like advanced AI, plugins, design systems are massive investments

**Instead**: 75-80% core parity + 30% unique features = Competitive positioning

---

### Unique Value Propositions

#### 1. Wiki Integration (No Competitor Has This)

**Vision**: Visual knowledge graph that links to detailed documentation

**Use Cases**:
- **Game design**: Workspace node for "Combat System" → links to detailed wiki page explaining mechanics
- **Worldbuilding**: Visual map of locations → each location is wiki page with lore
- **Software architecture**: System diagram → each component links to API docs in wiki

**Features**:
- WikiPageNode type
- Bidirectional links (wiki ↔ workspace)
- Auto-generate sitemap from wiki hierarchy
- Visual brainstorming → structured documentation pipeline

**Competitive Advantage**: Miro/Excalidraw are isolated tools. Veritable integrates with knowledge base.


---

#### 2. Forum Integration (No Competitor Has This)

**Vision**: Brainstorming workspace that generates discussion topics

**Use Cases**:
- **Design review**: Create workspace with design mockups → each mockup becomes discussion topic
- **Feature planning**: Mind map of features → convert nodes to forum threads for team feedback
- **Q&A**: Workspace question board → link to forum answers

**Features**:
- DiscussionNode type
- Link workspace nodes to forum threads
- Show comment count badges
- Create forum topic from workspace
- Export workspace decisions → forum summary

**Competitive Advantage**: Workspace → forum workflow no competitor offers


---

#### 3. Library Integration (No Competitor Has This)

**Vision**: Research visualization with academic citation support

**Use Cases**:
- **Worldbuilding research**: Cite historical sources for world design decisions
- **Game design**: Reference papers on game mechanics, psychology, UX
- **Academic**: Visual literature review with proper citations

**Features**:
- CitationNode type
- Link to library documents (PDFs, articles, books)
- Show metadata (author, date, publication)
- Export workspace with bibliography (Markdown + BibTeX)
- Visual citation network (which nodes cite which sources)

**Competitive Advantage**: Only visual brainstorming tool with academic citation support


---

#### 4. Markdown-First Philosophy

**Vision**: Knowledge workers who live in Markdown can work in workspace

**Current State**:
- ✅ Tiptap rich text editor with markdown shortcuts
- ⚠️ Schema has `markdown` field but not exposed
- ❌ No markdown export yet

**Differentiation**:
- Export workspace as markdown files (each node = .md file)
- Obsidian vault compatibility
- Import markdown files as nodes
- Markdown preview mode (toggle between rich text and raw markdown)

**Competitive Advantage**: Obsidian users, Notion users, developers prefer markdown


---

#### 5. Per-Project Workspaces

**Vision**: Workspace tightly integrated with Veritable's project system

**Current State**:
- ✅ Each workspace belongs to a project
- ⚠️ Not fully leveraging project relationships

**Differentiation**:
- Workspace tabs show project gallery images
- Click gallery image → creates image node in workspace
- Link workspace nodes to project milestones
- Project dashboard shows workspace activity

**Competitive Advantage**: Miro/Excalidraw are isolated. Veritable is integrated project management.


---

### Positioning Statement

**Veritable Workspace**:
> "Visual knowledge graph for game development & worldbuilding"
>
> Unlike generic whiteboards (Miro) or drawing tools (Excalidraw), Veritable integrates visual brainstorming with your project's wiki, forums, and library. Perfect for game designers, worldbuilders, and creative teams who need both high-level visualization AND detailed documentation.

**Target Audience**:
- Game designers (indie studios, solo developers)
- Worldbuilders (authors, RPG creators)
- Creative teams (writers, artists collaborating)
- Knowledge workers (researchers, consultants)

**Key Messages**:
1. "Brainstorm visually, document thoroughly" (workspace → wiki)
2. "Turn ideas into discussions" (workspace → forum)
3. "Cite your research" (workspace → library)
4. "Own your creative knowledge graph" (self-hosted, not SaaS)

---

## 📎 Appendices

### Appendix A: Effort Estimation Methodology

**Time Estimates Based On**:
- Similar features implemented (JSON export: 8h actual)
- Industry benchmarks (shape tool: 10-15h typical)
- Team velocity (Veritable: ~15-20h/week workspace work)

**Effort Categories**:
- **XS** (0.5-1d / 4-8h): Simple UI additions, exposing existing schema
- **S** (1-3d / 8-24h): New features with backend changes
- **M** (3-7d / 24-56h): Complex features, new systems
- **L** (7-14d / 56-112h): Major features, architectural changes
- **XL** (14+d / 112+h): Strategic features, multi-component systems

**Risk Buffer**: All estimates include 20-30% buffer for unknowns

---

### Appendix B: Feature Prioritization Matrix

**Scoring**: Impact (High=3, Med=2, Low=1) × Effort (XS=5, S=4, M=3, L=2, XL=1) = Priority Score

| Feature | Impact | Effort | Score | Q |
|---------|--------|--------|-------|---|
| **Copy/Paste** | High (3) | S (4) | 12 | Q1 |
| **PNG Export** | High (3) | M (3) | 9 | Q1 |
| **Shape Tools** | High (3) | L (2) | 6 | Q2 |
| **Collaboration** | High (3) | XL (1) | 3 | Q3 |
| **Wiki Integration** | High (3) | L (2) | 6 | Q3 |
| **Templates** | Med (2) | XL (1) | 2 | Q2 |
| **Search** | Med (2) | M (3) | 6 | Q2 |
| **Minimap** | Med (2) | M (3) | 6 | Q2 |
| **Grouping** | Med (2) | M (3) | 6 | Q2 |

**Decision Rule**: Score ≥9 = Q1, Score 6-8 = Q2, Score 3-5 = Q3, Score <3 = Backlog

---

### Appendix C: Competitor Feature Matrix (Full)

[35+ features × 5 competitors comparison table]

*(Due to length, see full comparison in Document 1: UI/UX Competitive Analysis, Appendix section)*

---

### Appendix D: Testing Strategy

**Unit Testing** (Target: 60% coverage):
- `lib/workspace/` utilities
  - viewport-culling.ts
  - connection-utils.ts
  - export-import.ts
  - font-scaling.ts
  - validation.ts

**Integration Testing**:
- API routes (`/api/workspace/**`)
  - Create/update/delete nodes
  - Create/delete connections
  - Batch operations
  - Export/import endpoints

**E2E Testing** (Playwright):
- Critical user flows
  - Create text node → Edit → Save → Reload (persisted?)
  - Create connection → Delete → Undo → Redo
  - Multi-select → Align → Group → Move
  - Export JSON → Import → Verify nodes

**Performance Testing**:
- Benchmark 100, 500, 1000, 5000 nodes
- Measure FPS during pan/zoom
- Memory leak detection
- WebSocket message throughput

---

### Appendix E: Glossary

**Terms**:
- **CRDT**: Conflict-Free Replicated Data Type (Yjs)
- **Branded Types**: TypeScript pattern for ID type safety (NodeId vs ConnectionId)
- **Viewport Culling**: Only render visible nodes (performance optimization)
- **Spatial Index**: QuadTree for O(log n) viewport queries
- **Debounced Save**: Wait 500ms after edit before saving (reduce API calls)
- **Modal Tool**: Requires tool selection before use (vs modeless)
- **Contextual Toolbar**: Auto-appears when relevant (vs always-visible)
- **Soft Delete**: Mark `is_deleted=1` instead of removing from DB

---

## 🎬 Conclusion

**Progress Made** (Nov 2025 → Feb 2026):
- ✅ +16 percentage points (23% → 39%)
- ✅ Undo/Redo: 0% → 75% (massive win!)
- ✅ Export/Import: 0% → 50% (JSON working)
- ✅ Toolbar redesign, Controls modal, Lock elements

**Remaining Challenges**:
- ❌ Shape tools: Critical gap (only text nodes)
- ❌ Collaboration: Deployed but not functional
- ❌ Copy/Paste: Stubbed, users frustrated

**Recommended Path** (75-76% by December 2026):
2. **Q2** (20-25h/week): Shape tools, templates, search, minimap
3. **Q3** (25-30h/week): Collaboration stability, wiki/forum/library integration
4. **Q4** (15-20h/week): Performance, testing, polish

**Competitive Positioning**:
> "Visual knowledge graph for game development & worldbuilding" - 75% core parity + unique wiki/forum/library integration = Differentiated product

**Next Steps**:
1. ✅ Review and approve roadmap
3. 🔜 Set up feature tracking (GitHub issues or project board)
4. 🔜 Begin user testing to validate priorities

---

**Document Status**: Complete - Ready for Implementation
**Last Updated**: February 14, 2026
**Document Length**: ~40 pages
