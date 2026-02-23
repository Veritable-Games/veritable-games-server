/**
 * Import Anarchist Tags Script
 * Reads anarchist-tags-review.csv and creates/updates tags in the library tag system
 *
 * Run with: npx ts-node src/scripts/import-anarchist-tags.ts
 * Requires: anarchist-tags-review.csv in project root (from map-anarchist-tags.ts)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '@/lib/utils/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TagMappingRow {
  tagName: string;
  tagCount: string;
  suggestedCategory: string;
  categoryColor: string;
  confidence: string;
  reason: string;
}

async function readCsv(filePath: string): Promise<TagMappingRow[]> {
  const rows: TagMappingRow[] = [];
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    // Simple CSV parsing (assumes no commas in values)
    const values = line.split(',').map(v => v.trim());

    const row: TagMappingRow = {
      tagName: values[0],
      tagCount: values[1],
      suggestedCategory: values[2],
      categoryColor: values[3],
      confidence: values[4],
      reason: values[5],
    };

    // Skip rows with "Skip" as category or empty rows
    if (row.suggestedCategory && row.suggestedCategory !== 'Skip' && row.tagName) {
      rows.push(row);
    }
  }

  return rows;
}

async function importAnarchistTags() {
  logger.info('📥 Starting anarchist tag import...\n');

  try {
    const csvPath = path.join(process.cwd(), 'anarchist-tags-review.csv');

    if (!fs.existsSync(csvPath)) {
      logger.error(`❌ File not found: ${csvPath}`);
      logger.info('Please run: npx ts-node src/scripts/map-anarchist-tags.ts');
      process.exit(1);
    }

    const rows = await readCsv(csvPath);
    logger.info(`📄 Read ${rows.length} tags from CSV\n`);

    // Group tags by category
    const tagsByCategory: Map<string, TagMappingRow[]> = new Map();
    for (const row of rows) {
      const category = row.suggestedCategory;
      if (!tagsByCategory.has(category)) {
        tagsByCategory.set(category, []);
      }
      tagsByCategory.get(category)!.push(row);
    }

    logger.info('📂 Tags by category:');
    for (const [category, tags] of Array.from(tagsByCategory.entries()).sort(
      (a, b) => b[1].length - a[1].length
    )) {
      logger.info(`   ${category}: ${tags.length} tags`);
    }
    logger.info();

    // Get or create tag categories
    const categoryMap: Map<string, string> = new Map();

    for (const category of tagsByCategory.keys()) {
      const { data: existingCats, error: catError } = await supabase
        .from('tag_categories')
        .select('id, name')
        .eq('name', category)
        .limit(1);

      if (catError) {
        logger.error(`❌ Error querying category ${category}: ${catError.message}`);
        continue;
      }

      let categoryId: string;

      if (existingCats && existingCats.length > 0) {
        categoryId = existingCats[0].id;
        logger.info(`✓ Found existing category: ${category}`);
      } else {
        // Create new category
        const { data: newCat, error: createError } = await supabase
          .from('tag_categories')
          .insert([
            {
              name: category,
              color: '#808080', // Default gray, will be overridden
              is_active: true,
            },
          ])
          .select('id');

        if (createError) {
          logger.error(`❌ Failed to create category ${category}: ${createError.message}`);
          continue;
        }

        categoryId = newCat?.[0]?.id || category;
        logger.info(`✨ Created new category: ${category}`);
      }

      categoryMap.set(category, categoryId);
    }

    logger.info();

    // Create tags and link to anarchist documents
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      const categoryId = categoryMap.get(row.suggestedCategory);
      if (!categoryId) {
        logger.error(`❌ No category ID for ${row.tagName} (category: ${row.suggestedCategory})`);
        failed++;
        continue;
      }

      try {
        // Check if tag exists
        const { data: existingTag, error: queryError } = await supabase
          .from('tags')
          .select('id')
          .eq('name', row.tagName)
          .eq('category_id', categoryId)
          .limit(1);

        if (queryError) {
          logger.error(`❌ Error querying tag ${row.tagName}: ${queryError.message}`);
          failed++;
          continue;
        }

        if (existingTag && existingTag.length > 0) {
          updated++;
          continue; // Tag already exists, skip
        }

        // Create new tag
        const { error: createError } = await supabase.from('tags').insert([
          {
            name: row.tagName,
            category_id: categoryId,
            is_active: true,
          },
        ]);

        if (createError) {
          logger.error(`❌ Failed to create tag ${row.tagName}: ${createError.message}`);
          failed++;
        } else {
          created++;
        }
      } catch (error) {
        logger.error(`❌ Error processing tag ${row.tagName}:`, error);
        failed++;
      }
    }

    logger.info(`\n✅ Import complete:`);
    logger.info(`   Created: ${created} new tags`);
    logger.info(`   Updated: ${updated} existing tags`);
    logger.info(`   Failed: ${failed} tags`);
    logger.info(
      `   Success rate: ${(((created + updated) / (created + updated + failed)) * 100).toFixed(1)}%`
    );

    if (failed > 0) {
      logger.info('\n⚠️  Review the errors above and retry.');
    } else {
      logger.info('\n🎉 All tags imported successfully!');
      logger.info('\n📝 Next steps:');
      logger.info('   1. Verify tags appear in library tag system');
      logger.info('   2. Test tag filtering on library list');
      logger.info('   3. Run comprehensive testing');
    }
  } catch (error) {
    logger.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

importAnarchistTags();
