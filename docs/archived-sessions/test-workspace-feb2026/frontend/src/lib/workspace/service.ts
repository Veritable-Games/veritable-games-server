/**
 * Workspace Service
 *
 * Handles all database operations for infinite canvas workspaces.
 * Uses Result pattern for type-safe error handling.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { randomUUID } from 'crypto';
import {
  Workspace,
  WorkspaceWithContent,
  CanvasNode,
  Connection,
  ViewportState,
  CreateWorkspaceData,
  UpdateWorkspaceData,
  CreateNodeData,
  UpdateNodeData,
  CreateConnectionData,
  UpdateConnectionData,
  UpdateViewportData,
  SpatialQueryOptions,
  WorkspaceError,
  NodeNotFoundError,
  WorkspaceNotFoundError,
  InvalidConnectionError,
  ConnectionNotFoundError,
} from './types';
import {
  WorkspaceId,
  NodeId,
  ConnectionId,
  ViewportStateId,
  unsafeToWorkspaceId,
  unsafeToNodeId,
  unsafeToConnectionId,
  unsafeToViewportStateId,
} from './branded-types';
import { UserId } from '@/types/branded';
import { logger } from '@/lib/utils/logger';

// Result type from codebase
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export class WorkspaceService {
  // ========================================================================
  // Workspace Operations
  // ========================================================================

  async createWorkspace(
    data: CreateWorkspaceData,
    userId: UserId
  ): Promise<Result<Workspace, WorkspaceError>> {
    try {
      const workspaceId = unsafeToWorkspaceId(data.project_slug);
      const settings = JSON.stringify(data.settings || {});

      await dbAdapter.query(
        `INSERT INTO workspaces (id, project_slug, settings, created_by)
         VALUES ($1, $2, $3, $4)`,
        [workspaceId, data.project_slug, settings, userId],
        { schema: 'content' }
      );

      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace.ok) {
        return Err(new WorkspaceError('Failed to retrieve created workspace'));
      }

      return Ok(workspace.value);
    } catch (error) {
      return Err(new WorkspaceError('Failed to create workspace', 'CREATE_FAILED', error));
    }
  }

  async getWorkspace(workspaceId: WorkspaceId): Promise<Result<Workspace, WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM workspaces WHERE id = $1`,
        [workspaceId],
        { schema: 'content' }
      );

      const row = result.rows[0];
      if (!row) {
        return Err(new WorkspaceNotFoundError(workspaceId));
      }

      return Ok({
        id: unsafeToWorkspaceId(row.id),
        project_slug: row.project_slug,
        settings: JSON.parse(row.settings),
        created_by: row.created_by as UserId,
        created_at: row.created_at,
        updated_by: row.updated_by as UserId | undefined,
        updated_at: row.updated_at,
      });
    } catch (error) {
      return Err(new WorkspaceError('Failed to get workspace', 'GET_FAILED', error));
    }
  }

  async getWorkspaceWithContent(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Result<WorkspaceWithContent, WorkspaceError>> {
    try {
      const workspaceResult = await this.getWorkspace(workspaceId);
      if (!workspaceResult.ok) return Err(workspaceResult.error);

      const nodesResult = await this.getNodes(workspaceId);
      if (!nodesResult.ok) return Err(nodesResult.error);

      const connectionsResult = await this.getConnections(workspaceId);
      if (!connectionsResult.ok) return Err(connectionsResult.error);

      const viewportResult = await this.getViewportState(workspaceId, userId);
      const viewportState = viewportResult.ok ? viewportResult.value : undefined;

      return Ok({
        workspace: workspaceResult.value,
        nodes: nodesResult.value,
        connections: connectionsResult.value,
        viewportState,
      });
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to get workspace content', 'GET_CONTENT_FAILED', error)
      );
    }
  }

  async updateWorkspace(
    workspaceId: WorkspaceId,
    data: UpdateWorkspaceData,
    userId: UserId
  ): Promise<Result<Workspace, WorkspaceError>> {
    try {
      if (!data.settings) {
        return await this.getWorkspace(workspaceId);
      }

      const result = await dbAdapter.query(
        `UPDATE workspaces
         SET settings = $1, updated_by = $2
         WHERE id = $3`,
        [JSON.stringify(data.settings), userId, workspaceId],
        { schema: 'content' }
      );

      if (result.rowCount === 0) {
        return Err(new WorkspaceNotFoundError(workspaceId));
      }

      return await this.getWorkspace(workspaceId);
    } catch (error) {
      return Err(new WorkspaceError('Failed to update workspace', 'UPDATE_FAILED', error));
    }
  }

  // ========================================================================
  // Node Operations
  // ========================================================================

  async createNode(
    data: CreateNodeData,
    userId: UserId
  ): Promise<Result<CanvasNode, WorkspaceError>> {
    try {
      const nodeId = unsafeToNodeId(`node_${randomUUID()}`);
      const content = JSON.stringify(data.content);
      const style = data.style ? JSON.stringify(data.style) : null;
      const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

      await dbAdapter.query(
        `INSERT INTO canvas_nodes (
          id, workspace_id, position_x, position_y, width, height,
          content, style, metadata, z_index, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          nodeId,
          data.workspace_id,
          data.position.x,
          data.position.y,
          data.size.width,
          data.size.height,
          content,
          style,
          metadata,
          data.z_index || 0,
          userId,
        ],
        { schema: 'content' }
      );

      const node = await this.getNode(nodeId);
      if (!node.ok) {
        return Err(new WorkspaceError('Failed to retrieve created node'));
      }

      return Ok(node.value);
    } catch (error) {
      return Err(new WorkspaceError('Failed to create node', 'CREATE_NODE_FAILED', error));
    }
  }

  async getNode(
    nodeId: NodeId,
    includeDeleted: boolean = false
  ): Promise<Result<CanvasNode, WorkspaceError>> {
    try {
      const whereClause = includeDeleted
        ? 'WHERE id = $1'
        : 'WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)';

      const result = await dbAdapter.query(`SELECT * FROM canvas_nodes ${whereClause}`, [nodeId], {
        schema: 'content',
      });

      const row = result.rows[0];
      if (!row) {
        return Err(new NodeNotFoundError(nodeId));
      }

      return Ok(this.mapRowToNode(row));
    } catch (error) {
      return Err(new WorkspaceError('Failed to get node', 'GET_NODE_FAILED', error));
    }
  }

  async getNodes(workspaceId: WorkspaceId): Promise<Result<CanvasNode[], WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM canvas_nodes
         WHERE workspace_id = $1
           AND (is_deleted = false OR is_deleted IS NULL)
         ORDER BY z_index ASC, created_at ASC`,
        [workspaceId],
        { schema: 'content' }
      );

      return Ok(result.rows.map(row => this.mapRowToNode(row)));
    } catch (error) {
      return Err(new WorkspaceError('Failed to get nodes', 'GET_NODES_FAILED', error));
    }
  }

  async getNodesInBounds(
    workspaceId: WorkspaceId,
    options: SpatialQueryOptions
  ): Promise<Result<CanvasNode[], WorkspaceError>> {
    try {
      const { bounds, limit } = options;

      let query = `
        SELECT * FROM canvas_nodes
        WHERE workspace_id = $1
          AND position_x <= $2 AND (position_x + width) >= $3
          AND position_y <= $4 AND (position_y + height) >= $5
        ORDER BY z_index ASC
      `;

      const params = [workspaceId, bounds.maxX, bounds.minX, bounds.maxY, bounds.minY];

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const result = await dbAdapter.query(query, params, { schema: 'content' });

      return Ok(result.rows.map(row => this.mapRowToNode(row)));
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to query nodes in bounds', 'SPATIAL_QUERY_FAILED', error)
      );
    }
  }

  async updateNode(
    nodeId: NodeId,
    data: UpdateNodeData,
    userId: UserId
  ): Promise<Result<CanvasNode, WorkspaceError>> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (data.position) {
        updates.push(`position_x = $${paramCounter++}`, `position_y = $${paramCounter++}`);
        values.push(data.position.x, data.position.y);
      }

      if (data.size) {
        updates.push(`width = $${paramCounter++}`, `height = $${paramCounter++}`);
        values.push(data.size.width, data.size.height);
      }

      if (data.content) {
        updates.push(`content = $${paramCounter++}`);
        values.push(JSON.stringify(data.content));
      }

      if (data.style !== undefined) {
        updates.push(`style = $${paramCounter++}`);
        values.push(data.style ? JSON.stringify(data.style) : null);
      }

      if (data.metadata !== undefined) {
        updates.push(`metadata = $${paramCounter++}`);
        values.push(data.metadata ? JSON.stringify(data.metadata) : null);
      }

      if (data.z_index !== undefined) {
        updates.push(`z_index = $${paramCounter++}`);
        values.push(data.z_index);
      }

      if (updates.length === 0) {
        return await this.getNode(nodeId);
      }

      // Add updated_by field
      updates.push(`updated_by = $${paramCounter}`);
      values.push(userId);
      paramCounter++;

      // Add nodeId for WHERE clause
      const whereParamIndex = paramCounter;
      values.push(nodeId);

      const query = `UPDATE canvas_nodes SET ${updates.join(', ')} WHERE id = $${whereParamIndex}`;

      // Log for debugging 404 issues
      logger.info('[WorkspaceService] updateNode query:', {
        query,
        nodeId,
        paramCount: values.length,
        whereParamIndex,
      });

      const result = await dbAdapter.query(query, values, { schema: 'content' });

      // Check if any rows were updated
      if (result.rowCount === 0) {
        logger.warn('[WorkspaceService] UPDATE matched 0 rows for nodeId:', nodeId);
        return Err(new NodeNotFoundError(nodeId));
      }

      return await this.getNode(nodeId);
    } catch (error) {
      return Err(new WorkspaceError('Failed to update node', 'UPDATE_NODE_FAILED', error));
    }
  }

  async deleteNode(nodeId: NodeId, userId: UserId): Promise<Result<void, WorkspaceError>> {
    try {
      // Soft delete: Set is_deleted flag and deleted_at timestamp
      // This preserves data for potential recovery and audit trail
      const result = await dbAdapter.query(
        `UPDATE canvas_nodes
         SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)`,
        [nodeId, userId],
        { schema: 'content' }
      );

      if (result.rowCount === 0) {
        return Err(new NodeNotFoundError(nodeId));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(new WorkspaceError('Failed to delete node', 'DELETE_NODE_FAILED', error));
    }
  }

  // ========================================================================
  // Connection Operations
  // ========================================================================

  async createConnection(
    data: CreateConnectionData,
    userId: UserId
  ): Promise<Result<Connection, WorkspaceError>> {
    try {
      // Validate nodes exist
      const sourceNode = await this.getNode(data.source_node_id);
      if (!sourceNode.ok) {
        return Err(new InvalidConnectionError(`Source node ${data.source_node_id} not found`));
      }

      const targetNode = await this.getNode(data.target_node_id);
      if (!targetNode.ok) {
        return Err(new InvalidConnectionError(`Target node ${data.target_node_id} not found`));
      }

      // Prevent self-connections
      if (data.source_node_id === data.target_node_id) {
        return Err(new InvalidConnectionError('Cannot connect node to itself'));
      }

      const connectionId = unsafeToConnectionId(`conn_${randomUUID()}`);
      const style = data.style ? JSON.stringify(data.style) : null;

      await dbAdapter.query(
        `INSERT INTO node_connections (
          id, workspace_id, source_node_id, source_anchor_side, source_anchor_offset,
          target_node_id, target_anchor_side, target_anchor_offset,
          label, style, z_index, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          connectionId,
          data.workspace_id,
          data.source_node_id,
          data.source_anchor.side,
          data.source_anchor.offset,
          data.target_node_id,
          data.target_anchor.side,
          data.target_anchor.offset,
          data.label || null,
          style,
          data.z_index || 0,
          userId,
        ],
        { schema: 'content' }
      );

      const connection = await this.getConnection(connectionId);
      if (!connection.ok) {
        return Err(new WorkspaceError('Failed to retrieve created connection'));
      }

      return Ok(connection.value);
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to create connection', 'CREATE_CONNECTION_FAILED', error)
      );
    }
  }

  async getConnection(connectionId: ConnectionId): Promise<Result<Connection, WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM node_connections WHERE id = $1`,
        [connectionId],
        { schema: 'content' }
      );

      const row = result.rows[0];
      if (!row) {
        return Err(new ConnectionNotFoundError(connectionId));
      }

      return Ok(this.mapRowToConnection(row));
    } catch (error) {
      return Err(new WorkspaceError('Failed to get connection', 'GET_CONNECTION_FAILED', error));
    }
  }

  async getConnections(workspaceId: WorkspaceId): Promise<Result<Connection[], WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM node_connections
         WHERE workspace_id = $1
         ORDER BY z_index ASC, created_at ASC`,
        [workspaceId],
        { schema: 'content' }
      );

      return Ok(result.rows.map(row => this.mapRowToConnection(row)));
    } catch (error) {
      return Err(new WorkspaceError('Failed to get connections', 'GET_CONNECTIONS_FAILED', error));
    }
  }

  async getNodeConnections(nodeId: NodeId): Promise<Result<Connection[], WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM node_connections
         WHERE (source_node_id = $1 OR target_node_id = $2)
         ORDER BY z_index ASC, created_at ASC`,
        [nodeId, nodeId],
        { schema: 'content' }
      );

      return Ok(result.rows.map(row => this.mapRowToConnection(row)));
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to get node connections', 'GET_NODE_CONNECTIONS_FAILED', error)
      );
    }
  }

  async updateConnection(
    connectionId: ConnectionId,
    data: UpdateConnectionData,
    userId: UserId
  ): Promise<Result<Connection, WorkspaceError>> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCounter = 1;

      if (data.source_anchor) {
        updates.push(
          `source_anchor_side = $${paramCounter++}`,
          `source_anchor_offset = $${paramCounter++}`
        );
        values.push(data.source_anchor.side, data.source_anchor.offset);
      }

      if (data.target_anchor) {
        updates.push(
          `target_anchor_side = $${paramCounter++}`,
          `target_anchor_offset = $${paramCounter++}`
        );
        values.push(data.target_anchor.side, data.target_anchor.offset);
      }

      if (data.label !== undefined) {
        updates.push(`label = $${paramCounter++}`);
        values.push(data.label);
      }

      if (data.style !== undefined) {
        updates.push(`style = $${paramCounter++}`);
        values.push(JSON.stringify(data.style));
      }

      if (data.z_index !== undefined) {
        updates.push(`z_index = $${paramCounter++}`);
        values.push(data.z_index);
      }

      if (updates.length === 0) {
        return this.getConnection(connectionId);
      }

      updates.push(`updated_by = $${paramCounter++}`);
      values.push(userId);
      values.push(connectionId);

      await dbAdapter.query(
        `UPDATE node_connections
         SET ${updates.join(', ')}
         WHERE id = $${paramCounter}`,
        values,
        { schema: 'content' }
      );

      return this.getConnection(connectionId);
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to update connection', 'UPDATE_CONNECTION_FAILED', error)
      );
    }
  }

  async deleteConnection(connectionId: ConnectionId): Promise<Result<void, WorkspaceError>> {
    try {
      // Hard delete immediately - no soft delete
      const result = await dbAdapter.query(
        `DELETE FROM node_connections WHERE id = $1`,
        [connectionId],
        {
          schema: 'content',
        }
      );

      if (result.rowCount === 0) {
        return Err(new ConnectionNotFoundError(connectionId));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to delete connection', 'DELETE_CONNECTION_FAILED', error)
      );
    }
  }

  // ========================================================================
  // Viewport State Operations
  // ========================================================================

  async updateViewportState(
    workspaceId: WorkspaceId,
    userId: UserId,
    data: UpdateViewportData
  ): Promise<Result<ViewportState, WorkspaceError>> {
    try {
      await dbAdapter.query(
        `INSERT INTO viewport_states (workspace_id, user_id, offset_x, offset_y, scale)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET
           offset_x = EXCLUDED.offset_x,
           offset_y = EXCLUDED.offset_y,
           scale = EXCLUDED.scale`,
        [workspaceId, userId, data.transform.offsetX, data.transform.offsetY, data.transform.scale],
        { schema: 'content' }
      );

      return await this.getViewportState(workspaceId, userId);
    } catch (error) {
      return Err(
        new WorkspaceError('Failed to update viewport state', 'UPDATE_VIEWPORT_FAILED', error)
      );
    }
  }

  async getViewportState(
    workspaceId: WorkspaceId,
    userId: UserId
  ): Promise<Result<ViewportState, WorkspaceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM viewport_states WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, userId],
        { schema: 'content' }
      );

      const row = result.rows[0];
      if (!row) {
        // Return default viewport if none exists
        return Ok({
          id: unsafeToViewportStateId(0),
          workspace_id: workspaceId,
          user_id: userId,
          transform: { offsetX: 0, offsetY: 0, scale: 1.0 },
          updated_at: new Date().toISOString(),
        });
      }

      return Ok({
        id: unsafeToViewportStateId(row.id),
        workspace_id: unsafeToWorkspaceId(row.workspace_id),
        user_id: row.user_id as UserId,
        transform: {
          offsetX: row.offset_x,
          offsetY: row.offset_y,
          scale: row.scale,
        },
        updated_at: row.updated_at,
      });
    } catch (error) {
      return Err(new WorkspaceError('Failed to get viewport state', 'GET_VIEWPORT_FAILED', error));
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private mapRowToNode(row: any): CanvasNode {
    return {
      id: unsafeToNodeId(row.id),
      workspace_id: unsafeToWorkspaceId(row.workspace_id),
      position: { x: Number(row.position_x), y: Number(row.position_y) },
      size: { width: Number(row.width), height: Number(row.height) },
      content: JSON.parse(row.content),
      style: row.style ? JSON.parse(row.style) : undefined,
      z_index: Number(row.z_index),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_by: row.created_by as UserId,
      created_at: row.created_at,
      updated_by: row.updated_by as UserId | undefined,
      updated_at: row.updated_at,
    };
  }

  private mapRowToConnection(row: any): Connection {
    return {
      id: unsafeToConnectionId(row.id),
      workspace_id: unsafeToWorkspaceId(row.workspace_id),
      source_node_id: unsafeToNodeId(row.source_node_id),
      source_anchor: {
        side: row.source_anchor_side,
        offset: row.source_anchor_offset,
      },
      target_node_id: unsafeToNodeId(row.target_node_id),
      target_anchor: {
        side: row.target_anchor_side,
        offset: row.target_anchor_offset,
      },
      label: row.label || undefined,
      style: row.style ? JSON.parse(row.style) : undefined,
      z_index: row.z_index,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_by: row.created_by as UserId,
      created_at: row.created_at,
      updated_by: row.updated_by as UserId | undefined,
      updated_at: row.updated_at,
    };
  }
}

export default WorkspaceService;
