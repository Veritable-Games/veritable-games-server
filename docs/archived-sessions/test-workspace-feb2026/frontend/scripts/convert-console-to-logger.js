#!/usr/bin/env node

/**
 * Convert console statements to logger calls
 * Handles proper formatting of arguments into message + context pattern
 */

const fs = require('fs');
const path = require('path');

function convertConsoleToLogger(content) {
  // Add logger import if not present
  if (!content.includes("from '@/lib/utils/logger'")) {
    // Find the last import statement
    const importMatches = content.match(/^import .+ from .+;$/gm);
    if (importMatches && importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;
      content =
        content.slice(0, insertPosition) +
        "\nimport { logger } from '@/lib/utils/logger';" +
        content.slice(insertPosition);
    }
  }

  // Replace console.debug
  content = content.replace(/console\.debug\(/g, 'logger.debug(');

  // Replace console.error - these can mostly stay as-is since logger.error accepts similar signature
  content = content.replace(/console\.error\(/g, 'logger.error(');

  // Replace console.warn
  content = content.replace(/console\.warn\(/g, 'logger.warn(');

  // Replace console.log('[DEBUG] - convert to logger.debug without [DEBUG] prefix
  content = content.replace(/console\.log\('\[DEBUG\]\s*/g, "logger.debug('");

  // Replace remaining console.log with logger.info
  content = content.replace(/console\.log\(/g, 'logger.info(');

  return content;
}

// Get file path from command line
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node convert-console-to-logger.js <file-path>');
  process.exit(1);
}

// Read file
const fullPath = path.resolve(filePath);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

console.log(`Converting console statements in: ${fullPath}`);
const content = fs.readFileSync(fullPath, 'utf-8');
const originalCount = (content.match(/console\./g) || []).length;

// Convert
const converted = convertConsoleToLogger(content);
const newCount = (converted.match(/console\./g) || []).length;

// Write back
fs.writeFileSync(fullPath, converted, 'utf-8');

console.log(`✓ Converted ${originalCount - newCount} console statements`);
console.log(`  Remaining console statements: ${newCount}`);

if (newCount > 0) {
  console.log('\n⚠️  Some console statements remain - manual review needed');
}
