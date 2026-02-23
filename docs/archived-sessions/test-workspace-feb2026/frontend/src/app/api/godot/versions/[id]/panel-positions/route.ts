import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface PanelPosition {
  x: number;
  y: number;
}

interface PanelPositionsMap {
  [panelId: string]: PanelPosition;
}

// GET: Load all panel positions for a version
export const GET = withSecurity(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const versionIdNum = parseInt(id, 10);

      if (isNaN(versionIdNum)) {
        return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
      }

      const result = await dbAdapter.query(
        `SELECT panel_id, position_x, position_y
       FROM godot_panel_positions
       WHERE version_id = $1`,
        [versionIdNum],
        { schema: 'content' }
      );

      const positions: PanelPositionsMap = {};
      for (const row of result.rows) {
        positions[row.panel_id] = {
          x: row.position_x,
          y: row.position_y,
        };
      }

      return NextResponse.json(positions);
    } catch (error) {
      logger.error('Failed to load panel positions:', error);
      return NextResponse.json({ error: 'Failed to load panel positions' }, { status: 500 });
    }
  }
);

// POST: Save or update single panel position
export const POST = withSecurity(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const versionIdNum = parseInt(id, 10);

      if (isNaN(versionIdNum)) {
        return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
      }

      const body = await req.json();
      const { panelId, position } = body;

      if (
        !panelId ||
        !position ||
        typeof position.x !== 'number' ||
        typeof position.y !== 'number'
      ) {
        return NextResponse.json(
          { error: 'Missing or invalid panelId or position' },
          { status: 400 }
        );
      }

      // UPSERT: Insert or update if exists
      await dbAdapter.query(
        `INSERT INTO godot_panel_positions (version_id, panel_id, position_x, position_y, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (version_id, panel_id) DO UPDATE
       SET position_x = $3, position_y = $4, updated_at = CURRENT_TIMESTAMP`,
        [versionIdNum, panelId, Math.round(position.x), Math.round(position.y)],
        { schema: 'content' }
      );

      return NextResponse.json({
        success: true,
        panelId,
        position: { x: Math.round(position.x), y: Math.round(position.y) },
      });
    } catch (error) {
      logger.error('Failed to save panel position:', error);
      return NextResponse.json({ error: 'Failed to save panel position' }, { status: 500 });
    }
  }
);

// DELETE: Reset/remove single panel position
export const DELETE = withSecurity(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const versionIdNum = parseInt(id, 10);

      if (isNaN(versionIdNum)) {
        return NextResponse.json({ error: 'Invalid version ID' }, { status: 400 });
      }

      const body = await req.json();
      const { panelId } = body;

      if (!panelId) {
        return NextResponse.json({ error: 'Missing panelId' }, { status: 400 });
      }

      await dbAdapter.query(
        `DELETE FROM godot_panel_positions
       WHERE version_id = $1 AND panel_id = $2`,
        [versionIdNum, panelId],
        { schema: 'content' }
      );

      return NextResponse.json({
        success: true,
        message: 'Panel position reset to default',
      });
    } catch (error) {
      logger.error('Failed to reset panel position:', error);
      return NextResponse.json({ error: 'Failed to reset panel position' }, { status: 500 });
    }
  }
);
