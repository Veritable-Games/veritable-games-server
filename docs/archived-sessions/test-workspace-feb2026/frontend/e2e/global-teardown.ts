/**
 * Playwright Global Teardown
 *
 * Runs once after all E2E tests complete
 */

export default async function globalTeardown() {
  console.log('🧹 E2E Global Teardown: Cleaning up');

  // Add any global cleanup here:
  // - Clean test database
  // - Stop services
  // - Remove temp files

  console.log('✅ E2E Global Teardown: Complete');
}
