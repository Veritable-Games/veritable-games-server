#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all route.ts files in the API directory
const apiDir = path.join(process.cwd(), 'src/app/api');
const routeFiles = glob.sync('**/route.ts', { cwd: apiDir }).map(file => path.join(apiDir, file));

console.log(`Found ${routeFiles.length} API route files\n`);

const results = {
  withSecurity: [],
  withoutSecurity: [],
  needsReview: [],
};

routeFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);

  // Check if withSecurity is imported
  const hasImport =
    content.includes('import { withSecurity }') || content.includes('import {withSecurity}');

  // Check if exports are wrapped with withSecurity
  const hasWrappedExports = /export const (GET|POST|PUT|DELETE|PATCH|HEAD) = withSecurity/.test(
    content
  );

  // Check for direct exports without security
  const hasDirectExports =
    /export (async )?function (GET|POST|PUT|DELETE|PATCH|HEAD)/.test(content) ||
    /export const (GET|POST|PUT|DELETE|PATCH|HEAD) = async/.test(content);

  if (hasWrappedExports) {
    results.withSecurity.push(relativePath);
  } else if (hasDirectExports) {
    results.withoutSecurity.push(relativePath);
  } else if (hasImport && !hasWrappedExports) {
    // Has import but not using it
    results.needsReview.push(relativePath);
  } else {
    // No exports found, might be a utility file
    results.needsReview.push(relativePath);
  }
});

// Generate report
console.log('=== API Security Audit Report ===\n');

console.log(`✅ Routes WITH security middleware: ${results.withSecurity.length}`);
if (results.withSecurity.length > 0 && results.withSecurity.length <= 20) {
  results.withSecurity.forEach(route => console.log(`   - ${route}`));
}
console.log();

console.log(`❌ Routes WITHOUT security middleware: ${results.withoutSecurity.length}`);
if (results.withoutSecurity.length > 0) {
  // Group by API domain for better organization
  const grouped = {};
  results.withoutSecurity.forEach(route => {
    const parts = route.split(path.sep);
    const domain = parts[3]; // src/app/api/[domain]/...
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(route);
  });

  Object.keys(grouped)
    .sort()
    .forEach(domain => {
      console.log(`\n   ${domain}/ (${grouped[domain].length} routes):`);
      grouped[domain].slice(0, 5).forEach(route => {
        console.log(`   - ${route}`);
      });
      if (grouped[domain].length > 5) {
        console.log(`   ... and ${grouped[domain].length - 5} more`);
      }
    });
}
console.log();

console.log(`⚠️ Routes that need review: ${results.needsReview.length}`);
if (results.needsReview.length > 0 && results.needsReview.length <= 10) {
  results.needsReview.forEach(route => console.log(`   - ${route}`));
}

// Summary
console.log('\n=== Summary ===');
const securityPercentage = Math.round((results.withSecurity.length / routeFiles.length) * 100);
console.log(`Security coverage: ${securityPercentage}%`);
console.log(`Critical routes needing immediate fix: ${results.withoutSecurity.length}`);

// Write detailed report to file
const reportPath = path.join(process.cwd(), 'api-security-audit.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\nDetailed report saved to: ${reportPath}`);
