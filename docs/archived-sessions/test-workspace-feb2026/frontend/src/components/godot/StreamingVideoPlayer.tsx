'use client';

import React, { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/utils/logger';

interface StreamingVideoPlayerProps {
  isActive: boolean;
  onFrame?: (frameData: Uint8Array) => void;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Streaming video player component
 *
 * Displays H.264 encoded frames from server-side renderer
 * Currently supports:
 * - Raw H.264 byte stream (requires client-side decoding)
 * - MJPEG frames (motion JPEG - easier to decode)
 *
 * TODO: For production H.264 support, integrate:
 * - h264-asm.js: Pure JavaScript H.264 decoder
 * - libde265.js: WebAssembly HEVC/H.265 decoder
 * - ffmpeg.wasm: Full FFmpeg in browser (heavy but reliable)
 * - Chrome WebCodecs API: Native H.264 decoding (if available)
 */
export function StreamingVideoPlayer({
  isActive,
  onFrame,
  width = 1920,
  height = 1080,
  className = '',
}: StreamingVideoPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [frameRate, setFrameRate] = useState(0);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());

  /**
   * Decode MJPEG frame (motion JPEG)
   * Each frame is a complete JPEG image
   */
  const decodeMJPEGFrame = async (frameData: Uint8Array) => {
    try {
      const slicedBuffer = frameData.buffer.slice(
        frameData.byteOffset,
        frameData.byteOffset + frameData.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([slicedBuffer], { type: 'image/jpeg' });
      const bitmapUrl = URL.createObjectURL(blob);

      const image = new Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw image to canvas
        ctx.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(bitmapUrl);

        // Update frame rate
        frameCountRef.current++;
        const now = Date.now();
        const elapsed = now - lastFrameTimeRef.current;
        if (elapsed >= 1000) {
          setFrameRate(Math.round((frameCountRef.current / elapsed) * 1000));
          frameCountRef.current = 0;
          lastFrameTimeRef.current = now;
        }
      };

      image.onerror = () => {
        logger.error('[VideoPlayer] Failed to decode MJPEG frame');
        URL.revokeObjectURL(bitmapUrl);
      };

      image.src = bitmapUrl;
    } catch (error) {
      logger.error('[VideoPlayer] MJPEG decode error:', error);
    }
  };

  /**
   * Decode H.264 frame (requires external library)
   * Placeholder for production implementation
   */
  const decodeH264Frame = async (frameData: Uint8Array) => {
    // TODO: Implement H.264 decoding
    // Option 1: Use h264-asm.js library
    // Option 2: Use ffmpeg.wasm
    // Option 3: Use WebCodecs API (if available)
    logger.warn('[VideoPlayer] H.264 decoding not yet implemented');
    logger.info('[VideoPlayer] Frame size:', frameData.length);
  };

  /**
   * Handle incoming frame data
   */
  useEffect(() => {
    if (!isActive || !onFrame) return;

    // Subscribe to frame data
    const handleFrameData = (frameData: Uint8Array) => {
      setIsDecoding(true);

      // Detect frame type (MJPEG starts with JPEG SOI marker FFD8)
      if (frameData[0] === 0xff && frameData[1] === 0xd8) {
        // MJPEG frame
        decodeMJPEGFrame(frameData).finally(() => setIsDecoding(false));
      } else {
        // H.264 frame (starts with different markers)
        decodeH264Frame(frameData).finally(() => setIsDecoding(false));
      }
    };

    // Store reference for cleanup
    const originalOnFrame = onFrame;

    return () => {
      // Cleanup if needed
    };
  }, [isActive, onFrame]);

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="h-full w-full"
        style={{ display: isActive ? 'block' : 'none' }}
      />

      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <p className="text-sm text-gray-400">Connecting to server renderer...</p>
          </div>
        </div>
      )}

      {isActive && (
        <div className="absolute right-2 top-2 flex items-center gap-2 rounded bg-black/50 px-2 py-1 font-mono text-xs text-green-300">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span>{frameRate} fps</span>
        </div>
      )}

      {isDecoding && (
        <div className="pointer-events-none absolute inset-0 border-2 border-yellow-500" />
      )}
    </div>
  );
}

export default StreamingVideoPlayer;
