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

async function testLibraryUpdate() {
  console.log('\n🔬 Testing Library Document Update Functionality\n');
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
    title: `Test Update Document ${timestamp}`,
    author: 'Test Author',
    publication_date: new Date().toISOString().split('T')[0],
    document_type: 'guide',
    description: 'Original description',
    abstract: 'Original abstract',
    content: '# Original Content\n\nThis is the original content.',
    tags: ['test', 'original'],
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

  if (!documentSlug) {
    console.log('❌ No slug returned from document creation');
    return;
  }

  // 4. Update the document with new content
  console.log('\n4️⃣  Updating document content...');
  const updatedContent = {
    title: `Updated: ${testDocument.title}`,
    description: 'Updated description',
    content:
      '# Updated Content\n\nThis content has been successfully updated!\n\n## New Section\n\nThis is a new section added during the update.',
    tags: ['test', 'updated', 'verified'],
  };

  const updateData = JSON.stringify(updatedContent);
  const updateResponse = await makeRequest(
    {
      hostname,
      port,
      path: `/api/library/documents/${documentSlug}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': updateData.length,
        'X-CSRF-Token': newCsrfToken,
        Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
      },
    },
    updateData
  );

  if (updateResponse.statusCode !== 200) {
    console.log('❌ Failed to update document:', updateResponse.statusCode);
    console.log('Response:', updateResponse.data);
    return;
  }

  console.log('✅ Document update request successful');

  // 5. Fetch the document to verify the update
  console.log('\n5️⃣  Fetching document to verify update...');
  const fetchResponse = await makeRequest({
    hostname,
    port,
    path: `/api/library/documents/${documentSlug}`,
    method: 'GET',
    headers: {
      Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
    },
  });

  if (fetchResponse.statusCode !== 200) {
    console.log('❌ Failed to fetch document:', fetchResponse.statusCode);
    return;
  }

  try {
    const fetchedDoc = JSON.parse(fetchResponse.data);
    const doc = fetchedDoc.data || fetchedDoc; // Handle both response formats

    if (!doc || !doc.title) {
      console.log('\n❌ Document structure unexpected:');
      console.log('Raw response:', fetchResponse.data);
      return;
    }

    console.log('\n📊 Verification Results:');
    console.log('─'.repeat(40));

    // Check title
    const titleUpdated = doc.title === updatedContent.title;
    console.log(`Title Updated: ${titleUpdated ? '✅' : '❌'}`);
    if (!titleUpdated) {
      console.log(`  Expected: "${updatedContent.title}"`);
      console.log(`  Actual: "${doc.title}"`);
    }

    // Check description
    const descriptionUpdated = doc.description === updatedContent.description;
    console.log(`Description Updated: ${descriptionUpdated ? '✅' : '❌'}`);
    if (!descriptionUpdated) {
      console.log(`  Expected: "${updatedContent.description}"`);
      console.log(`  Actual: "${doc.description}"`);
    }

    // Check content (the critical field we fixed)
    const contentUpdated = doc.content === updatedContent.content;
    console.log(
      `Content Updated: ${contentUpdated ? '✅' : '❌'} ${contentUpdated ? '(FIX CONFIRMED!)' : '(STILL BROKEN)'}`
    );
    if (!contentUpdated) {
      console.log(`  Expected: "${updatedContent.content.substring(0, 50)}..."`);
      console.log(`  Actual: "${(doc.content || '').substring(0, 50)}..."`);
    }

    // Check tags
    const tagsUpdated = JSON.stringify(doc.tags) === JSON.stringify(updatedContent.tags);
    console.log(`Tags Updated: ${tagsUpdated ? '✅' : '❌'}`);
    if (!tagsUpdated) {
      console.log(`  Expected: ${JSON.stringify(updatedContent.tags)}`);
      console.log(`  Actual: ${JSON.stringify(doc.tags)}`);
    }

    console.log('─'.repeat(40));

    if (titleUpdated && descriptionUpdated && contentUpdated && tagsUpdated) {
      console.log('\n✅ SUCCESS! All document fields updated correctly!');
      console.log('The document editing functionality is now working properly.');
    } else {
      console.log('\n⚠️  Some fields did not update correctly.');
      if (!contentUpdated) {
        console.log('❌ CRITICAL: Content field is still not updating!');
      }
    }
  } catch (e) {
    console.log('❌ Failed to parse fetched document:', e.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test complete\n');
}

// Run the test
testLibraryUpdate().catch(error => {
  console.error('Test failed with error:', error.message);
  process.exit(1);
});
