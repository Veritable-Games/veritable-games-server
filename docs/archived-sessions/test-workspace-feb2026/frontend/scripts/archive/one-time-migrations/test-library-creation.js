#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Since the server is running on localhost:3001, we'll use http
const protocol = http;
const hostname = 'localhost';
const port = 3001;

function extractCookie(headers, cookieName) {
  const cookies = headers['set-cookie'];
  if (!cookies) return null;

  for (const cookie of cookies) {
    if (cookie.includes(`${cookieName}=`)) {
      const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
      if (match) return match[1];
    }
  }
  return null;
}

async function testLibraryCreation() {
  console.log('\n🔬 Testing Library Document Creation\n');
  console.log('='.repeat(50));

  // First, make a GET request to an API endpoint to get a CSRF token cookie
  console.log('\n1️⃣  Getting CSRF token...');

  const csrfOptions = {
    hostname,
    port,
    path: '/api/library/documents?limit=1', // API endpoint that returns CSRF cookie
    method: 'GET',
    headers: {},
  };

  const csrfResponse = await new Promise((resolve, reject) => {
    const req = protocol.request(csrfOptions, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });

  const csrfToken = extractCookie(csrfResponse.headers, 'csrf_token');

  if (!csrfToken) {
    console.log('❌ Failed to get CSRF token from cookie');
    return;
  }

  console.log('✅ CSRF token obtained:', csrfToken.substring(0, 10) + '...');

  // Now authenticate with CSRF token
  console.log('\n2️⃣  Authenticating...');

  // Try different users to find one that works
  const usersToTry = [
    { username: 'admin', password: 'admin123' },
    { username: 'admin', password: 'password' },
    { username: 'admin', password: 'admin' },
    { username: 'testadmin', password: 'testpassword123' },
  ];

  let loginSuccess = false;
  let sessionToken = null;
  let newCsrfToken = csrfToken;

  for (const creds of usersToTry) {
    console.log(`  Trying: ${creds.username}...`);

    const loginData = JSON.stringify(creds);

    const loginOptions = {
      hostname,
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length,
        'X-CSRF-Token': newCsrfToken,
        Cookie: `csrf_token=${newCsrfToken}`,
      },
    };

    try {
      const loginResponse = await new Promise((resolve, reject) => {
        const req = protocol.request(loginOptions, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data,
            });
          });
        });

        req.on('error', reject);
        req.write(loginData);
        req.end();
      });

      if (loginResponse.statusCode === 200) {
        console.log('    ✅ Success!');
        console.log('    Response cookies:', loginResponse.headers['set-cookie']);
        sessionToken = extractCookie(loginResponse.headers, 'session_id');
        newCsrfToken = extractCookie(loginResponse.headers, 'csrf_token') || newCsrfToken;
        console.log(
          '    Session token:',
          sessionToken ? sessionToken.substring(0, 10) + '...' : 'NOT FOUND'
        );
        loginSuccess = true;
        break;
      } else {
        console.log('    ❌ Failed');
      }
    } catch (error) {
      console.log('    ❌ Error:', error.message);
    }
  }

  if (!loginSuccess) {
    console.log('\n❌ Could not authenticate with any credentials');
    console.log('Creating document without authentication...');

    // Still try to create a document (it might work for public endpoints)
    sessionToken = '';
  } else {
    console.log('\n✅ Authentication successful');
  }

  if (sessionToken) {
    console.log('✅ Session cookie obtained');
  }

  // Now test document creation
  console.log('\n3️⃣  Creating test library document...');

  const testDocument = {
    title: `Test Document ${Date.now()}`,
    author: 'Test Author',
    publication_date: new Date().toISOString().split('T')[0],
    document_type: 'guide',
    description: 'This is a test document created to verify library functionality',
    abstract: 'A brief abstract for the test document',
    content: `# Test Document\n\nThis is a test document created at ${new Date().toISOString()}.\n\n## Purpose\n\nTo verify that the library document creation API is working correctly after the withSecurity middleware fixes.\n\n## Content\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.`,
    tags: ['test', 'automated', 'verification'],
  };

  const createData = JSON.stringify(testDocument);

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': createData.length,
    'X-CSRF-Token': newCsrfToken,
  };

  // Add session cookie if we have one
  if (sessionToken) {
    headers['Cookie'] = `session_id=${sessionToken}; csrf_token=${newCsrfToken}`;
  } else {
    headers['Cookie'] = `csrf_token=${newCsrfToken}`;
  }

  const createOptions = {
    hostname,
    port,
    path: '/api/library/documents',
    method: 'POST',
    headers,
  };

  console.log('Request headers:', headers);

  const createResponse = await new Promise((resolve, reject) => {
    const req = protocol.request(createOptions, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
        });
      });
    });

    req.on('error', reject);
    req.write(createData);
    req.end();
  });

  console.log('\n📊 Response Status:', createResponse.statusCode);
  console.log('📄 Response Data:', createResponse.data);

  if (createResponse.statusCode === 200 || createResponse.statusCode === 201) {
    console.log('\n✅ SUCCESS! Library document created successfully!');

    try {
      const responseData = JSON.parse(createResponse.data);
      if (responseData.data) {
        console.log('\nDocument Details:');
        console.log('  ID:', responseData.data.id);
        console.log('  Slug:', responseData.data.slug);
        console.log('  Message:', responseData.data.message);
      }
    } catch (parseError) {
      console.log('Could not parse response data');
    }
  } else {
    console.log('\n❌ FAILED! Document creation returned error');
    console.log('Error details:', createResponse.data);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test complete\n');
}

// Run the test
testLibraryCreation();
