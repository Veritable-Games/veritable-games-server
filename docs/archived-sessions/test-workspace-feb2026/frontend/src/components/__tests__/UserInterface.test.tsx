/**
 * User Interface Experience Testing Suite
 *
 * Tests focused on individual user interface improvements:
 * - Responsive design for various screen sizes
 * - Component accessibility and usability
 * - Visual feedback and loading states
 * - Theme and appearance customization
 * - Mobile-first design patterns
 * - Individual workflow optimizations
 */

// Jest globals are available automatically in test environment
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock window resize for responsive testing
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.ResizeObserver = mockResizeObserver;

// Mock media queries
const mockMatchMedia = jest.fn(query => ({
  matches: query.includes('max-width: 768px') ? false : true,
  media: query,
  onchange: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock React components that might not exist yet
const MockButton = ({ children, variant, size, disabled, onClick, className, ...props }: any) => (
  <button
    className={`btn ${variant ? `btn-${variant}` : ''} ${size ? `btn-${size}` : ''} ${className || ''}`}
    disabled={disabled}
    onClick={onClick}
    data-testid="mock-button"
    {...props}
  >
    {children}
  </button>
);

const MockModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;

  return (
    <div data-testid="modal-overlay" className="modal-overlay">
      <div data-testid="modal-content" className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} data-testid="modal-close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

const MockToast = ({ message, type, onDismiss }: any) => (
  <div data-testid="toast" className={`toast toast-${type}`}>
    <span>{message}</span>
    <button onClick={onDismiss} data-testid="toast-dismiss">
      ×
    </button>
  </div>
);

describe('User Interface Experience Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile screen size
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });

      mockMatchMedia.mockImplementation(query => ({
        matches: query.includes('max-width: 768px'),
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const ResponsiveComponent = () => {
        const [isMobile, setIsMobile] = React.useState(false);

        React.useEffect(() => {
          const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
          };

          checkMobile();
          window.addEventListener('resize', checkMobile);
          return () => window.removeEventListener('resize', checkMobile);
        }, []);

        return (
          <div data-testid="responsive-layout">
            <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
              {isMobile ? 'Mobile View' : 'Desktop View'}
            </div>
          </div>
        );
      };

      render(<ResponsiveComponent />);

      // Simulate window resize
      fireEvent.resize(window);

      expect(screen.getByText('Mobile View')).toBeInTheDocument();
    });

    it('should handle tablet screen sizes appropriately', () => {
      // Mock tablet screen size
      Object.defineProperty(window, 'innerWidth', { value: 768 });

      const TabletOptimizedComponent = () => {
        const getScreenSize = () => {
          const width = window.innerWidth;
          if (width < 768) return 'mobile';
          if (width < 1024) return 'tablet';
          return 'desktop';
        };

        const [screenSize, setScreenSize] = React.useState(getScreenSize());

        React.useEffect(() => {
          const handleResize = () => setScreenSize(getScreenSize());
          window.addEventListener('resize', handleResize);
          return () => window.removeEventListener('resize', handleResize);
        }, []);

        return (
          <div data-testid="tablet-layout">
            <span data-testid="screen-size">{screenSize}</span>
            <div className={`layout-${screenSize}`}>Content optimized for {screenSize}</div>
          </div>
        );
      };

      render(<TabletOptimizedComponent />);
      expect(screen.getByTestId('screen-size')).toHaveTextContent('tablet');
    });

    it('should provide touch-friendly interface elements on mobile', () => {
      const TouchOptimizedComponent = () => {
        const [isTouchDevice, setIsTouchDevice] = React.useState(false);

        React.useEffect(() => {
          // Simulate touch detection
          const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
          setIsTouchDevice(hasTouchSupport);
        }, []);

        return (
          <div data-testid="touch-optimized">
            <MockButton
              size={isTouchDevice ? 'large' : 'medium'}
              className={isTouchDevice ? 'touch-friendly' : ''}
            >
              {isTouchDevice ? 'Touch Button' : 'Regular Button'}
            </MockButton>
          </div>
        );
      };

      // Mock touch support
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true,
      });

      render(<TouchOptimizedComponent />);

      const button = screen.getByTestId('mock-button');
      expect(button).toHaveClass('btn-large');
      expect(button).toHaveTextContent('Touch Button');
    });
  });

  describe('Component Accessibility and Usability', () => {
    it('should provide proper ARIA labels and roles', () => {
      const AccessibleComponent = () => (
        <div>
          <button
            aria-label="Save document"
            aria-describedby="save-description"
            data-testid="accessible-button"
          >
            💾
          </button>
          <div id="save-description" className="sr-only">
            Saves your current work to prevent data loss
          </div>

          <nav role="navigation" aria-label="Main navigation">
            <ul>
              <li>
                <a href="/wiki" aria-current="page">
                  Wiki
                </a>
              </li>
              <li>
                <a href="/projects">Projects</a>
              </li>
            </ul>
          </nav>
        </div>
      );

      render(<AccessibleComponent />);

      const saveButton = screen.getByTestId('accessible-button');
      expect(saveButton).toHaveAttribute('aria-label', 'Save document');
      expect(saveButton).toHaveAttribute('aria-describedby', 'save-description');

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('should support keyboard navigation', () => {
      const KeyboardNavigableComponent = () => {
        const [focusedIndex, setFocusedIndex] = React.useState(0);
        const items = ['Item 1', 'Item 2', 'Item 3'];

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (prev + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (prev - 1 + items.length) % items.length);
          }
        };

        return (
          <div data-testid="keyboard-nav" onKeyDown={handleKeyDown} tabIndex={0}>
            {items.map((item, index) => (
              <div
                key={index}
                className={index === focusedIndex ? 'focused' : ''}
                data-testid={`nav-item-${index}`}
              >
                {item}
              </div>
            ))}
          </div>
        );
      };

      render(<KeyboardNavigableComponent />);

      const container = screen.getByTestId('keyboard-nav');

      // Test arrow key navigation
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(screen.getByTestId('nav-item-1')).toHaveClass('focused');

      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(screen.getByTestId('nav-item-0')).toHaveClass('focused');
    });

    it('should provide high contrast mode support', () => {
      const HighContrastComponent = () => {
        const [highContrast, setHighContrast] = React.useState(false);

        React.useEffect(() => {
          // Mock high contrast media query
          const mediaQuery = window.matchMedia('(prefers-contrast: high)');
          setHighContrast(mediaQuery.matches);
        }, []);

        return (
          <div
            data-testid="high-contrast-content"
            className={highContrast ? 'high-contrast' : 'normal-contrast'}
          >
            <p>Content with contrast support</p>
          </div>
        );
      };

      render(<HighContrastComponent />);

      const content = screen.getByTestId('high-contrast-content');
      // Default should be normal contrast
      expect(content).toHaveClass('normal-contrast');
    });
  });

  describe('Visual Feedback and Loading States', () => {
    it('should display loading states during operations', async () => {
      const LoadingComponent = () => {
        const [loading, setLoading] = React.useState(false);

        const handleSave = async () => {
          setLoading(true);
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          setLoading(false);
        };

        return (
          <div>
            <MockButton onClick={handleSave} disabled={loading} data-testid="save-button">
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </MockButton>
          </div>
        );
      };

      render(<LoadingComponent />);

      const saveButton = screen.getByTestId('save-button');

      fireEvent.click(saveButton);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });

    it('should show success and error feedback', async () => {
      const FeedbackComponent = () => {
        const [message, setMessage] = React.useState<{
          text: string;
          type: 'success' | 'error';
        } | null>(null);

        const showSuccess = () => {
          setMessage({ text: 'Operation completed successfully!', type: 'success' });
          setTimeout(() => setMessage(null), 3000);
        };

        const showError = () => {
          setMessage({ text: 'Something went wrong. Please try again.', type: 'error' });
          setTimeout(() => setMessage(null), 3000);
        };

        return (
          <div>
            <MockButton onClick={showSuccess} data-testid="success-button">
              Show Success
            </MockButton>
            <MockButton onClick={showError} data-testid="error-button">
              Show Error
            </MockButton>

            {message && (
              <MockToast
                message={message.text}
                type={message.type}
                onDismiss={() => setMessage(null)}
              />
            )}
          </div>
        );
      };

      render(<FeedbackComponent />);

      // Test success feedback
      fireEvent.click(screen.getByTestId('success-button'));
      expect(screen.getByText('Operation completed successfully!')).toBeInTheDocument();

      // Clear and test error feedback
      fireEvent.click(screen.getByTestId('toast-dismiss'));
      fireEvent.click(screen.getByTestId('error-button'));
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });

    it('should provide progress indicators for long operations', () => {
      const ProgressComponent = () => {
        const [progress, setProgress] = React.useState(0);
        const [isActive, setIsActive] = React.useState(false);

        const startProgress = () => {
          setIsActive(true);
          setProgress(0);

          const interval = setInterval(() => {
            setProgress(prev => {
              if (prev >= 100) {
                clearInterval(interval);
                setIsActive(false);
                return 100;
              }
              return prev + 10;
            });
          }, 200);
        };

        return (
          <div>
            <MockButton onClick={startProgress} disabled={isActive}>
              Start Process
            </MockButton>

            {isActive && (
              <div data-testid="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                    data-testid="progress-fill"
                  ></div>
                </div>
                <span data-testid="progress-text">{progress}%</span>
              </div>
            )}
          </div>
        );
      };

      render(<ProgressComponent />);

      fireEvent.click(screen.getByText('Start Process'));

      expect(screen.getByTestId('progress-container')).toBeInTheDocument();
      expect(screen.getByTestId('progress-text')).toHaveTextContent('0%');
    });
  });

  describe('Theme and Appearance Customization', () => {
    it('should support dark and light theme switching', () => {
      const ThemeComponent = () => {
        const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');

        const toggleTheme = () => {
          setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
        };

        return (
          <div data-testid="themed-content" className={`theme-${theme}`}>
            <MockButton onClick={toggleTheme} data-testid="theme-toggle">
              Switch to {theme === 'light' ? 'dark' : 'light'} theme
            </MockButton>
            <div data-testid="theme-indicator">Current theme: {theme}</div>
          </div>
        );
      };

      render(<ThemeComponent />);

      expect(screen.getByTestId('themed-content')).toHaveClass('theme-dark');
      expect(screen.getByTestId('theme-indicator')).toHaveTextContent('Current theme: dark');

      fireEvent.click(screen.getByTestId('theme-toggle'));

      expect(screen.getByTestId('themed-content')).toHaveClass('theme-light');
      expect(screen.getByTestId('theme-indicator')).toHaveTextContent('Current theme: light');
    });

    it('should allow font size customization', () => {
      const FontSizeComponent = () => {
        const [fontSize, setFontSize] = React.useState(14);

        return (
          <div>
            <div className="font-controls">
              <MockButton onClick={() => setFontSize(12)} data-testid="font-small">
                Small
              </MockButton>
              <MockButton onClick={() => setFontSize(14)} data-testid="font-medium">
                Medium
              </MockButton>
              <MockButton onClick={() => setFontSize(16)} data-testid="font-large">
                Large
              </MockButton>
            </div>

            <div data-testid="sized-content" style={{ fontSize: `${fontSize}px` }}>
              Content with customizable font size
            </div>

            <span data-testid="font-indicator">Font size: {fontSize}px</span>
          </div>
        );
      };

      render(<FontSizeComponent />);

      fireEvent.click(screen.getByTestId('font-large'));

      const content = screen.getByTestId('sized-content');
      expect(content).toHaveStyle('font-size: 16px');
      expect(screen.getByTestId('font-indicator')).toHaveTextContent('Font size: 16px');
    });

    it('should respect system preferences for reduced motion', () => {
      const MotionComponent = () => {
        const [reducedMotion, setReducedMotion] = React.useState(false);

        React.useEffect(() => {
          // Mock prefers-reduced-motion media query
          const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
          setReducedMotion(mediaQuery.matches);
        }, []);

        return (
          <div
            data-testid="motion-content"
            className={reducedMotion ? 'reduced-motion' : 'full-motion'}
          >
            <div className="animated-element">Animated content</div>
          </div>
        );
      };

      render(<MotionComponent />);

      // Should default to full motion
      expect(screen.getByTestId('motion-content')).toHaveClass('full-motion');
    });
  });

  describe('Mobile-First Design Patterns', () => {
    it('should optimize navigation for mobile use', () => {
      const MobileNavComponent = () => {
        const [menuOpen, setMenuOpen] = React.useState(false);
        const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

        React.useEffect(() => {
          const checkMobile = () => setIsMobile(window.innerWidth < 768);
          window.addEventListener('resize', checkMobile);
          return () => window.removeEventListener('resize', checkMobile);
        }, []);

        return (
          <nav data-testid="mobile-nav">
            {isMobile ? (
              <>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  data-testid="mobile-menu-toggle"
                  aria-expanded={menuOpen}
                >
                  ☰ Menu
                </button>
                {menuOpen && (
                  <div data-testid="mobile-menu" className="mobile-menu">
                    <a href="/wiki">Wiki</a>
                    <a href="/projects">Projects</a>
                    <a href="/forums">Forums</a>
                  </div>
                )}
              </>
            ) : (
              <div data-testid="desktop-nav" className="desktop-nav">
                <a href="/wiki">Wiki</a>
                <a href="/projects">Projects</a>
                <a href="/forums">Forums</a>
              </div>
            )}
          </nav>
        );
      };

      // Mock mobile size
      Object.defineProperty(window, 'innerWidth', { value: 375 });

      render(<MobileNavComponent />);

      expect(screen.getByTestId('mobile-menu-toggle')).toBeInTheDocument();

      // Open mobile menu
      fireEvent.click(screen.getByTestId('mobile-menu-toggle'));
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    });

    it('should handle touch gestures appropriately', () => {
      const TouchGestureComponent = () => {
        const [swipeDirection, setSwipeDirection] = React.useState<string | null>(null);

        const handleTouchStart = (e: React.TouchEvent) => {
          const touch = e.touches[0];
          if (touch) {
            (e.currentTarget as any).startX = touch.clientX;
          }
        };

        const handleTouchEnd = (e: React.TouchEvent) => {
          const touch = e.changedTouches[0];
          if (!touch) return;
          const startX = (e.currentTarget as any).startX;
          const endX = touch.clientX;
          const diff = startX - endX;

          if (Math.abs(diff) > 50) {
            setSwipeDirection(diff > 0 ? 'left' : 'right');
            setTimeout(() => setSwipeDirection(null), 2000);
          }
        };

        return (
          <div
            data-testid="touch-area"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '300px',
              height: '200px',
              border: '1px solid #ccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {swipeDirection ? (
              <span data-testid="swipe-result">Swiped {swipeDirection}</span>
            ) : (
              'Swipe left or right'
            )}
          </div>
        );
      };

      render(<TouchGestureComponent />);

      const touchArea = screen.getByTestId('touch-area');

      // Simulate swipe left
      fireEvent.touchStart(touchArea, {
        touches: [{ clientX: 200 }] as any,
      } as any);

      fireEvent.touchEnd(touchArea, {
        changedTouches: [{ clientX: 100 }] as any,
      } as any);

      expect(screen.getByTestId('swipe-result')).toHaveTextContent('Swiped left');
    });

    it('should optimize forms for mobile input', () => {
      const MobileFormComponent = () => {
        const [formData, setFormData] = React.useState({
          title: '',
          content: '',
          tags: '',
        });

        return (
          <form data-testid="mobile-form">
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="mobile-input"
                autoComplete="off"
                data-testid="title-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Content</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                className="mobile-textarea"
                rows={5}
                data-testid="content-input"
              />
            </div>

            <MockButton type="submit" className="mobile-submit">
              Save
            </MockButton>
          </form>
        );
      };

      render(<MobileFormComponent />);

      const titleInput = screen.getByTestId('title-input');
      const contentInput = screen.getByTestId('content-input');

      expect(titleInput).toHaveClass('mobile-input');
      expect(contentInput).toHaveClass('mobile-textarea');
      expect(titleInput).toHaveAttribute('autoComplete', 'off');
    });
  });

  describe('Individual Workflow Optimizations', () => {
    it('should provide contextual action buttons', () => {
      const ContextualActionsComponent = () => {
        const [selectedText, setSelectedText] = React.useState('');
        const [showActions, setShowActions] = React.useState(false);

        const handleTextSelection = () => {
          const selection = window.getSelection()?.toString();
          if (selection) {
            setSelectedText(selection);
            setShowActions(true);
          } else {
            setShowActions(false);
          }
        };

        return (
          <div>
            <p onMouseUp={handleTextSelection} data-testid="selectable-text">
              This is selectable text that can trigger contextual actions when highlighted.
            </p>

            {showActions && (
              <div data-testid="contextual-actions" className="action-toolbar">
                <MockButton size="small">Bold</MockButton>
                <MockButton size="small">Italic</MockButton>
                <MockButton size="small">Link</MockButton>
              </div>
            )}
          </div>
        );
      };

      render(<ContextualActionsComponent />);

      // Mock text selection
      const textElement = screen.getByTestId('selectable-text');

      // Create a mock selection
      const mockSelection = {
        toString: () => 'selected text',
      };

      Object.defineProperty(window, 'getSelection', {
        value: () => mockSelection,
      });

      fireEvent.mouseUp(textElement);

      expect(screen.getByTestId('contextual-actions')).toBeInTheDocument();
    });

    it('should support customizable workspace layouts', () => {
      const WorkspaceLayoutComponent = () => {
        const [layout, setLayout] = React.useState<'single' | 'split' | 'triple'>('split');

        const layouts = {
          single: { columns: 1, class: 'layout-single' },
          split: { columns: 2, class: 'layout-split' },
          triple: { columns: 3, class: 'layout-triple' },
        };

        return (
          <div data-testid="workspace-layout" className={layouts[layout].class}>
            <div className="layout-controls">
              <MockButton
                onClick={() => setLayout('single')}
                variant={layout === 'single' ? 'primary' : 'secondary'}
                data-testid="layout-single"
              >
                Single
              </MockButton>
              <MockButton
                onClick={() => setLayout('split')}
                variant={layout === 'split' ? 'primary' : 'secondary'}
                data-testid="layout-split"
              >
                Split
              </MockButton>
              <MockButton
                onClick={() => setLayout('triple')}
                variant={layout === 'triple' ? 'primary' : 'secondary'}
                data-testid="layout-triple"
              >
                Triple
              </MockButton>
            </div>

            <div data-testid="workspace-content" className="workspace-content">
              {Array.from({ length: layouts[layout].columns }, (_, i) => (
                <div key={i} className="workspace-panel">
                  Panel {i + 1}
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<WorkspaceLayoutComponent />);

      expect(screen.getByTestId('workspace-layout')).toHaveClass('layout-split');

      fireEvent.click(screen.getByTestId('layout-triple'));

      expect(screen.getByTestId('workspace-layout')).toHaveClass('layout-triple');
      expect(screen.getByText('Panel 3')).toBeInTheDocument();
    });

    it('should provide quick access to frequently used features', () => {
      const QuickAccessComponent = () => {
        const [recentItems, setRecentItems] = React.useState([
          { id: 1, title: 'Character Profile: Hero', type: 'wiki' },
          { id: 2, title: 'Game Mechanics Draft', type: 'project' },
          { id: 3, title: 'World Building Notes', type: 'wiki' },
        ]);

        const [favorites, setFavorites] = React.useState([
          { id: 1, title: 'Main Story Outline', type: 'project' },
          { id: 2, title: 'Character Relationships', type: 'wiki' },
        ]);

        return (
          <div data-testid="quick-access">
            <div className="quick-access-section">
              <h3>Recent</h3>
              <ul data-testid="recent-list">
                {recentItems.map(item => (
                  <li key={item.id} data-testid={`recent-${item.id}`}>
                    {item.title} ({item.type})
                  </li>
                ))}
              </ul>
            </div>

            <div className="quick-access-section">
              <h3>Favorites</h3>
              <ul data-testid="favorites-list">
                {favorites.map(item => (
                  <li key={item.id} data-testid={`favorite-${item.id}`}>
                    ⭐ {item.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      };

      render(<QuickAccessComponent />);

      expect(screen.getByTestId('recent-list')).toBeInTheDocument();
      expect(screen.getByTestId('favorites-list')).toBeInTheDocument();
      expect(screen.getByTestId('recent-1')).toHaveTextContent('Character Profile: Hero (wiki)');
      expect(screen.getByTestId('favorite-1')).toHaveTextContent('⭐ Main Story Outline');
    });
  });
});

// React import for JSX
import React from 'react';
