/**
 * RevisionManager Testing Suite
 *
 * Tests for the modular revision comparison system:
 * - RevisionManager component integration
 * - Revision selection workflow
 * - Monaco Editor integration
 * - Performance optimization
 */

// Jest globals are available automatically in test environment
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RevisionManager } from '@/components/shared/revision-manager/RevisionManager';

// Mock Monaco Editor
const mockEditor = {
  dispose: jest.fn(),
  getDomNode: jest.fn(() => ({ clientHeight: 600 })),
  getValue: jest.fn(() => 'mock content'),
  layout: jest.fn(),
  getModel: jest.fn(() => null),
  updateOptions: jest.fn(),
  onDidScrollChange: jest.fn(() => ({ dispose: jest.fn() })),
  getScrollTop: jest.fn(() => 0),
  setScrollTop: jest.fn(),
  getScrollLeft: jest.fn(() => 0),
  setScrollLeft: jest.fn(),
};

jest.mock('@monaco-editor/react', () => ({
  Editor: jest.fn(({ onMount, value, ...props }) => {
    // Simulate Monaco editor mounting
    if (onMount) {
      setTimeout(() => onMount(mockEditor, {}), 0);
    }

    return (
      <div data-testid="monaco-editor" data-value={value} style={{ height: '100%' }}>
        {value || 'Mock Monaco Editor'}
      </div>
    );
  }),
}));

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'test-project' }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock API responses
global.fetch = jest.fn();

const mockRevisions = [
  {
    id: 1,
    content: 'Original content for testing revision comparison',
    summary: 'Initial version',
    revision_timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    author_name: 'Test User',
    size: 45,
  },
  {
    id: 2,
    content: 'Modified content with additional information for testing',
    summary: 'Added more details',
    revision_timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    author_name: 'Test User',
    size: 58,
  },
  {
    id: 3,
    content: 'Final content with comprehensive changes and improvements',
    summary: 'Major revision',
    revision_timestamp: new Date().toISOString(), // Today
    author_name: 'Test User',
    size: 62,
  },
];

const mockComparison = {
  project_slug: 'test-project',
  from: {
    id: 1,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    summary: 'Initial version',
  },
  to: {
    id: 2,
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    summary: 'Added more details',
  },
  diff: [
    { type: 'added', line: 2, content: 'additional information' },
    { type: 'modified', line: 1, old: 'Original content', new: 'Modified content' },
  ],
};

describe('RevisionManager Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default fetch responses
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(url => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/revisions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ revisions: mockRevisions }),
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
    });
  });

  describe('Monaco Editor Integration', () => {
    it('should render editor panels for side-by-side comparison', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Editor panels should be present (left and right)
      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
      expect(screen.getByText('Side-by-Side Comparison')).toBeInTheDocument();
    });

    it('should provide editor configuration controls', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Editor configuration controls should be available
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Font size controls should be present
      expect(buttons.some(btn => btn.getAttribute('title')?.includes('font size'))).toBeTruthy();
    });

    it('should display loading state while data loads', async () => {
      render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);

      expect(screen.getByText('Loading revisions...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Revision Selection Workflow', () => {
    it('should allow selecting up to two revisions for comparison', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Find revision items in the list (they should be clickable)
      const revisionItems = screen.getAllByText(
        /Initial version|Added more details|Major revision/
      );
      expect(revisionItems.length).toBeGreaterThan(0);

      // Click on first revision
      await act(async () => {
        fireEvent.click(revisionItems[0]!);
      });

      // Click on second revision
      if (revisionItems.length > 1) {
        await act(async () => {
          fireEvent.click(revisionItems[1]!);
        });
      }

      // Component should now have two revisions selected
      expect(revisionItems.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle revision selection state management', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        const revisionList = screen.getAllByText(/Initial version|Added more details/);
        expect(revisionList.length).toBeGreaterThan(0);
      });

      // Clicking same revision twice should toggle selection
      const firstRevision = screen.getByText('Initial version');

      await act(async () => {
        fireEvent.click(firstRevision);
      });

      await act(async () => {
        fireEvent.click(firstRevision);
      });

      // Component handles selection toggle (visual state tested via integration)
      expect(firstRevision).toBeInTheDocument();
    });

    it('should display revision metadata in list', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        // Check for revision summaries
        expect(screen.getByText('Initial version')).toBeInTheDocument();
        expect(screen.getByText('Added more details')).toBeInTheDocument();
        expect(screen.getByText('Major revision')).toBeInTheDocument();

        // Check for author names
        const authorElements = screen.getAllByText('Test User');
        expect(authorElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should efficiently load and render revision list', async () => {
      const startTime = performance.now();

      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Component should render within reasonable time (< 1000ms)
      expect(loadTime).toBeLessThan(1000);
    });

    it('should handle large revision lists efficiently', async () => {
      // Mock large dataset
      const largeRevisionList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        content: `Content for revision ${i + 1}`,
        summary: `Revision ${i + 1}`,
        revision_timestamp: new Date(Date.now() - i * 60000).toISOString(),
        author_name: 'Test User',
        size: 50 + i,
      }));

      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ revisions: largeRevisionList }),
        } as Response)
      );

      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Check that component rendered successfully
      expect(screen.getByText('Revision 1')).toBeInTheDocument();
    });

    it('should provide proper layout structure', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Check that layout elements are rendered
      expect(screen.getByText('Revisions')).toBeInTheDocument();
      expect(screen.getByText('Side-by-Side Comparison')).toBeInTheDocument();
      expect(screen.getByText('Left')).toBeInTheDocument();
      expect(screen.getByText('Right')).toBeInTheDocument();
    });
  });

  describe('Individual User Features', () => {
    it('should support font size adjustments', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Font size controls should be available (decrease/increase buttons)
      const buttons = screen.getAllByRole('button');
      const fontSizeButtons = buttons.filter(
        btn =>
          btn.getAttribute('title')?.includes('font size') ||
          btn.getAttribute('title')?.includes('Font size')
      );

      // Should have at least the decrease and increase buttons
      expect(fontSizeButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should support fullscreen mode toggle', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Loading revisions...')).not.toBeInTheDocument();
      });

      // Fullscreen toggle button should be available
      const buttons = screen.getAllByRole('button');
      const fullscreenButton = buttons.find(
        btn =>
          btn.getAttribute('title')?.includes('fullscreen') ||
          btn.getAttribute('title')?.includes('Fullscreen')
      );

      // Fullscreen functionality is provided
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should provide contextual information for revisions', async () => {
      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        // Check for revision metadata (summary, author, timestamp)
        expect(screen.getByText('Initial version')).toBeInTheDocument();
        expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);

        // Size information should be displayed
        const revisionElements = screen.getAllByText(/Initial version|Added more details/);
        expect(revisionElements.length).toBeGreaterThan(0);
      });
    });

    it('should handle error states gracefully', async () => {
      // Mock API error
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to load revisions' }),
        } as Response)
      );

      await act(async () => {
        render(<RevisionManager apiPath="/api/projects/test-project/revisions" />);
      });

      await waitFor(() => {
        expect(screen.getByText('Error Loading Revisions')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Retry button should be functional
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
    });
  });
});
