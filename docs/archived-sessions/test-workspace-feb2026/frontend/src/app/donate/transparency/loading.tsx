export default function TransparencyLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header Skeleton */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 h-10 w-96 animate-pulse rounded-lg bg-gray-800/50" />
          <div className="mx-auto h-6 w-80 animate-pulse rounded-lg bg-gray-800/30" />
        </div>

        {/* Overview Cards Skeleton */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-gray-700/40 bg-gray-800/50"
            />
          ))}
        </div>

        {/* Section Skeletons */}
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="mb-8 animate-pulse rounded-lg border border-gray-700/40 bg-gray-800/50 p-8"
          >
            <div className="mb-6 h-8 w-64 rounded bg-gray-700/50" />
            <div className="space-y-4">
              <div className="h-20 rounded bg-gray-700/30" />
              <div className="h-20 rounded bg-gray-700/30" />
              <div className="h-20 rounded bg-gray-700/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
