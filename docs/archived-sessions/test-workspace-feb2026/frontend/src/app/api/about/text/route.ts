import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import {
  errorResponse,
  ValidationError,
  PermissionError,
  DatabaseError,
} from '@/lib/utils/api-errors';
import { logger } from '@/lib/utils/logger';
import { getCurrentUser } from '@/lib/auth/server';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// GET /api/about/text - Fetch text setting by key
async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return errorResponse(new ValidationError('key parameter is required'));
    }

    const settingKey = `about_${key}`;

    const result = await dbAdapter.query<{ value: string }>(
      `SELECT value FROM settings WHERE key = $1`,
      [settingKey],
      { schema: 'system' }
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ key, value: null });
    }

    return NextResponse.json({ key, value: result.rows[0]!.value });
  } catch (error) {
    logger.error('Error fetching about text:', error);
    return errorResponse(new DatabaseError('Failed to fetch text setting', error as Error));
  }
}

// POST /api/about/text - Update text setting
async function postHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return errorResponse(new ValidationError('key and value are required'));
    }

    // Validate key
    const allowedKeys = ['title', 'mission', 'commission_intro'];
    if (!allowedKeys.includes(key)) {
      return errorResponse(new ValidationError(`Invalid key. Allowed: ${allowedKeys.join(', ')}`));
    }

    const settingKey = `about_${key}`;

    // Check if setting exists
    const existing = await dbAdapter.query<{ key: string }>(
      `SELECT key FROM settings WHERE key = $1`,
      [settingKey],
      { schema: 'system' }
    );

    if (existing.rows.length > 0) {
      // Update existing
      await dbAdapter.query(
        `UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2`,
        [value, settingKey],
        { schema: 'system' }
      );
    } else {
      // Insert new
      await dbAdapter.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)`,
        [settingKey, value],
        { schema: 'system' }
      );
    }

    logger.info(`About text updated: ${settingKey}`);

    return NextResponse.json({ message: 'Text setting updated successfully' });
  } catch (error) {
    logger.error('Error updating about text:', error);
    return errorResponse(new DatabaseError('Failed to update text setting', error as Error));
  }
}

export const GET = withSecurity(getHandler, { enableCSRF: false });
export const POST = withSecurity(postHandler, { enableCSRF: true });
