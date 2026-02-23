#!/usr/bin/env tsx
/**
 * Migration: Migrate team_members table to link with users table
 *
 * Changes:
 * - Add user_id column with foreign key to users.id
 * - Replace role field with tags (JSON array)
 * - Keep title for job titles
 * - Remove name, summary, image_url (pulled from users table)
 * - Add color field to commission_credits table
 */

import Database from 'better-sqlite3';
import { dbAdapter } from '../../../src/lib/database/adapter';
import { logger } from '../../../src/lib/utils/logger';

interface OldTeamMember {
  id: number;
  name: string;
  title: string | null;
  role: string;
  summary: string | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

async function migrateTeamMembers() {
  logger.info('Starting team_members migration...');

  try {
    // Step 1: Backup existing team_members data
    logger.info('Creating backup of team_members table...');
    const existingMembers = await dbAdapter.query<OldTeamMember>(
      `SELECT * FROM team_members ORDER BY id`,
      [],
      { schema: 'content' }
    );

    if (existingMembers.length > 0) {
      logger.info(`Backed up ${existingMembers.length} team member records`);

      // Save backup to JSON file
      const fs = await import('fs/promises');
      const path = await import('path');
      const backupDir = path.join(process.cwd(), 'data');
      const backupPath = path.join(backupDir, 'team_members_backup.json');

      // Ensure backup directory exists
      try {
        await fs.mkdir(backupDir, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }

      await fs.writeFile(backupPath, JSON.stringify(existingMembers, null, 2), 'utf-8');
      logger.info(`Backup saved to ${backupPath}`);
    } else {
      logger.info('No existing team members to backup');
    }

    // Step 2: Drop old team_members table
    logger.info('Dropping old team_members table...');
    await dbAdapter.query(`DROP TABLE IF EXISTS team_members`, [], { schema: 'content' });

    // Step 3: Create new team_members table
    logger.info('Creating new team_members table...');

    // Detect if we're using PostgreSQL or SQLite
    const isPostgres = process.env.DATABASE_MODE === 'production';

    const createTableQuery = isPostgres
      ? `CREATE TABLE team_members (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title TEXT,
          tags TEXT,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      : `CREATE TABLE team_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT,
          tags TEXT,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`;

    await dbAdapter.query(createTableQuery, [], { schema: 'content' });

    // Step 4: Create index on user_id (skip if exists)
    try {
      await dbAdapter.query(
        `CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)`,
        [],
        { schema: 'content' }
      );
    } catch (e) {
      logger.info('Index idx_team_members_user_id may already exist, continuing...');
    }

    // Step 5: Create index on display_order (skip if exists)
    try {
      await dbAdapter.query(
        `CREATE INDEX IF NOT EXISTS idx_team_members_display_order ON team_members(display_order)`,
        [],
        { schema: 'content' }
      );
    } catch (e) {
      logger.info('Index idx_team_members_display_order may already exist, continuing...');
    }

    logger.info('New team_members table created successfully');

    // Step 6: Migrate commission_credits table (add color field)
    logger.info('Migrating commission_credits table...');

    // Check if color column already exists
    const tableInfo = await dbAdapter.query<{ name: string }>(
      `PRAGMA table_info(commission_credits)`,
      [],
      { schema: 'content' }
    );

    const hasColorColumn = tableInfo.some(col => col.name === 'color');

    if (!hasColorColumn) {
      logger.info('Adding color column to commission_credits...');
      await dbAdapter.query(`ALTER TABLE commission_credits ADD COLUMN color TEXT`, [], {
        schema: 'content',
      });
      logger.info('Color column added successfully');
    } else {
      logger.info('Color column already exists, skipping...');
    }

    logger.info('Migration completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info(
      '1. Use the admin UI to add team members by selecting from users with role=admin/developer'
    );
    logger.info('2. Old team member data is backed up in ./data/team_members_backup.json');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateTeamMembers()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateTeamMembers };
