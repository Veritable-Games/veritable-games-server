const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== Testing Login on LOCAL Development Server ===\n');

  // Capture responses
  const responses = [];
  page.on('response', response => {
    if (response.url().includes('/api/auth/login')) {
      responses.push({
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
      });
    }
  });

  // Navigate to login page
  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');

  // Fill in login form with Claude credentials
  await page.fill('input[name="username"]', 'claude');
  await page.fill('input[name="password"]', 'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk=');

  // Submit login
  await page.click('button[type="submit"]');

  // Wait for navigation or timeout
  try {
    await page.waitForURL(/\/(?!auth\/login)/, { timeout: 10000 });
    console.log('✅ Login successful - redirected to:', page.url());
  } catch (e) {
    console.log('⏱️  Login may have failed or timeout - still at:', page.url());
  }

  // Check login API response
  console.log('\n=== Login API Response ===');
  const loginResponse = responses.find(r => r.url.includes('/api/auth/login'));
  if (loginResponse) {
    console.log('Status:', loginResponse.status);

    const setCookie = loginResponse.headers['set-cookie'];
    if (setCookie) {
      console.log('\n✅ Set-Cookie header found:');
      // Split multiple Set-Cookie headers if they exist
      const cookies = Array.isArray(setCookie)
        ? setCookie
        : setCookie.split(',').map(c => c.trim());
      cookies.forEach(cookie => {
        console.log('  -', cookie.substring(0, 100) + (cookie.length > 100 ? '...' : ''));
      });
    } else {
      console.log('\n❌ No Set-Cookie header in response!');
    }
  } else {
    console.log('❌ No /api/auth/login response captured');
  }

  // Check browser cookies
  console.log('\n=== Browser Cookies ===');
  const cookies = await context.cookies();
  console.log(`Total cookies: ${cookies.length}`);

  const sessionCookies = cookies.filter(c => c.name.includes('session') || c.name === 'session_id');
  const authCookies = cookies.filter(c => c.name.includes('auth') || c.name === 'has_auth');
  const csrfCookies = cookies.filter(c => c.name.includes('csrf'));

  console.log('\nSession cookies:', sessionCookies.length);
  sessionCookies.forEach(c => {
    console.log(
      `  - ${c.name}: httpOnly=${c.httpOnly}, secure=${c.secure}, sameSite=${c.sameSite}`
    );
  });

  console.log('\nAuth indicator cookies:', authCookies.length);
  authCookies.forEach(c => {
    console.log(
      `  - ${c.name}: httpOnly=${c.httpOnly}, secure=${c.secure}, sameSite=${c.sameSite}`
    );
  });

  console.log('\nCSRF cookies:', csrfCookies.length);
  csrfCookies.forEach(c => {
    console.log(
      `  - ${c.name}: httpOnly=${c.httpOnly}, secure=${c.secure}, sameSite=${c.sameSite}`
    );
  });

  // Summary
  console.log('\n=== SUMMARY ===');
  if (sessionCookies.length > 0) {
    console.log('✅ Session cookies ARE being set in local development');
  } else {
    console.log('❌ Session cookies NOT being set in local development');
  }

  await browser.close();
})();
