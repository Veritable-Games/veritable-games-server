/**
 * Video Transcoding Service
 *
 * Handles video compression using FFmpeg with H.265 codec.
 * Provides utilities for:
 * - Video transcoding (compress to web-optimized MP4)
 * - Thumbnail extraction (poster images)
 * - Metadata extraction (duration, dimensions, codec info)
 *
 * REQUIREMENTS:
 * - FFmpeg 7+ must be installed on the system
 * - Check with: ffmpeg -version
 * - Ubuntu/Debian: sudo apt install ffmpeg
 * - macOS: brew install ffmpeg
 */

import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import { logger } from '@/lib/utils/logger';

// ============================================
// Types
// ============================================

export interface TranscodingOptions {
  inputPath: string;
  outputPath: string;
  resolution?: '1080p' | '720p' | '480p';
  crf?: number; // 18-28 (lower = better quality, larger file)
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  onProgress?: (progress: TranscodingProgress) => void; // Progress callback
}

// FFprobe JSON output types
interface FFprobeStream {
  codec_type: string;
  codec_name: string;
  width: number;
  height: number;
  tags?: {
    creation_time?: string;
    [key: string]: string | undefined;
  };
}

interface FFprobeFormat {
  duration: string;
  size: string;
  bit_rate: string;
  tags?: {
    creation_time?: string;
    date?: string;
    [key: string]: string | undefined;
  };
}

interface FFprobeData {
  streams: FFprobeStream[];
  format: FFprobeFormat;
}

export interface TranscodingProgress {
  percent: number; // 0-100
  currentTime: number; // seconds
  totalDuration: number; // seconds
  fps: number;
  speed: number; // encoding speed multiplier (e.g., 1.5x)
  frame: number;
  bitrate: string;
}

export interface TranscodingResult {
  success: boolean;
  outputPath?: string;
  duration?: number; // seconds
  width?: number;
  height?: number;
  fileSize?: number; // bytes
  error?: string;
}

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  fileSize: number; // bytes
  codec: string;
  bitrate: number; // bits per second
  creationTime?: Date; // From container metadata (creation_time tag)
}

export interface ThumbnailOptions {
  inputPath: string;
  outputPath: string;
  timeSeconds?: number; // Which frame to extract (default: 1)
  width?: number; // Thumbnail width (height auto-calculated)
}

export interface ThumbnailResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================
// Transcode Video
// ============================================

/**
 * Transcode video to web-optimized MP4 with H.265 compression
 *
 * @example
 * ```typescript
 * const result = await transcodeVideo({
 *   inputPath: '/tmp/upload.mp4',
 *   outputPath: '/tmp/compressed.mp4',
 *   resolution: '720p',
 *   crf: 26,
 *   preset: 'medium'
 * });
 *
 * if (result.success) {
 *   logger.info('Compressed:', result.fileSize, 'bytes');
 *   logger.info('Duration:', result.duration, 'seconds');
 * }
 * ```
 */
export async function transcodeVideo(options: TranscodingOptions): Promise<TranscodingResult> {
  const {
    inputPath,
    outputPath,
    resolution = '720p',
    crf = 26,
    preset = 'medium',
    onProgress,
  } = options;

  // Get input video duration for progress calculation
  let totalDuration = 0;
  if (onProgress) {
    try {
      const metadata = await getVideoMetadata(inputPath);
      totalDuration = metadata.duration;
    } catch (error) {
      logger.warn('Failed to get video duration for progress tracking:', error);
    }
  }

  // Determine scale based on resolution
  const scales: Record<string, string> = {
    '1080p': 'scale=-2:1080',
    '720p': 'scale=-2:720',
    '480p': 'scale=-2:480',
  };

  const scaleFilter = scales[resolution] || 'scale=-2:720'; // Default to 720p if resolution not found

  return new Promise(resolve => {
    const args = [
      '-i',
      inputPath, // Input file
      '-c:v',
      'libx265', // H.265 video codec
      '-crf',
      crf.toString(), // Quality (18-28, lower = better)
      '-preset',
      preset, // Encoding speed vs efficiency
      '-vf',
      scaleFilter, // Resize to target resolution
      '-c:a',
      'aac', // AAC audio codec
      '-b:a',
      '128k', // Audio bitrate
      '-movflags',
      '+faststart', // Enable progressive streaming (critical!)
      '-y', // Overwrite output file
      outputPath,
    ];

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    let stderrBuffer = '';

    ffmpeg.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      stderrBuffer += chunk;

      // Parse progress from FFmpeg output
      if (onProgress && totalDuration > 0) {
        // FFmpeg outputs progress lines like:
        // frame=  123 fps=45 q=28.0 size=1024kB time=00:00:05.12 bitrate=1638.4kbits/s speed=1.85x
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch && timeMatch[1] && timeMatch[2] && timeMatch[3]) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const percent = Math.min(100, (currentTime / totalDuration) * 100);

            // Extract other progress metrics
            const frameMatch = line.match(/frame=\s*(\d+)/);
            const fpsMatch = line.match(/fps=\s*([\d.]+)/);
            const speedMatch = line.match(/speed=\s*([\d.]+)x/);
            const bitrateMatch = line.match(/bitrate=\s*([\d.]+\w+\/s)/);

            onProgress({
              percent: Math.round(percent * 10) / 10,
              currentTime,
              totalDuration,
              frame: frameMatch && frameMatch[1] ? parseInt(frameMatch[1], 10) : 0,
              fps: fpsMatch && fpsMatch[1] ? parseFloat(fpsMatch[1]) : 0,
              speed: speedMatch && speedMatch[1] ? parseFloat(speedMatch[1]) : 0,
              bitrate: bitrateMatch && bitrateMatch[1] ? bitrateMatch[1] : '0kbits/s',
            });
          }
        }
      }
    });

    ffmpeg.on('close', async (code: number | null) => {
      if (code === 0) {
        // Success - extract metadata from output file
        try {
          const metadata = await getVideoMetadata(outputPath);
          const stats = await stat(outputPath);

          resolve({
            success: true,
            outputPath,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            fileSize: stats.size,
          });
        } catch (error) {
          resolve({
            success: false,
            error: `Transcoding succeeded but metadata extraction failed: ${(error as Error).message}`,
          });
        }
      } else {
        // Extract error message from FFmpeg stderr
        const errorMatch = stderr.match(/Error:(.+)/);
        const errorMessage =
          errorMatch && errorMatch[1] ? errorMatch[1].trim() : 'Unknown FFmpeg error';

        resolve({
          success: false,
          error: `FFmpeg failed with code ${code}: ${errorMessage}`,
        });
      }
    });

    ffmpeg.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Failed to spawn FFmpeg: ${err.message}. Is FFmpeg installed?`,
      });
    });
  });
}

// ============================================
// Extract Video Metadata
// ============================================

/**
 * Extract video metadata using ffprobe
 *
 * @example
 * ```typescript
 * const metadata = await getVideoMetadata('/path/to/video.mp4');
 * logger.info('Duration:', metadata.duration, 'seconds');
 * logger.info('Resolution:', `${metadata.width}x${metadata.height}`);
 * ```
 */
export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v',
      'quiet', // Suppress verbose output
      '-print_format',
      'json', // Output as JSON
      '-show_format', // Show format info (duration, bitrate, size)
      '-show_streams', // Show stream info (width, height, codec)
      filePath,
    ];

    const ffprobe = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code: number | null) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout) as FFprobeData;

          // Find video stream
          const videoStream = data.streams?.find(s => s.codec_type === 'video');
          if (!videoStream) {
            reject(new Error('No video stream found in file'));
            return;
          }

          // Extract metadata
          const metadata: VideoMetadata = {
            duration: parseFloat(data.format.duration) || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fileSize: parseInt(data.format.size) || 0,
            codec: videoStream.codec_name || 'unknown',
            bitrate: parseInt(data.format.bit_rate) || 0,
            creationTime: extractCreationTime(data),
          };

          resolve(metadata);
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${(error as Error).message}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on('error', err => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}. Is FFmpeg installed?`));
    });
  });
}

// ============================================
// Extract Thumbnail
// ============================================

/**
 * Extract a thumbnail image from a video at specified time
 *
 * @example
 * ```typescript
 * const result = await extractThumbnail({
 *   inputPath: '/path/to/video.mp4',
 *   outputPath: '/path/to/thumbnail.jpg',
 *   timeSeconds: 1,
 *   width: 640
 * });
 *
 * if (result.success) {
 *   logger.info('Thumbnail saved:', result.path);
 * }
 * ```
 */
export async function extractThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
  const { inputPath, outputPath, timeSeconds = 1, width } = options;

  return new Promise(resolve => {
    const args = [
      '-i',
      inputPath,
      '-ss',
      timeSeconds.toString(), // Seek to specified time
      '-frames:v',
      '1', // Extract 1 frame
      '-q:v',
      '2', // JPEG quality (2 = high quality)
    ];

    // Add scale filter if width specified
    if (width) {
      args.push('-vf', `scale=${width}:-1`);
    }

    args.push('-y', outputPath);

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({
          success: true,
          path: outputPath,
        });
      } else {
        resolve({
          success: false,
          error: `Thumbnail extraction failed with code ${code}: ${stderr}`,
        });
      }
    });

    ffmpeg.on('error', (err: Error) => {
      resolve({
        success: false,
        error: `Failed to spawn FFmpeg: ${err.message}`,
      });
    });
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if FFmpeg is installed and accessible
 *
 * @example
 * ```typescript
 * const available = await isFFmpegAvailable();
 * if (!available) {
 *   logger.error('FFmpeg not installed!');
 * }
 * ```
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const ffmpeg = spawn('ffmpeg', ['-version']);

    ffmpeg.on('close', (code: number | null) => {
      resolve(code === 0);
    });

    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get FFmpeg version string
 */
export async function getFFmpegVersion(): Promise<string | null> {
  return new Promise(resolve => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    let stdout = '';

    ffmpeg.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffmpeg.on('close', (code: number | null) => {
      if (code === 0) {
        // Extract version from first line
        const match = stdout.match(/ffmpeg version ([\d.]+)/);
        resolve(match && match[1] ? match[1] : null);
      } else {
        resolve(null);
      }
    });

    ffmpeg.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Format duration (seconds) as HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate compression ratio percentage
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}

/**
 * Extract creation time from FFprobe metadata
 *
 * Tries multiple tag locations to find video creation date:
 * 1. Format-level creation_time (most common in MP4, MOV, MKV)
 * 2. Stream-level creation_time
 * 3. Date tag
 */
function extractCreationTime(ffprobeData: FFprobeData): Date | undefined {
  // Try format-level tags first (container metadata)
  const formatCreationTime = ffprobeData.format?.tags?.creation_time;
  if (formatCreationTime) {
    try {
      return new Date(formatCreationTime);
    } catch {
      // Invalid date format, continue
    }
  }

  // Try stream-level tags
  const streamCreationTime = ffprobeData.streams?.[0]?.tags?.creation_time;
  if (streamCreationTime) {
    try {
      return new Date(streamCreationTime);
    } catch {
      // Invalid date format, continue
    }
  }

  // Try other date fields
  const dateTag = ffprobeData.format?.tags?.date;
  if (dateTag) {
    try {
      return new Date(dateTag);
    } catch {
      // Invalid date format, continue
    }
  }

  return undefined;
}
