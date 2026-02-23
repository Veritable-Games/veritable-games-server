/**
 * Script: Setup Language Tags (Migration + Assignment)
 *
 * This script:
 * 1. Creates tags for all 27 supported languages in shared.tags
 * 2. Assigns language tags to all documents based on their language field
 *
 * NOTE: Categories have been eliminated in the unified tag system (Nov 2025).
 * Tags are now stored directly in shared.tags without category_id.
 *
 * Usage: npx ts-node scripts/setup-language-tags.ts
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Language code to language name mapping
const languageMapping: Record<string, string> = {
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  ru: 'Russian',
  tr: 'Turkish',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  nl: 'Dutch',
  el: 'Greek',
  da: 'Danish',
  sv: 'Swedish',
  fi: 'Finnish',
  ro: 'Romanian',
  hu: 'Hungarian',
  cs: 'Czech',
  sq: 'Albanian',
  eu: 'Basque',
  fa: 'Farsi',
  eo: 'Esperanto',
  sr: 'Serbian',
  mk: 'Macedonian',
};

const allLanguageNames = [
  'English',
  'German',
  'Spanish',
  'French',
  'Italian',
  'Portuguese',
  'Polish',
  'Russian',
  'Turkish',
  'Korean',
  'Japanese',
  'Chinese',
  'Dutch',
  'Greek',
  'Danish',
  'Swedish',
  'Finnish',
  'Romanian',
  'Hungarian',
  'Czech',
  'Albanian',
  'Basque',
  'Farsi',
  'Esperanto',
  'Serbian',
  'Macedonian',
];

async function main() {
  // Initialize database connection
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL or POSTGRES_URL not configured');
    console.error('   Set these in .env.local or environment variables');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  console.log('Starting language tag setup...\n');

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Create language tags in shared.tags
    console.log('1. Creating language tags in shared.tags...');
    let tagsCreated = 0;
    for (const lang of allLanguageNames) {
      try {
        await client.query(
          `INSERT INTO shared.tags (name, description, source, created_at)
           VALUES ($1, $2, 'language', NOW())
           ON CONFLICT (name) DO NOTHING`,
          [lang, `Documents in ${lang}`]
        );
        tagsCreated++;
      } catch (err: any) {
        console.error(`Error creating tag "${lang}":`, err.message);
      }
    }
    console.log(`   Created/verified ${allLanguageNames.length} language tags\n`);

    // Step 2: Get all language tags from shared.tags
    console.log('2. Fetching all language tags...');
    const tagsResult = await client.query(
      `SELECT id, name FROM shared.tags
       WHERE name IN (${allLanguageNames.map((_, i) => `$${i + 1}`).join(',')})
       ORDER BY name`,
      allLanguageNames
    );

    const tagsByName = new Map<string, number>();
    tagsResult.rows.forEach((tag: any) => {
      tagsByName.set(tag.name, tag.id);
    });

    console.log(`   Found ${tagsResult.rows.length} language tags\n`);

    // Step 3: Get all library documents
    console.log('3. Fetching library documents...');
    const libraryDocsResult = await client.query(
      `SELECT id, language FROM library.library_documents`
    );
    console.log(`   Found ${libraryDocsResult.rows.length} library documents\n`);

    // Step 4: Assign language tags
    console.log('4. Assigning language tags to documents...');

    let totalAssigned = 0;
    const languageStats = new Map<string, number>();

    // Process library documents
    for (const doc of libraryDocsResult.rows) {
      const languageName = languageMapping[doc.language?.toLowerCase() || 'en'] || 'English';
      const tagId = tagsByName.get(languageName);

      if (!tagId) {
        console.warn(`   Warning: No tag found for language "${languageName}"`);
        continue;
      }

      try {
        // Insert into library_document_tags - usage_count handled by trigger
        await client.query(
          `INSERT INTO library.library_document_tags (document_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [doc.id, tagId]
        );
        totalAssigned++;
        languageStats.set(languageName, (languageStats.get(languageName) || 0) + 1);
      } catch (err: any) {
        // Skip if already exists (unique constraint violation)
        if (err.code === '23505') {
          languageStats.set(languageName, (languageStats.get(languageName) || 0) + 1);
        } else {
          throw err;
        }
      }
    }

    console.log(`   Assigned ${totalAssigned} language tags\n`);

    // Step 5: Print statistics
    console.log('5. Language tag distribution:');
    const sortedStats = Array.from(languageStats.entries()).sort((a, b) => b[1] - a[1]);
    for (const [lang, count] of sortedStats) {
      console.log(`   ${lang}: ${count} documents`);
    }
    console.log();

    // Note: usage_count is now handled by database triggers, no manual update needed

    console.log('Language tag setup complete!\n');
    console.log(`Summary:`);
    console.log(`  - Language tags created: ${tagsResult.rows.length}`);
    console.log(`  - Library documents processed: ${libraryDocsResult.rows.length}`);
    console.log(`  - Total tags assigned: ${totalAssigned}`);
    console.log(`  - Languages with documents: ${languageStats.size}`);
  } catch (error) {
    console.error('Error during language tag setup:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
