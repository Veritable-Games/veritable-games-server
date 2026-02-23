'use client';

/**
 * Loading Skeleton Component
 * Maintains aspect ratio to prevent layout shift during lazy loading
 */

interface ImageSkeletonProps {
  aspectRatio?: number | null;
}

export function ImageSkeleton({ aspectRatio }: ImageSkeletonProps) {
  return (
    <div
      className="w-full animate-pulse bg-gray-800"
      style={{
        aspectRatio: aspectRatio || 1,
        minHeight: '200px',
        maxHeight: '800px',
      }}
    >
      <div className="flex h-full w-full items-center justify-center">
        <svg
          className="h-12 w-12 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    </div>
  );
}
