const fs = require('fs');
const path = require('path');

// Critical vulnerability assessment and batch fixes
const VULNERABILITY_ASSESSMENT = {
  CRITICAL: {
    // Admin routes with no security middleware - immediate privilege escalation risk
    routes: ['admin/library/tag-categories/route.ts', 'admin/library/tags/route.ts'],
    severity: 'CRITICAL',
    description:
      'Admin routes with no authentication or CSRF protection allow unauthorized admin operations',
    impact:
      'Complete administrative access compromise, data manipulation, user privilege escalation',
  },
  HIGH: {
    // Admin routes with partial security - missing CSRF allows state manipulation
    routes: [
      'admin/library/bulk/route.ts',
      'admin/library/documents/[id]/route.ts',
      'admin/settings/route.ts',
      'admin/users/[id]/route.ts',
      'admin/content/topics/route.ts',
      'admin/content/team/[id]/route.ts',
      'admin/content/team/route.ts',
      'admin/content/team/bulk/route.ts',
      'admin/content/projects/[id]/route.ts',
      'admin/content/projects/route.ts',
      'admin/content/commissions/[id]/route.ts',
      'admin/content/commissions/route.ts',
      'admin/content/commissions/bulk/route.ts',
      'admin/content/news/[id]/route.ts',
      'admin/content/news/route.ts',
      'admin/content/news/bulk/route.ts',
      'admin/content/wiki/route.ts',
      'admin/wiki/categories/route.ts',
    ],
    severity: 'HIGH',
    description: 'Admin routes missing CSRF protection allow cross-site request forgery attacks',
    impact:
      'Admin actions can be triggered by malicious websites, data manipulation, unauthorized changes',
  },
  MEDIUM: {
    // User routes missing CSRF protection - state manipulation risk
    routes: [
      'users/[id]/favorites/route.ts',
      'users/[id]/export/route.ts',
      'users/[id]/privacy/route.ts',
      'notifications/route.ts',
      'messages/send/route.ts',
      'messages/conversation/[userId]/route.ts',
      'auth/logout/route.ts',
      'projects/bulk/route.ts',
      'forums/replies/[id]/edit/route.ts',
      'forums/replies/route.ts',
      'forums/topics/[id]/edit/route.ts',
      'forums/topics/[id]/route.ts',
      'wiki/auto-categorize/route.ts',
      'wiki/pages/[slug]/route.ts',
      'wiki/pages/[slug]/tags/route.ts',
      'wiki/pages/route.ts',
    ],
    severity: 'MEDIUM',
    description: 'User routes missing CSRF protection allow cross-site request forgery',
    impact:
      'User actions can be triggered without consent, potential for social engineering attacks',
  },
  LOW: {
    // Special case - CSRF token endpoint
    routes: ['auth/csrf-token/route.ts'],
    severity: 'LOW',
    description: 'CSRF token endpoint lacks proper protection',
    impact: 'Potential token manipulation, though limited direct impact',
  },
};

// Security configurations for different route types
const SECURITY_CONFIGS = {
  ADMIN_STRICT: {
    requireAuth: true,
    requiredRole: 'admin',
    csrfEnabled: true,
    rateLimitEnabled: true,
    rateLimitConfig: 'strict',
    cspEnabled: true,
  },
  USER_AUTHENTICATED: {
    requireAuth: true,
    csrfEnabled: true,
    rateLimitEnabled: true,
    rateLimitConfig: 'api',
    cspEnabled: true,
  },
  CSRF_TOKEN: {
    requireAuth: false,
    csrfEnabled: false, // Special case - this endpoint generates CSRF tokens
    rateLimitEnabled: true,
    rateLimitConfig: 'auth',
    cspEnabled: true,
  },
};

async function generateSecurityFix(routePath, severityLevel) {
  const fullPath = `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/${routePath}`;

  try {
    const content = fs.readFileSync(fullPath, 'utf8');

    // Determine security config based on route type
    let securityConfig;
    if (routePath.startsWith('admin/')) {
      securityConfig = SECURITY_CONFIGS.ADMIN_STRICT;
    } else if (routePath === 'auth/csrf-token/route.ts') {
      securityConfig = SECURITY_CONFIGS.CSRF_TOKEN;
    } else {
      securityConfig = SECURITY_CONFIGS.USER_AUTHENTICATED;
    }

    // Check if withSecurity is already imported
    const hasWithSecurityImport = /import.*withSecurity.*from.*@\/lib\/security\/middleware/.test(
      content
    );

    // Find HTTP method exports
    const methodExports = [];
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach(method => {
      const asyncFunctionPattern = new RegExp(`export\\s+async\\s+function\\s+${method}`, 'g');
      const constExportPattern = new RegExp(`export\\s+const\\s+${method}\\s*=`, 'g');

      if (asyncFunctionPattern.test(content) || constExportPattern.test(content)) {
        methodExports.push(method);
      }
    });

    // Generate fix based on what's missing
    let fixes = [];

    // Add import if missing
    if (!hasWithSecurityImport) {
      fixes.push({
        type: 'add_import',
        content: `import { withSecurity } from '@/lib/security/middleware';`,
      });
    }

    // Convert each HTTP method to use withSecurity
    methodExports.forEach(method => {
      const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      let config = { ...securityConfig };

      // GET methods don't need CSRF protection unless they're admin routes
      if (method === 'GET' && !routePath.startsWith('admin/')) {
        config = { ...config, csrfEnabled: false };
      }

      fixes.push({
        type: 'wrap_method',
        method,
        config,
        needsCsrf: stateChangingMethods.includes(method) || routePath.startsWith('admin/'),
      });
    });

    return {
      routePath,
      fullPath,
      severityLevel,
      methodExports,
      fixes,
      securityConfig,
      hasExistingSecurity: hasWithSecurityImport,
    };
  } catch (error) {
    return {
      routePath,
      fullPath,
      error: error.message,
    };
  }
}

async function applySecurityFix(fixData) {
  try {
    let content = fs.readFileSync(fixData.fullPath, 'utf8');

    // Add import if needed
    const importFix = fixData.fixes.find(f => f.type === 'add_import');
    if (importFix && !content.includes('withSecurity')) {
      // Insert import after existing imports
      const importLines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex >= 0) {
        importLines.splice(lastImportIndex + 1, 0, importFix.content);
        content = importLines.join('\n');
      }
    }

    // Apply method wrapping
    const methodFixes = fixData.fixes.filter(f => f.type === 'wrap_method');

    for (const methodFix of methodFixes) {
      const { method, config } = methodFix;

      // Create configuration string
      const configString = JSON.stringify(config, null, 2).replace(/"/g, "'");

      // Pattern to match async function export
      const asyncFunctionPattern = new RegExp(
        `export\\s+async\\s+function\\s+${method}\\s*\\([^)]*\\)\\s*\\{`,
        'g'
      );

      // Pattern to match const export
      const constExportPattern = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*([^;]+)`, 'g');

      if (asyncFunctionPattern.test(content)) {
        // Convert async function to withSecurity wrapper
        content = content.replace(
          new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(([^)]*)\\)\\s*\\{`, 'g'),
          `async function ${method.toLowerCase()}Handler($1) {`
        );

        // Add export with withSecurity at the end
        content += `\n\nexport const ${method} = withSecurity(${method.toLowerCase()}Handler, ${configString});`;
      } else if (constExportPattern.test(content)) {
        // Already using const export, wrap it
        content = content.replace(
          new RegExp(`export\\s+const\\s+${method}\\s*=\\s*([^;]+)`, 'g'),
          `const ${method.toLowerCase()}Handler = $1;\n\nexport const ${method} = withSecurity(${method.toLowerCase()}Handler, ${configString})`
        );
      }
    }

    // Write the fixed content
    fs.writeFileSync(fixData.fullPath, content);

    return {
      success: true,
      routePath: fixData.routePath,
      appliedFixes: fixData.fixes.length,
    };
  } catch (error) {
    return {
      success: false,
      routePath: fixData.routePath,
      error: error.message,
    };
  }
}

async function batchSecurityFixes() {
  console.log('🔧 GENERATING SECURITY FIXES FOR ALL VULNERABLE ROUTES');
  console.log('='.repeat(60));

  const allVulnerable = [
    ...VULNERABILITY_ASSESSMENT.CRITICAL.routes.map(r => ({ route: r, severity: 'CRITICAL' })),
    ...VULNERABILITY_ASSESSMENT.HIGH.routes.map(r => ({ route: r, severity: 'HIGH' })),
    ...VULNERABILITY_ASSESSMENT.MEDIUM.routes.map(r => ({ route: r, severity: 'MEDIUM' })),
    ...VULNERABILITY_ASSESSMENT.LOW.routes.map(r => ({ route: r, severity: 'LOW' })),
  ];

  console.log(`Total vulnerable routes to fix: ${allVulnerable.length}\n`);

  // Generate all fixes first
  const fixData = [];
  for (const { route, severity } of allVulnerable) {
    const fix = await generateSecurityFix(route, severity);
    fixData.push(fix);
  }

  // Show what will be fixed
  console.log('📋 PREVIEW OF SECURITY FIXES:');
  console.log('-'.repeat(40));

  fixData.forEach(fix => {
    if (fix.error) {
      console.log(`❌ ${fix.routePath}: ${fix.error}`);
    } else {
      console.log(`✅ ${fix.routePath} (${fix.severityLevel})`);
      console.log(`   Methods: ${fix.methodExports.join(', ')}`);
      console.log(`   Fixes: ${fix.fixes.length} security enhancements`);
      console.log(`   Has existing security: ${fix.hasExistingSecurity ? 'Yes' : 'No'}`);
      console.log('');
    }
  });

  // Apply fixes (commented out for safety - uncomment to execute)
  /*
  console.log('⚙️  APPLYING SECURITY FIXES...');
  console.log('-'.repeat(30));
  
  const results = [];
  for (const fix of fixData) {
    if (!fix.error) {
      const result = await applySecurityFix(fix);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Fixed ${result.routePath} (${result.appliedFixes} changes)`);
      } else {
        console.log(`❌ Failed to fix ${result.routePath}: ${result.error}`);
      }
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('');
  console.log('🏆 BATCH FIX RESULTS:');
  console.log(`✅ Successfully fixed: ${successCount} routes`);
  console.log(`❌ Failed to fix: ${failCount} routes`);
  */

  // Generate manual fix commands
  console.log('📝 MANUAL FIX COMMANDS (for review before execution):');
  console.log('-'.repeat(50));

  fixData.forEach((fix, index) => {
    if (!fix.error) {
      console.log(`# Fix ${index + 1}: ${fix.routePath} (${fix.severityLevel})`);
      console.log(`# Methods: ${fix.methodExports.join(', ')}`);
      console.log(
        `# Security config: ${JSON.stringify(fix.securityConfig, null, 2).replace(/\n/g, '\n# ')}`
      );
      console.log(`node scripts/apply-single-fix.js "${fix.routePath}"`);
      console.log('');
    }
  });

  return fixData;
}

// Function to apply a single fix (for manual execution)
async function applySingleFix(routePath) {
  console.log(`🔧 Applying security fix to: ${routePath}`);

  const fix = await generateSecurityFix(routePath, 'MANUAL');
  if (fix.error) {
    console.error(`Error generating fix: ${fix.error}`);
    return;
  }

  const result = await applySecurityFix(fix);
  if (result.success) {
    console.log(`✅ Successfully applied fix to ${routePath}`);
  } else {
    console.error(`❌ Failed to apply fix: ${result.error}`);
  }

  return result;
}

// Run batch analysis
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length > 0 && args[0] === 'apply') {
    // Apply single fix
    if (args[1]) {
      applySingleFix(args[1]).catch(console.error);
    } else {
      console.error('Usage: node security-fixes.js apply <route-path>');
    }
  } else {
    // Run batch analysis
    batchSecurityFixes().catch(console.error);
  }
}

module.exports = {
  generateSecurityFix,
  applySecurityFix,
  applySingleFix,
  VULNERABILITY_ASSESSMENT,
  SECURITY_CONFIGS,
};
