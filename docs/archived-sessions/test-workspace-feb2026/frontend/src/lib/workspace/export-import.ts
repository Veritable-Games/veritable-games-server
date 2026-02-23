/**
 * Workspace JSON Export/Import Utilities
 *
 * Handles serialization and deserialization of workspace nodes and connections
 * to/from JSON format for export/import functionality.
 *
 * Schema Version: 1.0
 */

import {
  CanvasNode,
  Connection,
  Point,
  Size,
  NodeContent,
  NodeStyle,
  ConnectionStyle,
} from './types';
import { NodeId, ConnectionId } from './branded-types';
import { calculateBoundingBox, BoundingBox } from './bounding-box-utils';
import { logger } from '@/lib/utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WorkspaceExportData {
  version: string;
  timestamp: string;
  metadata: {
    nodeCount: number;
    connectionCount: number;
    boundingBox: BoundingBox | null;
  };
  nodes: ExportedNode[];
  connections: ExportedConnection[];
}

export interface ExportedNode {
  id: string;
  position: Point;
  size: Size;
  content: NodeContent;
  metadata?: Record<string, unknown>;
  style?: NodeStyle;
  zIndex?: number;
}

export interface ExportedConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAnchor: {
    side: string;
    offset: number;
  };
  targetAnchor: {
    side: string;
    offset: number;
  };
  label?: string;
  style?: ConnectionStyle;
}

export interface ImportResult {
  nodes: Partial<CanvasNode>[];
  connections: Partial<Connection>[];
  idMap: Map<string, string>; // old ID → new ID
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

const CURRENT_VERSION = '1.0';
const SUPPORTED_VERSIONS = ['1.0'];

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export workspace nodes and connections to JSON format
 *
 * @param nodes - Array of nodes to export
 * @param connections - Array of connections to export (will be filtered to only include connections between exported nodes)
 * @returns JSON-serializable object matching WorkspaceExportData schema
 */
export function exportToJSON(nodes: CanvasNode[], connections: Connection[]): WorkspaceExportData {
  logger.info(`Exporting ${nodes.length} nodes and ${connections.length} connections to JSON`);

  // Filter connections to only include those between exported nodes
  const nodeIdSet = new Set(nodes.map(n => n.id as string));
  const relevantConnections = connections.filter(
    conn =>
      nodeIdSet.has(conn.source_node_id as string) && nodeIdSet.has(conn.target_node_id as string)
  );

  // Calculate bounding box for metadata
  const boundingBox = calculateBoundingBox(nodes);

  // Serialize nodes
  const exportedNodes: ExportedNode[] = nodes.map(node => ({
    id: node.id as string,
    position: node.position,
    size: node.size,
    content: node.content,
    metadata: node.metadata || {},
    style: node.style || {},
    zIndex: node.z_index,
  }));

  // Serialize connections
  const exportedConnections: ExportedConnection[] = relevantConnections.map(conn => ({
    id: conn.id as string,
    sourceNodeId: conn.source_node_id as string,
    targetNodeId: conn.target_node_id as string,
    sourceAnchor: {
      side: conn.source_anchor.side,
      offset: conn.source_anchor.offset,
    },
    targetAnchor: {
      side: conn.target_anchor.side,
      offset: conn.target_anchor.offset,
    },
    label: conn.label,
    style: conn.style,
  }));

  const exportData: WorkspaceExportData = {
    version: CURRENT_VERSION,
    timestamp: new Date().toISOString(),
    metadata: {
      nodeCount: exportedNodes.length,
      connectionCount: exportedConnections.length,
      boundingBox,
    },
    nodes: exportedNodes,
    connections: exportedConnections,
  };

  logger.info(
    `Export complete: ${exportedNodes.length} nodes, ${exportedConnections.length} connections`
  );
  return exportData;
}

/**
 * Serialize export data to pretty-printed JSON string
 *
 * @param exportData - The export data object
 * @returns Pretty-printed JSON string
 */
export function serializeToJSON(exportData: WorkspaceExportData): string {
  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate filename for export with timestamp
 *
 * @param workspaceName - Optional workspace name to include in filename
 * @returns Filename string (e.g., "workspace-2026-02-13-143022.json")
 */
export function generateExportFilename(workspaceName?: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').split('.')[0]; // Remove milliseconds

  const baseName = workspaceName ? `workspace-${workspaceName}` : 'workspace';
  return `${baseName}-${timestamp}.json`;
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Validate JSON schema before import
 *
 * @param json - Parsed JSON object
 * @returns Validation result with errors if invalid
 */
export function validateSchema(json: unknown): ValidationResult {
  const errors: string[] = [];

  // Type check
  if (typeof json !== 'object' || json === null) {
    errors.push('Invalid JSON: Expected object');
    return { valid: false, errors };
  }

  const data = json as Record<string, unknown>;

  // Version check
  if (typeof data.version !== 'string') {
    errors.push('Missing or invalid version field');
  } else if (!SUPPORTED_VERSIONS.includes(data.version)) {
    errors.push(
      `Unsupported version: ${data.version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`
    );
  }

  // Timestamp check
  if (typeof data.timestamp !== 'string') {
    errors.push('Missing or invalid timestamp field');
  }

  // Metadata check
  if (typeof data.metadata !== 'object' || data.metadata === null) {
    errors.push('Missing or invalid metadata field');
  } else {
    const metadata = data.metadata as Record<string, unknown>;
    if (typeof metadata.nodeCount !== 'number') {
      errors.push('Invalid metadata.nodeCount');
    }
    if (typeof metadata.connectionCount !== 'number') {
      errors.push('Invalid metadata.connectionCount');
    }
  }

  // Nodes array check
  if (!Array.isArray(data.nodes)) {
    errors.push('Missing or invalid nodes array');
  } else {
    data.nodes.forEach((node, index) => {
      if (typeof node !== 'object' || node === null) {
        errors.push(`Invalid node at index ${index}: Expected object`);
        return;
      }
      const n = node as Record<string, unknown>;
      if (typeof n.id !== 'string') {
        errors.push(`Invalid node at index ${index}: Missing or invalid id`);
      }
      if (typeof n.position !== 'object' || n.position === null) {
        errors.push(`Invalid node at index ${index}: Missing or invalid position`);
      }
      if (typeof n.size !== 'object' || n.size === null) {
        errors.push(`Invalid node at index ${index}: Missing or invalid size`);
      }
      if (typeof n.content !== 'object' || n.content === null) {
        errors.push(`Invalid node at index ${index}: Missing or invalid content`);
      }
    });
  }

  // Connections array check
  if (!Array.isArray(data.connections)) {
    errors.push('Missing or invalid connections array');
  } else {
    data.connections.forEach((conn, index) => {
      if (typeof conn !== 'object' || conn === null) {
        errors.push(`Invalid connection at index ${index}: Expected object`);
        return;
      }
      const c = conn as Record<string, unknown>;
      if (typeof c.id !== 'string') {
        errors.push(`Invalid connection at index ${index}: Missing or invalid id`);
      }
      if (typeof c.sourceNodeId !== 'string') {
        errors.push(`Invalid connection at index ${index}: Missing or invalid sourceNodeId`);
      }
      if (typeof c.targetNodeId !== 'string') {
        errors.push(`Invalid connection at index ${index}: Missing or invalid targetNodeId`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Import workspace data from JSON, generating new UUIDs and remapping connections
 *
 * @param json - JSON string or parsed object
 * @param viewportCenter - Center position for paste offset
 * @returns Import result with new nodes, connections, and ID mapping
 * @throws Error if JSON is invalid or schema validation fails
 */
export function importFromJSON(
  json: string | WorkspaceExportData,
  viewportCenter: Point
): ImportResult {
  logger.info('Importing workspace data from JSON');

  // Parse JSON if string
  let data: WorkspaceExportData;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`);
  }

  // Validate schema
  const validation = validateSchema(data);
  if (!validation.valid) {
    throw new Error(`Schema validation failed:\n${validation.errors.join('\n')}`);
  }

  // Generate new UUIDs for all nodes
  const idMap = new Map<string, string>();
  data.nodes.forEach(node => {
    const newId = crypto.randomUUID();
    idMap.set(node.id, newId);
  });

  // Calculate offset to paste at viewport center
  const boundingBox = data.metadata.boundingBox;
  const offset: Point = boundingBox
    ? {
        x: viewportCenter.x - boundingBox.x - boundingBox.width / 2,
        y: viewportCenter.y - boundingBox.y - boundingBox.height / 2,
      }
    : { x: 0, y: 0 };

  // Create new nodes with remapped IDs and offset positions
  // Note: Fields like created_by, created_at, etc. will be set by the API when creating nodes
  const newNodes: Partial<CanvasNode>[] = data.nodes.map(node => {
    const newId = idMap.get(node.id)!;
    return {
      id: newId as NodeId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      size: node.size,
      content: node.content,
      metadata: node.metadata || {},
      style: node.style || {},
      z_index: node.zIndex || 0,
    };
  });

  // Create new connections with remapped node IDs
  // Note: Fields like created_by, created_at, etc. will be set by the API when creating connections
  const newConnections: Partial<Connection>[] = [];
  const orphanedConnections: string[] = [];

  data.connections.forEach(conn => {
    const newSourceId = idMap.get(conn.sourceNodeId);
    const newTargetId = idMap.get(conn.targetNodeId);

    if (!newSourceId || !newTargetId) {
      orphanedConnections.push(conn.id);
      logger.warn(`Orphaned connection ${conn.id}: source or target node not found in import`);
      return;
    }

    newConnections.push({
      id: crypto.randomUUID() as ConnectionId,
      source_node_id: newSourceId as NodeId,
      target_node_id: newTargetId as NodeId,
      source_anchor: {
        side: conn.sourceAnchor.side as any, // Will be validated by API
        offset: conn.sourceAnchor.offset,
      },
      target_anchor: {
        side: conn.targetAnchor.side as any, // Will be validated by API
        offset: conn.targetAnchor.offset,
      },
      label: conn.label,
      style: conn.style || {},
      z_index: 0,
    });
  });

  if (orphanedConnections.length > 0) {
    logger.warn(`Skipped ${orphanedConnections.length} orphaned connections during import`);
  }

  logger.info(`Import complete: ${newNodes.length} nodes, ${newConnections.length} connections`);

  return {
    nodes: newNodes,
    connections: newConnections,
    idMap,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Download JSON data as a file
 *
 * @param data - The export data object
 * @param filename - Filename for download
 */
export function downloadJSON(data: WorkspaceExportData, filename: string): void {
  const jsonString = serializeToJSON(data);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  logger.info(`Downloaded JSON export: ${filename}`);
}

/**
 * Read JSON file from input element
 *
 * @param file - File object from input element
 * @returns Promise resolving to parsed JSON data
 */
export function readJSONFile(file: File): Promise<WorkspaceExportData> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.json')) {
      reject(new Error('Invalid file type: Expected .json file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = event => {
      try {
        const jsonString = event.target?.result as string;
        const data = JSON.parse(jsonString) as WorkspaceExportData;
        resolve(data);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
