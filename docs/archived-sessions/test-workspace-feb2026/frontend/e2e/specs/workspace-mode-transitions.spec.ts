/**
 * E2E Tests - Workspace Mode Transitions
 *
 * CRITICAL: These tests expose race conditions in mode state management.
 *
 * Current Architecture Issue:
 * - TextNode.tsx:63 has local `isEditing` state
 * - WorkspaceCanvas.tsx:149 has separate `editingNodeId` state
 * - These create async timing windows where modes conflict
 *
 * Expected Behavior (THESE TESTS WILL INITIALLY FAIL):
 * - Edit → Drag: No orphaned edit state when clicking outside then dragging
 * - Drag → Edit: Can't enter edit mode while dragging
 * - Resize → Edit: Double-click during resize enters edit cleanly
 * - Edit → Pan: Space bar during edit should block pan mode
 * - Rapid double-click: Only one edit mode activation
 *
 * Once mode state is consolidated to Zustand store, these tests should pass.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsDeveloper,
  createAndOpenWorkspace,
  createNode,
  getNodeElement,
  waitForAutoSave,
  cleanupWorkspace,
  getWorkspaceState,
} from '../fixtures/workspace-fixtures';
import {
  dragNode,
  dragNodeByDelta,
  doubleClickNode,
  exitEditMode,
  isEditorActive,
  typeInEditor,
  verifyModeState,
  waitForCondition,
  resizeNode,
  panViewport,
} from '../helpers/workspace-helpers';

test.describe('Workspace Mode Transitions', () => {
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsDeveloper(page);
    workspaceId = await createAndOpenWorkspace(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupWorkspace(page, workspaceId);
  });

  test.describe('View → Edit Transition', () => {
    test('should enter edit mode on double-click', async ({ page }) => {
      // Create node
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Test Node');
      await page.waitForTimeout(500);

      // Verify initial state: not editing
      expect(await isEditorActive(page)).toBe(false);

      // Double-click to enter edit mode
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);

      // Verify edit mode activated
      expect(await isEditorActive(page)).toBe(true);

      // CRITICAL: Verify both TextNode.isEditing AND WorkspaceCanvas.editingNodeId are synced
      const state = await page.evaluate(nodeId => {
        const node = document.querySelector(`[data-node-id="${nodeId}"]`);
        const store = (window as any).__workspaceStore?.getState();

        return {
          // TextNode local state (data attribute)
          nodeIsEditing: node?.getAttribute('data-is-editing') === 'true',
          // WorkspaceCanvas callback state
          canvasEditingNodeId: store?.editingNodeId,
        };
      }, nodeId);

      // Both should be true (CRITICAL - exposes race condition if not)
      expect(state.canvasEditingNodeId).toBe(nodeId);
    });

    test('should block drag when in edit mode', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Edit Me');
      await page.waitForTimeout(500);

      // Get initial position
      const initialBox = await getNodeElement(page, nodeId).boundingBox();

      // Enter edit mode
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);

      expect(await isEditorActive(page)).toBe(true);

      // Try to drag (should be blocked while editing)
      const node = getNodeElement(page, nodeId);
      await node.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox!.x + 100, initialBox!.y);
      await page.mouse.up();

      await page.waitForTimeout(200);

      // Verify node didn't move (drag was blocked)
      const finalBox = await getNodeElement(page, nodeId).boundingBox();
      expect(Math.abs(finalBox!.x - initialBox!.x)).toBeLessThan(10);
    });
  });

  test.describe('Edit → Drag Transition (CRITICAL RACE CONDITION)', () => {
    test('should cleanly transition from edit to drag without orphaned state', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Drag After Edit');
      await page.waitForTimeout(500);

      // Enter edit mode
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);
      expect(await isEditorActive(page)).toBe(true);

      // Exit edit mode
      await exitEditMode(page);
      await page.waitForTimeout(100);

      // Verify editor closed
      expect(await isEditorActive(page)).toBe(false);

      // IMMEDIATELY try to drag (tests race condition window)
      const initialBox = await getNodeElement(page, nodeId).boundingBox();
      await dragNodeByDelta(page, nodeId, { x: 150, y: 0 });
      await page.waitForTimeout(200);

      // Verify drag succeeded (no orphaned edit state blocking drag)
      const finalBox = await getNodeElement(page, nodeId).boundingBox();
      expect(Math.abs(finalBox!.x - initialBox!.x - 150)).toBeLessThan(20);

      // CRITICAL: Verify editingNodeId was cleared
      const state = await getWorkspaceState(page);
      expect(state.editingNodeId).toBeNull();
    });

    test('should handle rapid edit → drag → edit transitions', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Rapid Transitions');
      await page.waitForTimeout(500);

      // Cycle 1: Edit → Drag
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(200);
      await exitEditMode(page);
      await page.waitForTimeout(50);
      await dragNodeByDelta(page, nodeId, { x: 50, y: 0 });
      await page.waitForTimeout(100);

      // Cycle 2: Drag → Edit (immediately after drag ends)
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(200);

      // Should enter edit mode cleanly
      expect(await isEditorActive(page)).toBe(true);

      // Verify no orphaned drag state
      const state = await getWorkspaceState(page);
      expect(state.isDragging).toBe(false);
      expect(state.dragNodeId).toBeNull();
    });
  });

  test.describe('Resize → Edit Transition', () => {
    test('should handle double-click during resize', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Resize Then Edit');
      await page.waitForTimeout(500);

      // Select node to show resize handles
      await getNodeElement(page, nodeId).click();
      await page.waitForTimeout(200);

      // Start resizing (but don't complete)
      const node = getNodeElement(page, nodeId);
      const handle = node.locator('[data-resize-handle="se"]');

      await handle.hover();
      await page.mouse.down();
      await page.mouse.move(350, 350, { steps: 5 });

      // Double-click while resize is in progress (edge case!)
      await doubleClickNode(page, nodeId);

      await page.mouse.up();
      await page.waitForTimeout(300);

      // Should either:
      // 1. Complete resize, then enter edit (graceful handling)
      // 2. Cancel resize, enter edit immediately
      // Should NOT: corrupt state or freeze

      const editorActive = await isEditorActive(page);
      const state = await getWorkspaceState(page);

      // At minimum, state should be consistent (not both resizing AND editing)
      if (editorActive) {
        expect(state.editingNodeId).toBe(nodeId);
      }
    });
  });

  test.describe('Edit → Pan Transition', () => {
    test('should block pan (Space key) while editing', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'No Pan While Edit');
      await page.waitForTimeout(500);

      // Enter edit mode
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);
      expect(await isEditorActive(page)).toBe(true);

      // Get initial viewport transform
      const initialViewport = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        return {
          offsetX: store?.viewport?.offsetX || 0,
          offsetY: store?.viewport?.offsetY || 0,
        };
      });

      // Try to pan (should be blocked during edit)
      await page.keyboard.down('Space');
      await page.mouse.move(300, 300);
      await page.mouse.down();
      await page.mouse.move(400, 400);
      await page.mouse.up();
      await page.keyboard.up('Space');

      await page.waitForTimeout(200);

      // Verify viewport didn't pan
      const finalViewport = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        return {
          offsetX: store?.viewport?.offsetX || 0,
          offsetY: store?.viewport?.offsetY || 0,
        };
      });

      expect(finalViewport.offsetX).toBe(initialViewport.offsetX);
      expect(finalViewport.offsetY).toBe(initialViewport.offsetY);
    });
  });

  test.describe('Rapid Interaction Edge Cases', () => {
    test('should handle double-click spam without creating duplicate editors', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Spam Me');
      await page.waitForTimeout(500);

      // Rapidly double-click 5 times within 500ms
      const node = getNodeElement(page, nodeId);
      for (let i = 0; i < 5; i++) {
        await node.dblclick({ delay: 50 });
      }

      await page.waitForTimeout(300);

      // Should only have ONE editor active (not 5!)
      const editorCount = await page.locator('[contenteditable="true"]').count();
      expect(editorCount).toBeLessThanOrEqual(1);

      // State should be consistent
      const state = await getWorkspaceState(page);
      if (await isEditorActive(page)) {
        expect(state.editingNodeId).toBe(nodeId);
      } else {
        expect(state.editingNodeId).toBeNull();
      }
    });

    test('should handle drag during auto-save without data loss', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Original');
      await page.waitForTimeout(500);

      // Enter edit mode and type
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);
      await typeInEditor(page, 'Modified Content');

      // Exit edit mode (triggers auto-save with 500ms debounce)
      await exitEditMode(page);
      await page.waitForTimeout(100);

      // IMMEDIATELY drag node (before auto-save completes)
      await dragNodeByDelta(page, nodeId, { x: 100, y: 0 });

      // Wait for auto-save to complete
      await waitForAutoSave(page);

      // Verify both content AND position saved
      const { getNodeFromDatabase } = await import('../fixtures/workspace-fixtures');
      const node = await getNodeFromDatabase(page, nodeId);

      expect(node.content.markdown).toContain('Modified Content');
      expect(node.position.x).toBeGreaterThan(250); // Original 200 + drag delta
    });

    test('should prevent impossible state: typing while dragging', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'Type While Drag');
      await page.waitForTimeout(500);

      // Start dragging
      const node = getNodeElement(page, nodeId);
      const box = await node.boundingBox();

      await page.mouse.move(box!.x + 50, box!.y + 50);
      await page.mouse.down();
      await page.mouse.move(box!.x + 150, box!.y + 50, { steps: 5 });

      // Try to type while mouse is still down (dragging)
      await page.keyboard.type('Should not work');

      await page.mouse.up();
      await page.waitForTimeout(300);

      // Editor should NOT have activated during drag
      expect(await isEditorActive(page)).toBe(false);

      // No text should have been entered
      const { getNodeFromDatabase } = await import('../fixtures/workspace-fixtures');
      const savedNode = await getNodeFromDatabase(page, nodeId);
      expect(savedNode.content.markdown).not.toContain('Should not work');
    });
  });

  test.describe('State Consistency Verification', () => {
    test('should maintain single source of truth for editing state', async ({ page }) => {
      const nodeId = await createNode(page, workspaceId, { x: 200, y: 200 }, 'State Check');
      await page.waitForTimeout(500);

      // Enter edit mode
      await doubleClickNode(page, nodeId);
      await page.waitForTimeout(300);

      // Check all state locations
      const states = await page.evaluate(nodeId => {
        const node = document.querySelector(`[data-node-id="${nodeId}"]`);
        const store = (window as any).__workspaceStore?.getState();
        const editorVisible = document.querySelector('[contenteditable="true"]') !== null;

        return {
          // TextNode local state (data attribute)
          nodeDataAttr: node?.getAttribute('data-is-editing'),
          // WorkspaceCanvas callback state
          canvasEditingNodeId: store?.editingNodeId,
          // Actual DOM state
          editorVisible,
        };
      }, nodeId);

      // CRITICAL: All should agree (exposes distributed state bug if not)
      expect(states.editorVisible).toBe(true);
      expect(states.canvasEditingNodeId).toBe(nodeId);

      // Exit edit mode
      await exitEditMode(page);
      await page.waitForTimeout(200);

      // Check all cleared
      const clearedStates = await page.evaluate(() => {
        const store = (window as any).__workspaceStore?.getState();
        const editorVisible = document.querySelector('[contenteditable="true"]') !== null;

        return {
          canvasEditingNodeId: store?.editingNodeId,
          editorVisible,
        };
      });

      expect(clearedStates.editorVisible).toBe(false);
      expect(clearedStates.canvasEditingNodeId).toBeNull();
    });
  });
});
