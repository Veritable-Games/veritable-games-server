/**
 * API Route: Delete Anarchist Document
 * DELETE /api/documents/anarchist/[slug]
 *
 * Deletes an anarchist library document
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { anarchistService } from '@/lib/anarchist/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * DELETE handler for anarchist documents
 */
export const DELETE = withSecurity(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    try {
      const user = await getCurrentUser();

      // Check admin permission
      if (!user || user.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        );
      }

      const params = await context.params;
      const slug = decodeURIComponent(params.slug);

      if (!slug) {
        return NextResponse.json(
          { success: false, error: 'Document slug is required' },
          { status: 400 }
        );
      }

      // Delete the document
      await anarchistService.deleteDocument(slug);

      return NextResponse.json({
        success: true,
        message: `Document "${slug}" deleted successfully`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[API] Delete anarchist document error:', {
        message: errorMessage,
        error,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Failed to delete document',
        },
        { status: 500 }
      );
    }
  }
);

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
