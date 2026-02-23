#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all route.ts files
function findRouteFiles(dir, files = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findRouteFiles(fullPath, files);
    } else if (item.name === 'route.ts' || item.name === 'route.js') {
      files.push(fullPath);
    }
  }

  return files;
}

// Extract route metadata from file content
function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = filePath
    .replace(/.*\/src\/app/, '')
    .replace('/route.ts', '')
    .replace('/route.js', '');

  const route = {
    path: relativePath,
    methods: [],
    security: {},
  };

  // Extract HTTP methods
  const methodPattern = /export\s+(?:const\s+)?(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/g;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    const method = match[1];
    const methodInfo = { method };

    // Check if method uses withSecurity
    const securityPattern = new RegExp(
      `export\\s+(?:const\\s+)?${method}\\s*=\\s*withSecurity\\([^,]+,\\s*({[^}]+})`,
      's'
    );
    const securityMatch = content.match(securityPattern);

    if (securityMatch) {
      try {
        // Parse security config
        const configStr = securityMatch[1];
        methodInfo.csrfEnabled = configStr.includes('csrfEnabled: true');
        methodInfo.requireAuth = configStr.includes('requireAuth: true');

        // Extract rate limit config
        const rateLimitMatch = configStr.match(/rateLimitConfig:\s*['"]([^'"]+)['"]/);
        if (rateLimitMatch) {
          methodInfo.rateLimitConfig = rateLimitMatch[1];
        }
      } catch (e) {
        console.error(`Error parsing security config for ${filePath}:`, e);
      }
    }

    route.methods.push(methodInfo);
  }

  return route;
}

// Main analysis
function analyzeAllRoutes() {
  const apiDir = path.join(__dirname, '../src/app/api');
  const routeFiles = findRouteFiles(apiDir);

  console.log(`Found ${routeFiles.length} route files\n`);

  const routes = [];
  const categories = {};

  for (const file of routeFiles) {
    const route = analyzeRoute(file);
    routes.push(route);

    // Categorize routes
    const category = route.path.split('/')[2]; // /api/[category]/...
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(route);
  }

  // Output statistics
  console.log('API Route Categories:');
  console.log('====================');

  let totalEndpoints = 0;

  for (const [category, categoryRoutes] of Object.entries(categories)) {
    const endpointCount = categoryRoutes.reduce((sum, r) => sum + r.methods.length, 0);
    totalEndpoints += endpointCount;
    console.log(`\n${category}: ${categoryRoutes.length} routes, ${endpointCount} endpoints`);

    // Show some examples
    categoryRoutes.slice(0, 3).forEach(route => {
      console.log(`  ${route.path}`);
      route.methods.forEach(m => {
        const auth = m.requireAuth ? '🔒' : '🔓';
        const csrf = m.csrfEnabled ? '🛡️' : '';
        const rate = m.rateLimitConfig ? `⏱️(${m.rateLimitConfig})` : '';
        console.log(`    ${m.method} ${auth} ${csrf} ${rate}`);
      });
    });

    if (categoryRoutes.length > 3) {
      console.log(`  ... and ${categoryRoutes.length - 3} more routes`);
    }
  }

  console.log('\n====================');
  console.log(`Total: ${routes.length} route files, ${totalEndpoints} endpoints\n`);

  // Save detailed analysis to JSON
  const outputPath = path.join(__dirname, '../docs/api/routes-analysis.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ routes, categories }, null, 2));
  console.log(`Detailed analysis saved to: ${outputPath}`);

  return { routes, categories, totalEndpoints };
}

// Run analysis
if (require.main === module) {
  analyzeAllRoutes();
}

module.exports = { analyzeAllRoutes };
