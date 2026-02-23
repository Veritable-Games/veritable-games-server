'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { InfoboxRenderer } from '@/components/wiki/InfoboxRenderer';
import { InlineEditWrapper } from '@/components/editor/InlineEditWrapper';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';
import type { WikiInfobox, WikiTemplate, WikiTemplateField } from '@/lib/wiki/types';

// Extended infobox type with joined template data
interface InfoboxWithTemplate extends WikiInfobox {
  template_name?: string;
  template_type?: 'infobox' | 'template' | 'notice';
  schema_definition?: string;
  template_fields?: WikiTemplateField[];
}

interface LibraryDocumentContentClientProps {
  documentSlug: string;
  documentId: string | number;
  content: string;
  source?: 'library' | 'anarchist';
  infoboxes?: InfoboxWithTemplate[];
  canEdit: boolean;
  userId?: number;
}

/**
 * LibraryDocumentContentClient - Client component for library content with inline editing
 *
 * Wraps the markdown content display with InlineEditWrapper to enable
 * in-place editing without navigating to a separate edit page.
 */
export function LibraryDocumentContentClient({
  documentSlug,
  documentId,
  content,
  source = 'library',
  infoboxes,
  canEdit,
  userId,
}: LibraryDocumentContentClientProps) {
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

      // Anarchist library documents are read-only
      if (source === 'anarchist') {
        return { success: false, error: 'Anarchist Library documents cannot be edited' };
      }

      try {
        const data = await fetchJSON(`/api/library/documents/${documentId}`, {
          method: 'PUT',
          body: {
            content: newContent.trim(),
            edit_summary: editSummary || 'Content updated via inline edit',
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
        logger.error('Error saving library document', { documentSlug, error: err });
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save changes',
        };
      }
    },
    [documentId, documentSlug, userId, source, router]
  );

  // Render infoboxes by position
  const renderInfoboxes = (positions: string[]) => {
    if (!infoboxes || infoboxes.length === 0) return null;

    const filteredInfoboxes = infoboxes.filter(infobox => positions.includes(infobox.position));

    if (filteredInfoboxes.length === 0) return null;

    return (
      <>
        {filteredInfoboxes.map(infobox => {
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

          const templateData: WikiTemplate = {
            id: infobox.template_id,
            name: infobox.template_name || 'Unknown',
            type: infobox.template_type || 'infobox',
            schema_definition: infobox.schema_definition || '{}',
            is_active: true,
            created_at: infobox.created_at,
            updated_at: infobox.updated_at,
          };

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

  // Anarchist library documents are read-only
  const effectiveCanEdit = canEdit && source === 'library';

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-6">
      <InlineEditWrapper
        content={content}
        onSave={handleSave}
        canEdit={effectiveCanEdit}
        features="full"
        placeholder="Edit document content..."
        minRows={15}
        showEditSummary={true}
        editLabel="Edit document content"
        renderEditTrigger={startEdit => (
          <button
            onClick={startEdit}
            className="mt-4 text-sm text-gray-400 transition-colors hover:text-blue-400"
          >
            Edit Document
          </button>
        )}
      >
        <div className="wiki-content-with-infobox">
          {/* Top/Right infoboxes */}
          {renderInfoboxes(['top-right', 'top-left'])}

          {/* Main content */}
          <HybridMarkdownRenderer
            content={content}
            className="prose prose-neutral prose-invert max-w-none"
            namespace="main"
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

export default LibraryDocumentContentClient;
