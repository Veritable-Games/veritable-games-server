const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all responses
  page.on('response', async response => {
    if (response.url().includes('/api/auth/login')) {
      console.log('\n=== /api/auth/login Response ===');
      console.log('Status:', response.status());
      console.log('Headers:', response.headers());
      try {
        const body = await response.json();
        console.log('Body:', JSON.stringify(body, null, 2));
      } catch (e) {
        console.log('Body: (not JSON)');
      }
    }
  });

  console.log('=== Attempting Login ===\n');
  await page.goto('https://www.veritablegames.com/auth/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"], input[type="text"]', 'claude');
  await page.fill(
    'input[name="password"], input[type="password"]',
    'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk='
  );

  // Click and wait for response
  await Promise.all([
    page
      .waitForResponse(response => response.url().includes('/api/auth/login'), { timeout: 10000 })
      .catch(() => null),
    page.click('button[type="submit"]'),
  ]);

  await page.waitForTimeout(2000);

  // Check for error messages on page
  console.log('\n=== Page Content ===');
  const errorMessage = await page
    .locator('text=/error|invalid|failed|too many/i')
    .first()
    .textContent()
    .catch(() => null);
  if (errorMessage) {
    console.log('Error message found:', errorMessage);
  }

  const url = page.url();
  console.log('Current URL:', url);

  if (url.includes('/auth/login')) {
    console.log('❌ Still on login page - login failed');
  } else {
    console.log('✅ Redirected away from login');
  }

  // Check cookies
  const cookies = await context.cookies();
  console.log(`\nCookies: ${cookies.length}`);
  cookies.forEach(c => console.log(`  - ${c.name} (httpOnly: ${c.httpOnly})`));

  await browser.close();
})();
