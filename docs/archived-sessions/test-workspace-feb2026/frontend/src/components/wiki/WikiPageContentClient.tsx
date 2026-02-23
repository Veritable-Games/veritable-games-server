'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { InfoboxRenderer } from '@/components/wiki/InfoboxRenderer';
import { InlineEditWrapper } from '@/components/editor/InlineEditWrapper';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import type { WikiInfobox, WikiTemplate, WikiTemplateField } from '@/lib/wiki/types';

// Extended infobox type with joined template data from the database query
interface InfoboxWithTemplate extends WikiInfobox {
  template_name?: string;
  template_type?: 'infobox' | 'template' | 'notice';
  schema_definition?: string;
  template_fields?: WikiTemplateField[];
}

interface WikiPageContentClientProps {
  pageSlug: string;
  pageId: number;
  content: string;
  namespace: string;
  infoboxes?: InfoboxWithTemplate[];
  canEdit: boolean;
  userId?: number;
}

/**
 * WikiPageContentClient - Client component for wiki content with inline editing
 *
 * Wraps the markdown content display with InlineEditWrapper to enable
 * in-place editing without navigating to a separate edit page.
 */
export function WikiPageContentClient({
  pageSlug,
  pageId,
  content,
  namespace,
  infoboxes,
  canEdit,
  userId,
}: WikiPageContentClientProps) {
  const router = useRouter();

  /**
   * Handle saving edited content
   */
  const handleSave = useCallback(
    async (
      newContent: string,
      editSummary?: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, error: 'You must be logged in to edit' };
      }

      try {
        // URL-encode the slug to handle namespace prefixes
        const encodedSlug = encodeURIComponent(pageSlug);

        const data = await fetchJSON(`/api/wiki/pages/${encodedSlug}`, {
          method: 'PUT',
          body: {
            content: newContent.trim(),
            summary: editSummary || 'Page updated via inline edit',
            authorId: userId,
          },
        });

        if (data.success) {
          // Refresh the page to show updated content
          router.refresh();
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to save changes' };
        }
      } catch (err) {
        logger.error('Error saving wiki page', { pageSlug, error: err });
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save changes',
        };
      }
    },
    [pageSlug, userId, router]
  );

  // Render infoboxes by position
  const renderInfoboxes = (positions: string[]) => {
    if (!infoboxes || infoboxes.length === 0) return null;

    const filteredInfoboxes = infoboxes.filter(infobox => positions.includes(infobox.position));

    if (filteredInfoboxes.length === 0) return null;

    return (
      <>
        {filteredInfoboxes.map(infobox => {
          // Build WikiInfobox object
          const infoboxData: WikiInfobox = {
            id: infobox.id,
            page_id: infobox.page_id,
            template_id: infobox.template_id,
            position: infobox.position,
            data: infobox.data,
            is_active: infobox.is_active,
            created_at: infobox.created_at,
            updated_at: infobox.updated_at,
            parsed_data: infobox.parsed_data,
          };

          // Build WikiTemplate object
          const templateData: WikiTemplate = {
            id: infobox.template_id,
            name: infobox.template_name || 'Unknown',
            type: infobox.template_type || 'infobox',
            schema_definition: infobox.schema_definition || '{}',
            is_active: true,
            created_at: infobox.created_at,
            updated_at: infobox.updated_at,
          };

          // Use template fields or empty array
          const fields: WikiTemplateField[] = infobox.template_fields || [];

          return (
            <InfoboxRenderer
              key={infobox.id}
              infobox={infoboxData}
              template={templateData}
              fields={fields}
            />
          );
        })}
      </>
    );
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
      <InlineEditWrapper
        content={content}
        onSave={handleSave}
        canEdit={canEdit}
        features="full"
        placeholder="Edit wiki page content..."
        minRows={15}
        showEditSummary={true}
        editLabel="Edit page content"
        renderEditTrigger={startEdit => (
          <button
            onClick={startEdit}
            className="mt-4 text-sm text-gray-400 transition-colors hover:text-blue-400"
          >
            Edit Page
          </button>
        )}
      >
        <div className="wiki-content-with-infobox">
          {/* Top/Right infoboxes */}
          {renderInfoboxes(['top-right', 'top-left'])}

          {/* Main content */}
          <HybridMarkdownRenderer
            content={content}
            className="prose prose-blue prose-invert max-w-none"
            namespace={namespace}
          />

          {/* Bottom/Inline infoboxes */}
          {infoboxes && infoboxes.length > 0 && (
            <div className="mt-4">{renderInfoboxes(['inline', 'bottom-right', 'bottom-left'])}</div>
          )}
        </div>
      </InlineEditWrapper>
    </div>
  );
}

export default WikiPageContentClient;
