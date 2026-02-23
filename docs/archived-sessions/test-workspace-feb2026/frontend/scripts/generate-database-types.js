/**
 * Generate TypeScript types from database schemas
 * Run: node scripts/generate-database-types.js
 */

const { generateDatabaseSchemas } = require('../src/lib/database/schema-generator.ts');

async function main() {
  try {
    console.log('🚀 Starting database type generation...');
    await generateDatabaseSchemas();
    console.log('✅ Database type generation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database type generation failed:', error);
    process.exit(1);
  }
}

// Handle module loading for TypeScript
if (require.main === module) {
  // Register ts-node for TypeScript execution
  try {
    require('ts-node').register({
      compilerOptions: {
        module: 'commonjs',
        target: 'es2020',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    });
  } catch (error) {
    console.warn('ts-node not available, trying to run compiled version...');
  }

  main();
}
