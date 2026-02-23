import { dbPool } from '../utils/db-client.js';
import { contextManager } from '../state/context-manager.js';
import { DependencyGraph } from '../utils/types.js';

export async function analyzeDependencyChain(args: {
  versionId?: number;
  fromScript: string;
  toScript: string;
}) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { fromScript, toScript } = args;

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
    const graphResult = await connection.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
      [versionId]
    );

    if (graphResult.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `No graph data for version ${versionId}`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const graph = graphResult.rows[0].graph_data as DependencyGraph;

    // Build adjacency map for efficient pathfinding
    const adjacencyMap = new Map<string, string[]>();
    graph.edges.forEach(edge => {
      if (!adjacencyMap.has(edge.from)) {
        adjacencyMap.set(edge.from, []);
      }
      adjacencyMap.get(edge.from)!.push(edge.to);
    });

    // Dijkstra's algorithm to find shortest path
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    graph.nodes.forEach(node => {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
      unvisited.add(node.id);
    });

    distances.set(fromScript, 0);

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDistance = Infinity;

      for (const node of unvisited) {
        const dist = distances.get(node) || Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          current = node;
        }
      }

      if (!current || minDistance === Infinity) break;
      unvisited.delete(current);

      const neighbors = adjacencyMap.get(current) || [];
      for (const neighbor of neighbors) {
        if (unvisited.has(neighbor)) {
          const newDistance = (distances.get(current) || 0) + 1;
          if (newDistance < (distances.get(neighbor) || Infinity)) {
            distances.set(neighbor, newDistance);
            previous.set(neighbor, current);
          }
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = toScript;

    while (current) {
      path.unshift(current);
      current = previous.get(current) || null;
    }

    const pathFound = path.length > 0 && path[0] === fromScript;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              fromScript,
              toScript,
              pathFound,
              shortestPath: pathFound ? path : null,
              pathLength: pathFound ? path.length - 1 : 0,
              message: pathFound ? `Found path of length ${path.length - 1}` : 'No path found',
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

export async function getRuntimeEvents(args: { versionId?: number; limit?: number }) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { limit = 50 } = args;

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
    const result = await connection.query(
      `SELECT event_type, script_path, function_name, timestamp
       FROM godot_runtime_events
       WHERE version_id = $1
       ORDER BY timestamp DESC
       LIMIT $2`,
      [versionId, Math.min(limit, 500)] // Cap at 500 to prevent memory issues
    );

    const events = result.rows.map((row: any) => ({
      type: row.event_type,
      scriptPath: row.script_path,
      functionName: row.function_name,
      timestamp: row.timestamp,
    }));

    // Aggregate to find most active scripts
    const scriptActivity = new Map<string, number>();
    events.forEach(event => {
      const key = event.scriptPath;
      scriptActivity.set(key, (scriptActivity.get(key) || 0) + 1);
    });

    const activeScripts = Array.from(scriptActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([scriptPath, count]) => ({
        scriptPath,
        eventCount: count,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              versionId,
              events,
              totalEvents: events.length,
              activeScripts,
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
