/**
 * Content Tracing System Types
 *
 * The tracing system enables gradual replacement of AI-generated content
 * with human-written content. AI content becomes a "background" layer
 * and human writing is overlaid at character-level positions.
 */

/**
 * Anchor types for positioning traced content
 */
export type AnchorType = 'character' | 'freeform';

/**
 * Status of a traced content piece
 */
export type TraceStatus = 'draft' | 'published' | 'archived';

/**
 * Position anchor for traced content
 */
export interface TracedContentAnchor {
  /** How the trace is positioned */
  type: AnchorType;
  /** Character offset start in background content (for character anchors) */
  startOffset: number | null;
  /** Character offset end in background content (for character anchors) */
  endOffset: number | null;
  /** Cached original text being traced */
  anchorText: string | null;
  /** X position as percentage 0-100 (for freeform anchors) */
  freeformX: number | null;
  /** Y position as percentage 0-100 (for freeform anchors) */
  freeformY: number | null;
}

/**
 * A piece of traced (human-written) content
 */
export interface TracedContent {
  id: number;
  projectSlug: string;
  anchor: TracedContentAnchor;
  /** The human-written markdown content */
  tracedContent: string;
  authorId: number | null;
  authorName: string;
  status: TraceStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Traced content as returned from database
 */
export interface TracedContentRow {
  id: number;
  project_slug: string;
  anchor_type: AnchorType;
  anchor_start_offset: number | null;
  anchor_end_offset: number | null;
  anchor_text: string | null;
  freeform_x: number | null;
  freeform_y: number | null;
  traced_content: string;
  author_id: number | null;
  author_name: string;
  status: TraceStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to TracedContent
 */
export function rowToTracedContent(row: TracedContentRow): TracedContent {
  return {
    id: row.id,
    projectSlug: row.project_slug,
    anchor: {
      type: row.anchor_type,
      startOffset: row.anchor_start_offset,
      endOffset: row.anchor_end_offset,
      anchorText: row.anchor_text,
      freeformX: row.freeform_x,
      freeformY: row.freeform_y,
    },
    tracedContent: row.traced_content,
    authorId: row.author_id,
    authorName: row.author_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * State for the tracing editor
 */
export interface TracingState {
  /** Whether tracing mode is active */
  isTracingMode: boolean;
  /** Currently selected text range (for creating new traces) */
  selectedRange: { start: number; end: number; text: string } | null;
  /** Currently hovered trace */
  hoveredTraceId: number | null;
  /** Currently editing trace */
  activeTraceId: number | null;
  /** Pending unsaved traces */
  pendingTraces: TracedContent[];
}

/**
 * Project with tracing data
 */
export interface ProjectWithTracing {
  /** Basic project data */
  id: number;
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string;
  color: string;
  /** Whether tracing is enabled for this project */
  tracingEnabled: boolean;
  /** AI-generated background content (admin only) */
  backgroundContent: string | null;
  /** Human-written traced content pieces */
  tracedContents: TracedContent[];
}

/**
 * Character position in the DOM
 */
export interface CharacterPosition {
  /** Global character offset */
  offset: number;
  /** Bounding rectangle of this character */
  rect: DOMRect;
  /** Text node containing this character */
  node: Text;
  /** Offset within the text node */
  nodeOffset: number;
}

/**
 * Request body for creating a new trace
 */
export interface CreateTraceRequest {
  anchorType: AnchorType;
  anchorStartOffset?: number;
  anchorEndOffset?: number;
  anchorText?: string;
  freeformX?: number;
  freeformY?: number;
  tracedContent: string;
  status?: TraceStatus;
}

/**
 * Request body for updating a trace
 */
export interface UpdateTraceRequest {
  tracedContent?: string;
  status?: TraceStatus;
  freeformX?: number;
  freeformY?: number;
}
