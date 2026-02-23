/**
 * Workspace HTML → Markdown Migration Script (BATCH PROCESSING)
 *
 * Converts workspace nodes from HTML (Tiptap) storage to pure Markdown.
 * Designed to handle large workspaces (414+ nodes) with batch processing.
 *
 * Usage:
 *   npm run workspace:migrate -- --workspace autumn --dry-run
 *   npm run workspace:migrate -- --workspace autumn --execute --batch-size 50
 *   npm run workspace:migrate -- --workspace autumn --execute --resume
 */

import { dbAdapter } from '@/lib/database/adapter';
import TurndownService from 'turndown';
import * as fs from 'fs';
import * as path from 'path';

// ==================== TYPES ====================

interface MigrationOptions {
  workspace: string;
  batchSize: number;
  dryRun: boolean;
  resume: boolean;
}

interface WorkspaceNode {
  id: string;
  workspace_id: string;
  content: string; // JSON string
  position: string; // JSON string
  style: string; // JSON string
  created_at: string;
  updated_at: string;
}

interface NodeContent {
  markdown?: string;
  text?: string;
  title?: string;
  _html_backup?: string;
}

interface ConversionResult {
  nodeId: string;
  originalHtml: string;
  convertedMarkdown: string;
  success: boolean;
  error?: string;
  warnings: string[];
}

interface MigrationProgress {
  workspaceId: string;
  workspaceSlug: string;
  totalNodes: number;
  htmlNodes: number;
  migratedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  lastUpdateTime: Date;
  status: 'in_progress' | 'completed' | 'failed';
}

interface MigrationReport {
  workspace: string;
  totalNodes: number;
  htmlNodes: number;
  migratedSuccessfully: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  errors: Array<{ nodeId: string; error: string }>;
  warnings: Array<{ nodeId: string; warning: string }>;
}

// ==================== CONFIGURATION ====================

const LOG_DIR = path.join(process.cwd(), 'logs', 'workspace-migration');
const PROGRESS_TABLE = 'workspace_migration_progress';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ==================== TURNDOWN CONFIGURATION ====================

function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: 'atx', // Use # for headings
    codeBlockStyle: 'fenced', // Use ``` for code blocks
    emDelimiter: '*', // Use * for emphasis
    strongDelimiter: '**', // Use ** for strong
    linkStyle: 'inlined', // Use [text](url) for links
  });

  // Custom rule: Preserve underline as HTML
  turndownService.addRule('underline', {
    filter: ['u'],
    replacement: content => `<u>${content}</u>`,
  });

  // Custom rule: Preserve color/style spans as HTML
  turndownService.addRule('coloredText', {
    filter: node => {
      if (node.nodeName === 'SPAN' && node.getAttribute('style')) {
        const style = node.getAttribute('style') || '';
        if (style.includes('color:') || style.includes('background-color:')) {
          return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute('style');
      return `<span style="${style}">${content}</span>`;
    },
  });

  // Custom rule: Preserve text-align divs as HTML
  turndownService.addRule('textAlign', {
    filter: node => {
      if (node.nodeName === 'DIV' && node.getAttribute('style')) {
        const style = node.getAttribute('style') || '';
        if (style.includes('text-align:')) {
          return true;
        }
      }
      return false;
    },
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute('style');
      return `<div style="${style}">${content}</div>`;
    },
  });

  // Custom rule: Convert strikethrough to markdown
  turndownService.addRule('strikethrough', {
    filter: ['s', 'strike', 'del'],
    replacement: content => `~~${content}~~`,
  });

  // Custom rule: Remove empty paragraphs
  turndownService.addRule('emptyParagraph', {
    filter: node => {
      return node.nodeName === 'P' && node.textContent?.trim() === '';
    },
    replacement: () => '',
  });

  return turndownService;
}

// ==================== HELPER FUNCTIONS ====================

function isHtmlContent(content: string): boolean {
  if (!content || !content.trim()) return false;

  // Check for HTML tags (Tiptap generates tags like <p>, <strong>, <em>, <ul>, etc.)
  const htmlTagPattern = /<[a-z][\s\S]*>/i;

  // Check for typical Tiptap HTML structure
  const hasParagraphTags = /<p>/i.test(content) || /<p\s/i.test(content);
  const hasStrongTags = /<strong>/i.test(content);
  const hasEmTags = /<em>/i.test(content);

  // If it has typical Tiptap HTML structure, treat as HTML
  if (hasParagraphTags || (hasStrongTags && hasEmTags)) {
    return true;
  }

  // Otherwise check for any HTML tags
  return htmlTagPattern.test(content);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLogFilePath(workspaceSlug: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIR, `migration-${workspaceSlug}-${timestamp}.json`);
}

// ==================== PROGRESS TRACKING ====================

async function loadMigrationProgress(workspaceId: string): Promise<MigrationProgress | null> {
  try {
    const result = await dbAdapter.query(
      `SELECT * FROM ${PROGRESS_TABLE} WHERE workspace_id = ? ORDER BY start_time DESC LIMIT 1`,
      [workspaceId],
      { schema: 'content' }
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      workspaceId: row.workspace_id,
      workspaceSlug: row.workspace_slug,
      totalNodes: row.total_nodes,
      htmlNodes: row.html_nodes,
      migratedNodes: row.migrated_nodes,
      failedNodes: row.failed_nodes,
      skippedNodes: row.skipped_nodes,
      currentBatch: row.current_batch,
      totalBatches: row.total_batches,
      startTime: new Date(row.start_time),
      lastUpdateTime: new Date(row.last_update_time),
      status: row.status,
    };
  } catch (error) {
    // Table might not exist yet
    console.log('No existing progress found (this is normal for first run)');
    return null;
  }
}

async function saveMigrationProgress(progress: MigrationProgress): Promise<void> {
  try {
    // Create table if not exists
    await dbAdapter.query(
      `CREATE TABLE IF NOT EXISTS ${PROGRESS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        workspace_slug TEXT NOT NULL,
        total_nodes INTEGER NOT NULL,
        html_nodes INTEGER NOT NULL,
        migrated_nodes INTEGER NOT NULL,
        failed_nodes INTEGER NOT NULL,
        skipped_nodes INTEGER NOT NULL,
        current_batch INTEGER NOT NULL,
        total_batches INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        last_update_time TEXT NOT NULL,
        status TEXT NOT NULL
      )`,
      [],
      { schema: 'content' }
    );

    // Insert or update progress
    await dbAdapter.query(
      `INSERT INTO ${PROGRESS_TABLE}
       (workspace_id, workspace_slug, total_nodes, html_nodes, migrated_nodes, failed_nodes,
        skipped_nodes, current_batch, total_batches, start_time, last_update_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        progress.workspaceId,
        progress.workspaceSlug,
        progress.totalNodes,
        progress.htmlNodes,
        progress.migratedNodes,
        progress.failedNodes,
        progress.skippedNodes,
        progress.currentBatch,
        progress.totalBatches,
        progress.startTime.toISOString(),
        progress.lastUpdateTime.toISOString(),
        progress.status,
      ],
      { schema: 'content' }
    );
  } catch (error) {
    console.error('Failed to save progress:', error);
    // Non-fatal - continue migration
  }
}

// ==================== CONVERSION ====================

function convertHtmlToMarkdown(html: string, turndown: TurndownService): ConversionResult {
  const warnings: string[] = [];

  try {
    // Clean up HTML before conversion
    let cleanedHtml = html.trim();

    // Convert to markdown
    const markdown = turndown.turndown(cleanedHtml);

    // Validation checks
    if (html.length > 10 && markdown.length === 0) {
      warnings.push('Conversion resulted in empty string from non-empty HTML');
    }

    const lengthRatio = markdown.length / html.length;
    if (lengthRatio < 0.3 || lengthRatio > 2.0) {
      warnings.push(`Length changed significantly (HTML: ${html.length}, MD: ${markdown.length})`);
    }

    return {
      nodeId: '',
      originalHtml: html,
      convertedMarkdown: markdown,
      success: true,
      warnings,
    };
  } catch (error) {
    return {
      nodeId: '',
      originalHtml: html,
      convertedMarkdown: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

async function convertBatch(
  nodes: WorkspaceNode[],
  turndown: TurndownService
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];

  for (const node of nodes) {
    try {
      const content: NodeContent = JSON.parse(node.content);
      const html = content.markdown || content.text || '';

      if (!isHtmlContent(html)) {
        // Skip non-HTML content
        results.push({
          nodeId: node.id,
          originalHtml: html,
          convertedMarkdown: html,
          success: true,
          warnings: ['Skipped: Not HTML content'],
        });
        continue;
      }

      const conversion = convertHtmlToMarkdown(html, turndown);
      conversion.nodeId = node.id;
      results.push(conversion);
    } catch (error) {
      results.push({
        nodeId: node.id,
        originalHtml: '',
        convertedMarkdown: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings: [],
      });
    }
  }

  return results;
}

// ==================== VALIDATION ====================

interface ValidationResult {
  valid: boolean;
  errors: Array<{ nodeId: string; error: string }>;
  warnings: Array<{ nodeId: string; warning: string }>;
}

function validateConversions(conversions: ConversionResult[]): ValidationResult {
  const errors: Array<{ nodeId: string; error: string }> = [];
  const warnings: Array<{ nodeId: string; warning: string }> = [];

  for (const conversion of conversions) {
    if (!conversion.success) {
      errors.push({
        nodeId: conversion.nodeId,
        error: conversion.error || 'Unknown error',
      });
    }

    for (const warning of conversion.warnings) {
      if (!warning.startsWith('Skipped:')) {
        warnings.push({
          nodeId: conversion.nodeId,
          warning,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
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

async function updateNodesBatch(conversions: ConversionResult[], dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log(`[DRY RUN] Would update ${conversions.length} nodes`);
    return;
  }

  for (const conversion of conversions) {
    if (!conversion.success) {
      continue; // Skip failed conversions
    }

    try {
      // Load current node content
      const result = await dbAdapter.query(
        'SELECT content FROM canvas_nodes WHERE id = ?',
        [conversion.nodeId],
        { schema: 'content' }
      );

      if (result.rows.length === 0) {
        console.error(`Node not found: ${conversion.nodeId}`);
        continue;
      }

      const content: NodeContent = JSON.parse(result.rows[0].content);

      // Backup original HTML
      content._html_backup = conversion.originalHtml;

      // Replace with markdown
      content.markdown = conversion.convertedMarkdown;

      // Update node
      await dbAdapter.query(
        'UPDATE canvas_nodes SET content = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(content), new Date().toISOString(), conversion.nodeId],
        { schema: 'content' }
      );
    } catch (error) {
      console.error(`Failed to update node ${conversion.nodeId}:`, error);
      throw error;
    }
  }
}

// ==================== MAIN MIGRATION FUNCTION ====================

async function migrateWorkspace(options: MigrationOptions): Promise<MigrationReport> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`WORKSPACE MIGRATION: ${options.workspace}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Batch Size: ${options.batchSize} nodes`);
  console.log(`${'='.repeat(60)}\n`);

  // Initialize turndown
  const turndown = createTurndownService();

  // Load all nodes
  console.log('Loading workspace nodes...');
  const allNodes = await loadWorkspaceNodes(options.workspace);
  console.log(`Loaded ${allNodes.length} total nodes`);

  // Filter to HTML nodes only
  const htmlNodes = allNodes.filter(node => {
    const content: NodeContent = JSON.parse(node.content);
    const text = content.markdown || content.text || '';
    return isHtmlContent(text);
  });
  console.log(`Found ${htmlNodes.length} HTML nodes (need conversion)`);
  console.log(`Found ${allNodes.length - htmlNodes.length} non-HTML nodes (skip)\n`);

  if (htmlNodes.length === 0) {
    console.log('No HTML nodes to migrate. Exiting.');
    return {
      workspace: options.workspace,
      totalNodes: allNodes.length,
      htmlNodes: 0,
      migratedSuccessfully: 0,
      failed: 0,
      skipped: allNodes.length,
      duration: Date.now() - startTime,
      errors: [],
      warnings: [],
    };
  }

  // Check for existing progress
  const workspaceId = allNodes[0]?.workspace_id;
  let progress: MigrationProgress;

  if (options.resume) {
    const existingProgress = await loadMigrationProgress(workspaceId);
    if (existingProgress) {
      console.log(
        `Resuming from batch ${existingProgress.currentBatch + 1}/${existingProgress.totalBatches}`
      );
      progress = existingProgress;
      progress.lastUpdateTime = new Date();
    } else {
      console.log('No existing progress found. Starting fresh.');
      options.resume = false;
    }
  }

  if (!options.resume) {
    // Create new progress
    const batches = chunkArray(htmlNodes, options.batchSize);
    progress = {
      workspaceId,
      workspaceSlug: options.workspace,
      totalNodes: allNodes.length,
      htmlNodes: htmlNodes.length,
      migratedNodes: 0,
      failedNodes: 0,
      skippedNodes: allNodes.length - htmlNodes.length,
      currentBatch: 0,
      totalBatches: batches.length,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      status: 'in_progress',
    };
  }

  // Split into batches
  const batches = chunkArray(htmlNodes, options.batchSize);
  const errors: Array<{ nodeId: string; error: string }> = [];
  const warnings: Array<{ nodeId: string; warning: string }> = [];

  // Process each batch
  for (let i = progress!.currentBatch; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;

    console.log(`\n--- Batch ${batchNumber}/${batches.length} (${batch.length} nodes) ---`);

    // Convert batch
    const conversions = await convertBatch(batch, turndown);

    // Validate conversions
    const validation = validateConversions(conversions);

    if (!validation.valid) {
      console.error(`❌ Batch ${batchNumber} validation failed:`);
      for (const error of validation.errors) {
        console.error(`  Node ${error.nodeId}: ${error.error}`);
      }
      errors.push(...validation.errors);

      // Save progress and halt
      progress!.status = 'failed';
      progress!.failedNodes += validation.errors.length;
      await saveMigrationProgress(progress!);

      throw new Error(`Validation failed on batch ${batchNumber}`);
    }

    // Show warnings
    if (validation.warnings.length > 0) {
      console.log(`⚠️  ${validation.warnings.length} warnings:`);
      for (const warning of validation.warnings.slice(0, 5)) {
        console.log(`  Node ${warning.nodeId}: ${warning.warning}`);
      }
      if (validation.warnings.length > 5) {
        console.log(`  ... and ${validation.warnings.length - 5} more`);
      }
      warnings.push(...validation.warnings);
    }

    // Update database
    await updateNodesBatch(conversions, options.dryRun);

    // Update progress
    const successfulConversions = conversions.filter(c => c.success).length;
    progress!.currentBatch = i + 1;
    progress!.migratedNodes += successfulConversions;
    progress!.lastUpdateTime = new Date();
    await saveMigrationProgress(progress!);

    console.log(
      `✅ Batch ${batchNumber} completed (${successfulConversions}/${batch.length} successful)`
    );

    // Wait between batches (prevent database overload)
    if (i < batches.length - 1) {
      console.log('Waiting 2 seconds before next batch...');
      await sleep(2000);
    }
  }

  // Mark as completed
  progress!.status = 'completed';
  await saveMigrationProgress(progress!);

  const duration = Date.now() - startTime;

  console.log(`\n${'='.repeat(60)}`);
  console.log('MIGRATION COMPLETED');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Nodes: ${allNodes.length}`);
  console.log(`HTML Nodes: ${htmlNodes.length}`);
  console.log(`Migrated Successfully: ${progress!.migratedNodes}`);
  console.log(`Failed: ${errors.length}`);
  console.log(`Skipped: ${allNodes.length - htmlNodes.length}`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`${'='.repeat(60)}\n`);

  // Save log file
  const report: MigrationReport = {
    workspace: options.workspace,
    totalNodes: allNodes.length,
    htmlNodes: htmlNodes.length,
    migratedSuccessfully: progress!.migratedNodes,
    failed: errors.length,
    skipped: allNodes.length - htmlNodes.length,
    duration,
    errors,
    warnings,
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
  const options: MigrationOptions = {
    workspace: '',
    batchSize: 50,
    dryRun: true,
    resume: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--workspace' && i + 1 < args.length) {
      options.workspace = args[i + 1];
      i++;
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      options.batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--execute') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--resume') {
      options.resume = true;
    }
  }

  // Validate options
  if (!options.workspace) {
    console.error('Error: --workspace is required');
    console.log('\nUsage:');
    console.log('  npm run workspace:migrate -- --workspace <slug> [options]');
    console.log('\nOptions:');
    console.log('  --workspace <slug>     Workspace slug (required)');
    console.log('  --batch-size <number>  Nodes per batch (default: 50)');
    console.log('  --execute              Execute migration (default: dry-run)');
    console.log('  --dry-run              Preview changes without executing');
    console.log('  --resume               Resume interrupted migration');
    console.log('\nExamples:');
    console.log('  npm run workspace:migrate -- --workspace autumn --dry-run');
    console.log('  npm run workspace:migrate -- --workspace autumn --execute --batch-size 50');
    console.log('  npm run workspace:migrate -- --workspace autumn --execute --resume');
    process.exit(1);
  }

  try {
    await migrateWorkspace(options);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
