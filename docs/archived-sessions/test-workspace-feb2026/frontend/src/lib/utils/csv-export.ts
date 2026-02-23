/**
 * CSV Export Utilities
 * Centralized CSV generation for transparency dashboard
 */

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any) => string;
}

export interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: any[];
}

/**
 * Generate CSV string from data
 */
export function generateCSV(options: ExportOptions): string {
  const { columns, data } = options;

  // Header row
  const headers = columns.map(col => col.header).join(',');

  // Data rows
  const rows = data.map(item => {
    return columns
      .map(col => {
        const value = item[col.key];
        const formatted = col.format ? col.format(value) : String(value ?? '');

        // Escape CSV values (RFC 4180)
        if (formatted.includes(',') || formatted.includes('"') || formatted.includes('\n')) {
          return `"${formatted.replace(/"/g, '""')}"`;
        }
        return formatted;
      })
      .join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(options: ExportOptions): void {
  const csv = generateCSV(options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Export campaigns to CSV
 */
export async function exportCampaigns(filters?: {
  includeInactive?: boolean;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.includeInactive !== undefined) {
    params.set('include_inactive', String(filters.includeInactive));
  }
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);

  const response = await fetch(`/api/admin/campaigns?${params}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch campaigns');
  }

  downloadCSV({
    filename: `campaigns_${new Date().toISOString().split('T')[0]}.csv`,
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'title', header: 'Title' },
      { key: 'target_amount', header: 'Target Amount', format: v => `$${v.toFixed(2)}` },
      { key: 'current_amount', header: 'Current Amount', format: v => `$${v.toFixed(2)}` },
      {
        key: 'progress_percentage',
        header: 'Progress %',
        format: v => `${v.toFixed(1)}%`,
      },
      { key: 'start_date', header: 'Start Date' },
      { key: 'end_date', header: 'End Date' },
      { key: 'is_active', header: 'Is Active', format: v => (v ? 'Yes' : 'No') },
      { key: 'is_recurring', header: 'Is Recurring', format: v => (v ? 'Yes' : 'No') },
    ],
    data: result.data,
  });
}

/**
 * Export expenses to CSV
 */
export async function exportExpenses(filters?: {
  categoryId?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.categoryId) params.set('category_id', String(filters.categoryId));
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);

  const response = await fetch(`/api/admin/expenses?${params}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch expenses');
  }

  downloadCSV({
    filename: `expenses_${new Date().toISOString().split('T')[0]}.csv`,
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'expense_date', header: 'Date' },
      { key: 'category_name', header: 'Category' },
      { key: 'amount', header: 'Amount', format: v => `$${v.toFixed(2)}` },
      { key: 'currency', header: 'Currency' },
      { key: 'description', header: 'Description' },
      { key: 'receipt_url', header: 'Receipt URL' },
      { key: 'is_recurring', header: 'Is Recurring', format: v => (v ? 'Yes' : 'No') },
    ],
    data: result.data,
  });
}

/**
 * Export categories to CSV
 */
export async function exportCategories(): Promise<void> {
  const response = await fetch('/api/admin/expenses/categories');
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch categories');
  }

  downloadCSV({
    filename: `expense_categories_${new Date().toISOString().split('T')[0]}.csv`,
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'slug', header: 'Slug' },
      { key: 'description', header: 'Description' },
      { key: 'color', header: 'Color' },
      { key: 'display_order', header: 'Display Order' },
      { key: 'is_active', header: 'Is Active', format: v => (v ? 'Yes' : 'No') },
    ],
    data: result.data,
  });
}

/**
 * Export donations to CSV
 */
export async function exportDonations(filters?: {
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.paymentStatus) params.set('payment_status', filters.paymentStatus);
  if (filters?.startDate) params.set('start_date', filters.startDate);
  if (filters?.endDate) params.set('end_date', filters.endDate);

  const response = await fetch(`/api/admin/donations?${params}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch donations');
  }

  downloadCSV({
    filename: `donations_${new Date().toISOString().split('T')[0]}.csv`,
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'donor_name', header: 'Donor Name' },
      { key: 'amount', header: 'Amount', format: v => `$${Number(v).toFixed(2)}` },
      { key: 'currency', header: 'Currency' },
      {
        key: 'project_names',
        header: 'Projects',
        format: v => (Array.isArray(v) ? v.join('; ') : ''),
      },
      { key: 'payment_processor', header: 'Payment Method' },
      { key: 'payment_status', header: 'Status' },
      { key: 'message', header: 'Message' },
      { key: 'completed_at', header: 'Completed Date', format: v => v || 'N/A' },
      { key: 'is_anonymous', header: 'Anonymous', format: v => (v ? 'Yes' : 'No') },
    ],
    data: result.data,
  });
}
