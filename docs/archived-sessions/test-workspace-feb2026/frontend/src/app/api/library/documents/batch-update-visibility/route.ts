import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';
import {
  errorResponse,
  AuthenticationError,
  PermissionError,
  ValidationError,
} from '@/lib/utils/api-errors';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function POSTHandler(request: NextRequest) {
  try {
    // Authentication check
    const user = await getCurrentUser();
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    // Authorization check - only admin/moderator can toggle visibility
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new PermissionError('Insufficient permissions. Admin or moderator role required.');
    }

    const body = await request.json();
    const { documentIds, isPublic, source } = body;

    // Validation
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds must be a non-empty array');
    }

    if (typeof isPublic !== 'boolean') {
      throw new ValidationError('isPublic must be a boolean');
    }

    if (!['library', 'anarchist'].includes(source)) {
      throw new ValidationError('source must be "library" or "anarchist"');
    }

    // Determine table and schema
    const table = source === 'library' ? 'library_documents' : 'documents';
    const schema = source === 'library' ? 'library' : 'anarchist';

    // Build parameterized query
    const placeholders = documentIds.map((_, i) => `$${i + 2}`).join(', ');
    const query = `
      UPDATE ${table}
      SET is_public = $1
      WHERE id IN (${placeholders})
    `;

    const params = [isPublic, ...documentIds];

    // Execute update
    const result = await dbAdapter.query(query, params, { schema });

    // Audit log
    logger.info(
      `[ADMIN] User ${user.username} (${user.id}) toggled visibility for ${documentIds.length} documents (${source}) to is_public=${isPublic}`
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${result.rowCount || documentIds.length} document(s)`,
      updated: result.rowCount || documentIds.length,
    });
  } catch (error) {
    logger.error('[API] Error updating document visibility:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(POSTHandler);
