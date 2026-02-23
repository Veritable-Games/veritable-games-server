import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, ValidationError, PermissionError } from '@/lib/utils/api-errors';
import { getServerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/page-headers
 * Update page header title or description (admin only)
 */
export const PUT = withSecurity(async (request: NextRequest) => {
  try {
    const session = await getServerSession();

    // Only admins can edit page headers
    if (!session || session.role !== 'admin') {
      throw new PermissionError('Admin access required');
    }

    const body = await request.json();
    const { pageSlug, field, value } = body;

    // Validate input
    if (!pageSlug) throw new ValidationError('Page slug is required');
    if (!field) throw new ValidationError('Field is required');
    if (field !== 'title' && field !== 'description') {
      throw new ValidationError('Field must be "title" or "description"');
    }
    if (typeof value !== 'string') throw new ValidationError('Value must be a string');

    // Check if page header exists
    const existing = await dbAdapter.query(
      'SELECT * FROM page_headers WHERE page_slug = ?',
      [pageSlug],
      { schema: 'system' }
    );

    if (existing.rows.length > 0) {
      // Update existing header
      await dbAdapter.query(
        `UPDATE page_headers SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE page_slug = ?`,
        [value, pageSlug],
        { schema: 'system' }
      );
    } else {
      // Insert new header
      await dbAdapter.query(
        'INSERT INTO page_headers (page_slug, title, description) VALUES (?, ?, ?)',
        [pageSlug, field === 'title' ? value : '', field === 'description' ? value : ''],
        { schema: 'system' }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Page ${field} updated successfully`,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
