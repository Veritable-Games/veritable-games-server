const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'content.db');
const db = new Database(dbPath, { readonly: true });

try {
  console.log('Checking local SQLite database for workspace data...\n');

  const workspaces = db.prepare('SELECT id, slug, title FROM workspaces ORDER BY slug').all();

  if (workspaces.length === 0) {
    console.log('No workspaces found in local database.');
    console.log('This is likely a development database with no production data.\n');
    process.exit(0);
  }

  console.log('=== LOCAL WORKSPACE NODE COUNTS ===\n');

  let totalNodes = 0;
  const workspaceData = [];

  for (const ws of workspaces) {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM workspace_nodes WHERE workspace_id = ?')
      .get(ws.id);
    const count = result.count;
    totalNodes += count;
    workspaceData.push({ slug: ws.slug, title: ws.title, nodeCount: count });
  }

  workspaceData.sort((a, b) => b.nodeCount - a.nodeCount);

  for (const ws of workspaceData) {
    const paddedSlug = ws.slug.padEnd(20);
    const paddedCount = String(ws.nodeCount).padStart(4);
    console.log(`${paddedSlug} ${paddedCount} nodes  (${ws.title})`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`TOTAL: ${totalNodes} nodes across ${workspaces.length} workspaces`);
  console.log('='.repeat(50) + '\n');
} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
