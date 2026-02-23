'use client';

import { useState } from 'react';
import { TagStrip } from './TagStrip';
import { useTagMutations } from './hooks/useTagMutations';
import type { ReferenceImage, ReferenceTag, ReferenceTagId } from '@/types/project-references';

interface LightboxTagSystemProps {
  image: ReferenceImage;
  allTags: ReferenceTag[];
  projectSlug: string;
  isAdmin: boolean;
  onTagUpdate: (updatedImage: ReferenceImage) => void;
  onTagsRefresh: () => Promise<void>;
}

export function LightboxTagSystem({
  image,
  allTags,
  projectSlug,
  isAdmin,
  onTagUpdate,
  onTagsRefresh,
}: LightboxTagSystemProps) {
  const [announcement, setAnnouncement] = useState('');

  const { addTag, removeTag, isLoading, error } = useTagMutations({
    projectSlug,
    imageId: image.id,
    currentTags: image.tags.map(t => t.id),
    onSuccess: updatedImage => {
      onTagUpdate(updatedImage);

      // Announce change to screen readers
      const tagCount = updatedImage.tags.length;
      setAnnouncement(`Tags updated. ${tagCount} tag${tagCount !== 1 ? 's' : ''} total.`);
      setTimeout(() => setAnnouncement(''), 1000);
    },
  });

  const handleAdd = async (tagId: string) => {
    const tagToAdd = allTags.find(t => t.id === tagId);
    try {
      await addTag(tagId as ReferenceTagId);
      setAnnouncement(`Added tag: ${tagToAdd?.name}`);
      setTimeout(() => setAnnouncement(''), 1000);
    } catch (err) {
      setAnnouncement(`Failed to add tag: ${tagToAdd?.name}`);
      setTimeout(() => setAnnouncement(''), 1000);
    }
  };

  const handleRemove = async (tagId: string) => {
    const tagToRemove = image.tags.find(t => t.id === tagId);
    try {
      await removeTag(tagId as ReferenceTagId);
      setAnnouncement(`Removed tag: ${tagToRemove?.name}`);
      setTimeout(() => setAnnouncement(''), 1000);
    } catch (err) {
      setAnnouncement(`Failed to remove tag: ${tagToRemove?.name}`);
      setTimeout(() => setAnnouncement(''), 1000);
    }
  };

  return (
    <div className="relative w-full space-y-2">
      {/* Live region for screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded border border-red-500 bg-red-500/20 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Tag strip */}
      <TagStrip
        tags={image.tags}
        allTags={allTags}
        onAdd={isAdmin ? handleAdd : undefined}
        onRemove={isAdmin ? handleRemove : undefined}
        isLoading={isLoading}
        projectSlug={projectSlug}
        onTagsRefresh={onTagsRefresh}
      />
    </div>
  );
}
