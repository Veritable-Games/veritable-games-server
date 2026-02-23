const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all responses
  const responses = [];
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
    });
  });

  // Login
  console.log('=== Attempting Login ===\n');
  await page.goto('https://www.veritablegames.com/auth/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="username"], input[type="text"]', 'claude');
  await page.fill(
    'input[name="password"], input[type="password"]',
    'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk='
  );
  await page.click('button[type="submit"]');

  // Wait for navigation
  try {
    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
    console.log('✅ Login successful - redirected to:', page.url());
  } catch (e) {
    console.log('❌ Login may have failed - still at:', page.url());
  }

  // Find the login API response
  console.log('\n=== Login API Response ===');
  const loginResponse = responses.find(r => r.url.includes('/api/auth/login'));
  if (loginResponse) {
    console.log('Status:', loginResponse.status);
    console.log('Headers:', JSON.stringify(loginResponse.headers, null, 2));

    const setCookie = loginResponse.headers['set-cookie'];
    if (setCookie) {
      console.log('\n✅ Set-Cookie header found:');
      console.log(setCookie);
    } else {
      console.log('\n❌ No Set-Cookie header in response!');
    }
  } else {
    console.log('❌ No /api/auth/login response found');
  }

  // Check current cookies
  console.log('\n=== Current Cookies ===');
  const cookies = await context.cookies();
  console.log(`Total: ${cookies.length}`);
  cookies.forEach(c => {
    console.log(`\n${c.name}:`);
    console.log(`  httpOnly: ${c.httpOnly}`);
    console.log(`  secure: ${c.secure}`);
    console.log(`  sameSite: ${c.sameSite}`);
    console.log(`  domain: ${c.domain}`);
  });

  await browser.close();
})();
