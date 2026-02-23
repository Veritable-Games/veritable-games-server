/**
 * Anarchist Library Document Types
 *
 * Represents documents from the global Anarchist Library Network
 * (24,643 texts across 27 languages in .muse format)
 */

/**
 * Core anarchist document record from PostgreSQL
 */
export interface AnarchistDocument {
  id: number;
  slug: string; // URL-friendly identifier
  title: string;
  author?: string;
  publication_date?: string;
  language: string; // ISO 639-1 code (en, de, es, fr, etc.)
  file_path: string; // Relative path to markdown file in Docker volume
  source_url?: string;
  category?: string; // e.g., 'anarchist-en', 'anarchist-de'
  document_type?: string;
  notes?: string;
  original_format?: string; // 'muse' for all anarchist library documents
  is_public?: boolean; // Visibility control: true = public (visible to all), false = admin-only
  tags?: Array<{ id: number; name: string }>; // Associated tags
  view_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Anarchist document with full content loaded from filesystem
 */
export interface AnarchistDocumentWithContent extends AnarchistDocument {
  content: string; // Full markdown content from file
  frontmatter?: Record<string, any>; // Parsed YAML frontmatter
}

/**
 * Tag for anarchist documents
 */
export interface AnarchistTag {
  id: number;
  name: string;
  usage_count: number;
  created_at: string;
}

/**
 * Document-tag relationship
 */
export interface AnarchistDocumentTag {
  document_id: number;
  tag_id: number;
  added_at: string;
}

/**
 * Search parameters for anarchist documents
 */
export interface AnarchistSearchParams {
  query?: string; // Full-text search
  language?: string; // Filter by language (en, de, es, etc.)
  category?: string; // Filter by category (anarchist-en, anarchist-de, etc.)
  author?: string; // Filter by author
  tags?: string[]; // Filter by tags
  sort_by?: 'title' | 'author' | 'publication_date' | 'created_at' | 'view_count';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  offset?: number; // Direct offset for pagination (takes precedence over page-based calculation)
}

/**
 * Search result with pagination
 */
export interface AnarchistSearchResult {
  documents: AnarchistDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    has_more: boolean;
  };
  stats: {
    total_documents: number;
    languages_available: number;
    total_authors: number;
  };
}

/**
 * Language metadata
 */
export interface AnarchistLanguage {
  code: string; // ISO 639-1 code
  name: string; // English name
  native_name?: string; // Native language name
  document_count: number;
  documents_indexed: number;
}

/**
 * Archive statistics
 */
export interface AnarchistArchiveStats {
  total_documents: number;
  total_languages: number;
  languages: AnarchistLanguage[];
  total_authors: number;
  oldest_publication?: string;
  newest_publication?: string;
  last_indexed: string;
}
