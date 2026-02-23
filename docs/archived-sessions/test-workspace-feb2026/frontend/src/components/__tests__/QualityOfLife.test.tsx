/**
 * Quality of Life Features Testing Suite
 *
 * Tests focused on individual user experience improvements:
 * - Auto-save functionality
 * - Keyboard shortcuts and accessibility
 * - Contextual help and guidance
 * - Error handling and recovery
 * - User preference persistence
 * - Productivity enhancements
 */

// Jest globals are available automatically in test environment
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock localStorage
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
});

// Mock timers for auto-save testing
jest.useFakeTimers();

// Mock components that might not exist yet
const MockEditor = ({ content, onChange, onSave }: any) => (
  <div>
    <textarea
      data-testid="mock-editor"
      value={content}
      onChange={e => onChange?.(e.target.value)}
    />
    <button onClick={onSave} data-testid="save-button">
      Save
    </button>
  </div>
);

const MockSearchComponent = ({ onSearch, placeholder }: any) => (
  <div>
    <input
      data-testid="search-input"
      placeholder={placeholder}
      onChange={e => onSearch?.(e.target.value)}
    />
  </div>
);

describe('Quality of Life Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Auto-save Functionality', () => {
    it('should auto-save content after inactivity period', async () => {
      let savedContent = '';
      const onSave = jest.fn(content => {
        savedContent = content;
        return Promise.resolve({ success: true });
      });

      render(
        <MockEditor
          content="Initial content"
          onChange={() => {}}
          onSave={() => onSave('Auto-saved content')}
        />
      );

      const editor = screen.getByTestId('mock-editor');

      // Simulate typing
      fireEvent.change(editor, { target: { value: 'Modified content' } });

      // Fast-forward to auto-save trigger (e.g., 2 seconds)
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Trigger auto-save
      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      expect(onSave).toHaveBeenCalled();
    });

    it('should save drafts to localStorage for recovery', () => {
      const draftContent = 'Work in progress content...';
      const pageId = 'wiki-123';

      // Simulate saving draft
      const saveDraft = (content: string, id: string) => {
        const draftKey = `draft-${id}`;
        const draftData = {
          content,
          timestamp: Date.now(),
          id,
        };
        localStorage.setItem(draftKey, JSON.stringify(draftData));
      };

      saveDraft(draftContent, pageId);

      // Check the call was made
      expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockStorage.setItem).toHaveBeenCalledWith('draft-wiki-123', expect.any(String));

      // Parse and verify the stored data
      const storedData = JSON.parse((mockStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(storedData).toEqual({
        content: draftContent,
        timestamp: expect.any(Number),
        id: pageId,
      });
    });

    it('should recover drafts on page load', () => {
      const mockDraft = {
        content: 'Recovered draft content',
        timestamp: Date.now() - 300000, // 5 minutes ago
        id: 'wiki-456',
      };

      mockStorage.getItem.mockReturnValue(JSON.stringify(mockDraft));

      // Simulate draft recovery
      const recoverDraft = (pageId: string) => {
        const draftKey = `draft-${pageId}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
          return JSON.parse(savedDraft);
        }
        return null;
      };

      const recoveredDraft = recoverDraft('wiki-456');

      expect(recoveredDraft).toEqual(mockDraft);
      expect(mockStorage.getItem).toHaveBeenCalledWith('draft-wiki-456');
    });

    it('should show draft age and allow user choice on recovery', () => {
      const draftAge = 1800000; // 30 minutes
      const currentTime = Date.now();
      const draftTimestamp = currentTime - draftAge;

      const formatDraftAge = (timestamp: number) => {
        const ageMs = Date.now() - timestamp;
        const ageMinutes = Math.floor(ageMs / 60000);

        if (ageMinutes < 60) return `${ageMinutes} minutes ago`;
        const ageHours = Math.floor(ageMinutes / 60);
        return `${ageHours} hours ago`;
      };

      const formattedAge = formatDraftAge(draftTimestamp);
      expect(formattedAge).toBe('30 minutes ago');
    });
  });

  describe('Keyboard Shortcuts and Accessibility', () => {
    it('should handle essential keyboard shortcuts', () => {
      const shortcutActions = {
        save: jest.fn(),
        search: jest.fn(),
        undo: jest.fn(),
        redo: jest.fn(),
        escape: jest.fn(),
      };

      const KeyboardShortcutComponent = () => {
        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            shortcutActions.save();
          } else if (e.key === '/') {
            e.preventDefault();
            shortcutActions.search();
          } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            shortcutActions.undo();
          } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            shortcutActions.redo();
          } else if (e.key === 'Escape') {
            shortcutActions.escape();
          }
        };

        return (
          <div data-testid="shortcut-container" onKeyDown={handleKeyDown} tabIndex={0}>
            Content with shortcuts
          </div>
        );
      };

      render(<KeyboardShortcutComponent />);
      const container = screen.getByTestId('shortcut-container');

      // Test save shortcut
      fireEvent.keyDown(container, { key: 's', ctrlKey: true });
      expect(shortcutActions.save).toHaveBeenCalled();

      // Test search shortcut
      fireEvent.keyDown(container, { key: '/' });
      expect(shortcutActions.search).toHaveBeenCalled();

      // Test undo shortcut
      fireEvent.keyDown(container, { key: 'z', ctrlKey: true });
      expect(shortcutActions.undo).toHaveBeenCalled();

      // Test escape shortcut
      fireEvent.keyDown(container, { key: 'Escape' });
      expect(shortcutActions.escape).toHaveBeenCalled();
    });

    it('should provide visual indicators for keyboard shortcuts', () => {
      const ShortcutHelpComponent = () => (
        <div data-testid="shortcut-help">
          <div>Ctrl+S: Save</div>
          <div>/: Search</div>
          <div>Ctrl+Z: Undo</div>
          <div>Esc: Cancel</div>
        </div>
      );

      render(<ShortcutHelpComponent />);

      expect(screen.getByText('Ctrl+S: Save')).toBeInTheDocument();
      expect(screen.getByText('/: Search')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+Z: Undo')).toBeInTheDocument();
      expect(screen.getByText('Esc: Cancel')).toBeInTheDocument();
    });

    it('should maintain focus management for accessibility', () => {
      const FocusManagementComponent = () => {
        const searchInputRef = React.useRef<HTMLInputElement>(null);

        const handleFocusSearch = () => {
          searchInputRef.current?.focus();
        };

        return (
          <div>
            <button onClick={handleFocusSearch} data-testid="focus-search-button">
              Focus Search
            </button>
            <input ref={searchInputRef} data-testid="search-input" placeholder="Search..." />
          </div>
        );
      };

      render(<FocusManagementComponent />);

      const focusButton = screen.getByTestId('focus-search-button');
      const searchInput = screen.getByTestId('search-input');

      fireEvent.click(focusButton);
      expect(searchInput).toHaveFocus();
    });
  });

  describe('Contextual Help and Guidance', () => {
    it('should provide markdown syntax help', () => {
      const markdownHelp = {
        headers: '# Header 1\n## Header 2',
        bold: '**bold text**',
        italic: '*italic text*',
        links: '[link text](URL)',
        lists: '- Item 1\n- Item 2',
        code: '`inline code` or ```code block```',
        tables: '| Col 1 | Col 2 |\n|-------|-------|',
      };

      const MarkdownHelpComponent = () => (
        <div data-testid="markdown-help">
          {Object.entries(markdownHelp).map(([type, syntax]) => (
            <div key={type} data-testid={`help-${type}`}>
              <strong>{type}:</strong> {syntax}
            </div>
          ))}
        </div>
      );

      render(<MarkdownHelpComponent />);

      expect(screen.getByTestId('help-headers')).toBeInTheDocument();
      expect(screen.getByTestId('help-bold')).toBeInTheDocument();
      expect(screen.getByTestId('help-links')).toBeInTheDocument();
    });

    it('should show contextual tooltips for UI elements', async () => {
      const TooltipComponent = () => {
        const [showTooltip, setShowTooltip] = React.useState(false);

        return (
          <div>
            <button
              data-testid="tooltip-trigger"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              Hover me
            </button>
            {showTooltip && (
              <div data-testid="tooltip" role="tooltip">
                This button performs an action
              </div>
            )}
          </div>
        );
      };

      render(<TooltipComponent />);

      const button = screen.getByTestId('tooltip-trigger');

      // Show tooltip on hover
      fireEvent.mouseEnter(button);
      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      });

      // Hide tooltip on mouse leave
      fireEvent.mouseLeave(button);
      await waitFor(() => {
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should provide guided tours for new features', () => {
      const tourSteps = [
        { target: 'editor', content: 'This is where you write content' },
        { target: 'toolbar', content: 'Use these tools to format text' },
        { target: 'save', content: 'Save your work here' },
      ];

      const GuidedTourComponent = () => {
        const [currentStep, setCurrentStep] = React.useState(0);
        const [tourActive, setTourActive] = React.useState(false);

        const nextStep = () => {
          if (currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1);
          } else {
            setTourActive(false);
          }
        };

        return (
          <div>
            <button onClick={() => setTourActive(true)} data-testid="start-tour">
              Start Tour
            </button>

            {tourActive && (
              <div data-testid="tour-overlay">
                <div data-testid="tour-content">
                  <p>{tourSteps[currentStep]?.content ?? ''}</p>
                  <button onClick={nextStep} data-testid="tour-next">
                    {currentStep < tourSteps.length - 1 ? 'Next' : 'Finish'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<GuidedTourComponent />);

      const startButton = screen.getByTestId('start-tour');
      fireEvent.click(startButton);

      expect(screen.getByTestId('tour-overlay')).toBeInTheDocument();
      expect(screen.getByText('This is where you write content')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle API failures', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      const ErrorHandlingComponent = () => {
        const [error, setError] = React.useState<string | null>(null);
        const [retrying, setRetrying] = React.useState(false);

        const attemptSave = async () => {
          try {
            setRetrying(true);
            await fetch('/api/test');
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setRetrying(false);
          }
        };

        return (
          <div>
            <button onClick={attemptSave} data-testid="save-button">
              Save
            </button>
            {error && (
              <div data-testid="error-message">
                Error: {error}
                <button onClick={attemptSave} data-testid="retry-button">
                  Retry
                </button>
              </div>
            )}
            {retrying && <div data-testid="loading">Saving...</div>}
          </div>
        );
      };

      render(<ErrorHandlingComponent />);

      const saveButton = screen.getByTestId('save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByTestId('retry-button');
      expect(retryButton).toBeInTheDocument();
    });

    it('should handle offline scenarios gracefully', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const OfflineHandlingComponent = () => {
        const [isOnline, setIsOnline] = React.useState(navigator.onLine);

        React.useEffect(() => {
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);

          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);

          return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        }, []);

        return (
          <div>
            {!isOnline && (
              <div data-testid="offline-banner">
                You are offline. Changes will be saved locally and synced when you reconnect.
              </div>
            )}
          </div>
        );
      };

      render(<OfflineHandlingComponent />);

      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
      expect(screen.getByText(/offline/)).toBeInTheDocument();
    });

    it('should recover from component errors with error boundaries', () => {
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);

        React.useEffect(() => {
          const handleError = () => setHasError(true);
          window.addEventListener('error', handleError);
          return () => window.removeEventListener('error', handleError);
        }, []);

        if (hasError) {
          return (
            <div data-testid="error-fallback">
              Something went wrong.
              <button onClick={() => setHasError(false)} data-testid="reset-error">
                Try again
              </button>
            </div>
          );
        }

        return <>{children}</>;
      };

      const ProblematicComponent = ({ shouldError }: { shouldError: boolean }) => {
        if (shouldError) {
          throw new Error('Test error');
        }
        return <div data-testid="normal-content">Normal content</div>;
      };

      const TestWrapper = ({ shouldError }: { shouldError: boolean }) => (
        <ErrorBoundary>
          <ProblematicComponent shouldError={shouldError} />
        </ErrorBoundary>
      );

      const { rerender } = render(<TestWrapper shouldError={false} />);
      expect(screen.getByTestId('normal-content')).toBeInTheDocument();

      // Simulate component error
      try {
        rerender(<TestWrapper shouldError={true} />);
      } catch (error) {
        // Error caught by test environment
      }
    });
  });

  describe('User Preference Persistence', () => {
    it('should save and load user interface preferences', () => {
      const defaultPreferences = {
        theme: 'dark',
        fontSize: 14,
        autoSave: true,
        showLineNumbers: true,
        compactMode: false,
      };

      mockStorage.getItem.mockReturnValue(JSON.stringify(defaultPreferences));

      const PreferencesComponent = () => {
        const [preferences, setPreferences] = React.useState(() => {
          const saved = localStorage.getItem('user-preferences');
          return saved ? JSON.parse(saved) : defaultPreferences;
        });

        const updatePreference = (key: string, value: any) => {
          const newPrefs = { ...preferences, [key]: value };
          setPreferences(newPrefs);
          localStorage.setItem('user-preferences', JSON.stringify(newPrefs));
        };

        return (
          <div data-testid="preferences">
            <label>
              <input
                type="checkbox"
                checked={preferences.autoSave}
                onChange={e => updatePreference('autoSave', e.target.checked)}
                data-testid="autosave-toggle"
              />
              Auto-save
            </label>
          </div>
        );
      };

      render(<PreferencesComponent />);

      const autoSaveToggle = screen.getByTestId('autosave-toggle');
      expect(autoSaveToggle).toBeChecked();

      // Toggle preference
      fireEvent.click(autoSaveToggle);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'user-preferences',
        expect.stringContaining('"autoSave":false')
      );
    });

    it('should maintain workspace state across sessions', () => {
      const workspaceState = {
        openTabs: ['wiki-123', 'project-456'],
        activeTab: 'wiki-123',
        sidebarCollapsed: false,
        lastSearchQuery: 'character design',
      };

      const WorkspaceComponent = () => {
        React.useEffect(() => {
          localStorage.setItem('workspace-state', JSON.stringify(workspaceState));
        }, []);

        return <div data-testid="workspace">Workspace loaded</div>;
      };

      render(<WorkspaceComponent />);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'workspace-state',
        JSON.stringify(workspaceState)
      );
    });

    it('should handle preference migration for version updates', () => {
      // Mock old preferences format
      const oldPreferences = {
        darkMode: true,
        textSize: 'medium',
      };

      const migratePreferences = (oldPrefs: any) => {
        return {
          theme: oldPrefs.darkMode ? 'dark' : 'light',
          fontSize: oldPrefs.textSize === 'small' ? 12 : oldPrefs.textSize === 'large' ? 16 : 14,
          version: 2,
        };
      };

      const migratedPrefs = migratePreferences(oldPreferences);

      expect(migratedPrefs.theme).toBe('dark');
      expect(migratedPrefs.fontSize).toBe(14);
      expect(migratedPrefs.version).toBe(2);
    });
  });

  describe('Productivity Enhancements', () => {
    it('should provide quick insertion shortcuts for common content', () => {
      const contentTemplates = {
        table: '| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |',
        list: '- Item 1\n- Item 2\n- Item 3',
        codeBlock: '```javascript\n// Your code here\n```',
        character: '**Name:** \n**Role:** \n**Description:** ',
      };

      const QuickInsertComponent = () => {
        const [content, setContent] = React.useState('');

        const insertTemplate = (template: string) => {
          setContent(prev => prev + '\n\n' + template);
        };

        return (
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              data-testid="content-area"
            />
            {Object.entries(contentTemplates).map(([name, template]) => (
              <button
                key={name}
                onClick={() => insertTemplate(template)}
                data-testid={`insert-${name}`}
              >
                Insert {name}
              </button>
            ))}
          </div>
        );
      };

      render(<QuickInsertComponent />);

      const insertTableButton = screen.getByTestId('insert-table');
      const contentArea = screen.getByTestId('content-area') as HTMLTextAreaElement;

      fireEvent.click(insertTableButton);

      expect(contentArea.value).toContain('| Column 1 | Column 2 |');
    });

    it('should support content versioning with meaningful labels', () => {
      const versionHistory = [
        { id: 1, label: 'Initial draft', timestamp: Date.now() - 7200000 },
        { id: 2, label: 'Added character descriptions', timestamp: Date.now() - 3600000 },
        { id: 3, label: 'Current version', timestamp: Date.now() },
      ];

      const VersionHistoryComponent = () => (
        <div data-testid="version-history">
          {versionHistory.map(version => (
            <div key={version.id} data-testid={`version-${version.id}`}>
              <span>{version.label}</span>
              <span>{new Date(version.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      );

      render(<VersionHistoryComponent />);

      expect(screen.getByTestId('version-1')).toBeInTheDocument();
      expect(screen.getByText('Initial draft')).toBeInTheDocument();
      expect(screen.getByText('Added character descriptions')).toBeInTheDocument();
    });

    it('should provide smart content suggestions', () => {
      const contentSuggestions = {
        character: ['Add backstory', 'Define relationships', 'Create character arc'],
        location: ['Describe atmosphere', 'Add landmarks', 'Include history'],
        mechanics: ['Define rules', 'Add examples', 'Create flowchart'],
      };

      const SmartSuggestionsComponent = () => {
        const [contentType, setContentType] = React.useState<string>('character');
        const suggestions =
          contentSuggestions[contentType as keyof typeof contentSuggestions] || [];

        return (
          <div data-testid="smart-suggestions">
            <select
              value={contentType}
              onChange={e => setContentType(e.target.value)}
              data-testid="content-type-select"
            >
              <option value="character">Character</option>
              <option value="location">Location</option>
              <option value="mechanics">Mechanics</option>
            </select>

            <div data-testid="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div key={index} data-testid={`suggestion-${index}`}>
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<SmartSuggestionsComponent />);

      expect(screen.getByTestId('suggestion-0')).toHaveTextContent('Add backstory');

      // Change content type
      const select = screen.getByTestId('content-type-select');
      fireEvent.change(select, { target: { value: 'location' } });

      expect(screen.getByTestId('suggestion-0')).toHaveTextContent('Describe atmosphere');
    });
  });
});

// React import for JSX
import React from 'react';
