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

async function testLibraryTags() {
  console.log('\n🏷️  Testing Library Tag System\n');
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

  // 3. Create a document with new tags
  console.log('\n3️⃣  Creating document with new tags...');
  const timestamp = Date.now();
  const testDocument = {
    title: `Tag Test Document ${timestamp}`,
    author: 'Tag Tester',
    publication_date: new Date().toISOString().split('T')[0],
    document_type: 'guide',
    description: 'Testing tag creation and categorization',
    abstract: 'This document tests if new tags end up in the Unsorted category',
    content: '# Tag Test\n\nTesting the tag system.',
    tags: [`newtag${timestamp}`, `anothertag${timestamp}`, 'test-tag-system'],
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

  // 4. Fetch tag categories to see where the new tags ended up
  console.log('\n4️⃣  Fetching tag categories...');
  const categoriesResponse = await makeRequest({
    hostname,
    port,
    path: '/api/library/tag-categories',
    method: 'GET',
    headers: {
      Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
    },
  });

  if (categoriesResponse.statusCode !== 200) {
    console.log('❌ Failed to fetch categories:', categoriesResponse.statusCode);
    return;
  }

  try {
    const categoriesData = JSON.parse(categoriesResponse.data);
    const categories = categoriesData.categories || [];

    console.log('\n📊 Tag Categories and Their Tags:');
    console.log('─'.repeat(40));

    let foundNewTags = false;
    let unsortedCategory = null;

    categories.forEach(category => {
      console.log(`\n${category.name} (${category.type}):`);
      if (category.isUnsorted) {
        console.log('  ⚡ This is the UNSORTED category');
        unsortedCategory = category;
      }

      if (category.tags.length === 0) {
        console.log('  (no tags)');
      } else {
        const recentTags = category.tags.slice(0, 10);
        recentTags.forEach(tag => {
          const isNewTag =
            tag.name.includes(`newtag${timestamp}`) ||
            tag.name.includes(`anothertag${timestamp}`) ||
            tag.name === 'test-tag-system';
          if (isNewTag) {
            foundNewTags = true;
            console.log(`  ✅ ${tag.name} (NEW TAG - usage: ${tag.usage_count})`);
          } else {
            console.log(`  - ${tag.name} (usage: ${tag.usage_count})`);
          }
        });

        if (category.tags.length > 10) {
          console.log(`  ... and ${category.tags.length - 10} more`);
        }
      }
    });

    console.log('─'.repeat(40));

    if (foundNewTags) {
      console.log('\n✅ SUCCESS! New tags were created and categorized');
      if (
        unsortedCategory &&
        unsortedCategory.tags.some(
          t =>
            t.name.includes(`newtag${timestamp}`) ||
            t.name.includes(`anothertag${timestamp}`) ||
            t.name === 'test-tag-system'
        )
      ) {
        console.log('✅ New tags correctly placed in UNSORTED category');
      }
    } else {
      console.log('\n⚠️  Could not find the new tags in any category');
    }

    // 5. Test updating document tags
    console.log('\n5️⃣  Testing tag update on document...');
    const updateData = JSON.stringify({
      tags: ['updated-tag', 'modified-tag', `updated${timestamp}`],
    });

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

    if (updateResponse.statusCode === 200) {
      console.log('✅ Document tags updated successfully');

      // Fetch the document to verify tags
      const docResponse = await makeRequest({
        hostname,
        port,
        path: `/api/library/documents/${documentSlug}`,
        method: 'GET',
        headers: {
          Cookie: `session_id=${sessionToken}; csrf_token=${newCsrfToken}`,
        },
      });

      if (docResponse.statusCode === 200) {
        const doc = JSON.parse(docResponse.data);
        console.log('Document tags after update:', doc.tags?.map(t => t.name).join(', '));
      }
    } else {
      console.log('❌ Failed to update document tags:', updateResponse.statusCode);
    }
  } catch (e) {
    console.log('❌ Failed to parse categories response:', e.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test complete\n');
}

// Run the test
testLibraryTags().catch(error => {
  console.error('Test failed with error:', error.message);
  process.exit(1);
});
