/**
 * Workspace API Validation Schemas
 *
 * Runtime validation using Zod to ensure type safety at HTTP boundaries.
 */

import { z } from 'zod';

/**
 * Anchor point schema - side and offset
 */
export const AnchorPointSchema = z.object({
  side: z.enum(['top', 'right', 'bottom', 'left', 'center']),
  offset: z.number().min(0).max(1),
});

/**
 * Node content schema
 * Note: text is optional to support legacy nodes that may only have markdown
 */
export const NodeContentSchema = z.object({
  title: z.string().optional(),
  text: z.string().optional(), // Made optional - legacy nodes may only have markdown
  markdown: z.string().optional(),
  format: z
    .object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      fontSize: z.number().optional(),
      fontFamily: z.string().optional(),
      color: z.string().optional(),
      alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
    })
    .optional(),
});

/**
 * Node style schema
 */
export const NodeStyleSchema = z.object({
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  opacity: z.number().optional(),
  shadow: z.boolean().optional(),
});

/**
 * Node metadata schema (PHASE 2: Added for persistence)
 */
export const NodeMetadataSchema = z
  .object({
    nodeType: z.enum(['note', 'text']).optional(),
    textScale: z.number().min(0.1).max(5).optional(),
    autoResize: z.boolean().optional(),
    locked: z.boolean().optional(), // Lock state for preventing edits/deletes
  })
  .optional();

/**
 * Create node request schema
 */
export const CreateNodeSchema = z.object({
  workspace_id: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }),
  content: NodeContentSchema,
  style: NodeStyleSchema.optional(),
  metadata: NodeMetadataSchema, // PHASE 2: Added for persistence
  z_index: z.number().optional(),
});

/**
 * Update node request schema
 */
export const UpdateNodeSchema = z.object({
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  size: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  content: NodeContentSchema.optional(),
  style: NodeStyleSchema.optional(),
  metadata: NodeMetadataSchema.optional(), // PHASE 2: Optional for updates (only send what changed)
  z_index: z.number().optional(),
});

/**
 * Connection style schema
 */
export const ConnectionStyleSchema = z.object({
  color: z.string().optional(),
  width: z.number().optional(),
  dashArray: z.array(z.number()).optional(),
  arrowStart: z.boolean().optional(),
  arrowEnd: z.boolean().optional(),
  curve: z.enum(['straight', 'bezier', 'orthogonal']).optional(),
});

/**
 * Create connection request schema
 */
export const CreateConnectionSchema = z.object({
  workspace_id: z.string(),
  source_node_id: z.string(),
  source_anchor: AnchorPointSchema,
  target_node_id: z.string(),
  target_anchor: AnchorPointSchema,
  label: z.string().optional(),
  style: ConnectionStyleSchema.optional(),
  z_index: z.number().optional(),
});

/**
 * Update connection request schema
 */
export const UpdateConnectionSchema = z.object({
  source_anchor: AnchorPointSchema.optional(),
  target_anchor: AnchorPointSchema.optional(),
  label: z.string().optional(),
  style: ConnectionStyleSchema.optional(),
  z_index: z.number().optional(),
});

/**
 * Viewport transform schema
 */
export const ViewportTransformSchema = z.object({
  offsetX: z.number(),
  offsetY: z.number(),
  scale: z.number().min(0.1).max(10), // Reasonable zoom limits
});

/**
 * Update viewport request schema
 */
export const UpdateViewportSchema = z.object({
  workspaceId: z.string(),
  transform: ViewportTransformSchema,
});

/**
 * Helper function to validate and return errors
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(
    (err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`
  );

  return { success: false, errors };
}
