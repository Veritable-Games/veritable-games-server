'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useSyncScrolling() {
  const [syncScrolling, setSyncScrolling] = useState(true);
  const syncScrollingRef = useRef(syncScrolling);
  const leftEditorRef = useRef<any>(null);
  const rightEditorRef = useRef<any>(null);

  // Keep sync ref updated with state
  useEffect(() => {
    syncScrollingRef.current = syncScrolling;
  }, [syncScrolling]);

  // Handle synchronized scrolling
  const handleScroll = useCallback((sourceEditor: any, targetEditor: any) => {
    if (!syncScrollingRef.current || !sourceEditor || !targetEditor) return;
    const sourceScrollTop = sourceEditor.getScrollTop();
    targetEditor.setScrollTop(sourceScrollTop);
  }, []);

  // Handle sync toggle - bring both editors to same position when re-enabling
  const handleSyncToggle = useCallback(() => {
    const newSyncState = !syncScrolling;
    setSyncScrolling(newSyncState);

    if (newSyncState && leftEditorRef.current && rightEditorRef.current) {
      // When re-enabling sync, align both editors to the left editor's position
      const leftScrollTop = leftEditorRef.current.getScrollTop();
      rightEditorRef.current.setScrollTop(leftScrollTop);
    }
  }, [syncScrolling]);

  // Setup editor with synchronized scrolling
  const setupLeftEditor = useCallback(
    (editor: any) => {
      leftEditorRef.current = editor;

      // Add synchronized scrolling
      editor.onDidScrollChange(() => {
        if (syncScrollingRef.current && rightEditorRef.current) {
          handleScroll(editor, rightEditorRef.current);
        }
      });
    },
    [handleScroll]
  );

  const setupRightEditor = useCallback(
    (editor: any) => {
      rightEditorRef.current = editor;

      // Add synchronized scrolling
      editor.onDidScrollChange(() => {
        if (syncScrollingRef.current && leftEditorRef.current) {
          handleScroll(editor, leftEditorRef.current);
        }
      });
    },
    [handleScroll]
  );

  // Force layout recalculation for both editors
  const forceLayout = useCallback(() => {
    setTimeout(() => {
      if (leftEditorRef.current) {
        leftEditorRef.current.layout();
      }
      if (rightEditorRef.current) {
        rightEditorRef.current.layout();
      }
    }, 100);
  }, []);

  return {
    syncScrolling,
    setSyncScrolling: handleSyncToggle,
    setupLeftEditor,
    setupRightEditor,
    leftEditorRef,
    rightEditorRef,
    forceLayout,
  };
}
