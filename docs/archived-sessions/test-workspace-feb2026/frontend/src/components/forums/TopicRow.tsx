'use client';

import React from 'react';
import Link from 'next/link';
import { UserLink } from './UserLink';
import { RelativeTime } from '@/components/ui/RelativeTime';

interface TopicData {
  id: number;
  title: string;
  username?: string;
  user_id?: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_solved?: boolean;
  status?: number; // INTEGER bit flags
  last_reply_at?: string;
  last_reply_username?: string;
  last_reply_user_id?: number;
}

interface TopicRowProps {
  topic: TopicData;
  categoryId?: string;
  showCategory?: boolean; // Added optional prop
}

export function TopicRow({ topic, categoryId }: TopicRowProps) {
  const handleTopicClick = (e: React.MouseEvent) => {
    // Only navigate to topic if the click isn't on a user link
    const target = e.target as HTMLElement;
    if (!target.closest('a[href^="/profile/"]')) {
      window.location.href = `/forums/topic/${topic.id}`;
    }
  };

  return (
    <div
      className="block cursor-pointer transition-colors hover:bg-gray-800/30"
      onClick={handleTopicClick}
    >
      <div className="flex min-h-[40px] items-center border-b border-gray-700 px-4 py-2 last:border-b-0">
        <div className="grid w-full grid-cols-12 items-center gap-4">
          {/* Topic Title & Author */}
          <div className="col-span-6 min-w-0 overflow-hidden">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h4 className="truncate text-sm font-medium text-white transition-colors hover:text-blue-400">
                  {topic.title}
                </h4>
                {!!topic.is_pinned && (
                  <span className="inline-flex h-4 w-4 items-center justify-center" title="PINNED">
                    <svg
                      className="h-4 w-4 text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                  </span>
                )}
                {topic.is_solved && (
                  <span className="inline-flex h-4 w-4 items-center justify-center" title="SOLVED">
                    <svg
                      className="h-4 w-4 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                )}
                {!!topic.is_locked && (
                  <span className="inline-flex h-4 w-4 items-center justify-center" title="LOCKED">
                    <svg
                      className="h-4 w-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                by{' '}
                <UserLink
                  userId={topic.user_id}
                  username={topic.username || 'Unknown'}
                  className="inline text-gray-500 hover:text-blue-400"
                />{' '}
                • <RelativeTime date={topic.created_at} showTooltip />
              </div>
            </div>
          </div>

          {/* Reply Count */}
          <div className="col-span-2">
            <div className="flex flex-col items-center justify-center">
              <div className="text-sm font-medium text-gray-200">{topic.reply_count || 0}</div>
              <div className="text-xs text-gray-500">
                {topic.reply_count === 1 ? 'reply' : 'replies'}
              </div>
            </div>
          </div>

          {/* View Count */}
          <div className="col-span-2">
            <div className="flex flex-col items-center justify-center">
              <div className="text-sm font-medium text-gray-200">{topic.view_count || 0}</div>
              <div className="text-xs text-gray-500">views</div>
            </div>
          </div>

          {/* Last Activity */}
          <div className="col-span-2 text-right">
            {topic.last_reply_at ? (
              <div>
                <div className="text-xs text-gray-300">
                  <RelativeTime date={topic.last_reply_at} showTooltip />
                </div>
                <div className="text-xs text-gray-500">
                  by{' '}
                  <UserLink
                    userId={topic.last_reply_user_id}
                    username={topic.last_reply_username || 'Unknown'}
                    className="inline text-gray-500 hover:text-blue-400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs text-gray-300">
                  <RelativeTime date={topic.created_at} showTooltip />
                </div>
                <div className="text-xs text-gray-500">
                  by{' '}
                  <UserLink
                    userId={topic.user_id}
                    username={topic.username || 'Unknown'}
                    className="inline text-gray-500 hover:text-blue-400"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TopicListProps {
  topics: TopicData[];
  categoryId?: string;
  title?: string;
}

export function TopicList({ topics, categoryId, title = 'Recent Topics' }: TopicListProps) {
  if (topics.length === 0) {
    return (
      <div className="rounded border border-gray-700 bg-gray-900/50 p-6 text-center">
        <div className="mb-2 text-gray-300">No topics found</div>
        <p className="text-sm text-gray-400">
          Be the first to start a discussion in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-gray-700 bg-gray-900/30">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
          <div className="text-xs text-gray-500">
            {topics.length} topic{topics.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Column Headers */}
      <div className="border-b border-gray-700 bg-gray-800/30 px-4 py-1.5">
        <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase tracking-wide text-gray-400">
          <div className="col-span-6">Topic</div>
          <div className="col-span-2 text-center">Replies</div>
          <div className="col-span-2 text-center">Views</div>
          <div className="col-span-2 text-right">Activity</div>
        </div>
      </div>

      {/* Topic Rows - Separate pinned from regular */}
      <div>
        {/* Pinned Topics Section */}
        {topics.filter(t => t.is_pinned).length > 0 && (
          <>
            {/* Pinned Topics */}
            <div className="divide-y divide-gray-700">
              {topics
                .filter(t => t.is_pinned)
                .map(topic => (
                  <TopicRow key={topic.id} topic={topic} categoryId={categoryId} />
                ))}
            </div>

            {/* Visual separator if there are also regular topics */}
            {topics.filter(t => !t.is_pinned).length > 0 && (
              <div className="relative my-1 border-t-2 border-gray-600">
                <div className="absolute -top-2 left-4 bg-gray-900/30 px-2 text-[10px] uppercase tracking-wider text-gray-500">
                  Recent Topics
                </div>
              </div>
            )}
          </>
        )}

        {/* Regular Topics */}
        <div className="divide-y divide-gray-700">
          {topics
            .filter(t => !t.is_pinned)
            .map(topic => (
              <TopicRow key={topic.id} topic={topic} categoryId={categoryId} />
            ))}
        </div>
      </div>
    </div>
  );
}
