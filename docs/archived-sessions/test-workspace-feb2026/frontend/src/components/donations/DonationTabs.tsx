'use client';

/**
 * Donation Tabs Component
 * Tabbed interface for organizing donation content
 * Tabs: Support | Transparency | Goals | Learn More
 */

import { useState, ReactNode } from 'react';
import { DollarSign, PieChart, Target, BookOpen } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  content: ReactNode;
}

interface DonationTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function DonationTabs({ tabs, defaultTab, onTabChange }: DonationTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
    // Scroll to top when switching tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (nextTab) setActiveTab(nextTab.id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      const prevTab = tabs[prevIndex];
      if (prevTab) setActiveTab(prevTab.id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const firstTab = tabs[0];
      if (firstTab) setActiveTab(firstTab.id);
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastTab = tabs[tabs.length - 1];
      if (lastTab) setActiveTab(lastTab.id);
    }
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div
        className="sticky top-0 z-10 border-b border-gray-700 bg-gray-900/95 backdrop-blur-sm"
        role="tablist"
        aria-label="Donation sections"
      >
        <div className="mx-auto flex max-w-4xl justify-center gap-1 p-2 sm:gap-2">
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabClick(tab.id)}
                onKeyDown={e => handleKeyDown(e, tab.id, index)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-all sm:px-4 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`tabpanel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            className={activeTab === tab.id ? 'animate-fade-in' : ''}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

// Export icon components for easy reference
export {
  DollarSign as SupportIcon,
  PieChart as TransparencyIcon,
  Target as GoalsIcon,
  BookOpen as LearnMoreIcon,
};
