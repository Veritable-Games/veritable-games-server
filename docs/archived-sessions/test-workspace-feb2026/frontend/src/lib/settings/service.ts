import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  emailVerification: boolean;
  // forumEnabled: boolean; // Forums removed
  wikiEnabled: boolean;
  maxUploadSize: number;
  allowedFileTypes: string;

  // Rate limiter toggles
  rateLimitTopicCreateEnabled: boolean;
  rateLimitReplyCreateEnabled: boolean;
  rateLimitSearchEnabled: boolean;
  rateLimitAuthEnabled: boolean;
  rateLimitFileUploadEnabled: boolean;
  rateLimitMessageSendEnabled: boolean;
  rateLimitWikiCreateEnabled: boolean;
}

class SettingsService {
  private static instance: SettingsService;
  private settings: SiteSettings | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getSettings(forceRefresh = false): Promise<SiteSettings> {
    const now = Date.now();

    // Return cached settings if fresh
    if (!forceRefresh && this.settings && now - this.lastFetch < this.CACHE_DURATION) {
      return this.settings;
    }

    try {
      // Get all settings from PostgreSQL
      const result = await dbAdapter.query<{ key: string; value: string }>(
        'SELECT key, value FROM site_settings',
        [],
        { schema: 'system' }
      );

      const rows = result.rows;

      // Convert to object with proper types
      const settings: any = {};
      for (const { key, value } of rows) {
        if (value === 'true' || value === 'false') {
          settings[key] = value === 'true';
        } else if (key === 'maxUploadSize') {
          settings[key] = parseInt(value, 10);
        } else {
          settings[key] = value;
        }
      }

      // Apply defaults for missing settings
      this.settings = {
        siteName: settings.siteName || 'Veritable Games',
        siteDescription:
          settings.siteDescription ||
          'For all in love and justice. Works against the discriminating man.',
        maintenanceMode: settings.maintenanceMode ?? false,
        maintenanceMessage:
          settings.maintenanceMessage ||
          'We are currently performing scheduled maintenance. Please check back soon.',
        registrationEnabled: settings.registrationEnabled ?? true,
        emailVerification: settings.emailVerification ?? false,
        // forumEnabled: settings.forumEnabled ?? true, // Forums removed
        wikiEnabled: settings.wikiEnabled ?? true,
        maxUploadSize: settings.maxUploadSize || 5,
        allowedFileTypes: settings.allowedFileTypes || 'jpg,png,gif,pdf',

        // Rate limiters (default: enabled for security)
        rateLimitTopicCreateEnabled: settings.rateLimitTopicCreateEnabled ?? true,
        rateLimitReplyCreateEnabled: settings.rateLimitReplyCreateEnabled ?? true,
        rateLimitSearchEnabled: settings.rateLimitSearchEnabled ?? true,
        rateLimitAuthEnabled: settings.rateLimitAuthEnabled ?? true,
        rateLimitFileUploadEnabled: settings.rateLimitFileUploadEnabled ?? true,
        rateLimitMessageSendEnabled: settings.rateLimitMessageSendEnabled ?? true,
        rateLimitWikiCreateEnabled: settings.rateLimitWikiCreateEnabled ?? true,
      };

      this.lastFetch = now;
      return this.settings;
    } catch (error) {
      logger.error('Settings service error:', error);
      throw error;
    }
  }

  async getSetting<K extends keyof SiteSettings>(key: K): Promise<SiteSettings[K]> {
    const settings = await this.getSettings();
    return settings[key];
  }

  clearCache() {
    this.settings = null;
    this.lastFetch = 0;
  }

  async updateSetting<K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
    updatedBy?: number
  ): Promise<void> {
    // Convert value to string for storage
    const stringValue = typeof value === 'boolean' ? String(value) : String(value);

    logger.info(`[SettingsService] Updating ${String(key)}:`, { value, stringValue, updatedBy });

    // Upsert the setting
    await dbAdapter.query(
      `INSERT INTO site_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      [key, stringValue, updatedBy || null],
      { schema: 'system' }
    );

    logger.info(`[SettingsService] ${String(key)} updated in database successfully`);

    // Clear cache to force refresh on next read
    this.clearCache();
    logger.info('[SettingsService] Cache cleared');
  }

  async updateSettings(updates: Partial<SiteSettings>, updatedBy?: number): Promise<void> {
    // Update each setting
    for (const key of Object.keys(updates) as Array<keyof SiteSettings>) {
      const value = updates[key];
      if (value !== undefined) {
        await this.updateSetting(key, value, updatedBy);
      }
    }
  }
}

export const settingsService = SettingsService.getInstance();
