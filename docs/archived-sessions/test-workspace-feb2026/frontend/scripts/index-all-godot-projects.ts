#!/usr/bin/env node

/**
 * Index all Godot project scripts
 *
 * Parses all .gd files across all 41 registered project versions,
 * extracts dependencies and metadata, and stores in database.
 *
 * Usage:
 *   npx tsx scripts/index-all-godot-projects.ts
 *   node scripts/index-all-godot-projects.js (if compiled)
 *
 * Expected output:
 *   ✓ Indexed 1234 scripts across 41 versions
 *   ✓ Built dependency graphs
 *   ✓ Stored metadata in database
 */

const path = require('path');
const fs = require('fs/promises');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Version {
  id: number;
  project_slug: string;
  version_tag: string;
  extracted_path: string;
}

interface IndexStats {
  versionsProcessed: number;
  totalScriptsIndexed: number;
  totalDependencies: number;
  graphsBuilt: number;
  errors: Array<{ version: string; error: string }>;
}

/**
 * Find all .gd files in a directory recursively
 */
async function findGdFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-script directories
          if (!['.git', '.godot', 'addons', '.import'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.gd')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`  ⚠ Cannot read directory ${dir}:`, (error as Error).message);
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Index a single project version
 */
async function indexVersion(
  client: PoolClient,
  version: Version,
  stats: IndexStats
): Promise<void> {
  const versionLabel = `${version.project_slug}/${version.version_tag}`;

  try {
    console.log(`\n📂 Indexing ${versionLabel} from ${version.extracted_path}`);

    // Check if path exists
    try {
      await fs.access(version.extracted_path);
    } catch {
      console.warn(`  ⚠ Path does not exist: ${version.extracted_path}`);
      stats.errors.push({
        version: versionLabel,
        error: 'Path does not exist',
      });
      return;
    }

    // Find all .gd files
    const gdFiles = await findGdFiles(version.extracted_path);
    console.log(`  Found ${gdFiles.length} .gd files`);

    if (gdFiles.length === 0) {
      stats.errors.push({
        version: versionLabel,
        error: 'No .gd files found',
      });
      return;
    }

    // Parse each script
    const scripts: ScriptAnalysis[] = [];

    for (const filePath of gdFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(version.extracted_path, filePath);
        const normalizedPath = `res://${relativePath.replace(/\\/g, '/')}`;

        const analysis = godotParser.parseScript(normalizedPath, content);
        scripts.push(analysis);

        // Store script metadata in database
        await client.query(
          `INSERT INTO content.godot_scripts
           (version_id, file_path, script_name, content, dependencies, functions, signals, exports, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           ON CONFLICT (version_id, file_path)
           DO UPDATE SET
             content = EXCLUDED.content,
             dependencies = EXCLUDED.dependencies,
             functions = EXCLUDED.functions,
             signals = EXCLUDED.signals,
             exports = EXCLUDED.exports,
             updated_at = NOW()`,
          [
            version.id,
            normalizedPath,
            analysis.className || path.basename(filePath),
            content,
            JSON.stringify(analysis.dependencies),
            JSON.stringify(analysis.functions),
            JSON.stringify(analysis.signals),
            JSON.stringify(analysis.exports),
          ]
        );

        stats.totalScriptsIndexed++;
        stats.totalDependencies += analysis.dependencies.length;
      } catch (error) {
        console.warn(`    ⚠ Error parsing ${filePath}:`, (error as Error).message);
      }
    }

    // Build dependency graph
    if (scripts.length > 0) {
      const graph = godotParser.buildDependencyGraph(scripts);

      // Store graph in database
      await client.query(
        `INSERT INTO content.godot_dependency_graph
         (version_id, graph_data, parsed_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (version_id)
         DO UPDATE SET
           graph_data = EXCLUDED.graph_data,
           updated_at = NOW()`,
        [version.id, JSON.stringify(graph)]
      );

      stats.graphsBuilt++;
      console.log(`  ✓ Indexed ${scripts.length} scripts`);
      console.log(
        `  ✓ Built dependency graph (${graph.nodes.length} nodes, ${graph.edges.length} edges)`
      );
    }

    stats.versionsProcessed++;
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`  ✗ Error indexing ${versionLabel}:`, errorMsg);
    stats.errors.push({
      version: versionLabel,
      error: errorMsg,
    });
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Godot project script indexing...\n');

  const pool = createPool();
  const client = await pool.connect();

  const stats: IndexStats = {
    versionsProcessed: 0,
    totalScriptsIndexed: 0,
    totalDependencies: 0,
    graphsBuilt: 0,
    errors: [],
  };

  try {
    // Fetch all registered versions from database
    console.log('📋 Fetching registered versions from database...');
    const result = await client.query(
      `SELECT id, project_slug, version_tag, extracted_path
       FROM content.godot_versions
       ORDER BY project_slug, version_tag`
    );

    const versions = result.rows as Version[];
    console.log(`✓ Found ${versions.length} registered versions\n`);

    if (versions.length === 0) {
      console.warn('⚠ No versions found in database. Run migration first.');
      return;
    }

    // Process each version
    for (const version of versions) {
      await indexVersion(client, version, stats);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Indexing Summary');
    console.log('='.repeat(60));
    console.log(`✓ Versions processed: ${stats.versionsProcessed}/${versions.length}`);
    console.log(`✓ Scripts indexed: ${stats.totalScriptsIndexed}`);
    console.log(`✓ Dependencies found: ${stats.totalDependencies}`);
    console.log(`✓ Graphs built: ${stats.graphsBuilt}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠ Errors encountered: ${stats.errors.length}`);
      for (const error of stats.errors) {
        console.log(`  - ${error.version}: ${error.error}`);
      }
    }

    if (stats.versionsProcessed === versions.length && stats.errors.length === 0) {
      console.log('\n✨ All versions indexed successfully!');
      console.log('\nNext steps:');
      console.log(
        '1. Set up SSHFS mount: sshfs user@192.168.1.15:/data/projects ~/mnt/godot-projects'
      );
      console.log('2. Create symlink: ln -s ~/mnt/godot-projects frontend/godot-projects');
      console.log('3. Start dev server: npm run dev');
      console.log('4. Press backtick (`) to open Godot overlay');
    }
  } catch (error) {
    console.error('❌ Fatal error:', (error as Error).message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
