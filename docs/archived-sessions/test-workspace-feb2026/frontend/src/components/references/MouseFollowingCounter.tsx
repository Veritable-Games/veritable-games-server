'use client';

import { useState, useEffect } from 'react';

/**
 * Mouse Following Counter Component
 * Displays selection count that follows the cursor
 * Only appears when items are selected
 */

interface MouseFollowingCounterProps {
  imageCount: number;
  albumCount: number;
}

export function MouseFollowingCounter({ imageCount, albumCount }: MouseFollowingCounterProps) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Don't show if nothing selected
  if (imageCount === 0 && albumCount === 0) {
    return null;
  }

  const totalSelected = imageCount + albumCount;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: `${mousePos.x + 12}px`,
        top: `${mousePos.y + 8}px`,
      }}
    >
      <div className="select-none text-lg font-bold text-blue-400">{totalSelected}</div>
    </div>
  );
}
