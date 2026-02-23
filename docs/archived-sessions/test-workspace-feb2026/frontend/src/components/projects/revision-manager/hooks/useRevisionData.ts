'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

export interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
}

export function useRevisionData(projectSlug: string) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/revisions`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch revisions: ${response.status}`);
      }

      const data = await response.json();
      setRevisions(data.revisions || []);
    } catch (err) {
      logger.error('Error fetching revisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load revisions');
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  // Fetch revisions on mount
  useEffect(() => {
    fetchRevisions();
  }, [fetchRevisions]);

  return {
    revisions,
    loading,
    error,
    refetch: fetchRevisions,
  };
}
