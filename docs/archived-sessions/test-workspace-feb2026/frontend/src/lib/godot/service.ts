/**
 * GodotService
 * Main service for managing Godot projects, versions, and scripts
 */

import { dbAdapter } from '@/lib/database/adapter';
import {
  godotParser,
  ScriptAnalysis,
  SceneAnalysis,
  DependencyGraph,
  PARSER_VERSION,
} from './parser-service';
import { godotGitService } from './git-service';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/utils/logger';

export interface GodotProject {
  id: number;
  project_slug: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface GodotVersion {
  id: number;
  project_slug: string;
  version_tag: string;
  is_active: boolean;
  extracted_path: string;
  build_path?: string;
  build_status: 'pending' | 'building' | 'success' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface GodotScript {
  id: number;
  version_id: number;
  file_path: string;
  script_name: string;
  content: string;
  original_content: string;
  is_modified: boolean;
  dependencies?: unknown;
  functions?: unknown;
  signals?: unknown;
  exports?: unknown;
  last_edited_at?: string;
}

export interface ReindexResult {
  scriptsIndexed: number;
  graph: DependencyGraph;
}

// Use environment variables for flexibility between dev and production
// Dev: Local filesystem paths
// Prod: Docker volume mounts from /data/projects and /data/builds
const GODOT_PROJECTS_DIR =
  process.env.GODOT_PROJECTS_PATH || path.join(process.cwd(), 'godot-projects');
const GODOT_BUILDS_DIR =
  process.env.GODOT_BUILDS_PATH || path.join(process.cwd(), 'public', 'godot-builds');

export class GodotService {
  /**
   * Create a new Godot project
   */
  async createProject(
    projectSlug: string,
    title: string,
    description?: string
  ): Promise<GodotProject> {
    const result = await dbAdapter.query<GodotProject>(
      `INSERT INTO godot_projects (project_slug, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectSlug, title, description],
      { schema: 'content' }
    );
    if (!result.rows[0]) throw new Error('Failed to create project');
    return result.rows[0];
  }

  /**
   * Get all Godot projects
   */
  async getProjects(): Promise<GodotProject[]> {
    const result = await dbAdapter.query<GodotProject>(
      `SELECT * FROM godot_projects ORDER BY created_at DESC`,
      [],
      { schema: 'content' }
    );
    return result.rows;
  }

  /**
   * Get a specific project by slug
   */
  async getProject(projectSlug: string): Promise<GodotProject | null> {
    const result = await dbAdapter.query<GodotProject>(
      `SELECT * FROM godot_projects WHERE project_slug = $1`,
      [projectSlug],
      { schema: 'content' }
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new version for a project
   */
  async createVersion(
    projectSlug: string,
    versionTag: string,
    extractedPath: string
  ): Promise<GodotVersion> {
    const result = await dbAdapter.query<GodotVersion>(
      `INSERT INTO godot_versions (project_slug, version_tag, extracted_path, build_status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [projectSlug, versionTag, extractedPath, 'pending'],
      { schema: 'content' }
    );
    if (!result.rows[0]) throw new Error('Failed to create version');
    return result.rows[0];
  }

  /**
   * Get all versions for a project
   */
  async getVersions(projectSlug: string): Promise<GodotVersion[]> {
    const result = await dbAdapter.query<GodotVersion>(
      `SELECT * FROM godot_versions
       WHERE project_slug = $1
       ORDER BY created_at DESC`,
      [projectSlug],
      { schema: 'content' }
    );
    return result.rows;
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: number): Promise<GodotVersion | null> {
    const result = await dbAdapter.query<GodotVersion>(
      `SELECT * FROM godot_versions WHERE id = $1`,
      [versionId],
      { schema: 'content' }
    );
    return result.rows[0] || null;
  }

  /**
   * Set a version as active
   */
  async setActiveVersion(projectSlug: string, versionId: number): Promise<void> {
    // Deactivate all other versions
    await dbAdapter.query(
      `UPDATE godot_versions SET is_active = false
       WHERE project_slug = $1`,
      [projectSlug],
      { schema: 'content' }
    );

    // Activate the specified version
    await dbAdapter.query(
      `UPDATE godot_versions SET is_active = true
       WHERE id = $1 AND project_slug = $2`,
      [versionId, projectSlug],
      { schema: 'content' }
    );
  }

  /**
   * Scan a directory for .gd files and .tscn files and index them
   */
  async indexScripts(
    versionId: number,
    projectPath: string
  ): Promise<{
    scripts: GodotScript[];
    scenes: SceneAnalysis[];
  }> {
    const scripts: GodotScript[] = [];
    const scenes: SceneAnalysis[] = [];

    // Clear existing scripts and scenes for this version
    await dbAdapter.query(`DELETE FROM godot_scripts WHERE version_id = $1`, [versionId], {
      schema: 'content',
    });
    await dbAdapter.query(`DELETE FROM godot_scenes WHERE version_id = $1`, [versionId], {
      schema: 'content',
    });

    // Recursively find all .gd files
    const gdFiles = await this.findScriptFiles(projectPath);

    for (const filePath of gdFiles) {
      const relativeFilePath = `res://${path.relative(projectPath, filePath)}`;
      const content = await fs.readFile(filePath, 'utf-8');
      const scriptName = path.basename(filePath, '.gd');

      // Parse the script
      const analysis = godotParser.parseScript(relativeFilePath, content);

      // Store in database
      const result = await dbAdapter.query<GodotScript>(
        `INSERT INTO godot_scripts
         (version_id, file_path, script_name, content, original_content, dependencies, functions, signals, exports)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          versionId,
          relativeFilePath,
          scriptName,
          content,
          content,
          JSON.stringify(analysis.dependencies),
          JSON.stringify(analysis.functions),
          JSON.stringify(analysis.signals),
          JSON.stringify(analysis.exports),
        ],
        { schema: 'content' }
      );

      if (result.rows[0]) {
        scripts.push(result.rows[0]);
      }
    }

    // Recursively find all .tscn files
    const tscnFiles = await this.findSceneFiles(projectPath);
    logger.info(`[indexScripts] Found ${tscnFiles.length} scene files`);

    for (const filePath of tscnFiles) {
      const relativeFilePath = `res://${path.relative(projectPath, filePath)}`;
      const content = await fs.readFile(filePath, 'utf-8');
      const sceneAnalysis = godotParser.parseScene(relativeFilePath, content);
      scenes.push(sceneAnalysis);

      // Store scene in database
      await dbAdapter.query(
        `INSERT INTO godot_scenes (version_id, file_path, scene_name, hierarchy, connections)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          versionId,
          relativeFilePath,
          sceneAnalysis.sceneName,
          JSON.stringify(sceneAnalysis.rootNode),
          JSON.stringify(sceneAnalysis.connections),
        ],
        { schema: 'content' }
      );
    }

    // Build and cache dependency graph
    const allScripts: ScriptAnalysis[] = scripts.map(script => {
      // Handle JSON fields that might be strings or objects from database
      const safeParse = (value: unknown): any[] => {
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            logger.error(`Failed to parse JSON string: ${value}`, e);
            return [];
          }
        }
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (e) {
            logger.error(`Failed to serialize/deserialize object: ${JSON.stringify(value)}`, e);
            return [];
          }
        }
        return [];
      };

      return {
        filePath: script.file_path,
        className: script.script_name,
        dependencies: safeParse(script.dependencies),
        functions: safeParse(script.functions),
        signals: safeParse(script.signals),
        exports: safeParse(script.exports),
      };
    });

    logger.info(`Built ScriptAnalysis objects for ${allScripts.length} scripts`);

    let dependencyGraph;
    try {
      dependencyGraph = godotParser.buildDependencyGraph(allScripts, scenes);
      logger.info(
        `Generated dependency graph with ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} edges`
      );
    } catch (graphErr) {
      logger.error('Failed to build dependency graph:', graphErr);
      throw new Error(
        `Dependency graph build failed: ${graphErr instanceof Error ? graphErr.message : String(graphErr)}`
      );
    }

    try {
      const graphJson = JSON.stringify(dependencyGraph);
      logger.info(`Serialized graph JSON (${graphJson.length} bytes)`);

      await dbAdapter.query(
        `INSERT INTO godot_dependency_graph (version_id, graph_data, parser_version)
         VALUES ($1, $2, $3)
         ON CONFLICT (version_id) DO UPDATE
         SET graph_data = $2, parser_version = $3, updated_at = CURRENT_TIMESTAMP`,
        [versionId, graphJson, PARSER_VERSION],
        { schema: 'content' }
      );
      logger.info(`Inserted dependency graph for version ${versionId}`);
    } catch (insertErr) {
      logger.error('Failed to insert dependency graph:', insertErr);
      throw new Error(
        `Dependency graph insert failed: ${insertErr instanceof Error ? insertErr.message : String(insertErr)}`
      );
    }

    return { scripts, scenes };
  }

  /**
   * Get all scripts for a version
   */
  async getScripts(versionId: number): Promise<GodotScript[]> {
    const result = await dbAdapter.query<GodotScript>(
      `SELECT * FROM godot_scripts
       WHERE version_id = $1
       ORDER BY file_path ASC`,
      [versionId],
      { schema: 'content' }
    );
    return result.rows;
  }

  /**
   * Get all scenes for a version
   */
  async getScenes(versionId: number): Promise<
    Array<{
      id: number;
      version_id: number;
      file_path: string;
      scene_name: string;
      hierarchy: unknown;
      connections: unknown;
    }>
  > {
    const result = await dbAdapter.query<{
      id: number;
      version_id: number;
      file_path: string;
      scene_name: string;
      hierarchy: unknown;
      connections: unknown;
    }>(
      `SELECT * FROM godot_scenes
       WHERE version_id = $1
       ORDER BY file_path ASC`,
      [versionId],
      { schema: 'content' }
    );
    return result.rows;
  }

  /**
   * Get a specific script
   */
  async getScript(versionId: number, filePath: string): Promise<GodotScript | null> {
    const result = await dbAdapter.query<GodotScript>(
      `SELECT * FROM godot_scripts
       WHERE version_id = $1 AND file_path = $2`,
      [versionId, filePath],
      { schema: 'content' }
    );
    return result.rows[0] || null;
  }

  /**
   * Update a script's content
   */
  async updateScript(versionId: number, filePath: string, content: string): Promise<GodotScript> {
    const result = await dbAdapter.query<GodotScript>(
      `UPDATE godot_scripts
       SET content = $1, is_modified = true, last_edited_at = CURRENT_TIMESTAMP
       WHERE version_id = $2 AND file_path = $3
       RETURNING *`,
      [content, versionId, filePath],
      { schema: 'content' }
    );

    const script = result.rows[0];
    if (!script) {
      throw new Error('Script not found');
    }

    return script;
  }

  /**
   * Get dependency graph for a version
   */
  async getDependencyGraph(versionId: number): Promise<unknown> {
    const result = await dbAdapter.query<{ graph_data: unknown }>(
      `SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1`,
      [versionId],
      { schema: 'content' }
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return row.graph_data;
  }

  /**
   * Find all .gd files in a directory
   */
  private async findScriptFiles(dir: string): Promise<string[]> {
    logger.info(`[findScriptFiles] Scanning directory: ${dir}`);
    const files: string[] = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
      logger.info(`[findScriptFiles] Found ${entries.length} entries in ${dir}`);
    } catch (err) {
      logger.error(`[findScriptFiles] Failed to read directory ${dir}:`, err);
      throw err;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip hidden directories and common exclusions
      if (entry.isDirectory()) {
        if (!['.git', '.godot', 'node_modules', '.ds_store'].includes(entry.name.toLowerCase())) {
          files.push(...(await this.findScriptFiles(fullPath)));
        }
      } else if (entry.isFile() && entry.name.endsWith('.gd')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Find all .tscn (scene) files in a directory
   */
  async findSceneFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!['.git', '.godot', 'node_modules', '.ds_store'].includes(entry.name.toLowerCase())) {
          files.push(...(await this.findSceneFiles(fullPath)));
        }
      } else if (entry.isFile() && entry.name.endsWith('.tscn')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories(): Promise<void> {
    await fs.mkdir(GODOT_PROJECTS_DIR, { recursive: true });
    await fs.mkdir(GODOT_BUILDS_DIR, { recursive: true });
  }

  /**
   * Get directory paths for a version
   */
  getVersionPaths(projectSlug: string, versionTag: string) {
    const projectDir = path.join(GODOT_PROJECTS_DIR, projectSlug);
    const versionDir = path.join(projectDir, versionTag);
    const buildDir = path.join(GODOT_BUILDS_DIR, projectSlug, versionTag);

    return {
      projectDir,
      versionDir,
      buildDir,
    };
  }

  /**
   * Reparse a single script after content update
   * Updates dependencies, functions, signals, exports in database
   */
  async reparseScript(versionId: number, filePath: string, newContent: string): Promise<void> {
    logger.info(`[GodotService] Reparsing ${filePath}`);

    const analysis = godotParser.parseScript(filePath, newContent);

    await dbAdapter.query(
      `UPDATE godot_scripts
       SET dependencies = $1, functions = $2, signals = $3, exports = $4
       WHERE version_id = $5 AND file_path = $6`,
      [
        JSON.stringify(analysis.dependencies),
        JSON.stringify(analysis.functions),
        JSON.stringify(analysis.signals),
        JSON.stringify(analysis.exports),
        versionId,
        filePath,
      ],
      { schema: 'content' }
    );

    logger.info(
      `[GodotService] Reparsed: ${analysis.dependencies.length} deps, ${analysis.functions.length} funcs`
    );
  }

  /**
   * Rebuild dependency graph for entire version
   * Called after scripts are updated to maintain graph consistency
   */
  async rebuildDependencyGraph(versionId: number): Promise<void> {
    logger.info(`[GodotService] Rebuilding graph for version ${versionId}`);

    const scripts = await this.getScripts(versionId);
    const scenes = await this.getScenes(versionId);

    const scriptAnalyses: ScriptAnalysis[] = scripts.map(script => {
      const safeParse = (value: unknown): any[] => {
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        }
        if (Array.isArray(value)) return value;
        return [];
      };

      return {
        filePath: script.file_path,
        className: script.script_name,
        dependencies: safeParse(script.dependencies),
        functions: safeParse(script.functions),
        signals: safeParse(script.signals),
        exports: safeParse(script.exports),
      };
    });

    const sceneAnalyses: SceneAnalysis[] = scenes.map(s => ({
      filePath: s.file_path,
      sceneName: s.scene_name,
      rootNode: typeof s.hierarchy === 'string' ? JSON.parse(s.hierarchy) : s.hierarchy,
      connections: typeof s.connections === 'string' ? JSON.parse(s.connections) : s.connections,
      dependencies: [],
    }));

    const graph = godotParser.buildDependencyGraph(scriptAnalyses, sceneAnalyses);

    await dbAdapter.query(
      `INSERT INTO godot_dependency_graph (version_id, graph_data, parser_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (version_id) DO UPDATE
       SET graph_data = $2, parser_version = $3, updated_at = CURRENT_TIMESTAMP`,
      [versionId, JSON.stringify(graph), PARSER_VERSION],
      { schema: 'content' }
    );

    logger.info(
      `[GodotService] Graph rebuilt: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
    );
  }

  /**
   * Re-index an existing version with the current parser
   * Reads scripts from filesystem and re-parses all dependencies
   * Useful when the parser has been improved and previous versions need updating
   */
  async reindexVersion(versionId: number): Promise<ReindexResult> {
    // 1. Get version metadata
    const versionResult = await dbAdapter.query<GodotVersion>(
      `SELECT * FROM godot_versions WHERE id = $1`,
      [versionId],
      { schema: 'content' }
    );

    if (versionResult.rows.length === 0) {
      throw new Error(`Version ${versionId} not found`);
    }

    const version = versionResult.rows[0]!;

    // 2. Construct filesystem path
    const projectPath = path.join(
      GODOT_PROJECTS_DIR,
      version.project_slug.toUpperCase(), // Match production convention (NOXII not noxii)
      version.version_tag
    );

    // 3. Verify filesystem exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      throw new Error(
        `Cannot re-index: filesystem not found at ${projectPath}. ` +
          `Ensure project files exist before re-indexing.`
      );
    }

    logger.info(`[GodotService] Re-indexing version ${versionId} from ${projectPath}`);

    // 4. Call indexScripts - deletes all scripts and re-parses from disk
    const { scripts, scenes } = await this.indexScripts(versionId, projectPath);

    // 5. Get dependency graph
    const graphData = await this.getDependencyGraph(versionId);
    if (!graphData) {
      throw new Error(`Failed to build dependency graph for version ${versionId}`);
    }

    const graph = graphData as DependencyGraph;

    logger.info(
      `[GodotService] Re-index complete: ${scripts.length} scripts, ${scenes.length} scenes, ${graph.edges.length} dependencies`
    );

    return {
      scriptsIndexed: scripts.length,
      graph,
    };
  }

  /**
   * Sync script to filesystem
   * Writes updated script content to the filesystem
   */
  async syncScriptToFilesystem(
    version: GodotVersion,
    filePath: string,
    content: string
  ): Promise<void> {
    const versionPath = path.join(GODOT_PROJECTS_DIR, version.project_slug, version.version_tag);

    const fsPath = filePath.replace('res://', '');
    const fullPath = path.join(versionPath, fsPath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    logger.info(`[GodotService] Synced to ${fullPath}`);
  }

  /**
   * Search scripts by content, functions, and signals
   */
  async searchScripts(
    versionId: number,
    options: {
      query: string;
      limit?: number;
      offset?: number;
      snippetLength?: number;
    }
  ): Promise<{
    results: Array<{
      scriptId: number;
      filePath: string;
      scriptName: string;
      matchType: 'content' | 'function' | 'signal';
      snippets: Array<{ text: string; lineNumber: number }>;
    }>;
    totalCount: number;
  }> {
    const { query, limit = 50, offset = 0, snippetLength = 100 } = options;
    const pattern = `%${query}%`;

    try {
      // Get all scripts for this version
      const scripts = await this.getScripts(versionId);

      const results: Array<{
        scriptId: number;
        filePath: string;
        scriptName: string;
        matchType: 'content' | 'function' | 'signal';
        snippets: Array<{ text: string; lineNumber: number }>;
      }> = [];

      scripts.forEach(script => {
        // Search in content
        if (script.content && script.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            scriptId: script.id,
            filePath: script.file_path,
            scriptName: script.script_name,
            matchType: 'content',
            snippets: this.generateSnippets(script.content, query, snippetLength),
          });
        }

        // Search in functions
        if (script.functions) {
          const functionsData =
            typeof script.functions === 'string' ? JSON.parse(script.functions) : script.functions;

          if (Array.isArray(functionsData)) {
            const matchingFunctions = functionsData.filter((f: any) =>
              f.name?.toLowerCase().includes(query.toLowerCase())
            );

            if (matchingFunctions.length > 0) {
              results.push({
                scriptId: script.id,
                filePath: script.file_path,
                scriptName: script.script_name,
                matchType: 'function',
                snippets: this.extractFunctionSnippets(matchingFunctions),
              });
            }
          }
        }

        // Search in signals
        if (script.signals) {
          const signalsData =
            typeof script.signals === 'string' ? JSON.parse(script.signals) : script.signals;

          if (Array.isArray(signalsData)) {
            const matchingSignals = signalsData.filter((s: any) =>
              (typeof s === 'string' ? s : s.name)?.toLowerCase().includes(query.toLowerCase())
            );

            if (matchingSignals.length > 0) {
              results.push({
                scriptId: script.id,
                filePath: script.file_path,
                scriptName: script.script_name,
                matchType: 'signal',
                snippets: this.extractSignalSnippets(matchingSignals),
              });
            }
          }
        }
      });

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);

      return {
        results: paginatedResults,
        totalCount: results.length,
      };
    } catch (error) {
      logger.error('[GodotService] Error searching scripts:', error);
      throw error;
    }
  }

  /**
   * Generate context snippets around matches in code
   */
  private generateSnippets(
    content: string,
    query: string,
    maxLength: number
  ): Array<{ text: string; lineNumber: number }> {
    const lines = content.split('\n');
    const snippets: Array<{ text: string; lineNumber: number }> = [];
    const lowerQuery = query.toLowerCase();

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(lowerQuery)) {
        const halfLength = Math.floor(maxLength / 2);
        const matchIndex = line.toLowerCase().indexOf(lowerQuery);
        const start = Math.max(0, matchIndex - halfLength);
        const end = Math.min(line.length, matchIndex + query.length + halfLength);

        snippets.push({
          text:
            (start > 0 ? '...' : '') +
            line.substring(start, end) +
            (end < line.length ? '...' : ''),
          lineNumber: index + 1,
        });
      }
    });

    return snippets.slice(0, 3); // Max 3 snippets per file
  }

  /**
   * Extract function snippets from matching functions
   */
  private extractFunctionSnippets(functions: any[]): Array<{ text: string; lineNumber: number }> {
    return functions.slice(0, 3).map(f => ({
      text: `func ${f.name}(${f.params?.join(', ') || ''})`,
      lineNumber: f.line || 0,
    }));
  }

  /**
   * Extract signal snippets from matching signals
   */
  private extractSignalSnippets(signals: any[]): Array<{ text: string; lineNumber: number }> {
    return signals.slice(0, 3).map(s => ({
      text: `signal ${typeof s === 'string' ? s : s.name}`,
      lineNumber: 0,
    }));
  }
}

// Export singleton instance
export const godotService = new GodotService();
