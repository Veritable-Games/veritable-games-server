/**
 * Unified Document Types
 *
 * Represents documents from BOTH library (user-uploaded) and anarchist (archived)
 * collections with common interface for consistent handling across UI/API
 */

// ============================================================================
// UNIFIED DOCUMENT TYPES
// ============================================================================

export interface UnifiedDocument {
  id: number | string;
  source: 'library' | 'anarchist';
  slug: string;
  title: string;
  titleEnglish?: string; // For non-English docs, shows English name for identification
  author?: string;
  language: string; // ISO 639-1 code: 'en', 'de', 'es', 'fr', 'pl', 'ru', etc.
  publication_date?: string;
  document_type?: string; // 'article', 'book', 'letter', 'work', etc.

  // Description/notes
  description?: string; // Library: description field; Anarchist: notes field

  // Metadata
  view_count: number;
  created_at: string;
  updated_at: string;

  // Tags from unified system (may come from either source)
  tags?: UnifiedTag[];
  category?: string;

  // Translation support
  translation_group_id?: string;
  available_languages?: string[]; // All language codes for this translation group

  // Source-specific metadata
  source_url?: string; // Anarchist only: original source URL
  original_format?: string; // Anarchist only: 'muse', 'md', etc.
  reconversion_status?: 'ready_for_reconversion' | 'needs_source' | null; // Library only: PDF reconversion status

  // Content location (not usually fetched at list level)
  content?: string; // Library: content stored in DB
  file_path?: string; // Anarchist: path to markdown file on filesystem

  // Optional user metadata
  is_public?: boolean; // Visibility control: true = public (visible to all), false = admin-only
  created_by?: number; // Library only: user ID who created
}

export interface UnifiedTag {
  id: number;
  name: string;
  type?: string; // 'source', 'theme', 'method', 'time', 'geography', etc.
  category?: string; // Tag category for grouping in sidebar
}

// ============================================================================
// SEARCH & QUERY TYPES
// ============================================================================

export interface UnifiedSearchParams {
  query?: string;
  language?: string | string[]; // Single language or array for multi-select
  tags?: string[]; // Tag names or IDs
  source?: 'all' | 'library' | 'anarchist'; // Filter by source
  author?: string;
  sort_by?:
    | 'title'
    | 'author'
    | 'publication_date'
    | 'created_at'
    | 'view_count'
    | 'relevance'
    | 'source-library-first'
    | 'source-anarchist-first';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  userRole?: string; // User role for visibility filtering ('admin', 'moderator', or undefined for anonymous)
}

export interface UnifiedSearchResult {
  documents: UnifiedDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  metadata?: {
    search_time_ms: number;
    results_from_library: number;
    results_from_anarchist: number;
  };
}

export interface UnifiedSearchResponse {
  success: boolean;
  data?: UnifiedSearchResult;
  error?: string;
}

// ============================================================================
// DOCUMENT DETAIL TYPES
// ============================================================================

export interface UnifiedDocumentWithContent extends UnifiedDocument {
  content: string; // Always populated for detail view
  frontmatter?: Record<string, any>; // YAML metadata (if exists)
  rendering_metadata?: {
    word_count: number;
    reading_time_minutes: number;
    language_detected: string;
  };
}

export interface DocumentTranslation {
  id: number | string;
  source: 'library' | 'anarchist';
  slug: string;
  title: string;
  language: string;
  author?: string;
  publication_date?: string;
}

export interface TranslationGroup {
  translation_group_id: string;
  translations: DocumentTranslation[];
  languages: string[];
  total: number;
}

// ============================================================================
// LANGUAGE & ARCHIVE STATS
// ============================================================================

export interface LanguageInfo {
  code: string;
  name: string;
  native_name?: string;
  document_count: number;
  from_library: number;
  from_anarchist: number;
}

export interface ArchiveStats {
  total_documents: number;
  library_documents: number;
  anarchist_documents: number;
  total_languages: number;
  languages: LanguageInfo[];
  date_range?: {
    oldest: string;
    newest: string;
  };
  last_updated: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DocumentsApiResponse extends ApiResponse<UnifiedSearchResult> {}
export interface DocumentDetailApiResponse extends ApiResponse<UnifiedDocumentWithContent> {}
export interface TranslationsApiResponse extends ApiResponse<TranslationGroup> {}
export interface LanguagesApiResponse extends ApiResponse<LanguageInfo[]> {}
export interface ArchiveStatsApiResponse extends ApiResponse<ArchiveStats> {}

// ============================================================================
// LIBRARY-SPECIFIC TYPES (for backwards compatibility)
// ============================================================================

export interface LibrarySpecificFields {
  status?: 'draft' | 'published' | 'archived';
  description?: string;
  abstract?: string;
  is_public?: boolean;
  created_by?: number;
  page_count?: number;
  word_count?: number;
}

// ============================================================================
// ANARCHIST-SPECIFIC TYPES (for backwards compatibility)
// ============================================================================

export interface AnarchistSpecificFields {
  source_url?: string;
  notes?: string;
  original_format?: string;
  category?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isLibraryDocument(doc: UnifiedDocument): boolean {
  return doc.source === 'library';
}

export function isAnarchistDocument(doc: UnifiedDocument): boolean {
  return doc.source === 'anarchist';
}

export function hasTranslations(doc: UnifiedDocument): boolean {
  return !!(
    doc.translation_group_id &&
    doc.available_languages &&
    doc.available_languages.length > 1
  );
}

export function isNonEnglishDocument(doc: UnifiedDocument): boolean {
  return doc.language !== 'en' && doc.language !== 'en-US';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getSourceColor(source: 'library' | 'anarchist'): string {
  return source === 'library' ? 'blue' : 'green';
}

export function getSourceLabel(source: 'library' | 'anarchist'): string {
  return source === 'library' ? 'User Library' : 'Anarchist Archive';
}

export function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    en: 'English',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    pt: 'Português',
    pl: 'Polski',
    ru: 'Русский',
    nl: 'Nederlands',
    sv: 'Svenska',
    da: 'Dansk',
    no: 'Norsk',
    fi: 'Suomi',
    tr: 'Türkçe',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    fa: 'فارسی',
    el: 'Ελληνικά',
    hu: 'Magyar',
    cs: 'Čeština',
    ro: 'Română',
    sr: 'Српски',
    mk: 'Македонски',
    sq: 'Shqip',
    eu: 'Euskara',
    eo: 'Esperanto',
  };
  return languageNames[code] || code;
}
