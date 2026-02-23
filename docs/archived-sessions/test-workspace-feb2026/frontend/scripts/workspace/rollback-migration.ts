/**
 * Workspace Migration Rollback Script
 *
 * Restores workspace nodes from HTML backup to their pre-migration state.
 * Uses the _html_backup field stored during migration.
 *
 * Usage:
 *   npm run workspace:rollback -- --workspace autumn --dry-run
 *   npm run workspace:rollback -- --workspace autumn --execute
 */

import { dbAdapter } from '@/lib/database/adapter';
import * as fs from 'fs';
import * as path from 'path';

// ==================== TYPES ====================

interface RollbackOptions {
  workspace: string;
  dryRun: boolean;
}

interface WorkspaceNode {
  id: string;
  workspace_id: string;
  content: string; // JSON string
}

interface NodeContent {
  markdown?: string;
  text?: string;
  title?: string;
  _html_backup?: string;
}

interface RollbackReport {
  workspace: string;
  totalNodes: number;
  nodesWithBackup: number;
  rolledBack: number;
  noBackup: number;
  errors: Array<{ nodeId: string; error: string }>;
  duration: number;
}

// ==================== HELPER FUNCTIONS ====================

const LOG_DIR = path.join(process.cwd(), 'logs', 'workspace-migration');

function getLogFilePath(workspaceSlug: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIR, `rollback-${workspaceSlug}-${timestamp}.json`);
}

// ==================== DATABASE OPERATIONS ====================

async function loadWorkspaceNodes(workspaceSlug: string): Promise<WorkspaceNode[]> {
  // Get workspace ID from slug
  const workspaceResult = await dbAdapter.query(
    'SELECT id FROM workspaces WHERE project_slug = ?',
    [workspaceSlug],
    { schema: 'content' }
  );

  if (workspaceResult.rows.length === 0) {
    throw new Error(`Workspace not found: ${workspaceSlug}`);
  }

  const workspaceId = workspaceResult.rows[0].id;

  // Load all nodes for workspace
  const result = await dbAdapter.query(
    'SELECT * FROM canvas_nodes WHERE workspace_id = ? ORDER BY created_at',
    [workspaceId],
    { schema: 'content' }
  );

  return result.rows as WorkspaceNode[];
}

async function rollbackNode(nodeId: string, htmlBackup: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would restore node ${nodeId} to HTML`);
    return;
  }

  // Load current node content
  const result = await dbAdapter.query('SELECT content FROM canvas_nodes WHERE id = ?', [nodeId], {
    schema: 'content',
  });

  if (result.rows.length === 0) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const content: NodeContent = JSON.parse(result.rows[0].content);

  // Restore HTML from backup
  content.markdown = htmlBackup;

  // Remove backup field
  delete content._html_backup;

  // Update node
  await dbAdapter.query(
    'UPDATE canvas_nodes SET content = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(content), new Date().toISOString(), nodeId],
    { schema: 'content' }
  );
}

// ==================== MAIN ROLLBACK FUNCTION ====================

async function rollbackWorkspace(options: RollbackOptions): Promise<RollbackReport> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`WORKSPACE ROLLBACK: ${options.workspace}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Load all nodes
  console.log('Loading workspace nodes...');
  const allNodes = await loadWorkspaceNodes(options.workspace);
  console.log(`Loaded ${allNodes.length} total nodes`);

  // Filter to nodes with backup
  const nodesWithBackup = allNodes.filter(node => {
    const content: NodeContent = JSON.parse(node.content);
    return !!content._html_backup;
  });

  console.log(`Found ${nodesWithBackup.length} nodes with HTML backup`);
  console.log(`Found ${allNodes.length - nodesWithBackup.length} nodes without backup (skip)\n`);

  if (nodesWithBackup.length === 0) {
    console.log('No nodes to rollback. Exiting.');
    return {
      workspace: options.workspace,
      totalNodes: allNodes.length,
      nodesWithBackup: 0,
      rolledBack: 0,
      noBackup: allNodes.length,
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  // Rollback each node
  const errors: Array<{ nodeId: string; error: string }> = [];
  let rolledBack = 0;

  for (const node of nodesWithBackup) {
    try {
      const content: NodeContent = JSON.parse(node.content);
      const htmlBackup = content._html_backup!;

      await rollbackNode(node.id, htmlBackup, options.dryRun);
      rolledBack++;

      if (rolledBack % 50 === 0) {
        console.log(`Progress: ${rolledBack}/${nodesWithBackup.length} nodes rolled back`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to rollback node ${node.id}: ${errorMessage}`);
      errors.push({ nodeId: node.id, error: errorMessage });
    }
  }

  const duration = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log('ROLLBACK COMPLETED');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Nodes: ${allNodes.length}`);
  console.log(`Nodes with Backup: ${nodesWithBackup.length}`);
  console.log(`Rolled Back Successfully: ${rolledBack}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`No Backup: ${allNodes.length - nodesWithBackup.length}`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`${'='.repeat(60)}\n`);

  // Save log file
  const report: RollbackReport = {
    workspace: options.workspace,
    totalNodes: allNodes.length,
    nodesWithBackup: nodesWithBackup.length,
    rolledBack,
    noBackup: allNodes.length - nodesWithBackup.length,
    errors,
    duration,
  };

  const logPath = getLogFilePath(options.workspace);
  fs.writeFileSync(logPath, JSON.stringify(report, null, 2));
  console.log(`Log saved to: ${logPath}\n`);

  return report;
}

// ==================== CLI ====================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: RollbackOptions = {
    workspace: '',
    dryRun: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--workspace' && i + 1 < args.length) {
      options.workspace = args[i + 1];
      i++;
    } else if (arg === '--execute') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  // Validate options
  if (!options.workspace) {
    console.error('Error: --workspace is required');
    console.log('\nUsage:');
    console.log('  npm run workspace:rollback -- --workspace <slug> [options]');
    console.log('\nOptions:');
    console.log('  --workspace <slug>  Workspace slug (required)');
    console.log('  --execute           Execute rollback (default: dry-run)');
    console.log('  --dry-run           Preview changes without executing');
    console.log('\nExamples:');
    console.log('  npm run workspace:rollback -- --workspace autumn --dry-run');
    console.log('  npm run workspace:rollback -- --workspace autumn --execute');
    process.exit(1);
  }

  try {
    await rollbackWorkspace(options);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Rollback failed:', error);
    process.exit(1);
  }
}

main();
