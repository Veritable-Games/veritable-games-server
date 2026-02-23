/**
 * Confirmed Delete Hook for Workspace Nodes
 *
 * This hook implements the "server confirms first" pattern:
 * 1. Call server DELETE API
 * 2. Wait for successful response
 * 3. ONLY THEN remove from Yjs/local state
 *
 * This prevents the bug where nodes return on refresh after failed deletes.
 *
 * Phase 2 of workspace refactoring.
 * @see /home/user/.claude/plans/valiant-weaving-whisper.md
 */

import { useCallback, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace';
import { fetchWithCSRF } from '@/lib/utils/csrf';
import { unsafeToNodeId, NodeId } from '@/lib/workspace/branded-types';

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface UseConfirmedDeleteReturn {
  /** Execute a confirmed delete (waits for server) */
  confirmedDelete: (nodeId: string) => Promise<DeleteResult>;
  /** Execute confirmed delete for multiple nodes */
  confirmedDeleteMultiple: (nodeIds: string[]) => Promise<DeleteResult>;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Clear any current error */
  clearError: () => void;
}

/**
 * Hook for server-confirmed node deletion
 *
 * Usage:
 * ```tsx
 * const { confirmedDelete, isDeleting, error } = useConfirmedDelete();
 *
 * const handleDelete = async (nodeId: string) => {
 *   const result = await confirmedDelete(nodeId);
 *   if (!result.success) {
 *     toast.error(result.error || 'Failed to delete node');
 *   }
 * };
 * ```
 */
export function useConfirmedDelete(): UseConfirmedDeleteReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteNode = useWorkspaceStore(s => s.deleteNode);
  const workspaceId = useWorkspaceStore(s => s.workspaceId);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Delete a single node with server confirmation
   */
  const confirmedDelete = useCallback(
    async (nodeId: string): Promise<DeleteResult> => {
      if (!workspaceId) {
        const msg = 'Cannot delete: no workspace loaded';
        setError(msg);
        return { success: false, error: msg };
      }

      setIsDeleting(true);
      setError(null);

      try {
        // Step 1: Confirm with server FIRST
        const response = await fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // Try to parse error message from response
          let errorMessage = `Delete failed: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // Use default error message
          }

          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        // Step 2: ONLY NOW remove from Yjs/local state
        // Server confirmed the delete, safe to update UI
        deleteNode(unsafeToNodeId(nodeId));

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed - network error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteNode, workspaceId]
  );

  /**
   * Delete multiple nodes with server confirmation
   *
   * Deletes nodes sequentially to ensure consistency.
   * Stops on first error but nodes already deleted stay deleted.
   */
  const confirmedDeleteMultiple = useCallback(
    async (nodeIds: string[]): Promise<DeleteResult> => {
      if (nodeIds.length === 0) {
        return { success: true };
      }

      if (!workspaceId) {
        const msg = 'Cannot delete: no workspace loaded';
        setError(msg);
        return { success: false, error: msg };
      }

      setIsDeleting(true);
      setError(null);

      const failedDeletes: string[] = [];
      let lastError: string | undefined;

      // Delete sequentially to maintain consistency
      // Could be parallelized but sequential is safer for conflict detection
      for (const nodeId of nodeIds) {
        try {
          const response = await fetchWithCSRF(`/api/workspace/nodes/${nodeId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            let errorMessage = `Delete failed: ${response.status}`;
            try {
              const errorData = await response.json();
              if (errorData.error?.message) {
                errorMessage = errorData.error.message;
              }
            } catch {
              // Use default error message
            }

            failedDeletes.push(nodeId);
            lastError = errorMessage;
            // Continue trying other nodes
            continue;
          }

          // Server confirmed - now safe to remove from local state
          deleteNode(unsafeToNodeId(nodeId));
        } catch (err) {
          failedDeletes.push(nodeId);
          lastError = err instanceof Error ? err.message : 'Network error';
        }
      }

      setIsDeleting(false);

      if (failedDeletes.length > 0) {
        const msg =
          failedDeletes.length === nodeIds.length
            ? lastError || 'All deletes failed'
            : `Failed to delete ${failedDeletes.length} of ${nodeIds.length} nodes`;
        setError(msg);
        return { success: false, error: msg };
      }

      return { success: true };
    },
    [deleteNode, workspaceId]
  );

  return {
    confirmedDelete,
    confirmedDeleteMultiple,
    isDeleting,
    error,
    clearError,
  };
}

/**
 * Hook for confirmed connection deletion
 *
 * Same pattern as node deletion - server confirms first.
 */
export function useConfirmedConnectionDelete() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteConnection = useWorkspaceStore(s => s.deleteConnection);
  const workspaceId = useWorkspaceStore(s => s.workspaceId);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const confirmedDelete = useCallback(
    async (connectionId: string): Promise<DeleteResult> => {
      if (!workspaceId) {
        const msg = 'Cannot delete: no workspace loaded';
        setError(msg);
        return { success: false, error: msg };
      }

      setIsDeleting(true);
      setError(null);

      try {
        const response = await fetchWithCSRF(`/api/workspace/connections/${connectionId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let errorMessage = `Delete failed: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch {
            // Use default
          }

          setError(errorMessage);
          return { success: false, error: errorMessage };
        }

        // Import the unsafe converter dynamically to avoid circular deps
        const { unsafeToConnectionId } = await import('@/lib/workspace/branded-types');
        deleteConnection(unsafeToConnectionId(connectionId));

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed - network error';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteConnection, workspaceId]
  );

  return {
    confirmedDelete,
    isDeleting,
    error,
    clearError,
  };
}
