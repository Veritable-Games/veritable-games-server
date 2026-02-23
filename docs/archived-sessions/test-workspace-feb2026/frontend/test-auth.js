const fs = require('fs');
const path = require('path');

// Load credentials
const credPath = path.join(__dirname, '..', '.claude-credentials');
if (!fs.existsSync(credPath)) {
  console.error('❌ .claude-credentials not found!');
  process.exit(1);
}

const credContent = fs.readFileSync(credPath, 'utf8');
const credentials = {};

credContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    credentials[key] = valueParts.join('=');
  }
});

console.log('✅ Credentials loaded:');
console.log('  Username:', credentials['CLAUDE_TEST_USERNAME']);
console.log('  Email:', credentials['CLAUDE_TEST_EMAIL']);
console.log(
  '  Password:',
  credentials['CLAUDE_TEST_PASSWORD']
    ? '***' + credentials['CLAUDE_TEST_PASSWORD'].slice(-8)
    : 'MISSING'
);
console.log('  Role:', credentials['CLAUDE_TEST_ROLE']);

// Test authentication against production
const https = require('https');

async function testAuth() {
  console.log('\n🔐 Testing authentication against production...');

  // First get CSRF token
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.veritablegames.com',
      path: '/api/csrf',
      method: 'GET',
      headers: {
        'User-Agent': 'E2E-Test-Script',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        const csrfCookie = cookies.find(c => c.startsWith('csrf_token='));

        if (csrfCookie) {
          const token = csrfCookie.split(';')[0].split('=')[1];
          console.log('✅ CSRF token obtained:', token.slice(0, 10) + '...');

          // Now try login
          testLogin(token, cookies, resolve, reject);
        } else {
          console.error('❌ No CSRF token in response');
          reject(new Error('No CSRF token'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function testLogin(csrfToken, cookies, resolve, reject) {
  const postData = JSON.stringify({
    username: credentials['CLAUDE_TEST_USERNAME'],
    password: credentials['CLAUDE_TEST_PASSWORD'],
  });

  const options = {
    hostname: 'www.veritablegames.com',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'x-csrf-token': csrfToken,
      Cookie: cookies.join('; '),
      'User-Agent': 'E2E-Test-Script',
    },
  };

  const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => (data += chunk));
    res.on('end', () => {
      console.log('📊 Login response status:', res.statusCode);

      try {
        const response = JSON.parse(data);
        if (response.success) {
          console.log('✅ Authentication successful!');
          console.log('   User:', response.data?.user?.username);
          console.log('   Role:', response.data?.user?.role);
          resolve();
        } else {
          console.error('❌ Authentication failed:', response.error);
          reject(new Error(response.error));
        }
      } catch (e) {
        console.error('❌ Failed to parse response:', data.slice(0, 200));
        reject(e);
      }
    });
  });

  req.on('error', reject);
  req.write(postData);
  req.end();
}

testAuth()
  .then(() => {
    console.log('\n✅ All authentication tests passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Authentication test failed:', err.message);
    process.exit(1);
  });
