/**
 * CLI Script: Re-index all Godot versions
 * Can be called from git hooks or manually from CLI
 *
 * Usage:
 *   npm run godot:reindex-all              # Re-index all versions
 *   npm run godot:reindex-all -- --dry-run # Preview without executing
 *   npm run godot:reindex-all -- --project noxii # Re-index specific project
 */

import { godotService } from '@/lib/godot/service';

interface Options {
  project?: string;
  limit?: number;
  dryRun?: boolean;
}

async function reindexAll(options: Options = {}) {
  console.log('🔄 Godot Version Re-indexing Tool\n');

  try {
    // Get all projects
    const allProjects = await godotService.getProjects();
    console.log(`📦 Found ${allProjects.length} projects`);

    const projects = options.project
      ? allProjects.filter(p => p.project_slug === options.project)
      : allProjects;

    if (projects.length === 0) {
      console.error(`❌ Project '${options.project}' not found`);
      process.exit(1);
    }

    // Collect all versions
    const allVersions: Array<{ projectSlug: string; versionId: number; versionTag: string }> = [];
    for (const project of projects) {
      const versions = await godotService.getVersions(project.project_slug);
      versions.forEach(v => {
        allVersions.push({
          projectSlug: project.project_slug,
          versionId: v.id,
          versionTag: v.version_tag,
        });
      });
    }

    const versionsToReindex = options.limit ? allVersions.slice(0, options.limit) : allVersions;

    console.log(`📊 Found ${versionsToReindex.length} versions to re-index\n`);

    // Dry run - preview only
    if (options.dryRun) {
      console.log('📋 DRY RUN - Would re-index:');
      versionsToReindex.forEach(v => {
        console.log(`   - ${v.projectSlug}/${v.versionTag}`);
      });
      console.log('');
      process.exit(0);
    }

    // Re-index all versions
    let successCount = 0;
    let failedCount = 0;

    for (const version of versionsToReindex) {
      try {
        console.log(`⏳ Re-indexing ${version.projectSlug}/${version.versionTag}...`);
        const result = await godotService.reindexVersion(version.versionId);
        successCount++;
        console.log(
          `✅ ${version.projectSlug}/${version.versionTag}: ${result.scriptsIndexed} scripts, ${result.graph.edges.length} dependencies`
        );
      } catch (error) {
        failedCount++;
        console.error(
          `❌ ${version.projectSlug}/${version.versionTag}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Re-index Summary');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Total: ${versionsToReindex.length}`);

    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const options: Options = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    options.project = args[i + 1];
    i++;
  } else if (args[i] === '--limit' && args[i + 1]) {
    options.limit = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--dry-run') {
    options.dryRun = true;
  }
}

reindexAll(options).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
