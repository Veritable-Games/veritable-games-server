/**
 * Manual Forum Testing Script
 * Tests all forum features and captures console logs
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function testForums() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    consoleMessages: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
    };
    results.consoleMessages.push(entry);
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', error => {
    const entry = {
      message: error.message,
      stack: error.stack,
    };
    results.errors.push(entry);
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  try {
    console.log('\n=== TEST 1: Navigate to Forums ===');
    await page.goto('https://www.veritablegames.com/forums', {
      waitUntil: 'networkidle',
    });
    results.tests.push({
      name: 'Navigate to forums',
      status: 'PASS',
      url: page.url(),
    });
    await page.screenshot({ path: '/tmp/forum-homepage.png' });

    // Wait a bit to capture any delayed console messages
    await page.waitForTimeout(2000);

    console.log('\n=== TEST 2: Check Forum Categories ===');
    const categories = await page.$$eval('.forum-category', cats =>
      cats.map(c => ({
        name: c.querySelector('h3, h2')?.textContent?.trim(),
        topicCount: c.textContent.match(/(\d+)\s+topics?/i)?.[1],
      }))
    );
    results.tests.push({
      name: 'List categories',
      status: categories.length > 0 ? 'PASS' : 'FAIL',
      data: { categoriesFound: categories.length, categories },
    });
    console.log(`Found ${categories.length} categories:`, categories);

    console.log('\n=== TEST 3: Click First Topic ===');
    const firstTopicLink = await page.$('a[href*="/forums/"]');
    if (firstTopicLink) {
      const topicUrl = await firstTopicLink.getAttribute('href');
      await firstTopicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      results.tests.push({
        name: 'Navigate to topic',
        status: 'PASS',
        url: page.url(),
      });
      await page.screenshot({ path: '/tmp/forum-topic.png' });

      console.log('\n=== TEST 4: Check Vote Buttons ===');
      const voteButtons = await page.$$('[class*="VoteButton"], button[title*="vote" i]');
      results.tests.push({
        name: 'Vote buttons present',
        status: voteButtons.length > 0 ? 'PASS' : 'FAIL',
        data: { voteButtonCount: voteButtons.length },
      });
      console.log(`Found ${voteButtons.length} vote button containers`);

      console.log('\n=== TEST 5: Check Replies ===');
      const replies = await page.$$eval(
        '[class*="reply"], .forum-reply, [role="article"]',
        els => els.length
      );
      results.tests.push({
        name: 'Replies visible',
        status: replies > 0 ? 'PASS' : 'FAIL',
        data: { replyCount: replies },
      });
      console.log(`Found ${replies} replies`);
    } else {
      results.tests.push({
        name: 'Navigate to topic',
        status: 'SKIP',
        reason: 'No topics found',
      });
    }

    // Wait for final console messages
    await page.waitForTimeout(3000);
  } catch (error) {
    console.error('Test error:', error);
    results.errors.push({
      message: error.message,
      stack: error.stack,
    });
  } finally {
    await browser.close();

    // Save results
    fs.writeFileSync('/tmp/forum-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total tests: ${results.tests.length}`);
    console.log(`Console messages: ${results.consoleMessages.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log('\nResults saved to /tmp/forum-test-results.json');

    // Print console errors
    const errorMessages = results.consoleMessages.filter(m => m.type === 'error');
    if (errorMessages.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      errorMessages.forEach(err => {
        console.log(`- ${err.text}`);
      });
    }
  }
}

testForums().catch(console.error);
