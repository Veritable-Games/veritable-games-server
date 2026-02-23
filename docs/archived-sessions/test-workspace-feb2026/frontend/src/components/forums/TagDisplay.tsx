'use client';

import React from 'react';
import Link from 'next/link';
import { ForumTag } from '@/lib/forums/tags';
import { logger } from '@/lib/utils/logger';

interface TagDisplayProps {
  tags: ForumTag[];
  size?: 'sm' | 'md' | 'lg';
  showUsageCount?: boolean;
  linkable?: boolean;
  maxTags?: number;
  className?: string;
}

export function TagDisplay({
  tags,
  size = 'md',
  showUsageCount = false,
  linkable = true,
  maxTags,
  className = '',
}: TagDisplayProps) {
  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const hiddenCount = maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const TagComponent = ({ tag, children }: { tag: ForumTag; children: React.ReactNode }) => {
    if (linkable) {
      return (
        <Link
          href={`/forums/tag/${tag.slug}`}
          className="inline-block transition-opacity hover:opacity-80"
        >
          {children}
        </Link>
      );
    }
    return <span className="inline-block">{children}</span>;
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {displayTags.map(tag => (
        <TagComponent key={tag.id} tag={tag}>
          <span
            className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} transition-colors`}
            style={{
              backgroundColor: `${tag.color}15`,
              borderColor: `${tag.color}40`,
              color: tag.color,
            }}
          >
            {tag.name}
            {showUsageCount && (
              <span
                className={`ml-1.5 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}
                style={{ color: `${tag.color}80` }}
              >
                {tag.usage_count}
              </span>
            )}
          </span>
        </TagComponent>
      ))}

      {hiddenCount > 0 && (
        <span className={`text-gray-400 ${sizeClasses[size]}`}>+{hiddenCount} more</span>
      )}
    </div>
  );
}

interface PopularTagsProps {
  className?: string;
  limit?: number;
}

export function PopularTags({ className = '', limit = 20 }: PopularTagsProps) {
  const [tags, setTags] = React.useState<ForumTag[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        const response = await fetch(`/api/forums/tags?action=popular&limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setTags(data.tags);
        }
      } catch (error) {
        logger.error('Error fetching popular tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularTags();
  }, [limit]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-full bg-gray-700"
              style={{ width: `${60 + Math.random() * 40}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <TagDisplay tags={tags} size="sm" showUsageCount={true} linkable={true} />
    </div>
  );
}

interface TrendingTagsProps {
  className?: string;
  limit?: number;
}

export function TrendingTags({ className = '', limit = 10 }: TrendingTagsProps) {
  const [tags, setTags] = React.useState<ForumTag[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTrendingTags = async () => {
      try {
        const response = await fetch(`/api/forums/tags?action=trending&limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setTags(data.tags);
        }
      } catch (error) {
        logger.error('Error fetching trending tags:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingTags();
  }, [limit]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-full bg-gray-700"
              style={{ width: `${50 + Math.random() * 30}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-orange-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
        <span className="text-sm font-medium text-orange-400">Trending</span>
      </div>
      <TagDisplay tags={tags} size="sm" showUsageCount={false} linkable={true} />
    </div>
  );
}
