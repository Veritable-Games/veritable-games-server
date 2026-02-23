#!/usr/bin/env node

/**
 * Godot MCP Router - Phase 3 (Multi-Instance with Unix Sockets)
 *
 * Full production-ready router with:
 * - CWD-based version detection (from Phase 2)
 * - Multi-instance architecture (one process per version)
 * - Unix socket IPC for inter-process communication
 * - Instance health monitoring and auto-restart
 * - 30-minute idle timeout with auto-termination
 * - State persistence across instance restarts
 *
 * Architecture:
 * Claude Code (stdio) → Router → Instance Pool
 *                                 ├─ Instance 1 (noxii/0.16, socket IPC)
 *                                 ├─ Instance 2 (enact/0.09, socket IPC)
 *                                 └─ Instance N (...)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { detectVersionFromCwdCached, formatDetectionResult, resolveVersionId } from './detector.js';
import { getOrSpawnInstance, recordActivity, listInstances, getInstance } from './spawner.js';
import {
  getSocketPath,
  isInstanceHealthy,
  listInstances as listRegistryInstances,
} from './registry.js';
import { UnixSocketClientTransport } from './socket-transport.js';
import { logger } from './utils/logger.js';

// Router metadata
const ROUTER_NAME = 'godot-mcp-router';
const ROUTER_VERSION = '3.0.0';

logger.info('Initializing Phase 3 (Multi-Instance with Unix Sockets)', {
  component: ROUTER_NAME,
  version: ROUTER_VERSION,
});
logger.info('Features: Auto-detection + Multi-instance + Unix socket IPC', {
  component: ROUTER_NAME,
});
logger.info('Architecture: One instance per Godot version', { component: ROUTER_NAME });

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
 * List tools - same as Phase 2, managed by instances
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Meta/Debug tools
    {
      name: 'ping',
      description: 'Test connection to MCP server',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Optional message to echo back',
          },
        },
      },
    },
    {
      name: 'debug_detection',
      description: 'Show detected Godot version from current working directory',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'debug_instances',
      description: 'Show all running instances',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // Meta tools
    {
      name: 'get_projects',
      description: 'List all registered Godot projects',
      inputSchema: { type: 'object', properties: {} },
    },

    // Version tools
    {
      name: 'get_versions',
      description: 'List all versions of a Godot project',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: { type: 'string', description: 'Project slug (e.g., "noxii")' },
        },
        required: ['projectSlug'],
      },
    },

    // Graph tools
    {
      name: 'get_dependency_graph',
      description: 'Get full dependency graph for a Godot version with 3D positions',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
          mode: {
            type: 'string',
            enum: ['dependencies', 'scenes', 'classes', 'files'],
            description: 'Visualization mode',
          },
        },
      },
    },
    {
      name: 'search_nodes',
      description: 'Search for scripts by name or path',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          query: { type: 'string' },
          caseSensitive: { type: 'boolean', default: false },
        },
        required: ['query'],
      },
    },
    {
      name: 'find_isolated_nodes',
      description: 'Find scripts with no connections',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
        },
      },
    },

    // Node tools
    {
      name: 'get_node_details',
      description: 'Get detailed information about a script node',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          scriptPath: { type: 'string' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'get_node_dependencies',
      description: 'Get dependency chain for a node',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          scriptPath: { type: 'string' },
          depth: { type: 'number', default: 3 },
          direction: {
            type: 'string',
            enum: ['outgoing', 'incoming', 'both'],
            default: 'outgoing',
          },
        },
        required: ['scriptPath'],
      },
    },

    // Build tools
    {
      name: 'trigger_build',
      description: 'Start HTML5 build for a Godot version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
        },
      },
    },
    {
      name: 'get_build_status',
      description: 'Check build status for a version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
        },
      },
    },

    // Script tools
    {
      name: 'get_script_content',
      description: 'Read script source code and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          scriptPath: { type: 'string' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'update_script',
      description: 'Update script content and automatically rebuild dependency graph',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          scriptPath: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['scriptPath', 'content'],
      },
    },

    // Analysis tools
    {
      name: 'analyze_dependency_chain',
      description: 'Analyze dependency path between two scripts',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          fromScript: { type: 'string' },
          toScript: { type: 'string' },
        },
        required: ['fromScript', 'toScript'],
      },
    },
    {
      name: 'get_runtime_events',
      description: 'Get recent runtime execution events from game',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          limit: { type: 'number', default: 50 },
        },
      },
    },

    // Context tools
    {
      name: 'set_context_node',
      description: 'Set which script node is currently selected for context',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version' },
          scriptPath: { type: 'string' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'get_context',
      description: 'Get current context state',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

/**
 * Forward request to instance via Unix socket
 */
async function forwardToInstance(versionId: number, request: any): Promise<any> {
  logger.debug(`Forwarding request to instance: ${request.params?.name}`, {
    component: 'router',
    versionId,
  });

  // Get or spawn instance
  const instance = await getOrSpawnInstance(versionId);
  recordActivity(versionId);

  // Connect to instance via Unix socket
  const client = new UnixSocketClientTransport(instance.socketPath);

  try {
    await client.connect();
    logger.debug(`Connected to instance`, { component: 'router', versionId });

    // Send request
    await client.send(request);

    // Wait for response
    const response = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Instance ${versionId} request timeout after 30s`));
      }, 30000);

      const handler = (message: any) => {
        if (message.id === request.id) {
          clearTimeout(timeout);
          client.off('message', handler);
          resolve(message);
        }
      };

      client.on('message', handler);
    });

    return response;
  } finally {
    await client.close();
  }
}

/**
 * Call tool - forward to appropriate instance
 */
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  logger.info(`Tool called: ${name}`, { component: 'router' });

  try {
    // Handle local debug tools
    if (name === 'ping') {
      return {
        content: [{ type: 'text', text: `pong: ${args?.message || 'ok'}` }],
      };
    }

    if (name === 'debug_detection') {
      const detection = await detectVersionFromCwdCached();
      return {
        content: [{ type: 'text', text: formatDetectionResult(detection) }],
      };
    }

    if (name === 'debug_instances') {
      const instances = await listRegistryInstances();
      const output = instances
        .map(
          i =>
            `[${i.versionId}] ${i.projectSlug}/${i.versionTag} - Status: ${i.status}, PID: ${i.pid}, Socket: ${i.socketPath || 'none'}, Uptime: ${i.uptime ? Math.floor(i.uptime / 1000) + 's' : 'N/A'}`
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Godot MCP Instances:\n${output || '(none)'}`,
          },
        ],
      };
    }

    // For instance-bound tools, resolve version and forward
    const explicitVersionId = args?.versionId as number | undefined;
    const resolvedVersionId = await resolveVersionId(explicitVersionId);

    if (!resolvedVersionId) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Could not determine Godot version. Either run from a Godot project directory or specify versionId parameter.',
          },
        ],
        isError: true,
      };
    }

    // Check if instance is healthy, if not try to respawn
    const isHealthy = await isInstanceHealthy(resolvedVersionId);
    if (!isHealthy) {
      logger.warn(`Instance not healthy, may need respawn`, {
        component: 'router',
        versionId: resolvedVersionId,
      });
    }

    // Add resolved versionId to args
    const argsWithVersion = {
      ...args,
      versionId: resolvedVersionId,
    };

    // Forward to instance
    const response = await forwardToInstance(resolvedVersionId, {
      ...request,
      params: {
        name,
        arguments: argsWithVersion,
      },
    });

    return response.result || { isError: true, content: [] };
  } catch (error) {
    logger.error(`Tool error: ${name}`, error instanceof Error ? error : new Error(String(error)), {
      component: 'router',
    });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * List resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'godot://projects',
      name: 'All Godot Projects',
      description: 'List all registered Godot projects',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://project/{slug}/versions',
      name: 'Project Versions',
      description: 'List all versions of a specific project',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://version/{id}/graph',
      name: 'Dependency Graph',
      description: 'Full dependency graph with 3D positions for a version',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://version/{id}/scripts',
      name: 'All Scripts',
      description: 'List all scripts in a version',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://version/{id}/script/{path}',
      name: 'Script Content',
      description: 'Full source code and metadata for a specific script',
      mimeType: 'text/x-gdscript',
    },
    {
      uri: 'godot://version/{id}/build',
      name: 'Build Status',
      description: 'HTML5 build status and metadata',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://version/{id}/runtime-events',
      name: 'Runtime Events',
      description: 'Recent runtime execution events from game',
      mimeType: 'application/json',
    },
    {
      uri: 'godot://context',
      name: 'Current Context',
      description: 'Current visualization context (selected node, version, etc.)',
      mimeType: 'application/json',
    },
  ],
}));

/**
 * Read resource - delegate to instance
 */
server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params;
  logger.debug(`Reading resource: ${uri}`, { component: 'router' });

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ error: 'Resource reading not yet implemented' }),
      },
    ],
  };
});

/**
 * Main entry point
 */
async function main() {
  logger.info('Initializing stdio transport', { component: 'router' });
  const transport = new StdioServerTransport();

  logger.info('Connecting server to transport', { component: 'router' });
  await server.connect(transport);

  logger.info('Router running and ready to accept requests', {
    component: 'router',
    features: [
      'CWD-based version auto-detection',
      'Multi-instance architecture',
      'Unix socket IPC',
      '30-minute idle timeout',
      'debug_instances tool',
    ],
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully', { component: 'router' });
  // Note: instances will be terminated on next heartbeat miss
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully', { component: 'router' });
  process.exit(0);
});

// Start the router
main().catch(error => {
  logger.error('Fatal error', error instanceof Error ? error : new Error(String(error)), {
    component: 'router',
  });
  process.exit(1);
});
