'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { DependencyGraphViewer } from './DependencyGraphViewer';
import { ScriptEditorPanel } from './ScriptEditorPanel';
import { TerminalPanel } from './TerminalPanel';
import { PanelLayoutProvider } from '@/contexts/PanelLayoutContext';
import { logger } from '@/lib/utils/logger';

interface Project {
  slug: string;
  title: string;
}

interface Version {
  id: number;
  versionTag: string;
  isActive: boolean;
}

interface GodotDevOverlayProps {
  onClose: () => void;
}

/**
 * GodotDevOverlay - Main developer overlay for Godot project visualization
 * Accessible via backtick (`) keyboard shortcut for admin/developer only
 */
export function GodotDevOverlay({ onClose }: GodotDevOverlayProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(60); // percentage
  const [showTerminal, setShowTerminal] = useState(false);

  // Panel repositioning mode (Ctrl+Click) - shared across all panels
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load versions when project changes
  useEffect(() => {
    if (selectedProject) {
      loadVersions(selectedProject);
    }
  }, [selectedProject]);

  // Handle keyboard events for panel repositioning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.ctrlKey) {
        setIsCtrlPressed(true);
      }
      if (e.key === 'Escape') {
        if (selectedPanelId) {
          // Deselect panel first
          setSelectedPanelId(null);
          e.preventDefault();
          e.stopPropagation();
        } else {
          // Close console if no panel is selected
          onClose();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || !e.ctrlKey) {
        setIsCtrlPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedPanelId, onClose]);

  // Handler for Ctrl+Click panel selection
  const handlePanelClick = useCallback(
    (panelId: string) => {
      if (isCtrlPressed) {
        if (selectedPanelId === panelId) {
          // Deselect if clicking same panel
          setSelectedPanelId(null);
        } else {
          // Select new panel
          setSelectedPanelId(panelId);
        }
      }
    },
    [isCtrlPressed, selectedPanelId]
  );

  const loadProjects = async () => {
    try {
      setLoading(true);
      logger.info('[GodotDevOverlay] Loading projects...');

      const response = await fetch('/api/godot/projects');
      logger.info(`[GodotDevOverlay] Projects response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[GodotDevOverlay] Failed to load projects: ${errorText}`);
        throw new Error('Failed to load projects');
      }

      const data = await response.json();
      logger.info(`[GodotDevOverlay] Loaded ${data.length} projects:`, data);

      setProjects(data);
      if (data.length > 0) {
        logger.info(`[GodotDevOverlay] Setting selected project to: ${data[0].slug}`);
        setSelectedProject(data[0].slug);
      } else {
        logger.warn('[GodotDevOverlay] No projects found');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[GodotDevOverlay] Error loading projects:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (projectSlug: string) => {
    try {
      setLoading(true);
      logger.info(`[GodotDevOverlay] Loading versions for project: ${projectSlug}`);

      const response = await fetch(`/api/godot/projects/${projectSlug}/versions`);

      logger.info(`[GodotDevOverlay] Versions response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[GodotDevOverlay] Failed to load versions: ${errorText}`);
        throw new Error('Failed to load versions');
      }

      const data = await response.json();
      logger.info(`[GodotDevOverlay] Loaded ${data.length} versions:`, data);

      setVersions(data);
      const activeVersion = data.find((v: Version) => v.isActive);
      if (activeVersion) {
        logger.info(`[GodotDevOverlay] Setting active version: ${activeVersion.id}`);
        setSelectedVersion(activeVersion.id);
      } else if (data.length > 0) {
        logger.info(`[GodotDevOverlay] No active version, setting first version: ${data[0].id}`);
        setSelectedVersion(data[0].id);
      } else {
        logger.warn(`[GodotDevOverlay] No versions found for project ${projectSlug}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('[GodotDevOverlay] Error loading versions:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleSaveScript = useCallback(
    async (filePath: string, content: string) => {
      if (!selectedVersion) {
        throw new Error('No version selected');
      }

      const response = await fetch(`/api/godot/versions/${selectedVersion}/scripts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save script');
      }

      return response.json();
    },
    [selectedVersion]
  );

  useEffect(() => {
    const handleMouseUp = () => setIsResizing(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width based on mouse position
      const container = document.getElementById('godot-overlay-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Keep width between 20% and 80%
      if (newWidth >= 20 && newWidth <= 80) {
        setPanelWidth(newWidth);
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <PanelLayoutProvider versionId={selectedVersion || 0}>
      <div id="godot-overlay-container" className="fixed inset-0 z-50 flex flex-col bg-black/80">
        {/* Title Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Godot Developer Console</h1>

            {/* Project Selector */}
            <select
              value={selectedProject || ''}
              onChange={e => setSelectedProject(e.target.value)}
              className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            >
              <option value="">Select a project...</option>
              {projects.map(project => (
                <option key={project.slug} value={project.slug}>
                  {project.title}
                </option>
              ))}
            </select>

            {/* Version Selector */}
            {selectedProject && (
              <select
                value={selectedVersion || ''}
                onChange={e => setSelectedVersion(parseInt(e.target.value))}
                className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={loading || versions.length === 0}
              >
                <option value="">Select a version...</option>
                {versions.map(version => (
                  <option key={version.id} value={version.id}>
                    {version.versionTag}
                    {version.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Terminal Button */}
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className="flex items-center gap-2 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-blue-500 hover:bg-gray-700"
            title="Open MCP Terminal (shows startup commands)"
          >
            <span>{showTerminal ? 'Hide Terminal' : 'Show Terminal'}</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-200"
            title="Close (Esc)"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-b border-red-700 bg-red-900/50 px-4 py-2 text-sm text-red-200">
            Error: {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-300 underline hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* Left Panel - Visualization (resizable) */}
          <div
            className="overflow-hidden border-r border-gray-700 bg-gray-950"
            style={{ width: `${panelWidth}%` }}
          >
            {selectedVersion ? (
              <DependencyGraphViewer
                versionId={selectedVersion}
                activeNodePath={selectedScriptPath || undefined}
                onNodeClick={setSelectedScriptPath}
                isCtrlPressed={isCtrlPressed}
                selectedPanelId={selectedPanelId}
                onPanelClick={handlePanelClick}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-sm">Select a project and version to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="w-1 shrink-0 cursor-col-resize bg-gray-700 transition-colors hover:bg-blue-500"
            title="Drag to resize panels"
          />

          {/* Right Panel - Script Editor */}
          <div className="overflow-hidden bg-gray-900" style={{ width: `${100 - panelWidth}%` }}>
            {selectedVersion && selectedScriptPath ? (
              <ScriptEditorPanel
                versionId={selectedVersion}
                scriptPath={selectedScriptPath}
                onSave={handleSaveScript}
                onClose={() => setSelectedScriptPath(null)}
              />
            ) : selectedVersion ? (
              <div className="flex h-full flex-col">
                {/* Default Info Panel */}
                <div className="shrink-0 border-b border-gray-700 bg-gray-800/50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-300">Version Info</h2>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-300">
                        {versions.find(v => v.id === selectedVersion)?.versionTag}
                      </h3>
                      <div className="space-y-2 text-xs text-gray-500">
                        <p>
                          Status:{' '}
                          <span className="text-gray-400">
                            {versions.find(v => v.id === selectedVersion)?.isActive
                              ? '🟢 Active'
                              : '⚪ Inactive'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-300">How to Use</h3>
                      <ul className="space-y-2 text-xs text-gray-500">
                        <li>• Click a script node in the graph to view/edit</li>
                        <li>• Hover for dependency info</li>
                        <li>• Right panel shows script content</li>
                        <li>• Make changes and click Save</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-300">
                        Keyboard Shortcuts
                      </h3>
                      <ul className="space-y-1 text-xs text-gray-500">
                        <li>
                          <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">
                            Ctrl+S
                          </kbd>{' '}
                          - Save script
                        </li>
                        <li>
                          <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">`</kbd> -
                          Toggle overlay
                        </li>
                        <li>
                          <kbd className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-400">Esc</kbd>{' '}
                          - Close overlay
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                <p className="text-sm">Select a project and version to begin</p>
              </div>
            )}
          </div>
        </div>

        {/* Terminal Panel (floats over content) */}
        {showTerminal && (
          <TerminalPanel
            versionId={selectedVersion || undefined}
            projectSlug={selectedProject || undefined}
            onClose={() => setShowTerminal(false)}
            isSelected={selectedPanelId === 'terminal'}
            onSelect={() => handlePanelClick('terminal')}
            allowDragFromAnywhere={selectedPanelId === 'terminal'}
          />
        )}

        {/* Status Bar */}
        <div className="shrink-0 border-t border-gray-700 bg-gray-800 px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Godot Developer Console v1.0</span>
            <span>Ctrl+Click to drag • Esc to cancel drag • Backtick (`) to close</span>
          </div>
        </div>
      </div>
    </PanelLayoutProvider>
  );
}
