/**
 * Rebuild Godot dependency graphs for all versions
 * Run this on production to populate the godot_dependency_graph table
 */

import { godotService } from '@/lib/godot/service';
import path from 'path';

// Get the mounted projects directory path
const GODOT_PROJECTS_PATH = process.env.GODOT_PROJECTS_PATH || '/app/godot-projects';

(async () => {
  try {
    console.log('🔄 Rebuilding Godot dependency graphs...\n');

    // Get all versions
    const projects = await godotService.getProjects();
    console.log(`Found ${projects.length} projects\n`);

    let totalVersions = 0;
    let successCount = 0;
    let failedVersions: Array<{ id: number; slug: string; tag: string; error: string }> = [];

    for (const project of projects) {
      const versions = await godotService.getVersions(project.project_slug);
      console.log(`📦 ${project.title} (${project.project_slug}): ${versions.length} versions`);

      for (const version of versions) {
        totalVersions++;
        try {
          console.log(`  ↳ Indexing ${version.version_tag}...`);

          // Construct the mounted path (not the extracted_path from database which points to /data/projects)
          const mountedProjectPath = path.join(
            GODOT_PROJECTS_PATH,
            project.project_slug.toUpperCase(),
            version.version_tag
          );

          console.log(`     Path: ${mountedProjectPath}`);
          console.log(`     Version object:`, {
            id: version.id,
            version_tag: version.version_tag,
            extracted_path: version.extracted_path,
          });

          // Index scripts and build dependency graph
          try {
            console.log(`     ↳ Starting indexing for version ${version.id}...`);
            console.log(`     ↳ Calling indexScripts with path: ${mountedProjectPath}`);
            const scripts = await godotService.indexScripts(version.id, mountedProjectPath);
            console.log(`    ✓ Indexed ${scripts.length} scripts and built dependency graph`);
            successCount++;
          } catch (parseErr) {
            // More detailed error logging
            console.log(`    ✗ Failed during indexing/graphing`);
            console.error('Full error object:', parseErr);
            if (parseErr instanceof Error) {
              console.error('Error message:', parseErr.message);
              console.error('Error stack:', parseErr.stack);
              throw parseErr;
            } else {
              console.error('Non-Error thrown:', parseErr);
              throw new Error(`Indexing failed: ${JSON.stringify(parseErr)}`);
            }
          }
        } catch (error) {
          let errorMsg = 'Unknown error';
          try {
            if (error instanceof Error) {
              errorMsg = error.message;
            } else if (typeof error === 'string') {
              errorMsg = error;
            } else if (error && typeof error === 'object' && 'message' in error) {
              errorMsg = String((error as any).message);
            } else {
              errorMsg = String(error);
            }
          } catch (serializeErr) {
            errorMsg = `Error serialization failed: ${serializeErr}`;
          }
          console.log(`    ✗ Failed: ${errorMsg}`);
          failedVersions.push({
            id: version.id,
            slug: project.project_slug,
            tag: version.version_tag,
            error: errorMsg,
          });
        }
      }
      console.log();
    }

    console.log('\n=== Summary ===');
    console.log(`✓ Successful: ${successCount}/${totalVersions}`);
    if (failedVersions.length > 0) {
      console.log(`✗ Failed: ${failedVersions.length}`);
      failedVersions.forEach((f: any) => {
        const errorStr = typeof f.error === 'string' ? f.error : String(f.error);
        console.log(`  - ${f.slug}/${f.tag}: ${errorStr}`);
      });
    }

    process.exit(failedVersions.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
