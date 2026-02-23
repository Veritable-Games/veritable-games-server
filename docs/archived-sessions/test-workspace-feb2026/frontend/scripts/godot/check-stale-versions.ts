/**
 * CLI Script: Check for stale Godot versions
 * Identifies versions that need re-indexing
 *
 * Usage:
 *   npm run godot:check-stale
 */

import { godotService } from '@/lib/godot/service';

async function checkStaleVersions() {
  try {
    console.log('🔍 Checking for stale Godot versions\n');

    const allProjects = await godotService.getProjects();
    console.log(`📦 Checking ${allProjects.length} projects\n`);

    let totalVersions = 0;
    let staleCount = 0;

    for (const project of allProjects) {
      const versions = await godotService.getVersions(project.project_slug);
      console.log(`📁 ${project.project_slug}:`);

      for (const version of versions) {
        totalVersions++;
        try {
          // Try to get the dependency graph
          const graph = await godotService.getDependencyGraph(version.id);
          if (graph) {
            console.log(
              `   ✅ ${version.version_tag} (${JSON.parse(graph as any).nodes.length} scripts)`
            );
          } else {
            staleCount++;
            console.log(`   ⚠️  ${version.version_tag} (no graph - needs re-indexing)`);
          }
        } catch (error) {
          staleCount++;
          console.log(`   ⚠️  ${version.version_tag} (error - needs re-indexing)`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Stale Version Summary');
    console.log('='.repeat(50));
    console.log(`Total versions: ${totalVersions}`);
    console.log(`Stale versions: ${staleCount}`);
    console.log(`Up-to-date: ${totalVersions - staleCount}`);

    if (staleCount > 0) {
      console.log(`\n💡 Run 'npm run godot:reindex-all' to update all versions`);
      process.exit(1);
    } else {
      console.log('\n✅ All versions are up to date!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStaleVersions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
