/**
 * Diagnose script path issues in the database
 * Checks if scripts are indexed with correct res:// paths
 */

import { dbAdapter } from '@/lib/database/adapter';

(async () => {
  try {
    console.log('🔍 Diagnosing script paths...\n');

    // Get all versions with script counts
    const versions = await dbAdapter.query<{
      id: number;
      project_slug: string;
      version_tag: string;
      script_count: number;
    }>(
      `SELECT v.id, v.project_slug, v.version_tag, COUNT(s.id) as script_count
       FROM godot_versions v
       LEFT JOIN godot_scripts s ON v.id = s.version_id
       GROUP BY v.id, v.project_slug, v.version_tag
       ORDER BY v.project_slug, v.version_tag`,
      [],
      { schema: 'content' }
    );

    console.log(`Found ${versions.rows.length} versions\n`);

    for (const version of versions.rows) {
      console.log(`\n📦 ${version.project_slug}/${version.version_tag} (v${version.id})`);
      console.log(`   Scripts indexed: ${version.script_count}`);

      if (version.script_count === 0) {
        console.log('   ⚠️  No scripts indexed!');
        continue;
      }

      // Get sample of script paths for this version
      const scripts = await dbAdapter.query<{
        file_path: string;
      }>(`SELECT file_path FROM godot_scripts WHERE version_id = $1 LIMIT 5`, [version.id], {
        schema: 'content',
      });

      console.log('   Sample script paths:');
      for (const script of scripts.rows) {
        console.log(`     - ${script.file_path}`);

        // Check for problematic patterns
        if (script.file_path.includes(`${version.project_slug}-${version.version_tag}`)) {
          console.log(`       🔴 ERROR: Contains project-version prefix!`);
        } else if (script.file_path.includes(`${version.project_slug}/`)) {
          console.log(`       🔴 ERROR: Contains project slug!`);
        } else if (!script.file_path.startsWith('res://')) {
          console.log(`       🔴 ERROR: Doesn't start with res://!`);
        } else {
          console.log(`       ✓ Looks correct`);
        }
      }

      // Check graph data
      const graphData = await dbAdapter.query<{
        graph_data: string;
      }>(`SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1`, [version.id], {
        schema: 'content',
      });

      if (graphData.rows[0]) {
        try {
          const graph = JSON.parse(graphData.rows[0].graph_data);
          console.log(`   Graph nodes: ${graph.nodes?.length || 0}`);

          if (graph.nodes?.length > 0) {
            console.log('   Sample graph node IDs:');
            graph.nodes.slice(0, 3).forEach((node: any) => {
              console.log(`     - ${node.id}`);
              if (node.id.includes(`${version.project_slug}-${version.version_tag}`)) {
                console.log(`       🔴 ERROR: Graph node has project-version prefix!`);
              }
            });
          }
        } catch (e) {
          console.log(`   ✗ Failed to parse graph data: ${e}`);
        }
      } else {
        console.log(`   ⚠️  No graph data found`);
      }
    }

    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
