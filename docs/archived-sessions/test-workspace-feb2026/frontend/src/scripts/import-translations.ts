/**
 * Import Translations Script
 * Reads translations-review.csv and updates database with translation_group_id values
 *
 * Run with: npx ts-node src/scripts/import-translations.ts
 * Requires: translations-review.csv in project root (from detect-translations.ts)
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

interface CsvRow {
  groupId: string;
  confidence: string;
  reason: string;
  documentIds: string;
  titles: string;
  authors: string;
  languages: string;
  slugs: string;
}

function parseDocumentIds(
  idString: string
): Array<{ source: 'library' | 'anarchist'; id: string }> {
  return idString.split('|').map(id => {
    const [source, docId] = id.split(':');
    return {
      source: source as 'library' | 'anarchist',
      id: docId,
    };
  });
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  const fileStream = fs.createReadStream(filePath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  const headers: string[] = [];

  for await (const line of rl) {
    if (isFirstLine) {
      headers.push(...line.split(',').map(h => h.trim().toLowerCase()));
      isFirstLine = false;
      continue;
    }

    const values = line.split(',').map(v => v.trim());
    const row: CsvRow = {
      groupId: values[0],
      confidence: values[1],
      reason: values[2],
      documentIds: values[3],
      titles: values[4],
      authors: values[5],
      languages: values[6],
      slugs: values[7],
    };

    // Only import high and medium confidence groups
    if (row.confidence === 'high' || row.confidence === 'medium') {
      rows.push(row);
    }
  }

  return rows;
}

async function importTranslations() {
  logger.info('📥 Starting translation import...\n');

  try {
    const csvPath = path.join(process.cwd(), 'translations-review.csv');

    if (!fs.existsSync(csvPath)) {
      logger.error(`❌ File not found: ${csvPath}`);
      logger.info('Please run: npx ts-node src/scripts/detect-translations.ts');
      process.exit(1);
    }

    const rows = await readCsv(csvPath);
    logger.info(`📄 Read ${rows.length} translation groups from CSV\n`);

    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      const documents = parseDocumentIds(row.documentIds);
      const groupId = row.groupId;

      for (const doc of documents) {
        try {
          const table = doc.source === 'library' ? 'documents' : 'anarchist_documents';
          const schema = doc.source === 'library' ? 'public' : 'public';

          const { error } = await supabase
            .from(table)
            .update({ translation_group_id: groupId })
            .eq('id', doc.id);

          if (error) {
            logger.error(`❌ Failed to update ${doc.source}:${doc.id}: ${error.message}`);
            failed++;
          } else {
            updated++;
          }
        } catch (error) {
          logger.error(`❌ Error updating ${doc.source}:${doc.id}:`, error);
          failed++;
        }
      }
    }

    logger.info(`\n✅ Import complete:`);
    logger.info(`   Updated: ${updated} documents`);
    logger.info(`   Failed: ${failed} documents`);
    logger.info(`   Success rate: ${((updated / (updated + failed)) * 100).toFixed(1)}%`);

    if (failed > 0) {
      logger.info('\n⚠️  Review the errors above and retry.');
    } else {
      logger.info('\n🎉 All translations imported successfully!');
    }
  } catch (error) {
    logger.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

importTranslations();
