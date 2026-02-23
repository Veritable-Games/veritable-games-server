/**
 * Unix Domain Socket Transport for MCP
 *
 * Implements a custom MCP transport using Unix domain sockets instead of stdio.
 * This enables proper IPC between the router and spawned instance processes.
 *
 * Usage:
 * - Server side (instance): Creates socket server, listens for connections
 * - Client side (router): Connects to socket, sends/receives JSON-RPC messages
 */

import { createServer, createConnection, Server as NetServer, Socket as NetSocket } from 'net';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

/**
 * Server-side socket transport (used by spawned instances)
 */
export class UnixSocketServerTransport extends EventEmitter {
  private server: NetServer | null = null;
  private socket: NetSocket | null = null;
  private buffer = '';

  constructor(private socketPath: string) {
    super();

    // Cleanup stale socket file before binding
    if (fs.existsSync(socketPath)) {
      try {
        fs.unlinkSync(socketPath);
        console.error(`[SocketTransport] Cleaned up stale socket: ${socketPath}`);
      } catch (e) {
        console.error(`[SocketTransport] Failed to remove stale socket: ${e}`);
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(socket => {
        console.error(`[SocketTransport] Client connected`);
        this.socket = socket;

        socket.on('data', data => {
          this.buffer += data.toString();

          // Parse newline-delimited JSON
          const lines = this.buffer.split('\n');
          this.buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                this.emit('message', message);
              } catch (e) {
                console.error(`[SocketTransport] Failed to parse message: ${e}`);
              }
            }
          }
        });

        socket.on('end', () => {
          console.error(`[SocketTransport] Client disconnected`);
          this.socket = null;
        });

        socket.on('error', err => {
          console.error(`[SocketTransport] Socket error: ${err}`);
          this.emit('error', err);
        });
      });

      this.server.on('error', err => {
        console.error(`[SocketTransport] Server error: ${err}`);
        reject(err);
      });

      // Listen on Unix socket
      this.server.listen(this.socketPath, () => {
        console.error(`[SocketTransport] Server listening on ${this.socketPath}`);
        resolve();
      });
    });
  }

  async send(message: any): Promise<void> {
    if (!this.socket) {
      const error = new Error('No client connected, cannot send');
      console.error(`[SocketTransport] ${error.message}`);
      throw error;
    }

    return new Promise((resolve, reject) => {
      try {
        const line = JSON.stringify(message) + '\n';

        // Write with callback to detect when client can't receive
        this.socket!.write(line, err => {
          if (err) {
            console.error(`[SocketTransport] Write error: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        });
      } catch (e) {
        console.error(`[SocketTransport] Error sending message: ${e}`);
        reject(e);
      }
    });
  }

  async close(): Promise<void> {
    return new Promise(resolve => {
      if (this.socket) {
        this.socket.end(() => {
          console.error(`[SocketTransport] Socket closed`);
          resolve();
        });
      } else {
        resolve();
      }

      if (this.server) {
        this.server.close(() => {
          console.error(`[SocketTransport] Server closed`);
        });
      }

      // Cleanup socket file
      try {
        if (fs.existsSync(this.socketPath)) {
          fs.unlinkSync(this.socketPath);
          console.error(`[SocketTransport] Cleaned up socket file: ${this.socketPath}`);
        }
      } catch (e) {
        console.error(`[SocketTransport] Failed to cleanup socket file: ${e}`);
      }
    });
  }
}

/**
 * Client-side socket transport (used by router to connect to instances)
 * Includes automatic reconnection with exponential backoff
 */
export class UnixSocketClientTransport extends EventEmitter {
  private socket: NetSocket | null = null;
  private buffer = '';
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 200; // Start with 200ms
  private maxReconnectDelay = 5000; // Cap at 5 seconds

  constructor(private socketPath: string) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryConnect = () => {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          const error = new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts`);
          console.error(`[SocketClient] ${error.message}`);
          reject(error);
          return;
        }

        this.reconnectAttempts++;
        console.error(
          `[SocketClient] Attempting connection to ${this.socketPath} (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );

        const socket = createConnection(this.socketPath, () => {
          console.error(
            `[SocketClient] Connected to ${this.socketPath} (attempt ${this.reconnectAttempts})`
          );
          this.socket = socket;
          this.connected = true;
          this.reconnectAttempts = 0; // Reset on successful connection
          this.emit('connected');
          resolve();
        });

        socket.on('data', data => {
          this.buffer += data.toString();

          // Parse newline-delimited JSON
          const lines = this.buffer.split('\n');
          this.buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line);
                this.emit('message', message);
              } catch (e) {
                console.error(`[SocketClient] Failed to parse message: ${e}`);
              }
            }
          }
        });

        socket.on('end', () => {
          console.error(`[SocketClient] Disconnected from ${this.socketPath}`);
          this.connected = false;
          this.socket = null;
          this.emit('disconnected');
          // Attempt automatic reconnection
          this.attemptReconnection();
        });

        socket.on('error', err => {
          console.error(`[SocketClient] Socket error: ${err.message}`);
          this.connected = false;

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnection();
          } else {
            this.emit('error', err);
          }
        });
      };

      tryConnect();
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    // Calculate exponential backoff: 200ms, 400ms, 800ms, ..., capped at 5s
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.error(
      `[SocketClient] Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptReconnection();
    }, delay);
  }

  /**
   * Attempt to reconnect to socket
   */
  private attemptReconnection(): void {
    const tryConnect = async () => {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        const error = new Error(`Connection failed after ${this.maxReconnectAttempts} attempts`);
        console.error(`[SocketClient] ${error.message}`);
        this.emit('error', error);
        return;
      }

      this.reconnectAttempts++;
      console.error(
        `[SocketClient] Attempting reconnection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      const socket = createConnection(this.socketPath, () => {
        console.error(`[SocketClient] Reconnected successfully`);
        this.socket = socket;
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('reconnected');
        this.setupSocketListeners(socket);
      });

      socket.on('error', err => {
        console.error(`[SocketClient] Reconnection error: ${err.message}`);
        this.scheduleReconnection();
      });

      this.setupSocketListeners(socket);
    };

    tryConnect();
  }

  /**
   * Setup common socket event listeners
   */
  private setupSocketListeners(socket: NetSocket): void {
    socket.on('data', data => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.emit('message', message);
          } catch (e) {
            console.error(`[SocketClient] Failed to parse message: ${e}`);
          }
        }
      }
    });

    socket.on('end', () => {
      console.error(`[SocketClient] Disconnected`);
      this.connected = false;
      if (this.socket === socket) {
        this.socket = null;
      }
      this.emit('disconnected');
      this.attemptReconnection();
    });

    socket.on('error', err => {
      console.error(`[SocketClient] Socket error: ${err.message}`);
      this.scheduleReconnection();
    });
  }

  async send(message: any): Promise<void> {
    if (!this.socket || !this.connected) {
      console.error(`[SocketClient] Not connected, cannot send`);
      throw new Error('Socket not connected');
    }

    try {
      const line = JSON.stringify(message) + '\n';
      this.socket.write(line);
    } catch (e) {
      console.error(`[SocketClient] Error sending message: ${e}`);
      throw e;
    }
  }

  isConnected(): boolean {
    return this.connected && this.socket !== null;
  }

  async close(): Promise<void> {
    return new Promise(resolve => {
      if (this.socket) {
        this.socket.end(() => {
          console.error(`[SocketClient] Socket closed`);
          this.connected = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

/**
 * Utility function to wait for socket to be available
 */
export async function waitForSocket(
  socketPath: string,
  maxWaitTime: number = 5000,
  checkInterval: number = 100
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkSocket = () => {
      if (fs.existsSync(socketPath)) {
        console.error(`[SocketTransport] Socket ready: ${socketPath}`);
        resolve();
      } else if (Date.now() - startTime > maxWaitTime) {
        reject(new Error(`Socket not ready after ${maxWaitTime}ms: ${socketPath}`));
      } else {
        setTimeout(checkSocket, checkInterval);
      }
    };

    checkSocket();
  });
}
