/**
 * Library System Type Definitions
 *
 * The library is a SEPARATE document management system from the wiki.
 * It stores text-based documents with rich metadata.
 */

// Database schema types
export interface LibraryDocument {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  publication_date: string | null;
  document_type: string;
  // status, description, abstract, search_text columns removed in schema migration (Nov 24, 2025)
  notes: string | null; // Replaces description field
  source_url: string | null; // Added in anarchist schema migration
  original_format: string | null; // Added in anarchist schema migration (default: 'markdown')
  content: string; // Text content (from file OR database during migration)
  file_path?: string; // Path to markdown file (new file-based storage)
  language: string | null;
  page_count: number | null; // Future feature: pages based on header count
  created_by: number | null; // Made nullable in schema migration
  created_at: string;
  updated_at: string;
  view_count: number;
  reconversion_status: 'ready_for_reconversion' | 'needs_source' | null; // PDF reconversion tracking
}

export interface LibraryTag {
  id: number;
  name: string;
  description: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface LibraryCollection {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  is_public: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

// API response types
export interface LibraryDocumentWithMetadata extends LibraryDocument {
  tags?: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  uploaded_by_username?: string;
  uploaded_by_display_name?: string;
  is_public?: boolean; // All library documents are public (status column removed)
}

export interface LibraryDocumentCreateInput {
  title: string;
  author?: string;
  publication_date?: string;
  document_type?: string;
  description?: string; // Maps to 'notes' column in database
  // abstract field removed in schema migration
  content: string; // Text content (required for text-based documents)
  tags?: string[]; // Tag names or IDs
}

export interface LibraryDocumentUpdateInput {
  title?: string;
  author?: string;
  publication_date?: string;
  document_type?: string;
  description?: string; // Maps to 'notes' column in database
  // abstract, status fields removed in schema migration
  content?: string;
  tags?: string[];
  authorId?: number; // User ID of who is making the update
}

export interface LibrarySearchParams {
  query?: string;
  language?: string | string[];
  tags?: string[];
  author?: string;
  document_type?: string;
  reconversion_status?: 'all' | 'ready_for_reconversion' | 'needs_source'; // PDF reconversion filter
  // status parameter removed - all documents published by default
  sort_by?:
    | 'title'
    | 'date'
    | 'author'
    | 'views'
    | 'downloads'
    | 'source-library-first'
    | 'source-anarchist-first';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  offset?: number; // Direct offset for pagination (takes precedence over page-based calculation)
}

export interface LibrarySearchResult {
  documents: LibraryDocumentWithMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    has_more: boolean;
  };
  stats?: {
    total_documents: number;
    categories_used: number;
    contributors: number;
  };
}

// Tag grouping for UI (simplified - no categories)
export interface LibraryTagGroup {
  type: string;
  name: string;
  tags: Array<{
    id: number;
    name: string;
    usage_count: number;
  }>;
}

// Frontend display types (what the UI expects)
export interface LibraryDocumentDisplay {
  id: number;
  title: string;
  author: string;
  publication_date: string;
  document_type: string;
  slug: string;
  tags: Array<{ id: number; name: string; type: string }>;
  created_at: string;
  view_count: number;
  page_count: number | null; // Future feature: pages based on header count
  is_public: boolean;
  description?: string;
  word_count?: number;
}

// View mode type for library display
export type LibraryViewMode = 'grid' | 'list';
