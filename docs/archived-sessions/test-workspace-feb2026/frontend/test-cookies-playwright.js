const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== Testing Cookies with Direct API Call ===\n');

  // Step 1: Get CSRF token
  await page.goto('http://localhost:3000/api/csrf');
  await page.waitForLoadState('networkidle');
  const cookies1 = await context.cookies();
  const csrfCookie = cookies1.find(c => c.name === 'csrf_token');
  console.log(
    '1. CSRF token:',
    csrfCookie ? csrfCookie.value.substring(0, 20) + '...' : 'NOT FOUND'
  );

  // Step 2: Make login API call directly
  const response = await page.request.post('http://localhost:3000/api/auth/login', {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfCookie.value,
    },
    data: JSON.stringify({
      username: 'claude',
      password: 'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk=',
    }),
  });

  console.log('2. Login response status:', response.status());

  // Step 3: Check all cookies after login
  await page.waitForTimeout(1000); // Wait for cookies to be set
  const cookies2 = await context.cookies();

  console.log('\n3. Cookies after login:');
  console.log('   Total cookies:', cookies2.length);

  const sessionCookie = cookies2.find(c => c.name === 'session_id');
  const authCookie = cookies2.find(c => c.name === 'has_auth');
  const csrfCookie2 = cookies2.find(c => c.name === 'csrf_token');

  console.log(
    '\n   session_id:',
    sessionCookie ? '✅ ' + (sessionCookie.httpOnly ? 'HttpOnly' : 'NOT HttpOnly') : '❌ NOT FOUND'
  );
  console.log(
    '   has_auth:',
    authCookie ? '✅ ' + (authCookie.httpOnly ? 'HttpOnly' : 'NOT HttpOnly') : '❌ NOT FOUND'
  );
  console.log('   csrf_token:', csrfCookie2 ? '✅ Present' : '❌ NOT FOUND');

  console.log('\n=== RESULT ===');
  if (sessionCookie && authCookie) {
    console.log('✅ Session cookies ARE being set correctly!');
  } else {
    console.log('❌ Session cookies NOT being set');
  }

  await browser.close();
})();
