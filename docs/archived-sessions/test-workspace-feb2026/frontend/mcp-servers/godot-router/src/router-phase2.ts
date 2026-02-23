#!/usr/bin/env node

/**
 * Godot MCP Router - Phase 2 (With CWD Auto-Detection)
 *
 * Extends Phase 1 with automatic version detection from working directory.
 *
 * Features:
 * - All Phase 1 routing functionality
 * - CWD-based version auto-detection
 * - Optional versionId parameters (uses detected version as fallback)
 * - debug_detection tool for troubleshooting
 *
 * Detection Algorithm:
 * 1. Receive request with optional versionId parameter
 * 2. If versionId provided, use it (explicit override)
 * 3. If no versionId, detect from CWD (PWD environment variable)
 * 4. Extract project_slug/version_tag from path structure
 * 5. Verify project.godot exists
 * 6. Query database for versionId
 * 7. Forward request with resolved versionId to tool
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

// Router metadata
const ROUTER_NAME = 'godot-mcp-router';
const ROUTER_VERSION = '2.0.0';

console.error(`[${ROUTER_NAME}] Initializing Phase 2 (With Auto-Detection)...`);
console.error(`[${ROUTER_NAME}] Version: ${ROUTER_VERSION}`);
console.error(`[${ROUTER_NAME}] Features: CWD-based version detection + optional parameters`);
console.error(`[${ROUTER_NAME}] Phase 3 will add multi-instance support with Unix sockets\n`);

// Dynamically import the instance server modules
let instanceTools: any = null;

async function loadInstanceModules() {
  console.error('[Router] Loading instance server modules...');

  try {
    const graphTools = await import('../../godot/dist/tools/graph-tools.js');
    const nodeTools = await import('../../godot/dist/tools/node-tools.js');
    const buildTools = await import('../../godot/dist/tools/build-tools.js');
    const scriptTools = await import('../../godot/dist/tools/script-tools.js');
    const analysisTools = await import('../../godot/dist/tools/analysis-tools.js');
    const contextTools = await import('../../godot/dist/tools/context-tools.js');

    instanceTools = {
      graphTools,
      nodeTools,
      buildTools,
      scriptTools,
      analysisTools,
      contextTools,
    };

    console.error('[Router] Successfully loaded all instance modules');
    return true;
  } catch (error) {
    console.error('[Router] Failed to load instance modules:', error);
    return false;
  }
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
 * List tools - includes detection tool + all instance tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
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
    // === NEW: Detection and Debug Tools ===
    {
      name: 'debug_detection',
      description: 'Show detected Godot version from current working directory',
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

    // Version tools (now with optional versionId)
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

    // Graph tools (versionId now optional - uses detected version)
    {
      name: 'get_dependency_graph',
      description: 'Get full dependency graph for a Godot version with 3D positions',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description:
              'Godot version ID (optional - uses detected version from CWD if not provided)',
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
        },
      },
    },

    // Node tools (versionId optional)
    {
      name: 'get_node_details',
      description: 'Get detailed information about a script node',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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

    // Build tools (versionId optional)
    {
      name: 'trigger_build',
      description: 'Start HTML5 build for a Godot version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
        },
      },
    },
    {
      name: 'get_build_status',
      description: 'Check build status for a version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
        },
      },
    },

    // Script tools (versionId optional)
    {
      name: 'get_script_content',
      description: 'Read script source code and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
          scriptPath: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['scriptPath', 'content'],
      },
    },

    // Analysis tools (versionId optional)
    {
      name: 'analyze_dependency_chain',
      description: 'Analyze dependency path between two scripts',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
          versionId: {
            type: 'number',
            description: 'Godot version ID (optional - uses detected version from CWD)',
          },
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
 * Call tool - forward to appropriate instance tool with version resolution
 */
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  console.error(`[Router] Tool called: ${name}`);

  try {
    // Handle debug tool separately
    if (name === 'debug_detection') {
      const detection = await detectVersionFromCwdCached();
      return {
        content: [{ type: 'text', text: formatDetectionResult(detection) }],
      };
    }

    // For other tools, resolve versionId (explicit or detected)
    const explicitVersionId = args?.versionId as number | undefined;
    const resolvedVersionId = await resolveVersionId(explicitVersionId);

    // Log the resolution for debugging
    if (explicitVersionId !== undefined) {
      console.error(`[Router] Using explicit versionId: ${resolvedVersionId}`);
    } else if (resolvedVersionId !== null) {
      console.error(`[Router] Using detected versionId: ${resolvedVersionId}`);
    } else {
      console.error(`[Router] No versionId available (explicit or detected)`);
    }

    // Add resolved versionId to args if it was detected
    const argsWithVersion = {
      ...args,
      versionId: resolvedVersionId,
    };

    // Dispatch to appropriate tool
    switch (name) {
      case 'ping':
        return {
          content: [{ type: 'text', text: `pong: ${args?.message || 'ok'}` }],
        };

      // Graph tools
      case 'get_dependency_graph':
        return await instanceTools.graphTools.getDependencyGraph(argsWithVersion);
      case 'search_nodes':
        return await instanceTools.graphTools.searchNodes(argsWithVersion);
      case 'find_isolated_nodes':
        return await instanceTools.graphTools.findIsolatedNodes(argsWithVersion);

      // Node tools
      case 'get_node_details':
        return await instanceTools.nodeTools.getNodeDetails(argsWithVersion);
      case 'get_node_dependencies':
        return await instanceTools.nodeTools.getNodeDependencies(argsWithVersion);

      // Build tools
      case 'trigger_build':
        return await instanceTools.buildTools.triggerBuild(argsWithVersion);
      case 'get_build_status':
        return await instanceTools.buildTools.getBuildStatus(argsWithVersion);

      // Script tools
      case 'get_versions':
        return await instanceTools.scriptTools.listVersions(args);
      case 'get_script_content':
        return await instanceTools.scriptTools.getScriptContent(argsWithVersion);
      case 'update_script':
        return await instanceTools.scriptTools.updateScript(argsWithVersion);

      // Analysis tools
      case 'analyze_dependency_chain':
        return await instanceTools.analysisTools.analyzeDependencyChain(argsWithVersion);
      case 'get_runtime_events':
        return await instanceTools.analysisTools.getRuntimeEvents(argsWithVersion);

      // Context tools
      case 'set_context_node':
        return await instanceTools.contextTools.setContextNode(argsWithVersion);
      case 'get_context':
        return await instanceTools.contextTools.getContext();

      // Meta tools
      case 'get_projects':
        const { dbPool } = await import('../../godot/dist/utils/db-client.js');
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(`
            SELECT p.id, p.project_slug, p.title, p.description, COUNT(v.id) as version_count
            FROM godot_projects p
            LEFT JOIN godot_versions v ON p.project_slug = v.project_slug
            GROUP BY p.id, p.project_slug, p.title, p.description
            ORDER BY p.project_slug ASC
          `);
          const projects = result.rows.map((row: any) => ({
            id: row.id,
            project_slug: row.project_slug,
            title: row.title,
            description: row.description,
            version_count: parseInt(row.version_count),
          }));
          return {
            content: [{ type: 'text', text: JSON.stringify({ projects }, null, 2) }],
          };
        } finally {
          connection.release();
        }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    console.error(`[Router] Tool error (${name}):`, error);
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
  console.error(`[Router] Reading resource: ${uri}`);

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
  // Load instance modules
  const loaded = await loadInstanceModules();
  if (!loaded) {
    console.error('[Router] Failed to load instance modules');
    process.exit(1);
  }

  console.error('[Router] Initializing stdio transport...');
  const transport = new StdioServerTransport();

  console.error('[Router] Connecting server to transport...');
  await server.connect(transport);

  console.error('[Router] Phase 2 router is running and ready to accept requests');
  console.error('[Router] Features:');
  console.error('[Router]   - CWD-based version auto-detection');
  console.error('[Router]   - Optional versionId parameters');
  console.error('[Router]   - debug_detection tool for testing\n');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[Router] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[Router] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the router
main().catch(error => {
  console.error('[Router] Fatal error:', error);
  process.exit(1);
});
