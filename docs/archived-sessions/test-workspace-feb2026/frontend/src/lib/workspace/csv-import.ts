/**
 * Workspace CSV Import Utility
 *
 * Handles importing CSV files (like Miro exports) into the workspace as text nodes.
 * Creates a grid layout to prevent node overlaps.
 *
 * @example
 * // Miro CSV format:
 * "Frame 1"
 * "Item 1 text"
 * "Item 2 text"
 * "Item 3 text"
 */

import { CanvasNode, Point, Size } from './types';
import { NodeId } from './branded-types';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CSVImportOptions {
  /**
   * Number of columns in the grid layout
   * @default 10
   */
  columns?: number;

  /**
   * Horizontal spacing between nodes (in canvas units)
   * @default 250
   */
  horizontalSpacing?: number;

  /**
   * Vertical spacing between nodes (in canvas units)
   * @default 200
   */
  verticalSpacing?: number;

  /**
   * Default width for created nodes
   * @default 200
   */
  nodeWidth?: number;

  /**
   * Default height for created nodes
   * @default 150
   */
  nodeHeight?: number;

  /**
   * Skip rows that match this pattern (e.g., /^"?Frame \d+"?$/i for Miro frame headers)
   * @default null
   */
  skipPattern?: RegExp | null;

  /**
   * Treat first row as header (skip it)
   * @default true
   */
  skipFirstRow?: boolean;
}

export interface CSVImportResult {
  nodes: Partial<CanvasNode>[];
  rowCount: number;
  skippedCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<CSVImportOptions> = {
  columns: 10,
  horizontalSpacing: 250,
  verticalSpacing: 200,
  nodeWidth: 200,
  nodeHeight: 150,
  skipPattern: null,
  skipFirstRow: true,
};

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse CSV text into rows, handling quoted fields
 *
 * Simple CSV parser that handles:
 * - Quoted fields with commas inside
 * - Escaped quotes (double quotes)
 * - Multi-line quoted fields
 *
 * @param csvText - Raw CSV text
 * @returns Array of rows (each row is an array of fields)
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  // Remove BOM if present
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote (double quotes)
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (!insideQuotes) {
      if (char === ',') {
        // End of field
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      }

      if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // End of row
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';

        // Skip \r\n or just \n
        i += char === '\r' ? 2 : 1;
        continue;
      }

      if (char === '\r') {
        // Mac-style line ending
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }
    }

    // Regular character
    currentField += char;
    i++;
  }

  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Extract text content from CSV row
 *
 * For single-column CSVs (like Miro exports), just returns the first field.
 * For multi-column CSVs, joins fields with " | " separator.
 *
 * @param row - Array of CSV fields
 * @returns Combined text content
 */
export function extractRowText(row: string[]): string {
  if (row.length === 0) return '';
  if (row.length === 1) return row[0] || '';

  // Multi-column: join with separator
  return row.filter(field => field.length > 0).join(' | ');
}

// ============================================================================
// Grid Layout
// ============================================================================

/**
 * Calculate grid position for a node based on index
 *
 * @param index - Node index (0-based)
 * @param columns - Number of columns in grid
 * @param horizontalSpacing - Spacing between columns
 * @param verticalSpacing - Spacing between rows
 * @param viewportCenter - Center position for the grid
 * @returns Position for the node
 */
export function calculateGridPosition(
  index: number,
  columns: number,
  horizontalSpacing: number,
  verticalSpacing: number,
  viewportCenter: Point
): Point {
  const col = index % columns;
  const row = Math.floor(index / columns);

  // Calculate position relative to viewport center
  // Center the grid around viewport center
  const totalWidth = (columns - 1) * horizontalSpacing;
  const startX = viewportCenter.x - totalWidth / 2;
  const startY = viewportCenter.y;

  return {
    x: startX + col * horizontalSpacing,
    y: startY + row * verticalSpacing,
  };
}

// ============================================================================
// Tiptap Content Generation
// ============================================================================

/**
 * Create node content from plain text
 *
 * @param text - Plain text to convert
 * @returns NodeContent object with text and markdown
 */
export function createNodeContent(text: string): {
  text: string;
  markdown: string;
} {
  return {
    text: text,
    markdown: text,
  };
}

// ============================================================================
// CSV Import
// ============================================================================

/**
 * Import CSV file as text nodes arranged in a grid
 *
 * @param csvText - Raw CSV text content
 * @param viewportCenter - Center position for the grid
 * @param options - Import options (grid layout, spacing, etc.)
 * @returns Import result with created nodes
 */
export function importFromCSV(
  csvText: string,
  viewportCenter: Point,
  options: CSVImportOptions = {}
): CSVImportResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logger.info('[CSV Import] Starting CSV import', {
    viewportCenter,
    options: opts,
  });

  // Parse CSV
  const rows = parseCSV(csvText);
  logger.info(`[CSV Import] Parsed ${rows.length} rows`);

  // Filter rows
  let processedRows = rows;
  let skippedCount = 0;

  // Skip first row if it's a header
  if (opts.skipFirstRow && processedRows.length > 0) {
    processedRows = processedRows.slice(1);
    skippedCount++;
    logger.info('[CSV Import] Skipped first row (header)');
  }

  // Filter by pattern (e.g., skip "Frame 1" rows)
  if (opts.skipPattern) {
    const before = processedRows.length;
    processedRows = processedRows.filter(row => {
      const text = extractRowText(row);
      return !opts.skipPattern!.test(text);
    });
    const filtered = before - processedRows.length;
    skippedCount += filtered;
    logger.info(`[CSV Import] Filtered ${filtered} rows matching pattern`);
  }

  // Remove empty rows
  const before = processedRows.length;
  processedRows = processedRows.filter(row => {
    const text = extractRowText(row);
    return text.length > 0;
  });
  const emptyRows = before - processedRows.length;
  skippedCount += emptyRows;
  logger.info(`[CSV Import] Removed ${emptyRows} empty rows`);

  // Create nodes
  const nodes: Partial<CanvasNode>[] = processedRows.map((row, index) => {
    const text = extractRowText(row);
    const position = calculateGridPosition(
      index,
      opts.columns,
      opts.horizontalSpacing,
      opts.verticalSpacing,
      viewportCenter
    );

    const node: Partial<CanvasNode> = {
      id: crypto.randomUUID() as NodeId,
      position,
      size: {
        width: opts.nodeWidth,
        height: opts.nodeHeight,
      },
      content: createNodeContent(text),
      metadata: {
        nodeType: 'text',
        source: 'csv-import',
        importedAt: new Date().toISOString(),
      },
      style: {},
      z_index: 0,
    };

    return node;
  });

  logger.info('[CSV Import] Created nodes:', {
    total: nodes.length,
    skipped: skippedCount,
    gridColumns: opts.columns,
  });

  return {
    nodes,
    rowCount: rows.length,
    skippedCount,
  };
}

// ============================================================================
// File Reading
// ============================================================================

/**
 * Read CSV file from input element
 *
 * @param file - File object from input element
 * @returns Promise resolving to CSV text content
 */
export function readCSVFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.csv')) {
      reject(new Error('Invalid file type: Expected .csv file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = event => {
      try {
        const csvText = event.target?.result as string;
        resolve(csvText);
      } catch (error) {
        reject(
          new Error(
            `Failed to read CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
