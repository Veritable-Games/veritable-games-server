'use client';

import React from 'react';

interface ControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Controls Modal - Shows keyboard shortcuts and interaction help
 * Inspired by Three.js viewer controls panel
 */
export default function ControlsModal({ isOpen, onClose }: ControlsModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-label="Close controls modal"
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-neutral-800 px-6 py-4">
          <h2 className="text-center text-lg font-medium text-neutral-200">Controls</h2>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-500 transition-colors hover:text-neutral-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* Canvas Navigation */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-400">Canvas</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Pan canvas</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Middle-drag
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Zoom in/out</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Wheel
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Zoom (touch)</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  2-finger pinch
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Reset view</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  R
                </kbd>
              </div>
            </div>
          </section>

          {/* Node Operations */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-400">Nodes</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Create node</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Double-click
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Edit node</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Delete</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Delete
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Duplicate</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+D
                </kbd>
              </div>
            </div>
          </section>

          {/* Selection */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-400">Selection</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Select all</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+A
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Multi-select</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Shift+click
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Box select</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Drag canvas
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Deselect all</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Esc
                </kbd>
              </div>
            </div>
          </section>

          {/* Clipboard */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-400">Clipboard</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Copy</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+C
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Cut</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+X
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Paste</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+V
                </kbd>
              </div>
            </div>
          </section>

          {/* History */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-neutral-400">History</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Undo</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+Z
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Redo</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+Shift+Z
                </kbd>
              </div>
            </div>
          </section>

          {/* File Operations */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-neutral-400">File</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Export to JSON</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+E
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Import from JSON</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+Shift+I
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">Import from CSV (Miro)</span>
                <kbd className="rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400">
                  Ctrl+Shift+M
                </kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
