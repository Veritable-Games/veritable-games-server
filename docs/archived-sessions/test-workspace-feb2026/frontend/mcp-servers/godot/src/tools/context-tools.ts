import { contextManager } from '../state/context-manager.js';
import { dbPool } from '../utils/db-client.js';

export async function setContextNode(args: { versionId?: number; scriptPath: string }) {
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

  // Validate script exists
  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      'SELECT script_name, class_name FROM godot_scripts WHERE version_id = $1 AND file_path = $2',
      [versionId, scriptPath]
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `Script not found: ${scriptPath}`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const script = result.rows[0];

    // Update context in memory
    contextManager.setSelectedNode(versionId, scriptPath);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              contextNode: {
                versionId,
                scriptPath,
                scriptName: script.script_name,
                className: script.class_name,
              },
              message: 'Context updated',
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

export async function getContext() {
  const context = contextManager.getSelectedNode();
  const state = contextManager.getFullState();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            selectedNode: context,
            buildStatusCache: Object.fromEntries(state.buildStatusCache),
            runtimeEventCount: state.runtimeEventBuffer.length,
            lastUpdated: state.lastUpdated,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
      },
    ],
  };
}
