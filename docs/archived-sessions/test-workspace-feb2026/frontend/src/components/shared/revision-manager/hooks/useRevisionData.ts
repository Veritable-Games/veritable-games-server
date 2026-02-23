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
  is_minor?: boolean;
}

interface UseRevisionDataProps {
  apiPath: string; // e.g., '/api/projects/my-slug/revisions' or '/api/wiki/pages/my-slug/revisions'
}

export function useRevisionData({ apiPath }: UseRevisionDataProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevisions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiPath, {
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
  }, [apiPath]);

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
