/**
 * Playwright Global Setup
 *
 * Runs once before all E2E tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('🚀 E2E Global Setup: Starting');

  try {
    // SECURITY FIX (2026-02-15): Do NOT reset admin password!
    // Tests should use dedicated test account from .claude-credentials
    // See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md

    console.log('  → Test authentication configured via .claude-credentials');
    console.log('  → Admin account password will NOT be modified');

    // Verify .claude-credentials exists
    const fs = require('fs');
    const path = require('path');
    const credPath = path.join(process.cwd(), '..', '.claude-credentials');

    if (!fs.existsSync(credPath)) {
      console.warn('  ⚠️  .claude-credentials file not found!');
      console.warn('     Tests requiring authentication may fail.');
      console.warn('     See: docs/forums/SECURITY_ISSUE_E2E_ADMIN_PASSWORD.md');
    } else {
      console.log('  ✅ .claude-credentials found');
    }
  } catch (error: any) {
    console.error('  ❌ Setup check failed:', error.message);
    console.error('  ⚠️  Tests requiring authentication may fail');
    // Don't fail the entire test run - tests might still work
  }

  console.log('✅ E2E Global Setup: Complete');
}
