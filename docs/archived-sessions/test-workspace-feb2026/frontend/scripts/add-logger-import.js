const fs = require('fs');
const path = require('path');

const files = [
  'src/app/api/godot/versions/[id]/scripts/route.ts',
  'src/app/api/projects/[slug]/concept-art/route.ts',
  'src/app/api/projects/[slug]/history/route.ts',
  'src/app/api/projects/[slug]/references/route.ts',
  'src/app/forums/category/[slug]/page.tsx',
  'src/components/godot/ScriptEditorPanel.tsx',
  'src/components/references/UploadZone.tsx',
  'src/lib/analytics/donation-tracking.ts',
  'src/lib/forums/events.ts',
  'src/lib/godot/service.ts',
  'src/lib/optimization/analysis-tools.ts',
  'src/lib/optimization/font-optimizer.ts',
  'src/lib/optimization/format-detection.ts',
  'src/lib/profiles/index.ts',
  'src/lib/security/csp.ts',
  'src/lib/security/geolocation.ts',
  'src/lib/security/init.ts',
  'src/lib/stellar/performance/PerformanceValidator.ts',
  'src/lib/stellar/workers/WorkerManager.ts',
  'src/lib/utils/csrf.ts',
  'src/lib/utils/date-formatter.ts',
  'src/lib/utils/response-parser.ts',
  'src/lib/utils/safe-promise.ts',
  'src/lib/workspace/feature-flags.ts',
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} - not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // Check if logger import already exists
  if (content.includes("from '@/lib/utils/logger'")) {
    console.log(`Skipping ${file} - already has logger import`);
    return;
  }

  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') && !lines[i].includes('import type')) {
      lastImportIndex = i;
    }
    // Stop searching after the first non-import, non-comment, non-empty line after imports
    if (
      lastImportIndex > 0 &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('import ') &&
      !lines[i].trim().startsWith('//') &&
      !lines[i].trim().startsWith('/*') &&
      !lines[i].trim().startsWith('*')
    ) {
      break;
    }
  }

  if (lastImportIndex >= 0) {
    // Insert logger import after the last import
    lines.splice(lastImportIndex + 1, 0, "import { logger } from '@/lib/utils/logger';");
    content = lines.join('\n');
    fs.writeFileSync(fullPath, content);
    console.log(`✓ Added logger import to ${file}`);
  } else {
    console.log(`✗ Could not find import section in ${file}`);
  }
});

console.log('\nDone!');
