'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLibraryEditor } from '@/hooks/useLibraryEditor';
import { logger } from '@/lib/utils/logger';

interface TextEdit {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  status: 'needs-edit' | 'comparing' | 'verified' | 'amended';
  note?: string;
  timestamp: number;
}

interface LibraryAnnotationOverlayProps {
  pageSlug?: string;
  contentRef?: React.RefObject<HTMLElement>;
  documentId?: number;
  onClose?: () => void;
}

export default function LibraryAnnotationOverlay({
  pageSlug = '',
  contentRef,
  documentId,
  onClose,
}: LibraryAnnotationOverlayProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [highlightElements, setHighlightElements] = useState<HTMLElement[]>([]);
  const { edits, saveEdits } = useLibraryEditor(pageSlug);

  // Handle text selection with improved precision
  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelectedText('');
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();

    if (text && contentRef?.current?.contains(range.commonAncestorContainer)) {
      // Get the actual selected text including formatting context
      const selectedText = range.toString();

      // Create a more precise text walker to calculate exact positions
      if (contentRef?.current) {
        const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);

        let textOffset = 0;
        let startOffset = -1;
        let endOffset = -1;
        let currentNode: Text | null;

        // Find the exact start and end positions
        while ((currentNode = walker.nextNode() as Text)) {
          const nodeLength = currentNode.textContent?.length || 0;

          // Check if this node contains the start of our selection
          if (startOffset === -1 && currentNode === range.startContainer) {
            startOffset = textOffset + range.startOffset;
          }

          // Check if this node contains the end of our selection
          if (currentNode === range.endContainer) {
            endOffset = textOffset + range.endOffset;
            break;
          }

          textOffset += nodeLength;
        }

        // Fallback to original method if precise calculation failed
        if ((startOffset === -1 || endOffset === -1) && contentRef?.current) {
          const contentText = contentRef.current.textContent || '';
          const beforeRange = document.createRange();
          beforeRange.selectNodeContents(contentRef.current);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          startOffset = beforeRange.toString().length;
          endOffset = startOffset + text.length;
        }

        setSelectedText(selectedText);
        setSelection({ start: startOffset, end: endOffset });
      }
    } else {
      setSelectedText('');
      setSelection(null);
    }
  }, [contentRef]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selection) return;

      // Ctrl/Cmd + R: Mark as needs edit (red)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        addEdit('needs-edit');
      }
      // Ctrl/Cmd + Y: Mark as comparing (yellow)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        addEdit('comparing');
      }
      // Ctrl/Cmd + G: Mark as verified (green)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        addEdit('verified');
      }
      // Ctrl/Cmd + B: Mark as amended (blue)
      else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        addEdit('amended');
      }
      // Ctrl/Cmd + D: Remove edit at selection
      else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        removeEditAtSelection();
      }
      // Ctrl/Cmd + Q: Clear all edits
      else if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
        e.preventDefault();
        if (confirm('Clear ALL annotations on this page?')) {
          saveEdits([]);
          logger.info('🗑️ All annotations cleared');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectionchange', handleSelection);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [selection, handleSelection]);

  const addEdit = (status: TextEdit['status']) => {
    if (!selection || !selectedText) return;

    const newEdit: TextEdit = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      text: selectedText,
      startOffset: selection.start,
      endOffset: selection.end,
      status,
      timestamp: Date.now(),
    };

    // Remove any overlapping edits
    const filteredEdits = edits.filter(
      edit => !(edit.startOffset < selection.end && edit.endOffset > selection.start)
    );

    saveEdits([...filteredEdits, newEdit].sort((a, b) => a.startOffset - b.startOffset));

    // Clear selection
    window.getSelection()?.removeAllRanges();
    setSelectedText('');
    setSelection(null);
  };

  const removeEditAtSelection = () => {
    if (!selection) return;

    const editToRemove = edits.find(
      edit => edit.startOffset <= selection.start && edit.endOffset >= selection.end
    );

    if (editToRemove) {
      saveEdits(edits.filter(edit => edit.id !== editToRemove.id));
    }
  };

  const getStatusColor = (status: TextEdit['status']) => {
    switch (status) {
      case 'needs-edit':
        return 'rgba(255, 0, 0, 0.25)'; // bright red, readable opacity
      case 'comparing':
        return 'rgba(255, 255, 0, 0.25)'; // bright yellow, readable opacity
      case 'verified':
        return 'rgba(0, 255, 0, 0.25)'; // bright green, readable opacity
      case 'amended':
        return 'rgba(0, 150, 255, 0.25)'; // bright blue, readable opacity
      default:
        return 'rgba(128, 128, 128, 0.25)'; // gray, readable opacity
    }
  };

  const getStatusBorderColor = (status: TextEdit['status']) => {
    switch (status) {
      case 'needs-edit':
        return '#ff0000'; // bright red
      case 'comparing':
        return '#ffff00'; // bright yellow
      case 'verified':
        return '#00ff00'; // bright green
      case 'amended':
        return '#0096ff'; // bright blue
      default:
        return '#808080'; // gray
    }
  };

  // Create highlight overlays for all edits
  useEffect(() => {
    if (!contentRef?.current || edits.length === 0) {
      // Clean up existing highlights
      highlightElements.forEach(el => el.remove());
      setHighlightElements([]);
      return;
    }

    // Clean up existing highlights
    highlightElements.forEach(el => el.remove());

    const newHighlightElements: HTMLElement[] = [];
    const contentElement = contentRef.current!;
    const walker = document.createTreeWalker(contentElement, NodeFilter.SHOW_TEXT, null);

    let textOffset = 0;
    const textNodes: { node: Text; offset: number; length: number }[] = [];

    // Collect all text nodes with their offsets
    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      textNodes.push({
        node,
        offset: textOffset,
        length: node.textContent?.length || 0,
      });
      textOffset += node.textContent?.length || 0;
    }

    // Create highlights for each edit with improved precision
    edits.forEach(edit => {
      try {
        // Find the text nodes that contain this edit - be more flexible with boundaries
        const startNode = textNodes.find(
          tn => edit.startOffset >= tn.offset && edit.startOffset <= tn.offset + tn.length
        );
        const endNode = textNodes.find(
          tn => edit.endOffset >= tn.offset && edit.endOffset <= tn.offset + tn.length
        );

        if (!startNode && !endNode) return;

        // Handle cases where we have partial matches
        const actualStartNode = startNode || textNodes.find(tn => tn.offset <= edit.startOffset);
        const actualEndNode =
          endNode || textNodes.find(tn => tn.offset + tn.length >= edit.endOffset);

        if (!actualStartNode || !actualEndNode) return;

        const range = document.createRange();

        if (actualStartNode === actualEndNode) {
          // Single text node
          const startOffsetInNode = Math.max(0, edit.startOffset - actualStartNode.offset);
          const endOffsetInNode = Math.min(
            actualStartNode.length,
            edit.endOffset - actualStartNode.offset
          );
          range.setStart(actualStartNode.node, startOffsetInNode);
          range.setEnd(actualStartNode.node, endOffsetInNode);
        } else {
          // Multiple text nodes
          const startOffsetInNode = Math.max(0, edit.startOffset - actualStartNode.offset);
          const endOffsetInNode = Math.min(
            actualEndNode.length,
            edit.endOffset - actualEndNode.offset
          );
          range.setStart(actualStartNode.node, startOffsetInNode);
          range.setEnd(actualEndNode.node, endOffsetInNode);
        }

        // Get the bounding rectangles with better error handling
        const rects = range.getClientRects();
        if (rects.length === 0) return;

        const containerRect = contentElement.getBoundingClientRect();

        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (!rect) continue;

          // Skip very small rectangles that might be artifacts
          if (rect.width < 1 || rect.height < 1) continue;

          const highlightDiv = document.createElement('div');

          highlightDiv.style.position = 'absolute';
          highlightDiv.style.left = `${rect.left - containerRect.left + contentElement.scrollLeft}px`;
          highlightDiv.style.top = `${rect.top - containerRect.top + contentElement.scrollTop}px`;
          highlightDiv.style.width = `${rect.width}px`;
          highlightDiv.style.height = `${rect.height}px`;
          highlightDiv.style.backgroundColor = getStatusColor(edit.status);
          highlightDiv.style.border = `1px solid ${getStatusBorderColor(edit.status)}`;
          highlightDiv.style.borderRadius = '1px';
          highlightDiv.style.pointerEvents = 'none';
          highlightDiv.style.zIndex = '10';
          highlightDiv.title = `${edit.status}: ${edit.text.substring(0, 100)}${edit.text.length > 100 ? '...' : ''}`;
          highlightDiv.dataset.editId = edit.id;
          highlightDiv.className = 'library-annotation-highlight';

          // Make the content container relative if it's not already
          if (getComputedStyle(contentElement).position === 'static') {
            contentElement.style.position = 'relative';
          }

          contentElement.appendChild(highlightDiv);
          newHighlightElements.push(highlightDiv);
        }
      } catch (error) {
        logger.warn('Failed to create highlight for edit:', edit, error);
      }
    });

    setHighlightElements(newHighlightElements);

    // Clean up on unmount
    return () => {
      newHighlightElements.forEach(el => el.remove());
    };
  }, [edits, contentRef?.current, highlightElements]);

  return (
    <>
      {/* Selection indicator with precise feedback */}
      {selectedText && selection && (
        <div className="fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
          <div className="mb-2 text-sm text-gray-300">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-gray-500">Selected ({selectedText.length} chars):</span>
              <span className="text-xs text-gray-500">
                pos {selection.start}-{selection.end}
              </span>
            </div>
            <div className="max-h-16 overflow-y-auto rounded border bg-gray-800 px-2 py-1 font-mono text-xs">
              {selectedText.slice(0, 150)}
              {selectedText.length > 150 ? '...' : ''}
            </div>
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <div className="flex flex-wrap gap-1">
              <kbd className="rounded bg-red-500/20 px-1 text-red-300">Ctrl+R</kbd>
              <kbd className="rounded bg-yellow-500/20 px-1 text-yellow-300">Ctrl+Y</kbd>
              <kbd className="rounded bg-green-500/20 px-1 text-green-300">Ctrl+G</kbd>
              <kbd className="rounded bg-purple-500/20 px-1 text-purple-300">Ctrl+B</kbd>
            </div>
            <div className="text-xs text-gray-500">
              <kbd className="rounded bg-gray-600/20 px-1 text-gray-400">Ctrl+D</kbd> delete
              selection
              <kbd className="ml-1 rounded bg-red-600/20 px-1 text-red-400">Ctrl+Q</kbd> clear all
            </div>
          </div>
        </div>
      )}

      {/* Edit stats indicator */}
      {edits.length > 0 && (
        <div className="fixed bottom-4 left-4 z-40 rounded-lg border border-gray-700 bg-gray-900/90 p-2 shadow-xl">
          <div className="text-xs text-gray-300">Annotations: {edits.length}</div>
          <div className="mt-1 flex gap-1">
            {(['needs-edit', 'comparing', 'verified', 'amended'] as const).map(status => {
              const count = edits.filter(e => e.status === status).length;
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center gap-1">
                  <div
                    className="h-2 w-2 rounded"
                    style={{ backgroundColor: getStatusBorderColor(status) }}
                  />
                  <span className="text-xs text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
