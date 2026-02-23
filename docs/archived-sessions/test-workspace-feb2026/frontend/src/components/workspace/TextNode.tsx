'use client';

/**
 * Text Node Component
 *
 * Individual canvas node with rich text editing.
 * Supports drag, resize, and inline content editing.
 */

import { useRef, useState, useCallback, useEffect, useMemo, memo, lazy, Suspense } from 'react';
import { CanvasNode, getNodeType, isNodeLocked } from '@/lib/workspace/types';
import { calculateOptimalFontSize } from '@/lib/workspace/font-scaling';
// Lazy load RichTextEditor to reduce initial bundle size (~120 KB Tiptap)
// Only loaded when user enters edit mode
const RichTextEditor = lazy(() => import('./RichTextEditor'));
import MarkdownTextEditor from './MarkdownTextEditor';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import type { Editor } from '@tiptap/react';
import type { MarkdownEditorAPI } from '@/lib/workspace/markdown-utils';
import { isHtmlContent, isMarkdownModeEnabled } from '@/lib/workspace/markdown-utils';
import { logger } from '@/lib/utils/logger';
import { useWorkspaceStore } from '@/stores/workspace';

interface TextNodeProps {
  node: CanvasNode;
  isSelected: boolean;
  isDragging: boolean; // True when this node is being dragged
  scale: number;
  onUpdate: (updates: Partial<CanvasNode>) => void;
  onDelete: () => void;
  onSelect: (multi: boolean) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onEditorReady?: (
    nodeId: string,
    editor: Editor | MarkdownEditorAPI | null,
    position: { x: number; y: number } | null
  ) => void; // Pass editor instance and position to parent
  onTyping?: () => void; // Notify parent when user is typing (for real-time save indicator)
  onContextMenu?: (screenX: number, screenY: number) => void; // Notify parent when right-clicking node
  onSaveNode?: () => void; // Explicitly save node to database (called after resize)
}

function TextNode({
  node,
  isSelected,
  isDragging,
  scale,
  onUpdate,
  onDelete,
  onSelect,
  onDragStart,
  onEditorReady,
  onTyping,
  onContextMenu,
  onSaveNode,
}: TextNodeProps) {
  // Detect node type for conditional rendering
  const nodeType = getNodeType(node);
  const isNote = nodeType === 'note';
  const isPlainText = nodeType === 'text';

  // Use store for editing state (single source of truth)
  const editingNodeId = useWorkspaceStore(s => s.editingNodeId);
  const editingEditor = useWorkspaceStore(s => s.editingEditor);
  const enterEditMode = useWorkspaceStore(s => s.enterEditMode);
  const exitEditMode = useWorkspaceStore(s => s.exitEditMode);
  const isEditing = editingNodeId === node.id;

  // Local state for showing editor (controlled by isEditing from store)
  const [showEditor, setShowEditor] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [content, setContent] = useState(node.content.markdown || node.content.text || '');
  const [isResizing, setIsResizing] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{
    width: number;
    height: number;
    x: number;
    y: number;
    mouseX: number;
    mouseY: number;
    aspectRatio: number;
  } | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const DOUBLE_CLICK_THRESHOLD = 300; // ms - same as browser default

  // Refs for resize handler to avoid stale closures
  const nodeRef_current = useRef(node);
  const scaleRef = useRef(scale);
  const onUpdateRef = useRef(onUpdate);

  // Keep refs updated with latest values
  useEffect(() => {
    nodeRef_current.current = node;
    scaleRef.current = scale;
    onUpdateRef.current = onUpdate;
  }, [node, scale, onUpdate]);

  // Update local content when node changes
  useEffect(() => {
    setContent(node.content.markdown || node.content.text || '');
  }, [node.content.markdown, node.content.text]);

  // Note: showEditor is local state that controls when to render the editor component.
  // The store's editingNodeId is the source of truth for which node is being edited.
  // When the editor mounts, it calls enterEditMode() to update the store.
  // When exitEditMode() is called, handleEditorReady(null) is triggered which closes the editor.
  // No sync useEffect needed - this was causing a race condition where the editor would
  // close immediately after opening because enterEditMode() is called AFTER editor mounts.

  /**
   * Get effective font size - uses manual override if set, otherwise auto-calculates
   * Manual font size is stored in node.content.format.fontSize
   * When not set, text auto-scales to fit the container (Miro-style)
   */
  const effectiveFontSize = useMemo(() => {
    // Check for manually set font size from toolbar
    const manualFontSize = node.content?.format?.fontSize;
    if (manualFontSize !== undefined && manualFontSize > 0) {
      return manualFontSize;
    }

    // Auto-calculate optimal font size to fit text in container
    const autoFontSize = calculateOptimalFontSize(content, node.size.width, node.size.height, {
      minFontSize: 8,
      maxFontSize: 72,
      fontFamily: 'Arial, sans-serif',
      padding: isNote ? 12 : 8, // p-3 = 12px, p-2 = 8px
      lineHeight: 1.5,
      baseFontSize: 16, // Miro-style: prefer 16px, scale down only if needed
    });

    return autoFontSize;
  }, [content, node.size.width, node.size.height, isNote, node.content?.format?.fontSize]);

  // Alias for backward compatibility
  const calculatedFontSize = effectiveFontSize;

  /**
   * Handle editor ready - update store with editor instance
   * Supports both Tiptap Editor (HTML mode) and MarkdownEditorAPI (markdown mode)
   */
  const handleEditorReady = useCallback(
    (editor: Editor | MarkdownEditorAPI | null) => {
      if (!nodeRef.current) return;

      if (editor) {
        // Enter edit mode in store with editor instance
        enterEditMode(node.id, editor);

        // Calculate screen position for toolbar (center top of node)
        const rect = nodeRef.current.getBoundingClientRect();
        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top,
        };

        // Still notify parent for toolbar positioning (if needed)
        onEditorReady?.(node.id, editor, position);
      } else {
        // Editor destroyed - exit edit mode
        exitEditMode();
        onEditorReady?.(node.id, null, null);
      }
    },
    [node.id, enterEditMode, exitEditMode, onEditorReady]
  );

  /**
   * Handle double-click to enter edit mode (fallback - mouseDown handles this first)
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // Prevent editing if node is locked
      if (isNodeLocked(node)) {
        logger.info('[TextNode] Cannot edit locked node');
        return;
      }

      if (!isEditing && !isResizing) {
        logger.info('[TextNode] Fallback double-click handler triggered');
        setShowEditor(true);
      }
    },
    [isEditing, isResizing, node]
  );

  /**
   * Handle mouseDown - detect double-click first, then allow drag
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      logger.info('[TextNode] mouseDown:', {
        button: e.button,
        isEditing,
        isResizing,
        target: e.target,
        currentTarget: e.currentTarget,
      });

      // Priority 1: Already editing/resizing - prevent interference
      if (isEditing || isResizing) {
        // In edit/resize mode: stop propagation to prevent canvas drag
        e.stopPropagation();

        // Prevent middle-click paste on Linux/X11
        if (e.button === 1) {
          logger.info('[TextNode] Preventing middle-click in edit mode');
          e.preventDefault();
        }
        return;
      }

      // Priority 2: Detect double-click - enter edit mode immediately
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && e.button === 0) {
        // Prevent editing if node is locked
        if (isNodeLocked(node)) {
          logger.info('[TextNode] Cannot edit locked node (double-click blocked)');
          lastClickTimeRef.current = 0; // Reset to prevent false positives
          return;
        }

        logger.info('[TextNode] Double-click detected! Entering edit mode immediately.');
        e.stopPropagation(); // Prevent InputHandler from starting drag
        setShowEditor(true);
        lastClickTimeRef.current = 0; // Reset to prevent triple-click
        return;
      }

      // Update click timestamp
      lastClickTimeRef.current = now;

      // Priority 3: Not editing, not double-click - allow drag
      onDragStart(e);
    },
    [isEditing, isResizing, onDragStart, node]
  );

  /**
   * Handle blur - save content
   * Gets content directly from editor instance to avoid stale state issues
   */
  const handleBlur = useCallback(() => {
    // CRITICAL: Get content from editor BEFORE closing it
    // editingEditor is cleared by handleEditorReady(null), so we must read it first
    let currentContent = content; // Fallback to local state
    if (editingEditor) {
      // Check if it's a Tiptap editor (has getHTML method)
      if ('getHTML' in editingEditor && typeof editingEditor.getHTML === 'function') {
        currentContent = editingEditor.getHTML();
      }
      // Or a Markdown editor (has getValue method)
      else if ('getValue' in editingEditor && typeof editingEditor.getValue === 'function') {
        currentContent = (editingEditor.getValue as () => string)();
      }
    }

    // Now close the editor (clears editingEditor from store)
    setShowEditor(false);
    handleEditorReady(null); // Exit edit mode and clear editor

    // ALWAYS save content on blur - don't rely on comparison which can fail
    // due to HTML/text format differences or race conditions with useEffect
    // The debouncedSave will handle deduplication
    onUpdate({
      content: {
        ...node.content,
        text: currentContent, // Keep as fallback
        markdown: currentContent, // Store HTML/markdown
      },
    });

    // Note: Auto-resize happens in real-time during editing, no need to resize on blur
  }, [content, editingEditor, node.content, onUpdate, handleEditorReady]);

  /**
   * Handle click to select
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      logger.info('[TextNode] handleClick called for node:', node.id, {
        isEditing,
        multi: e.shiftKey || e.metaKey || e.ctrlKey,
      });
      e.stopPropagation();
      if (!isEditing) {
        onSelect(e.shiftKey || e.metaKey || e.ctrlKey);
      }
    },
    [isEditing, onSelect, node.id]
  );

  /**
   * Handle resize start (Miro-style: maintain aspect ratio for both text boxes and sticky notes)
   */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.stopPropagation(); // Prevent drag from triggering
      e.preventDefault();

      // Use ref to get current node value
      const currentNode = nodeRef_current.current;

      // Prevent resizing if node is locked
      if (isNodeLocked(currentNode)) {
        logger.info('[TextNode] Cannot resize locked node');
        return;
      }

      setIsResizing(true);
      const aspectRatio = currentNode.size.width / currentNode.size.height;

      resizeStartRef.current = {
        width: currentNode.size.width,
        height: currentNode.size.height,
        x: currentNode.position.x,
        y: currentNode.position.y,
        mouseX: e.clientX,
        mouseY: e.clientY,
        aspectRatio, // Store for aspect ratio locking
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeStartRef.current) return;

        // Use ref to get current scale
        const currentScale = scaleRef.current;
        const deltaX = (moveEvent.clientX - resizeStartRef.current.mouseX) / currentScale;
        const deltaY = (moveEvent.clientY - resizeStartRef.current.mouseY) / currentScale;

        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newX = resizeStartRef.current.x;
        let newY = resizeStartRef.current.y;

        // Miro-style: ALWAYS maintain aspect ratio for both text boxes and sticky notes
        const isCornerHandle =
          (direction.includes('n') || direction.includes('s')) &&
          (direction.includes('e') || direction.includes('w'));

        if (isCornerHandle) {
          // Corner handles: maintain aspect ratio
          // Use the larger dimension change to preserve aspect ratio accurately
          const newWidthAttempt = direction.includes('e')
            ? resizeStartRef.current.width + deltaX
            : direction.includes('w')
              ? resizeStartRef.current.width - deltaX
              : resizeStartRef.current.width;

          const newHeightAttempt = direction.includes('s')
            ? resizeStartRef.current.height + deltaY
            : direction.includes('n')
              ? resizeStartRef.current.height - deltaY
              : resizeStartRef.current.height;

          // Determine which dimension changed more (relative to original)
          const widthChange =
            Math.abs(newWidthAttempt - resizeStartRef.current.width) / resizeStartRef.current.width;
          const heightChange =
            Math.abs(newHeightAttempt - resizeStartRef.current.height) /
            resizeStartRef.current.height;

          if (widthChange > heightChange) {
            // Width changed more - set width, calculate height from aspect ratio
            newWidth = Math.max(60, newWidthAttempt);
            newHeight = newWidth / resizeStartRef.current.aspectRatio;
          } else {
            // Height changed more - set height, calculate width from aspect ratio
            newHeight = Math.max(30, newHeightAttempt);
            newWidth = newHeight * resizeStartRef.current.aspectRatio;
          }

          // Adjust position for nw/ne handles
          if (direction.includes('w')) {
            const actualWidthChange = newWidth - resizeStartRef.current.width;
            newX = resizeStartRef.current.x - actualWidthChange;
          }
          if (direction.includes('n')) {
            const actualHeightChange = newHeight - resizeStartRef.current.height;
            newY = resizeStartRef.current.y - actualHeightChange;
          }
        } else {
          // Edge handles: resize one dimension, maintain aspect ratio
          if (direction.includes('e') || direction.includes('w')) {
            // Horizontal edge: adjust width, calculate height
            newWidth = direction.includes('e')
              ? Math.max(60, resizeStartRef.current.width + deltaX)
              : Math.max(60, resizeStartRef.current.width - deltaX);
            newHeight = newWidth / resizeStartRef.current.aspectRatio;

            if (direction.includes('w')) {
              const actualWidthChange = newWidth - resizeStartRef.current.width;
              newX = resizeStartRef.current.x - actualWidthChange;
            }
          } else {
            // Vertical edge: adjust height, calculate width
            newHeight = direction.includes('s')
              ? Math.max(30, resizeStartRef.current.height + deltaY)
              : Math.max(30, resizeStartRef.current.height - deltaY);
            newWidth = newHeight * resizeStartRef.current.aspectRatio;

            if (direction.includes('n')) {
              const actualHeightChange = newHeight - resizeStartRef.current.height;
              newY = resizeStartRef.current.y - actualHeightChange;
            }
          }
        }

        // Update size and position using ref to get current callback
        onUpdateRef.current({
          position: { x: newX, y: newY },
          size: { width: newWidth, height: newHeight },
        });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // Explicitly save node after resize to persist size changes
        onSaveNode?.();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [] // No dependencies - use refs for all values
  );

  /**
   * Handle context menu (right-click) - show node-specific menu
   */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser default context menu
      e.stopPropagation(); // Prevent canvas context menu

      // Call parent callback with screen coordinates
      onContextMenu?.(e.clientX, e.clientY);
    },
    [onContextMenu]
  );

  /**
   * Keyboard shortcuts - ESC to exit edit mode
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        e.preventDefault();
        handleBlur(); // Save and exit edit mode
      }
    },
    [isEditing, handleBlur]
  );

  // Determine cursor based on state
  const getCursorClass = () => {
    if (isNodeLocked(node)) return 'cursor-not-allowed'; // Locked nodes cannot be interacted with
    if (isResizing) return 'cursor-nwse-resize';
    if (isEditing) return 'cursor-text'; // Text cursor during edit
    if (isDragging) return 'cursor-grabbing'; // Closed hand when dragging
    return 'cursor-grab'; // Open hand on hover
  };

  return (
    <div
      ref={nodeRef}
      data-node-id={node.id}
      role="article"
      aria-label={`${isNote ? 'Sticky note' : 'Text box'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`}
      className={`pointer-events-auto absolute flex ${isSelected ? 'ring-2 ring-blue-500' : ''} focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-neutral-900 ${getCursorClass()}`}
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        zIndex: node.z_index,
        transformOrigin: '0 0', // Match parent canvas layer's transform origin
        userSelect: isEditing ? 'text' : 'none', // Allow text selection in edit mode
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
    >
      {/* Miro-style: Simple colored rectangle (notes) or transparent (text) */}
      <div
        className={`h-full w-full ${
          isNote
            ? 'rounded-lg shadow-lg' // Notes: colored rectangle with shadow
            : '' // Text: transparent
        }`}
        style={{
          backgroundColor: isNote ? node.style?.backgroundColor || '#FEF08A' : 'transparent', // Default yellow for notes
          border: 'none',
          outline: 'none',
          overflow: 'hidden', // Prevent content from expanding beyond bounds
        }}
      >
        {showEditor ? (
          <div
            ref={editorRef}
            className="flex h-full w-full items-center [&_*]:border-none [&_*]:outline-none"
            style={{
              justifyContent: isNote ? 'center' : 'flex-start',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              overflow: 'hidden', // Prevent overflow
              maxHeight: '100%', // Enforce height constraint
            }}
          >
            <div
              className="flex h-full w-full items-center [&_*]:border-none [&_*]:outline-none"
              style={{
                justifyContent: isNote ? 'center' : 'flex-start',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                maxWidth: '100%', // Ensure it doesn't exceed parent width
                maxHeight: '100%', // Enforce height constraint
                overflow: 'hidden', // Clip vertical overflow
              }}
            >
              {isMarkdownModeEnabled() && !isHtmlContent(content) ? (
                <MarkdownTextEditor
                  content={content}
                  onChange={newContent => {
                    setContent(newContent);
                    onTyping?.(); // Notify parent for real-time save indicator
                  }}
                  onBlur={handleBlur}
                  onEditorReady={handleEditorReady}
                  fontSize={calculatedFontSize}
                  textAlign={isNote ? 'center' : 'left'}
                  minimal={!isNote} // Minimal styling for text boxes
                  isNote={isNote}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                      Loading editor...
                    </div>
                  }
                >
                  <RichTextEditor
                    content={content}
                    onChange={newContent => {
                      setContent(newContent);
                      onTyping?.(); // Notify parent for real-time save indicator
                    }}
                    onBlur={handleBlur}
                    onEditorReady={handleEditorReady}
                    fontSize={calculatedFontSize}
                    textAlign={isNote ? 'center' : 'left'}
                    minimal={!isNote} // Minimal styling for text boxes
                    isNote={isNote}
                  />
                </Suspense>
              )}
            </div>
          </div>
        ) : (
          <>
            {isHtmlContent(content) ? (
              // HTML MODE: Render HTML content (Tiptap output or legacy)
              <>
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                  .workspace-display {
                    font-family: Arial, sans-serif;
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                    white-space: normal !important;
                  }
                  .workspace-display * {
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                    white-space: normal !important;
                    max-width: 100% !important;
                  }
                  .workspace-display strong {
                    font-weight: 900 !important;
                  }
                  .workspace-display s {
                    text-decoration: line-through !important;
                    text-decoration-thickness: 2px !important;
                    text-decoration-skip-ink: none !important;
                  }
                  .workspace-display u {
                    text-decoration: underline !important;
                    text-decoration-thickness: 1.5px !important;
                  }
                  .workspace-display p {
                    margin: 0 !important; /* Remove default paragraph margins */
                    line-height: 1.5; /* Consistent line spacing */
                    min-height: 1.5em; /* Ensure empty paragraphs take up space */
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                    white-space: normal !important;
                  }
                  .workspace-display p:empty::before {
                    content: "\\200B"; /* Zero-width space to prevent collapse */
                  }
                `,
                  }}
                />
                <div
                  ref={contentRef}
                  className={`workspace-display w-full ${
                    isNote
                      ? 'prose prose-neutral prose-invert h-full max-w-none p-3 text-neutral-200' // Notes: full height with background
                      : 'h-full p-2 text-neutral-200 [&_p]:m-0 [&_p]:leading-tight' // Text: full height to center content
                  }`}
                  style={{
                    fontSize: `${calculatedFontSize}px`,
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'center', // Vertically center text in container
                    justifyContent: isNote ? 'center' : 'flex-start', // Notes: centered, Text boxes: left-aligned
                    textAlign: isNote ? 'center' : 'left', // Text alignment within paragraphs
                    wordWrap: 'break-word', // Force word wrapping
                    overflowWrap: 'break-word', // Break long words
                    whiteSpace: 'normal', // Allow normal wrapping
                    maxWidth: '100%', // Prevent horizontal overflow
                    overflow: 'hidden', // Clip any overflow
                    pointerEvents: 'none', // CRITICAL FIX: Let clicks pass through to container's handleMouseDown
                  }}
                  dangerouslySetInnerHTML={{
                    __html:
                      content &&
                      content.trim() &&
                      content !== '<p></p>' &&
                      content !== '<p><br></p>'
                        ? content
                        : isNote
                          ? '' // Notes: no placeholder text, just cursor
                          : `<p style="font-size: ${calculatedFontSize}px; margin: 0;">Type here</p>`, // Text boxes: scaled placeholder
                  }}
                />
              </>
            ) : (
              // MARKDOWN MODE: Render markdown content
              <div
                ref={contentRef}
                className={`w-full ${
                  isNote
                    ? 'prose prose-neutral prose-invert h-full max-w-none p-3 text-neutral-200'
                    : 'h-full p-2 text-neutral-200'
                }`}
                style={{
                  fontSize: `${calculatedFontSize}px`,
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isNote ? 'center' : 'flex-start',
                  textAlign: isNote ? 'center' : 'left',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'normal',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
              >
                {content && content.trim() ? (
                  <HybridMarkdownRenderer content={content} />
                ) : (
                  <span className="italic text-neutral-500">{isNote ? '' : 'Type here'}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lock Icon - Shows when node is locked */}
      {isNodeLocked(node) && (
        <div
          data-testid="lock-icon"
          className="absolute right-1 top-1 flex items-center justify-center rounded border border-neutral-600 bg-neutral-800/90 px-1.5 py-0.5"
          style={{ pointerEvents: 'none' }}
          title="This node is locked"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3 w-3 text-yellow-400"
          >
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Resize Handles - Miro-style: both text boxes and sticky notes maintain aspect ratio */}
      {(isSelected || isHovered) && !isEditing && !isNodeLocked(node) && (
        <>
          {/* Corner handles - Less pronounced, semi-transparent */}
          <div
            data-resize-handle="se"
            className="absolute h-1.5 w-1.5 cursor-nwse-resize rounded-sm border border-white/70 bg-blue-500/70 transition-all hover:scale-125 hover:bg-blue-600"
            style={{ right: -3, bottom: -3 }}
            onMouseDown={e => handleResizeStart(e, 'se')}
          />
          <div
            data-resize-handle="sw"
            className="absolute h-1.5 w-1.5 cursor-nesw-resize rounded-sm border border-white/70 bg-blue-500/70 transition-all hover:scale-125 hover:bg-blue-600"
            style={{ left: -3, bottom: -3 }}
            onMouseDown={e => handleResizeStart(e, 'sw')}
          />
          <div
            data-resize-handle="ne"
            className="absolute h-1.5 w-1.5 cursor-nesw-resize rounded-sm border border-white/70 bg-blue-500/70 transition-all hover:scale-125 hover:bg-blue-600"
            style={{ right: -3, top: -3 }}
            onMouseDown={e => handleResizeStart(e, 'ne')}
          />
          <div
            data-resize-handle="nw"
            className="absolute h-1.5 w-1.5 cursor-nwse-resize rounded-sm border border-white/70 bg-blue-500/70 transition-all hover:scale-125 hover:bg-blue-600"
            style={{ left: -3, top: -3 }}
            onMouseDown={e => handleResizeStart(e, 'nw')}
          />
        </>
      )}
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when relevant node properties or interaction state changes
 */
function arePropsEqual(prevProps: TextNodeProps, nextProps: TextNodeProps): boolean {
  // Compare primitive interaction states
  if (
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.isDragging !== nextProps.isDragging ||
    prevProps.scale !== nextProps.scale
  ) {
    return false;
  }

  // Compare node properties that affect rendering
  const prevNode = prevProps.node;
  const nextNode = nextProps.node;

  if (
    prevNode.id !== nextNode.id ||
    prevNode.z_index !== nextNode.z_index ||
    prevNode.metadata?.locked !== nextNode.metadata?.locked
  ) {
    return false;
  }

  // Compare position
  if (prevNode.position.x !== nextNode.position.x || prevNode.position.y !== nextNode.position.y) {
    return false;
  }

  // Compare size
  if (
    prevNode.size.width !== nextNode.size.width ||
    prevNode.size.height !== nextNode.size.height
  ) {
    return false;
  }

  // Compare content (both text and markdown)
  if (
    prevNode.content.text !== nextNode.content.text ||
    prevNode.content.markdown !== nextNode.content.markdown
  ) {
    return false;
  }

  // Compare style (backgroundColor is the main property that affects rendering)
  if (prevNode.style?.backgroundColor !== nextNode.style?.backgroundColor) {
    return false;
  }

  // Compare manual font size override (if set)
  if (prevNode.content?.format?.fontSize !== nextNode.content?.format?.fontSize) {
    return false;
  }

  // All relevant properties are equal - skip re-render
  return true;
}

/**
 * Memoized export - prevents unnecessary re-renders when node props haven't changed
 * This is critical for performance with many nodes on the canvas
 */
export default memo(TextNode, arePropsEqual);
