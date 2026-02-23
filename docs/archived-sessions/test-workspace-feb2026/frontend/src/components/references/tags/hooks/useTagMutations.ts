import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReferenceImage, ReferenceTagId, ReferenceImageId } from '@/types/project-references';
import { fetchJSON } from '@/lib/utils/csrf';
import { useReferencesStore } from '@/lib/stores/referencesStore';

interface UseTagMutationsProps {
  projectSlug: string;
  imageId: ReferenceImageId;
  currentTags: ReferenceTagId[];
  onSuccess: (updatedImage: ReferenceImage) => void;
}

export function useTagMutations({
  projectSlug,
  imageId,
  currentTags,
  onSuccess,
}: UseTagMutationsProps) {
  const config = useReferencesStore(state => state.config);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track current tags - updates immediately without waiting for re-render
  // This prevents stale closure issues when removing multiple tags sequentially
  const currentTagsRef = useRef<ReferenceTagId[]>(currentTags);

  // Sync ref with props when they change
  useEffect(() => {
    currentTagsRef.current = currentTags;
  }, [currentTags]);

  const updateTags = useCallback(
    async (tagIds: ReferenceTagId[]) => {
      if (!config) return;

      setIsLoading(true);
      setError(null);

      try {
        const apiPath = config.uploadPath.replace('[slug]', projectSlug);
        const data = await fetchJSON(`${apiPath}/${imageId}`, {
          method: 'PATCH',
          body: { tag_ids: tagIds },
        });

        // Update ref immediately after successful API call
        // This ensures sequential tag operations see the latest state
        currentTagsRef.current = data.image.tags.map((t: { id: string }) => t.id);

        onSuccess(data.image);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update tags';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [projectSlug, imageId, onSuccess]
  );

  const addTag = useCallback(
    async (tagId: ReferenceTagId) => {
      // Use ref instead of closure to avoid stale state
      const newTagIds = [...currentTagsRef.current, tagId];
      await updateTags(newTagIds);
    },
    [updateTags]
  );

  const removeTag = useCallback(
    async (tagId: ReferenceTagId) => {
      // Use ref instead of closure to avoid stale state
      const newTagIds = currentTagsRef.current.filter(id => id !== tagId);
      await updateTags(newTagIds);
    },
    [updateTags]
  );

  return { addTag, removeTag, isLoading, error };
}
