#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Router metadata
const ROUTER_NAME = 'godot-mcp-router';
const ROUTER_VERSION = '1.0.0';

console.error(`[${ROUTER_NAME}] Starting Phase 1 Router...`);
console.error(`[${ROUTER_NAME}] Version: ${ROUTER_VERSION}`);

// Track the instance server process
let instanceProcess: ChildProcess | null = null;
let instanceRequests = new Map<string | number, (response: any) => void>();
let instanceReady = false;
let instanceReadyPromise: Promise<void> | null = null;
let nextRequestId = 1;

/**
 * Spawn the instance server as a child process
 * In Phase 1, we just spawn it with stdio transport
 */
async function spawnInstanceServer(): Promise<ChildProcess> {
  console.error('[Router] Spawning instance server...');

  const instancePath = path.join(__dirname, '../../godot/dist/index.js');

  const child = spawn('node', [instancePath], {
    // Inherit environment variables (DATABASE_URL, API_BASE_URL, etc.)
    env: {
      ...process.env,
      // Mark this as an instance for future use
      MCP_INSTANCE_MODE: 'true',
    },
    // Create pipes for stdio so we can intercept them
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Setup instance stdout listener (will receive JSON-RPC responses)
  let instanceStdoutBuffer = '';

  child.stdout?.on('data', data => {
    const chunk = data.toString();
    console.error(`[Router] Received ${chunk.length} bytes from instance stdout`);
    instanceStdoutBuffer += chunk;

    // Parse newline-delimited JSON
    const lines = instanceStdoutBuffer.split('\n');
    instanceStdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        console.error(`[Router] Parsing line: ${line.substring(0, 100)}...`);
        try {
          const message = JSON.parse(line) as any;
          console.error(`[Router] Successfully parsed message with id=${message.id}`);
          handleInstanceResponse(message);
        } catch (e) {
          console.error('[Router] Failed to parse instance response:', e, line);
        }
      }
    }
  });

  // Setup instance stderr listener (for logging and ready detection)
  child.stderr?.on('data', data => {
    const message = data.toString();
    console.error(`[Instance] ${message}`);

    // Detect when instance is ready (look for "Server running via stdio")
    if (message.includes('Server running via stdio') || message.includes('Server is running')) {
      instanceReady = true;
      console.error('[Router] Instance is ready');
    }
  });

  // Handle instance exit
  child.on('exit', (code, signal) => {
    console.error(`[Router] Instance server exited: code=${code}, signal=${signal}`);
    instanceProcess = null;
    instanceReady = false;
  });

  // Wait for instance to be ready (up to 5 seconds)
  return new Promise((resolve, reject) => {
    const maxWaitTime = 5000;
    const startTime = Date.now();

    const waitForReady = () => {
      if (instanceReady) {
        resolve(child);
      } else if (Date.now() - startTime > maxWaitTime) {
        reject(new Error('Instance server failed to initialize within 5 seconds'));
      } else {
        setTimeout(waitForReady, 100);
      }
    };

    waitForReady();
  });
}

/**
 * Handle responses from the instance server
 */
function handleInstanceResponse(message: any) {
  // If this is a response to one of our forwarded requests
  if ('id' in message && message.id !== null && message.id !== undefined) {
    const callback = instanceRequests.get(message.id);
    if (callback) {
      instanceRequests.delete(message.id);
      callback(message);
    } else {
      console.error('[Router] Received response for unknown request ID:', message.id);
    }
  } else {
    // This might be a notification or error
    console.error('[Router] Unexpected instance response:', message);
  }
}

/**
 * Forward a request to the instance server and get the response
 */
async function forwardToInstance(request: any): Promise<any> {
  if (!instanceProcess) {
    instanceProcess = await spawnInstanceServer();
  }

  return new Promise((resolve, reject) => {
    // Use our own request ID mapping to track the response
    const requestId = nextRequestId++;
    const mappedRequest = {
      ...request,
      id: requestId,
    };

    // Set timeout for response
    const timeout = setTimeout(() => {
      instanceRequests.delete(requestId);
      reject(new Error(`Request ${requestId} timed out after 30s`));
    }, 30000);

    // Register callback for response
    instanceRequests.set(requestId, response => {
      clearTimeout(timeout);
      resolve(response as any);
    });

    // Send request to instance
    const line = JSON.stringify(mappedRequest);
    console.error(`[Router] Writing request to instance stdin: ${line.substring(0, 100)}...`);

    instanceProcess!.stdin?.write(line + '\n', err => {
      if (err) {
        console.error('[Router] Error writing to instance stdin:', err);
        clearTimeout(timeout);
        instanceRequests.delete(requestId);
        reject(err);
      } else {
        console.error('[Router] Request written to instance stdin successfully');
      }
    });
  });
}

// Create the main MCP server
const server = new Server(
  {
    name: ROUTER_NAME,
    version: ROUTER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List tools - forward to instance
 */
server.setRequestHandler(ListToolsRequestSchema, async request => {
  console.error('[Router] Forwarding tools/list request to instance');
  const response = await forwardToInstance(request);
  return (response as any).result || { tools: [] };
});

/**
 * Call tool - forward to instance
 */
server.setRequestHandler(CallToolRequestSchema, async request => {
  console.error(`[Router] Forwarding tool call: ${request.params.name}`);
  const response = await forwardToInstance(request);
  return (response as any).result || { isError: true, content: [] };
});

/**
 * List resources - forward to instance
 */
server.setRequestHandler(ListResourcesRequestSchema, async request => {
  console.error('[Router] Forwarding resources/list request to instance');
  const response = await forwardToInstance(request);
  return (response as any).result || { resources: [] };
});

/**
 * Read resource - forward to instance
 */
server.setRequestHandler(ReadResourceRequestSchema, async request => {
  console.error(`[Router] Forwarding resource read: ${request.params.uri}`);
  const response = await forwardToInstance(request);
  return (response as any).result || { contents: [] };
});

/**
 * Main entry point
 */
async function main() {
  console.error('[Router] Initializing stdio transport...');
  const transport = new StdioServerTransport();

  console.error('[Router] Connecting server to transport...');
  await server.connect(transport);

  console.error('[Router] Server is running and ready to accept requests');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[Router] Received SIGINT, shutting down gracefully...');
  if (instanceProcess) {
    instanceProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[Router] Received SIGTERM, shutting down gracefully...');
  if (instanceProcess) {
    instanceProcess.kill('SIGTERM');
  }
  process.exit(0);
});

// Start the router
main().catch(error => {
  console.error('[Router] Fatal error:', error);
  process.exit(1);
});
