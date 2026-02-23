#!/usr/bin/env node
/**
 * Import Projects from JSON Export
 *
 * Restores projects from JSON backup to PostgreSQL
 * Used for disaster recovery when server is rebuilt
 *
 * Usage:
 *   node scripts/import/import-projects-from-json.js [json-file]
 *   node scripts/import/import-projects-from-json.js data/exports/projects.json
 */

const fs = require('fs');
const path = require('path');
const { pgPool } = require('../../src/lib/database/pool-postgres');

const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function importProjects(jsonFilePath) {
  log('\n🎮 Importing Projects from JSON', 'cyan');
  log('================================================\n', 'cyan');

  // Read JSON file
  const fullPath = path.resolve(process.cwd(), jsonFilePath);

  if (!fs.existsSync(fullPath)) {
    log(`❌ File not found: ${fullPath}`, 'red');
    process.exit(1);
  }

  const jsonData = fs.readFileSync(fullPath, 'utf8');
  const projects = JSON.parse(jsonData);

  if (!Array.isArray(projects) || projects.length === 0) {
    log('⚠️  No projects to import (file is empty or invalid)', 'yellow');
    process.exit(0);
  }

  log(`Found ${projects.length} projects to import\n`, 'green');

  // Ensure content schema exists
  await pgPool.query('CREATE SCHEMA IF NOT EXISTS content');

  // Ensure projects table exists
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS content.projects (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      long_description TEXT,
      status VARCHAR(50),
      category VARCHAR(100),
      tags TEXT[],
      start_date DATE,
      end_date DATE,
      is_featured BOOLEAN DEFAULT false,
      is_published BOOLEAN DEFAULT false,
      author_id INTEGER,
      thumbnail_url VARCHAR(500),
      repository_url VARCHAR(500),
      demo_url VARCHAR(500),
      tech_stack TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const project of projects) {
    try {
      // Check if project already exists (by slug)
      const existing = await pgPool.query('SELECT id FROM content.projects WHERE slug = $1', [
        project.slug,
      ]);

      if (existing.rows.length > 0) {
        // Update existing project
        await pgPool.query(
          `
          UPDATE content.projects
          SET
            title = $1,
            description = $2,
            long_description = $3,
            status = $4,
            category = $5,
            tags = $6,
            start_date = $7,
            end_date = $8,
            is_featured = $9,
            is_published = $10,
            author_id = $11,
            thumbnail_url = $12,
            repository_url = $13,
            demo_url = $14,
            tech_stack = $15,
            updated_at = $16
          WHERE slug = $17
        `,
          [
            project.title,
            project.description,
            project.long_description,
            project.status,
            project.category,
            project.tags,
            project.start_date,
            project.end_date,
            project.is_featured ?? false,
            project.is_published ?? false,
            project.author_id,
            project.thumbnail_url,
            project.repository_url,
            project.demo_url,
            project.tech_stack,
            project.updated_at || new Date(),
            project.slug,
          ]
        );

        log(`  ✅ Updated: ${project.title} (${project.slug})`, 'green');
        updated++;
      } else {
        // Insert new project
        await pgPool.query(
          `
          INSERT INTO content.projects (
            title, slug, description, long_description, status, category,
            tags, start_date, end_date, is_featured, is_published, author_id,
            thumbnail_url, repository_url, demo_url, tech_stack,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `,
          [
            project.title,
            project.slug,
            project.description,
            project.long_description,
            project.status,
            project.category,
            project.tags,
            project.start_date,
            project.end_date,
            project.is_featured ?? false,
            project.is_published ?? false,
            project.author_id,
            project.thumbnail_url,
            project.repository_url,
            project.demo_url,
            project.tech_stack,
            project.created_at || new Date(),
            project.updated_at || new Date(),
          ]
        );

        log(`  ✅ Imported: ${project.title} (${project.slug})`, 'green');
        imported++;
      }
    } catch (error) {
      log(`  ❌ Error importing "${project.title}": ${error.message}`, 'red');
      errors++;
    }
  }

  log('\n================================================', 'cyan');
  log('📊 Import Summary:', 'cyan');
  log(`   New projects imported: ${imported}`, 'green');
  log(`   Projects updated: ${updated}`, 'yellow');
  log(`   Errors: ${errors}`, errors > 0 ? 'red' : 'green');
  log('================================================\n', 'cyan');

  if (errors > 0) {
    log('⚠️  Some projects failed to import. Check errors above.', 'yellow');
  } else {
    log('✅ Projects import complete!', 'green');
  }
}

// Main execution
const jsonFile = process.argv[2] || 'data/exports/projects.json';

importProjects(jsonFile)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
