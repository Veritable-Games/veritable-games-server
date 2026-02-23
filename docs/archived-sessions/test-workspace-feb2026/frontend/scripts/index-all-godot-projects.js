#!/usr/bin/env node

/**
 * Index all Godot project scripts
 *
 * Parses all .gd files across all 41 registered project versions,
 * extracts dependencies and metadata, and stores in database.
 *
 * Usage:
 *   npm run tsx scripts/index-all-godot-projects.js
 *   node scripts/index-all-godot-projects.js
 *
 * Expected output:
 *   ✓ Indexed 1234 scripts across 41 versions
 *   ✓ Built dependency graphs
 *   ✓ Stored metadata in database
 */

const path = require('path');
const fs = require('fs').promises;
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Simple GDScript parser (matching parser-service.ts logic)
class GodotParser {
  parseScript(filePath, content) {
    const lines = content.split('\n');
    const result = {
      filePath,
      dependencies: [],
      signals: [],
      functions: [],
      exports: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const trimmed = line.trim();
      const lineNum = i + 1;

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse class_name declaration
      if (trimmed.startsWith('class_name ')) {
        result.className = trimmed.replace('class_name ', '').split('#')[0].trim();
      }

      // Parse extends declaration
      if (trimmed.startsWith('extends ')) {
        const className = trimmed.replace('extends ', '').split('#')[0].trim();
        result.extendsClass = className;
        result.dependencies.push({
          type: 'extends',
          path: this.resolveClassPath(className),
          line: lineNum,
        });
      }

      // Parse preload/load statements
      const preloadMatch = trimmed.match(
        /(?:var|const)\s+\w+\s*=\s*(?:preload|load)\s*\(\s*["'](.+?)["']\s*\)/
      );
      if (preloadMatch && preloadMatch[1]) {
        const depType = trimmed.includes('preload') ? 'preload' : 'load';
        result.dependencies.push({
          type: depType,
          path: preloadMatch[1],
          line: lineNum,
        });
      }

      // Parse signal declarations
      const signalMatch = trimmed.match(/^signal\s+(\w+)(?:\s*\((.*?)\))?/);
      if (signalMatch && signalMatch[1]) {
        const params = signalMatch[2]
          ? signalMatch[2]
              .split(',')
              .map(p => p.trim())
              .filter(Boolean)
          : undefined;
        result.signals.push({
          name: signalMatch[1],
          params,
          line: lineNum,
        });
      }

      // Parse function declarations
      const funcMatch = trimmed.match(/^(?:static\s+)?(?:func|_init)\s+(\w+)\s*\((.*?)\)/);
      if (funcMatch && funcMatch[1]) {
        const isStatic = trimmed.includes('static');
        const isPrivate = funcMatch[1].startsWith('_');
        const calls = this.extractFunctionCalls(this.extractFunctionBody(lines, i));

        result.functions.push({
          name: funcMatch[1],
          params: (funcMatch[2] || '')
            .split(',')
            .map(p => p.trim())
            .filter(Boolean),
          line: lineNum,
          calls,
          isStatic,
          isPrivate,
        });
      }
    }

    return result;
  }

  extractFunctionBody(lines, startIndex) {
    const startLine = lines[startIndex];
    if (!startLine) return '';

    const baseIndent = startLine.search(/\S/);
    let body = '';
    let i = startIndex + 1;

    while (i < lines.length) {
      const line = lines[i];
      if (!line) {
        i++;
        continue;
      }

      const lineIndent = line.search(/\S/);

      // Stop if we hit a line with same or less indentation (new function/block)
      if (line.trim() && lineIndent <= baseIndent) {
        break;
      }

      body += line + '\n';
      i++;
    }

    return body;
  }

  extractFunctionCalls(code) {
    const calls = new Set();
    // Match function calls: word followed by parentheses
    const callRegex = /\b([a-zA-Z_]\w*)\s*\(/g;
    let match;

    while ((match = callRegex.exec(code)) !== null) {
      const functionName = match[1];
      if (!functionName) continue;

      // Filter out common keywords
      if (
        ![
          'if',
          'elif',
          'else',
          'while',
          'for',
          'match',
          'func',
          'class',
          'extends',
          'var',
          'const',
          'return',
          'assert',
          'await',
          'signal',
          'emit_signal',
          'print',
        ].includes(functionName)
      ) {
        calls.add(functionName);
      }
    }

    return Array.from(calls);
  }

  buildDependencyGraph(scripts) {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Create nodes for each script
    scripts.forEach((script, index) => {
      const nodeId = script.filePath;
      const label = script.className || script.filePath.split('/').pop() || 'Unknown';

      const node = {
        id: nodeId,
        label,
        type: 'script',
        metadata: {
          functionCount: script.functions.length,
          signalCount: script.signals.length,
          exportCount: script.exports.length,
        },
        // Arrange in a circle for initial layout
        position: {
          x: Math.cos((index / scripts.length) * Math.PI * 2) * 5,
          y: Math.sin((index / scripts.length) * Math.PI * 2) * 5,
          z: 0,
        },
      };

      nodes.push(node);
      nodeMap.set(nodeId, node);
    });

    // Create edges from dependencies
    scripts.forEach(script => {
      script.dependencies.forEach(dep => {
        // Skip class_name dependencies - they're not relationships
        if (dep.type === 'class_name') return;

        // Try to match dependency to a script
        const toNodeId = this.resolveScriptPath(dep.path, scripts);

        if (toNodeId && toNodeId !== script.filePath) {
          edges.push({
            from: script.filePath,
            to: toNodeId,
            type: dep.type,
            weight: dep.type === 'extends' ? 2 : 1,
          });
        }
      });
    });

    return { nodes, edges };
  }

  resolveClassPath(className) {
    // Built-in Godot classes
    if (this.isBuiltInClass(className)) {
      return `godot://${className}`;
    }

    // Custom classes typically in res://scripts/ or user-defined paths
    return `res://scripts/${className}.gd`;
  }

  resolveScriptPath(depPath, availableScripts) {
    // If path starts with res://, normalize it
    const normalizedPath = depPath.startsWith('res://') ? depPath : `res://${depPath}`;

    // Try exact match
    for (const script of availableScripts) {
      if (script.filePath === normalizedPath) {
        return script.filePath;
      }
    }

    // Try suffix match
    const pathSegment = depPath.replace(/\.gd$/, '');
    for (const script of availableScripts) {
      if (script.filePath.endsWith(pathSegment)) {
        return script.filePath;
      }
    }

    return null;
  }

  isBuiltInClass(className) {
    const builtInClasses = [
      'Node',
      'Node2D',
      'Node3D',
      'Control',
      'CanvasItem',
      'Spatial',
      'Camera3D',
      'Camera2D',
      'CharacterBody2D',
      'CharacterBody3D',
      'RigidBody2D',
      'RigidBody3D',
      'StaticBody2D',
      'StaticBody3D',
      'Area2D',
      'Area3D',
      'AnimatedSprite2D',
      'Sprite2D',
      'Sprite3D',
      'AnimationPlayer',
      'Timer',
      'AudioStreamPlayer',
      'AudioStreamPlayer2D',
      'AudioStreamPlayer3D',
      'Button',
      'Label',
      'LineEdit',
      'TextEdit',
      'Panel',
      'PanelContainer',
      'VBoxContainer',
      'HBoxContainer',
      'GridContainer',
      'TabContainer',
      'Window',
      'Resource',
      'RefCounted',
      'Object',
    ];
    return builtInClasses.includes(className);
  }
}

const parser = new GodotParser();

/**
 * Find all .gd files in a directory recursively
 */
async function findGdFiles(dirPath) {
  const files = [];

  async function walk(dir) {
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
      console.warn(`  ⚠ Cannot read directory ${dir}:`, error.message);
    }
  }

  await walk(dirPath);
  return files;
}

/**
 * Index a single project version
 */
async function indexVersion(client, version, stats) {
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
        error: 'Path does not exist (SSHFS mount not set up)',
      });
      return;
    }

    // Find all .gd files
    const gdFiles = await findGdFiles(version.extracted_path);
    console.log(`  Found ${gdFiles.length} .gd files`);

    if (gdFiles.length === 0) {
      console.warn(`  ⚠ No .gd files found in ${version.extracted_path}`);
      return;
    }

    // Parse each script
    const scripts = [];

    for (const filePath of gdFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(version.extracted_path, filePath);
        const normalizedPath = `res://${relativePath.replace(/\\/g, '/')}`;

        const analysis = parser.parseScript(normalizedPath, content);
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
        console.warn(`    ⚠ Error parsing ${filePath}:`, error.message);
      }
    }

    // Build dependency graph
    if (scripts.length > 0) {
      const graph = parser.buildDependencyGraph(scripts);

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
    const errorMsg = error.message;
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
async function main() {
  console.log('🚀 Starting Godot project script indexing...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const stats = {
    versionsProcessed: 0,
    totalScriptsIndexed: 0,
    totalDependencies: 0,
    graphsBuilt: 0,
    errors: [],
  };

  const client = await pool.connect();

  try {
    // Fetch all registered versions from database
    console.log('📋 Fetching registered versions from database...');
    const result = await client.query(
      `SELECT id, project_slug, version_tag, extracted_path
       FROM content.godot_versions
       ORDER BY project_slug, version_tag`
    );

    const versions = result.rows;
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
      console.log(`\n⚠ Issues encountered: ${stats.errors.length}`);
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
    } else if (stats.errors.length > 0) {
      console.log('\n⚠ Some versions could not be indexed (check SSHFS mount)');
      console.log('\nTo retry after setting up SSHFS:');
      console.log('1. sshfs user@192.168.1.15:/data/projects ~/mnt/godot-projects');
      console.log('2. node scripts/index-all-godot-projects.js');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
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
