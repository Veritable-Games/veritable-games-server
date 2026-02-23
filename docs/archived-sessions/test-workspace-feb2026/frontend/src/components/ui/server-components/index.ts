// Server Components - No client-side JavaScript required
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './Card';
export { Badge, badgeVariants } from './Badge';
export { Alert, AlertTitle, AlertDescription } from './Alert';
export { default as Skeleton } from './Skeleton';

// Layout Components
// Note: Layout components not yet created - will be added when needed for server-side layouts
// export { ServerLayoutProvider } from '../../layouts/ServerLayoutProvider';
// export { ContentSection, TwoColumnLayout, GridLayout } from '../../layouts/ContentSection';

/**
 * Server Components Index
 *
 * These components are designed to run on the server and require no client-side JavaScript.
 * They are optimized for:
 * - Fast initial page loads
 * - Better SEO performance
 * - Reduced client bundle size
 * - Static content rendering
 *
 * Use these for:
 * - Layout components
 * - Static UI elements
 * - Content presentation
 * - Non-interactive elements
 *
 * For interactive components, use the client components from the main ui folder.
 */
