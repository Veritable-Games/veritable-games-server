# Content Tracing System

> **Last Updated**: January 7, 2026
> **Status**: Implemented and Production-Ready
> **Author**: Claude Code Session

---

## Overview

The Content Tracing System enables gradual replacement of AI-generated content with human-written content using a "tracing paper" metaphor. Like placing tracing paper over an image, users can see the AI-generated background dimmed underneath while editing their own content on top.

### Key Concept

- **Background Layer**: AI-generated content (immutable reference, displayed dimmed)
- **Traced Layer**: Human-written content (editable, displayed at full opacity)

When traced content exists, it appears on top of the dimmed background. When no traced content exists, the background is shown at reduced opacity with an indicator that human edits are coming.

---

## Architecture

### Data Model

The system uses a simple string-based approach rather than anchor-based fragments:

```
┌─────────────────────────────────────────────────────────────┐
│                     projects table                          │
├─────────────────────────────────────────────────────────────┤
│ content             │ TEXT    │ Main project content        │
│ background_content  │ TEXT    │ AI-generated reference      │
│ traced_content      │ TEXT    │ Human-written layer         │
└─────────────────────────────────────────────────────────────┘
```

**Logic**:
- `background_content` falls back to `content` if not explicitly set
- `traced_content` is the human-edited overlay (null until first edit)
- Tracing is automatically enabled for all projects with content

### Component Hierarchy

```
ProjectPage (Server Component)
└── ProjectDetailClient (Client Component)
    └── ProjectTabs
        └── TracingContentViewer (Dynamic Import, ssr: false)
            ├── Background Layer (15% opacity, pointer-events: none)
            └── Foreground Layer (100% opacity, editable in trace mode)
```

---

## User Experience

### For Non-Admin Users

1. **With Traced Content**:
   - See traced content at full opacity
   - Background visible underneath at 15% opacity

2. **Without Traced Content**:
   - See background content at 40% opacity
   - Indicator: "AI-generated content - human edits coming soon"

### For Admin Users

1. **View Mode**:
   - See traced content (or background if none exists)
   - Background visible underneath at 10% opacity when traced content exists
   - Footer shows "Trace" button to enter edit mode

2. **Trace Mode**:
   - Purple status bar: "Trace Mode: Edit directly. Background shows original for reference."
   - Full-document textarea for editing
   - Background content visible at 15% opacity behind editor
   - Keyboard shortcut: Ctrl/Cmd+S to save
   - Auto-save on blur
   - "Exit Trace" button in footer

### Table of Contents Behavior

The sidebar Table of Contents (TOC) uses traced content when available:
- **With traced content**: TOC shows headings from human-written content
- **Without traced content**: TOC shows headings from background content

This ensures the navigation reflects the human-edited structure, not the AI-generated one.

---

## Implementation Details

### Files Modified/Created

#### Core Components

| File | Purpose |
|------|---------|
| `src/components/tracing/TracingContentViewer.tsx` | Main tracing UI component |
| `src/components/projects/ProjectTabs.tsx` | Tab container with TOC integration |
| `src/components/projects/ProjectDetailClient.tsx` | Client-side state management |
| `src/app/projects/[slug]/page.tsx` | Server component data fetching |

#### API Routes

| File | Purpose |
|------|---------|
| `src/app/api/projects/[slug]/route.ts` | GET/PUT project data |
| `src/app/api/projects/[slug]/traces/route.ts` | PUT traced content (admin only) |

#### Database

| File | Purpose |
|------|---------|
| `scripts/migrations/016-traced-content-column.sql` | Add `traced_content` column |

### TracingContentViewer Props

```typescript
interface TracingContentViewerProps {
  /** AI-generated background content (markdown) - the original reference */
  backgroundContent: string;
  /** User's traced/edited content - the editable layer */
  tracedContent?: string;
  /** Whether the user is an admin (can see background and edit) */
  isAdmin: boolean;
  /** Project slug for API calls */
  projectSlug: string;
  /** Callback when traced content changes */
  onTracedContentChange?: (content: string) => void;
  /** Callback to save traced content */
  onSave?: (content: string) => Promise<void>;
  /** Custom class name */
  className?: string;
  /** External control of tracing mode */
  isTracingMode?: boolean;
  /** Callback when tracing mode changes */
  onTracingModeChange?: (isTracing: boolean) => void;
}
```

### API Endpoint: PUT /api/projects/[slug]/traces

**Authentication**: Required (admin only)
**CSRF Protection**: Enabled

**Request Body**:
```json
{
  "content": "# Human-written content\n\nThis replaces the AI background..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Traced content saved"
}
```

---

## Database Migration

### Migration: 016-traced-content-column.sql

```sql
-- Add traced_content column to projects table
ALTER TABLE content.projects
ADD COLUMN IF NOT EXISTS traced_content TEXT;

COMMENT ON COLUMN content.projects.traced_content IS
  'Full document human-edited content (the traced layer). When present, displayed over the dimmed background_content.';
```

**Run migration**:
```bash
# Development
npm run db:migrate

# Production
npm run db:migrate:production
```

---

## Visual Design

### Opacity Levels

| Context | Background Opacity | Traced Opacity |
|---------|-------------------|----------------|
| Non-admin, no traced content | 40% | N/A |
| Non-admin, with traced content | 15% | 100% |
| Admin view mode, no traced content | 40% | N/A |
| Admin view mode, with traced content | 10% | 100% |
| Admin trace mode (editing) | 15% | 100% (textarea) |

### Status Bar (Trace Mode)

- Background: `bg-purple-900/20`
- Border: `border-purple-500/30`
- Text: "Trace Mode: Edit directly. Background shows original for reference."
- Shows "Unsaved changes" indicator when dirty
- Shows "Saving..." during save

### Indicator (No Traced Content)

When showing background-only content:
- Position: Absolute, bottom-center
- Style: Rounded pill, dark background
- Text: "AI-generated content - human edits coming soon"

---

## Usage Workflow

### Admin Workflow

1. Navigate to a project page
2. View shows current content (traced or background)
3. Click "Trace" in footer to enter trace mode
4. Edit content directly in textarea
5. Press Ctrl/Cmd+S or click away to save
6. Click "Exit Trace" to return to view mode

### Content Strategy

1. **Initial State**: Only `content` field populated (AI-generated)
2. **Enable Tracing**: System auto-enables when content exists
3. **First Edit**: Admin enters trace mode, types content
4. **Save**: Content saved to `traced_content` column
5. **Public View**: Users see traced content over dimmed background

---

## Security Considerations

- **Authentication**: All trace saves require authenticated admin user
- **CSRF Protection**: API route wrapped with `withSecurity({ enableCSRF: true })`
- **Authorization**: Server-side check for `user.role === 'admin'`
- **Input Validation**: Content is sanitized through standard markdown rendering

---

## Design Decisions

### Why Full-Document Editing vs Anchor-Based

**Previous approach** (rejected): Anchor-based popups where users select text and edit specific positions.

**Current approach**: Full-document inline editing.

**Rationale**:
- User feedback: "tracing should be available anywhere... like an edit window that follows your edits *in-line*"
- Simpler mental model: Edit the whole document, not fragments
- Better UX: No popup management, direct inline editing
- Cleaner data model: Single string vs array of anchored fragments

### Why Dynamic Import with ssr: false

The `TracingContentViewer` uses DOM APIs for character mapping that aren't available during SSR. Dynamic import prevents hydration mismatches.

```typescript
const TracingContentViewer = dynamic(
  () => import('@/components/tracing/TracingContentViewer').then(mod => mod.TracingContentViewer),
  { ssr: false, loading: () => <LoadingSpinner /> }
);
```

### Why Background Content for All Users

The grayed-out background is visible to non-admins because:
1. Shows transparency about AI-generated content
2. Provides context even when human edits haven't happened yet
3. Visual indication that content is being curated

---

## Testing

### Manual Testing Checklist

- [ ] Non-admin sees background at 40% when no traced content
- [ ] Non-admin sees traced content at 100% with 15% background
- [ ] Admin can enter trace mode via footer button
- [ ] Status bar shows correctly in trace mode
- [ ] Ctrl/Cmd+S saves content
- [ ] Blur (clicking away) auto-saves
- [ ] "Unsaved changes" indicator appears when dirty
- [ ] "Saving..." indicator appears during save
- [ ] Exit trace mode returns to view
- [ ] TOC reflects traced content when available
- [ ] TOC falls back to background when no traced content

### API Testing

```bash
# Save traced content (requires admin auth)
curl -X PUT http://localhost:3000/api/projects/test-project/traces \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"content": "# Human Content\n\nThis is the traced layer."}'
```

---

## Future Enhancements

Potential improvements not yet implemented:

1. **Version History**: Track revisions of traced content
2. **Diff View**: Visual comparison of background vs traced
3. **Collaborative Editing**: Multiple admins editing simultaneously
4. **AI Suggestions**: Suggest edits based on background content
5. **Progress Tracking**: Percentage of content that's been traced

---

## Troubleshooting

### Common Issues

**Issue**: Tracing mode not appearing
- **Cause**: `tracingEnabled` is false or no `backgroundContent`
- **Fix**: Ensure project has content in the database

**Issue**: TOC not updating after trace
- **Cause**: May need page refresh
- **Fix**: `router.refresh()` is called on save, should auto-update

**Issue**: Save not working
- **Cause**: Not authenticated as admin
- **Fix**: Log in with admin account

**Issue**: Hydration mismatch errors
- **Cause**: SSR attempting to render client-only component
- **Fix**: Ensure dynamic import with `ssr: false`

---

## Related Documentation

- [WORKSPACE_ARCHITECTURE.md](./WORKSPACE_ARCHITECTURE.md) - Similar editing patterns
- [MARKDOWN_EDITOR_INTEGRATION.md](./MARKDOWN_EDITOR_INTEGRATION.md) - Markdown rendering
- [docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md) - API patterns
