/**
 * Godot MCP Router - CWD-Based Version Detection (Phase 2)
 *
 * Automatically detects the Godot project version from the current working
 * directory without requiring explicit versionId parameters.
 *
 * Detection Algorithm:
 * 1. Read CWD from environment (PWD or process.cwd())
 * 2. Check if CWD is within GODOT_PROJECTS_PATH
 * 3. Extract project_slug and version_tag from relative path
 *    Example: /godot-projects/noxii/0.16/scripts -> project_slug=noxii, version_tag=0.16
 * 4. Verify project.godot exists in the version directory
 * 5. Query database for versionId
 */

import path from 'path';
import fs from 'fs';
import { dbPool } from '../../godot/dist/utils/db-client.js';

const GODOT_PROJECTS_PATH = process.env.GODOT_PROJECTS_PATH || '/home/user/mnt/godot-projects';

export interface DetectionResult {
  versionId: number | null;
  projectSlug: string | null;
  versionTag: string | null;
  detectedPath: string | null;
  basePath: string;
  currentPath: string;
  isInProjectDirectory: boolean;
  projectRootExists: boolean;
  projectGodotExists: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  debugInfo: string[];
}

/**
 * Detect Godot version from current working directory
 *
 * Returns null if detection fails - caller should require explicit versionId
 */
export async function detectVersionFromCwd(): Promise<DetectionResult> {
  const debugInfo: string[] = [];
  const currentPath = process.env.PWD || process.cwd();
  const basePath = GODOT_PROJECTS_PATH;

  debugInfo.push(`CWD: ${currentPath}`);
  debugInfo.push(`Base: ${basePath}`);

  // 1. Check if CWD is within base path
  if (!currentPath.startsWith(basePath)) {
    debugInfo.push('❌ CWD not within GODOT_PROJECTS_PATH');
    return {
      versionId: null,
      projectSlug: null,
      versionTag: null,
      detectedPath: null,
      basePath,
      currentPath,
      isInProjectDirectory: false,
      projectRootExists: false,
      projectGodotExists: false,
      confidence: 'none',
      debugInfo,
    };
  }

  debugInfo.push('✅ CWD is within GODOT_PROJECTS_PATH');

  // 2. Extract relative path and segments
  const relativePath = path.relative(basePath, currentPath);
  const segments = relativePath.split(path.sep);

  debugInfo.push(`Relative path: ${relativePath}`);
  debugInfo.push(`Path segments: [${segments.join(', ')}]`);

  // Need at least project_slug and version_tag (2 segments)
  if (segments.length < 2) {
    debugInfo.push('❌ Path too shallow - need at least 2 segments (project_slug/version_tag)');
    return {
      versionId: null,
      projectSlug: null,
      versionTag: null,
      detectedPath: null,
      basePath,
      currentPath,
      isInProjectDirectory: false,
      projectRootExists: false,
      projectGodotExists: false,
      confidence: 'none',
      debugInfo,
    };
  }

  const projectSlug = segments[0];
  const versionTag = segments[1];

  debugInfo.push(`✅ Extracted: project_slug="${projectSlug}", version_tag="${versionTag}"`);

  // 3. Verify project.godot exists
  const projectRoot = path.join(basePath, projectSlug, versionTag);
  const projectGodotPath = path.join(projectRoot, 'project.godot');

  debugInfo.push(`Project root: ${projectRoot}`);
  debugInfo.push(`Checking for: ${projectGodotPath}`);

  const projectRootExists = fs.existsSync(projectRoot);
  const projectGodotExists = fs.existsSync(projectGodotPath);

  debugInfo.push(`Project root exists: ${projectRootExists}`);
  debugInfo.push(`project.godot exists: ${projectGodotExists}`);

  if (!projectGodotExists) {
    debugInfo.push('❌ project.godot not found - not a valid Godot project');
    return {
      versionId: null,
      projectSlug,
      versionTag,
      detectedPath: projectRoot,
      basePath,
      currentPath,
      isInProjectDirectory: true,
      projectRootExists,
      projectGodotExists: false,
      confidence: 'low',
      debugInfo,
    };
  }

  debugInfo.push('✅ project.godot found - valid Godot project');

  // 4. Query database for versionId
  try {
    const connection = await dbPool.getConnection('content');
    try {
      const result = await connection.query(
        `SELECT id FROM godot_versions
         WHERE project_slug = $1 AND version_tag = $2
         LIMIT 1`,
        [projectSlug, versionTag]
      );

      if (result.rows.length === 0) {
        debugInfo.push(`❌ Version not found in database: ${projectSlug}/${versionTag}`);
        return {
          versionId: null,
          projectSlug,
          versionTag,
          detectedPath: projectRoot,
          basePath,
          currentPath,
          isInProjectDirectory: true,
          projectRootExists,
          projectGodotExists,
          confidence: 'medium',
          debugInfo,
        };
      }

      const versionId = result.rows[0].id;
      debugInfo.push(`✅ Found versionId in database: ${versionId}`);

      return {
        versionId,
        projectSlug,
        versionTag,
        detectedPath: projectRoot,
        basePath,
        currentPath,
        isInProjectDirectory: true,
        projectRootExists,
        projectGodotExists,
        confidence: 'high',
        debugInfo,
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    debugInfo.push(`❌ Database error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      versionId: null,
      projectSlug,
      versionTag,
      detectedPath: projectRoot,
      basePath,
      currentPath,
      isInProjectDirectory: true,
      projectRootExists,
      projectGodotExists,
      confidence: 'medium',
      debugInfo,
    };
  }
}

/**
 * Get detected version with caching (5 minute TTL)
 * Reduces repeated detection calls during a single session
 */
let cachedResult: DetectionResult | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function detectVersionFromCwdCached(): Promise<DetectionResult> {
  const now = Date.now();

  // Return cached result if still valid
  if (cachedResult && now - cacheTimestamp < CACHE_TTL) {
    return cachedResult;
  }

  // Cache miss or expired - detect fresh
  cachedResult = await detectVersionFromCwd();
  cacheTimestamp = now;
  return cachedResult;
}

/**
 * Clear detection cache (useful for testing)
 */
export function clearDetectionCache(): void {
  cachedResult = null;
  cacheTimestamp = 0;
}

/**
 * Format detection result for display
 */
export function formatDetectionResult(result: DetectionResult): string {
  const lines: string[] = [];
  lines.push('┌─ CWD Detection Result ─┐');
  lines.push(`│ Confidence: ${result.confidence.toUpperCase()}`);

  if (result.versionId !== null) {
    lines.push(
      `│ ✅ Detected: ${result.projectSlug}/${result.versionTag} (versionId=${result.versionId})`
    );
  } else {
    lines.push(`│ ❌ Detection Failed`);
    if (result.projectSlug) {
      lines.push(`│ Project: ${result.projectSlug}/${result.versionTag}`);
    }
  }

  lines.push(`│ CWD: ${result.currentPath}`);
  lines.push('├─ Debug Info ──────────┤');
  result.debugInfo.forEach(info => {
    lines.push(`│ ${info}`);
  });
  lines.push('└────────────────────────┘');

  return lines.join('\n');
}

/**
 * Get resolved versionId - prefer explicit parameter over detection
 */
export async function resolveVersionId(
  explicitVersionId: number | undefined
): Promise<number | null> {
  // Explicit versionId takes highest priority
  if (explicitVersionId !== undefined) {
    return explicitVersionId;
  }

  // Try detection
  const detected = await detectVersionFromCwdCached();
  return detected.versionId;
}
