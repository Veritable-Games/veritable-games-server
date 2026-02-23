import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Phase 4: Import Unix socket transport for multi-instance mode
import { UnixSocketServerTransport } from '../../../mcp-servers/godot-router/dist/socket-transport.js';

import { dbPool } from './utils/db-client.js';
import { contextManager } from './state/context-manager.js';

// Phase 4a: Import persistence for state management
import { saveInstanceState, loadInstanceState } from './state/persistence.js';

// Import tool modules
import * as graphTools from './tools/graph-tools.js';
import * as nodeTools from './tools/node-tools.js';
import * as buildTools from './tools/build-tools.js';
import * as scriptTools from './tools/script-tools.js';
import * as analysisTools from './tools/analysis-tools.js';
import * as contextTools from './tools/context-tools.js';

// Server metadata
const SERVER_NAME = 'godot-mcp-server';
const SERVER_VERSION = '1.0.0';

console.error(`[${SERVER_NAME}] Initializing Phase 2...`);

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ===== TOOLS =====
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
    {
      name: 'get_projects',
      description: 'List all registered Godot projects',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_versions',
      description: 'List all versions of a Godot project',
      inputSchema: {
        type: 'object',
        properties: {
          projectSlug: {
            type: 'string',
            description: 'Project slug (e.g., "noxii")',
          },
        },
        required: ['projectSlug'],
      },
    },
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
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          query: { type: 'string', description: 'Search query (e.g., "Player", "*.gd")' },
          caseSensitive: { type: 'boolean', default: false },
        },
        required: ['query'],
      },
    },
    {
      name: 'find_isolated_nodes',
      description: 'Find scripts with no connections (isolated in graph)',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
        },
      },
    },
    {
      name: 'get_node_details',
      description: 'Get detailed information about a specific script node',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          scriptPath: { type: 'string', description: 'Script path (e.g., "res://Player.gd")' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'get_node_dependencies',
      description: 'Get dependency chain for a node (BFS traversal)',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          scriptPath: { type: 'string' },
          depth: { type: 'number', default: 3, description: 'Traversal depth (hops)' },
          direction: {
            type: 'string',
            enum: ['outgoing', 'incoming', 'both'],
            default: 'outgoing',
          },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'trigger_build',
      description: 'Start HTML5 build for a Godot version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
        },
      },
    },
    {
      name: 'get_build_status',
      description: 'Check build status for a version',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
        },
      },
    },
    {
      name: 'get_script_content',
      description: 'Read script source code and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          scriptPath: { type: 'string' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'analyze_dependency_chain',
      description: 'Analyze dependency path between two scripts',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
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
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          limit: { type: 'number', default: 50, description: 'Max events to return' },
        },
      },
    },
    {
      name: 'set_context_node',
      description: 'Set which script node is currently selected for context',
      inputSchema: {
        type: 'object',
        properties: {
          versionId: { type: 'number', description: 'Optional - uses detected version from CWD' },
          scriptPath: { type: 'string' },
        },
        required: ['scriptPath'],
      },
    },
    {
      name: 'get_context',
      description: 'Get current context state (selected node, build status)',
      inputSchema: {
        type: 'object',
        properties: {},
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
            description: 'Optional - uses detected version from CWD',
          },
          scriptPath: {
            type: 'string',
            description: 'Script path (e.g., "res://Player.gd")',
          },
          content: {
            type: 'string',
            description: 'New script content (full GDScript source)',
          },
        },
        required: ['scriptPath', 'content'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  console.error(`[${SERVER_NAME}] Tool called: ${name}`, args);

  try {
    switch (name) {
      case 'ping': {
        const message = (args as any)?.message || 'pong';
        return {
          content: [{ type: 'text', text: `pong: ${message}` }],
        };
      }

      case 'get_projects': {
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            `SELECT p.id, p.project_slug, p.title, p.description, COUNT(v.id) as version_count
             FROM godot_projects p
             LEFT JOIN godot_versions v ON p.project_slug = v.project_slug
             GROUP BY p.id, p.project_slug, p.title, p.description
             ORDER BY p.project_slug ASC`
          );
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
      }

      case 'get_versions':
        return await scriptTools.listVersions(args as any);

      case 'get_dependency_graph':
        return await graphTools.getDependencyGraph(args as any);

      case 'search_nodes':
        return await graphTools.searchNodes(args as any);

      case 'find_isolated_nodes':
        return await graphTools.findIsolatedNodes(args as any);

      case 'get_node_details':
        return await nodeTools.getNodeDetails(args as any);

      case 'get_node_dependencies':
        return await nodeTools.getNodeDependencies(args as any);

      case 'trigger_build':
        return await buildTools.triggerBuild(args as any);

      case 'get_build_status':
        return await buildTools.getBuildStatus(args as any);

      case 'get_script_content':
        return await scriptTools.getScriptContent(args as any);

      case 'analyze_dependency_chain':
        return await analysisTools.analyzeDependencyChain(args as any);

      case 'get_runtime_events':
        return await analysisTools.getRuntimeEvents(args as any);

      case 'set_context_node':
        return await contextTools.setContextNode(args as any);

      case 'get_context':
        return await contextTools.getContext();

      case 'update_script':
        return await scriptTools.updateScript(args as any);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[${SERVER_NAME}] Tool error (${name}):`, error);
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

// ===== RESOURCES =====
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

server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params;

  console.error(`[${SERVER_NAME}] Resource read: ${uri}`);

  try {
    if (uri === 'godot://projects') {
      const connection = await dbPool.getConnection('content');
      try {
        const result = await connection.query(
          `SELECT p.id, p.project_slug, p.title, p.description, COUNT(v.id) as version_count
           FROM godot_projects p
           LEFT JOIN godot_versions v ON p.project_slug = v.project_slug
           GROUP BY p.id, p.project_slug, p.title, p.description
           ORDER BY p.project_slug ASC`
        );
        const projects = result.rows.map((row: any) => ({
          id: row.id,
          project_slug: row.project_slug,
          title: row.title,
          description: row.description,
          version_count: parseInt(row.version_count),
        }));
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ projects }, null, 2),
            },
          ],
        };
      } finally {
        connection.release();
      }
    }

    if (uri.startsWith('godot://project/')) {
      const match = uri.match(/^godot:\/\/project\/([^/]+)\/versions$/);
      if (match) {
        const projectSlug = match[1];
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            `SELECT id, version_tag, is_active, build_status, created_at
             FROM godot_versions
             WHERE project_slug = $1
             ORDER BY created_at DESC`,
            [projectSlug]
          );
          const versions = result.rows.map((row: any) => ({
            id: row.id,
            version_tag: row.version_tag,
            is_active: row.is_active,
            build_status: row.build_status,
            created_at: row.created_at,
          }));
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ projectSlug, versions }, null, 2),
              },
            ],
          };
        } finally {
          connection.release();
        }
      }
    }

    if (uri.startsWith('godot://version/')) {
      // godot://version/{id}/graph
      const graphMatch = uri.match(/^godot:\/\/version\/(\d+)\/graph$/);
      if (graphMatch) {
        const versionId = parseInt(graphMatch[1]!);
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
            [versionId]
          );
          if (result.rows.length === 0) {
            throw new Error(`No graph data for version ${versionId}`);
          }
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(result.rows[0].graph_data, null, 2),
              },
            ],
          };
        } finally {
          connection.release();
        }
      }

      // godot://version/{id}/scripts
      const scriptsMatch = uri.match(/^godot:\/\/version\/(\d+)\/scripts$/);
      if (scriptsMatch) {
        const versionId = parseInt(scriptsMatch[1]!);
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            `SELECT file_path, script_name, class_name, is_modified
             FROM godot_scripts
             WHERE version_id = $1
             ORDER BY script_name ASC`,
            [versionId]
          );
          const scripts = result.rows.map((row: any) => ({
            filePath: row.file_path,
            scriptName: row.script_name,
            className: row.class_name,
            isModified: row.is_modified,
          }));
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ versionId, scripts }, null, 2),
              },
            ],
          };
        } finally {
          connection.release();
        }
      }

      // godot://version/{id}/script/{path}
      const scriptMatch = uri.match(/^godot:\/\/version\/(\d+)\/script\/(.+)$/);
      if (scriptMatch) {
        const versionId = parseInt(scriptMatch[1]!);
        const scriptPath = decodeURIComponent(scriptMatch[2]!);
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            'SELECT content, class_name FROM godot_scripts WHERE version_id = $1 AND file_path = $2',
            [versionId, scriptPath]
          );
          if (result.rows.length === 0) {
            throw new Error(`Script not found: ${scriptPath}`);
          }
          return {
            contents: [
              {
                uri,
                mimeType: 'text/x-gdscript',
                text: result.rows[0].content || '',
              },
            ],
          };
        } finally {
          connection.release();
        }
      }

      // godot://version/{id}/build
      const buildMatch = uri.match(/^godot:\/\/version\/(\d+)\/build$/);
      if (buildMatch) {
        const versionId = parseInt(buildMatch[1]!);
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            'SELECT build_status, build_path FROM godot_versions WHERE id = $1',
            [versionId]
          );
          if (result.rows.length === 0) {
            throw new Error(`Version not found: ${versionId}`);
          }
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    versionId,
                    status: result.rows[0].build_status,
                    buildPath: result.rows[0].build_path,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } finally {
          connection.release();
        }
      }

      // godot://version/{id}/runtime-events
      const eventsMatch = uri.match(/^godot:\/\/version\/(\d+)\/runtime-events$/);
      if (eventsMatch) {
        const versionId = parseInt(eventsMatch[1]!);
        const connection = await dbPool.getConnection('content');
        try {
          const result = await connection.query(
            `SELECT event_type, script_path, function_name, timestamp
             FROM godot_runtime_events
             WHERE version_id = $1
             ORDER BY timestamp DESC
             LIMIT 50`,
            [versionId]
          );
          const events = result.rows.map((row: any) => ({
            type: row.event_type,
            scriptPath: row.script_path,
            functionName: row.function_name,
            timestamp: row.timestamp,
          }));
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ versionId, events }, null, 2),
              },
            ],
          };
        } finally {
          connection.release();
        }
      }
    }

    if (uri === 'godot://context') {
      const context = contextManager.getSelectedNode();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                selectedNode: context,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  } catch (error) {
    console.error(`[${SERVER_NAME}] Resource error (${uri}):`, error);
    throw error;
  }
});

// ===== IDLE TIMEOUT SETUP (Phase 4) =====
let lastActivityTime = Date.now();

/**
 * Record activity (called by tools and request handlers)
 * Updates the last activity timestamp for idle timeout tracking
 */
export function recordActivity() {
  lastActivityTime = Date.now();
}

/**
 * Setup idle timeout for instance mode
 * Auto-shutdown if no activity for IDLE_TIMEOUT_MS
 */
function setupIdleTimeout(timeoutMs: number = 30 * 60 * 1000) {
  console.error(`[${SERVER_NAME}] Setting up idle timeout: ${timeoutMs / 1000 / 60} minutes`);

  const checkInterval = setInterval(() => {
    const idleTime = Date.now() - lastActivityTime;

    if (idleTime > timeoutMs) {
      console.error(
        `[${SERVER_NAME}] Idle timeout reached (${idleTime / 1000}s > ${timeoutMs / 1000}s), shutting down...`
      );
      clearInterval(checkInterval);
      process.exit(0);
    }
  }, 60 * 1000); // Check every minute

  // Don't keep process alive just for this interval
  checkInterval.unref();
}

// ===== SERVER STARTUP =====
async function main() {
  const isInstanceMode = process.env.MCP_INSTANCE_MODE === 'true';
  const versionId = process.env.VERSION_ID ? parseInt(process.env.VERSION_ID) : undefined;
  const socketPath = process.env.SOCKET_PATH;

  if (isInstanceMode && socketPath && versionId) {
    // Phase 4: Multi-instance mode with Unix socket transport
    console.error(`[${SERVER_NAME}] Initializing Phase 4 (Multi-Instance Mode)...`);
    console.error(`[${SERVER_NAME}] Version ID: ${versionId}`);
    console.error(`[${SERVER_NAME}] Socket Path: ${socketPath}`);

    // Set default version in context manager
    contextManager.setDefaultVersion(versionId);

    // Phase 4a: Load persisted state if available
    console.error(`[${SERVER_NAME}] Loading persisted state for version ${versionId}...`);
    const persistedState = await loadInstanceState(versionId);
    if (persistedState) {
      // Restore selected node
      if (persistedState.selectedNodePath) {
        contextManager.setSelectedNode(versionId, persistedState.selectedNodePath);
      }

      // Restore build cache
      if (persistedState.buildCache) {
        for (const [vid, status] of Object.entries(persistedState.buildCache)) {
          contextManager.updateBuildStatus(parseInt(vid), status as any);
        }
      }

      // Restore runtime events
      if (persistedState.runtimeEvents) {
        for (const event of persistedState.runtimeEvents) {
          contextManager.addRuntimeEvent(event);
        }
      }

      console.error(
        `[${SERVER_NAME}] State restored: node=${persistedState.selectedNodePath}, events=${persistedState.runtimeEvents?.length || 0}`
      );
    } else {
      console.error(`[${SERVER_NAME}] No persisted state found (first run or clean start)`);
    }

    // Create and start socket transport
    const transport = new UnixSocketServerTransport(socketPath);

    console.error(`[${SERVER_NAME}] Starting Unix socket transport...`);
    await transport.start();

    console.error(`[${SERVER_NAME}] Connecting server to socket transport...`);
    await server.connect(transport);

    // Setup idle timeout for auto-shutdown
    setupIdleTimeout(30 * 60 * 1000); // 30 minutes

    console.error(`[${SERVER_NAME}] Server running via Unix socket (Phase 4 - Multi-Instance)`);
    console.error(`[${SERVER_NAME}] Available: 15 tools + 8 resources`);
    console.error(`[${SERVER_NAME}] Auto-shutdown after 30 minutes idle`);
  } else {
    // Legacy mode: Stdio transport (for testing, development)
    console.error(`[${SERVER_NAME}] Initializing Phase 2 (Stdio Mode)...`);
    console.error(`[${SERVER_NAME}] Starting stdio transport...`);

    const transport = new StdioServerTransport();

    console.error(`[${SERVER_NAME}] Connecting server to transport...`);
    await server.connect(transport);

    console.error(`[${SERVER_NAME}] Server running via stdio (Phase 2 - Full Implementation)`);
    console.error(`[${SERVER_NAME}] Available: 15 tools + 8 resources`);
  }
}

main().catch(error => {
  console.error(`[${SERVER_NAME}] Startup error:`, error);
  process.exit(1);
});

// Graceful shutdown with state persistence
async function gracefulShutdown(signal: string) {
  console.error(`[${SERVER_NAME}] Received ${signal}, shutting down gracefully...`);

  const versionId = process.env.VERSION_ID ? parseInt(process.env.VERSION_ID) : undefined;
  const isInstanceMode = process.env.MCP_INSTANCE_MODE === 'true';

  // Phase 4a: Save state before shutdown if in instance mode
  if (isInstanceMode && versionId) {
    try {
      const state = contextManager.getFullState();
      await saveInstanceState(versionId, {
        selectedNodePath: state.currentVersionId === versionId ? state.selectedNodePath : undefined,
        buildCache: new Map(
          Array.from(state.buildStatusCache.entries()).filter(
            ([vid]) => vid === versionId || true // Save all versions' build status
          )
        ),
        runtimeEvents: state.runtimeEventBuffer,
      });
      console.error(`[${SERVER_NAME}] State saved before shutdown`);
    } catch (error) {
      console.error(`[${SERVER_NAME}] Error saving state on shutdown: ${error}`);
    }
  }

  await dbPool.close();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
