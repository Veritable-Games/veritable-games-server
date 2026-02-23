import { dbPool } from '../utils/db-client.js';
import { contextManager } from '../state/context-manager.js';

export async function listScripts(args: { versionId: number }) {
  const { versionId } = args;

  const connection = await dbPool.getConnection('content');
  try {
    const result = await connection.query(
      `SELECT file_path, script_name, class_name, is_modified,
              dependencies, functions, signals, exports
       FROM godot_scripts
       WHERE version_id = $1
       ORDER BY script_name ASC`,
      [versionId]
    );

    const scripts = result.rows.map((row: any) => ({
      filePath: row.file_path,
      scriptName: row.script_name,
      className: row.class_name,
      functionCount: Array.isArray(row.functions) ? row.functions.length : 0,
      signalCount: Array.isArray(row.signals) ? row.signals.length : 0,
      exportCount: Array.isArray(row.exports) ? row.exports.length : 0,
      isModified: row.is_modified,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              versionId,
              scripts,
              totalCount: scripts.length,
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

export async function getScriptContent(args: { versionId?: number; scriptPath: string }) {
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
    const result = await connection.query(
      `SELECT file_path, script_name, class_name, content, is_modified, last_edited_at,
              dependencies, functions, signals, exports
       FROM godot_scripts
       WHERE version_id = $1 AND file_path = $2`,
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

    const row = result.rows[0];
    const scriptData = {
      filePath: row.file_path,
      scriptName: row.script_name,
      className: row.class_name,
      content: row.content,
      isModified: row.is_modified,
      lastEditedAt: row.last_edited_at,
      metadata: {
        functionCount: Array.isArray(row.functions) ? row.functions.length : 0,
        signalCount: Array.isArray(row.signals) ? row.signals.length : 0,
        exportCount: Array.isArray(row.exports) ? row.exports.length : 0,
        linesOfCode: row.content ? row.content.split('\n').length : 0,
        dependencies: row.dependencies || [],
        functions: row.functions || [],
        signals: row.signals || [],
        exports: row.exports || [],
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(scriptData, null, 2),
        },
      ],
    };
  } finally {
    connection.release();
  }
}

export async function listVersions(args: { projectSlug: string }) {
  const { projectSlug } = args;

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
      versionTag: row.version_tag,
      isActive: row.is_active,
      buildStatus: row.build_status,
      createdAt: row.created_at,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              projectSlug,
              versions,
              totalCount: versions.length,
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

export async function updateScript(args: {
  versionId?: number;
  scriptPath: string;
  content: string;
}) {
  const versionId = args.versionId || contextManager.getDefaultVersion();
  const { scriptPath, content } = args;

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
    // Get API base URL from environment
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3002';

    console.log(`[MCP] Updating script: versionId=${versionId}, scriptPath=${scriptPath}`);

    // Call the API endpoint
    const response = await fetch(`${apiBaseUrl}/api/godot/versions/${versionId}/scripts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath: scriptPath,
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: errorData.error || `HTTP ${response.status}`,
                versionId,
                scriptPath,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              versionId,
              scriptPath,
              isModified: result.script?.is_modified || true,
              lastEditedAt: result.script?.last_edited_at,
              graphRebuilt: result.graphRebuilt,
              linesOfCode: content.split('\n').length,
              message: result.message || 'Script updated successfully',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: errorMsg,
              versionId,
              scriptPath,
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
