/**
 * Upload Processor
 * Handles concurrent multi-file uploads with progress tracking
 */

import { createUploadLogger } from '@/lib/utils/upload-logger';
import type { QueuedFile, UploadStatus } from '@/lib/stores/referencesStore';
import type { ReferenceImageId } from '@/types/project-references';
import type { GalleryConfig } from '@/types/gallery-config';

interface UploadResult {
  success: boolean;
  imageId?: ReferenceImageId;
  filePath?: string;
  error?: string;
}

interface UploadCallbacks {
  onProgress: (fileId: string, progress: number) => void;
  onStatusChange: (fileId: string, status: UploadStatus) => void;
  onSuccess: (fileId: string, imageId: ReferenceImageId, filePath: string) => void;
  onError: (fileId: string, error: string) => void;
}

export class UploadProcessor {
  public readonly projectSlug: string;
  private maxConcurrent: number;
  private config: GalleryConfig | null;
  private activeUploads: Set<string> = new Set();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(projectSlug: string, maxConcurrent: number = 3, config: GalleryConfig | null = null) {
    this.projectSlug = projectSlug;
    this.maxConcurrent = maxConcurrent;
    this.config = config;
  }

  /**
   * Process upload queue with concurrent limit
   */
  async processQueue(queue: QueuedFile[], callbacks: UploadCallbacks): Promise<void> {
    const pendingFiles = queue
      .filter(file => file.status === 'pending')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const promises: Promise<void>[] = [];

    for (const file of pendingFiles) {
      // Wait if we've hit the concurrent limit
      while (this.activeUploads.size >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Start upload
      const uploadPromise = this.uploadFile(file, callbacks);
      promises.push(uploadPromise);
    }

    // Wait for all uploads to complete
    await Promise.allSettled(promises);
  }

  /**
   * Upload a single file with progress tracking
   */
  private async uploadFile(queuedFile: QueuedFile, callbacks: UploadCallbacks): Promise<void> {
    const { id: fileId, file, tags, dateCreated } = queuedFile;

    this.activeUploads.add(fileId);

    try {
      // Validate file
      callbacks.onStatusChange(fileId, 'validating');
      await this.validateFile(file);

      // Upload file
      callbacks.onStatusChange(fileId, 'uploading');
      const result = await this.uploadWithProgress(file, tags, fileId, dateCreated, callbacks);

      if (result.success && result.imageId && result.filePath) {
        callbacks.onStatusChange(fileId, 'processing');
        // Brief delay to show processing state
        await new Promise(resolve => setTimeout(resolve, 300));

        callbacks.onSuccess(fileId, result.imageId, result.filePath);
        callbacks.onStatusChange(fileId, 'success');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError(fileId, errorMessage);
      callbacks.onStatusChange(fileId, 'error');
    } finally {
      this.activeUploads.delete(fileId);
      this.abortControllers.delete(fileId);
    }
  }

  /**
   * Validate file before upload
   */
  private async validateFile(file: File): Promise<void> {
    // Use config limits if available, otherwise fallback to defaults
    const maxSize = this.config?.maxFileSize ?? 10 * 1024 * 1024; // Default 10MB
    const allowedTypes = this.config?.allowedMimeTypes ?? [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        `Invalid file type. Allowed types: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`
      );
    }

    // Validate image dimensions (optional, can add if needed)
    return Promise.resolve();
  }

  /**
   * Upload file with XMLHttpRequest for progress tracking
   */
  private uploadWithProgress(
    file: File,
    tags: string[],
    fileId: string,
    dateCreated: string | undefined,
    callbacks: UploadCallbacks
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      // Create structured logger for this upload
      const logger = createUploadLogger(file, 'UploadProcessor');

      const xhr = new XMLHttpRequest();
      const abortController = new AbortController();
      this.abortControllers.set(fileId, abortController);

      // Listen for abort signal
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      });

      // Progress tracking
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          callbacks.onProgress(fileId, progress);
        }
      });

      // Upload complete
      xhr.addEventListener('load', () => {
        logger.logXHRResponse(xhr.status, xhr.statusText);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);

            logger.info('network', 'Upload response received', {
              status: xhr.status,
              isVideo,
              hasVideoId: !!response.videoId,
              hasResults: !!response.results,
              responseKeys: Object.keys(response),
            });

            // Handle video upload response format
            if (isVideo && response.success && response.videoId) {
              // Video API returns: { success: true, videoId: 123, filePath: "...", message: "...", metadata: {...} }
              logger.info('upload', 'Video upload successful', {
                videoId: response.videoId,
                filePath: response.filePath,
                metadata: response.metadata,
              });

              resolve({
                success: true,
                imageId: response.videoId as ReferenceImageId,
                filePath: response.filePath || '', // Video path from API response
              });
            }
            // Handle image upload response format
            else if (response.results && response.results.length > 0) {
              // Image API returns: { success, message, results: [...] }
              const uploadedFile = response.results[0];
              if (uploadedFile.success) {
                logger.info('upload', 'Image upload successful', {
                  imageId: uploadedFile.image_id,
                  filePath: uploadedFile.file_path,
                  resultsCount: response.results.length,
                });

                resolve({
                  success: true,
                  imageId: uploadedFile.image_id,
                  filePath: uploadedFile.file_path,
                });
              } else {
                logger.error('upload', 'Image upload failed', {
                  error: uploadedFile.error,
                  uploadedFile,
                });

                resolve({
                  success: false,
                  error: uploadedFile.error || 'Upload failed',
                });
              }
            } else {
              logger.error('upload', 'Invalid response format', {
                response,
                expectedFormat: isVideo
                  ? 'video response with videoId'
                  : 'image response with results[]',
              });

              resolve({
                success: false,
                error: 'No upload result in response',
              });
            }
          } catch (error) {
            logger.error('network', 'Failed to parse response JSON', {
              error: (error as Error).message,
              responseText: xhr.responseText.substring(0, 500), // First 500 chars
            });

            resolve({
              success: false,
              error: 'Failed to parse response',
            });
          }
        } else {
          // Error response (status >= 300)
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            logger.error('network', 'Upload request failed', {
              status: xhr.status,
              statusText: xhr.statusText,
              error: errorResponse.error || errorResponse.message,
              response: errorResponse,
            });

            resolve({
              success: false,
              error: errorResponse.error || `Upload failed with status ${xhr.status}`,
            });
          } catch {
            logger.error('network', 'Upload request failed (unparseable response)', {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText.substring(0, 500),
            });

            resolve({
              success: false,
              error: `Upload failed with status ${xhr.status}`,
            });
          }
        }
      });

      // Upload error
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error occurred',
        });
      });

      // Upload aborted
      xhr.addEventListener('abort', () => {
        resolve({
          success: false,
          error: 'Upload cancelled',
        });
      });

      // Determine if file is a video or image
      const isVideo = file.type.startsWith('video/');
      logger.info('upload', 'Detected upload type', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isVideo,
        galleryType: this.config?.galleryType,
      });

      // Prepare form data
      const formData = new FormData();

      if (isVideo) {
        // Video upload: Different endpoint and field name
        logger.debug('upload', 'Preparing video upload FormData', {
          fieldName: 'file',
          tagsCount: tags.length,
          hasDateCreated: !!dateCreated,
          note: 'Videos are transcoded server-side',
        });
        formData.append('file', file); // Single file, not 'files'
        // Add tags to video upload
        if (tags.length > 0) {
          formData.append('tag_ids', tags.join(','));
        }
        // Add user-specified date for old backup files (YYYY-MM-DD format)
        if (dateCreated) {
          formData.append('date_created', dateCreated);
        }

        // CRITICAL: Send File.lastModified explicitly as metadata
        // FormData does NOT serialize File.lastModified property (HTML spec limitation)
        // So we must send it separately to preserve original file timestamps
        const filesMetadata = JSON.stringify({
          name: file.name,
          lastModified: file.lastModified, // Browser's original timestamp
          size: file.size,
        });
        formData.append('files_metadata', filesMetadata);
      } else {
        // Image upload: Standard multi-file upload
        formData.append('files', file);
        if (tags.length > 0) {
          formData.append('tag_ids', tags.join(','));
        }
        // Add user-specified date for old backup files (YYYY-MM-DD format)
        if (dateCreated) {
          formData.append('date_created', dateCreated);
        }

        // CRITICAL FIX: Send File.lastModified explicitly as metadata
        // FormData does NOT serialize File.lastModified property (HTML spec limitation)
        // So we must send it separately to preserve original file timestamps
        const filesMetadata = JSON.stringify({
          name: file.name,
          lastModified: file.lastModified, // Browser's original timestamp
          size: file.size,
        });
        formData.append('files_metadata', filesMetadata);
      }

      // Determine upload endpoint
      let uploadUrl: string;
      if (isVideo) {
        // Videos go to dedicated video upload endpoint
        const baseUrl = this.config
          ? this.config.uploadPath.replace('[slug]', this.projectSlug)
          : `/api/projects/${this.projectSlug}/references`;
        uploadUrl = `${baseUrl}/videos/upload`;
        logger.info('network', 'Video upload endpoint configured', {
          uploadUrl,
          baseUrl,
          endpoint: 'videos/upload',
        });
      } else {
        // Images use standard upload path
        uploadUrl = this.config
          ? this.config.uploadPath.replace('[slug]', this.projectSlug)
          : `/api/projects/${this.projectSlug}/references`; // Fallback
        logger.info('network', 'Image upload endpoint configured', {
          uploadUrl,
          tagsCount: tags.length,
          hasDateCreated: !!dateCreated,
        });
      }

      logger.info('network', 'Starting XHR upload', {
        method: 'POST',
        url: uploadUrl,
        isVideo,
        fileSize: file.size,
        hasCSRFToken: !!this.getCSRFToken(),
      });

      xhr.open('POST', uploadUrl);

      // Add CSRF token header (required by withSecurity middleware)
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        xhr.setRequestHeader('x-csrf-token', csrfToken);
      }

      xhr.send(formData);
    });
  }

  /**
   * Cancel an active upload
   */
  cancelUpload(fileId: string): void {
    const abortController = this.abortControllers.get(fileId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(fileId);
    }
  }

  /**
   * Cancel all active uploads
   */
  cancelAllUploads(): void {
    for (const [fileId, controller] of this.abortControllers.entries()) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.activeUploads.clear();
  }

  /**
   * Get number of active uploads
   */
  getActiveCount(): number {
    return this.activeUploads.size;
  }

  /**
   * Get CSRF token from cookies
   * @private
   */
  private getCSRFToken(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const cookies = document.cookie.split('; ');
    const csrfCookie = cookies.find(row => row.startsWith('csrf_token='));

    if (!csrfCookie) {
      return null;
    }

    return csrfCookie.split('=')[1] || null;
  }
}
