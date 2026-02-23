import { useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspace';
import { WorkspaceId } from '@/lib/workspace/branded-types';
import { logger } from '@/lib/utils/logger';

/**
 * Hook to initialize Yjs for workspace collaboration
 *
 * This hook:
 * 1. Initializes Yjs document and providers when workspace loads
 * 2. Sets up WebSocket connection for real-time sync
 * 3. Enables IndexedDB persistence for offline support
 * 4. Configures awareness for presence (cursors, selections)
 * 5. Cleans up all providers on unmount
 *
 * @param workspaceId - The workspace ID to collaborate on
 * @param userId - The current user's ID for presence
 */
export function useWorkspaceYjs(workspaceId: WorkspaceId, userId: string) {
  const initializeYjs = useWorkspaceStore(state => state.initializeYjs);
  const destroyYjs = useWorkspaceStore(state => state.destroyYjs);

  useEffect(() => {
    // Initialize Yjs document and providers
    logger.info(`[useWorkspaceYjs] Initializing for workspace: ${workspaceId}, user: ${userId}`);
    initializeYjs(workspaceId, userId);

    // Cleanup on unmount
    return () => {
      logger.info('[useWorkspaceYjs] Destroying Yjs providers');
      destroyYjs();
    };
  }, [workspaceId, userId, initializeYjs, destroyYjs]);
}
