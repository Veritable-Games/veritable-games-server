'use client';

import { useRouter } from 'next/navigation';
import { SourceBadge } from '@/components/documents/SourceBadge';
import { LanguageCodeBadge } from '@/components/documents/LanguageCodeBadge';
import { useDocumentSelectionStore } from '@/lib/stores/documentSelectionStore';
import { generateDocumentPreview } from '@/lib/utils/preview-generator';
import { formatPublicationDate } from '@/lib/utils/date-formatter';
import type { UnifiedDocument } from '@/lib/documents/types';

/**
 * Extended UnifiedDocument with optional anarchist-specific fields
 * (notes, abstract) that may be present on documents from anarchist source
 */
interface UnifiedDocumentWithExtras extends UnifiedDocument {
  notes?: string;
  abstract?: string;
}

interface DocumentCardProps {
  doc: UnifiedDocument;
  onDelete?: (docId: string) => void;
  user?: { role: string } | null;
  index?: number;
  allDocuments?: UnifiedDocument[];
}

export function DocumentCard({ doc, onDelete, user, index, allDocuments }: DocumentCardProps) {
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  // Selection store hooks
  const toggleDocumentSelection = useDocumentSelectionStore(state => state.toggleDocumentSelection);
  const selectWithShift = useDocumentSelectionStore(state => state.selectWithShift);
  const selectedDocumentIds = useDocumentSelectionStore(state => state.selectedDocumentIds);
  const clearSelection = useDocumentSelectionStore(state => state.clearSelection);
  const docIdString = String(doc.id);
  const isSelected = selectedDocumentIds.has(docIdString);

  const getPreviewText = (): string => {
    // Use intelligent preview generator that handles:
    // 1. Description field (library docs)
    // 2. Notes field (anarchist docs)
    // 3. Content extraction (fallback)
    const docWithExtras = doc as UnifiedDocumentWithExtras;
    return generateDocumentPreview({
      title: doc.title,
      description: doc.description,
      notes: docWithExtras.notes, // Anarchist docs have notes field
      abstract: docWithExtras.abstract,
      content: doc.content,
      document_type: doc.document_type,
    });
  };

  const getLanguageCode = (): string => {
    const codeMap: Record<string, string> = {
      english: 'EN',
      en: 'EN',
      french: 'FR',
      fr: 'FR',
      spanish: 'ES',
      es: 'ES',
      german: 'DE',
      de: 'DE',
      russian: 'RU',
      ru: 'RU',
      portuguese: 'PT',
      pt: 'PT',
      italian: 'IT',
      it: 'IT',
      polish: 'PL',
      pl: 'PL',
      dutch: 'NL',
      nl: 'NL',
      greek: 'EL',
      el: 'EL',
      turkish: 'TR',
      tr: 'TR',
      korean: 'KR',
      ko: 'KR',
      japanese: 'JA',
      ja: 'JA',
      chinese: 'ZH',
      zh: 'ZH',
    };

    if (!doc.language) return 'EN';
    return codeMap[doc.language.toLowerCase()] || doc.language.substring(0, 2).toUpperCase();
  };

  const preview = getPreviewText();
  const languageCode = getLanguageCode();

  const handleClick = (e: React.MouseEvent) => {
    // Shift+Click for range selection
    if (e.shiftKey && typeof index === 'number' && allDocuments) {
      e.preventDefault();
      e.stopPropagation();
      selectWithShift(index, allDocuments);
      return;
    }

    // Ctrl+Click or Cmd+Click for toggle selection
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleDocumentSelection(docIdString, index);
      return;
    }

    // Regular click - clear selection and navigate
    if (selectedDocumentIds.size > 0) {
      clearSelection();
    }
    router.push(`/library/${doc.slug}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(docIdString);
    }
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/library/${doc.slug}`);
        }
      }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-gray-900/70 p-5 transition-all ${
        isSelected
          ? 'border-blue-500'
          : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/70'
      } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
      style={{
        height: '240px',
        minHeight: '240px',
        maxHeight: '240px',
        contain: 'strict',
        contentVisibility: 'auto',
        containIntrinsicBlockSize: '240px',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Document: ${doc.title}`}
    >
      {/* Language Badge - Top Right */}
      <div className="absolute right-2 top-2 flex gap-0.5">
        <LanguageCodeBadge languageCodes={[languageCode]} />
      </div>

      {/* Source & Status Badges - Bottom Right */}
      <div className="absolute bottom-2 right-2 z-10 flex gap-0.5">
        {/* Source Badge (AL, UL, RFR) */}
        <SourceBadge source={doc.source} />
      </div>

      {/* Selection Checkmark Badge - Top Left */}
      {isSelected && (
        <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Private Document Indicator - Eye-Slash Overlay */}
      {!doc.is_public && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            className="h-16 w-16 text-red-500/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {/* Eye with slash - indicates admin-only */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        </div>
      )}

      {/* Delete Button - Shows when selected */}
      {isSelected && onDelete && (
        <button
          onClick={handleDelete}
          className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 shadow-lg transition-colors hover:bg-red-700"
          title="Delete document"
          aria-label="Delete document"
        >
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}

      {/* Title - Top Left */}
      <h3 className="mb-2 line-clamp-2 pr-16 text-lg font-semibold text-white hover:text-blue-300">
        {doc.title}
      </h3>

      {/* Preview Text */}
      {preview && <p className="line-clamp-4 text-sm text-gray-400">{preview}</p>}

      {/* Author and Date */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        {doc.author && (
          <span className="truncate" title={doc.author}>
            {doc.author}
          </span>
        )}
        {doc.author && doc.publication_date && <span>•</span>}
        {doc.publication_date && <span>{formatPublicationDate(doc.publication_date, 'year')}</span>}
      </div>

      {/* Tags - Bottom Left */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {doc.tags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              className="inline-block rounded bg-blue-900/30 px-2 py-0.5 text-[10px] leading-tight text-blue-300"
              title={tag.name}
            >
              {tag.name}
            </span>
          ))}
          {doc.tags.length > 3 && (
            <span className="inline-block text-[10px] text-gray-500">+{doc.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
