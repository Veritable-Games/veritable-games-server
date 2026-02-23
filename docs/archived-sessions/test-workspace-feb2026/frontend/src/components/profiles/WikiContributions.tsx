'use client';

import { memo } from 'react';
import Link from 'next/link';
import { WikiUserStats } from '@/types/profile-aggregation';

interface WikiContributionsProps {
  stats: WikiUserStats;
}

export const WikiContributions = memo<WikiContributionsProps>(({ stats }) => {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">Wiki Contributions</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Wiki Statistics */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Wiki Activity
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Pages Created:</span>
              <span className="font-medium text-blue-400">{stats.totalPagesCreated}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Revisions:</span>
              <span className="font-medium text-green-400">{stats.totalRevisions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pages Viewed:</span>
              <span className="font-medium text-purple-400">{stats.pagesViewed}</span>
            </div>
            {stats.averageEditSize && (
              <div className="flex justify-between">
                <span className="text-gray-400">Avg. Edit Size:</span>
                <span className="text-gray-200">{stats.averageEditSize} chars</span>
              </div>
            )}
            {stats.lastWikiActivity && (
              <div className="flex justify-between">
                <span className="text-gray-400">Last Activity:</span>
                <span className="text-gray-200">
                  {new Date(stats.lastWikiActivity).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Edits */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Recent Edits
          </h3>
          {stats.recentEdits && stats.recentEdits.length > 0 ? (
            <div className="space-y-2">
              {stats.recentEdits.slice(0, 5).map(edit => (
                <div key={edit.id} className="text-sm">
                  <Link
                    href={`/wiki/${encodeURIComponent(edit.pageSlug)}`}
                    className="block truncate text-blue-400 transition-colors hover:text-blue-300"
                  >
                    {edit.pageTitle}
                  </Link>
                  {edit.summary && (
                    <div className="mt-0.5 truncate text-xs italic text-gray-400">
                      "{edit.summary}"
                    </div>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span
                      className={
                        edit.changeSize > 0
                          ? 'text-green-400'
                          : edit.changeSize < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                      }
                    >
                      {edit.changeSize > 0 ? `+${edit.changeSize}` : edit.changeSize} chars
                    </span>
                    <span>•</span>
                    <span>{new Date(edit.revisionTimestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">No wiki edits yet</div>
          )}
        </div>
      </div>
    </div>
  );
});

WikiContributions.displayName = 'WikiContributions';
