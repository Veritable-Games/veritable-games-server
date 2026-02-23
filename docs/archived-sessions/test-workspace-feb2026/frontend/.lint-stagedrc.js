const path = require('path');

module.exports = {
  // TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': [
    'prettier --write',
    // Only run tests for test files or when component files are changed
    filenames => {
      const testFiles = filenames.filter(filename =>
        /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename)
      );

      if (testFiles.length > 0) {
        return `npm test -- --bail --passWithNoTests --findRelatedTests ${testFiles.join(' ')}`;
      }

      // For component files, run related tests
      const componentFiles = filenames.filter(
        filename =>
          /\.(ts|tsx|js|jsx)$/.test(filename) && !/\.(test|spec|d)\.(ts|tsx|js|jsx)$/.test(filename)
      );

      if (componentFiles.length > 0) {
        return `npm test -- --bail --passWithNoTests --findRelatedTests ${componentFiles.join(' ')}`;
      }

      return [];
    },
  ],

  // JSON files
  '*.json': ['prettier --write'],

  // CSS and styling files
  '*.{css,scss,sass}': ['prettier --write'],

  // Markdown files
  '*.{md,mdx}': ['prettier --write'],

  // YAML files
  '*.{yml,yaml}': ['prettier --write'],

  // Package.json special handling
  'package.json': ['prettier --write', 'npm audit --audit-level=moderate'],

  // Environment files - validate format
  '.env*': [
    filenames => {
      const envFiles = filenames.filter(
        filename => /\.env/.test(filename) && !filename.includes('.example')
      );

      if (envFiles.length > 0) {
        console.warn(
          '⚠️  Environment files detected in staging area. Ensure no secrets are committed!'
        );
        return `node -e "
          const files = '${envFiles.join(' ')}';
          console.log('Checking env files:', files);
          // Add custom validation here if needed
        "`;
      }

      return [];
    },
  ],

  // Database files - prevent accidental commits
  '*.{db,sqlite,sqlite3}': [
    () => {
      console.error('❌ Database files should not be committed!');
      return 'exit 1';
    },
  ],

  // TypeScript config files
  'tsconfig*.json': ['prettier --write', 'npm run type-check'],

  // Tailwind config
  'tailwind.config.{js,ts}': ['prettier --write'],

  // Next.js config
  'next.config.{js,mjs}': ['prettier --write'],
};
