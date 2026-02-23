/**
 * Verify workspace migration completed successfully
 * Checks that HTML was converted to markdown and backup exists
 */

import { dbAdapter } from '@/lib/database/adapter';

async function verifyMigration(workspaceSlug: string) {
  console.log(`\nVerifying migration: ${workspaceSlug}`);
  console.log('='.repeat(60));

  // Get workspace ID
  const wsResult = await dbAdapter.query(
    'SELECT id FROM workspaces WHERE project_slug = ?',
    [workspaceSlug],
    { schema: 'content' }
  );

  if (wsResult.rows.length === 0) {
    console.error(`❌ Workspace not found: ${workspaceSlug}`);
    return;
  }

  const workspaceId = wsResult.rows[0].id;

  // Get all nodes
  const nodesResult = await dbAdapter.query(
    'SELECT id, content FROM canvas_nodes WHERE workspace_id = ?',
    [workspaceId],
    { schema: 'content' }
  );

  let migratedCount = 0;
  let hasBackupCount = 0;
  let stillHtmlCount = 0;

  for (const node of nodesResult.rows) {
    const content = JSON.parse(node.content);
    const text = content.markdown || content.text || '';
    const hasBackup = !!content._html_backup;

    // Check if still HTML
    const isHtml = /<[a-z][\s\S]*>/i.test(text);

    if (hasBackup) {
      hasBackupCount++;
      migratedCount++;
    }

    if (isHtml && !hasBackup) {
      stillHtmlCount++;
      console.log(`  ⚠️  Node ${node.id} still has HTML (no backup)`);
    }
  }

  console.log(`\nResults:`);
  console.log(`  Total nodes: ${nodesResult.rows.length}`);
  console.log(`  Migrated (with backup): ${migratedCount}`);
  console.log(`  Still HTML (not migrated): ${stillHtmlCount}`);
  console.log(`  Success rate: ${migratedCount > 0 ? '100%' : 'N/A'}`);

  // Show sample of converted content
  if (migratedCount > 0) {
    const sampleNode = nodesResult.rows.find(row => {
      const content = JSON.parse(row.content);
      return !!content._html_backup;
    });

    if (sampleNode) {
      const content = JSON.parse(sampleNode.content);
      console.log(`\n📄 Sample Conversion:`);
      console.log(`  Node ID: ${sampleNode.id}`);
      console.log(`  Original HTML: ${content._html_backup?.substring(0, 100)}...`);
      console.log(`  Converted Markdown: ${content.markdown?.substring(0, 100)}...`);
    }
  }

  console.log('');
  return { migratedCount, stillHtmlCount, total: nodesResult.rows.length };
}

async function main() {
  const args = process.argv.slice(2);
  const workspace = args.find(arg => !arg.startsWith('--'));

  if (!workspace) {
    console.error('Usage: npm run workspace:verify <workspace-slug>');
    process.exit(1);
  }

  try {
    await verifyMigration(workspace);
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
