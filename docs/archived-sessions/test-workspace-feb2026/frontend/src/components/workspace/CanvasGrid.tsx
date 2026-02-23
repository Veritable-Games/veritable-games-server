'use client';

/**
 * Canvas Grid Component
 *
 * Renders an infinite grid background that scales with viewport.
 * Uses SVG patterns for crisp rendering at any zoom level.
 */

import { useMemo } from 'react';

interface CanvasGridProps {
  primaryGridSize?: number;
  secondaryGridSize?: number;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
}

export default function CanvasGrid({
  primaryGridSize = 100,
  secondaryGridSize = 20,
  primaryColor = 'rgba(255, 255, 255, 0.1)',
  secondaryColor = 'rgba(255, 255, 255, 0.03)',
  backgroundColor = '#0a0a0a',
}: CanvasGridProps) {
  /**
   * Grid is now static - parent div is transformed via CSS
   */
  const gridStyle = useMemo(() => {
    return {
      primarySize: primaryGridSize,
      secondarySize: secondaryGridSize,
      offsetX: 0,
      offsetY: 0,
    };
  }, [primaryGridSize, secondaryGridSize]);

  /**
   * Static pattern IDs (deterministic for SSR hydration)
   */
  const patternId = 'workspace-grid-pattern-primary';
  const secondaryPatternId = 'workspace-grid-pattern-secondary';

  // Large grid size for infinite appearance
  const gridExtent = 50000; // 50000px in each direction from origin

  return (
    <svg
      className="pointer-events-none absolute"
      style={{
        left: -gridExtent,
        top: -gridExtent,
        width: gridExtent * 2,
        height: gridExtent * 2,
        backgroundColor,
      }}
    >
      <defs>
        {/* Secondary grid (small) */}
        <pattern
          id={secondaryPatternId}
          width={gridStyle.secondarySize}
          height={gridStyle.secondarySize}
          patternUnits="userSpaceOnUse"
          x={gridStyle.offsetX}
          y={gridStyle.offsetY}
        >
          <path
            d={`M ${gridStyle.secondarySize} 0 L 0 0 0 ${gridStyle.secondarySize}`}
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1"
          />
        </pattern>

        {/* Primary grid (large) */}
        <pattern
          id={patternId}
          width={gridStyle.primarySize}
          height={gridStyle.primarySize}
          patternUnits="userSpaceOnUse"
          x={gridStyle.offsetX}
          y={gridStyle.offsetY}
        >
          <rect
            width={gridStyle.primarySize}
            height={gridStyle.primarySize}
            fill={`url(#${secondaryPatternId})`}
          />
          <path
            d={`M ${gridStyle.primarySize} 0 L 0 0 0 ${gridStyle.primarySize}`}
            fill="none"
            stroke={primaryColor}
            strokeWidth="1"
          />
        </pattern>
      </defs>

      {/* Render grid - large rect centered at origin */}
      <rect
        x={0}
        y={0}
        width={gridExtent * 2}
        height={gridExtent * 2}
        fill={`url(#${patternId})`}
      />

      {/* Origin indicator at canvas 0,0 (which is gridExtent,gridExtent in SVG space) */}
      <g>
        {/* X-axis */}
        <line
          x1={gridExtent}
          y1="0"
          x2={gridExtent}
          y2={gridExtent * 2}
          stroke="rgba(59, 130, 246, 0.3)"
          strokeWidth="2"
        />
        {/* Y-axis */}
        <line
          x1="0"
          y1={gridExtent}
          x2={gridExtent * 2}
          y2={gridExtent}
          stroke="rgba(59, 130, 246, 0.3)"
          strokeWidth="2"
        />
        {/* Origin point */}
        <circle cx={gridExtent} cy={gridExtent} r="4" fill="rgba(59, 130, 246, 0.5)" />
      </g>
    </svg>
  );
}
