import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Library annotation edit structure
 */
interface LibraryAnnotation {
  status: 'needs-edit' | 'comparing' | 'verified' | 'amended';
  startOffset: number;
  endOffset: number;
  text: string;
  timestamp: string | number;
}

/**
 * Annotations payload structure
 * Object where keys are page slugs and values are arrays of edits
 */
interface AnnotationsPayload {
  [pageSlug: string]: LibraryAnnotation[];
}

// API endpoint to retrieve all library annotations for Claude to see
export async function GET() {
  try {
    // Note: This endpoint would ideally read from a server-side storage
    // For now, we'll create a mechanism for the client to send annotations here

    return NextResponse.json({
      message: 'Library annotations endpoint ready',
      instructions:
        'Annotations are stored client-side in localStorage. Use the dev panel to view them.',
    });
  } catch (error) {
    logger.error('Error in annotations API:', error);
    return NextResponse.json({ error: 'Failed to retrieve annotations' }, { status: 500 });
  }
}

// Allow posting annotations from client to server for Claude to see
async function postHandler(request: NextRequest) {
  try {
    const annotations = (await request.json()) as AnnotationsPayload;

    logger.info('=== LIBRARY ANNOTATIONS RECEIVED ===');
    logger.info('Timestamp:', new Date().toISOString());
    logger.info('Total pages with annotations:', Object.keys(annotations).length);

    Object.entries(annotations).forEach(([pageSlug, edits]) => {
      const editArray = edits;
      logger.info(`\n📄 Page: ${pageSlug}`);
      logger.info(`📊 Total annotations: ${editArray.length}`);

      editArray.forEach((edit, index) => {
        const statusEmojiMap: Record<string, string> = {
          'needs-edit': '🔴',
          comparing: '🟡',
          verified: '🟢',
          amended: '🔵',
        };
        const statusEmoji = statusEmojiMap[edit.status] || '⚪';

        logger.info(`\n${statusEmoji} Annotation ${index + 1}: ${edit.status}`);
        logger.info(
          `📍 Position: ${edit.startOffset}-${edit.endOffset} (${edit.text.length} chars)`
        );
        logger.info(`📝 Text: "${edit.text}"`);
        logger.info(`🕐 Created: ${new Date(edit.timestamp).toLocaleString()}`);
      });
    });

    const totalEdits = Object.values(annotations).flat().length;
    const statusCounts = Object.values(annotations)
      .flat()
      .reduce(
        (acc, edit) => {
          acc[edit.status] = (acc[edit.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    logger.info(`\n📋 SUMMARY:`);
    logger.info(`Total annotations: ${totalEdits}`);
    logger.info(`Status breakdown:`, statusCounts);
    logger.info('=== END LIBRARY ANNOTATIONS ===');

    return NextResponse.json({
      success: true,
      message: 'Annotations logged to server console',
      summary: {
        totalPages: Object.keys(annotations).length,
        totalAnnotations: totalEdits,
        statusCounts,
      },
    });
  } catch (error) {
    logger.error('Error processing annotations:', error);
    return NextResponse.json({ error: 'Failed to process annotations' }, { status: 500 });
  }
}

// Apply security middleware for POST requests
export const POST = withSecurity(postHandler, {
  enableCSRF: true, // POST request needs CSRF
});
