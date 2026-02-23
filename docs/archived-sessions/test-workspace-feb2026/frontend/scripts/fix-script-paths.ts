/**
 * Fix script paths in database
 * Normalizes paths that have incorrect project-version prefixes
 * Usage: DATABASE_URL=... npm run tsx -- scripts/fix-script-paths.ts [versionId]
 */

import { dbAdapter } from '@/lib/database/adapter';

async function fixScriptPaths(versionId?: number) {
  try {
    console.log('🔧 Fixing script paths...\n');

    // Get versions to fix
    let query = `
      SELECT DISTINCT v.id, v.project_slug, v.version_tag
      FROM godot_versions v
      JOIN godot_scripts s ON v.id = s.version_id
      WHERE s.file_path LIKE $1
      ORDER BY v.id
    `;
    const params: any[] = ['%-%/%']; // Pattern: has dash and slash (like noxii-0.16/...)

    if (versionId) {
      query += ' AND v.id = $2';
      params.push(versionId);
    }

    const versionsResult = await dbAdapter.query<{
      id: number;
      project_slug: string;
      version_tag: string;
    }>(query, params, { schema: 'content' });

    if (versionsResult.rows.length === 0) {
      console.log('✓ No script paths to fix found');
      return;
    }

    console.log(`Found ${versionsResult.rows.length} version(s) with problematic paths\n`);

    for (const version of versionsResult.rows) {
      console.log(`\n📦 Fixing ${version.project_slug}/${version.version_tag} (v${version.id})`);

      // Get all scripts with problematic paths for this version
      const scriptsResult = await dbAdapter.query<{
        id: number;
        file_path: string;
      }>(
        `SELECT id, file_path FROM godot_scripts
         WHERE version_id = $1
         AND file_path LIKE $2
         ORDER BY file_path`,
        [version.id, `${version.project_slug}-%/%`],
        { schema: 'content' }
      );

      if (scriptsResult.rows.length === 0) {
        console.log('  ✓ No problematic paths in this version');
        continue;
      }

      console.log(`  Found ${scriptsResult.rows.length} scripts with bad paths:`);

      // Fix each script
      let fixedCount = 0;
      for (const script of scriptsResult.rows) {
        // Parse the bad path and extract the correct path
        // e.g., "res://noxii-0.16/scripts/ContinuousLogger.gd" -> "res://scripts/ContinuousLogger.gd"
        const pathParts = script.file_path.split('/');
        let newPath: string;

        if (pathParts[0] === 'res:' && pathParts.length > 3) {
          // Has format like res://noxii-0.16/scripts/...
          // Remove the project-version part (pathParts[2])
          pathParts.splice(2, 1); // Remove pathParts[2] which is "noxii-0.16"
          newPath = pathParts.join('/');
        } else {
          console.log(`    ⚠️  Unexpected path format: ${script.file_path}`);
          continue;
        }

        console.log(`    ${script.file_path}`);
        console.log(`      → ${newPath}`);

        // Update the script
        try {
          await dbAdapter.query(
            `UPDATE godot_scripts SET file_path = $1 WHERE id = $2`,
            [newPath, script.id],
            { schema: 'content' }
          );
          fixedCount++;
        } catch (err) {
          console.log(`      ✗ Error updating: ${err}`);
        }
      }

      console.log(`  ✓ Fixed ${fixedCount}/${scriptsResult.rows.length} scripts`);

      // Rebuild the dependency graph for this version
      console.log(`  Rebuilding dependency graph...`);
      try {
        // Dynamic import to get the service
        const { godotService } = await import('@/lib/godot/service');
        await godotService.rebuildDependencyGraph(version.id);
        console.log(`  ✓ Graph rebuilt successfully`);
      } catch (err) {
        console.log(`  ✗ Error rebuilding graph: ${err}`);
      }
    }

    console.log('\n✅ Fix complete');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Check if versionId is provided as command line argument
const args = process.argv.slice(2);
const versionId = args[0] ? parseInt(args[0]) : undefined;

if (args[0] && isNaN(versionId as any)) {
  console.error('Invalid version ID provided');
  console.error('Usage: npm run tsx -- scripts/fix-script-paths.ts [versionId]');
  console.error('  versionId: (optional) specific version to fix');
  process.exit(1);
}

fixScriptPaths(versionId);
