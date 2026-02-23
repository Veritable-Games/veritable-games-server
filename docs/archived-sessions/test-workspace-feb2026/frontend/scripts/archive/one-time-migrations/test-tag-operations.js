#!/usr/bin/env node

const http = require('http');
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

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData,
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testTagOperations() {
  console.log('\n🏷️  Testing Tag Add/Remove Operations\n');
  console.log('='.repeat(50));

  // 1. Get CSRF token
  console.log('\n1️⃣  Getting CSRF token...');
  const csrfResponse = await makeRequest({
    hostname,
    port,
    path: '/api/library/documents?limit=1',
    method: 'GET',
  });

  const csrfToken = extractCookie(csrfResponse.headers, 'csrf_token');
  if (!csrfToken) {
    console.log('❌ Failed to get CSRF token');
    return;
  }
  console.log('✅ CSRF token obtained');

  // 2. Authenticate
  console.log('\n2️⃣  Authenticating...');
  const loginData = JSON.stringify({
    username: 'admin',
    password: 'admin123',
  });

  const loginResponse = await makeRequest(
    {
      hostname,
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length,
        'X-CSRF-Token': csrfToken,
        Cookie: `csrf_token=${csrfToken}`,
      },
    },
    loginData
  );

  if (loginResponse.statusCode !== 200) {
    console.log('❌ Authentication failed:', loginResponse.statusCode);
    return;
  }

  const sessionToken = extractCookie(loginResponse.headers, 'session_id');
  const newCsrfToken = extractCookie(loginResponse.headers, 'csrf_token') || csrfToken;
  console.log('✅ Authentication successful');

  // 3. Create a test document
  console.log('\n3️⃣  Creating test document...');
  const timestamp = Date.now();
  const testDocument = {
    title: `Tag Operations Test ${timestamp}`,
    author: 'Test Author',
    publication_date: new Date().toISOString().split('T')[0],
    document_type: 'guide',
    description: 'Testing tag add/remove operations',
    abstract: 'Testing CSRF and tag operations',
    content: '# Tag Test\n\nTesting tag operations.',
    tags: ['initial-tag'],
  };

  const createData = JSON.stringify(testDocument);
  const createResponse = await makeRequest(
    {
      hostname,
      port,
      path: '/api/library/documents',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': createData.length,
        'X-CSRF-Token': newCsrfToken,
        Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
      },
    },
    createData
  );

  if (createResponse.statusCode !== 200 && createResponse.statusCode !== 201) {
    console.log('❌ Failed to create document:', createResponse.statusCode);
    console.log('Response:', createResponse.data);
    return;
  }

  let documentSlug;
  try {
    const createResult = JSON.parse(createResponse.data);
    documentSlug = createResult.data?.slug;
    console.log('✅ Document created with slug:', documentSlug);
  } catch (e) {
    console.log('❌ Failed to parse create response');
    return;
  }

  // 4. Get current tags
  console.log('\n4️⃣  Getting current tags...');
  const getTagsResponse = await makeRequest({
    hostname,
    port,
    path: `/api/library/documents/${documentSlug}/tags`,
    method: 'GET',
    headers: {
      Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
    },
  });

  if (getTagsResponse.statusCode !== 200) {
    console.log('❌ Failed to get tags:', getTagsResponse.statusCode);
    return;
  }

  const tagsData = JSON.parse(getTagsResponse.data);
  console.log('Current tags:', tagsData.currentTags.map(t => `${t.name} (ID: ${t.id})`).join(', '));

  // 5. Add a new tag
  console.log('\n5️⃣  Adding a new tag...');
  const addTagData = JSON.stringify({
    tagNames: [`new-tag-${timestamp}`],
  });

  const addTagResponse = await makeRequest(
    {
      hostname,
      port,
      path: `/api/library/documents/${documentSlug}/tags`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': addTagData.length,
        'X-CSRF-Token': newCsrfToken,
        Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
      },
    },
    addTagData
  );

  if (addTagResponse.statusCode !== 200) {
    console.log('❌ Failed to add tag:', addTagResponse.statusCode);
    console.log('Response:', addTagResponse.data);
  } else {
    const addResult = JSON.parse(addTagResponse.data);
    console.log('✅ Tag added successfully:', addResult.addedTags.map(t => t.name).join(', '));
  }

  // 6. Remove a tag
  if (tagsData.currentTags.length > 0) {
    const tagToRemove = tagsData.currentTags[0];
    console.log(`\n6️⃣  Removing tag "${tagToRemove.name}" (ID: ${tagToRemove.id})...`);

    const removeTagData = JSON.stringify({
      tagId: tagToRemove.id,
    });

    const removeTagResponse = await makeRequest(
      {
        hostname,
        port,
        path: `/api/library/documents/${documentSlug}/tags`,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': removeTagData.length,
          'X-CSRF-Token': newCsrfToken,
          Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
        },
      },
      removeTagData
    );

    if (removeTagResponse.statusCode !== 200) {
      console.log('❌ Failed to remove tag:', removeTagResponse.statusCode);
      console.log('Response:', removeTagResponse.data);
    } else {
      console.log('✅ Tag removed successfully');
    }
  }

  // 7. Get final tags
  console.log('\n7️⃣  Getting final tags...');
  const finalTagsResponse = await makeRequest({
    hostname,
    port,
    path: `/api/library/documents/${documentSlug}/tags`,
    method: 'GET',
    headers: {
      Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
    },
  });

  if (finalTagsResponse.statusCode === 200) {
    const finalTags = JSON.parse(finalTagsResponse.data);
    console.log(
      'Final tags:',
      finalTags.currentTags.map(t => `${t.name} (ID: ${t.id})`).join(', ') || '(none)'
    );
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Test complete!\n');
}

// Run the test
testTagOperations().catch(error => {
  console.error('Test failed with error:', error.message);
  process.exit(1);
});
