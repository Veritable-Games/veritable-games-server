/**
 * POST /api/godot/projects/[slug]/upload - Upload and extract a Godot project .zip file
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';
// @ts-ignore - adm-zip lacks TypeScript declarations
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/utils/logger';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

async function uploadProject(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      throw new AuthenticationError('Admin access required');
    }

    const params = await context.params;
    const { slug } = params;

    // Parse multipart form data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type. Expected multipart/form-data' },
        { status: 400 }
      );
    }

    // Check file size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const versionTag = formData.get('versionTag') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!versionTag) {
      return NextResponse.json({ error: 'No versionTag provided' }, { status: 400 });
    }

    // Validate file is zip
    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'File must be a .zip archive' }, { status: 400 });
    }

    // Check project exists
    const project = await godotService.getProject(slug);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Initialize directories
    await godotService.initializeDirectories();

    // Get version paths
    const { versionDir } = godotService.getVersionPaths(slug, versionTag);

    // Create version directory
    await fs.mkdir(versionDir, { recursive: true });

    // Save uploaded file temporarily
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract zip file
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      // Security check: prevent path traversal
      for (const entry of entries) {
        if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) {
          return NextResponse.json({ error: 'Invalid file path in archive' }, { status: 400 });
        }
      }

      // Extract all files
      zip.extractAllTo(versionDir, true);

      // Create database entry for version
      const version = await godotService.createVersion(slug, versionTag, versionDir);

      // Index all scripts and scenes in the version
      const { scripts, scenes } = await godotService.indexScripts(version.id, versionDir);

      return NextResponse.json(
        {
          version,
          scriptCount: scripts.length,
          sceneCount: scenes.length,
          message: `Successfully uploaded and indexed ${scripts.length} scripts and ${scenes.length} scenes`,
        },
        { status: 201 }
      );
    } catch (extractError) {
      // Clean up on extraction failure
      try {
        await fs.rm(versionDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw extractError;
    }
  } catch (error) {
    logger.error('Error uploading Godot project:', error);
    return errorResponse(error);
  }
}

export const POST = withSecurity(uploadProject);
