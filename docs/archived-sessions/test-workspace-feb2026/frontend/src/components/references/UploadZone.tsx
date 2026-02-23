'use client';

import { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useReferencesStore } from '@/lib/stores/referencesStore';
import type { GalleryConfig } from '@/types/gallery-config';
import { logger } from '@/lib/utils/logger';

/**
 * Drag & Drop Upload Zone Component
 * Admin-only multi-file upload - adds files to queue for processing
 */

interface UploadZoneProps {
  projectSlug: string;
  config: GalleryConfig;
}

export function UploadZone({ projectSlug, config }: UploadZoneProps) {
  const { addFilesToQueue, uploadQueue } = useReferencesStore();

  // Calculate max file size in MB for display
  const maxSizeMB = Math.round(config.maxFileSize / 1024 / 1024);

  // Generate human-readable format list
  const formatList = useMemo(() => {
    const formats: string[] = [];
    config.allowedMimeTypes.forEach(mimeType => {
      switch (mimeType) {
        case 'image/jpeg':
        case 'image/jpg':
          if (!formats.includes('JPG')) formats.push('JPG');
          break;
        case 'image/png':
          formats.push('PNG');
          break;
        case 'image/gif':
          formats.push('GIF');
          break;
        case 'image/webp':
          formats.push('WebP');
          break;
        case 'image/avif':
          formats.push('AVIF');
          break;
        case 'image/vnd.adobe.photoshop':
        case 'image/x-photoshop':
          if (!formats.includes('PSD')) formats.push('PSD');
          break;
        case 'video/mp4':
          if (!formats.includes('MP4')) formats.push('MP4');
          break;
        case 'video/quicktime':
          if (!formats.includes('MOV')) formats.push('MOV');
          break;
        case 'video/x-msvideo':
          if (!formats.includes('AVI')) formats.push('AVI');
          break;
        case 'video/webm':
          if (!formats.includes('WebM')) formats.push('WebM');
          break;
      }
    });
    return formats.join(', ');
  }, [config.allowedMimeTypes]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      logger.info('📁 Files dropped:', acceptedFiles.length, 'accepted');
      if (acceptedFiles.length === 0) return;
      addFilesToQueue(acceptedFiles);
    },
    [addFilesToQueue]
  );

  const onDropRejected = useCallback(
    (fileRejections: any[]) => {
      logger.error('❌ Files rejected:', fileRejections);
      fileRejections.forEach(rejection => {
        logger.error(`File: ${rejection.file.name} ${rejection.file.type} ${rejection.file.size}`);
        logger.error('Errors:', rejection.errors);
      });

      // Show user-friendly error message
      const firstRejection = fileRejections[0];
      if (firstRejection) {
        const errorCode = firstRejection.errors[0]?.code;
        let message = 'File rejected: ';

        if (errorCode === 'file-too-large') {
          message += `File too large (max ${maxSizeMB}MB)`;
        } else if (errorCode === 'file-invalid-type') {
          message += `Invalid file type. Accepted: ${formatList}`;
        } else {
          message += firstRejection.errors[0]?.message || 'Unknown error';
        }

        alert(message);
      }
    },
    [maxSizeMB, formatList]
  );

  // Build accept object from config MIME types
  const acceptTypes = useMemo(() => {
    const accept: Record<string, string[]> = {};
    config.allowedMimeTypes.forEach(mimeType => {
      switch (mimeType) {
        case 'image/jpeg':
        case 'image/jpg':
          accept['image/jpeg'] = ['.jpg', '.jpeg'];
          break;
        case 'image/png':
          accept['image/png'] = ['.png'];
          break;
        case 'image/gif':
          accept['image/gif'] = ['.gif'];
          break;
        case 'image/webp':
          accept['image/webp'] = ['.webp'];
          break;
        case 'image/avif':
          accept['image/avif'] = ['.avif'];
          break;
        case 'image/vnd.adobe.photoshop':
        case 'image/x-photoshop':
          accept['image/vnd.adobe.photoshop'] = ['.psd'];
          break;
        case 'video/mp4':
          accept['video/mp4'] = ['.mp4'];
          break;
        case 'video/quicktime':
          accept['video/quicktime'] = ['.mov'];
          break;
        case 'video/x-msvideo':
          accept['video/x-msvideo'] = ['.avi'];
          break;
        case 'video/webm':
          accept['video/webm'] = ['.webm'];
          break;
      }
    });
    return accept;
  }, [config.allowedMimeTypes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: acceptTypes,
    maxSize: config.maxFileSize,
    multiple: true,
  });

  const hasActiveUploads = uploadQueue.some(f =>
    ['validating', 'uploading', 'processing'].includes(f.status)
  );

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-6">
      <h2 className="mb-4 text-xl font-semibold">Upload {config.displayName}</h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
        }`}
        role="button"
        aria-label="Upload zone - drag and drop or click to select images"
        tabIndex={0}
      >
        <input {...getInputProps()} aria-label="File input" />

        <div>
          <svg
            className="mx-auto mb-3 h-12 w-12 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {isDragActive ? (
            <p className="font-medium text-blue-400">Drop files here...</p>
          ) : (
            <div>
              <p className="mb-1 font-medium text-gray-300">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-gray-500">
                {formatList} • Max {maxSizeMB}MB per file • Multiple files supported
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload status indicator */}
      {hasActiveUploads && (
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Uploads in progress...</span>
        </div>
      )}
    </div>
  );
}
