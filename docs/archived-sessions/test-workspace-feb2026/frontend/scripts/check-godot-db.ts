import { dbAdapter } from '@/lib/database/adapter';

(async () => {
  try {
    console.log('=== Godot System Database Status ===\n');

    // Check projects
    const projects = await dbAdapter.query(
      'SELECT id, project_slug, title FROM godot_projects',
      [],
      { schema: 'content' }
    );
    console.log(`✓ Projects: ${projects.rows.length}`);
    projects.rows.forEach((p: any) => console.log(`  - ${p.project_slug} (id: ${p.id})`));

    // Check versions
    const versions = await dbAdapter.query(
      'SELECT id, project_slug, version_tag FROM godot_versions ORDER BY id',
      [],
      { schema: 'content' }
    );
    console.log(`\n✓ Versions: ${versions.rows.length}`);
    const versionRows = versions.rows as any[];
    versionRows
      .slice(0, 5)
      .forEach(v => console.log(`  - id:${v.id} ${v.project_slug}/${v.version_tag}`));
    if (versionRows.length > 5) console.log(`  ... and ${versionRows.length - 5} more`);

    // Check scripts count
    const scripts = await dbAdapter.query('SELECT COUNT(*) as count FROM godot_scripts', [], {
      schema: 'content',
    });
    console.log(`\n✓ Scripts: ${(scripts.rows[0] as any).count}`);

    // Check dependency graphs
    const graphs = await dbAdapter.query(
      'SELECT COUNT(*) as count FROM godot_dependency_graph',
      [],
      { schema: 'content' }
    );
    console.log(`✗ Dependency Graphs: ${(graphs.rows[0] as any).count} (SHOULD BE 41!)`);

    if ((graphs.rows[0] as any).count > 0) {
      const sample = await dbAdapter.query(
        'SELECT version_id FROM godot_dependency_graph LIMIT 5',
        [],
        { schema: 'content' }
      );
      console.log(
        `  Sample graph version_ids: ${(sample.rows as any[]).map(r => r.version_id).join(', ')}`
      );
    }
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
})();
