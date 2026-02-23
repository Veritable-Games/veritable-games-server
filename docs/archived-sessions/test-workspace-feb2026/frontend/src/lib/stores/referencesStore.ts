import { create } from 'zustand';
import type {
  ReferenceImage,
  ReferenceTag,
  ReferenceTagId,
  ReferenceImageId,
  ReferenceAlbum,
  AlbumId,
} from '@/types/project-references';
import type { GalleryConfig } from '@/types/gallery-config';

/**
 * Zustand store for project gallery
 * Manages client-side state for filtering, lightbox, upload queue, and UI interactions
 * Gallery-type agnostic - works for references, concept-art, etc.
 */

export type UploadStatus =
  | 'pending'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled';

export interface QueuedFile {
  id: string;
  file: File;
  preview?: string;
  status: UploadStatus;
  progress: number;
  tags: ReferenceTagId[];
  sortOrder: number;
  error?: string;
  retryCount: number;
  uploadedImageId?: ReferenceImageId;
  uploadedPath?: string;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  dateCreated?: string; // User-specified date for old backups (ISO 8601 format YYYY-MM-DD)
}

export interface ReferenceGalleryState {
  // Configuration (set once on mount)
  config: GalleryConfig | null;

  // Data
  images: ReferenceImage[];
  allTags: ReferenceTag[];
  albums: ReferenceAlbum[];

  // Filters
  selectedTags: ReferenceTagId[];
  sortBy: 'default' | 'dimensions';

  // Selection (multi-select for batch operations)
  selectedImageIds: Set<ReferenceImageId>;
  selectedAlbumIds: Set<AlbumId>;

  // Lightbox
  isLightboxOpen: boolean;
  selectedImageIndex: number | null;
  selectedAlbumId: AlbumId | null; // Track which album lightbox is viewing

  // Video Playback State (for seamless grid -> lightbox transition)
  videoPlaybackTime: number | null; // Current playback time in seconds
  videoWasPlaying: boolean; // Whether video was playing when lightbox opened

  // Upload Queue
  uploadQueue: QueuedFile[];
  batchTags: ReferenceTagId[];
  maxConcurrentUploads: number;

  // UI State (legacy)
  isUploading: boolean;
  uploadProgress: number;

  // Pagination (for infinite scroll)
  currentPage: number;
  hasMoreImages: boolean;
  isLoadingMore: boolean;
  totalImagesCount: number;

  // Actions - Configuration
  setConfig: (config: GalleryConfig) => void;

  // Actions - Data Management
  setImages: (images: ReferenceImage[]) => void;
  setAllTags: (tags: ReferenceTag[]) => void;
  addImages: (newImages: ReferenceImage[]) => void;
  removeImage: (imageId: ReferenceImageId) => void;
  removeImages: (imageIds: ReferenceImageId[]) => void;
  updateImage: (imageId: ReferenceImageId, updates: Partial<ReferenceImage>) => void;

  // Actions - Album Management
  setAlbums: (albums: ReferenceAlbum[]) => void;
  addAlbum: (album: ReferenceAlbum) => void;
  removeAlbum: (albumId: AlbumId) => void;
  updateAlbum: (albumId: AlbumId, updates: Partial<ReferenceAlbum>) => void;
  setSelectedAlbum: (albumId: AlbumId | null) => void;
  removeImageFromAlbum: (albumId: AlbumId, imageId: ReferenceImageId) => void;

  // Actions - Filtering
  toggleTag: (tagId: ReferenceTagId) => void;
  clearTags: () => void;
  setSelectedTags: (tags: ReferenceTagId[]) => void;
  setSortBy: (sortBy: 'default' | 'dimensions') => void;

  // Actions - Selection
  toggleImageSelection: (imageId: ReferenceImageId) => void;
  toggleAlbumSelection: (albumId: AlbumId) => void;
  clearSelection: () => void;
  selectAllImages: () => void;
  selectMultipleImages: (imageIds: ReferenceImageId[]) => void;
  selectMultipleAlbums: (albumIds: AlbumId[]) => void;

  // Actions - Lightbox
  openLightbox: (index: number) => void;
  closeLightbox: () => void;
  nextImage: () => void;
  previousImage: () => void;
  setVideoPlaybackState: (currentTime: number | null, wasPlaying: boolean) => void;
  clearVideoPlaybackState: () => void;

  // Actions - Upload Queue
  addFilesToQueue: (files: File[]) => void;
  removeFileFromQueue: (fileId: string) => void;
  updateQueuedFile: (fileId: string, updates: Partial<QueuedFile>) => void;
  reorderQueuedFile: (fileId: string, newIndex: number) => void;
  clearQueue: () => void;
  clearCompletedFiles: () => void;
  retryFailedFile: (fileId: string) => void;

  // Actions - Batch Tagging
  setBatchTags: (tags: ReferenceTagId[]) => void;
  toggleBatchTag: (tagId: ReferenceTagId) => void;
  applyBatchTagsToQueue: () => void;

  // Actions - Upload (legacy)
  setUploading: (isUploading: boolean) => void;
  setUploadProgress: (progress: number) => void;

  // Actions - Delete Management
  softDeleteImage: (imageId: ReferenceImageId) => void;
  undoDelete: (imageId: ReferenceImageId) => void;
  permanentlyDeleteImage: (imageId: ReferenceImageId) => void;
  getSoftDeletedImages: () => ReferenceImage[];

  // Actions - Pagination (for infinite scroll)
  appendImages: (newImages: ReferenceImage[]) => void;
  setLoadingMore: (isLoading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setCurrentPage: (page: number) => void;
  setTotalImagesCount: (count: number) => void;
  resetPagination: () => void;

  // Computed
  filteredImages: () => ReferenceImage[];
  displayItems: () => (ReferenceImage | ReferenceAlbum)[]; // Grid items (singles + albums)
  activeUploads: () => QueuedFile[];
  pendingUploads: () => QueuedFile[];
  completedUploads: () => QueuedFile[];
  failedUploads: () => QueuedFile[];
  hasSelection: () => boolean;
  selectionCount: () => { images: number; albums: number };
  getSelectedImages: () => ReferenceImage[];
  getSelectedAlbums: () => ReferenceAlbum[];
}

export const useReferencesStore = create<ReferenceGalleryState>((set, get) => ({
  // Initial State
  config: null,
  images: [],
  allTags: [],
  albums: [],
  selectedTags: [],
  sortBy: 'default',
  selectedImageIds: new Set(),
  selectedAlbumIds: new Set(),
  isLightboxOpen: false,
  selectedImageIndex: null,
  selectedAlbumId: null,
  videoPlaybackTime: null,
  videoWasPlaying: false,
  uploadQueue: [],
  batchTags: [],
  maxConcurrentUploads: 3,
  isUploading: false,
  uploadProgress: 0,
  currentPage: 1,
  hasMoreImages: true,
  isLoadingMore: false,
  totalImagesCount: 0,

  // Configuration Actions
  setConfig: config => set({ config }),

  // Data Management Actions
  setImages: images => set({ images }),

  setAllTags: tags => set({ allTags: tags }),

  addImages: newImages =>
    set(state => ({
      images: [...state.images, ...newImages],
    })),

  appendImages: newImages =>
    set(state => {
      // Deduplicate: Only add images that don't already exist
      const existingIds = new Set(state.images.map(img => img.id));
      const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));

      return {
        images: [...state.images, ...uniqueNewImages],
      };
    }),

  removeImage: imageId =>
    set(state => ({
      images: state.images.filter(img => img.id !== imageId),
    })),

  removeImages: imageIds =>
    set(state => ({
      images: state.images.filter(img => !imageIds.includes(img.id)),
    })),

  updateImage: (imageId, updates) =>
    set(state => {
      // Update the image in the array
      const updatedImages = state.images.map(img =>
        img.id === imageId ? { ...img, ...updates } : img
      );

      // If lightbox is open, maintain the index to the same image ID
      // Note: Sorting is handled by backend, so we don't need to re-sort here
      let newSelectedIndex = state.selectedImageIndex;
      if (state.isLightboxOpen && state.selectedImageIndex !== null) {
        // Get the current image ID
        const currentImage = state.images[state.selectedImageIndex];
        if (currentImage && currentImage.id === imageId) {
          // Find the new index of this image (may have changed if tags updated)
          newSelectedIndex = updatedImages.findIndex(img => img.id === imageId);
          if (newSelectedIndex === -1) {
            newSelectedIndex = state.selectedImageIndex; // Fallback
          }
        }
      }

      return {
        images: updatedImages,
        selectedImageIndex: newSelectedIndex,
      };
    }),

  // Album Management Actions
  setAlbums: albums => set({ albums }),

  addAlbum: album =>
    set(state => ({
      albums: [...state.albums, album],
    })),

  removeAlbum: albumId =>
    set(state => ({
      albums: state.albums.filter(album => album.id !== albumId),
    })),

  updateAlbum: (albumId, updates) =>
    set(state => ({
      albums: state.albums.map(album => (album.id === albumId ? { ...album, ...updates } : album)),
    })),

  setSelectedAlbum: albumId => set({ selectedAlbumId: albumId }),

  removeImageFromAlbum: (albumId, imageId) =>
    set(state => {
      const album = state.albums.find(a => a.id === albumId);
      if (!album) return state;

      // Find the image being removed
      const removedImage = album.images.find(img => img.id === imageId);
      if (!removedImage) return state;

      // Remove image from album
      const updatedImages = album.images.filter(img => img.id !== imageId);

      // Check if image already exists in standalone images array
      const imageExists = state.images.some(img => img.id === imageId);

      // If album becomes empty, remove it entirely
      if (updatedImages.length === 0) {
        return {
          albums: state.albums.filter(a => a.id !== albumId),
          // Only add image back if it doesn't already exist
          images: imageExists ? state.images : [...state.images, removedImage],
        };
      }

      // Update album with remaining images and add removed image back to standalone (if not already there)
      return {
        albums: state.albums.map(a =>
          a.id === albumId ? { ...a, images: updatedImages, image_count: updatedImages.length } : a
        ),
        // Only add image back if it doesn't already exist
        images: imageExists ? state.images : [...state.images, removedImage],
      };
    }),

  // Filtering Actions
  toggleTag: tagId =>
    set(state => ({
      selectedTags: state.selectedTags.includes(tagId)
        ? state.selectedTags.filter(id => id !== tagId)
        : [...state.selectedTags, tagId],
      // Reset pagination when filters change
      currentPage: 1,
      hasMoreImages: false, // Disable infinite scroll with filters
      isLoadingMore: false,
    })),

  clearTags: () =>
    set({
      selectedTags: [],
      // Re-enable pagination when filters cleared
      currentPage: 1,
      hasMoreImages: true,
      isLoadingMore: false,
    }),

  setSelectedTags: tags => set({ selectedTags: tags }),

  setSortBy: sortBy =>
    set({
      sortBy,
      // Reset pagination when sort changes
      currentPage: 1,
      hasMoreImages: false, // Disable infinite scroll when sorting changes
    }),

  // Selection Actions
  toggleImageSelection: imageId =>
    set(state => {
      const newSelection = new Set(state.selectedImageIds);
      if (newSelection.has(imageId)) {
        newSelection.delete(imageId);
      } else {
        newSelection.add(imageId);
      }
      return { selectedImageIds: newSelection };
    }),

  toggleAlbumSelection: albumId =>
    set(state => {
      const newSelection = new Set(state.selectedAlbumIds);
      if (newSelection.has(albumId)) {
        newSelection.delete(albumId);
      } else {
        newSelection.add(albumId);
      }
      return { selectedAlbumIds: newSelection };
    }),

  clearSelection: () =>
    set({
      selectedImageIds: new Set(),
      selectedAlbumIds: new Set(),
    }),

  selectAllImages: () =>
    set(state => {
      const allImageIds = new Set(
        state
          .displayItems()
          .filter((item): item is ReferenceImage => !('image_count' in item))
          .map(img => img.id)
      );
      return { selectedImageIds: allImageIds };
    }),

  selectMultipleImages: imageIds =>
    set({
      selectedImageIds: new Set(imageIds),
    }),

  selectMultipleAlbums: albumIds =>
    set({
      selectedAlbumIds: new Set(albumIds),
    }),

  // Lightbox Actions
  openLightbox: index =>
    set({
      isLightboxOpen: true,
      selectedImageIndex: index,
    }),

  closeLightbox: () =>
    set({
      isLightboxOpen: false,
      selectedImageIndex: null,
    }),

  nextImage: () =>
    set(state => {
      if (state.selectedImageIndex === null) {
        return state;
      }

      const currentImage = state.images[state.selectedImageIndex];
      if (!currentImage) {
        return state;
      }

      // If viewing an album, navigate within that album's images
      if (state.selectedAlbumId !== null) {
        const album = state.albums.find(a => a.id === state.selectedAlbumId);
        if (album && album.images.length > 0) {
          // Find current image in album
          const albumIndex = album.images.findIndex(img => img.id === currentImage.id);
          if (albumIndex !== -1) {
            // Navigate to next image in album (wrap around)
            const nextAlbumIndex = (albumIndex + 1) % album.images.length;
            const nextImage = album.images[nextAlbumIndex];

            // Find the index of this image in the global images array
            if (nextImage) {
              const globalIndex = state.images.findIndex(img => img.id === nextImage.id);
              if (globalIndex !== -1) {
                return { selectedImageIndex: globalIndex };
              }
            }
          }
        }
      }

      // Default: navigate through global filtered images
      const filteredImages = get().filteredImages();
      if (filteredImages.length === 0) {
        return state;
      }

      const nextIndex = (state.selectedImageIndex + 1) % filteredImages.length;
      return { selectedImageIndex: nextIndex };
    }),

  previousImage: () =>
    set(state => {
      if (state.selectedImageIndex === null) {
        return state;
      }

      const currentImage = state.images[state.selectedImageIndex];
      if (!currentImage) {
        return state;
      }

      // If viewing an album, navigate within that album's images
      if (state.selectedAlbumId !== null) {
        const album = state.albums.find(a => a.id === state.selectedAlbumId);
        if (album && album.images.length > 0) {
          // Find current image in album
          const albumIndex = album.images.findIndex(img => img.id === currentImage.id);
          if (albumIndex !== -1) {
            // Navigate to previous image in album (wrap around)
            const prevAlbumIndex = albumIndex === 0 ? album.images.length - 1 : albumIndex - 1;
            const prevImage = album.images[prevAlbumIndex];

            // Find the index of this image in the global images array
            if (prevImage) {
              const globalIndex = state.images.findIndex(img => img.id === prevImage.id);
              if (globalIndex !== -1) {
                return { selectedImageIndex: globalIndex };
              }
            }
          }
        }
      }

      // Default: navigate through global filtered images
      const filteredImages = get().filteredImages();
      if (filteredImages.length === 0) {
        return state;
      }

      const prevIndex =
        state.selectedImageIndex === 0 ? filteredImages.length - 1 : state.selectedImageIndex - 1;
      return { selectedImageIndex: prevIndex };
    }),

  setVideoPlaybackState: (currentTime, wasPlaying) =>
    set({
      videoPlaybackTime: currentTime,
      videoWasPlaying: wasPlaying,
    }),

  clearVideoPlaybackState: () =>
    set({
      videoPlaybackTime: null,
      videoWasPlaying: false,
    }),

  // Upload Actions (legacy)
  setUploading: isUploading => set({ isUploading }),

  setUploadProgress: progress => set({ uploadProgress: progress }),

  // Upload Queue Actions
  addFilesToQueue: files =>
    set(state => {
      const now = Date.now();
      const currentMaxOrder = state.uploadQueue.reduce(
        (max, file) => Math.max(max, file.sortOrder),
        -1
      );

      const newFiles: QueuedFile[] = files.map((file, index) => ({
        id: `${now}-${index}-${file.name}`,
        file,
        preview: undefined,
        status: 'pending' as UploadStatus,
        progress: 0,
        tags: [...state.batchTags],
        sortOrder: currentMaxOrder + 1 + index,
        retryCount: 0,
        addedAt: now,
      }));

      // Generate previews for images
      newFiles.forEach(queuedFile => {
        if (queuedFile.file.type.startsWith('image/')) {
          queuedFile.preview = URL.createObjectURL(queuedFile.file);
        }
      });

      return {
        uploadQueue: [...state.uploadQueue, ...newFiles],
      };
    }),

  removeFileFromQueue: fileId =>
    set(state => {
      const file = state.uploadQueue.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return {
        uploadQueue: state.uploadQueue.filter(f => f.id !== fileId),
      };
    }),

  updateQueuedFile: (fileId, updates) =>
    set(state => ({
      uploadQueue: state.uploadQueue.map(file =>
        file.id === fileId ? { ...file, ...updates } : file
      ),
    })),

  reorderQueuedFile: (fileId, newIndex) =>
    set(state => {
      const queue = [...state.uploadQueue];
      const fileIndex = queue.findIndex(f => f.id === fileId);

      if (fileIndex === -1 || newIndex < 0 || newIndex >= queue.length) {
        return state;
      }

      const [movedFile] = queue.splice(fileIndex, 1);
      if (movedFile) {
        queue.splice(newIndex, 0, movedFile);
      }

      // Update sortOrder for all files
      return {
        uploadQueue: queue.map((file, idx) => ({
          ...file,
          sortOrder: idx,
        })),
      };
    }),

  clearQueue: () =>
    set(state => {
      // Revoke all preview URLs
      state.uploadQueue.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      return { uploadQueue: [] };
    }),

  clearCompletedFiles: () =>
    set(state => {
      const completedFiles = state.uploadQueue.filter(f => f.status === 'success');
      completedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
      return {
        uploadQueue: state.uploadQueue.filter(f => f.status !== 'success'),
      };
    }),

  retryFailedFile: fileId =>
    set(state => ({
      uploadQueue: state.uploadQueue.map(file =>
        file.id === fileId && file.status === 'error'
          ? {
              ...file,
              status: 'pending' as UploadStatus,
              progress: 0,
              error: undefined,
              retryCount: file.retryCount + 1,
            }
          : file
      ),
    })),

  // Batch Tagging Actions
  setBatchTags: tags => set({ batchTags: tags }),

  toggleBatchTag: tagId =>
    set(state => ({
      batchTags: state.batchTags.includes(tagId)
        ? state.batchTags.filter(id => id !== tagId)
        : [...state.batchTags, tagId],
    })),

  applyBatchTagsToQueue: () =>
    set(state => ({
      uploadQueue: state.uploadQueue.map(file =>
        file.status === 'pending' ? { ...file, tags: [...state.batchTags] } : file
      ),
    })),

  // Computed - Filtered Images
  // Note: Sorting is now handled by backend, not here
  filteredImages: () => {
    const { images, selectedTags } = get();

    let result = images;

    // Apply tag filters if any
    if (selectedTags.length > 0) {
      // Filter with AND logic: image must have ALL selected tags
      result = images.filter(image => {
        const imageTags = image.tags.map(tag => tag.id);
        return selectedTags.every(selectedTag => imageTags.includes(selectedTag));
      });
    }

    // Images are already sorted by backend based on sortBy and sortOrder
    return result;
  },

  // Computed - Display Items (for grid rendering)
  // Returns mix of standalone images and album objects
  // Album images are hidden from grid, replaced by single album card
  // Items are sorted together using the same criteria as standalone images
  displayItems: () => {
    const { images, albums, selectedTags } = get();

    // Get all image IDs that are in albums
    const albumImageIds = new Set<ReferenceImageId>();
    for (const album of albums) {
      for (const img of album.images) {
        albumImageIds.add(img.id);
      }
    }

    // Filter images by tags
    let filteredImages = images;
    if (selectedTags.length > 0) {
      filteredImages = images.filter(image => {
        const imageTags = image.tags.map(tag => tag.id);
        return selectedTags.every(selectedTag => imageTags.includes(selectedTag));
      });
    }

    // Build display items array
    const items: (ReferenceImage | ReferenceAlbum)[] = [];

    // Add albums (if any of their images match filters)
    for (const album of albums) {
      // Check if album has any images that match the filters
      if (selectedTags.length === 0) {
        // No filters, include all albums
        items.push(album);
      } else {
        // Check if any album image matches the filters
        const hasMatchingImage = album.images.some(img => {
          const imageTags = img.tags.map(tag => tag.id);
          return selectedTags.every(selectedTag => imageTags.includes(selectedTag));
        });

        if (hasMatchingImage) {
          items.push(album);
        }
      }
    }

    // Add standalone images (not in any album)
    for (const image of filteredImages) {
      if (!albumImageIds.has(image.id)) {
        items.push(image);
      }
    }

    // Backend now provides pre-sorted results (by tag, then alphabetically by filename)
    // No client-side sorting needed

    return items;
  },

  // Computed - Upload Queue Filters
  activeUploads: () => {
    const { uploadQueue } = get();
    return uploadQueue.filter(
      file =>
        file.status === 'validating' || file.status === 'uploading' || file.status === 'processing'
    );
  },

  pendingUploads: () => {
    const { uploadQueue } = get();
    return uploadQueue.filter(file => file.status === 'pending');
  },

  completedUploads: () => {
    const { uploadQueue } = get();
    return uploadQueue.filter(file => file.status === 'success');
  },

  failedUploads: () => {
    const { uploadQueue } = get();
    return uploadQueue.filter(file => file.status === 'error');
  },

  // Computed - Selection
  hasSelection: () => {
    const { selectedImageIds, selectedAlbumIds } = get();
    return selectedImageIds.size > 0 || selectedAlbumIds.size > 0;
  },

  selectionCount: () => {
    const { selectedImageIds, selectedAlbumIds } = get();
    return {
      images: selectedImageIds.size,
      albums: selectedAlbumIds.size,
    };
  },

  getSelectedImages: () => {
    const { images, selectedImageIds } = get();
    return images.filter(img => selectedImageIds.has(img.id));
  },

  getSelectedAlbums: () => {
    const { albums, selectedAlbumIds } = get();
    return albums.filter(album => selectedAlbumIds.has(album.id));
  },

  // Actions - Delete Management
  softDeleteImage: imageId =>
    set(state => {
      const image = state.images.find(img => img.id === imageId);
      if (!image) return state;

      return {
        images: state.images.map(img =>
          img.id === imageId
            ? {
                ...img,
                is_deleted: true,
                deleted_at: new Date().toISOString(),
              }
            : img
        ),
      };
    }),

  undoDelete: imageId =>
    set(state => {
      const image = state.images.find(img => img.id === imageId);
      if (!image) return state;

      return {
        images: state.images.map(img =>
          img.id === imageId
            ? {
                ...img,
                is_deleted: false,
                deleted_at: null,
              }
            : img
        ),
      };
    }),

  permanentlyDeleteImage: imageId =>
    set(state => ({
      images: state.images.filter(img => img.id !== imageId),
    })),

  getSoftDeletedImages: () => {
    const { images } = get();
    return images.filter(img => img.is_deleted === true);
  },

  // Pagination Actions
  setLoadingMore: isLoading => set({ isLoadingMore: isLoading }),
  setHasMore: hasMore => set({ hasMoreImages: hasMore }),
  setCurrentPage: page => set({ currentPage: page }),
  setTotalImagesCount: count => set({ totalImagesCount: count }),

  resetPagination: () =>
    set({
      currentPage: 1,
      hasMoreImages: true,
      isLoadingMore: false,
    }),
}));
