import { dbPool } from '../utils/db-client.js';
import { contextManager } from '../state/context-manager.js';
import { DependencyGraph } from '../utils/types.js';

export async function getNodeDetails(args: { versionId?: number; scriptPath: string }) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { scriptPath } = args;

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
    // Get script details
    const scriptResult = await connection.query(
      `SELECT file_path, script_name, class_name, extends_class, content,
              dependencies, functions, signals, exports, is_modified, last_edited_at
       FROM godot_scripts
       WHERE version_id = $1 AND file_path = $2`,
      [versionId, scriptPath]
    );

    if (scriptResult.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Script not found: ${scriptPath}` }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const script = scriptResult.rows[0];

    // Get position from graph cache
    const graphResult = await connection.query(
      'SELECT graph_data FROM godot_dependency_graph WHERE version_id = $1',
      [versionId]
    );

    const graph = graphResult.rows[0]?.graph_data as DependencyGraph | undefined;
    const nodeInGraph = graph?.nodes.find(n => n.id === scriptPath);
    const position = nodeInGraph?.position || { x: 0, y: 0, z: 0 };

    // Find reverse dependencies (scripts that depend on this one)
    const dependents =
      graph?.edges
        .filter(e => e.to === scriptPath)
        .map(e => {
          const fromNode = graph.nodes.find(n => n.id === e.from);
          return {
            scriptPath: e.from,
            scriptName: fromNode?.label || e.from,
            type: e.type,
          };
        }) || [];

    const details = {
      script: {
        filePath: script.file_path,
        scriptName: script.script_name,
        className: script.class_name,
        extendsClass: script.extends_class,
        dependencies: script.dependencies || [],
        functions: script.functions || [],
        signals: script.signals || [],
        exports: script.exports || [],
        isModified: script.is_modified,
        lastEditedAt: script.last_edited_at,
      },
      position,
      dependents,
      metadata: {
        functionCount: Array.isArray(script.functions) ? script.functions.length : 0,
        signalCount: Array.isArray(script.signals) ? script.signals.length : 0,
        exportCount: Array.isArray(script.exports) ? script.exports.length : 0,
        linesOfCode: script.content ? script.content.split('\n').length : 0,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(details, null, 2),
        },
      ],
    };
  } finally {
    connection.release();
  }
}

export async function getNodeDependencies(args: {
  versionId?: number;
  scriptPath: string;
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
}) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { scriptPath, depth = 3, direction = 'outgoing' } = args;

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
            text: JSON.stringify({ error: `No graph data for version ${versionId}` }, null, 2),
          },
        ],
        isError: true,
      };
    }

    const graph = graphResult.rows[0].graph_data as DependencyGraph;

    // BFS traversal
    const visited = new Set<string>();
    const queue: Array<{ path: string; distance: number }> = [{ path: scriptPath, distance: 0 }];
    const dependencyChains: string[][] = [];

    while (queue.length > 0) {
      const { path, distance } = queue.shift()!;

      if (visited.has(path) || distance > depth) continue;
      visited.add(path);

      // Find edges based on direction
      let nextEdges = graph.edges;

      if (direction === 'outgoing') {
        nextEdges = graph.edges.filter(e => e.from === path);
      } else if (direction === 'incoming') {
        nextEdges = graph.edges.filter(e => e.to === path);
      }

      for (const edge of nextEdges) {
        const nextPath = direction === 'outgoing' ? edge.to : edge.from;

        if (!visited.has(nextPath)) {
          queue.push({ path: nextPath, distance: distance + 1 });
          // Track chains
          if (distance < depth) {
            dependencyChains.push([scriptPath, ...Array(distance + 1).fill(nextPath)]);
          }
        }
      }
    }

    const dependencies = Array.from(visited).map(nodePath => {
      const node = graph.nodes.find(n => n.id === nodePath);
      return {
        scriptPath: nodePath,
        scriptName: node?.label || nodePath,
        position: node?.position || { x: 0, y: 0, z: 0 },
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              dependencies,
              totalDepth: depth,
              visitedCount: visited.size,
              direction,
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
