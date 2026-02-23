'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Revision } from '@/hooks/useRevisionManager';
import { useRevisionFormatting } from '@/hooks/useRevisionManager';

interface TimelineEntry {
  revision: Revision;
  date: Date;
  daysSinceStart: number;
  position: number;
  sizeChange: number;
  isCluster: boolean;
  clusterSize?: number;
}

interface RevisionTimelineProps {
  revisionManager: any;
  onRevisionSelect: (id: number) => void;
  onCompareRevisions: (ids: number[]) => void;
  height?: number;
}

export function RevisionTimeline({
  revisionManager,
  onRevisionSelect,
  onCompareRevisions,
  height = 120,
}: RevisionTimelineProps) {
  const { formatDate, formatSize } = useRevisionFormatting();
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNodes, setSelectedNodes] = React.useState<number[]>([]);

  const revisions = revisionManager.processedRevisions || [];
  const selectedRevisions = revisionManager.selectedRevisions || [];
  const focusedRevision = null; // Not used in this simplified version

  const handleNodeClick = (revisionId: number) => {
    if (selectedNodes.includes(revisionId)) {
      setSelectedNodes(selectedNodes.filter(id => id !== revisionId));
    } else if (selectedNodes.length >= 2) {
      setSelectedNodes([revisionId]);
    } else {
      setSelectedNodes([...selectedNodes, revisionId]);
    }
  };

  const handleCompareSelected = () => {
    if (selectedNodes.length === 2) {
      onCompareRevisions(selectedNodes);
    }
  };

  // Process revisions into timeline entries
  const timelineData = useMemo(() => {
    if (revisions.length === 0) return [];

    const sortedRevisions = [...revisions].sort(
      (a, b) => new Date(a.revision_timestamp).getTime() - new Date(b.revision_timestamp).getTime()
    );

    const startDate = new Date(sortedRevisions[0].revision_timestamp);
    const endDate = new Date(sortedRevisions[sortedRevisions.length - 1].revision_timestamp);
    const totalDays = Math.max(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      1
    );

    return sortedRevisions.map((revision, index) => {
      const date = new Date(revision.revision_timestamp);
      const daysSinceStart = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const position = totalDays > 0 ? (daysSinceStart / totalDays) * 100 : 0;

      // Calculate size change from previous revision
      let sizeChange = 0;
      if (index > 0) {
        sizeChange = revision.size - sortedRevisions[index - 1].size;
      }

      return {
        revision,
        date,
        daysSinceStart,
        position,
        sizeChange,
        isCluster: false,
      };
    });
  }, [revisions]);

  // Group close revisions into clusters for better visualization
  const clusteredData = useMemo(() => {
    if (timelineData.length === 0) return [];

    const clustered: TimelineEntry[] = [];
    const threshold = 2; // positions within 2% are clustered

    let i = 0;
    while (i < timelineData.length) {
      const current = timelineData[i];
      const cluster = [current];

      // Find all revisions within threshold
      let j = i + 1;
      while (
        j < timelineData.length &&
        current &&
        timelineData[j] &&
        Math.abs(timelineData[j]!.position - current.position) < threshold
      ) {
        const nextEntry = timelineData[j];
        if (nextEntry) {
          cluster.push(nextEntry);
        }
        j++;
      }

      if (cluster.length > 1) {
        // Create cluster entry
        const avgPosition =
          cluster.reduce((sum, entry) => sum + (entry?.position || 0), 0) / cluster.length;
        if (current) {
          clustered.push({
            ...current,
            position: avgPosition,
            isCluster: true,
            clusterSize: cluster.length,
          } as TimelineEntry);
        }
      } else if (current) {
        clustered.push(current);
      }

      i = j;
    }

    return clustered;
  }, [timelineData]);

  // Draw timeline canvas background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || clusteredData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Draw timeline background
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, height / 2);
    ctx.lineTo(width - 20, height / 2);
    ctx.stroke();

    // Draw activity density gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.05)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');

    ctx.fillStyle = gradient;
    ctx.fillRect(20, 0, width - 40, height);
  }, [clusteredData]);

  if (revisions.length === 0) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900/50 p-4">
        <div className="text-center text-gray-400">
          <p className="text-sm">No revision history to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-700 bg-gray-900/50">
      {/* Timeline Header */}
      <div className="border-b border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Revision Timeline</h3>
          <div className="flex items-center gap-4">
            {selectedNodes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{selectedNodes.length} selected</span>
                {selectedNodes.length === 2 && (
                  <button
                    onClick={handleCompareSelected}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500"
                  >
                    Compare
                  </button>
                )}
                <button
                  onClick={() => setSelectedNodes([])}
                  className="rounded bg-gray-600 px-2 py-1 text-xs text-white transition-colors hover:bg-gray-500"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{revisions.length} revisions</span>
              <span>•</span>
              <span>
                {formatDate(revisions[revisions.length - 1]?.revision_timestamp, true)} ago
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Canvas Container */}
      <div className="relative" style={{ height: `${height}px` }}>
        {/* Background Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ height: `${height}px` }}
        />

        {/* Timeline Container */}
        <div ref={timelineRef} className="relative h-full w-full px-5 py-4">
          {/* Timeline Markers */}
          {clusteredData.map((entry, index) => {
            const isSelected = selectedNodes.includes(entry.revision.id);
            const isFocused = false; // Simplified for now
            const left = `${Math.max(2, Math.min(96, entry.position))}%`;

            return (
              <div
                key={`${entry.revision.id}-${index}`}
                className="group absolute -translate-x-1/2 transform cursor-pointer"
                style={{
                  left,
                  top: entry.isCluster ? '25%' : '30%',
                }}
                onClick={e => {
                  e.stopPropagation();
                  handleNodeClick(entry.revision.id);
                  onRevisionSelect(entry.revision.id);
                }}
              >
                {/* Marker Dot */}
                <div
                  className={`relative transition-all duration-200 ${
                    entry.isCluster
                      ? 'h-4 w-4 rounded-full border-2'
                      : 'h-3 w-3 rounded-full border-2'
                  } ${
                    isSelected
                      ? 'border-blue-400 bg-blue-500 shadow-lg shadow-blue-500/50'
                      : isFocused
                        ? 'border-purple-400 bg-purple-500 shadow-lg shadow-purple-500/50'
                        : entry.sizeChange > 0
                          ? 'border-green-500 bg-green-600 hover:shadow-lg hover:shadow-green-500/30'
                          : entry.sizeChange < 0
                            ? 'border-red-500 bg-red-600 hover:shadow-lg hover:shadow-red-500/30'
                            : 'border-gray-500 bg-gray-600 hover:shadow-lg hover:shadow-gray-500/30'
                  } hover:z-10 hover:scale-125`}
                  title={`Revision #${entry.revision.id} - ${formatDate(entry.revision.revision_timestamp)}`}
                >
                  {/* Cluster Size Indicator */}
                  {entry.isCluster && entry.clusterSize && entry.clusterSize > 1 && (
                    <div className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                      {entry.clusterSize}
                    </div>
                  )}

                  {/* Activity Pulse for Recent Revisions */}
                  {entry.daysSinceStart < 7 && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-20"></div>
                  )}
                </div>

                {/* Vertical Connection Line */}
                <div
                  className={`absolute left-1/2 top-full w-px -translate-x-px transform bg-gradient-to-b transition-all duration-200 ${
                    isSelected
                      ? 'h-6 from-blue-500 to-transparent'
                      : isFocused
                        ? 'h-6 from-purple-500 to-transparent'
                        : 'h-4 from-gray-500 to-transparent group-hover:h-6'
                  }`}
                />

                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 transform opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="whitespace-nowrap rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white shadow-lg">
                    <div className="font-medium">#{entry.revision.id}</div>
                    <div className="text-gray-300">
                      {formatDate(entry.revision.revision_timestamp, true)}
                    </div>
                    <div className="text-gray-400">{formatSize(entry.revision.size)}</div>
                    {entry.sizeChange !== 0 && (
                      <div
                        className={`${entry.sizeChange > 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {entry.sizeChange > 0 ? '+' : ''}
                        {formatSize(Math.abs(entry.sizeChange))}
                      </div>
                    )}
                    {entry.isCluster && entry.clusterSize && entry.clusterSize > 1 && (
                      <div className="text-blue-400">{entry.clusterSize} revisions</div>
                    )}
                  </div>
                  {/* Tooltip Arrow */}
                  <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 transform border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            );
          })}

          {/* Timeline Date Labels */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-between px-2 text-xs text-gray-500">
            <span>{formatDate(timelineData[0]?.revision.revision_timestamp, false)}</span>
            <span>
              {formatDate(
                timelineData[timelineData.length - 1]?.revision.revision_timestamp,
                false
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Legend */}
      <div className="border-t border-gray-700 bg-gray-800/50 p-3">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <span>Size increase</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-600"></div>
              <span>Size decrease</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-gray-600"></div>
              <span>Same size</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>Click markers to select • Hover for details</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton component for loading state
export function RevisionTimelineSkeleton() {
  return (
    <div className="animate-pulse rounded border border-gray-700 bg-gray-900/50">
      <div className="border-b border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-gray-700"></div>
          <div className="h-3 w-24 rounded bg-gray-700"></div>
        </div>
      </div>
      <div className="h-32 p-5">
        <div className="h-full rounded bg-gray-800"></div>
      </div>
      <div className="border-t border-gray-700 bg-gray-800/50 p-3">
        <div className="h-3 w-full rounded bg-gray-700"></div>
      </div>
    </div>
  );
}
