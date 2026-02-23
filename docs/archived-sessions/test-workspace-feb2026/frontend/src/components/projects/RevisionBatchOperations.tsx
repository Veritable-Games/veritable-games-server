'use client';

import { useState, useMemo, useCallback } from 'react';
import { Revision } from '@/hooks/useRevisionManager';
import { useRevisionBookmarks } from '@/hooks/useRevisionBookmarks';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';
import { logger } from '@/lib/utils/logger';

interface RevisionGroup {
  id: string;
  name: string;
  description: string;
  revisionIds: number[];
  color: string;
  createdAt: string;
  tags: string[];
}

interface BatchOperation {
  type: 'bookmark' | 'tag' | 'group' | 'compare';
  label: string;
  icon: string;
  description: string;
  requiresInput?: boolean;
}

interface RevisionBatchOperationsProps {
  revisions: Revision[];
  selectedRevisions: number[];
  projectSlug: string;
  onRevisionSelect: (id: number) => void;
  onBulkSelect: (ids: number[]) => void;
  onClearSelections: () => void;
  onCompareSelected: () => void;
}

const BATCH_OPERATIONS: BatchOperation[] = [
  {
    type: 'bookmark',
    label: 'Bookmark All',
    icon: '🔖',
    description: 'Add bookmarks to selected revisions',
    requiresInput: true,
  },
  {
    type: 'tag',
    label: 'Add Tags',
    icon: '🏷️',
    description: 'Add tags to selected revision bookmarks',
    requiresInput: true,
  },
  {
    type: 'group',
    label: 'Create Group',
    icon: '📁',
    description: 'Group selected revisions together',
    requiresInput: true,
  },
  {
    type: 'compare',
    label: 'Compare Chain',
    icon: '🔍',
    description: 'Compare revisions in sequence',
  },
];

const GROUP_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#f97316',
];

export function RevisionBatchOperations({
  revisions,
  selectedRevisions,
  projectSlug,
  onRevisionSelect,
  onBulkSelect,
  onClearSelections,
  onCompareSelected,
}: RevisionBatchOperationsProps) {
  const { formatDate, formatSize } = useRevisionFormatting();
  const { bookmarks, addBookmark, updateBookmark, BOOKMARK_COLORS } =
    useRevisionBookmarks(projectSlug);

  const [groups, setGroups] = useState<RevisionGroup[]>([]);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [operationModal, setOperationModal] = useState<{
    operation: BatchOperation | null;
    inputs: Record<string, string>;
  }>({ operation: null, inputs: {} });

  // Load/save groups from localStorage
  const groupsKey = `revision-groups-${projectSlug}`;

  const loadGroups = useCallback(() => {
    try {
      const saved = localStorage.getItem(groupsKey);
      if (saved) {
        setGroups(JSON.parse(saved));
      }
    } catch (error) {
      logger.error('Failed to load groups:', error);
    }
  }, [groupsKey]);

  const saveGroups = useCallback(
    (newGroups: RevisionGroup[]) => {
      try {
        localStorage.setItem(groupsKey, JSON.stringify(newGroups));
        setGroups(newGroups);
      } catch (error) {
        logger.error('Failed to save groups:', error);
      }
    },
    [groupsKey]
  );

  // Initialize groups on mount
  useState(() => {
    loadGroups();
  });

  // Group revisions by various criteria
  const autoGroups = useMemo(() => {
    if (revisions.length === 0) return [];

    const results: { name: string; description: string; revisions: Revision[]; color: string }[] =
      [];

    // Group by time periods
    const now = new Date();
    const thisWeek = revisions.filter(r => {
      const date = new Date(r.revision_timestamp);
      const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });

    if (thisWeek.length > 1) {
      results.push({
        name: 'This Week',
        description: `${thisWeek.length} revisions from the past week`,
        revisions: thisWeek,
        color: '#10b981',
      });
    }

    // Group by size changes
    const sortedByTime = [...revisions].sort(
      (a, b) => new Date(a.revision_timestamp).getTime() - new Date(b.revision_timestamp).getTime()
    );

    const majorChanges = [];
    for (let i = 1; i < sortedByTime.length; i++) {
      const current = sortedByTime[i];
      const previous = sortedByTime[i - 1];
      if (!current || !previous) continue;
      const sizeChange = Math.abs(current.size - previous.size);
      const changePercentage = previous.size > 0 ? (sizeChange / previous.size) * 100 : 0;

      if (changePercentage > 20) {
        majorChanges.push(current);
      }
    }

    if (majorChanges.length > 1) {
      results.push({
        name: 'Major Changes',
        description: `${majorChanges.length} revisions with significant size changes`,
        revisions: majorChanges,
        color: '#f59e0b',
      });
    }

    // Group by authors
    const authors = [...new Set(revisions.map(r => r.author_name))];
    if (authors.length > 1) {
      authors.forEach(author => {
        const authorRevisions = revisions.filter(r => r.author_name === author);
        if (authorRevisions.length > 2) {
          results.push({
            name: `By ${author}`,
            description: `${authorRevisions.length} revisions by ${author}`,
            revisions: authorRevisions,
            color: '#3b82f6',
          });
        }
      });
    }

    return results;
  }, [revisions]);

  // Handle batch operation
  const handleBatchOperation = useCallback(
    async (operation: BatchOperation) => {
      if (selectedRevisions.length === 0) return;

      switch (operation.type) {
        case 'bookmark':
          if (operation.requiresInput) {
            setOperationModal({ operation, inputs: { label: '', tags: '' } });
          } else {
            selectedRevisions.forEach(id => {
              const revision = revisions.find(r => r.id === id);
              if (revision) {
                addBookmark(id, `Revision #${id}`, '', [], BOOKMARK_COLORS[0]);
              }
            });
          }
          break;

        case 'compare':
          if (selectedRevisions.length >= 2) {
            onCompareSelected();
          }
          break;

        case 'group':
          if (operation.requiresInput) {
            setOperationModal({ operation, inputs: { name: '', description: '', tags: '' } });
          }
          break;

        case 'tag':
          if (operation.requiresInput) {
            setOperationModal({ operation, inputs: { tags: '' } });
          }
          break;
      }
    },
    [selectedRevisions, revisions, addBookmark, BOOKMARK_COLORS, onCompareSelected]
  );

  // Execute modal operation
  const executeModalOperation = useCallback(() => {
    const { operation, inputs } = operationModal;
    if (!operation || selectedRevisions.length === 0) return;

    switch (operation.type) {
      case 'bookmark':
        const tags = inputs.tags ? inputs.tags.split(',').map(t => t.trim()) : [];
        selectedRevisions.forEach(id => {
          addBookmark(id, inputs.label || `Revision #${id}`, '', tags, BOOKMARK_COLORS[0]);
        });
        break;

      case 'group':
        const newGroup: RevisionGroup = {
          id: `group-${Date.now()}`,
          name: inputs.name || 'New Group',
          description: inputs.description || '',
          revisionIds: [...selectedRevisions],
          color: GROUP_COLORS[groups.length % GROUP_COLORS.length] || '#6B7280',
          createdAt: new Date().toISOString(),
          tags: inputs.tags ? inputs.tags.split(',').map(t => t.trim()) : [],
        };
        saveGroups([...groups, newGroup]);
        break;

      case 'tag':
        const newTags = inputs.tags ? inputs.tags.split(',').map(t => t.trim()) : [];
        selectedRevisions.forEach(id => {
          const existingBookmark = bookmarks.find(b => b.revisionId === id);
          if (existingBookmark) {
            const updatedTags = [...new Set([...existingBookmark.tags, ...newTags])];
            updateBookmark(id, { tags: updatedTags });
          } else {
            addBookmark(id, `Revision #${id}`, '', newTags, BOOKMARK_COLORS[0]);
          }
        });
        break;
    }

    setOperationModal({ operation: null, inputs: {} });
  }, [
    operationModal,
    selectedRevisions,
    groups,
    saveGroups,
    bookmarks,
    addBookmark,
    updateBookmark,
    BOOKMARK_COLORS,
  ]);

  // Bulk selection helpers
  const selectAll = useCallback(() => {
    onBulkSelect(revisions.map(r => r.id));
  }, [revisions, onBulkSelect]);

  const selectNone = useCallback(() => {
    onClearSelections();
  }, [onClearSelections]);

  const selectAutoGroup = useCallback(
    (groupRevisions: Revision[]) => {
      onBulkSelect(groupRevisions.map(r => r.id));
    },
    [onBulkSelect]
  );

  if (revisions.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Batch Operations Panel */}
      <div className="rounded border border-gray-700 bg-gray-900/50">
        <div className="border-b border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Batch Operations</h3>
            <div className="flex items-center gap-2">
              {selectedRevisions.length > 0 && (
                <span className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
                  {selectedRevisions.length} selected
                </span>
              )}
              <button
                onClick={() => setShowBatchPanel(!showBatchPanel)}
                className="text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                {showBatchPanel ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        {showBatchPanel && (
          <div className="space-y-4 p-3">
            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
                >
                  Select All ({revisions.length})
                </button>
                <button
                  onClick={selectNone}
                  className="rounded bg-gray-700 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-600"
                  disabled={selectedRevisions.length === 0}
                >
                  Clear Selection
                </button>
              </div>
              <div className="text-xs text-gray-400">
                {selectedRevisions.length} of {revisions.length} revisions selected
              </div>
            </div>

            {/* Batch Operations */}
            {selectedRevisions.length > 0 && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                {BATCH_OPERATIONS.map(operation => (
                  <button
                    key={operation.type}
                    onClick={() => handleBatchOperation(operation)}
                    disabled={
                      (operation.type === 'compare' && selectedRevisions.length < 2) ||
                      (operation.type === 'group' && selectedRevisions.length < 2)
                    }
                    className={`rounded p-2 text-xs transition-colors ${
                      (operation.type === 'compare' && selectedRevisions.length < 2) ||
                      (operation.type === 'group' && selectedRevisions.length < 2)
                        ? 'cursor-not-allowed bg-gray-800 text-gray-500'
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                    }`}
                    title={operation.description}
                  >
                    <div className="mb-1 text-lg">{operation.icon}</div>
                    <div>{operation.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Smart Grouping Suggestions */}
      {autoGroups.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3">
          <h4 className="mb-3 text-sm font-medium text-white">Smart Grouping Suggestions</h4>
          <div className="space-y-2">
            {autoGroups.map((group, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded border border-gray-600 bg-gray-800 p-2"
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <div>
                    <div className="text-sm font-medium text-white">{group.name}</div>
                    <div className="text-xs text-gray-400">{group.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => selectAutoGroup(group.revisions)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500"
                  >
                    Select ({group.revisions.length})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Groups */}
      {groups.length > 0 && (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3">
          <h4 className="mb-3 text-sm font-medium text-white">Saved Groups</h4>
          <div className="space-y-2">
            {groups.map(group => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded border border-gray-600 bg-gray-800 p-2"
              >
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <div>
                    <div className="text-sm font-medium text-white">{group.name}</div>
                    <div className="text-xs text-gray-400">
                      {group.description} • {group.revisionIds.length} revisions
                    </div>
                    {group.tags.length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        {group.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded bg-gray-700 px-1 text-xs text-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onBulkSelect(group.revisionIds)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => {
                      const newGroups = groups.filter(g => g.id !== group.id);
                      saveGroups(newGroups);
                    }}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white transition-colors hover:bg-red-500"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operation Modal */}
      {operationModal.operation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-6">
            <h3 className="mb-4 text-lg font-medium text-white">
              {operationModal.operation.icon} {operationModal.operation.label}
            </h3>
            <div className="space-y-4">
              {operationModal.operation.type === 'bookmark' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Label</label>
                    <input
                      type="text"
                      placeholder="Bookmark label"
                      value={operationModal.inputs.label || ''}
                      onChange={e =>
                        setOperationModal(prev => ({
                          ...prev,
                          inputs: { ...prev.inputs, label: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="milestone, feature, etc."
                      value={operationModal.inputs.tags || ''}
                      onChange={e =>
                        setOperationModal(prev => ({
                          ...prev,
                          inputs: { ...prev.inputs, tags: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  </div>
                </>
              )}

              {operationModal.operation.type === 'group' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Group Name</label>
                    <input
                      type="text"
                      placeholder="Group name"
                      value={operationModal.inputs.name || ''}
                      onChange={e =>
                        setOperationModal(prev => ({
                          ...prev,
                          inputs: { ...prev.inputs, name: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Description</label>
                    <input
                      type="text"
                      placeholder="Optional description"
                      value={operationModal.inputs.description || ''}
                      onChange={e =>
                        setOperationModal(prev => ({
                          ...prev,
                          inputs: { ...prev.inputs, description: e.target.value },
                        }))
                      }
                      className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                    />
                  </div>
                </>
              )}

              {operationModal.operation.type === 'tag' && (
                <div>
                  <label className="mb-1 block text-sm text-gray-300">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="milestone, feature, etc."
                    value={operationModal.inputs.tags || ''}
                    onChange={e =>
                      setOperationModal(prev => ({
                        ...prev,
                        inputs: { ...prev.inputs, tags: e.target.value },
                      }))
                    }
                    className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                  />
                </div>
              )}

              <div className="text-sm text-gray-400">
                Will apply to {selectedRevisions.length} selected revisions
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOperationModal({ operation: null, inputs: {} })}
                className="px-4 py-2 text-gray-300 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={executeModalOperation}
                className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
