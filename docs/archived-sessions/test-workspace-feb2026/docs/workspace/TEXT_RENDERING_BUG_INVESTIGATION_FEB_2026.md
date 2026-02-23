# Text Rendering Bug Investigation - UNRESOLVED - February 15, 2026

> ⚠️ **CRITICAL**: This document tracks a failed investigation. As of commit fbd7cc8, the text rendering bugs remain UNRESOLVED despite two attempted fixes being deployed to production.

## Executive Summary

**Bugs**: Two critical rendering issues affecting text nodes in workspace.

**Bug #1 - Transform Origin Mismatch**:
- **Symptom**: Text layers misaligned when editing, worsening at non-100% zoom
- **Root Cause**: CSS transform origin mismatch between canvas (`0 0`) and TextNode (`50% 50%`)
- **Attempted Fix**: Added `transformOrigin: '0 0'` to TextNode container
- **Status**: ❌ FIX FAILED - Issue still present as of commit fbd7cc8

**Bug #2 - Wrong Editor for HTML Content**:
- **Symptom**: When selecting text, user sees raw HTML tags (`<strong>`, `<em>`) instead of formatted text, with both display and editor layers visible simultaneously
- **Root Cause Hypothesis**: Environment variable forcing MarkdownTextEditor (textarea) for HTML content
- **Attempted Fix**: Check content type before editor selection - HTML uses RichTextEditor, Markdown uses MarkdownTextEditor
- **Status**: ❌ FIX FAILED - Issue still present as of commit fbd7cc8

**Impact**: CRITICAL - Affects all text nodes at all zoom levels

**Overall Status**: ❌ UNRESOLVED - Both attempted fixes did not resolve the issues

**Last Verified**: February 15, 2026, commit fbd7cc8

---

## IMPORTANT: ATTEMPTED FIXES FAILED

**As of commit fbd7cc8 (February 15, 2026), the text rendering bugs remain UNRESOLVED.**

Two fixes were attempted based on initial investigation:
1. ❌ Transform origin alignment (commit 6332635d3d)
2. ❌ Content-aware editor selection (commit 6332635d3d)

**User confirmation**: "this was not a success" - issues still present after both fixes deployed.

**Next steps required**: Further investigation needed to identify the true root cause.

---

## Problem Description

### Symptoms (Reported by User)

1. **Text truncation**: Text appears truncated inside text area in view mode
2. **Layer position mismatch**: Visible text and editable text appear at different positions and scales
3. **Highlight misalignment**: Editable text highlighting (cyan selection) doesn't coincide with visual text position, scale, or font
4. **Unformatted text when highlighting**: When selecting text in edit mode, raw HTML tags (`<strong>`, `<em>`, `<p>`) are visible instead of formatted text
5. **Simultaneous layer visibility**: Both the formatted display layer AND the raw HTML editor layer are visible at the same time when highlighting

### Visual Evidence

User provided 4 screenshots showing severe misalignment:
- Image 1-3: Moderate misalignment visible
- Image 4: **CRITICAL** - Layers completely offset, making text uneditable

### Zoom Level Correlation

Bug severity increased with distance from 100% zoom:
- 100% zoom: Minimal/no visible issue
- 58% zoom: Noticeable offset
- 156% zoom: Severe misalignment (Image 4 scenario)

---

## Investigation Process

### Phase 1: Agent Deployment (February 15, 2026)

Deployed 3 specialized agents for parallel investigation:

1. **Agent a2e951f** (Code Analysis)
   - Task: Font size & viewport transform investigation
   - Status: ✅ COMPLETED
   - Output: `/docs/workspace/FONT_SIZE_TRANSFORM_ANALYSIS_FEB_2026.md` (500+ lines)
   - Key Finding: Identified transform origin mismatch

2. **Agent a550fff** (Live Site Testing - NOXII)
   - Task: Playwright visual testing on NOXII workspace
   - Status: ✅ COMPLETED
   - Output: 9 screenshots at zoom levels 58%-156%
   - Captured DOM structure and console errors

3. **Agent aedd2b5** (Live Site Testing - AUTUMN)
   - Task: Playwright visual testing on AUTUMN workspace (234 nodes)
   - Status: 🔴 KILLED (after capturing 10+ screenshots)
   - Output: Screenshots at zoom levels 58%-156%

### Phase 2: Root Cause Analysis

**Transform Inheritance Chain**:
```
WorkspaceCanvas (2,855 lines)
  └─ Canvas Layer <div> ← transformOrigin: '0 0' ✅
      └─ TextNode <div> ← transformOrigin: [implicit '50% 50%'] ❌
          └─ Content Display <div>
          └─ Tiptap Editor <div> (edit mode)
```

**CSS Transform Application**:
- Parent (canvas layer): `transform: translate3d(offsetX, offsetY, 0) scale(scale)`
- Parent transform origin: `transformOrigin: '0 0'` (top-left)
- Child (TextNode): Inherits transform, but uses different origin point

**Why It Breaks**:
When viewport zooms, nested transforms compound from different origin points:
- Canvas layer scales from top-left corner (0, 0)
- TextNode scales from center (50%, 50%)
- Result: Position offset = `(scale - 1) × (nodeWidth/2, nodeHeight/2)`

**At 150% zoom (scale = 1.5)**:
- 200px wide node offset by: `(1.5 - 1) × (200/2) = 50px`
- This explains why bug worsens at higher zoom levels

---

## Bug #2: Wrong Editor Mode for HTML Content

### Symptoms (Reported by User)

When double-clicking to edit text with formatting (bold, italic, etc.):
1. **Unformatted text appears when highlighting**: Selecting text shows raw HTML source (`<p>`, `<strong>`, `<b>`) instead of formatted text
2. **Both layers visible simultaneously**: The formatted display layer underneath is visible while selecting the raw HTML editor layer on top
3. **Text appears correctly in view mode but broken in edit mode**

### Root Cause Analysis

The system has two editor modes:
- **RichTextEditor** (Tiptap/ProseMirror): For HTML content with proper WYSIWYG editing
- **MarkdownTextEditor** (textarea): For markdown content with raw source editing

The bug occurs due to environment-based editor selection:

**File**: `/frontend/src/lib/workspace/markdown-utils.ts` (line 274-276)
```typescript
export function isMarkdownModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_MARKDOWN_MODE === 'true';
}
```

**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 489)
```typescript
{isMarkdownModeEnabled() ? (
  <MarkdownTextEditor />  // ← Uses textarea with raw HTML
) : (
  <RichTextEditor />      // ← Uses Tiptap with proper rendering
)}
```

When `NEXT_PUBLIC_WORKSPACE_MARKDOWN_MODE=true`, **ALL nodes** use MarkdownTextEditor, even if content is HTML!

### How MarkdownTextEditor Creates the Bug

MarkdownTextEditor renders HTML content in a transparent textarea:

```html
<textarea
  style="
    color: transparent;
    -webkit-text-fill-color: transparent;
    z-index: 10;
    background: transparent;
  "
>
  &lt;p&gt;&lt;strong&gt;Fortune (Father Fortune)&lt;/strong&gt;&lt;/p&gt;
</textarea>
```

**The layer stack**:
1. **Bottom**: Formatted display layer shows "**Fortune (Father Fortune)**" (bold)
2. **Top**: Transparent textarea contains `<p><strong>Fortune...</strong></p>` (raw HTML)

**What the user experiences**:
- View mode: Sees formatted text (display layer)
- Double-click to edit: MarkdownTextEditor loads with transparent textarea on top
- Select text: Highlights raw HTML in textarea, but sees formatted text underneath
- Result: Sees both `<strong>` tags AND bold text simultaneously

### Investigation Evidence

Live site DOM inspection revealed:
```javascript
{
  isMarkdownEditor: true,
  textareaContent: "<p><strong>Fortune (Father Fortune)</strong></p>",
  textareaStyle: {
    color: "rgba(0, 0, 0, 0)",           // Fully transparent
    textFillColor: "rgba(0, 0, 0, 0)",   // Fully transparent
    zIndex: "10",                         // Above display layer
    background: "none"                    // Transparent
  }
}
```

**Node**: `node_d3f9942b-e004-43c4-80d7-4e388c1bf6fb` (Fortune node)

### The Fix (Bug #2)

**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 489)

**Before** (BUGGY):
```typescript
{isMarkdownModeEnabled() ? (
  <MarkdownTextEditor />
) : (
  <RichTextEditor />
)}
```

**After** (FIXED):
```typescript
{isMarkdownModeEnabled() && !isHtmlContent(content) ? (
  <MarkdownTextEditor />
) : (
  <RichTextEditor />
)}
```

**Logic**:
- If markdown mode is enabled AND content is NOT HTML → MarkdownTextEditor
- Otherwise (HTML content OR markdown mode disabled) → RichTextEditor

This ensures HTML content always gets the proper WYSIWYG editor, regardless of the environment variable.

---

## The Fixes

### Fix #1: Transform Origin Alignment

**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 437)

**Change**: Add `transformOrigin: '0 0'` to TextNode container style

```typescript
// BEFORE (lines 432-439)
style={{
  left: `${node.position.x}px`,
  top: `${node.position.y}px`,
  width: `${node.size.width}px`,
  height: `${node.size.height}px`,
  zIndex: node.z_index,
  userSelect: isEditing ? 'text' : 'none',
}}

// AFTER (lines 432-440)
style={{
  left: `${node.position.x}px`,
  top: `${node.position.y}px`,
  width: `${node.size.width}px`,
  height: `${node.size.height}px`,
  zIndex: node.z_index,
  transformOrigin: '0 0', // ← ADDED: Match parent canvas layer's transform origin
  userSelect: isEditing ? 'text' : 'none',
}}
```

**Why This Works**:
1. **Consistent origin point**: Both parent and child now scale/transform from top-left (0, 0)
2. **No compound offset**: Transform calculations align at all zoom levels
3. **CSS standard behavior**: Explicit `transformOrigin` overrides default center-point inheritance

---

### Fix #2: Content-Aware Editor Selection

**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 489)

**Change**: Check content type before selecting editor

```typescript
// BEFORE (line 489 - BUGGY)
{isMarkdownModeEnabled() ? (
  <MarkdownTextEditor
    content={content}
    onChange={...}
  />
) : (
  <RichTextEditor
    content={content}
    onChange={...}
  />
)}

// AFTER (line 489 - FIXED)
{isMarkdownModeEnabled() && !isHtmlContent(content) ? (
  <MarkdownTextEditor
    content={content}
    onChange={...}
  />
) : (
  <RichTextEditor
    content={content}
    onChange={...}
  />
)}
```

**Why This Works**:
1. **Content-aware routing**: HTML content always gets RichTextEditor (Tiptap WYSIWYG)
2. **Markdown support preserved**: True markdown content still uses MarkdownTextEditor
3. **Environment override respected**: Markdown mode can be enabled without breaking HTML nodes
4. **Function reuse**: Leverages existing `isHtmlContent()` detection from `markdown-utils.ts`

---

## Verification Steps

### Pre-Deployment Testing (Recommended)

1. **Local testing**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Test at multiple zoom levels**:
   - 50% zoom (Ctrl + -)
   - 100% zoom (Ctrl + 0)
   - 150% zoom (Ctrl + +)
   - 200% zoom (Ctrl + +)

3. **Test both node types**:
   - Text nodes (transparent background)
   - Sticky notes (colored background)

4. **Test interaction modes**:
   - View mode: Text should display correctly
   - Edit mode: Click to enter edit, verify highlighting aligns with visible text
   - Selection: Drag to select text, verify cyan highlight matches text position

### Expected Results (After Fixes)

**Fix #1 (Transform Origin)**:
✅ Text position identical in view and edit modes
✅ Cyan highlight aligns perfectly with visible text
✅ No position offset at any zoom level
✅ Consistent alignment from 50% to 200% zoom

**Fix #2 (Editor Selection)**:
✅ Double-clicking HTML nodes opens RichTextEditor (Tiptap) with proper formatting
✅ Text selection shows formatted text, not raw HTML tags
✅ No simultaneous display of `<strong>`, `<em>` tags and formatted text
✅ Bold, italic, underline render correctly in edit mode
✅ Markdown nodes still use MarkdownTextEditor when markdown mode is enabled

**Combined**:
✅ Font size remains correct (was already working)
✅ Text selection works accurately
✅ Editing experience matches view mode appearance

---

## Technical Details

### Transform Origin Fundamentals

**Default CSS behavior**:
- `transform-origin: 50% 50%` - Transform from center (default)
- `transform-origin: 0 0` - Transform from top-left corner
- `transform-origin: 100% 100%` - Transform from bottom-right corner

**Nested transform behavior**:
When child elements inherit transforms, they also inherit transform context. If transform origins differ between parent and child, coordinate systems become misaligned.

**GPU acceleration**:
Using `translate3d()` instead of `translate()` triggers GPU acceleration, but doesn't affect transform origin behavior.

### Related Components (No Changes Needed)

1. **WorkspaceCanvas.tsx** (line 2671-2700):
   ```typescript
   // Canvas layer - ALREADY CORRECT
   <div
     ref={canvasLayerRef}
     style={{
       transform: transformManagerRef.current?.toCSSTransform() || 'none',
       transformOrigin: '0 0', // ✅ Top-left origin
     }}
   >
   ```

2. **RichTextEditor.tsx** (lines 148-162):
   - No explicit transform origin set
   - Now inherits correct `'0 0'` from fixed TextNode parent
   - No changes needed

3. **transform-manager.ts** (lines 242-244):
   - Transform calculation logic is correct
   - Generates `translate3d(x, y, 0) scale(s)` string
   - No changes needed

---

## What Was Attempted (ALL FAILED)

### Attempt #1: Transform Origin Alignment
**Commit**: 6332635d3d (earlier commit in same session)
**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 438)
**Change**: Added `transformOrigin: '0 0'` to TextNode container style
**Hypothesis**: CSS transform origin mismatch causing position offset
**Result**: ❌ FAILED - Did not resolve alignment issues

### Attempt #2: Content-Aware Editor Selection
**Commit**: 6332635d3d (February 15, 2026)
**File**: `/frontend/src/components/workspace/TextNode.tsx` (line 489)
**Change**: Modified editor selection from `isMarkdownModeEnabled()` to `isMarkdownModeEnabled() && !isHtmlContent(content)`
**Hypothesis**: MarkdownTextEditor (textarea) being used for HTML content, causing raw tags to appear
**Result**: ❌ FAILED - Did not resolve raw HTML tag visibility issue

### User Verification
**Commit tested**: fbd7cc8
**User feedback**: "this was not a success"
**Conclusion**: Both attempted fixes deployed to production, but original bugs remain unresolved

---

## Investigation Status

### What We Learned (That Didn't Help)
1. ✅ Confirmed HTML content is stored in database (not markdown)
2. ✅ Confirmed MarkdownTextEditor uses transparent textarea
3. ✅ Confirmed transform origin mismatch exists in code
4. ✅ Confirmed environment variable `NEXT_PUBLIC_WORKSPACE_MARKDOWN_MODE=true` affects editor selection
5. ❌ None of these findings led to successful fixes

### What Still Needs Investigation
1. ❓ Why does transform origin fix not resolve position issues?
2. ❓ Why does editor selection fix not resolve raw HTML visibility?
3. ❓ Is there a deeper rendering pipeline issue?
4. ❓ Are there other layers or transforms affecting text positioning?
5. ❓ Is the issue related to Yjs CRDT updates or real-time sync?
6. ❓ Could this be a browser-specific rendering bug?

### Next Investigation Steps Required
- [ ] Test on production with browser DevTools to inspect actual DOM state during edit
- [ ] Compare working vs broken nodes to identify differences
- [ ] Check if issue appears in local dev environment vs production only
- [ ] Inspect z-index stacking and CSS layer composition
- [ ] Check for any CSS transforms applied by parent components
- [ ] Review Tiptap/ProseMirror rendering pipeline
- [ ] Check for conflicts with viewport transform calculations

---

## Deployment History

### Deployment #1 (Failed)
- **Date**: February 15, 2026
- **Commits**: 6332635d3d
- **Changes**: Transform origin + editor selection fixes
- **Pre-commit checks**: ✅ All passed
- **TypeScript**: ✅ Passed
- **Tests**: ✅ Passed
- **Deployment**: ✅ Successful via Coolify
- **User verification**: ❌ FAILED - Issues still present
- **Status**: Fixes did not resolve the bugs

### Deployment

1. **Format code**:
   ```bash
   cd frontend
   npm run format
   ```

2. **Commit change**:
   ```bash
   cd /home/user/Projects/veritable-games-main
   git add frontend/src/components/workspace/TextNode.tsx
   git add docs/workspace/TEXT_RENDERING_BUG_FIX_FEB_2026.md
   git commit -m "fix: text node rendering bugs - transform origin and editor selection

   Two critical fixes for workspace text nodes:

   Fix #1: Transform origin alignment
   - Add transformOrigin: '0 0' to TextNode container style
   - Fixes text misalignment at non-100% zoom levels
   - Root cause: CSS transform origin mismatch between canvas layer
     (0 0) and TextNode container (default 50% 50%)
   - Impact: Text layers align perfectly at all zoom levels

   Fix #2: Content-aware editor selection
   - Check content type before selecting editor mode
   - HTML content now always uses RichTextEditor (Tiptap WYSIWYG)
   - Markdown content uses MarkdownTextEditor when mode enabled
   - Root cause: NEXT_PUBLIC_WORKSPACE_MARKDOWN_MODE forcing
     MarkdownTextEditor for HTML, causing raw tags to be visible
   - Impact: Users see formatted text in edit mode, not <strong> tags

   Testing: TypeScript passes, ready for manual verification

   Closes: TEXT_RENDERING_BUG_FEB_2026"
   ```

3. **Push to main**:
   ```bash
   git push origin main
   ```

4. **Monitor Coolify auto-deploy** (2-5 minutes):
   - Watch for deployment completion
   - Check logs for errors

### Post-Deployment Verification

1. **Live site testing**:
   - Navigate to https://www.veritablegames.com/projects/autumn/workspace
   - Test existing nodes at multiple zoom levels
   - Enter edit mode, verify highlighting aligns

2. **User acceptance**:
   - Have original bug reporter verify fix
   - Confirm all 4 original screenshots' scenarios are resolved

---

## Related Documentation

- **Investigation Report**: `/docs/workspace/FONT_SIZE_TRANSFORM_ANALYSIS_FEB_2026.md`
- **Visual Testing**: `/docs/workspace/TEXT_NODE_VISUAL_TESTING_FEB_2026.md`
- **Architecture**: `/docs/workspace/WORKSPACE_COMPREHENSIVE_ANALYSIS_NOV_2025.md`

---

## Lessons Learned

### What Worked Well

1. **Multi-agent investigation**: Parallel code analysis + live site testing provided comprehensive view
2. **Documentation-first approach**: Created detailed analysis before implementing fix
3. **Root cause identification**: Architectural review revealed fundamental CSS issue

### What Could Be Improved

1. **Testing automation**: Playwright struggled to trigger edit mode reliably
   - Manual testing may be more effective for text editing workflows
   - Consider E2E tests with explicit wait strategies

2. **Transform origin awareness**: Document transform origin requirements for all canvas-based components
   - Add to component library style guide
   - Include in TextNode component comments

### Preventive Measures

1. **Component template**: Create workspace component template with required CSS properties:
   ```typescript
   // Template for all workspace canvas components
   style={{
     position: 'absolute',
     left: `${x}px`,
     top: `${y}px`,
     transformOrigin: '0 0', // ← REQUIRED for canvas components
   }}
   ```

2. **ESLint rule**: Consider custom ESLint rule to enforce transform origin on absolute-positioned workspace components

3. **Visual regression testing**: Implement screenshot-based tests at multiple zoom levels to catch rendering issues early

---

## Contributors

- **Investigation**: Claude Code agents (a2e951f, a550fff, aedd2b5)
- **Analysis**: Agent a2e951f (Code Analysis Specialist)
- **Fix Implementation**: Claude Sonnet 4.5
- **Bug Reporter**: User (February 15, 2026)

---

## Current Status Summary

**Investigation Date**: February 15, 2026
**Attempted Fixes**: 2 code changes deployed
**Severity**: CRITICAL
**Status**: ❌ UNRESOLVED

### Failed Attempts
1. Transform origin alignment (commit 6332635d3d) - Did not fix position issues
2. Editor selection logic (commit 6332635d3d) - Did not fix raw HTML visibility

### Verified As of Commit
**Commit**: fbd7cc8
**Deployment**: Production (Coolify auto-deploy completed)
**User Verification**: Issues still present

### What This Means
The text rendering bugs remain active in production. Users still experience:
- Misaligned text layers when editing
- Raw HTML tags visible when selecting text
- Both display and editor layers visible simultaneously

### Recommended Next Actions
1. **Rollback consideration**: Evaluate if fixes introduced new issues
2. **Deeper investigation**: Use production browser DevTools to inspect live state
3. **Alternative approaches**: Consider different root causes beyond transform origin and editor selection
4. **User input**: Get more detailed reproduction steps or screen recordings
5. **Comparative analysis**: Test on different browsers/devices to narrow scope

---

**Document Last Updated**: February 15, 2026
**Status**: ❌ BUGS UNRESOLVED
**Commits Referenced**: 6332635d3d (failed fixes), fbd7cc8 (verification)
