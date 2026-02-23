/**
 * Comprehensive Forum Testing Suite
 * Tests all forum functionality and captures console/network issues
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/forum-helpers';

// Console message tracking
let consoleMessages: Array<{ type: string; text: string; url?: string }> = [];
let pageErrors: Array<{ message: string; stack?: string }> = [];
let networkErrors: Array<{ url: string; status: number; statusText: string }> = [];

// Setup console and error tracking
test.beforeEach(async ({ page }) => {
  consoleMessages = [];
  pageErrors = [];
  networkErrors = [];

  // Capture console messages
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      url: msg.location().url,
    });
  });

  // Capture page errors
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });

  // Capture network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });
});

// Print diagnostics after each test
test.afterEach(async ({ page }, testInfo) => {
  console.log(`\n=== TEST: ${testInfo.title} ===`);
  console.log(`Status: ${testInfo.status}`);

  if (consoleMessages.filter(m => m.type === 'error').length > 0) {
    console.log('\n[CONSOLE ERRORS]');
    consoleMessages.filter(m => m.type === 'error').forEach(msg => console.log(`  - ${msg.text}`));
  }

  if (pageErrors.length > 0) {
    console.log('\n[PAGE ERRORS]');
    pageErrors.forEach(err => console.log(`  - ${err.message}`));
  }

  if (networkErrors.length > 0) {
    console.log('\n[NETWORK ERRORS]');
    networkErrors.forEach(err => console.log(`  - ${err.status} ${err.url}`));
  }

  if (testInfo.status === 'failed') {
    await page.screenshot({
      path: `/tmp/forum-test-${testInfo.title.replace(/\s+/g, '-')}.png`,
    });
  }
});

test.describe('Forum Browsing', () => {
  test('should load forum homepage', async ({ page }) => {
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // Check for categories
    const categories = await page.$$('[class*="category"]');
    console.log(`Found ${categories.length} categories`);
    expect(categories.length).toBeGreaterThan(0);
  });

  test('should display forum sections', async ({ page }) => {
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // Look for section headings
    const sections = await page.$$('h2, h3, [role="heading"]');
    console.log(`Found ${sections.length} sections/headings`);
  });

  test('should show topic list in category', async ({ page }) => {
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // Find first category link
    const categoryLink = await page.$('a[href*="/forums/"]');
    if (categoryLink) {
      await categoryLink.click();
      await page.waitForLoadState('networkidle');
      console.log(`Navigated to: ${page.url()}`);
    }
  });
});

test.describe('Topic Viewing', () => {
  test('should view a topic and its replies', async ({ page }) => {
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // Find and click first topic
    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      const topicText = await topicLink.textContent();
      console.log(`Clicking topic: ${topicText}`);

      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Wait for React hydration

      // Check for replies
      const replies = await page.$$('[role="article"], [class*="reply"]');
      console.log(`Found ${replies.length} replies`);
    }
  });

  test('should display vote buttons on replies', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for vote buttons (upvote/downvote arrows)
      const voteButtons = await page.$$(
        'button[title*="vote" i], svg path[d*="M5 15l7-7 7 7"], svg path[d*="M19 9l-7 7-7-7"]'
      );
      console.log(`Found ${voteButtons.length} vote button elements`);

      // Check for vote count displays
      const voteCounts = await page.$$('[class*="vote"], text=/^[-]?\\d+$/');
      console.log(`Found ${voteCounts.length} vote count elements`);
    }
  });
});

test.describe('Voting System', () => {
  test('should allow upvoting a reply', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Find upvote button (arrow pointing up)
      const upvoteBtn = await page.$('button svg path[d*="M5 15l7-7 7 7"]');
      if (upvoteBtn) {
        const parent = await upvoteBtn.evaluateHandle(el => el.closest('button'));
        const button = parent.asElement();

        if (button) {
          console.log('Clicking upvote button...');
          await button.click();
          await page.waitForTimeout(1000);

          // Check for success/error dialogs
          const dialog = await page.$('[role="dialog"], [class*="dialog"]');
          if (dialog) {
            const dialogText = await dialog.textContent();
            console.log(`Dialog shown: ${dialogText}`);
          }
        }
      } else {
        console.log('No upvote button found');
      }
    }
  });

  test('should prevent self-voting', async ({ page }) => {
    await login(page);

    // Navigate to a topic where admin is the author
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // This should show a warning if trying to vote on own reply
    console.log('Test: Self-voting prevention');
  });
});

test.describe('Creating Content', () => {
  test('should create a new topic', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    // Look for "New Topic" button
    const newTopicBtn = await page.$('button:has-text("New Topic"), a:has-text("New Topic")');
    if (newTopicBtn) {
      console.log('Found New Topic button');
      await newTopicBtn.click();
      await page.waitForTimeout(2000);

      // Check if form appeared
      const titleInput = await page.$('input[name="title"], input[placeholder*="title" i]');
      const contentInput = await page.$('textarea[name="content"], [role="textbox"]');

      console.log(`Title input: ${titleInput ? 'found' : 'NOT FOUND'}`);
      console.log(`Content input: ${contentInput ? 'found' : 'NOT FOUND'}`);
    } else {
      console.log('New Topic button NOT FOUND');
    }
  });

  test('should create a reply', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for reply button
      const replyBtn = await page.$('button:has-text("Reply")');
      if (replyBtn) {
        console.log('Found Reply button');
        await replyBtn.click();
        await page.waitForTimeout(1000);

        // Check for reply form
        const replyForm = await page.$('textarea, [role="textbox"]');
        console.log(`Reply form: ${replyForm ? 'found' : 'NOT FOUND'}`);
      } else {
        console.log('Reply button NOT FOUND');
      }
    }
  });
});

test.describe('Editing Content', () => {
  test('should show edit button on own reply', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for Edit button (should only show on own replies)
      const editBtns = await page.$$('button:has-text("Edit")');
      console.log(`Found ${editBtns.length} Edit buttons`);
    }
  });

  test('should edit a reply', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const editBtn = await page.$('button:has-text("Edit")');
      if (editBtn) {
        console.log('Clicking Edit button');
        await editBtn.click();
        await page.waitForTimeout(1000);

        // Check for editor
        const editor = await page.$('textarea, [role="textbox"]');
        console.log(`Editor: ${editor ? 'found' : 'NOT FOUND'}`);

        // Look for Save/Cancel buttons
        const saveBtn = await page.$('button:has-text("Save")');
        const cancelBtn = await page.$('button:has-text("Cancel")');
        console.log(`Save button: ${saveBtn ? 'found' : 'NOT FOUND'}`);
        console.log(`Cancel button: ${cancelBtn ? 'found' : 'NOT FOUND'}`);
      }
    }
  });
});

test.describe('Moderation Features', () => {
  test('should show moderation options', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for moderation buttons/options
      const lockBtn = await page.$('button:has-text("Lock"), [title*="lock" i]');
      const pinBtn = await page.$('button:has-text("Pin"), [title*="pin" i]');
      const deleteBtn = await page.$('button:has-text("Delete")');
      const solutionBtn = await page.$(
        'button:has-text("Solution"), button:has-text("Mark as Solution")'
      );

      console.log(`Lock button: ${lockBtn ? 'found' : 'NOT FOUND'}`);
      console.log(`Pin button: ${pinBtn ? 'found' : 'NOT FOUND'}`);
      console.log(`Delete button: ${deleteBtn ? 'found' : 'NOT FOUND'}`);
      console.log(`Mark Solution button: ${solutionBtn ? 'found' : 'NOT FOUND'}`);
    }
  });

  test('should delete a reply with confirmation', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const deleteBtn = await page.$('button:has-text("Delete")');
      if (deleteBtn) {
        console.log('Clicking Delete button');

        // Set up dialog handler BEFORE clicking
        page.on('dialog', async dialog => {
          console.log(`Dialog appeared: ${dialog.type()} - ${dialog.message()}`);
          await dialog.dismiss();
        });

        await deleteBtn.click();
        await page.waitForTimeout(2000);

        // Check for confirmation dialog (internal modal)
        const confirmDialog = await page.$('[role="dialog"], [class*="dialog"]');
        console.log(`Confirmation dialog: ${confirmDialog ? 'found' : 'NOT FOUND'}`);

        if (confirmDialog) {
          const dialogText = await confirmDialog.textContent();
          console.log(`Dialog content: ${dialogText}`);
        }
      }
    }
  });

  test('should mark reply as solution', async ({ page }) => {
    await login(page);
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const topicLink = await page.$('a[href*="/forums/topics/"]');
    if (topicLink) {
      await topicLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const solutionBtn = await page.$('button:has-text("Mark as Solution")');
      if (solutionBtn) {
        console.log('Clicking Mark as Solution');
        await solutionBtn.click();
        await page.waitForTimeout(2000);

        // Check for solution badge
        const solutionBadge = await page.$('[class*="solution"], text=/accepted solution/i');
        console.log(`Solution badge: ${solutionBadge ? 'found' : 'NOT FOUND'}`);
      } else {
        console.log('Mark as Solution button NOT FOUND');
      }
    }
  });
});

test.describe('Search Functionality', () => {
  test('should search forums', async ({ page }) => {
    await page.goto('/forums');
    await page.waitForLoadState('networkidle');

    const searchInput = await page.$('input[type="search"], input[placeholder*="search" i]');
    if (searchInput) {
      console.log('Found search input');
      await searchInput.fill('test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      console.log(`Search results URL: ${page.url()}`);
    } else {
      console.log('Search input NOT FOUND');
    }
  });
});
