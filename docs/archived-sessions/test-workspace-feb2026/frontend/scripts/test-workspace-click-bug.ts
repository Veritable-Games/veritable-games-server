#!/usr/bin/env tsx
/**
 * Test for workspace node click/delete bug
 *
 * Hypothesis: When user clicks on a node (outer div), it gets focused.
 * If they then press Backspace (thinking they're going back), the
 * keyboard handler's isTyping check fails because the outer div
 * is not contentEditable, so the node gets deleted.
 */

import { chromium } from '@playwright/test';

async function testWorkspaceBug() {
  console.log('🔍 Testing workspace node disappearing bug...\n');

  const browser = await chromium.launch({ headless: false, devtools: true });
  const page = await browser.newPage();

  // Listen for console logs
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (
      text.includes('[Yjs Observer] DELETE') ||
      text.includes('[deleteNode]') ||
      text.includes('[TextNode]')
    ) {
      console.log(`🔴 [${type.toUpperCase()}] ${text}`);
    }
  });

  try {
    // Navigate to login
    await page.goto('http://localhost:3000/auth/login');
    await page.waitForLoadState('networkidle');

    // Login as admin (password from environment or .claude-credentials)
    const password = process.env.ADMIN_PASSWORD || 'your-admin-password-here';
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/projects');

    console.log('✅ Logged in successfully\n');

    // Find first project or create test project
    const firstProject = await page.locator('a[href^="/projects/"]').first();
    if ((await firstProject.count()) > 0) {
      const href = await firstProject.getAttribute('href');
      if (href) {
        // Navigate to workspace
        await page.goto(`http://localhost:3000${href}/workspace`);
        await page.waitForLoadState('networkidle');
        console.log(`✅ Navigated to workspace: ${href}/workspace\n`);
      }
    } else {
      console.log('⚠️  No projects found. Please create a test project first.');
      await browser.close();
      return;
    }

    // Wait for workspace to load
    await page.waitForTimeout(2000);

    // Check if there are any nodes
    const nodes = await page.locator('[class*="absolute"][class*="cursor"]').all();
    console.log(`Found ${nodes.length} nodes on canvas\n`);

    if (nodes.length === 0) {
      console.log('⚠️  No nodes found. Creating a test node...');
      // Double-click to create a node
      await page.mouse.dblclick(400, 400);
      await page.waitForTimeout(1000);
    }

    // Get first node
    const firstNode = await page.locator('[class*="absolute"][class*="cursor"]').first();

    console.log('🧪 TEST: Click on node and check what gets focused\n');

    // Click on the node
    await firstNode.click();
    await page.waitForTimeout(500);

    // Check what element is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        tagName: el?.tagName,
        className: el?.className,
        isContentEditable: el?.isContentEditable || false,
        hasContentEditableParent: el?.closest('[contenteditable="true"]') !== null,
      };
    });

    console.log('Focused element after click:', focusedElement);

    if (!focusedElement.isContentEditable) {
      console.log('\n❌ BUG CONFIRMED: Focused element is NOT contentEditable!');
      console.log('   This means the isTyping check will FAIL.');
      console.log('   If user presses Backspace now, node will be deleted!\n');

      // Test the bug
      console.log('🧪 TEST: Press Backspace and see if node disappears\n');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(500);

      const nodesAfter = await page.locator('[class*="absolute"][class*="cursor"]').count();
      console.log(`Nodes after Backspace: ${nodesAfter}\n`);

      if (nodesAfter < nodes.length) {
        console.log('💥 BUG REPRODUCED: Node was deleted by Backspace key!');
      }
    } else {
      console.log('\n✅ Focused element IS contentEditable - bug may not occur here');
    }

    // Keep browser open for inspection
    console.log('\n📊 Browser will stay open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  testWorkspaceBug().catch(console.error);
}
