/**
 * Workspace Module Types
 *
 * Type definitions for infinite canvas workspace feature.
 * Each project has its own workspace for visual note-taking.
 */

import { WorkspaceId, NodeId, ConnectionId, ViewportStateId } from './branded-types';
import { UserId } from '@/types/branded';

// ============================================================================
// Geometric Types - Canvas positioning and sizing
// ============================================================================

/**
 * 2D point on infinite canvas
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size dimensions
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Bounding box for spatial queries
 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Viewport transform (pan and zoom)
 */
export interface ViewportTransform {
  /** Pan offset X */
  offsetX: number;
  /** Pan offset Y */
  offsetY: number;
  /** Zoom level (1.0 = 100%, 0.5 = 50%, 2.0 = 200%) */
  scale: number;
}

// ============================================================================
// Node Types - Text boxes on canvas
// ============================================================================

/**
 * Text formatting options
 */
export interface TextFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Node content with formatting
 * Note: text is optional to support legacy nodes that may only have markdown
 */
export interface NodeContent {
  /** Node title */
  title?: string;
  /** Plain text content (optional - legacy nodes may only have markdown) */
  text?: string;
  /** Markdown-formatted text (optional) */
  markdown?: string;
  /** Text formatting metadata */
  format?: TextFormat;
}

/**
 * Node appearance styling
 */
export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  shadow?: boolean;
}

/**
 * Node type discriminator for rendering behavior
 */
export type NodeType = 'note' | 'text';

/**
 * Helper to get node type from metadata or content
 * Provides backward compatibility by inferring type from title presence
 */
export function getNodeType(node: CanvasNode): NodeType {
  // Explicit metadata type
  if (node.metadata?.nodeType) {
    return node.metadata.nodeType as NodeType;
  }

  // Backward compatibility: infer from title presence
  // Notes have titles, plain text does not
  return node.content.title ? 'note' : 'text';
}

/**
 * Check if a node is locked
 * Locked nodes cannot be moved, resized, edited, or deleted
 * @param node - The canvas node to check
 * @returns true if the node is locked, false otherwise
 */
export function isNodeLocked(node: CanvasNode): boolean {
  return node.metadata?.locked === true;
}

/**
 * Count locked nodes in an array
 * @param nodes - Array of nodes to check
 * @returns Number of locked nodes
 */
export function hasLockedNodes(nodes: CanvasNode[]): number {
  return nodes.filter(isNodeLocked).length;
}

/**
 * Filter out locked nodes from an array
 * Useful for operations that should skip locked nodes
 * @param nodes - Array of nodes to filter
 * @returns Array of unlocked nodes only
 */
export function getUnlockedNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.filter(node => !isNodeLocked(node));
}

/**
 * Filter to get only locked nodes from an array
 * @param nodes - Array of nodes to filter
 * @returns Array of locked nodes only
 */
export function getLockedNodes(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.filter(isNodeLocked);
}

/**
 * Canvas node entity
 */
export interface CanvasNode {
  id: NodeId;
  workspace_id: WorkspaceId;

  /** Position on canvas */
  position: Point;

  /** Node dimensions */
  size: Size;

  /** Text content and formatting */
  content: NodeContent;

  /** Visual styling */
  style?: NodeStyle;

  /** Z-index for layering */
  z_index: number;

  /** Metadata for future features */
  metadata?: Record<string, any>;

  /** Creator */
  created_by: UserId;
  created_at: string;

  /** Last editor */
  updated_by?: UserId;
  updated_at: string;
}

// ============================================================================
// Connection Types - Lines between nodes
// ============================================================================

/**
 * Connection anchor point (which side of node)
 */
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left' | 'center';

/**
 * Connection anchor with offset along edge
 * offset = 0.0 (start of side) to 1.0 (end of side)
 * center anchor ignores offset
 */
export interface ConnectionAnchor {
  side: AnchorSide;
  offset: number; // 0.0 to 1.0
}

/**
 * Connection arrow styling
 */
export interface ConnectionStyle {
  /** Arrow line color */
  color?: string;
  /** Arrow line width (px) */
  width?: number;
  /** Dash pattern [dash, gap, dash, gap, ...] */
  dashArray?: number[];
  /** Arrow head type */
  arrowType?: 'none' | 'arrow' | 'circle' | 'diamond';
  /** Arrow opacity */
  opacity?: number;
}

/**
 * Connection entity (arrow between two nodes)
 */
export interface Connection {
  id: ConnectionId;
  workspace_id: WorkspaceId;

  /** Source node and anchor */
  source_node_id: NodeId;
  source_anchor: ConnectionAnchor;

  /** Target node and anchor */
  target_node_id: NodeId;
  target_anchor: ConnectionAnchor;

  /** Optional label on arrow */
  label?: string;

  /** Arrow styling */
  style?: ConnectionStyle;

  /** Z-index for layering (rendered below nodes by default) */
  z_index: number;

  /** Metadata for future features */
  metadata?: Record<string, any>;

  /** Creator */
  created_by: UserId;
  created_at: string;

  /** Last editor */
  updated_by?: UserId;
  updated_at: string;
}

// ============================================================================
// Viewport State - User's current view
// ============================================================================

/**
 * User viewport state (pan/zoom position)
 */
export interface ViewportState {
  id: ViewportStateId;
  workspace_id: WorkspaceId;
  user_id: UserId;

  /** Current viewport transform */
  transform: ViewportTransform;

  /** Last updated timestamp */
  updated_at: string;
}

// ============================================================================
// Workspace Entity
// ============================================================================

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  /** Grid size (null = no grid) */
  gridSize?: number;
  /** Snap to grid */
  snapToGrid?: boolean;
  /** Background color */
  backgroundColor?: string;
  /** Show minimap */
  showMinimap?: boolean;
  /** Enable real-time collaboration */
  enableCollaboration?: boolean;
}

/**
 * Workspace entity (one per project)
 */
export interface Workspace {
  id: WorkspaceId; // Same as project_slug
  project_slug: string;

  /** Workspace settings */
  settings: WorkspaceSettings;

  /** Creator */
  created_by: UserId;
  created_at: string;

  /** Last editor */
  updated_by?: UserId;
  updated_at: string;
}

// ============================================================================
// DTOs - Data Transfer Objects
// ============================================================================

/**
 * Create workspace data
 */
export interface CreateWorkspaceData {
  project_slug: string;
  settings?: WorkspaceSettings;
}

/**
 * Update workspace data
 */
export interface UpdateWorkspaceData {
  settings?: WorkspaceSettings;
}

/**
 * Create node data
 */
export interface CreateNodeData {
  workspace_id: WorkspaceId;
  position: Point;
  size: Size;
  content: NodeContent;
  style?: NodeStyle;
  metadata?: Record<string, any>; // PHASE 2: Added for persistence
  z_index?: number;
}

/**
 * Update node data
 */
export interface UpdateNodeData {
  position?: Point;
  size?: Size;
  content?: NodeContent;
  style?: NodeStyle;
  metadata?: Record<string, any>; // PHASE 2: Added for persistence
  z_index?: number;
}

/**
 * Update viewport state data
 */
export interface UpdateViewportData {
  transform: ViewportTransform;
}

/**
 * Create connection data
 */
export interface CreateConnectionData {
  workspace_id: WorkspaceId;
  source_node_id: NodeId;
  source_anchor: ConnectionAnchor;
  target_node_id: NodeId;
  target_anchor: ConnectionAnchor;
  label?: string;
  style?: ConnectionStyle;
  z_index?: number;
}

/**
 * Update connection data
 */
export interface UpdateConnectionData {
  source_anchor?: ConnectionAnchor;
  target_anchor?: ConnectionAnchor;
  label?: string;
  style?: ConnectionStyle;
  z_index?: number;
}

// ============================================================================
// Composite Types
// ============================================================================

/**
 * Workspace with all content
 */
export interface WorkspaceWithContent {
  workspace: Workspace;
  nodes: CanvasNode[];
  connections: Connection[];
  viewportState?: ViewportState;
}

/**
 * Spatial query options
 */
export interface SpatialQueryOptions {
  bounds: Bounds;
  limit?: number;
}

/**
 * Batch operations
 */
export interface BatchNodeUpdate {
  nodeId: NodeId;
  updates: UpdateNodeData;
}

// ============================================================================
// Real-time Collaboration Types (for future)
// ============================================================================

/**
 * Presence cursor (for real-time collaboration)
 */
export interface PresenceCursor {
  user_id: UserId;
  username: string;
  position: Point;
  color: string;
  updated_at: string;
}

/**
 * Workspace operation types (for CRDT/OT)
 */
export type WorkspaceOperation =
  | { type: 'node.create'; data: CreateNodeData }
  | { type: 'node.update'; nodeId: NodeId; data: UpdateNodeData }
  | { type: 'node.delete'; nodeId: NodeId };

// ============================================================================
// Service Error Types
// ============================================================================

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'WORKSPACE_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class NodeNotFoundError extends WorkspaceError {
  constructor(nodeId: NodeId) {
    super(`Node ${nodeId} not found`, 'NODE_NOT_FOUND', { nodeId });
    this.name = 'NodeNotFoundError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(workspaceId: WorkspaceId) {
    super(`Workspace ${workspaceId} not found`, 'WORKSPACE_NOT_FOUND', { workspaceId });
    this.name = 'WorkspaceNotFoundError';
  }
}

export class InvalidConnectionError extends WorkspaceError {
  constructor(reason: string) {
    super(`Invalid connection: ${reason}`, 'INVALID_CONNECTION', { reason });
    this.name = 'InvalidConnectionError';
  }
}

export class ConnectionNotFoundError extends WorkspaceError {
  constructor(connectionId: ConnectionId) {
    super(`Connection ${connectionId} not found`, 'CONNECTION_NOT_FOUND', { connectionId });
    this.name = 'ConnectionNotFoundError';
  }
}

// ============================================================================
// Mouse Input Types
// ============================================================================

/**
 * Mouse button branded type for type-safe button discrimination
 */
export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2,
}

/**
 * Type guard for MouseButton
 */
export function isMouseButton(value: number): value is MouseButton {
  return value === MouseButton.Left || value === MouseButton.Middle || value === MouseButton.Right;
}

/**
 * Get mouse button from event
 */
export function getMouseButton(event: MouseEvent | React.MouseEvent): MouseButton {
  if (!isMouseButton(event.button)) {
    throw new Error(`Invalid mouse button: ${event.button}`);
  }
  return event.button;
}

// ============================================================================
// Context Menu Types
// ============================================================================

/**
 * Context menu item action types
 */
export type ContextMenuActionType =
  | 'create-note'
  | 'delete'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'bring-to-front'
  | 'send-to-back'
  | 'group'
  | 'ungroup'
  | 'lock'
  | 'unlock'
  | 'custom';

/**
 * Context menu item definition
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: ContextMenuActionType;
  handler?: (context: ContextMenuContext) => void | Promise<void>;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  submenu?: ContextMenuItem[];
}

/**
 * Context menu context - what was clicked
 */
export interface ContextMenuContext {
  selectedNodes: NodeId[];
  selectedConnections: ConnectionId[];
  canvasPosition: Point;
  screenPosition: Point;
  targetNode?: NodeId;
  targetConnection?: ConnectionId;
}

/**
 * Context menu position and state
 */
export interface ContextMenuState {
  visible: boolean;
  position: Point;
  items: ContextMenuItem[];
  context: ContextMenuContext | null;
}

// ============================================================================
// Cursor and Interaction States
// ============================================================================

/**
 * Pan mode types
 */
export enum PanMode {
  SpaceDrag = 'space-drag',
  MiddleMouseDrag = 'mmb-drag',
  None = 'none',
}

/**
 * Cursor state types
 */
export enum CursorState {
  Default = 'default',
  Grab = 'grab',
  Grabbing = 'grabbing',
  Text = 'text',
  Crosshair = 'crosshair',
  ContextMenu = 'context-menu',
  Resize = 'resize',
  ResizeNS = 'ns-resize',
  ResizeEW = 'ew-resize',
  ResizeNWSE = 'nwse-resize',
  ResizeNESW = 'nesw-resize',
  NotAllowed = 'not-allowed',
}

/**
 * Get CSS cursor class for cursor state
 */
export function getCursorClass(state: CursorState): string {
  const cursorMap: Record<CursorState, string> = {
    [CursorState.Default]: 'cursor-default',
    [CursorState.Grab]: 'cursor-grab',
    [CursorState.Grabbing]: 'cursor-grabbing',
    [CursorState.Text]: 'cursor-text',
    [CursorState.Crosshair]: 'cursor-crosshair',
    [CursorState.ContextMenu]: 'cursor-context-menu',
    [CursorState.Resize]: 'cursor-resize',
    [CursorState.ResizeNS]: 'cursor-ns-resize',
    [CursorState.ResizeEW]: 'cursor-ew-resize',
    [CursorState.ResizeNWSE]: 'cursor-nwse-resize',
    [CursorState.ResizeNESW]: 'cursor-nesw-resize',
    [CursorState.NotAllowed]: 'cursor-not-allowed',
  };
  return cursorMap[state];
}

/**
 * Interaction mode state
 */
export interface InteractionState {
  panMode: PanMode;
  cursorState: CursorState;
  isSpacePressed: boolean;
  isShiftPressed: boolean;
  isCtrlPressed: boolean;
  isAltPressed: boolean;
}

// ============================================================================
// Text Editor State Types
// ============================================================================

/**
 * Text selection range in editor
 */
export interface TextSelection {
  start: number;
  end: number;
  direction?: 'forward' | 'backward' | 'none';
}

/**
 * Active formatting state (what's currently applied at cursor)
 */
export interface ActiveFormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  fontSize: number;
  fontFamily: string;
  color: string;
  alignment: 'left' | 'center' | 'right' | 'justify';
}

/**
 * Text editor state (for inline editing)
 */
export interface TextEditorState {
  nodeId: NodeId | null;
  isEditing: boolean;
  selection: TextSelection | null;
  activeFormat: ActiveFormattingState;
  content: string;
  isDirty: boolean;
}

/**
 * Formatting action types
 */
export type FormattingAction =
  | { type: 'toggle-bold' }
  | { type: 'toggle-italic' }
  | { type: 'toggle-underline' }
  | { type: 'toggle-strikethrough' }
  | { type: 'set-font-size'; size: number }
  | { type: 'set-font-family'; family: string }
  | { type: 'set-color'; color: string }
  | { type: 'set-alignment'; alignment: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'clear-formatting' };

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if content has markdown
 */
export function hasMarkdownContent(
  content: NodeContent
): content is NodeContent & { markdown: string } {
  return typeof content.markdown === 'string' && content.markdown.length > 0;
}

/**
 * Type guard to check if content has formatting
 */
export function hasFormattedContent(
  content: NodeContent
): content is NodeContent & { format: TextFormat } {
  return content.format !== undefined && Object.keys(content.format).length > 0;
}

/**
 * Get renderable content from node (markdown > text > empty string)
 */
export function getRenderableContent(content: NodeContent): string {
  return content.markdown || content.text || '';
}
