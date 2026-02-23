import { pgPool } from '@/lib/database/pool-postgres';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/utils/logger';

const execAsync = promisify(exec);

const GODOT_CLI_PATH = process.env.GODOT_CLI_PATH || '/usr/local/bin/godot';
const GODOT_PROJECTS_PATH =
  process.env.GODOT_PROJECTS_PATH || path.join(process.cwd(), 'godot-projects');
const GODOT_BUILDS_PATH =
  process.env.GODOT_BUILDS_PATH || path.join(process.cwd(), 'public', 'godot-builds');

export interface BuildStatus {
  versionId: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  buildPath?: string;
  error?: string;
  completedAt?: string;
}

export class GodotBuildService {
  /**
   * Trigger a build for a specific version
   * Returns immediately, build runs asynchronously
   */
  async triggerBuild(versionId: number): Promise<{ buildId: string; message: string }> {
    // Get version details
    const versionResult = await pgPool.query(
      `SELECT v.*, p.project_slug
       FROM godot_versions v
       JOIN godot_projects p ON v.project_slug = p.project_slug
       WHERE v.id = $1`,
      [versionId],
      'content'
    );

    if (versionResult.rows.length === 0) {
      throw new Error(`Version ${versionId} not found`);
    }

    const version = versionResult.rows[0];

    // Update status to 'building'
    await pgPool.query(
      'UPDATE godot_versions SET build_status = $1 WHERE id = $2',
      ['building', versionId],
      'content'
    );

    const buildId = `build-${versionId}-${Date.now()}`;

    // Trigger async build (don't await - returns immediately)
    this.executeBuild(versionId, version).catch(error => {
      logger.error(`[GodotBuildService] Build failed for version ${versionId}:`, error);
    });

    return {
      buildId,
      message: 'Build started in background',
    };
  }

  /**
   * Execute build asynchronously
   */
  private async executeBuild(versionId: number, version: any): Promise<void> {
    const projectPath = path.join(GODOT_PROJECTS_PATH, version.project_slug, version.version_tag);
    const buildOutputDir = path.join(GODOT_BUILDS_PATH, version.project_slug, version.version_tag);
    const buildOutputPath = path.join(buildOutputDir, 'index.html');

    logger.info(`[GodotBuildService] Starting build for version ${versionId}`);
    logger.info(`[GodotBuildService] Project path: ${projectPath}`);
    logger.info(`[GodotBuildService] Output path: ${buildOutputPath}`);

    try {
      // Ensure output directory exists
      await fs.mkdir(buildOutputDir, { recursive: true });

      // Run Godot headless HTML5 export
      const command = `"${GODOT_CLI_PATH}" --headless --path "${projectPath}" --export-release "Web" "${buildOutputPath}"`;

      logger.info(`[GodotBuildService] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });

      // Check for errors (some warnings are OK)
      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`Build error: ${stderr}`);
      }

      logger.info(`[GodotBuildService] Build completed successfully for version ${versionId}`);
      if (stdout) logger.info(`[GodotBuildService] Output: ${stdout.substring(0, 500)}`);

      // Verify output files exist
      const indexHtmlExists = await fs
        .stat(buildOutputPath)
        .then(() => true)
        .catch(() => false);

      if (!indexHtmlExists) {
        throw new Error(`Build output file not found: ${buildOutputPath}`);
      }

      // Update status to 'success' and store build path
      await pgPool.query(
        'UPDATE godot_versions SET build_status = $1, build_path = $2 WHERE id = $3',
        ['success', buildOutputDir, versionId],
        'content'
      );

      logger.info(`[GodotBuildService] Build status updated to success for version ${versionId}`);
    } catch (error) {
      logger.error(`[GodotBuildService] Build execution failed for version ${versionId}:`, error);

      // Update status to 'failed'
      await pgPool.query(
        'UPDATE godot_versions SET build_status = $1 WHERE id = $2',
        ['failed', versionId],
        'content'
      );

      throw error;
    }
  }

  /**
   * Get build status for a version
   */
  async getBuildStatus(versionId: number): Promise<BuildStatus> {
    const result = await pgPool.query(
      'SELECT id, build_status, build_path FROM godot_versions WHERE id = $1',
      [versionId],
      'content'
    );

    if (result.rows.length === 0) {
      throw new Error(`Version ${versionId} not found`);
    }

    const row = result.rows[0];
    return {
      versionId,
      status: row.build_status || 'pending',
      buildPath: row.build_path,
    };
  }
}

export const godotBuildService = new GodotBuildService();
