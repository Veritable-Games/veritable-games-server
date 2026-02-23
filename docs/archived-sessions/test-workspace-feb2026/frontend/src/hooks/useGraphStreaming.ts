/**
 * Hook for managing WebSocket connection to server-side graph rendering
 *
 * Handles:
 * - WebSocket connection/disconnection
 * - Frame receiving and display
 * - State synchronization (camera, filters, selections)
 * - Error handling and reconnection
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

interface UseGraphStreamingOptions {
  versionId: number;
  enabled: boolean;
  onFrame?: (frameData: Uint8Array) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

interface StreamingState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  frameCount: number;
  lastFrameTime: number;
}

export function useGraphStreaming({
  versionId,
  enabled,
  onFrame,
  autoReconnect = true,
  maxReconnectAttempts = 5,
}: UseGraphStreamingOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<StreamingState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    frameCount: 0,
    lastFrameTime: Date.now(),
  });

  /**
   * Connect to WebSocket streaming endpoint
   */
  const connect = useCallback(() => {
    if (wsRef.current) {
      logger.info('[Streaming] Already connected or connecting');
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Streaming WebSocket server runs on port 3004
      // In production, the hostname is the same but we need to use the streaming port
      const streamPort = process.env.NEXT_PUBLIC_STREAM_PORT || '3004';
      const host = window.location.hostname;
      const wsUrl = `${protocol}//${host}:${streamPort}/api/godot/versions/${versionId}/stream`;

      logger.info(`[Streaming] Connecting to ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer'; // Receive frames as binary

      ws.onopen = () => {
        logger.info('[Streaming] Connected');
        wsRef.current = ws;
        reconnectAttemptsRef.current = 0;
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));

        // Start ping/pong keep-alive
        startPingPong(ws);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          // JSON message (init, control messages)
          try {
            const message = JSON.parse(event.data);
            handleJsonMessage(message);
          } catch (error) {
            logger.error('[Streaming] JSON parse error:', error);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Binary H.264 frame data
          const frameData = new Uint8Array(event.data);
          setState(prev => ({
            ...prev,
            frameCount: prev.frameCount + 1,
            lastFrameTime: Date.now(),
          }));

          if (onFrame) {
            onFrame(frameData);
          }
        }
      };

      ws.onerror = (event: Event) => {
        logger.error('[Streaming] WebSocket error:', event);
        setState(prev => ({
          ...prev,
          error: 'Connection error',
        }));
      };

      ws.onclose = () => {
        logger.info('[Streaming] Disconnected');
        wsRef.current = null;
        clearPingPong();

        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Attempt reconnection
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          logger.info(`[Streaming] Reconnecting in ${delay}ms...`);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached',
          }));
        }
      };
    } catch (error) {
      logger.error('[Streaming] Connection error:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [versionId, onFrame, autoReconnect, maxReconnectAttempts]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    logger.info('[Streaming] Disconnecting');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearPingPong();
    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, []);

  /**
   * Send camera position update to server
   */
  const updateCamera = useCallback((x: number, y: number, z: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'camera',
          payload: { x, y, z },
        })
      );
    }
  }, []);

  /**
   * Send renderer state update to server (colors, selections, filters)
   */
  const updateState = useCallback((stateUpdate: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'state',
          payload: stateUpdate,
        })
      );
    }
  }, []);

  /**
   * Handle JSON control messages from server
   */
  const handleJsonMessage = (message: any) => {
    switch (message.type) {
      case 'init':
        logger.info('[Streaming] Server initialized for version:', message.versionId);
        break;

      case 'pong':
        // Keep-alive response
        break;

      case 'error':
        logger.error('[Streaming] Server error:', message.message);
        setState(prev => ({
          ...prev,
          error: message.message,
        }));
        break;

      default:
        logger.warn('[Streaming] Unknown message type:', message.type);
    }
  };

  /**
   * Start ping/pong keep-alive
   */
  const startPingPong = (ws: WebSocket) => {
    pingTimeoutRef.current = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  };

  /**
   * Clear ping/pong timeout
   */
  const clearPingPong = () => {
    if (pingTimeoutRef.current) {
      clearInterval(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  };

  /**
   * Effect: connect/disconnect based on enabled flag
   */
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearPingPong();
    };
  }, [enabled, connect, disconnect]);

  return {
    // State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    frameCount: state.frameCount,
    lastFrameTime: state.lastFrameTime,

    // Methods
    updateCamera,
    updateState,
    disconnect,
  };
}
