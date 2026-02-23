'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GodotDevOverlay } from '@/components/godot/GodotDevOverlay';
import { WorkspaceErrorBoundary } from '@/components/workspace/WorkspaceErrorBoundary';
import { logger } from '@/lib/utils/logger';

/**
 * Homepage with Stellar Dodecahedron Viewer
 * Admin/Developer users can toggle Godot dev console with backtick (`)
 * When console is open, the stellar viewer is paused
 */
export default function HomePage() {
  const { user } = useAuth();
  const [showGodotOverlay, setShowGodotOverlay] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const isAdminOrDev = user?.role === 'admin' || user?.role === 'developer';

  // Pause/resume stellar viewer when Godot overlay opens/closes
  useEffect(() => {
    if (!iframeRef.current) return;

    const iframeWindow = iframeRef.current.contentWindow;
    if (!iframeWindow) return;

    if (showGodotOverlay) {
      // Pause the stellar viewer when overlay opens
      iframeWindow.postMessage({ action: 'pause' }, '*');
    } else {
      // Resume the stellar viewer when overlay closes
      iframeWindow.postMessage({ action: 'resume' }, '*');
    }
  }, [showGodotOverlay]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isAdminOrDev) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Backtick (`) toggles overlay
      if (e.key === '`') {
        e.preventDefault();
        setShowGodotOverlay(prev => !prev);
      }

      // Escape closes overlay
      if (e.key === 'Escape' && showGodotOverlay) {
        e.preventDefault();
        setShowGodotOverlay(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminOrDev, showGodotOverlay]);

  return (
    <div className="relative h-full w-full">
      <iframe
        ref={iframeRef}
        src="/stellar/index.html"
        className="h-full w-full border-0"
        title="Stellar Dodecahedron Viewer"
      />

      {/* Godot Developer Overlay */}
      {showGodotOverlay && isAdminOrDev && (
        <WorkspaceErrorBoundary
          fallbackType="workspace"
          onError={(error, errorInfo) => {
            logger.error('[GodotDevOverlay] Error:', error, errorInfo);
          }}
        >
          <GodotDevOverlay onClose={() => setShowGodotOverlay(false)} />
        </WorkspaceErrorBoundary>
      )}
    </div>
  );
}
