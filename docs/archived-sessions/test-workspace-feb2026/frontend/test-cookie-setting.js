const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== Testing Cookie Setting ===\n');

  // Test 1: Call test-cookie endpoint (after deployment)
  console.log('1. Calling /api/test-cookie endpoint...');
  await page.goto('https://www.veritablegames.com/api/test-cookie');
  await page.waitForLoadState('networkidle');

  let cookies = await context.cookies();
  console.log(`   Cookies after test-cookie: ${cookies.length}`);
  cookies.forEach(c => console.log(`     - ${c.name} (httpOnly: ${c.httpOnly})`));

  // Test 2: Navigate to login page and check cookies
  console.log('\n2. Navigating to login page...');
  await page.goto('https://www.veritablegames.com/auth/login');
  await page.waitForLoadState('networkidle');

  cookies = await context.cookies();
  console.log(`   Cookies after login page: ${cookies.length}`);
  cookies.forEach(c => console.log(`     - ${c.name} (httpOnly: ${c.httpOnly})`));

  // Test 3: Manually set a cookie via page.context()
  console.log('\n3. Manually setting cookie via Playwright...');
  await context.addCookie({
    name: 'manual_test_cookie',
    value: 'manual_value',
    domain: 'www.veritablegames.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });

  cookies = await context.cookies();
  console.log(`   Cookies after manual set: ${cookies.length}`);
  cookies.forEach(c => console.log(`     - ${c.name} (httpOnly: ${c.httpOnly})`));

  // Test 4: Check if manually set cookie persists
  await page.reload();
  cookies = await context.cookies();
  console.log(`\n4. Cookies after reload: ${cookies.length}`);
  cookies.forEach(c => console.log(`     - ${c.name} (httpOnly: ${c.httpOnly})`));

  const httpOnlyCookies = cookies.filter(c => c.httpOnly);
  console.log(`\n=== RESULT: ${httpOnlyCookies.length} httpOnly cookies found ===`);

  await browser.close();
})();
