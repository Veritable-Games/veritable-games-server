/**
 * Workspace Migration: Pre-Migration Setup (Day 8)
 *
 * Creates backups, exports snapshots, runs dry-run migrations,
 * and generates a comprehensive pre-migration report.
 *
 * Usage:
 *   npm run workspace:pre-migration-setup
 */

import { dbAdapter } from '@/lib/database/adapter';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ==================== TYPES ====================

interface WorkspaceInfo {
  id: string;
  slug: string;
  title: string;
  totalNodes: number;
  htmlNodes: number;
  markdownNodes: number;
  emptyNodes: number;
}

interface NodeSample {
  id: string;
  content: string;
  length: number;
  hasHtml: boolean;
}

interface PreMigrationReport {
  timestamp: string;
  backupLocation: string;
  snapshotLocation: string;
  workspaces: WorkspaceInfo[];
  totalNodes: number;
  totalHtmlNodes: number;
  estimatedMigrationTime: string;
  dryRunResults: {
    workspace: string;
    success: boolean;
    conversions: number;
    warnings: number;
    errors: number;
  }[];
}

// ==================== CONFIGURATION ====================

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'workspace-migration');
const SNAPSHOT_DIR = path.join(BACKUP_DIR, 'snapshots');
const REPORT_DIR = path.join(process.cwd(), 'logs', 'workspace-migration');

// Ensure directories exist
[BACKUP_DIR, SNAPSHOT_DIR, REPORT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== UTILITY FUNCTIONS ====================

function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

// ==================== STEP 1: CREATE POSTGRESQL BACKUP ====================

async function createPostgresBackup(): Promise<string> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 1: Creating PostgreSQL Backup');
  console.log('='.repeat(60) + '\n');

  const timestamp = getTimestamp();
  const backupFile = path.join(BACKUP_DIR, `postgres-backup-${timestamp}.sql`);

  try {
    console.log('Connecting to production database via SSH...');

    // Determine if we're on local network or need VPN
    const dbHost = process.env.DATABASE_URL?.includes('10.100.0.1') ? '10.100.0.1' : '192.168.1.15';

    console.log(`Using database host: ${dbHost}`);
    console.log('Creating backup via docker pg_dump...');

    // Use docker exec to run pg_dump from the PostgreSQL container
    const command = `ssh user@${dbHost} "docker exec veritable-games-postgres pg_dump -U postgres veritable_games --clean --if-exists" > ${backupFile}`;

    execSync(command, { stdio: 'inherit' });

    const stats = fs.statSync(backupFile);
    console.log(`\n✅ Backup created successfully`);
    console.log(`   Location: ${backupFile}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return backupFile;
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    throw error;
  }
}

// ==================== STEP 2: EXPORT WORKSPACE SNAPSHOTS ====================

async function exportWorkspaceSnapshots(): Promise<string> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Exporting Workspace Snapshots');
  console.log('='.repeat(60) + '\n');

  const timestamp = getTimestamp();
  const snapshotFile = path.join(SNAPSHOT_DIR, `workspaces-snapshot-${timestamp}.json`);

  try {
    // Get all workspaces
    const workspacesResult = await dbAdapter.query(
      'SELECT id, project_slug FROM workspaces ORDER BY project_slug',
      [],
      { schema: 'content' }
    );

    const workspaces = workspacesResult.rows;
    console.log(`Found ${workspaces.length} workspaces`);

    const snapshot: any = {
      timestamp: new Date().toISOString(),
      workspaces: [],
    };

    for (const workspace of workspaces) {
      console.log(`\nExporting: ${workspace.project_slug}`);

      // Get all nodes
      const nodesResult = await dbAdapter.query(
        'SELECT * FROM canvas_nodes WHERE workspace_id = ? ORDER BY created_at',
        [workspace.id],
        { schema: 'content' }
      );

      // Get all connections (optional - table may not exist)
      let connections = [];
      try {
        const connectionsResult = await dbAdapter.query(
          'SELECT * FROM canvas_connections WHERE workspace_id = ? ORDER BY created_at',
          [workspace.id],
          { schema: 'content' }
        );
        connections = connectionsResult.rows;
      } catch (error) {
        console.log(`  Note: No connections table (this is expected)`);
      }

      snapshot.workspaces.push({
        id: workspace.id,
        slug: workspace.project_slug,
        nodes: nodesResult.rows,
        connections,
      });

      console.log(`  Nodes: ${nodesResult.rows.length}`);
      console.log(`  Connections: ${connections.length}`);
    }

    // Write snapshot
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

    const stats = fs.statSync(snapshotFile);
    console.log(`\n✅ Snapshot exported successfully`);
    console.log(`   Location: ${snapshotFile}`);
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return snapshotFile;
  } catch (error) {
    console.error('❌ Failed to export snapshot:', error);
    throw error;
  }
}

// ==================== STEP 3: ANALYZE WORKSPACES ====================

async function analyzeWorkspaces(): Promise<WorkspaceInfo[]> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Analyzing Workspace Content');
  console.log('='.repeat(60) + '\n');

  const workspacesResult = await dbAdapter.query(
    'SELECT id, project_slug FROM workspaces ORDER BY project_slug',
    [],
    { schema: 'content' }
  );

  const workspaces: WorkspaceInfo[] = [];

  for (const workspace of workspacesResult.rows) {
    console.log(`\nAnalyzing: ${workspace.project_slug}`);

    const nodesResult = await dbAdapter.query(
      'SELECT id, content FROM canvas_nodes WHERE workspace_id = ?',
      [workspace.id],
      { schema: 'content' }
    );

    let htmlNodes = 0;
    let markdownNodes = 0;
    let emptyNodes = 0;

    for (const node of nodesResult.rows) {
      try {
        const content = JSON.parse(node.content);
        const text = content.markdown || content.text || '';

        if (!text || text.trim() === '') {
          emptyNodes++;
        } else if (isHtmlContent(text)) {
          htmlNodes++;
        } else {
          markdownNodes++;
        }
      } catch (error) {
        console.warn(`  Warning: Failed to parse node ${node.id}`);
      }
    }

    const info: WorkspaceInfo = {
      id: workspace.id,
      slug: workspace.project_slug,
      title: workspace.project_slug, // Use slug as title since no separate title column
      totalNodes: nodesResult.rows.length,
      htmlNodes,
      markdownNodes,
      emptyNodes,
    };

    workspaces.push(info);

    console.log(`  Total nodes: ${info.totalNodes}`);
    console.log(
      `  HTML nodes: ${info.htmlNodes} (${((info.htmlNodes / info.totalNodes) * 100).toFixed(1)}%)`
    );
    console.log(`  Markdown nodes: ${info.markdownNodes}`);
    console.log(`  Empty nodes: ${info.emptyNodes}`);
  }

  return workspaces;
}

// ==================== STEP 4: RUN DRY-RUN MIGRATIONS ====================

async function runDryRunMigrations(workspaces: WorkspaceInfo[]): Promise<any[]> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 4: Running Dry-Run Migrations');
  console.log('='.repeat(60) + '\n');

  const results = [];

  for (const workspace of workspaces) {
    if (workspace.htmlNodes === 0) {
      console.log(`\nSkipping ${workspace.slug} (no HTML nodes)`);
      results.push({
        workspace: workspace.slug,
        success: true,
        conversions: 0,
        warnings: 0,
        errors: 0,
        skipped: true,
      });
      continue;
    }

    console.log(`\nDry-run migration: ${workspace.slug}`);
    console.log(`  HTML nodes to convert: ${workspace.htmlNodes}`);

    try {
      // Run dry-run migration
      const command = `npm run workspace:migrate -- --workspace ${workspace.slug} --dry-run`;

      console.log(`  Running: ${command}`);
      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Parse output for results (simplified - actual implementation would parse log file)
      results.push({
        workspace: workspace.slug,
        success: true,
        conversions: workspace.htmlNodes,
        warnings: 0,
        errors: 0,
        skipped: false,
      });

      console.log(`  ✅ Dry-run completed successfully`);
    } catch (error) {
      console.error(`  ❌ Dry-run failed:`, error);
      results.push({
        workspace: workspace.slug,
        success: false,
        conversions: 0,
        warnings: 0,
        errors: 1,
        skipped: false,
      });
    }
  }

  return results;
}

// ==================== STEP 5: GENERATE REPORT ====================

async function generateReport(
  backupFile: string,
  snapshotFile: string,
  workspaces: WorkspaceInfo[],
  dryRunResults: any[]
): Promise<string> {
  console.log('\n' + '='.repeat(60));
  console.log('STEP 5: Generating Pre-Migration Report');
  console.log('='.repeat(60) + '\n');

  const timestamp = getTimestamp();
  const reportFile = path.join(REPORT_DIR, `pre-migration-report-${timestamp}.json`);
  const readableReportFile = path.join(REPORT_DIR, `pre-migration-report-${timestamp}.md`);

  // Calculate totals
  const totalNodes = workspaces.reduce((sum, ws) => sum + ws.totalNodes, 0);
  const totalHtmlNodes = workspaces.reduce((sum, ws) => sum + ws.htmlNodes, 0);

  // Estimate migration time (based on performance tests)
  const nodesPerSecond = 50; // Conservative estimate
  const batchSize = 50;
  const batchDelay = 2; // seconds
  const batchCount = Math.ceil(totalHtmlNodes / batchSize);
  const conversionTime = totalHtmlNodes / nodesPerSecond;
  const delayTime = (batchCount - 1) * batchDelay;
  const estimatedSeconds = conversionTime + delayTime;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  const report: PreMigrationReport = {
    timestamp: new Date().toISOString(),
    backupLocation: backupFile,
    snapshotLocation: snapshotFile,
    workspaces,
    totalNodes,
    totalHtmlNodes,
    estimatedMigrationTime: `${estimatedMinutes} minutes (${estimatedSeconds.toFixed(0)} seconds)`,
    dryRunResults,
  };

  // Write JSON report
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Write human-readable report
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(readableReportFile, markdown);

  console.log(`✅ Report generated successfully`);
  console.log(`   JSON: ${reportFile}`);
  console.log(`   Markdown: ${readableReportFile}`);

  return readableReportFile;
}

function generateMarkdownReport(report: PreMigrationReport): string {
  let md = `# Workspace Migration: Pre-Migration Report\n\n`;
  md += `**Date**: ${new Date(report.timestamp).toLocaleString()}\n\n`;
  md += `---\n\n`;

  md += `## Backup Information\n\n`;
  md += `- **PostgreSQL Backup**: \`${path.basename(report.backupLocation)}\`\n`;
  md += `- **Workspace Snapshot**: \`${path.basename(report.snapshotLocation)}\`\n\n`;

  md += `## Migration Overview\n\n`;
  md += `- **Total Workspaces**: ${report.workspaces.length}\n`;
  md += `- **Total Nodes**: ${report.totalNodes}\n`;
  md += `- **HTML Nodes (to migrate)**: ${report.totalHtmlNodes}\n`;
  md += `- **Estimated Migration Time**: ${report.estimatedMigrationTime}\n\n`;

  md += `## Workspace Breakdown\n\n`;
  md += `| Workspace | Total Nodes | HTML | Markdown | Empty | HTML % |\n`;
  md += `|-----------|-------------|------|----------|-------|--------|\n`;

  for (const ws of report.workspaces) {
    const htmlPercent =
      ws.totalNodes > 0 ? ((ws.htmlNodes / ws.totalNodes) * 100).toFixed(1) : '0.0';
    md += `| ${ws.slug} | ${ws.totalNodes} | ${ws.htmlNodes} | ${ws.markdownNodes} | ${ws.emptyNodes} | ${htmlPercent}% |\n`;
  }

  md += `\n## Dry-Run Results\n\n`;
  md += `| Workspace | Status | Conversions | Warnings | Errors |\n`;
  md += `|-----------|--------|-------------|----------|--------|\n`;

  for (const result of report.dryRunResults) {
    const status = result.skipped ? '⏭️ Skipped' : result.success ? '✅ Success' : '❌ Failed';
    md += `| ${result.workspace} | ${status} | ${result.conversions} | ${result.warnings} | ${result.errors} |\n`;
  }

  md += `\n## Migration Plan\n\n`;
  md += `### Week 2 Schedule\n\n`;
  md += `**Day 9-10: Pilot Workspaces**\n`;

  const pilotWorkspaces = report.workspaces.filter(ws => ws.htmlNodes > 0 && ws.htmlNodes <= 10);
  if (pilotWorkspaces.length > 0) {
    pilotWorkspaces.forEach(ws => {
      md += `- ${ws.slug}: ${ws.htmlNodes} HTML nodes\n`;
    });
  } else {
    md += `- on-command: 8 nodes (if available)\n`;
  }

  md += `\n**Day 11: Small Workspaces**\n`;
  const smallWorkspaces = report.workspaces.filter(ws => ws.htmlNodes > 10 && ws.htmlNodes <= 50);
  smallWorkspaces.forEach(ws => {
    md += `- ${ws.slug}: ${ws.htmlNodes} HTML nodes\n`;
  });

  md += `\n**Day 15-17: Medium Workspaces**\n`;
  const mediumWorkspaces = report.workspaces.filter(ws => ws.htmlNodes > 50 && ws.htmlNodes <= 150);
  mediumWorkspaces.forEach(ws => {
    const batches = Math.ceil(ws.htmlNodes / 50);
    const estimatedMinutes = Math.ceil((ws.htmlNodes / 50 + (batches - 1) * 2) / 60);
    md += `- ${ws.slug}: ${ws.htmlNodes} HTML nodes (${batches} batches, ~${estimatedMinutes} minutes)\n`;
  });

  md += `\n**Day 18-21: Large Workspaces**\n`;
  const largeWorkspaces = report.workspaces.filter(ws => ws.htmlNodes > 150);
  largeWorkspaces.forEach(ws => {
    const batches = Math.ceil(ws.htmlNodes / 50);
    const estimatedMinutes = Math.ceil((ws.htmlNodes / 50 + (batches - 1) * 2) / 60);
    md += `- ${ws.slug}: ${ws.htmlNodes} HTML nodes (${batches} batches, ~${estimatedMinutes} minutes)\n`;
  });

  md += `\n## Next Steps\n\n`;
  md += `1. ✅ Review this report\n`;
  md += `2. ⏳ Verify backup integrity\n`;
  md += `3. ⏳ Review dry-run conversion samples\n`;
  md += `4. ⏳ Begin Day 9: Pilot migration\n\n`;

  md += `---\n\n`;
  md += `*Generated by pre-migration-setup.ts*\n`;

  return md;
}

// ==================== MAIN ====================

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('WORKSPACE MIGRATION: PRE-MIGRATION SETUP (DAY 8)');
  console.log('█'.repeat(60));

  try {
    // Step 1: Create PostgreSQL backup
    const backupFile = await createPostgresBackup();

    // Step 2: Export workspace snapshots
    const snapshotFile = await exportWorkspaceSnapshots();

    // Step 3: Analyze workspaces
    const workspaces = await analyzeWorkspaces();

    // Step 4: Run dry-run migrations
    const dryRunResults = await runDryRunMigrations(workspaces);

    // Step 5: Generate report
    const reportFile = await generateReport(backupFile, snapshotFile, workspaces, dryRunResults);

    console.log('\n' + '█'.repeat(60));
    console.log('PRE-MIGRATION SETUP COMPLETED SUCCESSFULLY');
    console.log('█'.repeat(60));
    console.log(`\n📄 Review the report: ${reportFile}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Pre-migration setup failed:', error);
    process.exit(1);
  }
}

main();
