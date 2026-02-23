/**
 * Shared types for journals store
 * Split from monolithic journalsStore.ts for better maintainability
 */

export interface JournalCategory {
  id: string;
  user_id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface JournalNode {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  created_at: string;
  updated_at: string;
  journal_category_id?: string;
  children?: JournalNode[];
  // Deletion tracking
  is_deleted?: boolean;
  deleted_by?: number;
  deleted_at?: string;
}

export interface JournalSearchResult {
  pages: JournalNode[];
  total: number;
  has_more: boolean;
}

export interface HistoryAction {
  type: 'delete' | 'restore' | 'move' | 'rename';
  timestamp: number;
  journalIds: number[];
  previousState: Record<
    number,
    {
      categoryId?: string;
      title?: string;
      isDeleted?: boolean;
    }
  >;
  newState: Record<
    number,
    {
      categoryId?: string;
      title?: string;
      isDeleted?: boolean;
    }
  >;
}
