/**
 * Cache Warming Strategy for Frequently Accessed Data
 * Preloads critical data into cache to improve performance
 */

import { cache } from './index';
import { dbAdapter } from '../database/adapter';
import { logger } from '@/lib/utils/logger';

interface WarmupTask {
  name: string;
  priority: number;
  execute: () => Promise<void>;
  schedule?: string; // Cron expression for scheduled warming
}

/**
 * Session row from auth.sessions table
 */
interface SessionRow {
  user_id: number;
  last_activity: string;
}

/**
 * User row from users.users table (basic profile data)
 */
interface UserRow {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
}

export class CacheWarmer {
  private static instance: CacheWarmer;
  private warmupTasks: WarmupTask[] = [];
  private isWarming = false;
  private warmupStats = {
    lastRun: null as Date | null,
    itemsWarmed: 0,
    errors: 0,
    duration: 0,
  };

  private constructor() {
    this.registerDefaultTasks();
  }

  static getInstance(): CacheWarmer {
    if (!CacheWarmer.instance) {
      CacheWarmer.instance = new CacheWarmer();
    }
    return CacheWarmer.instance;
  }

  /**
   * Register default cache warming tasks
   */
  private registerDefaultTasks() {
    // Wiki home page content
    this.registerTask({
      name: 'wiki-homepage',
      priority: 9,
      execute: async () => {
        try {
          // Recent wiki edits
          const recentEditsResult = await dbAdapter.query(
            `
            SELECT
              wp.id, wp.title, wp.slug,
              wr.summary, wr.created_at,
              wr.author_id
            FROM wiki_pages wp
            JOIN wiki_revisions wr ON wp.id = wr.page_id
            WHERE wp.status = 'published'
            ORDER BY wr.created_at DESC
            LIMIT 10
          `,
            [],
            { schema: 'wiki' }
          );
          const recentEdits = recentEditsResult.rows;

          // Add user information
          const editsWithUsers = await Promise.all(
            recentEdits.map(async (edit: any) => {
              if (edit.author_id) {
                const userResult = await dbAdapter.query(
                  `SELECT username, display_name FROM users WHERE id = $1`,
                  [edit.author_id],
                  { schema: 'users' }
                );
                const user = userResult.rows[0];
                return { ...edit, username: user?.username, display_name: user?.display_name };
              }
              return edit;
            })
          );

          await cache.set(['content', 'wiki', 'recent-edits'], editsWithUsers);

          // Popular wiki pages (simplified - wiki_page_views doesn't exist)
          const popularPagesResult = await dbAdapter.query(
            `
            SELECT * FROM wiki_pages
            WHERE status = 'published'
            ORDER BY view_count DESC
            LIMIT 10
          `,
            [],
            { schema: 'wiki' }
          );
          const popularPages = popularPagesResult.rows;

          await cache.set(['content', 'wiki', 'popular'], popularPages);
          logger.info(`Warmed wiki homepage data`);
        } catch (error) {
          logger.error('Failed to warm wiki homepage:', error);
          throw error;
        }
      },
    });

    // Active user sessions
    this.registerTask({
      name: 'active-sessions',
      priority: 7,
      execute: async () => {
        try {
          // Get active sessions from auth database
          const activeSessionsResult = await dbAdapter.query<SessionRow>(
            `
            SELECT user_id, last_activity
            FROM sessions
            WHERE last_activity > NOW() - INTERVAL '15 minutes'
              AND expires_at > NOW()
            ORDER BY last_activity DESC
            LIMIT 100
          `,
            [],
            { schema: 'auth' }
          );
          const activeSessions = activeSessionsResult.rows;

          // Enrich sessions with user data
          for (const session of activeSessions) {
            if (session.user_id) {
              const userResult = await dbAdapter.query<UserRow>(
                `
                SELECT id, username, display_name, role
                FROM users WHERE id = $1
              `,
                [session.user_id],
                { schema: 'users' }
              );
              const user = userResult.rows[0];

              if (user) {
                const enrichedSession = {
                  ...user,
                  last_activity: session.last_activity,
                };
                await cache.set(
                  ['session', 'user', 'session', user.id.toString()],
                  enrichedSession
                );
              }
            }
          }

          logger.info(`Warmed ${activeSessions.length} active sessions`);
        } catch (error) {
          logger.error('Failed to warm active sessions:', error);
          throw error;
        }
      },
    });

    // Site settings
    this.registerTask({
      name: 'site-settings',
      priority: 10,
      execute: async () => {
        try {
          const settingsResult = await dbAdapter.query(
            `
            SELECT key, value, type
            FROM settings
            WHERE is_public = true OR is_public IS NULL
          `,
            [],
            { schema: 'system' }
          );
          const settings = settingsResult.rows;

          const settingsMap = settings.reduce((acc: any, setting: any) => {
            acc[setting.key] =
              setting.type === 'boolean'
                ? setting.value === 'true'
                : setting.type === 'number'
                  ? parseFloat(setting.value)
                  : setting.value;
            return acc;
          }, {});

          await cache.set(['static', 'site', 'settings'], settingsMap);
          logger.info(`Warmed site settings`);
        } catch (error) {
          logger.error('Failed to warm site settings:', error);
          throw error;
        }
      },
    });
  }

  /**
   * Register a new warming task
   */
  registerTask(task: WarmupTask) {
    this.warmupTasks.push(task);
    this.warmupTasks.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Execute all warming tasks
   */
  async warmAll(): Promise<void> {
    if (this.isWarming) {
      logger.info('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();
    this.warmupStats = {
      lastRun: new Date(),
      itemsWarmed: 0,
      errors: 0,
      duration: 0,
    };

    logger.info(`Starting cache warming with ${this.warmupTasks.length} tasks`);

    for (const task of this.warmupTasks) {
      try {
        logger.info(`Executing warmup task: ${task.name}`);
        await task.execute();
        this.warmupStats.itemsWarmed++;
      } catch (error) {
        logger.error(`Failed to execute warmup task ${task.name}:`, error);
        this.warmupStats.errors++;
      }
    }

    this.warmupStats.duration = Date.now() - startTime;
    this.isWarming = false;

    logger.info(`Cache warming completed in ${this.warmupStats.duration}ms`, {
      itemsWarmed: this.warmupStats.itemsWarmed,
      errors: this.warmupStats.errors,
    });
  }

  /**
   * Warm specific tasks by name
   */
  async warmByName(...names: string[]): Promise<void> {
    const tasks = this.warmupTasks.filter(t => names.includes(t.name));

    for (const task of tasks) {
      try {
        await task.execute();
      } catch (error) {
        logger.error(`Failed to warm ${task.name}:`, error);
      }
    }
  }

  /**
   * Get warming statistics
   */
  getStats() {
    return {
      ...this.warmupStats,
      isWarming: this.isWarming,
      taskCount: this.warmupTasks.length,
    };
  }

  /**
   * Schedule periodic warming
   */
  scheduleWarming(intervalMs: number = 5 * 60 * 1000) {
    // Default 5 minutes
    setInterval(() => {
      this.warmAll().catch(err => logger.error('Cache warming failed (periodic)', err));
    }, intervalMs);

    // Initial warming
    setTimeout(() => {
      this.warmAll().catch(err => logger.error('Cache warming failed (initial)', err));
    }, 1000);
  }
}

// Export singleton instance
export const cacheWarmer = CacheWarmer.getInstance();

// Auto-schedule warming in production
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  cacheWarmer.scheduleWarming();
}
