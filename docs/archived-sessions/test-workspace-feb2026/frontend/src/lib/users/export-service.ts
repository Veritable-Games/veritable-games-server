import { dbAdapter } from '@/lib/database/adapter';
import { getUsersDatabase } from '@/lib/users/database';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { logger } from '@/lib/utils/logger';

/**
 * Type definitions for database export records
 */

interface UserProfile {
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role: string;
  reputation: number;
  post_count: number;
  created_at: string;
  last_active: string;
  is_active: boolean;
  [key: string]: unknown; // Allow additional user fields
}

interface PrivacySettings {
  user_id: number;
  profile_visibility: string;
  activity_visibility: string;
  show_email: boolean;
  show_reputation_details: boolean;
  allow_private_messages: boolean;
  allow_forum_mentions: boolean;
  allow_wiki_contributions: boolean;
  created_at: string;
  updated_at: string;
}

interface ActivityRecord {
  id: number;
  user_id: number;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  [key: string]: unknown; // Allow additional activity fields
}

interface WikiPageExport {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  status: string;
  protection_level: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // Allow additional wiki page fields
}

interface WikiRevisionExport {
  id: number;
  page_id: number;
  content: string;
  summary?: string | null;
  content_format: string;
  author_id?: number | null;
  author_ip?: string | null;
  is_minor: boolean;
  size_bytes: number;
  revision_timestamp: string;
  title?: string; // Joined from wiki_pages
  slug?: string; // Joined from wiki_pages
  [key: string]: unknown; // Allow additional fields
}

interface LibraryDocumentExport {
  id: number;
  title: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  author?: string | null;
  publication_date?: string | null;
  created_by: number;
  created_at: string;
  [key: string]: unknown; // Allow additional library fields
}

interface ConversationExport {
  id: number;
  subject: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  participant_id?: number; // Joined from conversation_participants
  [key: string]: unknown; // Allow additional conversation fields
}

interface NotificationExport {
  id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  [key: string]: unknown; // Allow additional notification fields
}

interface ExpiredExportRow {
  file_path: string;
}

export interface ExportRequest {
  id: number;
  user_id: number;
  request_type: 'full' | 'forums' | 'wiki' | 'library' | 'activity';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path?: string;
  file_size?: number;
  expires_at?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface UserDataExport {
  profile: UserProfile | null;
  privacy_settings: PrivacySettings | null;
  activity: ActivityRecord[];
  wiki_pages?: WikiPageExport[];
  wiki_revisions?: WikiRevisionExport[];
  library_documents?: LibraryDocumentExport[];
  conversations?: ConversationExport[];
  notifications?: NotificationExport[];
}

export class DataExportService {
  async requestDataExport(userId: number, exportType: string = 'full'): Promise<string | null> {
    try {
      // Create export request
      const result = await dbAdapter.query(
        `INSERT INTO user_data_exports (user_id, request_type, status, expires_at)
         VALUES ($1, $2, 'pending', NOW() + INTERVAL '7 days')
         RETURNING id`,
        [userId, exportType],
        { schema: 'users' }
      );

      const requestId = result.rows[0].id as number;

      // Start export process asynchronously
      this.processExportRequest(requestId).catch(error => {
        logger.error('Export processing failed:', error);
        this.updateExportStatus(requestId, 'failed', error.message);
      });

      return `export_${userId}_${requestId}`;
    } catch (error) {
      logger.error('Error requesting data export:', error);
      return null;
    }
  }

  async getUserDataExports(userId: number): Promise<ExportRequest[]> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM user_data_exports
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId],
        { schema: 'users' }
      );

      return result.rows as ExportRequest[];
    } catch (error) {
      logger.error('Error fetching user exports:', error);
      return [];
    }
  }

  async getExportRequest(requestId: number): Promise<ExportRequest | null> {
    try {
      const result = await dbAdapter.query(
        'SELECT * FROM user_data_exports WHERE id = $1',
        [requestId],
        { schema: 'users' }
      );
      return (result.rows[0] as ExportRequest) || null;
    } catch (error) {
      logger.error('Error fetching export request:', error);
      return null;
    }
  }

  private async processExportRequest(requestId: number): Promise<void> {
    const request = await this.getExportRequest(requestId);
    if (!request) {
      throw new Error('Export request not found');
    }

    // Update status to processing
    await this.updateExportStatus(requestId, 'processing');

    try {
      // Collect user data based on export type
      const userData = await this.collectUserData(request.user_id, request.request_type);

      // Generate export file
      const filePath = await this.generateExportFile(requestId, userData);

      // Get file size
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);

      // Update export record with completion info
      await dbAdapter.query(
        `UPDATE user_data_exports
         SET status = 'completed', file_path = $1, file_size = $2, completed_at = NOW()
         WHERE id = $3`,
        [filePath, stats.size, requestId],
        { schema: 'users' }
      );
    } catch (error) {
      await this.updateExportStatus(
        requestId,
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  private async collectUserData(userId: number, exportType: string): Promise<UserDataExport> {
    const userData: UserDataExport = {
      profile: null,
      privacy_settings: null,
      activity: [],
    };

    // Get user profile
    const userResult = await dbAdapter.query('SELECT * FROM users WHERE id = $1', [userId], {
      schema: 'users',
    });
    userData.profile = (userResult.rows[0] as UserProfile) || null;

    // Get privacy settings
    const privacyResult = await dbAdapter.query(
      'SELECT * FROM user_privacy_settings WHERE user_id = $1',
      [userId],
      { schema: 'users' }
    );
    userData.privacy_settings = (privacyResult.rows[0] as PrivacySettings) || null;

    // Get activity data
    const activityResult = await dbAdapter.query(
      `SELECT * FROM unified_activity
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId],
      { schema: 'users' }
    );
    userData.activity = activityResult.rows as ActivityRecord[];

    // Include specific data based on export type
    if (exportType === 'full' || exportType === 'wiki') {
      // Wiki pages created by user
      const wikiPagesResult = await dbAdapter.query(
        `SELECT * FROM wiki_pages
         WHERE created_by = $1
         ORDER BY created_at DESC`,
        [userId],
        { schema: 'wiki' }
      );
      userData.wiki_pages = wikiPagesResult.rows as WikiPageExport[];

      // Wiki revisions by user
      const wikiRevisionsResult = await dbAdapter.query(
        `SELECT wr.*, wp.title, wp.slug
         FROM wiki_revisions wr
         LEFT JOIN wiki_pages wp ON wr.page_id = wp.id
         WHERE wr.author_id = $1
         ORDER BY wr.created_at DESC`,
        [userId],
        { schema: 'wiki' }
      );
      userData.wiki_revisions = wikiRevisionsResult.rows as WikiRevisionExport[];
    }

    if (exportType === 'full' || exportType === 'library') {
      // Library documents
      const libraryResult = await dbAdapter.query(
        `SELECT * FROM library_documents
         WHERE created_by = $1
         ORDER BY created_at DESC`,
        [userId],
        { schema: 'library' }
      );
      userData.library_documents = libraryResult.rows as LibraryDocumentExport[];
    }

    if (exportType === 'full' || exportType === 'forums') {
      // Conversations (messages)
      const conversationsResult = await dbAdapter.query(
        `SELECT c.*, cp.user_id as participant_id
         FROM conversations c
         JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE cp.user_id = $1 OR c.created_by = $1
         ORDER BY c.created_at DESC`,
        [userId],
        { schema: 'messaging' }
      );
      userData.conversations = conversationsResult.rows as ConversationExport[];
    }

    // Notifications
    const notificationsResult = await dbAdapter.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [userId],
      { schema: 'users' }
    );
    userData.notifications = notificationsResult.rows as NotificationExport[];

    return userData;
  }

  private async generateExportFile(requestId: number, userData: UserDataExport): Promise<string> {
    const exportDir = join(process.cwd(), 'exports');
    await mkdir(exportDir, { recursive: true });

    const filename = `user_data_export_${requestId}_${Date.now()}.zip`;
    const filePath = join(exportDir, filename);

    return new Promise((resolve, reject) => {
      const output = createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(filePath));
      archive.on('error', reject);

      archive.pipe(output);

      // Add JSON files to archive
      archive.append(JSON.stringify(userData.profile, null, 2), { name: 'profile.json' });
      archive.append(JSON.stringify(userData.privacy_settings, null, 2), {
        name: 'privacy_settings.json',
      });
      archive.append(JSON.stringify(userData.activity, null, 2), { name: 'activity.json' });

      if (userData.wiki_pages) {
        archive.append(JSON.stringify(userData.wiki_pages, null, 2), { name: 'wiki_pages.json' });
      }

      if (userData.wiki_revisions) {
        archive.append(JSON.stringify(userData.wiki_revisions, null, 2), {
          name: 'wiki_revisions.json',
        });
      }

      if (userData.library_documents) {
        archive.append(JSON.stringify(userData.library_documents, null, 2), {
          name: 'library_documents.json',
        });
      }

      if (userData.conversations) {
        archive.append(JSON.stringify(userData.conversations, null, 2), {
          name: 'conversations.json',
        });
      }

      if (userData.notifications) {
        archive.append(JSON.stringify(userData.notifications, null, 2), {
          name: 'notifications.json',
        });
      }

      // Add readme file
      const readme = `# Your Data Export

This archive contains all your personal data from the platform.

## Files Included:

- **profile.json**: Your user profile information
- **privacy_settings.json**: Your privacy preferences
- **activity.json**: Your recent activity on the platform
- **wiki_pages.json**: Wiki pages you've created (if any)
- **wiki_revisions.json**: Your wiki contributions (if any)
- **library_documents.json**: Documents you've uploaded (if any)
- **conversations.json**: Your private messages (if any)
- **notifications.json**: Recent notifications

## Data Format

All files are in JSON format and can be opened with any text editor or imported into other applications.

## Privacy

This export was generated on ${new Date().toISOString()} and will be automatically deleted after 7 days.
`;

      archive.append(readme, { name: 'README.md' });
      archive.finalize();
    });
  }

  private async updateExportStatus(
    requestId: number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      if (errorMessage) {
        await dbAdapter.query(
          `UPDATE user_data_exports
           SET status = $1, error_message = $2, completed_at = NOW()
           WHERE id = $3`,
          [status, errorMessage, requestId],
          { schema: 'users' }
        );
      } else {
        await dbAdapter.query(
          'UPDATE user_data_exports SET status = $1 WHERE id = $2',
          [status, requestId],
          { schema: 'users' }
        );
      }
    } catch (error) {
      logger.error('Error updating export status:', error);
    }
  }

  async deleteExpiredExports(): Promise<void> {
    try {
      // Get expired exports
      const expiredResult = await dbAdapter.query(
        `SELECT file_path FROM user_data_exports
         WHERE expires_at < NOW() AND file_path IS NOT NULL`,
        [],
        { schema: 'users' }
      );
      const expired = expiredResult.rows as ExpiredExportRow[];

      // Delete files
      const fs = await import('fs/promises');
      for (const exp of expired) {
        try {
          await fs.unlink(exp.file_path);
        } catch (error) {
          logger.error('Error deleting export file:', (error as Error).message);
        }
      }

      // Delete database records
      await dbAdapter.query('DELETE FROM user_data_exports WHERE expires_at < NOW()', [], {
        schema: 'users',
      });

      logger.info(`Cleaned up ${expired.length} expired exports`);
    } catch (error) {
      logger.error('Error cleaning up expired exports:', error);
    }
  }
}

export const dataExportService = new DataExportService();
