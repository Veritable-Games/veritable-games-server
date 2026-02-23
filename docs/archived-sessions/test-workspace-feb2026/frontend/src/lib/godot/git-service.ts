/**
 * GodotGitService
 * Manages local git repositories for Godot projects
 * One bare repo per project, all versions as working trees
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/utils/logger';

const execAsync = promisify(exec);

/**
 * Node.js system error with error code
 */
interface NodeSystemError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
}

export class GodotGitService {
  private repoBasePath = process.env.GODOT_GIT_REPOS_PATH || '/data/projects/.git-repos';

  /**
   * Ensure bare git repository exists for project
   */
  async ensureProjectRepo(projectSlug: string): Promise<void> {
    const repoPath = path.join(this.repoBasePath, `${projectSlug}.git`);

    try {
      // Check if repo already exists
      const stat = await fs.stat(repoPath);
      if (!stat.isDirectory()) {
        throw new Error(`${repoPath} exists but is not a directory`);
      }
      logger.info(`[Git] Repo already exists: ${repoPath}`);
    } catch (err) {
      // Repo doesn't exist, create it
      const systemErr = err as NodeSystemError;
      if (systemErr.code === 'ENOENT') {
        logger.info(`[Git] Creating bare repo at ${repoPath}`);
        await fs.mkdir(repoPath, { recursive: true });
        try {
          await execAsync('git init --bare', { cwd: repoPath });
          logger.info(`[Git] Initialized bare repo: ${projectSlug}.git`);
        } catch (gitErr) {
          logger.error(`[Git] Failed to initialize bare repo:`, gitErr);
          throw gitErr;
        }
      } else {
        throw err;
      }
    }
  }

  /**
   * Initialize working tree for version (git init + remote setup)
   */
  async initVersionWorkTree(projectSlug: string, versionPath: string): Promise<void> {
    const repoPath = path.join(this.repoBasePath, `${projectSlug}.git`);
    const gitDir = path.join(versionPath, '.git');

    try {
      // Check if already initialized
      const stat = await fs.stat(gitDir);
      if (stat.isDirectory() || stat.isFile()) {
        logger.info(`[Git] Working tree already initialized: ${versionPath}`);
        return;
      }
    } catch (err) {
      // Not initialized yet, proceed
      const systemErr = err as NodeSystemError;
      if (systemErr.code !== 'ENOENT') {
        throw err;
      }
    }

    try {
      logger.info(`[Git] Initializing working tree at ${versionPath}`);

      // Initialize git in version directory
      await execAsync('git init', { cwd: versionPath });

      // Add remote to bare repo
      await execAsync(`git remote add origin "${repoPath}"`, { cwd: versionPath });

      // Configure git author
      await execAsync('git config user.name "Godot Script Editor"', { cwd: versionPath });
      await execAsync('git config user.email "godot@veritable-games.com"', { cwd: versionPath });

      // Create .gitignore
      const gitignore = '.godot/\n*.import\n.DS_Store\nnode_modules/\n.env\n.env.local\n';
      await fs.writeFile(path.join(versionPath, '.gitignore'), gitignore);

      logger.info(`[Git] Working tree initialized: ${projectSlug}`);
    } catch (error) {
      logger.error(`[Git] Failed to initialize working tree:`, error);
      throw error;
    }
  }

  /**
   * Commit script change to git
   */
  async commitScriptChange(
    versionPath: string,
    versionTag: string,
    scriptPath: string,
    message: string
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    try {
      // Convert res://scripts/Player.gd → scripts/Player.gd
      const fsPath = scriptPath.replace('res://', '');

      logger.info(`[Git] Committing ${versionTag}/${fsPath}`);

      // Stage file
      await execAsync(`git add "${fsPath}"`, { cwd: versionPath });

      // Commit with version prefix
      const fullMessage = `${versionTag}: ${message}`;
      const { stdout } = await execAsync(`git commit -m "${fullMessage}"`, { cwd: versionPath });

      // Extract commit hash from output like: [main (root-commit) abc123def]
      const hashMatch = stdout.match(/\[.*?\s([a-f0-9]+)\]/);
      const commitHash = hashMatch?.[1] || undefined;

      logger.info(`[Git] Committed ${versionTag}/${fsPath}: ${commitHash}`);
      return { success: true, commitHash: commitHash };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Git] Commit failed:`, errorMsg);
      // Don't throw - let caller decide how to handle
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get commit history for a script path
   */
  async getScriptHistory(
    versionPath: string,
    scriptPath: string,
    limit: number = 10
  ): Promise<Array<{ hash: string; message: string; date: string }>> {
    try {
      const fsPath = scriptPath.replace('res://', '');
      const { stdout } = await execAsync(`git log --oneline -${limit} -- "${fsPath}"`, {
        cwd: versionPath,
      });

      const lines = stdout
        .trim()
        .split('\n')
        .filter(line => line.length > 0);

      return lines.map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash: (hash || 'unknown').substring(0, 7),
          message: messageParts.join(' '),
          date: new Date().toISOString(), // Could parse from git log format
        };
      });
    } catch (error) {
      logger.error(`[Git] Failed to get history:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const godotGitService = new GodotGitService();
