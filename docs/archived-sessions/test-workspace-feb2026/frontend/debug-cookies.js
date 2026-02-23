const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://www.veritablegames.com/auth/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"], input[type="text"]', 'claude');
  await page.fill(
    'input[name="password"], input[type="password"]',
    'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk='
  );
  await page.click('button[type="submit"]');

  // Wait for redirect
  try {
    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
  } catch (e) {
    console.log('Login may have failed or redirected differently');
  }

  // Get ALL cookies
  const cookies = await context.cookies();

  console.log('\n=== ALL COOKIES ===');
  console.log('Total cookies:', cookies.length);

  cookies.forEach(cookie => {
    console.log(`\nCookie: ${cookie.name}`);
    console.log(`  Value: ${cookie.value.substring(0, 20)}...`);
    console.log(`  httpOnly: ${cookie.httpOnly}`);
    console.log(`  secure: ${cookie.secure}`);
    console.log(`  sameSite: ${cookie.sameSite}`);
    console.log(`  domain: ${cookie.domain}`);
    console.log(`  path: ${cookie.path}`);
  });

  const httpOnlyCookies = cookies.filter(c => c.httpOnly);
  console.log(`\n=== HTTP-ONLY COOKIES: ${httpOnlyCookies.length} ===`);
  httpOnlyCookies.forEach(c => console.log(`  - ${c.name}`));

  const nonHttpOnlyCookies = cookies.filter(c => !c.httpOnly);
  console.log(`\n=== NON-HTTP-ONLY COOKIES: ${nonHttpOnlyCookies.length} ===`);
  nonHttpOnlyCookies.forEach(c => console.log(`  - ${c.name}`));

  await browser.close();
})();
