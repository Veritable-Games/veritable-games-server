#!/usr/bin/env node

/**
 * Reprocess Existing Avatars
 *
 * Converts all existing avatars to optimized WebP format:
 * - Resize to max 512x512
 * - Convert to WebP (~70% smaller)
 * - Update database references
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const AVATAR_MAX_SIZE = 512;
const AVATAR_QUALITY = 85;

async function reprocessAvatars() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  });

  const avatarDir = path.join(process.cwd(), 'data', 'uploads', 'avatars');

  console.log('🖼️  Reprocessing Avatars\n');
  console.log('Avatar directory:', avatarDir);
  console.log(
    'Database:',
    (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.split('@')[1] || 'localhost'
  );

  try {
    // Check if avatar directory exists
    try {
      await fs.access(avatarDir);
    } catch {
      console.log('\n⚠️  No avatar directory found. Nothing to reprocess.');
      return;
    }

    // Get all users with avatars
    const usersResult = await pool.query(
      `SELECT id, username, avatar_url FROM users.users WHERE avatar_url IS NOT NULL AND avatar_url != ''`
    );

    console.log(`\n📋 Found ${usersResult.rows.length} users with avatars\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersResult.rows) {
      try {
        // Extract filename from avatar URL
        // Format: /api/users/{id}/avatar/serve?file={filename}
        const match = user.avatar_url.match(/file=([^&]+)/);
        if (!match) {
          console.log(`⏭️  ${user.username}: No file parameter in URL, skipping`);
          skipped++;
          continue;
        }

        const oldFilename = match[1];

        // Skip if already WebP
        if (oldFilename.endsWith('.webp')) {
          console.log(`✅ ${user.username}: Already WebP, skipping`);
          skipped++;
          continue;
        }

        const oldFilePath = path.join(avatarDir, oldFilename);

        // Check if file exists
        try {
          await fs.access(oldFilePath);
        } catch {
          console.log(`⚠️  ${user.username}: File not found (${oldFilename}), skipping`);
          skipped++;
          continue;
        }

        // Read original file
        const originalBuffer = await fs.readFile(oldFilePath);
        const originalSize = originalBuffer.length;

        // Generate new filename with .webp extension
        const baseName = oldFilename.replace(/\.(jpg|jpeg|png|gif)$/i, '');
        const newFilename = `${baseName}.webp`;
        const newFilePath = path.join(avatarDir, newFilename);

        // Process with Sharp
        const optimizedBuffer = await sharp(originalBuffer)
          .resize(AVATAR_MAX_SIZE, AVATAR_MAX_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: AVATAR_QUALITY })
          .toBuffer();

        const newSize = optimizedBuffer.length;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

        // Write optimized file
        await fs.writeFile(newFilePath, optimizedBuffer);

        // Update database
        const newAvatarUrl = `/api/users/${user.id}/avatar/serve?file=${newFilename}`;
        await pool.query(`UPDATE users.users SET avatar_url = $1 WHERE id = $2`, [
          newAvatarUrl,
          user.id,
        ]);

        // Delete old file (optional - keep for safety)
        // await fs.unlink(oldFilePath);

        console.log(
          `✅ ${user.username}: ${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${savings}% smaller)`
        );
        processed++;
      } catch (err) {
        console.error(`❌ ${user.username}: Error - ${err.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

reprocessAvatars()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
