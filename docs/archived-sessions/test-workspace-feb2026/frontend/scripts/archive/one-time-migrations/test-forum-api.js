#!/usr/bin/env node

/**
 * Test forum topic creation API to debug validation errors
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001/api/forums';

async function testTopicCreation() {
  console.log('Testing forum topic creation...\n');

  // First get CSRF token
  const categoriesResponse = await fetch(`${API_URL}/categories`);
  const csrfCookie = categoriesResponse.headers.get('set-cookie');
  const csrfToken = csrfCookie ? csrfCookie.split('=')[1].split(';')[0] : null;

  console.log('CSRF Token:', csrfToken ? `${csrfToken.substring(0, 10)}...` : 'NOT FOUND');

  // Test cases
  const testCases = [
    {
      name: 'Valid topic',
      data: {
        title: 'Test Topic Title',
        content: 'This is test content that should be long enough',
        category_id: 1,
        tags: ['test', 'debug'],
      },
    },
    {
      name: 'Short title',
      data: {
        title: 'Hi',
        content: 'This is test content that should be long enough',
        category_id: 1,
      },
    },
    {
      name: 'Short content',
      data: {
        title: 'Valid Title',
        content: 'Too short',
        category_id: 1,
      },
    },
    {
      name: 'Missing category',
      data: {
        title: 'Valid Title',
        content: 'This is test content that should be long enough',
      },
    },
    {
      name: 'Invalid category',
      data: {
        title: 'Valid Title',
        content: 'This is test content that should be long enough',
        category_id: 'not-a-number',
      },
    },
    {
      name: 'XSS attempt',
      data: {
        title: '<script>alert("xss")</script>',
        content: '<script>alert("xss")</script>Some normal content here',
        category_id: 1,
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n=== Test: ${testCase.name} ===`);
    console.log('Request data:', JSON.stringify(testCase.data, null, 2));

    try {
      const response = await fetch(`${API_URL}/topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: csrfCookie || '',
          'x-csrf-token': csrfToken || '',
        },
        body: JSON.stringify(testCase.data),
      });

      const responseText = await response.text();
      let responseData;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.log('Raw response:', responseText);
        continue;
      }

      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(responseData, null, 2));

      if (!response.ok && responseData.error) {
        if (responseData.error.details) {
          console.log('Validation details:', responseData.error.details);
        }
      }
    } catch (error) {
      console.error('Request failed:', error.message);
    }
  }
}

testTopicCreation().catch(console.error);
