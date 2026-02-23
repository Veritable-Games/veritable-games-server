#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Extract all unique internal links from the codebase
const { execSync } = require('child_process');

console.log('🔍 Scanning for 404 pages in Veritable Games...\n');

// Get all internal links from the codebase
const links = execSync(
  `rg 'href=["']/' -g "*.tsx" -g "*.jsx" -g "*.ts" -g "*.js" -o --no-heading | sed 's/.*href=["']//g' | sed 's/["'].*//g' | grep -E '^/' | sort -u`,
  { encoding: 'utf-8' }
)
  .split('\n')
  .filter(link => link && !link.includes('${') && !link.includes('{{') && !link.includes('$'));

// Get all existing page routes
const appDir = path.join(__dirname, '../src/app');
const existingRoutes = new Set();

function scanDirectory(dir, basePath = '') {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip API routes, components, libs, and private directories
      if (
        ['api', 'components', 'lib', 'hooks', 'services', 'types'].includes(file) ||
        file.startsWith('_')
      ) {
        continue;
      }

      const routePath = basePath + '/' + file.replace(/\[([^\]]+)\]/g, ':$1');

      // Check if this directory has a page.tsx or page.jsx
      const pageFile = ['page.tsx', 'page.jsx', 'page.ts', 'page.js'].find(p =>
        fs.existsSync(path.join(fullPath, p))
      );

      if (pageFile) {
        existingRoutes.add(routePath);
      }

      // Recursively scan subdirectories
      scanDirectory(fullPath, routePath);
    }
  }
}

// Scan the app directory
scanDirectory(appDir);

// Add root route
if (fs.existsSync(path.join(appDir, 'page.tsx')) || fs.existsSync(path.join(appDir, 'page.jsx'))) {
  existingRoutes.add('/');
}

// Convert routes to a more usable format
const routePatterns = Array.from(existingRoutes).map(route => {
  // Convert :param to a regex pattern
  return {
    pattern: route.replace(/:([^/]+)/g, '[^/]+'),
    original: route,
  };
});

// Check each link against existing routes
const brokenLinks = [];
const workingLinks = [];

for (const link of links) {
  if (!link) continue;

  // Remove query parameters and hash
  const cleanLink = link.split('?')[0].split('#')[0];

  // Check if the link matches any route pattern
  const isValid = routePatterns.some(({ pattern }) => {
    const regex = new RegExp('^' + pattern + '$');
    return regex.test(cleanLink);
  });

  if (!isValid && cleanLink !== '/') {
    brokenLinks.push(cleanLink);
  } else {
    workingLinks.push(cleanLink);
  }
}

// Additional known problematic routes based on common patterns
const commonMissingRoutes = [
  '/login',
  '/register',
  '/logout',
  '/dashboard',
  '/wiki/systems', // Found in dev server logs
  '/wiki/tags',
  '/admin/dashboard',
  '/api/auth/signin',
  '/api/auth/signout',
];

// Check for these common routes
for (const route of commonMissingRoutes) {
  const isValid = routePatterns.some(({ pattern }) => {
    const regex = new RegExp('^' + pattern + '$');
    return regex.test(route);
  });

  if (!isValid && !brokenLinks.includes(route)) {
    brokenLinks.push(route);
  }
}

// Output results
console.log('📊 ANALYSIS COMPLETE\n');
console.log('='.repeat(50));
console.log(`Total routes analyzed: ${links.length}`);
console.log(`Existing page routes: ${existingRoutes.size}`);
console.log(`404 pages found: ${brokenLinks.length}`);
console.log('='.repeat(50));

if (brokenLinks.length > 0) {
  console.log('\n❌ 404 PAGES (Page Not Found):\n');
  brokenLinks.sort().forEach(link => {
    console.log(`  • ${link}`);
  });
}

console.log('\n✅ EXISTING ROUTES:\n');
Array.from(existingRoutes)
  .sort()
  .forEach(route => {
    console.log(`  • ${route}`);
  });

// Check for routes that exist but might not be linked
const unlinkedRoutes = Array.from(existingRoutes).filter(route => {
  // Skip parameterized routes for this check
  if (route.includes(':')) return false;

  return !workingLinks.includes(route) && route !== '/';
});

if (unlinkedRoutes.length > 0) {
  console.log('\n⚠️  POSSIBLY UNLINKED ROUTES (exist but may not be referenced):\n');
  unlinkedRoutes.sort().forEach(route => {
    console.log(`  • ${route}`);
  });
}

console.log('\n📝 RECOMMENDATIONS:\n');
if (brokenLinks.includes('/login') || brokenLinks.includes('/register')) {
  console.log(
    '  • Authentication pages (/login, /register) are missing - consider implementing auth flow'
  );
}
if (brokenLinks.includes('/dashboard')) {
  console.log('  • Dashboard page is missing - consider adding a user dashboard');
}
if (brokenLinks.includes('/wiki/systems')) {
  console.log('  • Wiki systems page is referenced but missing - needs implementation');
}

process.exit(0);
