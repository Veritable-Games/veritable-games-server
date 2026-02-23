#!/usr/bin/env node

/**
 * Batch Import Library Documents
 * Imports PDFs from /home/user/Projects/assets/Library/Collections
 */

const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'forums.db');
const SOURCE_DIR = '/home/user/Projects/assets/Library/Collections';
const TARGET_DIR = path.join(__dirname, '..', 'public', 'uploads', 'library', 'documents');

// Category mapping based on directory prefixes
const CATEGORY_MAP = {
  '01_Political_Theory': '01_political_theory',
  '02_Game_Design': '02_game_design',
  '03_Research_Papers': '03_research_papers',
  '04_Education_Pedagogy': '04_education_pedagogy',
  '05_Architecture_Urban': '05_architecture_urban',
  '06_Technology_AI': '06_technology_ai',
  '07_Psychology_Emotion': '07_psychology_emotion',
  '08_Economics_Social': '08_economics_social',
  '09_Environment': '09_environment',
  '10_Historical': '10_historical',
  '11_Art_Culture': '11_art_culture',
  '12_Reference': '12_reference',
  '13_Fiction': '13_fiction',
};

// Document type detection from directory names
function detectDocumentType(dirName) {
  if (dirName.includes('Articles')) return 'article';
  if (dirName.includes('Books')) return 'book';
  if (dirName.includes('Papers')) return 'paper';
  if (dirName.includes('Transcript')) return 'transcript';
  if (dirName.includes('Manual')) return 'manual';
  if (dirName.includes('Report')) return 'report';
  return 'other';
}

// Extract metadata from directory name
function extractMetadata(dirName) {
  // Remove category prefix
  let cleanName = dirName.replace(/^\d+_[^_]+_[^_]+_/, '');

  // Try to extract title from the directory name
  // Format: Category_Type_Title
  const parts = dirName.split('_');
  const docType = detectDocumentType(dirName);

  // Clean up the title
  let title = cleanName
    .replace(/_/g, ' ')
    .replace(/Articles|Books|Papers|Documents|PDFs?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle special characters
  title = title
    .replace(/---/g, ' - ')
    .replace(/\.\.\./g, '…')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: title || 'Untitled Document',
    documentType: docType,
  };
}

async function importDocuments() {
  const db = new Database(DB_PATH);

  try {
    // Ensure target directory exists
    await fs.mkdir(TARGET_DIR, { recursive: true });

    console.log('Starting document import from:', SOURCE_DIR);
    console.log('Target directory:', TARGET_DIR);
    console.log('');

    // Get all subdirectories
    const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });
    const directories = entries.filter(d => d.isDirectory());

    console.log(`Found ${directories.length} directories to process\n`);

    // Get category IDs
    const categories = db.prepare('SELECT id, code FROM library_categories').all();
    const categoryIdMap = {};
    categories.forEach(cat => {
      categoryIdMap[cat.code] = cat.id;
    });

    // Prepare insert statements
    const insertDoc = db.prepare(`
      INSERT INTO library_documents (
        filename, original_filename, storage_path, file_size, mime_type,
        title, author, document_type, category_id, status, 
        uploaded_by, search_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', 1, ?)
    `);

    const checkExisting = db.prepare(
      'SELECT id FROM library_documents WHERE original_filename = ?'
    );

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Process each directory
    for (const dir of directories) {
      const dirPath = path.join(SOURCE_DIR, dir.name);

      // Find the matching category
      let categoryId = null;
      for (const [prefix, code] of Object.entries(CATEGORY_MAP)) {
        if (dir.name.startsWith(prefix)) {
          categoryId = categoryIdMap[code];
          break;
        }
      }

      if (!categoryId) {
        console.log(`⚠️  No category mapping for: ${dir.name}`);
        continue;
      }

      // Look for PDF files in the directory
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        console.log(`  No PDFs in: ${dir.name}`);
        continue;
      }

      // Extract metadata from directory name
      const metadata = extractMetadata(dir.name);

      for (const pdfFile of pdfFiles) {
        const sourcePath = path.join(dirPath, pdfFile);

        // Check if already imported
        const existing = checkExisting.get(pdfFile);
        if (existing) {
          console.log(`  ⏭️  Already imported: ${pdfFile}`);
          skipped++;
          continue;
        }

        try {
          // Get file stats
          const stats = await fs.stat(sourcePath);

          // Generate unique filename
          const uniqueId = crypto.randomBytes(16).toString('hex');
          const safeFilename = `${uniqueId}.pdf`;
          const storagePath = `/uploads/library/documents/${safeFilename}`;
          const targetPath = path.join(TARGET_DIR, safeFilename);

          // Copy file to target directory
          await fs.copyFile(sourcePath, targetPath);

          // Use directory name as title if it's the only PDF, otherwise use filename
          let title = metadata.title;
          if (pdfFiles.length > 1) {
            // Use filename without extension as title for multiple PDFs
            title = pdfFile.replace(/\.pdf$/i, '').replace(/_/g, ' ');
          }

          // Extract author from filename if present (common pattern: Title - Author.pdf)
          let author = null;
          if (pdfFile.includes(' - ')) {
            const parts = pdfFile.replace(/\.pdf$/i, '').split(' - ');
            if (parts.length === 2) {
              title = parts[0].trim();
              author = parts[1].trim();
            }
          }

          const searchText = `${title} ${author || ''}`.toLowerCase();

          // Insert into database
          insertDoc.run(
            safeFilename,
            pdfFile,
            storagePath,
            stats.size,
            'application/pdf',
            title,
            author,
            metadata.documentType,
            categoryId,
            searchText
          );

          console.log(`  ✅ Imported: ${title} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
          imported++;
        } catch (error) {
          console.error(`  ❌ Failed to import ${pdfFile}:`, error.message);
          failed++;
        }
      }
    }

    // Update category counts
    console.log('\nUpdating category counts...');
    db.prepare(
      `
      UPDATE library_categories 
      SET item_count = (
        SELECT COUNT(*) 
        FROM library_documents 
        WHERE category_id = library_categories.id
      )
    `
    ).run();

    console.log('\n=== Import Summary ===');
    console.log(`✅ Imported: ${imported} documents`);
    console.log(`⏭️  Skipped: ${skipped} (already imported)`);
    console.log(`❌ Failed: ${failed}`);

    // Show category distribution
    console.log('\n=== Category Distribution ===');
    const distribution = db
      .prepare(
        `
      SELECT c.name, COUNT(d.id) as count
      FROM library_categories c
      LEFT JOIN library_documents d ON c.id = d.category_id
      GROUP BY c.id
      ORDER BY c.display_order
    `
      )
      .all();

    distribution.forEach(cat => {
      console.log(`  ${cat.name}: ${cat.count} documents`);
    });
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run if called directly
if (require.main === module) {
  console.log('=== Library Document Import Tool ===\n');
  console.log('This will import PDFs from your Library/Collections directory');
  console.log('Files will be copied (not moved) to the web application\n');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Continue with import? (y/n): ', answer => {
    rl.close();

    if (answer.toLowerCase() === 'y') {
      importDocuments().catch(console.error);
    } else {
      console.log('Import cancelled');
    }
  });
}

module.exports = { importDocuments };
