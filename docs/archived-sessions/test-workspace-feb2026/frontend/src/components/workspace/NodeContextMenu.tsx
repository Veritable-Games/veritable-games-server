'use client';

/**
 * Node Context Menu Component
 *
 * Right-click context menu for workspace nodes.
 * Shows actions based on node selection and lock status.
 */

import { useEffect, useRef, useMemo } from 'react';
import { CanvasNode, isNodeLocked } from '@/lib/workspace/types';

export type NodeContextAction =
  | 'lock'
  | 'unlock'
  | 'delete'
  | 'duplicate'
  | 'copy'
  | 'bring-to-front'
  | 'send-to-back';

interface ContextMenuItem {
  id: string;
  label?: string;
  icon?: string;
  action?: NodeContextAction;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

interface NodeContextMenuProps {
  x: number; // Screen coordinates
  y: number;
  targetNodeId: string | null; // Node that was clicked
  selectedNodeIds: Set<string>; // All selected nodes
  nodes: Map<string, CanvasNode>; // For checking lock status
  onClose: () => void;

  // Action handlers
  onLock: (nodeIds: string[]) => void;
  onUnlock: (nodeIds: string[]) => void;
  onDelete: (nodeIds: string[]) => void;
  onDuplicate: (nodeIds: string[]) => void;
  onCopy: (nodeIds: string[]) => void;
  onBringToFront: (nodeIds: string[]) => void;
  onSendToBack: (nodeIds: string[]) => void;
}

/**
 * Build context menu items based on selection state
 */
function buildMenuItems(
  targetNodeId: string | null,
  selectedNodeIds: Set<string>,
  nodes: Map<string, CanvasNode>
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // Determine which nodes to operate on
  const operatingNodeIds =
    targetNodeId && !selectedNodeIds.has(targetNodeId)
      ? [targetNodeId] // Right-clicked on unselected node
      : Array.from(selectedNodeIds); // Right-clicked on selected node or group

  if (operatingNodeIds.length === 0) return items;

  // Check lock status
  const allLocked = operatingNodeIds.every(id => {
    const node = nodes.get(id);
    return node && isNodeLocked(node);
  });

  // Lock/Unlock menu item (smart toggle)
  if (allLocked) {
    items.push({
      id: 'unlock',
      label: `Unlock ${operatingNodeIds.length > 1 ? 'Nodes' : 'Node'}`,
      icon: '🔓',
      action: 'unlock',
      shortcut: 'Ctrl+L',
    });
  } else {
    items.push({
      id: 'lock',
      label: `Lock ${operatingNodeIds.length > 1 ? 'Nodes' : 'Node'}`,
      icon: '🔒',
      action: 'lock',
      shortcut: 'Ctrl+L',
    });
  }

  items.push({ id: 'divider-1', divider: true });

  // Copy/Duplicate
  items.push({
    id: 'copy',
    label: 'Copy',
    icon: '📋',
    action: 'copy',
    shortcut: 'Ctrl+C',
  });
  items.push({
    id: 'duplicate',
    label: 'Duplicate',
    icon: '📑',
    action: 'duplicate',
    shortcut: 'Ctrl+D',
  });

  items.push({ id: 'divider-2', divider: true });

  // Z-order
  items.push({
    id: 'bring-to-front',
    label: 'Bring to Front',
    action: 'bring-to-front',
  });
  items.push({
    id: 'send-to-back',
    label: 'Send to Back',
    action: 'send-to-back',
  });

  items.push({ id: 'divider-3', divider: true });

  // Delete (disabled if all nodes are locked)
  items.push({
    id: 'delete',
    label: `Delete ${operatingNodeIds.length > 1 ? 'Nodes' : 'Node'}`,
    icon: '🗑️',
    action: 'delete',
    shortcut: 'Del',
    disabled: allLocked, // Can't delete locked nodes
  });

  return items;
}

export default function NodeContextMenu({
  x,
  y,
  targetNodeId,
  selectedNodeIds,
  nodes,
  onClose,
  onLock,
  onUnlock,
  onDelete,
  onDuplicate,
  onCopy,
  onBringToFront,
  onSendToBack,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Build menu items based on selection state
  const menuItems = useMemo(
    () => buildMenuItems(targetNodeId, selectedNodeIds, nodes),
    [targetNodeId, selectedNodeIds, nodes]
  );

  // Determine which nodes to operate on
  const operatingNodeIds = useMemo(() => {
    if (targetNodeId && !selectedNodeIds.has(targetNodeId)) {
      return [targetNodeId];
    }
    return Array.from(selectedNodeIds);
  }, [targetNodeId, selectedNodeIds]);

  // Close on outside click or ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Use capture phase (true) to catch events before stopPropagation() in child elements
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Handle menu item click
  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled || !item.action) return;

    switch (item.action) {
      case 'lock':
        onLock(operatingNodeIds);
        break;
      case 'unlock':
        onUnlock(operatingNodeIds);
        break;
      case 'delete':
        onDelete(operatingNodeIds);
        break;
      case 'duplicate':
        onDuplicate(operatingNodeIds);
        break;
      case 'copy':
        onCopy(operatingNodeIds);
        break;
      case 'bring-to-front':
        onBringToFront(operatingNodeIds);
        break;
      case 'send-to-back':
        onSendToBack(operatingNodeIds);
        break;
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="menu"
      aria-label="Node context menu"
    >
      {menuItems.map(item => {
        if (item.divider) {
          return <div key={item.id} className="my-1 h-px bg-neutral-700" role="separator" />;
        }

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors ${
              item.disabled
                ? 'cursor-not-allowed text-neutral-500'
                : 'text-neutral-200 hover:bg-neutral-800'
            }`}
            role="menuitem"
            disabled={item.disabled}
          >
            <span className="flex items-center gap-2">
              {item.icon && <span className="text-base">{item.icon}</span>}
              <span>{item.label}</span>
            </span>
            {item.shortcut && <span className="text-xs text-neutral-500">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}
