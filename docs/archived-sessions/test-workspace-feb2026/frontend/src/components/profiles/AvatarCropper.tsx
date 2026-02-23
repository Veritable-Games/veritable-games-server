'use client';

import { useState, useRef, useEffect } from 'react';

interface AvatarCropperProps {
  imageUrl: string;
  initialX?: number;
  initialY?: number;
  initialScale?: number;
  onSave: (x: number, y: number, scale: number) => void;
  onCancel: () => void;
}

export function AvatarCropper({
  imageUrl,
  initialX = 50,
  initialY = 50,
  initialScale = 100,
  onSave,
  onCancel,
}: AvatarCropperProps) {
  const [scale, setScale] = useState(initialScale);
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerSize = rect.width; // Square container

    // Calculate new position as percentage
    const newX = ((e.clientX - dragStart.x) / containerSize) * 100;
    const newY = ((e.clientY - dragStart.y) / containerSize) * 100;

    // Allow dragging beyond bounds for proper positioning
    setPosition({
      x: Math.max(-50, Math.min(150, newX)),
      y: Math.max(-50, Math.min(150, newY)),
    });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle wheel for zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    setScale(prev => Math.max(50, Math.min(200, prev + delta)));
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (touch) {
        setIsDragging(true);
        setDragStart({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerSize = rect.width;

    const newX = ((touch.clientX - dragStart.x) / containerSize) * 100;
    const newY = ((touch.clientY - dragStart.y) / containerSize) * 100;

    setPosition({
      x: Math.max(-50, Math.min(150, newX)),
      y: Math.max(-50, Math.min(150, newY)),
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalTouchEnd = () => setIsDragging(false);

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  const handleSave = () => {
    onSave(position.x, position.y, scale);
  };

  const handleReset = () => {
    setPosition({ x: 50, y: 50 });
    setScale(100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-lg bg-gray-900 p-6">
        <h2 className="mb-4 text-xl font-semibold text-white">Position Your Avatar</h2>

        {/* Preview Container */}
        <div className="mb-6 flex justify-center">
          <div
            ref={containerRef}
            className="relative h-64 w-64 cursor-move overflow-hidden rounded-full border-4 border-gray-700 bg-gray-800"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              ref={imageRef}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `scale(${scale / 100})`,
                transformOrigin: 'center',
              }}
            >
              <img
                src={imageUrl}
                alt="Avatar"
                className="absolute"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: 'none',
                  width: '100%',
                  height: 'auto',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
            </div>

            {/* Crosshair Guide */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10"></div>
              <div className="absolute bottom-0 left-1/2 top-0 w-px bg-white/10"></div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-4 text-center text-sm text-gray-400">
          <p>Drag to reposition • Scroll to zoom</p>
          <p className="mt-1 text-xs">Mobile: Use one finger to drag, pinch to zoom</p>
        </div>

        {/* Zoom Slider */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-300">Zoom: {scale}%</label>
          <input
            type="range"
            min="50"
            max="200"
            value={scale}
            onChange={e => setScale(parseInt(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(scale - 50) / 1.5}%, #374151 ${(scale - 50) / 1.5}%, #374151 100%)`,
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>50%</span>
            <span>100%</span>
            <span>200%</span>
          </div>
        </div>

        {/* Position Fine-tuning */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Horizontal: {Math.round(position.x - 50)}%
            </label>
            <input
              type="range"
              min="-50"
              max="150"
              value={position.x}
              onChange={e => setPosition(prev => ({ ...prev, x: parseInt(e.target.value) }))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Vertical: {Math.round(position.y - 50)}%
            </label>
            <input
              type="range"
              min="-50"
              max="150"
              value={position.y}
              onChange={e => setPosition(prev => ({ ...prev, y: parseInt(e.target.value) }))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-400 transition-colors hover:text-white"
          >
            Reset
          </button>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
            >
              Save Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvatarCropper;
