'use client';

import React from 'react';
import { ArrowUturnLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';

interface Revision {
  id: number;
  content: string;
  summary: string;
  revision_timestamp: string;
  author_name: string;
  size: number;
}

interface RevisionListPanelProps {
  revisions: Revision[];
  leftRevision: Revision | null;
  rightRevision: Revision | null;
  onRevisionClick: (revision: Revision) => void;
  onDeleteRevision: (revisionId: number, e: React.MouseEvent) => void;
  onRestoreRevision: (revision: Revision, e: React.MouseEvent) => void;
}

export const RevisionListPanel: React.FC<RevisionListPanelProps> = ({
  revisions,
  leftRevision,
  rightRevision,
  onRevisionClick,
  onDeleteRevision,
  onRestoreRevision,
}) => {
  const formatting = useRevisionFormatting();

  if (revisions.length === 0) {
    return (
      <div className="flex min-h-0 w-1/4 flex-col border-r border-gray-700">
        <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Revisions</h3>
          <p className="mt-1 text-xs text-gray-400">Click to select for comparison</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 text-center text-gray-400">
            <p>No revisions found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-1/4 flex-col border-r border-gray-700">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800/40 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Revisions</h3>
        <p className="mt-1 text-xs text-gray-400">Click to select for comparison</p>
      </div>

      {/* Revision List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {revisions.map((revision, index) => {
            const isLeft = leftRevision?.id === revision.id;
            const isRight = rightRevision?.id === revision.id;

            return (
              <div
                key={revision.id}
                className={`group relative w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                  isLeft
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : isRight
                      ? 'border-red-500 bg-red-500/10 text-white'
                      : 'border-gray-600 bg-gray-800/30 text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
                onClick={() => onRevisionClick(revision)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-blue-400">#{revision.id}</span>
                    {index === 0 && (
                      <span className="whitespace-nowrap rounded bg-green-500 px-1.5 py-0.5 text-xs text-white">
                        Current
                      </span>
                    )}
                    {isLeft && (
                      <span className="whitespace-nowrap rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                        Left
                      </span>
                    )}
                    {isRight && (
                      <span className="whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-xs text-white">
                        Right
                      </span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={e => onRestoreRevision(revision, e)}
                      className="rounded p-1.5 text-gray-300 transition-colors hover:bg-gray-600/30 hover:text-gray-100"
                      title="Restore this revision"
                      aria-label="Restore revision"
                    >
                      <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => onDeleteRevision(revision.id, e)}
                      className="rounded p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                      title="Delete revision"
                      aria-label="Delete revision"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-1">
                  <p className="truncate text-sm font-medium">{revision.summary || 'No summary'}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                    <span>{revision.author_name}</span>
                    <span>•</span>
                    <span>{formatting.formatDate(revision.revision_timestamp, true)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RevisionListPanel;
