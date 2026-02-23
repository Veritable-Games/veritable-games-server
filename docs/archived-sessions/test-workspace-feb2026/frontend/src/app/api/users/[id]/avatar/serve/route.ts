import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Serve avatar images from protected directory
 * This endpoint serves avatar files that are stored outside the public directory
 * for better security control.
 */
async function serveAvatarHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return new NextResponse(null, { status: 404 });
    }

    // Get the filename from query parameters
    const url = new URL(request.url);
    const filename = url.searchParams.get('file');

    if (!filename) {
      return new NextResponse(null, { status: 404 });
    }

    // Validate filename to prevent path traversal attacks
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      !filename.match(/^avatar-\d+-\d+-[a-f0-9]+\.(jpg|jpeg|png|gif|webp)$/i)
    ) {
      logger.warn('Invalid avatar filename attempt:', filename);
      return new NextResponse(null, { status: 400 });
    }

    // Construct safe file path
    const filePath = path.join(process.cwd(), 'data', 'uploads', 'avatars', filename);

    try {
      // Check if file exists
      await access(filePath, constants.F_OK);

      // Read the file
      const fileBuffer = await readFile(filePath);

      // Determine content type based on extension
      const ext = path.extname(filename).toLowerCase();
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.webp'
                ? 'image/webp'
                : 'application/octet-stream';

      // Return the image with appropriate headers
      // Long cache since filename includes timestamp (immutable content)
      // Buffer extends Uint8Array, which is compatible with NextResponse BodyInit
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      });
    } catch (error) {
      // File not found
      return new NextResponse(null, { status: 404 });
    }
  } catch (error) {
    logger.error('Avatar serve error:', error);
    return new NextResponse(null, { status: 500 });
  }
}

// Apply security middleware
export const GET = withSecurity(serveAvatarHandler, {});
