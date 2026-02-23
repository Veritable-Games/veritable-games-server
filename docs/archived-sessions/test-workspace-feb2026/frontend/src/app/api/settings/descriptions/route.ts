/**
 * Page Descriptions Settings API
 *
 * POST /api/settings/descriptions - Save a page description
 * GET /api/settings/descriptions?pageKey=contact - Get a page description
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/descriptions?pageKey=contact
 *
 * Get a page description by key
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const pageKey = searchParams.get('pageKey');

    if (!pageKey) {
      throw new ValidationError('pageKey is required');
    }

    const descriptionResult = await dbAdapter.query(
      `SELECT id, key, value, updated_at
       FROM settings
       WHERE key = $1`,
      [`description_${pageKey}`],
      { schema: 'system' }
    );
    const description = descriptionResult.rows[0] as
      | { id: number; key: string; value: string; updated_at: string }
      | undefined;

    return NextResponse.json({
      success: true,
      data: {
        pageKey,
        text: description?.value || null,
        updatedAt: description?.updated_at || null,
      },
    });
  } catch (error) {
    logger.error('Error fetching description:', error);
    return errorResponse(error);
  }
});

/**
 * POST /api/settings/descriptions
 *
 * Save a page description (admin only)
 *
 * Note: CSRF disabled for this endpoint as per October 2025 changes
 */
export const POST = withSecurity(
  async (request: NextRequest) => {
    try {
      // 1. Authenticate user (you may want to check for admin role here)
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthenticationError();
      }

      // 2. Parse and validate request body
      const body = await request.json();
      const { pageKey, text } = body;

      if (!pageKey || typeof pageKey !== 'string') {
        throw new ValidationError('pageKey is required and must be a string');
      }

      // Allow empty strings, but text must be provided and be a string
      if (text === undefined || text === null || typeof text !== 'string') {
        throw new ValidationError('text is required and must be a string');
      }

      if (text.length > 500) {
        throw new ValidationError('Description text must be 500 characters or less');
      }

      // Validate pageKey is one of the allowed pages
      const allowedPages = ['contact', 'news', 'projects', 'about'];
      if (!allowedPages.includes(pageKey)) {
        throw new ValidationError(`Invalid pageKey. Must be one of: ${allowedPages.join(', ')}`);
      }

      // 3. Save to database
      const settingKey = `description_${pageKey}`;

      // Check if setting exists
      const existingResult = await dbAdapter.query(
        'SELECT id FROM settings WHERE key = $1',
        [settingKey],
        { schema: 'system' }
      );
      const existing = existingResult.rows[0] as { id: number } | undefined;

      if (existing) {
        // Update existing
        await dbAdapter.query(
          `UPDATE settings
           SET value = $1, updated_at = NOW()
           WHERE key = $2`,
          [text, settingKey],
          { schema: 'system' }
        );
      } else {
        // Insert new
        await dbAdapter.query(
          `INSERT INTO settings (key, value, description, category, type, created_at, updated_at)
           VALUES ($1, $2, $3, 'pages', 'text', NOW(), NOW())`,
          [settingKey, text, `Description text for ${pageKey} page`],
          { schema: 'system' }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          pageKey,
          text,
        },
      });
    } catch (error) {
      logger.error('Error saving description:', error);
      return errorResponse(error);
    }
  },
  {} // Disable CSRF as per October 2025 security changes
);
