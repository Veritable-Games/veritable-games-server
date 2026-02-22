# Q1 2026 Workspace Sprint Plan

**Planning Period**: February 15 - March 31, 2026 (6 weeks)
**Goal**: Increase feature parity from 39% to 52% (+13 points)
**Total Effort**: 86-116 hours (14-19 hours/week)

This sprint plan is based on comprehensive analysis from three documents:
- [UI/UX Competitive Analysis](/docs/analysis/workspace-ui-ux-competitive-analysis-feb-2026.md)
- [Feature Capability Matrix](/docs/analysis/workspace-feature-capability-matrix-feb-2026.md)
- [Technical Architecture Comparison](/docs/architecture/workspace-technical-comparison-feb-2026.md)

---

## Executive Summary

### Strategic Focus Areas

**Phase 1: Discoverability & Quick Wins** (Sprints 1-2)
- Improve user onboarding experience
- Enable basic productivity features (copy/paste, PNG export)

**Phase 2: Performance & Architecture** (Sprint 3)
- Fix Yjs deep cloning bug (+50% performance)
- Begin god component decomposition
- Add basic testing infrastructure (20% coverage)

### Success Metrics

| Metric | Current (Feb 15) | Target (Mar 31) | Change |
|--------|------------------|-----------------|--------|
| **Feature Parity** | 39% | 52% | +13% |
| **FPS @ 1000 nodes** | 30-35 FPS | 40-45 FPS | +33% |
| **Test Coverage** | 0% | 20% | +20% |
| **Component Size** | 1,741 lines | 800-1000 lines | -43-54% |

---

## Sprint 1: Critical Features (Feb 15-28)

**Focus**: Implement most-requested productivity features
**Duration**: 2 weeks

### Goals
1. ✅ PNG export
2. ✅ Copy/paste for single nodes
3. ✅ Fix grayed-out export icons (DONE)

### Tasks

#### 1.1 PNG Export Implementation
**Priority**: High
**Impact**: High - Most requested export format

**Subtasks**:
- [ ] Implement PNG export function (4-5h)
  - File: `/frontend/src/lib/workspace/export-import.ts`
  - Use html2canvas or similar library
  - Export visible viewport or entire workspace (user choice)
  - Handle high DPI displays (2x scale)
- [ ] Add PNG option to export menu (1h)
  - File: `/frontend/src/components/workspace/WorkspaceCanvas.tsx`
  - Add "Export as PNG" button
- [ ] Add download progress indicator (1-2h)
  - Show loading state during export
  - Handle large workspaces gracefully

**Testing**:
- [ ] Test export quality at various zoom levels
- [ ] Verify high DPI rendering (Retina displays)
- [ ] Test with 100+ nodes (performance)

**Success Criteria**:
- ✅ PNG export works for workspaces with <500 nodes
- ✅ Exported image quality is acceptable (text readable)
- ✅ Export completes within 5 seconds for typical workspaces

---

#### 1.2 Basic Copy/Paste for Single Nodes
**Priority**: Medium
**Impact**: High - Fundamental productivity feature

**Subtasks**:
- [ ] Implement copy single node (1h)
  - File: `/frontend/src/lib/workspace/clipboard.ts` (new file)
  - Store node data in clipboard state
- [ ] Implement paste with offset (1-1.5h)
  - Paste at mouse position or with 20px offset
  - Generate new IDs for pasted nodes
- [ ] Add keyboard shortcuts (0.5-1h)
  - Ctrl+C, Ctrl+V
  - Update ControlsModal documentation

**Testing**:
- [ ] Test copy/paste preserves all node properties
- [ ] Verify pasted nodes get new IDs
- [ ] Check keyboard shortcuts work

**Success Criteria**:
- ✅ Can copy/paste single text nodes
- ✅ Pasted nodes appear with 20px offset
- ✅ Keyboard shortcuts (Ctrl+C, Ctrl+V) work

**Deferred to Sprint 2**:
- Multi-select copy/paste (more complex)
- Cross-workspace copy/paste

---

### Sprint 1 Deliverables

- ✅ PNG export feature
- ✅ Fixed export button styling
- ✅ Basic copy/paste for single nodes

**Total Effort**: 24-32 hours
**Feature Parity Impact**: 39% → 44% (+5%)

---

## Sprint 2: Multi-Select & Styling UI (Mar 1-14)

**Focus**: Enable multi-select workflows and expose styling capabilities
**Duration**: 2 weeks
**Total Effort**: 28-36 hours

### Goals
1. ✅ Implement multi-select copy/paste
2. ✅ Add styling UI (expose existing schema)
3. ✅ Implement fit-to-screen function
4. ✅ Add grid snapping UI

### Tasks

#### 2.1 Multi-Select Copy/Paste (8-10 hours)
**Priority**: High
**Impact**: High - Core productivity feature

**Subtasks**:
- [ ] Extend clipboard to handle multiple nodes (3-4h)
  - File: `/frontend/src/lib/workspace/clipboard.ts`
  - Store array of nodes + connections between them
  - Preserve relative positions
- [ ] Implement paste with connection reconstruction (3-4h)
  - Paste nodes at offset
  - Recreate connections between pasted nodes
  - Handle connections to non-selected nodes (omit)
- [ ] Add visual feedback (1-2h)
  - Show "X items copied" toast notification
  - Highlight pasted nodes briefly
- [ ] Update keyboard shortcuts (1h)
  - Ctrl+C copies all selected nodes
  - Ctrl+V pastes with relative positions preserved

**Testing**:
- [ ] Test copy/paste 2-10 nodes with connections
- [ ] Verify relative positions maintained
- [ ] Check edge cases (no connections, circular connections)

**Success Criteria**:
- ✅ Can copy/paste multiple nodes (up to 50)
- ✅ Connections between pasted nodes preserved
- ✅ Relative layout maintained

---

#### 2.2 Styling UI Implementation (10-12 hours)
**Priority**: High
**Impact**: High - Schema exists but UI doesn't expose it

**Subtasks**:
- [ ] Create StylingPanel component (4-5h)
  - New file: `/frontend/src/components/workspace/StylingPanel.tsx`
  - Show when node(s) selected
  - Controls: background color, text color, border, font size
- [ ] Integrate with node rendering (3-4h)
  - File: `/frontend/src/components/workspace/TextNode.tsx`
  - Apply styling properties from node.properties.styling
  - Support CSS custom properties for dynamic styling
- [ ] Add color picker component (2-3h)
  - New file: `/frontend/src/components/ui/ColorPicker.tsx`
  - Preset colors + custom color input
  - Show recently used colors
- [ ] Update Zustand store actions (1h)
  - File: `/frontend/src/stores/workspace.ts`
  - Add updateNodeStyling action

**Testing**:
- [ ] Test all styling properties apply correctly
- [ ] Verify multi-select styling (apply to all selected)
- [ ] Check styling persists after save/reload

**Success Criteria**:
- ✅ Styling panel appears when nodes selected
- ✅ All styling properties (6+) can be customized
- ✅ Changes reflect immediately in viewport
- ✅ Styling persists across sessions

---

#### 2.3 Fit-to-Screen Function (4-5 hours)
**Priority**: Medium
**Impact**: High - Essential navigation feature

**Subtasks**:
- [ ] Implement fitToScreen function (2-3h)
  - File: `/frontend/src/lib/workspace/viewport-utils.ts` (new file)
  - Calculate bounding box of all nodes
  - Zoom to fit with 10% padding
  - Animate transition smoothly
- [ ] Add toolbar button (1h)
  - File: `/frontend/src/components/workspace/WorkspaceCanvas.tsx`
  - Add "Fit" button with icon (frame/maximize icon)
- [ ] Add keyboard shortcut (1h)
  - "F" key triggers fit-to-screen
  - Update ControlsModal

**Testing**:
- [ ] Test with various workspace sizes (10-1000 nodes)
- [ ] Verify animation smoothness
- [ ] Check edge cases (empty workspace, single node)

**Success Criteria**:
- ✅ Fit-to-screen centers all content with padding
- ✅ Animation is smooth (no janky transitions)
- ✅ Works for workspaces with 1-1000 nodes

---

#### 2.4 Grid Snapping UI (6-8 hours)
**Priority**: Low
**Impact**: Medium - Schema exists, needs UI

**Subtasks**:
- [ ] Add grid toggle to toolbar (1h)
  - File: `/frontend/src/components/workspace/WorkspaceCanvas.tsx`
  - Toggle button: "Grid" (on/off)
- [ ] Implement grid rendering (2-3h)
  - File: `/frontend/src/components/workspace/GridOverlay.tsx` (new)
  - Render SVG grid pattern
  - Grid size: 20px default (configurable)
  - Subtle color (neutral-800 with low opacity)
- [ ] Implement snap-to-grid logic (2-3h)
  - File: `/frontend/src/lib/workspace/input-handler.ts`
  - Round node positions to nearest grid cell when enabled
  - Apply during drag operations
- [ ] Add grid settings (1h)
  - Grid size selector (10px, 20px, 50px)
  - Grid visibility toggle

**Testing**:
- [ ] Test snapping at various zoom levels
- [ ] Verify grid renders correctly
- [ ] Check performance impact (should be minimal)

**Success Criteria**:
- ✅ Grid toggle works
- ✅ Nodes snap to grid when enabled
- ✅ Grid size is configurable
- ✅ No performance degradation with grid enabled

---

### Sprint 2 Deliverables

- ✅ Multi-select copy/paste with connections
- ✅ Comprehensive styling UI (6+ properties)
- ✅ Fit-to-screen function
- ✅ Grid snapping UI

**Total Effort**: 28-36 hours
**Feature Parity Impact**: 44% → 48% (+4%)

---

## Sprint 3: Performance & Architecture (Mar 15-31)

**Focus**: Fix critical performance bug and begin architectural improvements
**Duration**: 2 weeks
**Total Effort**: 34-48 hours

### Goals
1. ✅ Fix Yjs deep cloning bug (+50% performance)
2. ✅ Begin god component decomposition
3. ✅ Add basic testing (20% coverage)
4. ✅ Security hardening

### Tasks

#### 3.1 Fix Yjs Deep Cloning Bug (3-4 hours)
**Priority**: Critical
**Impact**: Very High - +50% rendering performance

**Current Bug**:
```typescript
// ❌ WRONG: Creates new object references every update
const nodes = JSON.parse(JSON.stringify(yNodesMap.toJSON()));
```

**Fix**:
```typescript
// ✅ CORRECT: Preserve references for React.memo
const nodes = yNodesMap.toJSON();
```

**Subtasks**:
- [ ] Remove deep cloning from Yjs subscribers (1-2h)
  - File: `/frontend/src/stores/workspace.ts`
  - Lines ~450-500 (estimated based on architecture)
  - Replace JSON.parse(JSON.stringify()) with direct .toJSON()
- [ ] Update React.memo comparison functions (1h)
  - File: `/frontend/src/components/workspace/TextNode.tsx`
  - Verify memo works with shallow comparison
- [ ] Performance testing (1h)
  - Test before: Measure FPS with 500 nodes
  - Test after: Verify +50% improvement
  - Document results

**Testing**:
- [ ] Verify no regressions in collaboration sync
- [ ] Test with multiple users editing simultaneously
- [ ] Measure FPS improvement (expect 30 FPS → 45 FPS @ 500 nodes)

**Success Criteria**:
- ✅ Yjs subscriptions use direct .toJSON() (no deep clone)
- ✅ React.memo still prevents unnecessary re-renders
- ✅ FPS improves by 40-60% at 500-1000 nodes
- ✅ No collaboration bugs introduced

**Risk**: Low (well-understood issue, clear fix)

---

#### 3.2 Component Decomposition Phase 1 (12-16 hours)
**Priority**: High
**Impact**: High - Improves maintainability, testability

**Goal**: Extract StateManager and EventHandler components

**Subtasks**:

##### StateManager Extraction (6-8h)
- [ ] Create StateManager component (3-4h)
  - New file: `/frontend/src/components/workspace/core/StateManager.tsx`
  - Extract Yjs setup and subscription logic (~150 lines)
  - Move from WorkspaceCanvas.tsx
- [ ] Add unit tests for StateManager (2-3h)
  - New file: `/frontend/src/components/workspace/core/__tests__/StateManager.test.tsx`
  - Mock Yjs document
  - Assert Zustand actions called correctly
  - Test cleanup on unmount
- [ ] Integration testing (1h)
  - Verify StateManager works in WorkspaceCanvas
  - Test with real Yjs sync

##### EventHandler Extraction (6-8h)
- [ ] Create EventHandler component (3-4h)
  - New file: `/frontend/src/components/workspace/core/EventHandler.tsx`
  - Extract event listeners, keyboard shortcuts (~150 lines)
  - Move from WorkspaceCanvas.tsx
- [ ] Add unit tests for EventHandler (2-3h)
  - New file: `/frontend/src/components/workspace/core/__tests__/EventHandler.test.tsx`
  - Mock DOM events
  - Assert correct actions dispatched
  - Test keyboard shortcut handling
- [ ] Integration testing (1h)
  - Verify all interactions still work
  - Test edge cases (rapid clicks, key combos)

**Before**:
```
WorkspaceCanvas.tsx (1,741 lines)
  - State management
  - Event handling
  - Rendering
  - Collaboration
  - Clipboard
  - Context menus
```

**After**:
```
WorkspaceCanvas.tsx (1,000-1,200 lines)
  - Rendering
  - Collaboration
  - Clipboard
  - Context menus

core/StateManager.tsx (150 lines)
  - Yjs setup
  - Zustand sync

core/EventHandler.tsx (150 lines)
  - Event listeners
  - Keyboard shortcuts
```

**Testing**:
- [ ] Full regression testing of workspace
- [ ] Verify no performance degradation
- [ ] Check all keyboard shortcuts still work

**Success Criteria**:
- ✅ WorkspaceCanvas.tsx reduced to 1,000-1,200 lines (-30-40%)
- ✅ StateManager has 10+ unit tests
- ✅ EventHandler has 10+ unit tests
- ✅ No regressions in functionality

---

#### 3.3 Basic Testing Infrastructure (8-10 hours)
**Priority**: High
**Impact**: Medium - Foundation for future testing

**Goal**: Achieve 20% test coverage

**Subtasks**:

##### Unit Tests (4-5h)
- [ ] Test viewport culling logic (2h)
  - File: `/frontend/src/lib/workspace/__tests__/viewport-culling.test.ts`
  - Test frustum culling with various viewports
  - Test edge cases (node partially visible)
- [ ] Test export/import utilities (2-3h)
  - File: `/frontend/src/lib/workspace/__tests__/export-import.test.ts`
  - Test JSON export format
  - Test import validation
  - Test error handling

##### Integration Tests (3-4h)
- [ ] Test node creation flow (1-2h)
  - File: `/frontend/src/components/workspace/__tests__/node-creation.test.tsx`
  - Test double-click creates node
  - Test node saves to database
  - Test Yjs sync
- [ ] Test selection workflow (2h)
  - File: `/frontend/src/components/workspace/__tests__/selection.test.tsx`
  - Test single-select
  - Test multi-select (Shift+click)
  - Test box selection

##### E2E Tests (1h)
- [ ] Setup Playwright (1h)
  - Install Playwright
  - Create basic test configuration
  - Add to CI pipeline (future)

**Coverage Target**:
- Utility functions: 80% coverage
- Components: 10% coverage (focus on critical paths)
- Overall: 20% coverage

**Testing**:
- [ ] Run all tests: `npm test`
- [ ] Generate coverage report: `npm run test:coverage`
- [ ] Verify 20% coverage achieved

**Success Criteria**:
- ✅ 20-30 unit tests passing
- ✅ 3-5 integration tests passing
- ✅ Test coverage ≥20%
- ✅ Tests run in CI (if configured)

---

#### 3.4 Security Hardening (6-8 hours)
**Priority**: Medium
**Impact**: Medium - Reduce security risks

**Subtasks**:
- [ ] Remove stack trace exposure (2-3h)
  - File: `/frontend/src/lib/utils/api-errors.ts`
  - Only show stack traces in development
  - Sanitize error messages for production
- [ ] Add rate limiting to WebSocket (2-3h)
  - File: `/frontend/server/websocket-server.ts`
  - Limit messages per second per client
  - Prevent DoS attacks
- [ ] Fix CORS configuration (1h)
  - File: `/frontend/server/websocket-server.ts`
  - Remove permissive CORS in production
  - Whitelist specific origins
- [ ] Add CSP headers (1-2h)
  - File: `/frontend/src/middleware.ts`
  - Strengthen Content Security Policy
  - Test with production build

**Testing**:
- [ ] Security audit with npm audit
- [ ] Test rate limiting (simulate rapid requests)
- [ ] Verify CSP doesn't break functionality

**Success Criteria**:
- ✅ Stack traces not exposed in production
- ✅ WebSocket rate limiting active
- ✅ CORS properly configured
- ✅ CSP headers strengthened

---

#### 3.5 Connection Labels UI (4-6 hours)
**Priority**: Low
**Impact**: Medium - Schema exists, needs UI

**Subtasks**:
- [ ] Add label input to connection creation (2-3h)
  - File: `/frontend/src/components/workspace/ConnectionRenderer.tsx`
  - Show label input when creating connection
  - Store label in connection.properties.label
- [ ] Render connection labels (2-3h)
  - Calculate label position (midpoint of connection)
  - Render text with background
  - Handle label editing (double-click to edit)

**Testing**:
- [ ] Test label creation and editing
- [ ] Verify labels persist
- [ ] Check label positioning at various zoom levels

**Success Criteria**:
- ✅ Can add labels to connections
- ✅ Labels render at midpoint
- ✅ Can edit labels by double-clicking

---

### Sprint 3 Deliverables

- ✅ Yjs deep cloning bug fixed (+50% performance)
- ✅ WorkspaceCanvas decomposed (1,741 → 1,000-1,200 lines)
- ✅ StateManager component with tests
- ✅ EventHandler component with tests
- ✅ 20% test coverage achieved
- ✅ Security hardening complete
- ✅ Connection labels UI (bonus)

**Total Effort**: 34-48 hours
**Feature Parity Impact**: 48% → 52% (+4%)
**Performance Impact**: 30-35 FPS → 40-50 FPS @ 1000 nodes

---

## Q1 2026 Summary

### Total Deliverables (6 weeks)

**Feature Parity**: 39% → 52% (+13%)
**Total Effort**: 86-116 hours (14-19 hours/week)

| Sprint | Focus | Effort | Parity Gain |
|--------|-------|--------|-------------|
| **Sprint 1** | Critical UX & Discoverability | 24-32h | +5% |
| **Sprint 2** | Multi-Select & Styling UI | 28-36h | +4% |
| **Sprint 3** | Performance & Architecture | 34-48h | +4% |
| **Total** | | **86-116h** | **+13%** |

### Key Achievements

**Discoverability** ✅
- Help button with controls modal

**Productivity** ✅
- Copy/paste (single + multi-select)
- PNG export
- Fit-to-screen
- Grid snapping UI
- Styling panel (6+ properties)

**Performance** ✅
- +50% FPS improvement (Yjs fix)
- 30-35 FPS → 40-50 FPS @ 1000 nodes

**Architecture** ✅
- Component decomposition started
- 20% test coverage achieved
- Security hardening complete

### Deferred to Q2 2026

The following were considered but deferred to maintain focus:

- SVG export (use PNG for now)
- Shape tools (rectangles, circles)
- Minimap (complex UI component)
- Templates system
- Search functionality
- Hybrid Canvas rendering (larger effort)

---

## Risk Management

### High Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Yjs fix breaks collaboration** | High | Low | Thorough testing with multiple users |
| **Component decomposition introduces bugs** | Medium | Medium | Comprehensive integration tests before merge |
| **PNG export performance issues** | Medium | Medium | Test with large workspaces, add loading indicator |

### Medium Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Styling UI too complex** | Medium | Low | Start simple, iterate based on feedback |
| **Grid snapping feels janky** | Low | Medium | Make snapping optional, add smooth transitions |
| **Test coverage slows development** | Low | High | Focus on high-value tests, not 100% coverage |

---

## Success Criteria & Metrics

### Feature Parity Metrics

| Category | Feb 15 | Mar 31 Target | Status |
|----------|--------|---------------|--------|
| Canvas Manipulation | 60% | 65% | +5% |
| Selection Tools | 70% | 75% | +5% |
| Copy/Paste | 25% | 75% | +50% |
| Styling | 40% | 60% | +20% |
| Export | 50% | 70% | +20% |
| Organization | 70% | 75% | +5% |
| **Overall** | **39%** | **52%** | **+13%** |

### Performance Metrics

| Metric | Feb 15 | Mar 31 Target | Improvement |
|--------|--------|---------------|-------------|
| FPS @ 100 nodes | 55 FPS | 60 FPS | +9% |
| FPS @ 500 nodes | 35 FPS | 50 FPS | +43% |
| FPS @ 1000 nodes | 30 FPS | 45 FPS | +50% |
| Memory @ 1000 nodes | 180 MB | 150 MB | -17% |

### Code Quality Metrics

| Metric | Feb 15 | Mar 31 Target | Change |
|--------|--------|---------------|--------|
| Test Coverage | 0% | 20% | +20% |
| Component Size (WorkspaceCanvas) | 1,741 lines | 1,000-1,200 lines | -31-43% |
| Unit Tests | 0 | 20-30 | +20-30 |
| Integration Tests | 0 | 3-5 | +3-5 |

### User Experience Metrics

| Metric | Feb 15 | Mar 31 Target | Change |
|--------|--------|---------------|--------|
| Help Access | Hidden (modal only) | Visible (toolbar button) | ✅ |

---

## Sprint Ceremonies & Process

### Sprint Planning (Every 2 weeks)
- Review previous sprint deliverables
- Prioritize tasks for next sprint
- Assign effort estimates
- Identify risks

### Daily Standup (Optional for solo developer)
- What did I complete yesterday?
- What will I work on today?
- Any blockers?

### Sprint Review (End of each sprint)
- Demo completed features
- Update feature parity metrics
- Document lessons learned

### Sprint Retrospective (End of each sprint)
- What went well?
- What could be improved?
- Action items for next sprint

---

## Tools & Resources

### Development Tools
- VS Code with TypeScript, Prettier, ESLint extensions
- Chrome DevTools for performance profiling
- React DevTools for component debugging
- Git for version control

### Testing Tools
- Jest for unit/integration tests
- React Testing Library for component tests
- Playwright for E2E tests (future)

### Design Tools
- Figma for mockups (if needed)
- Mermaid for diagrams
- Screenshots of Excalidraw/Miro for reference

### Project Management
- Todo list (TodoWrite tool)
- Sprint plan (this document)
- Git commit messages for tracking progress

---

## Communication & Documentation

### Commit Message Format
```


Refs: Q1-2026 Sprint 1, Task 1.1
```

### Documentation Updates
After each sprint:
- Update feature parity scores
- Document new features in `/docs/features/`
- Update architecture diagrams if needed
- Add to changelog

---

## Next Steps (After Q1 2026)

### Q2 2026 Preview (Apr-Jun)
**Goal**: 52% → 66% (+14%)
**Focus**: Differentiation & shape tools

Planned features:
- Shape tools (rectangles, circles, arrows)
- Templates system
- Search functionality
- Minimap
- Wiki integration (unique differentiator)
- Forum integration (unique differentiator)

### Q3 2026 Preview (Jul-Sep)
**Goal**: 66% → 76% (+10%)
**Focus**: Collaboration stability & library integration

Planned features:
- Real-time collaboration polish
- Library integration (unique differentiator)
- Hybrid Canvas rendering (2-3x performance)
- 60% test coverage

---

## Appendices

### Appendix A: Related Documents
- [UI/UX Competitive Analysis](/docs/analysis/workspace-ui-ux-competitive-analysis-feb-2026.md)
- [Feature Capability Matrix](/docs/analysis/workspace-feature-capability-matrix-feb-2026.md)
- [Technical Architecture Comparison](/docs/architecture/workspace-technical-comparison-feb-2026.md)
- [Architecture Diagrams](/docs/architecture/diagrams/README.md)

### Appendix B: Critical Files
- `/frontend/src/components/workspace/WorkspaceCanvas.tsx` (1,741 lines)
- `/frontend/src/stores/workspace.ts` (1,886 lines)
- `/frontend/src/lib/workspace/types.ts` (700+ lines)
- `/frontend/src/components/workspace/TextNode.tsx` (750+ lines)

### Appendix C: Performance Baseline
From `/docs/completed/feb-2026/workspace-performance-tests-feb-14-2026.md`:
- 100 nodes: 55-58 FPS ✅
- 500 nodes: 35-40 FPS ⚠️
- 1000 nodes: 25-30 FPS ❌
- Target after Yjs fix: 40-50 FPS @ 1000 nodes

---

**Last Updated**: February 14, 2026
**Status**: ✅ Ready for execution
**Next Review**: February 28, 2026 (End of Sprint 1)
