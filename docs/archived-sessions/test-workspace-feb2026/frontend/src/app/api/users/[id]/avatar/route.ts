import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { getUsersService } from '@/lib/services/registry';
import { withSecurity, rateLimiters, getClientIP } from '@/lib/security/middleware';
import { settingsService } from '@/lib/settings/service';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Avatar optimization settings
const AVATAR_MAX_SIZE = 512; // Max dimension (width or height)
const AVATAR_QUALITY = 85; // WebP quality (0-100)

async function uploadAvatarHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Users can only upload their own avatar (unless admin)
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to update this avatar' },
        { status: 403 }
      );
    }

    // Apply rate limiting only for non-admin users
    if (currentUser.role !== 'admin') {
      const clientIP = getClientIP(request);
      const rateLimitResult = await rateLimiters.fileUpload.check(`upload:avatar:${clientIP}`);

      if (!rateLimitResult.success) {
        // Check if file upload rate limiter is disabled in settings
        const isEnabled = await settingsService.getSetting('rateLimitFileUploadEnabled');
        if (!isEnabled) {
          logger.info('Avatar upload rate limit bypassed (disabled in settings)');
          // Continue with upload
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Rate limit exceeded',
              message: 'Too many upload attempts. Please try again later.',
              retryAfter: rateLimitResult.retryAfter,
            },
            {
              status: 429,
              headers: {
                'Retry-After': rateLimitResult.retryAfter?.toString() || '3600',
                'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '',
              },
            }
          );
        }
      }
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Enhanced file validation with magic number verification
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Read first few bytes to verify magic numbers (file signature)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const magicNumbers = buffer.subarray(0, 12);

    // Check magic numbers to prevent disguised malware
    const isValidImage =
      (magicNumbers[0] === 0xff && magicNumbers[1] === 0xd8 && magicNumbers[2] === 0xff) || // JPEG
      (magicNumbers[0] === 0x89 &&
        magicNumbers[1] === 0x50 &&
        magicNumbers[2] === 0x4e &&
        magicNumbers[3] === 0x47) || // PNG
      (magicNumbers[0] === 0x47 && magicNumbers[1] === 0x49 && magicNumbers[2] === 0x46) || // GIF
      (magicNumbers[0] === 0x52 &&
        magicNumbers[1] === 0x49 &&
        magicNumbers[2] === 0x46 &&
        magicNumbers[3] === 0x46 &&
        magicNumbers[8] === 0x57 &&
        magicNumbers[9] === 0x45 &&
        magicNumbers[10] === 0x42 &&
        magicNumbers[11] === 0x50); // WebP

    if (!isValidImage) {
      return NextResponse.json(
        {
          success: false,
          error: 'File content does not match image format. Potential security risk detected.',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Generate unique filename (always .webp after optimization)
    const timestamp = Date.now();
    const randomString = randomBytes(8).toString('hex');
    const filename = `avatar-${userId}-${timestamp}-${randomString}.webp`;

    // Ensure upload directory exists in protected location
    const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    // Optimize image with Sharp:
    // - Resize to max 512x512 (maintains aspect ratio)
    // - Convert to WebP for ~70% smaller file size
    // - Strip metadata for privacy
    const optimizedBuffer = await sharp(buffer)
      .resize(AVATAR_MAX_SIZE, AVATAR_MAX_SIZE, {
        fit: 'inside', // Maintain aspect ratio, fit within bounds
        withoutEnlargement: true, // Don't upscale small images
      })
      .webp({ quality: AVATAR_QUALITY })
      .toBuffer();

    // Write optimized file
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, optimizedBuffer);

    // Update user avatar URL in database (will be served via API)
    const avatarUrl = `/api/users/${userId}/avatar/serve?file=${filename}`;
    const userService = getUsersService();
    const updatedUser = await userService.updateUser(
      userId,
      { avatar_url: avatarUrl },
      currentUser.id
    );

    return NextResponse.json({
      success: true,
      data: {
        avatar_url: avatarUrl,
        user: updatedUser,
      },
      message: 'Avatar uploaded successfully',
    });
  } catch (error: unknown) {
    // Log detailed error for debugging
    if (error instanceof Error) {
      logger.error('Avatar upload error:', error.message);
      logger.error('Stack:', error.stack);
    } else {
      logger.error('Avatar upload error (non-Error):', String(error));
    }
    return NextResponse.json({ success: false, error: 'Failed to upload avatar' }, { status: 500 });
  }
}

// Apply security middleware (rate limiting handled inside handler to exempt admins)
export const POST = withSecurity(uploadAvatarHandler);
