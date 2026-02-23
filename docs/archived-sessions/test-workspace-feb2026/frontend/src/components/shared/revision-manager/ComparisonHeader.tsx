'use client';

import React from 'react';
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  LinkIcon,
  EyeIcon,
  PlusIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

interface ComparisonHeaderProps {
  isFullScreen: boolean;
  setIsFullScreen: (fullscreen: boolean) => void;
  syncScrolling: boolean;
  setSyncScrolling: (sync: boolean) => void;
  showDiff: boolean;
  setShowDiff: (show: boolean) => void;
  fontSize: number;
  onFontSizeChange: (delta: number) => void;
}

export const ComparisonHeader: React.FC<ComparisonHeaderProps> = ({
  isFullScreen,
  setIsFullScreen,
  syncScrolling,
  setSyncScrolling,
  showDiff,
  setShowDiff,
  fontSize,
  onFontSizeChange,
}) => {
  return (
    <div className="flex-shrink-0 border-b border-gray-700 bg-gray-800/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Side-by-Side Comparison</h3>

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {/* Font Size Controls */}
          <div className="flex items-center gap-1 rounded-md bg-gray-700/50 p-1">
            <button
              onClick={() => onFontSizeChange(-1)}
              className="rounded p-1 text-gray-300 transition-colors hover:bg-gray-600/50 hover:text-white"
              title="Decrease font size"
              disabled={fontSize <= 10}
            >
              <MinusIcon className="h-3 w-3" />
            </button>
            <span className="min-w-[2ch] px-1 text-center text-xs text-gray-400">{fontSize}</span>
            <button
              onClick={() => onFontSizeChange(1)}
              className="rounded p-1 text-gray-300 transition-colors hover:bg-gray-600/50 hover:text-white"
              title="Increase font size"
              disabled={fontSize >= 20}
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          </div>

          {/* Sync Scrolling Toggle */}
          <button
            onClick={() => setSyncScrolling(!syncScrolling)}
            className={`rounded p-2 transition-colors ${
              syncScrolling
                ? 'bg-gray-600/30 text-gray-200 hover:bg-gray-600/50'
                : 'text-gray-400 hover:bg-gray-600/30 hover:text-gray-300'
            }`}
            title={
              syncScrolling ? 'Disable synchronized scrolling' : 'Enable synchronized scrolling'
            }
          >
            <LinkIcon className="h-4 w-4" />
          </button>

          {/* Diff Toggle */}
          <button
            onClick={() => setShowDiff(!showDiff)}
            className={`rounded p-2 transition-colors ${
              showDiff
                ? 'bg-gray-600/30 text-gray-200 hover:bg-gray-600/50'
                : 'text-gray-400 hover:bg-gray-600/30 hover:text-gray-300'
            }`}
            title={
              showDiff
                ? 'Disable diff mode (show separate editors)'
                : 'Enable diff mode (show side-by-side diff)'
            }
          >
            <EyeIcon className="h-4 w-4" />
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="rounded p-2 text-gray-400 transition-colors hover:bg-gray-600/30 hover:text-gray-300"
            title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
          >
            {isFullScreen ? (
              <ArrowsPointingInIcon className="h-4 w-4" />
            ) : (
              <ArrowsPointingOutIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComparisonHeader;
