#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Final fix for all database and syntax issues...\n');

// Fix WikiSearchService.ts - duplicate db1 declaration
const searchFile = path.join(__dirname, '../src/lib/wiki/services/WikiSearchService.ts');
let searchContent = fs.readFileSync(searchFile, 'utf8');

// Remove duplicate db1 declaration if it exists
searchContent = searchContent.replace(
  /const db1 = this\.getDb\(\);[\s\n]*const results = db1\.prepare/g,
  'const results = db.prepare'
);

fs.writeFileSync(searchFile, searchContent, 'utf8');
console.log('✅ Fixed WikiSearchService.ts');

// Fix WikiTagService.ts - incorrectly placed db declaration
const tagFile = path.join(__dirname, '../src/lib/wiki/services/WikiTagService.ts');
let tagContent = fs.readFileSync(tagFile, 'utf8');

// Fix getTagStats method - move db declaration from return type to function body
tagContent = tagContent.replace(
  /async getTagStats\(\): Promise<\{\s*const db = this\.getDb\(\);/g,
  'async getTagStats(): Promise<{'
);

// Find where the }> { appears after getTagStats and add the db declaration there
tagContent = tagContent.replace(
  /(async getTagStats\(\): Promise<\{[\s\S]*?most_used_tag: \{ name: string; count: number \} \| null;\s*\}>)\s*\{/,
  (match, group1) => {
    return group1 + ' {\n    const db = this.getDb();';
  }
);

fs.writeFileSync(tagFile, tagContent, 'utf8');
console.log('✅ Fixed WikiTagService.ts');

console.log('\n✨ All database issues fixed!');
