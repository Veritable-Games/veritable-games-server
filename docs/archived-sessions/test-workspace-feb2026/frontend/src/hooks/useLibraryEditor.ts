'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

export interface TextEdit {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  status: 'needs-edit' | 'comparing' | 'verified' | 'amended';
  note?: string;
  timestamp: number;
}

export function useLibraryEditor(pageSlug: string) {
  const [edits, setEdits] = useState<TextEdit[]>([]);
  const [isDevMode, setIsDevMode] = useState(false);

  // Load edits on mount
  useEffect(() => {
    const saved = localStorage.getItem(`library-edits-${pageSlug}`);
    if (saved) {
      try {
        setEdits(JSON.parse(saved));
      } catch (e) {
        logger.error('Failed to load saved edits:', e);
      }
    }

    // Check if we're in dev mode
    const devMode = localStorage.getItem('library-dev-mode') === 'true';
    setIsDevMode(devMode);
  }, [pageSlug]);

  const saveEdits = (newEdits: TextEdit[]) => {
    setEdits(newEdits);
    localStorage.setItem(`library-edits-${pageSlug}`, JSON.stringify(newEdits));

    // Automatically send annotations to server for Claude to see
    if (newEdits.length > 0) {
      fetch('/api/library/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [pageSlug]: newEdits }),
      }).catch(error => {
        logger.warn('Failed to send annotations to server:', error);
      });
    }
  };

  const toggleDevMode = () => {
    const newMode = !isDevMode;
    setIsDevMode(newMode);
    localStorage.setItem('library-dev-mode', newMode.toString());
  };

  const getEditStats = () => {
    return {
      total: edits.length,
      needsEdit: edits.filter(e => e.status === 'needs-edit').length,
      comparing: edits.filter(e => e.status === 'comparing').length,
      verified: edits.filter(e => e.status === 'verified').length,
      amended: edits.filter(e => e.status === 'amended').length,
    };
  };

  const clearAllLibraryEdits = () => {
    if (confirm('Clear ALL library edits across all pages? This cannot be undone.')) {
      Object.keys(localStorage)
        .filter(key => key.startsWith('library-edits-'))
        .forEach(key => localStorage.removeItem(key));
      setEdits([]);
    }
  };

  return {
    edits,
    saveEdits,
    isDevMode,
    toggleDevMode,
    getEditStats,
    clearAllLibraryEdits,
  };
}
