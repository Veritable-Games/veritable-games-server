'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectTabs } from '@/components/projects/ProjectTabs';
import { fetchJSON } from '@/lib/utils/csrf';
import type { TracedContent } from '@/lib/tracing/types';
import { logger } from '@/lib/utils/logger';

interface ProjectDetailClientProps {
  projectSlug: string;
  projectTitle: string;
  isAdmin: boolean;
  defaultContent: string;
  lastUpdated?: string;
  // Tracing system
  tracingEnabled?: boolean;
  backgroundContent?: string | null;
  tracedContents?: TracedContent[];
}

/**
 * Client component for project detail page interactive features
 * Handles editing, saving, and ProjectTabs interactions
 */
export function ProjectDetailClient({
  projectSlug,
  projectTitle,
  isAdmin,
  defaultContent,
  lastUpdated,
  tracingEnabled = false,
  backgroundContent,
  tracedContents = [],
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const projectTabsRef = useRef<{ save: () => Promise<void> } | null>(null);

  const handleContentSave = async (content: string) => {
    if (!isAdmin) {
      throw new Error('Not authorized to edit project');
    }

    setSaving(true);
    try {
      const data = await fetchJSON(`/api/projects/${encodeURIComponent(projectSlug)}`, {
        method: 'PUT',
        body: {
          content,
          summary: 'Content updated',
        },
      });

      if (!data.success) {
        throw new Error(data.error || 'Failed to save project');
      }

      // Refresh to show updated content (Server Component will re-fetch)
      router.refresh();
      setIsEditing(false);
    } catch (error) {
      logger.error('Error saving project:', error);
      throw error; // Re-throw so ProjectTabs can handle the error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex h-full flex-col rounded border border-gray-700 bg-gray-900/70">
        <div className="flex-1 overflow-hidden">
          <ProjectTabs
            ref={projectTabsRef}
            projectSlug={projectSlug}
            projectTitle={projectTitle}
            isAdmin={isAdmin}
            defaultContent={defaultContent}
            onContentSave={handleContentSave}
            saving={saving}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            onSave={async () => {
              // Handled by handleContentSave
            }}
            onCancel={() => setIsEditing(false)}
            lastUpdated={lastUpdated}
            onEditClick={() => setIsEditing(true)}
            tracingEnabled={tracingEnabled}
            backgroundContent={backgroundContent ?? undefined}
            tracedContents={tracedContents}
          />
        </div>
      </div>
    </div>
  );
}
