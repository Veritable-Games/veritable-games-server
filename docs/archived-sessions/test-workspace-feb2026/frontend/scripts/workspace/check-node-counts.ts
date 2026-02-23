/**
 * Check actual node counts across all workspaces
 * Used to verify migration scope before proceeding
 */

import { dbAdapter } from '@/lib/database/adapter';

async function checkWorkspaces() {
  try {
    console.log('Querying workspace node counts...\n');

    const workspaces = await dbAdapter.query(
      'SELECT id, slug, title FROM workspaces ORDER BY slug',
      [],
      { schema: 'content' }
    );

    console.log('=== WORKSPACE NODE COUNTS ===\n');

    let totalNodes = 0;
    const workspaceData: Array<{ slug: string; title: string; nodeCount: number }> = [];

    for (const ws of workspaces.rows) {
      const nodes = await dbAdapter.query(
        'SELECT COUNT(*) as count FROM workspace_nodes WHERE workspace_id = ?',
        [ws.id],
        { schema: 'content' }
      );
      const count = Number(nodes.rows[0].count);
      totalNodes += count;
      workspaceData.push({
        slug: ws.slug,
        title: ws.title,
        nodeCount: count,
      });
    }

    // Sort by node count descending
    workspaceData.sort((a, b) => b.nodeCount - a.nodeCount);

    // Display results
    for (const ws of workspaceData) {
      console.log(`${ws.slug.padEnd(20)} ${String(ws.nodeCount).padStart(4)} nodes  (${ws.title})`);
    }

    console.log('\n' + '='.repeat(50));
    console.log(`TOTAL: ${totalNodes} nodes across ${workspaces.rows.length} workspaces`);
    console.log('='.repeat(50) + '\n');

    // Check for any nodes with HTML content vs markdown
    const htmlNodes = await dbAdapter.query(
      `SELECT COUNT(*) as count FROM workspace_nodes
       WHERE json_extract(content, '$.markdown') LIKE '%<p>%'
          OR json_extract(content, '$.markdown') LIKE '%<strong>%'
          OR json_extract(content, '$.markdown') LIKE '%<em>%'`,
      [],
      { schema: 'content' }
    );

    console.log('Content Analysis:');
    console.log(`  Nodes with HTML content: ${htmlNodes.rows[0].count}`);
    console.log(
      `  Nodes with Markdown: ${totalNodes - Number(htmlNodes.rows[0].count)} (estimated)\n`
    );
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

checkWorkspaces()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
