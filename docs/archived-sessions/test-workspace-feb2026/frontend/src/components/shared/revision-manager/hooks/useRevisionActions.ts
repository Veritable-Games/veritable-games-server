'use client';

import { useState } from 'react';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
}

interface UseRevisionActionsProps {
  apiPath: string; // e.g., '/api/projects/my-slug/revisions' or '/api/wiki/pages/my-slug/revisions'
  onRevisionsUpdate: (revisions: Revision[]) => void;
  onRevisionDeleted: (revisionId: number) => void;
}

export function useRevisionActions({
  apiPath,
  onRevisionsUpdate,
  onRevisionDeleted,
}: UseRevisionActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRevisions = async () => {
    try {
      const response = await fetch(apiPath, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        onRevisionsUpdate(data.revisions || []);
      }
    } catch (error) {
      logger.error('Error fetching revisions:', error);
    }
  };

  const deleteRevision = async (revisionId: number) => {
    if (!confirm('Are you sure you want to delete this revision? This action cannot be undone.')) {
      return false;
    }

    setIsProcessing(true);
    try {
      await fetchJSON(`${apiPath}?revisionId=${revisionId}`, {
        method: 'DELETE',
      });

      onRevisionDeleted(revisionId);
      await fetchRevisions();
      return true;
    } catch (error) {
      logger.error('Error deleting revision:', error);
      alert('Failed to delete revision. Please try again.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const restoreRevision = async (revision: Revision) => {
    if (
      !confirm(
        `Are you sure you want to restore to revision #${revision.id}? This will create a new revision with the content from #${revision.id}.`
      )
    ) {
      return false;
    }

    setIsProcessing(true);
    try {
      await fetchJSON(`${apiPath}/restore`, {
        method: 'POST',
        body: {
          revisionId: revision.id,
          summary: `Restored to revision #${revision.id}: ${revision.summary || 'No summary'}`,
        },
      });

      await fetchRevisions();
      alert(`Successfully restored to revision #${revision.id}`);
      return true;
    } catch (error) {
      logger.error('Error restoring revision:', error);
      alert('Failed to restore revision. Please try again.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    deleteRevision,
    restoreRevision,
    fetchRevisions,
  };
}
