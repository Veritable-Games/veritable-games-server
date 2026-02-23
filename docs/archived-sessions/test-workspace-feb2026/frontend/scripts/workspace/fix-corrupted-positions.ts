/**
 * Fix corrupted node positions in the database
 *
 * Some nodes have position values stored as corrupted strings like
 * "400100100100100100100100100100100" due to string concatenation bugs.
 *
 * This script resets them to reasonable default positions.
 *
 * Run with: npx tsx scripts/workspace/fix-corrupted-positions.ts
 */

import { Pool } from 'pg';

const DATABASE_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/veritable_games';

async function main() {
  console.log('Fixing corrupted node positions...');
  console.log('Database:', DATABASE_URL.replace(/:[^:]*@/, ':***@'));

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Get all nodes to check for corrupted positions
    const result = await pool.query(`
      SELECT id, position_x, position_y, workspace_id
      FROM content.canvas_nodes
      WHERE is_deleted = false
    `);

    console.log(`Found ${result.rows.length} nodes to check`);

    let corruptedCount = 0;
    let fixedCount = 0;

    for (const row of result.rows) {
      const { id, position_x, position_y, workspace_id } = row;

      const x = position_x;
      const y = position_y;

      console.log(`Node ${id}: x=${x} (${typeof x}), y=${y} (${typeof y})`);

      // Check for corruption - position values stored as strings or unreasonable numbers
      const numX = Number(x);
      const numY = Number(y);

      const isCorrupted =
        typeof x === 'string' ||
        typeof y === 'string' ||
        !Number.isFinite(numX) ||
        !Number.isFinite(numY) ||
        numX > 10000 ||
        numX < -10000 ||
        numY > 10000 ||
        numY < -10000;

      if (isCorrupted) {
        console.log(`  -> CORRUPTED! x=${x}, y=${y}`);
        corruptedCount++;

        // Reset to a reasonable default position based on index
        const newX = 100 + (fixedCount % 5) * 250;
        const newY = 100 + Math.floor(fixedCount / 5) * 200;

        console.log(`  -> Fixing to x=${newX}, y=${newY}`);

        await pool.query(
          `
          UPDATE content.canvas_nodes
          SET position_x = $1, position_y = $2, updated_at = NOW()
          WHERE id = $3
        `,
          [newX, newY, id]
        );

        fixedCount++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Total nodes: ${result.rows.length}`);
    console.log(`  Corrupted: ${corruptedCount}`);
    console.log(`  Fixed: ${fixedCount}`);

    if (fixedCount > 0) {
      console.log(`\n✅ Fixed ${fixedCount} corrupted node positions`);
    } else if (corruptedCount > 0) {
      console.log(`\n⚠️ Found ${corruptedCount} corrupted nodes but couldn't fix them`);
    } else {
      console.log(`\n✅ No corrupted positions found`);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
