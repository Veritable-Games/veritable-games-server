#!/usr/bin/env node

/**
 * Backup Projects Before Migration
 *
 * Creates a JSON backup of all 6 main projects before migration to wiki archive.
 * Saves project data and revision history to a timestamped file.
 *
 * Usage: node frontend/scripts/archive/backup-before-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const PROJECTS_TO_BACKUP = [
  'noxii',
  'autumn',
  'dodec',
  'on-command',
  'cosmic-knights',
  'project-coalesce',
];

async function backupProjects() {
  try {
    console.log('\n📦 Backing up project content...\n');

    const backup = {
      timestamp: new Date().toISOString(),
      projects: [],
    };

    for (const slug of PROJECTS_TO_BACKUP) {
      console.log(`  Backing up: ${slug}...`);

      // Get project data
      const projectResult = await pool.query(
        `SELECT id, slug, title, description, status, category, color, created_at, updated_at, content
         FROM content.projects
         WHERE slug = $1`,
        [slug]
      );

      if (projectResult.rows.length === 0) {
        console.log(`  ⚠️  Project '${slug}' not found`);
        continue;
      }

      const project = projectResult.rows[0];

      // Get revisions
      const revisionsResult = await pool.query(
        `SELECT id, content, revision_summary, created_at, created_by
         FROM content.project_revisions
         WHERE project_id = $1
         ORDER BY created_at ASC`,
        [project.id]
      );

      backup.projects.push({
        project: project,
        revisions: revisionsResult.rows,
      });

      console.log(`    ✓ ${revisionsResult.rows.length} revisions`);
    }

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `project-backup-${timestamp}.json`;
    const backupPath = path.join(__dirname, filename);

    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');

    console.log(`\n✅ Backup complete: ${filename}`);
    console.log(`   Location: ${backupPath}`);
    console.log(`   Projects: ${backup.projects.length}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

backupProjects();
