'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { User } from '@/lib/users/types';
import { ProfileSettingsForm } from './ProfileSettingsForm';
import { PrivacySettingsForm } from './PrivacySettingsForm';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import {
  SettingsIcon,
  SettingsLayoutContainer,
  SettingsHeaderContainer,
  SettingsSidebarContainer,
  SettingsTabContainer,
  type SettingsIconName,
} from './ui';
import { getProfileUrlFromUsername } from '@/lib/utils/profile-url';

interface SettingsLayoutProps {
  user: User;
}

type SettingsTab = 'profile' | 'privacy' | 'preferences' | 'account' | 'security';

export function SettingsLayout({ user }: SettingsLayoutProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mobileSelectRef = useRef<HTMLSelectElement>(null);

  const tabs = [
    {
      id: 'profile' as SettingsTab,
      label: 'Profile',
      icon: 'user' as SettingsIconName,
      description: 'Update your profile and visibility',
    },
    {
      id: 'privacy' as SettingsTab,
      label: 'Privacy',
      icon: 'shield' as SettingsIconName,
      description: 'Control your privacy settings',
    },
    {
      id: 'preferences' as SettingsTab,
      label: 'Preferences',
      icon: 'sliders' as SettingsIconName,
      description: 'Time, date, and notifications',
    },
    {
      id: 'account' as SettingsTab,
      label: 'Account',
      icon: 'at-sign' as SettingsIconName,
      description: 'Email and password',
    },
    {
      id: 'security' as SettingsTab,
      label: 'Security',
      icon: 'lock' as SettingsIconName,
      description: '2FA and active sessions',
    },
  ];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't handle keyboard navigation when in form fields
      }

      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault();
          newIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      const newTab = tabs[newIndex];
      if (!newTab) return;

      setActiveTab(newTab.id);

      // Focus the button for screen readers
      const button = tabRefs.current.get(newTab.id);
      if (button) {
        button.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettingsForm user={user} />;
      case 'privacy':
        return <PrivacySettingsForm user={user} />;
      case 'preferences':
        return <PreferencesSettingsForm user={user} />;
      case 'account':
        return <AccountSettingsForm user={user} />;
      case 'security':
        return <SecuritySettingsForm user={user} />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-y-auto px-6 [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
      {/* Page Header - centered on tablet, left-aligned on desktop to match sidebar */}
      <header className="flex-shrink-0 py-4">
        <div className="mx-auto w-full max-w-xl md:max-w-xl lg:mx-0 lg:w-64 xl:w-72">
          <Link
            href={getProfileUrlFromUsername(user.username)}
            className="mb-4 inline-block text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            ← Back to Profile
          </Link>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage your account, profile, and privacy preferences
          </p>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 overflow-visible lg:overflow-hidden">
        <div className="flex h-full w-full gap-6 py-6">
          {/* Mobile Navigation - Dropdown Select */}
          <div className="block flex h-full w-full flex-col overflow-hidden md:hidden">
            <label htmlFor="settings-tab-select" className="sr-only">
              Select settings section
            </label>
            <div className="relative mb-6 flex-shrink-0">
              <select
                id="settings-tab-select"
                ref={mobileSelectRef}
                value={activeTab}
                onChange={e => setActiveTab(e.target.value as SettingsTab)}
                className="w-full appearance-none rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 pr-10 text-white transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            {/* Mobile tab description */}
            <p className="mb-6 flex-shrink-0 px-1 text-sm text-gray-400">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>

            {/* Mobile Content */}
            <div className="flex-1 overflow-y-auto">
              <SettingsTabContainer>
                <div
                  id={`tabpanel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={activeTab}
                  className="animate-fadeIn"
                >
                  {renderTabContent()}
                </div>
              </SettingsTabContainer>
            </div>
          </div>

          {/* Tablet Navigation - Horizontal Tabs */}
          <div className="hidden w-full flex-col md:flex lg:hidden">
            <div className="mx-auto mb-6 w-full max-w-xl rounded-lg border border-gray-700 bg-gray-900/70 p-2">
              <nav className="flex gap-1" role="tablist">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    ref={el => {
                      if (el) tabRefs.current.set(tab.id, el);
                    }}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    className={`flex min-w-0 flex-1 basis-0 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      activeTab === tab.id
                        ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    }`}
                  >
                    <SettingsIcon name={tab.icon} className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tablet Content */}
            <div className="flex-1 overflow-y-auto">
              <SettingsTabContainer>
                <div
                  id={`tabpanel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={activeTab}
                  className="animate-fadeIn"
                >
                  {renderTabContent()}
                </div>
              </SettingsTabContainer>
            </div>
          </div>

          {/* Desktop Layout with Fixed Sidebar + Scrollable Content */}
          <div className="hidden h-full gap-6 lg:flex">
            {/* Fixed Sidebar Navigation */}
            <SettingsSidebarContainer>
              <div className="h-fit max-h-96 flex-shrink-0 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/70">
                <div className="p-4">
                  <h2 className="mb-4 px-3 text-sm font-semibold uppercase tracking-wide text-gray-300">
                    Settings
                  </h2>
                  <nav
                    className="flex flex-col gap-1"
                    role="tablist"
                    aria-label="Settings navigation"
                  >
                    {tabs.map((tab, index) => (
                      <button
                        key={tab.id}
                        ref={el => {
                          if (el) tabRefs.current.set(tab.id, el);
                        }}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`tabpanel-${tab.id}`}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={`group relative flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                          activeTab === tab.id
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                        }`}
                        title={tab.description}
                      >
                        {/* Active indicator */}
                        <div
                          className={`absolute inset-y-2 left-0 w-0.5 rounded-r bg-blue-400 transition-all duration-200 ${
                            activeTab === tab.id ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        {/* Icon */}
                        <span
                          className={`w-5 flex-shrink-0 transition-transform duration-200 ${
                            activeTab === tab.id ? 'scale-110' : 'group-hover:scale-105'
                          }`}
                        >
                          <SettingsIcon name={tab.icon} className="h-4 w-4" />
                        </span>
                        {/* Label - fixed layout */}
                        <span className="flex-1 text-left font-medium">{tab.label}</span>
                        {/* Keyboard shortcut hint - always rendered for consistent layout */}
                        <span
                          className={`w-4 flex-shrink-0 text-center text-xs text-gray-600 transition-opacity ${
                            index < 9 ? 'opacity-0 group-hover:opacity-100' : 'invisible'
                          }`}
                        >
                          {index < 9 ? index + 1 : ''}
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </SettingsSidebarContainer>

            {/* Scrollable Content Area - ONLY AREA THAT SCROLLS */}
            <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden pr-4">
                <SettingsTabContainer>
                  <div
                    id={`tabpanel-${activeTab}`}
                    role="tabpanel"
                    aria-labelledby={activeTab}
                    className="animate-fadeIn"
                  >
                    {renderTabContent()}
                  </div>
                </SettingsTabContainer>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
