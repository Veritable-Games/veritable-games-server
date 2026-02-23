import { dbPool } from '../utils/db-client.js';
import { contextManager } from '../state/context-manager.js';
import { DependencyGraph, GraphNode } from '../utils/types.js';

export async function getDependencyGraph(args: { versionId?: number; mode?: string }) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { mode = 'dependencies' } = args;

  if (!versionId) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error:
              'Version ID not specified and no default version detected. Run from a Godot project directory.',
          }),
        },
      ],
      isError: true,
    };
  }

  const connection = await dbPool.getConnection('content');
  try {
    // Query cached dependency graph from database
    const result = await connection.query(
      `SELECT graph_data FROM godot_dependency_graph
       WHERE version_id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      // No cached graph - return empty response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `No dependency graph found for version ${versionId}`,
                nodes: [],
                edges: [],
                stats: {
                  totalNodes: 0,
                  totalEdges: 0,
                  isolatedNodes: 0,
                  averageDegree: 0,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const graphData = result.rows[0].graph_data as DependencyGraph;

    // Calculate stats
    const stats = {
      totalNodes: graphData.nodes.length,
      totalEdges: graphData.edges.length,
      isolatedNodes: graphData.nodes.filter(
        n => !graphData.edges.some(e => e.from === n.id || e.to === n.id)
      ).length,
      averageDegree:
        graphData.edges.length > 0 ? (graphData.edges.length * 2) / graphData.nodes.length : 0,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ...graphData, stats }, null, 2),
        },
      ],
    };
  } finally {
    connection.release();
  }
}

export async function searchNodes(args: {
  versionId?: number;
  query: string;
  caseSensitive?: boolean;
}) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { query, caseSensitive = false } = args;

  if (!versionId) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error:
              'Version ID not specified and no default version detected. Run from a Godot project directory.',
          }),
        },
      ],
      isError: true,
    };
  }

  const connection = await dbPool.getConnection('content');
  try {
    const operator = caseSensitive ? 'LIKE' : 'ILIKE';
    const pattern = `%${query}%`;

    // Query scripts matching the search pattern
    const result = await connection.query(
      `SELECT file_path, script_name, dependencies, functions, signals
       FROM godot_scripts
       WHERE version_id = $1 AND (file_path ${operator} $2 OR script_name ${operator} $2)
       ORDER BY script_name ASC`,
      [versionId, pattern]
    );

    // Get positions from cached graph
    const graphResult = await connection.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
      [versionId]
    );

    const graph = graphResult.rows[0]?.graph_data as DependencyGraph | undefined;
    const positionMap = new Map(graph?.nodes.map(n => [n.id, n.position]) || []);

    const matches = result.rows.map((row: any) => ({
      id: row.file_path,
      label: row.script_name,
      position: positionMap.get(row.file_path) || { x: 0, y: 0, z: 0 },
      metadata: {
        functionCount: Array.isArray(row.functions) ? row.functions.length : 0,
        signalCount: Array.isArray(row.signals) ? row.signals.length : 0,
      },
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              matches,
              totalCount: matches.length,
              searchQuery: query,
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

export async function findIsolatedNodes(args: { versionId?: number }) {
  const versionId = args.versionId || contextManager.getDefaultVersion();

  if (!versionId) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error:
              'Version ID not specified and no default version detected. Run from a Godot project directory.',
          }),
        },
      ],
      isError: true,
    };
  }

  const connection = await dbPool.getConnection('content');
  try {
    // Get dependency graph
    const result = await connection.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
      [versionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`No graph data found for version ${versionId}`);
    }

    const graph = result.rows[0].graph_data as DependencyGraph;

    // Find isolated nodes (no incoming or outgoing edges)
    const isolatedNodes = graph.nodes.filter(
      node => !graph.edges.some(e => e.from === node.id || e.to === node.id)
    );

    const percentage =
      graph.nodes.length > 0 ? (isolatedNodes.length / graph.nodes.length) * 100 : 0;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              isolatedNodes,
              count: isolatedNodes.length,
              percentage: percentage.toFixed(2) + '%',
              totalNodes: graph.nodes.length,
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
