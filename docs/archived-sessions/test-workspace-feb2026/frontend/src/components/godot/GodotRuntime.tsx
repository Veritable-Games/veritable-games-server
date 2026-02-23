'use client';

import { useRef, useState, useEffect } from 'react';
import { logger } from '@/lib/utils/logger';

interface GodotRuntimeProps {
  projectSlug: string;
  versionTag: string;
  versionId: number;
  onRuntimeEvent?: (event: RuntimeEvent) => void;
}

export interface RuntimeEvent {
  type: 'function_call' | 'signal_emit' | 'script_load';
  scriptPath: string;
  functionName?: string;
  timestamp: number;
}

/**
 * GodotRuntime - Embeds a Godot HTML5 export and listens for runtime events
 *
 * The Godot game should use postMessage to communicate with the parent window:
 * ```
 * window.parent.postMessage({
 *   source: 'godot-runtime',
 *   event: {
 *     type: 'function_call',
 *     scriptPath: 'res://Player.gd',
 *     functionName: '_process',
 *     timestamp: Date.now()
 *   }
 * }, '*');
 * ```
 */
export function GodotRuntime({
  projectSlug,
  versionTag,
  versionId,
  onRuntimeEvent,
}: GodotRuntimeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildPath = `/godot-builds/${projectSlug}/${versionTag}/index.html`;

  // Listen for postMessage events from Godot runtime
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin (in production, you should check against a specific origin)
      if (event.data?.source === 'godot-runtime' && event.data?.event) {
        const runtimeEvent = event.data.event as RuntimeEvent;

        logger.info('[GodotRuntime] Received runtime event:', runtimeEvent);

        // Forward to parent callback if provided
        onRuntimeEvent?.(runtimeEvent);

        // Also forward to the API endpoint for broadcasting to other clients
        fetch(`/api/godot/versions/${versionId}/runtime-event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(runtimeEvent),
        }).catch(err => {
          logger.error('[GodotRuntime] Error posting runtime event:', err);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [versionId, onRuntimeEvent]);

  return (
    <div className="relative h-full w-full bg-black">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950 text-white">
          <div className="text-center">
            <div className="mb-2">Loading Godot runtime...</div>
            <div className="text-sm text-gray-400">
              {projectSlug} v{versionTag}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950 text-red-400">
          <div className="text-center">
            <div className="mb-2">Failed to load Godot runtime</div>
            <div className="text-sm text-red-600">{error}</div>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={buildPath}
        className="h-full w-full border-0"
        onLoad={() => {
          logger.info('[GodotRuntime] iframe loaded');
          setLoading(false);
        }}
        onError={() => {
          logger.error('[GodotRuntime] iframe error loading:', buildPath);
          setError(`Failed to load build: ${buildPath}`);
          setLoading(false);
        }}
        allow="accelerometer; ambient-light-sensor; autoplay; clipboard-write; encrypted-media; fullscreen; gamepads; geolocation; gyroscope; magnetometer; microphone; midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-forms allow-popups allow-presentation allow-scripts allow-same-origin"
      />
    </div>
  );
}
