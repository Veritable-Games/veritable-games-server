export default function WikiHistoryLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header Skeleton */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-8xl mx-auto">
          <div className="animate-pulse">
            <div className="mb-2 h-4 w-24 rounded bg-gray-800"></div>
            <div className="mb-2 h-8 w-64 rounded bg-gray-800"></div>
            <div className="h-4 w-32 rounded bg-gray-800"></div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex">
        {/* Revision List Skeleton */}
        <div className="w-1/4 border-r border-gray-800 bg-gray-900/50">
          <div className="border-b border-gray-800 bg-gray-900/70 px-4 py-3">
            <div className="animate-pulse">
              <div className="mb-1 h-4 w-20 rounded bg-gray-800"></div>
              <div className="h-3 w-32 rounded bg-gray-800"></div>
            </div>
          </div>
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-lg border border-gray-700 bg-gray-800/30 p-3">
                <div className="animate-pulse">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-8 rounded bg-gray-700"></div>
                    <div className="h-3 w-12 rounded bg-gray-700"></div>
                  </div>
                  <div className="mb-1 h-4 w-full rounded bg-gray-700"></div>
                  <div className="h-3 w-3/4 rounded bg-gray-700"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Panel Skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="border-b border-gray-800 bg-gray-900/70 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 animate-pulse rounded bg-gray-800"></div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-20 animate-pulse rounded bg-gray-800"></div>
                <div className="h-8 w-8 animate-pulse rounded bg-gray-800"></div>
                <div className="h-8 w-8 animate-pulse rounded bg-gray-800"></div>
              </div>
            </div>
          </div>

          <div className="flex flex-1">
            {/* Left Editor Skeleton */}
            <div className="flex-1 border-r border-gray-800">
              <div className="border-b border-gray-800 bg-blue-900/10 px-3 py-2">
                <div className="animate-pulse">
                  <div className="h-4 w-16 rounded bg-blue-800/50"></div>
                </div>
              </div>
              <div className="flex h-96 items-center justify-center bg-gray-900/20">
                <div className="animate-pulse">
                  <div className="h-4 w-48 rounded bg-gray-800"></div>
                </div>
              </div>
            </div>

            {/* Right Editor Skeleton */}
            <div className="flex-1">
              <div className="border-b border-gray-800 bg-red-900/10 px-3 py-2">
                <div className="animate-pulse">
                  <div className="h-4 w-16 rounded bg-red-800/50"></div>
                </div>
              </div>
              <div className="flex h-96 items-center justify-center bg-gray-900/20">
                <div className="animate-pulse">
                  <div className="h-4 w-48 rounded bg-gray-800"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
