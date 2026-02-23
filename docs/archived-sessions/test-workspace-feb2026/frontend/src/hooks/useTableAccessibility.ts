'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useLiveRegion } from './useAccessibility';

export interface TableItem {
  id: number | string;
  [key: string]: any;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  ariaLabel?: string;
  align?: 'left' | 'right' | 'center';
}

export interface UseTableAccessibilityOptions {
  items: TableItem[];
  columns: TableColumn[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowSelect?: (itemId: number | string, selected: boolean, event?: Event) => void;
  onRowAction?: (itemId: number | string, action: string) => void;
  selectedIds?: Set<number | string>;
  totalCount?: number;
  pageSize?: number;
  currentPage?: number;
  ariaLabel?: string;
  caption?: string;
}

export interface TableNavigationState {
  focusedRow: number;
  focusedColumn: number;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
}

/**
 * Enhanced table accessibility hook providing WCAG 2.2 Level AA compliance
 * Features:
 * - ARIA grid pattern with proper roles and properties
 * - Full keyboard navigation (arrows, Home/End, Page Up/Down)
 * - Screen reader announcements for state changes
 * - Sortable column headers with ARIA states
 * - Bulk selection support with proper labeling
 * - Focus management and restoration
 */
export function useTableAccessibility(options: UseTableAccessibilityOptions) {
  const {
    items,
    columns,
    onSort,
    onRowSelect,
    onRowAction,
    selectedIds = new Set(),
    totalCount = items.length,
    pageSize = 100,
    currentPage = 1,
    ariaLabel = 'Data table',
    caption,
  } = options;

  const tableRef = useRef<HTMLTableElement>(null);
  const [navigationState, setNavigationState] = useState<TableNavigationState>({
    focusedRow: -1,
    focusedColumn: -1,
    sortColumn: null,
    sortDirection: 'asc',
  });

  // Live region for announcements
  const announce = useLiveRegion('polite');
  const announceAssertive = useLiveRegion('assertive');

  /**
   * Move focus to a specific cell
   */
  const focusCell = useCallback((rowIndex: number, columnIndex: number) => {
    if (!tableRef.current) return;

    const cell = tableRef.current.querySelector(
      `[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
    ) as HTMLElement;

    if (cell) {
      cell.focus();
      setNavigationState(prev => ({
        ...prev,
        focusedRow: rowIndex,
        focusedColumn: columnIndex,
      }));
    }
  }, []);

  /**
   * Handle keyboard navigation within the table
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!tableRef.current) return;

      const { focusedRow, focusedColumn } = navigationState;
      const maxRow = items.length - 1;
      const maxColumn = columns.length - 1;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (focusedRow < maxRow) {
            focusCell(focusedRow + 1, focusedColumn);
            // Announce row change
            const nextItem = items[focusedRow + 1];
            if (nextItem) {
              announce(
                `Row ${focusedRow + 2} of ${items.length}, ${nextItem.title || nextItem.name || 'item'}`
              );
            }
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (focusedRow > 0) {
            focusCell(focusedRow - 1, focusedColumn);
            // Announce row change
            const prevItem = items[focusedRow - 1];
            if (prevItem) {
              announce(
                `Row ${focusedRow} of ${items.length}, ${prevItem.title || prevItem.name || 'item'}`
              );
            }
          }
          break;

        case 'ArrowRight':
          event.preventDefault();
          if (focusedColumn < maxColumn) {
            focusCell(focusedRow, focusedColumn + 1);
            // Announce column change
            const column = columns[focusedColumn + 1];
            if (column) {
              announce(`Column ${column.label}`);
            }
          }
          break;

        case 'ArrowLeft':
          event.preventDefault();
          if (focusedColumn > 0) {
            focusCell(focusedRow, focusedColumn - 1);
            // Announce column change
            const column = columns[focusedColumn - 1];
            if (column) {
              announce(`Column ${column.label}`);
            }
          }
          break;

        case 'Home':
          event.preventDefault();
          if (event.ctrlKey) {
            // Ctrl+Home: First cell of table
            focusCell(0, 0);
            announce('Moved to first row, first column');
          } else {
            // Home: First cell of current row
            focusCell(focusedRow, 0);
            announce(`Moved to first column of row ${focusedRow + 1}`);
          }
          break;

        case 'End':
          event.preventDefault();
          if (event.ctrlKey) {
            // Ctrl+End: Last cell of table
            focusCell(maxRow, maxColumn);
            announce('Moved to last row, last column');
          } else {
            // End: Last cell of current row
            focusCell(focusedRow, maxColumn);
            announce(`Moved to last column of row ${focusedRow + 1}`);
          }
          break;

        case 'PageDown':
          event.preventDefault();
          const nextPageRow = Math.min(focusedRow + 10, maxRow);
          focusCell(nextPageRow, focusedColumn);
          announce(`Moved to row ${nextPageRow + 1}`);
          break;

        case 'PageUp':
          event.preventDefault();
          const prevPageRow = Math.max(focusedRow - 10, 0);
          focusCell(prevPageRow, focusedColumn);
          announce(`Moved to row ${prevPageRow + 1}`);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          // Handle row action or selection
          if (focusedRow >= 0 && focusedColumn === 0) {
            // First column is typically checkbox
            const item = items[focusedRow];
            if (item && onRowSelect) {
              const isSelected = selectedIds.has(item.id);
              onRowSelect(item.id, !isSelected, event);
              announce(`${item.title || 'Item'} ${!isSelected ? 'selected' : 'deselected'}`);
            }
          } else if (focusedRow >= 0 && onRowAction) {
            // Trigger default row action
            const item = items[focusedRow];
            if (item) {
              onRowAction(item.id, 'view');
            }
          }
          break;

        case 'Escape':
          // Clear focus and return to table
          if (tableRef.current) {
            tableRef.current.focus();
            setNavigationState(prev => ({
              ...prev,
              focusedRow: -1,
              focusedColumn: -1,
            }));
          }
          break;
      }
    },
    [navigationState, items, columns, onRowSelect, onRowAction, selectedIds, focusCell, announce]
  );

  /**
   * Handle sorting
   */
  const handleSort = useCallback(
    (columnKey: string) => {
      const newDirection =
        navigationState.sortColumn === columnKey && navigationState.sortDirection === 'asc'
          ? 'desc'
          : 'asc';

      setNavigationState(prev => ({
        ...prev,
        sortColumn: columnKey,
        sortDirection: newDirection,
      }));

      if (onSort) {
        onSort(columnKey, newDirection);
      }

      // Announce sort change
      const column = columns.find(col => col.key === columnKey);
      if (column) {
        announceAssertive(`Table sorted by ${column.label}, ${newDirection}ending order`);
      }
    },
    [navigationState, onSort, columns, announceAssertive]
  );

  /**
   * Handle bulk selection
   */
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (onRowSelect) {
        items.forEach(item => {
          onRowSelect(item.id, selected);
        });
      }

      // Announce bulk selection
      if (selected) {
        announceAssertive(`All ${items.length} items selected`);
      } else {
        announceAssertive('All items deselected');
      }
    },
    [items, onRowSelect, announceAssertive]
  );

  /**
   * Set up event listeners
   */
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    table.addEventListener('keydown', handleKeyDown);

    return () => {
      table.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Announce when page content changes
   */
  useEffect(() => {
    const selectedCount = selectedIds.size;
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalCount);

    announce(
      `Showing ${items.length} items from ${startIndex} to ${endIndex} of ${totalCount} total. ` +
        `${selectedCount > 0 ? `${selectedCount} items selected.` : ''}`
    );
  }, [items.length, currentPage, pageSize, totalCount, selectedIds.size, announce]);

  /**
   * Get ARIA props for table elements
   */
  const getTableProps = () => ({
    ref: tableRef,
    role: 'table',
    'aria-label': ariaLabel,
    'aria-rowcount': totalCount,
    'aria-colcount': columns.length,
    tabIndex: navigationState.focusedRow === -1 ? 0 : -1,
  });

  const getHeaderProps = () => ({
    role: 'rowgroup',
  });

  const getBodyProps = () => ({
    role: 'rowgroup',
  });

  const getRowProps = (index: number, item: TableItem) => ({
    role: 'row',
    'aria-rowindex': (currentPage - 1) * pageSize + index + 2, // +2 for 1-based index and header
    'aria-selected': selectedIds.has(item.id),
  });

  const getCellProps = (rowIndex: number, columnIndex: number, column: TableColumn) => ({
    role: columnIndex === 0 ? 'gridcell' : 'gridcell',
    'data-row-index': rowIndex,
    'data-column-index': columnIndex,
    'aria-colindex': columnIndex + 1,
    tabIndex:
      navigationState.focusedRow === rowIndex && navigationState.focusedColumn === columnIndex
        ? 0
        : -1,
    'aria-describedby': column.ariaLabel ? `col-${column.key}-desc` : undefined,
  });

  const getHeaderCellProps = (columnIndex: number, column: TableColumn) => ({
    role: 'columnheader',
    'aria-colindex': columnIndex + 1,
    'aria-sort':
      navigationState.sortColumn === column.key
        ? navigationState.sortDirection === 'asc'
          ? 'ascending'
          : 'descending'
        : column.sortable
          ? 'none'
          : undefined,
    tabIndex: column.sortable ? 0 : -1,
    onClick: column.sortable ? () => handleSort(column.key) : undefined,
    onKeyDown: column.sortable
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSort(column.key);
          }
        }
      : undefined,
  });

  const getCheckboxProps = (item: TableItem, isSelectAll = false) => ({
    'aria-label': isSelectAll
      ? `Select all ${items.length} items`
      : `Select ${item.title || item.name || 'item'}`,
    'aria-describedby': isSelectAll ? 'bulk-selection-desc' : undefined,
    checked: isSelectAll
      ? selectedIds.size === items.length && items.length > 0
      : selectedIds.has(item.id),
    onChange: isSelectAll
      ? (e: React.ChangeEvent<HTMLInputElement>) => handleSelectAll(e.target.checked)
      : (e: React.ChangeEvent<HTMLInputElement>) => {
          if (onRowSelect) {
            onRowSelect(item.id, e.target.checked, e.nativeEvent);
          }
        },
  });

  return {
    // Refs and state
    tableRef,
    navigationState,

    // Props getters
    getTableProps,
    getHeaderProps,
    getBodyProps,
    getRowProps,
    getCellProps,
    getHeaderCellProps,
    getCheckboxProps,

    // Action handlers
    handleSort,
    handleSelectAll,
    focusCell,

    // Accessibility helpers
    announce,
    announceAssertive,

    // Computed values
    selectedCount: selectedIds.size,
    isAllSelected: selectedIds.size === items.length && items.length > 0,
    isIndeterminate: selectedIds.size > 0 && selectedIds.size < items.length,
  };
}
