import { dbPool } from '../utils/db-client.js';
import { contextManager } from '../state/context-manager.js';
import { apiClient } from '../utils/api-client.js';

export async function triggerBuild(args: { versionId?: number }) {
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

  try {
    // Call API to trigger build
    const result = await apiClient.post(`/api/godot/versions/${versionId}/build`, {});

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              buildId: result.buildId,
              status: 'building',
              message: 'Build triggered successfully',
              versionId,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Failed to trigger build',
              versionId,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

export async function getBuildStatus(args: { versionId?: number }) {
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
    const result = await connection.query(
      `SELECT id, build_status, build_path, created_at
       FROM godot_versions
       WHERE id = $1`,
      [versionId]
    );

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `Version ${versionId} not found`,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const row = result.rows[0];
    const buildStatus = {
      versionId,
      status: row.build_status,
      buildPath: row.build_path,
      createdAt: row.created_at,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(buildStatus, null, 2),
        },
      ],
    };
  } finally {
    connection.release();
  }
}
