/**
 * GET /api/godot/versions/[id]/scripts - List all scripts for a version
 * PUT /api/godot/versions/[id]/scripts - Update a script's content
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { godotService } from '@/lib/godot/service';
import { godotGitService } from '@/lib/godot/git-service';
import { broadcastGraphUpdate } from '@/app/api/godot/versions/[id]/events/route';
import { AuthenticationError, errorResponse } from '@/lib/utils/api-errors';
import path from 'path';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering to prevent static prerendering of API routes
export const dynamic = 'force-dynamic';

async function getScripts(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    const params = await context.params;
    const versionId = parseInt(params.id);

    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');

    if (filePath) {
      // Get specific script
      logger.info(`[Scripts API] Fetching script: versionId=${versionId}, filePath=${filePath}`);
      const script = await godotService.getScript(versionId, filePath);

      if (!script) {
        logger.error(
          `[Scripts API] Script not found: versionId=${versionId}, filePath=${filePath}`
        );
        return NextResponse.json({ error: 'Script not found' }, { status: 404 });
      }

      logger.info(`[Scripts API] Found script, parsing JSON fields...`);

      // Helper to safely parse JSON fields
      const safeParse = (value: unknown, fieldName: string): any => {
        if (!value) return undefined;
        if (Array.isArray(value) || typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            logger.error(
              `[Scripts API] Failed to parse ${fieldName}: value: ${value.substring(0, 100)}`,
              e
            );
            return undefined;
          }
        }
        return undefined;
      };

      // Parse JSON fields from database
      const parsed = {
        ...script,
        dependencies: safeParse(script.dependencies, 'dependencies'),
        functions: safeParse(script.functions, 'functions'),
        signals: safeParse(script.signals, 'signals'),
        exports: safeParse(script.exports, 'exports'),
      };

      logger.info(`[Scripts API] Returning parsed script:`, {
        filePath: parsed.file_path,
        hasContent: !!parsed.content,
        hasDependencies: !!parsed.dependencies,
        hasFunctions: !!parsed.functions,
      });

      return NextResponse.json(parsed);
    } else {
      // Get all scripts
      const scripts = await godotService.getScripts(versionId);
      // Parse JSON fields for all scripts
      const parsed = scripts.map(script => ({
        ...script,
        dependencies:
          typeof script.dependencies === 'string'
            ? JSON.parse(script.dependencies)
            : script.dependencies,
        functions:
          typeof script.functions === 'string' ? JSON.parse(script.functions) : script.functions,
        signals: typeof script.signals === 'string' ? JSON.parse(script.signals) : script.signals,
        exports: typeof script.exports === 'string' ? JSON.parse(script.exports) : script.exports,
      }));
      return NextResponse.json(parsed);
    }
  } catch (error) {
    logger.error('Error fetching scripts:', error);
    return errorResponse(error);
  }
}

async function updateScripts(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      throw new AuthenticationError('Admin or developer access required');
    }

    const params = await context.params;
    const versionId = parseInt(params.id);

    const { filePath, content } = await request.json();

    if (!filePath || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: filePath, content' },
        { status: 400 }
      );
    }

    logger.info(`[API] Updating script: versionId=${versionId}, filePath=${filePath}`);

    // ============================================
    // PHASE 1: CRITICAL - Must succeed
    // ============================================
    logger.info(`[API] Phase 1: Updating database...`);

    // 1. Update script content in database
    const script = await godotService.updateScript(versionId, filePath, content);

    // 2. Reparse metadata (dependencies, functions, signals, exports)
    await godotService.reparseScript(versionId, filePath, content);

    // 3. Rebuild entire dependency graph
    await godotService.rebuildDependencyGraph(versionId);

    logger.info(`[API] Phase 1 complete: Database operations succeeded`);

    // ============================================
    // PHASE 2: BEST-EFFORT - Don't block on failure
    // ============================================
    logger.info(`[API] Phase 2: Starting async filesystem/git operations...`);

    const version = await godotService.getVersion(versionId);
    if (version) {
      const versionPath = path.join(
        process.env.GODOT_PROJECTS_PATH || './godot-projects',
        version.project_slug,
        version.version_tag
      );

      // Fire-and-forget: Sync to filesystem + Git commit
      Promise.all([
        // Sync to filesystem
        godotService.syncScriptToFilesystem(version, filePath, content).catch(err => {
          logger.error(`[API] Filesystem sync failed:`, err);
        }),

        // Git operations (initialize repo if needed, then commit)
        (async () => {
          try {
            await godotGitService.ensureProjectRepo(version.project_slug);
            await godotGitService.initVersionWorkTree(version.project_slug, versionPath);
            const scriptName = filePath.split('/').pop() || 'script';
            const result = await godotGitService.commitScriptChange(
              versionPath,
              version.version_tag,
              filePath,
              `Update ${scriptName}`
            );
            if (result.success) {
              logger.info(`[API] Git commit succeeded: ${result.commitHash}`);
            } else {
              logger.error(`[API] Git commit failed: ${result.error}`);
            }
          } catch (err) {
            logger.error(`[API] Git operations failed:`, err);
          }
        })(),

        // SSE broadcast: Notify connected clients of graph update
        (async () => {
          try {
            broadcastGraphUpdate(versionId.toString());
            logger.info(`[API] SSE broadcast sent for version ${versionId}`);
          } catch (err) {
            logger.error(`[API] SSE broadcast failed:`, err);
          }
        })(),
      ]).catch(err => {
        logger.error(`[API] Phase 2 error (non-blocking):`, err);
      });
    }

    logger.info(`[API] Update complete: Returning response`);
    return NextResponse.json({
      success: true,
      script,
      graphRebuilt: true,
      message: 'Script updated successfully. Async operations in progress.',
    });
  } catch (error) {
    logger.error('[API] Error updating script:', error);
    return errorResponse(error);
  }
}

export const GET = withSecurity(getScripts);
export const PUT = withSecurity(updateScripts);
