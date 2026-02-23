import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';

/**
 * Runtime event from Godot execution or system updates
 */
export interface RuntimeEvent {
  type:
    | 'function_call'
    | 'signal_emit'
    | 'script_load'
    | 'graph_update'
    | 'connected'
    | 'heartbeat';
  scriptPath?: string;
  functionName?: string;
  timestamp: number;
}

/**
 * Hook to subscribe to runtime events from a Godot version
 * Establishes SSE connection and provides event stream
 *
 * @param versionId - The Godot version ID to subscribe to
 * @returns Object with events array and connection status
 *
 * @example
 * const { events, connected } = useGodotRuntimeEvents(versionId);
 * useEffect(() => {
 *   if (events.length > 0) {
 *     const latestEvent = events[events.length - 1];
 *     logger.info(`Script executed: ${latestEvent.scriptPath}`);
 *   }
 * }, [events]);
 */
export function useGodotRuntimeEvents(versionId: number) {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      logger.info(`[useGodotRuntimeEvents] Connecting to SSE for version ${versionId}`);

      try {
        eventSource = new EventSource(`/api/godot/versions/${versionId}/events`);

        eventSource.addEventListener('message', e => {
          try {
            const data = JSON.parse(e.data);

            if (data.type === 'connected') {
              logger.info('[useGodotRuntimeEvents] Connected to runtime event stream');
              setConnected(true);
              setError(null);
              clearTimeout(connectionTimeout!);
            } else if (data.type === 'heartbeat') {
              // Heartbeat received, connection is alive
              logger.debug('[useGodotRuntimeEvents] Heartbeat received');
            } else if (data.type === 'runtime_event' && data.event) {
              // New runtime event from script execution
              logger.info('[useGodotRuntimeEvents] Runtime event:', data.event);
              setEvents(prev => {
                // Keep last 50 events to prevent memory buildup
                const updated = [...prev, data.event];
                return updated.length > 50 ? updated.slice(-50) : updated;
              });
            } else if (data.type === 'graph_update') {
              // Graph update event (dependency graph was rebuilt)
              logger.info('[useGodotRuntimeEvents] Graph update event received');
              setEvents(prev => {
                // Keep last 50 events to prevent memory buildup
                const graphEvent: RuntimeEvent = {
                  type: 'graph_update',
                  timestamp: data.timestamp || Date.now(),
                };
                const updated = [...prev, graphEvent];
                return updated.length > 50 ? updated.slice(-50) : updated;
              });
            }
          } catch (err) {
            logger.error('[useGodotRuntimeEvents] Error parsing event data:', err);
          }
        });

        eventSource.addEventListener('error', () => {
          logger.error('[useGodotRuntimeEvents] SSE connection error');
          setConnected(false);
          setError('Connection lost');

          // Try to reconnect after 3 seconds
          if (eventSource) {
            eventSource.close();
          }

          connectionTimeout = setTimeout(() => {
            logger.info('[useGodotRuntimeEvents] Attempting to reconnect...');
            connect();
          }, 3000);
        });
      } catch (err) {
        logger.error('[useGodotRuntimeEvents] Error establishing connection:', err);
        setConnected(false);
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    };

    // Establish initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }

      if (eventSource) {
        logger.info('[useGodotRuntimeEvents] Closing SSE connection');
        eventSource.close();
      }
    };
  }, [versionId]);

  return { events, connected, error };
}
