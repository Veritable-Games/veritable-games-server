import Link from 'next/link';
import { dbAdapter } from '@/lib/database/adapter';
import { EditableDescription } from '@/components/ui/EditableDescription';
import { logger } from '@/lib/utils/logger';

// Force dynamic rendering for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Project {
  id: number;
  title: string;
  slug: string;
  status: string;
  description: string;
  category: string;
  color: string;
  display_order: number;
  is_universal_system: number | boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Server-side data fetching - no API route needed
 */
async function getProjects(): Promise<{
  games: Project[];
  systems: Project[];
}> {
  try {
    const result = await dbAdapter.query(
      `
      SELECT * FROM projects
      ORDER BY display_order ASC, created_at ASC
    `,
      [],
      { schema: 'content' }
    );

    const allProjects = result.rows as Project[];

    // Process boolean fields (PostgreSQL returns true/false, SQLite stores as 0/1)
    const processed = allProjects.map(p => ({
      ...p,
      is_universal_system: Boolean(p.is_universal_system),
    }));

    // Separate games and universal systems
    const games = processed.filter(p => !p.is_universal_system);
    const systems = processed.filter(p => p.is_universal_system);

    return { games, systems };
  } catch (error) {
    logger.error('Error fetching projects:', error);
    // Return empty arrays on error instead of throwing
    return { games: [], systems: [] };
  }
}

/**
 * Projects listing page - Server Component for instant rendering
 */
export default async function ProjectsPage() {
  const { games, systems } = await getProjects();

  return (
    <div className="relative mx-auto flex h-full max-w-5xl flex-col overflow-hidden px-8 py-6">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-white">Our Projects</h1>
        <div className="hidden md:block">
          <EditableDescription
            pageKey="projects"
            initialText="Explore our portfolio of games and interactive experiences currently in development."
            className="text-lg text-gray-300"
          />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto pr-0 [scrollbar-width:none] md:pr-4 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block"
        id="projects-scroll-container"
      >
        {/* Games Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map(project => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="block rounded border border-gray-700 bg-gray-900/70 p-4 transition-colors hover:bg-gray-800/80"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-xl font-bold text-white">{project.title}</h3>
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white"
                  style={{ backgroundColor: project.color }}
                >
                  {project.category}
                </span>
              </div>

              <div className="mb-3">
                <span className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300">
                  {project.status}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-gray-300">{project.description}</p>
            </Link>
          ))}
        </div>

        {/* Universal Systems Section */}
        {systems.length > 0 && (
          <div className="mt-8 border-t border-gray-700 pt-6">
            <h2 className="mb-3 text-2xl font-bold text-white">Universal Systems</h2>
            <p className="mb-6 text-gray-300">
              Core systems designed for integration across multiple projects, providing consistent
              interaction frameworks and world organization tools.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              {systems.map(system => (
                <Link
                  key={system.id}
                  href={`/projects/${system.slug}`}
                  className="block rounded border border-gray-700 bg-gray-900/70 p-4 transition-colors hover:bg-gray-800/80"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="text-xl font-bold text-white">{system.title}</h3>
                    {/* Skip category badge if it would just say "Universal System" - redundant in this section */}
                    {system.category !== 'Universal System' && (
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white"
                        style={{ backgroundColor: system.color }}
                      >
                        {system.category}
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <span className="rounded border border-gray-600 bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300">
                      {system.status}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-gray-300">{system.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
