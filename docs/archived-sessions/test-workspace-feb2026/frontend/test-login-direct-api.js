/**
 * Test login API directly without browser
 * Tests raw HTTP request/response to see Set-Cookie headers
 */

const http = require('http');

async function testLoginAPI() {
  console.log('\n=== Testing Login API Directly (localhost:3000) ===\n');

  // First get CSRF token
  console.log('1. Getting CSRF token...');
  const csrfToken = await new Promise((resolve, reject) => {
    http
      .get('http://localhost:3000/api/csrf-token', res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            console.log('   CSRF token received:', json.csrfToken?.substring(0, 20) + '...');
            resolve(json.csrfToken);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });

  // Now attempt login with CSRF token
  console.log('\n2. Attempting login with credentials...');

  const postData = JSON.stringify({
    username: 'claude',
    password: 'U52dUipcXhO8D/WHozA3EipyJtu00vwySAwS6EQ1Yzk=',
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-CSRF-Token': csrfToken,
      Cookie: `csrf_token=${csrfToken}`,
    },
  };

  return new Promise(resolve => {
    const req = http.request(options, res => {
      console.log('   Status:', res.statusCode);
      console.log('\n3. Response headers:');

      // Check for Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        console.log('\n✅ Set-Cookie headers found:');
        setCookie.forEach((cookie, i) => {
          console.log(
            `   [${i + 1}] ${cookie.substring(0, 100)}${cookie.length > 100 ? '...' : ''}`
          );

          // Parse cookie name
          const name = cookie.split('=')[0];
          const isHttpOnly = cookie.includes('HttpOnly');
          const isSecure = cookie.includes('Secure');
          const sameSite = cookie.match(/SameSite=(\w+)/)?.[1] || 'none';

          console.log(
            `       Name: ${name}, HttpOnly: ${isHttpOnly}, Secure: ${isSecure}, SameSite: ${sameSite}`
          );
        });
      } else {
        console.log('\n❌ NO Set-Cookie headers found!');
      }

      // Read response body
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        console.log('\n4. Response body:');
        try {
          const json = JSON.parse(data);
          console.log('   Success:', json.success);
          console.log('   Message:', json.message || json.error);
          if (json.data?.user) {
            console.log('   User:', json.data.user.username);
          }
        } catch (e) {
          console.log('   (Not JSON):', data.substring(0, 100));
        }

        console.log('\n=== RESULT ===');
        if (setCookie && setCookie.length > 0) {
          const hasSession = setCookie.some(c => c.includes('session'));
          const hasAuth = setCookie.some(c => c.includes('auth'));

          if (hasSession) {
            console.log('✅ Session cookie IS being set by Next.js API');
          } else {
            console.log('⚠️  Set-Cookie exists but NO session cookie');
          }

          if (hasAuth) {
            console.log('✅ Auth indicator cookie IS being set');
          }
        } else {
          console.log('❌ Set-Cookie header MISSING - cookies not being set at all');
        }

        resolve();
      });
    });

    req.on('error', e => {
      console.error('Request error:', e.message);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

testLoginAPI().catch(console.error);
