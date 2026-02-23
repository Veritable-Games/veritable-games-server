/**
 * Alert Manager
 *
 * Sends alerts via multiple channels (Slack, webhooks) for critical events.
 * Implements threshold-based alerting to prevent alert fatigue.
 *
 * Features:
 * - Multiple severity levels (info, warning, critical)
 * - Slack webhook integration
 * - Generic webhook support
 * - Threshold-based alerting (consecutive failures)
 * - Alert deduplication
 */

import { config } from '../config';
import { logger } from '@/lib/utils/logger';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert data structure
 */
export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

/**
 * Failure tracking for threshold-based alerting
 */
interface FailureRecord {
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  alertSent: boolean;
}

/**
 * Alert Manager implementation
 */
export class AlertManager {
  private failures = new Map<string, FailureRecord>();
  private slackWebhookUrl: string | undefined;
  private failureThreshold = 3; // Alert after 3 consecutive failures
  private failureWindowMs = 5 * 60 * 1000; // 5 minute window

  constructor(slackWebhookUrl?: string) {
    this.slackWebhookUrl = slackWebhookUrl;
  }

  /**
   * Send alert via all configured channels
   */
  async sendAlert(alert: Alert): Promise<void> {
    logger.error(`[AlertManager] Sending alert: ${alert.severity.toUpperCase()} - ${alert.title}`);

    try {
      // Send to Slack if configured and enabled
      if (config.alerting.enabled && config.alerting.slackWebhookUrl) {
        await this.sendToSlack(alert);
      }

      // Log alert locally
      this.logAlert(alert);
    } catch (error) {
      logger.error(`[AlertManager] Error sending alert: ${error}`);
    }
  }

  /**
   * Record a failure and alert if threshold exceeded
   */
  async recordFailure(key: string, description: string): Promise<void> {
    const now = Date.now();
    let record = this.failures.get(key);

    if (!record) {
      // New failure
      record = {
        count: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        alertSent: false,
      };
    } else {
      // Check if within window
      const timeSinceFirst = now - record.firstOccurrence.getTime();

      if (timeSinceFirst > this.failureWindowMs) {
        // Outside window, reset
        record = {
          count: 1,
          firstOccurrence: new Date(),
          lastOccurrence: new Date(),
          alertSent: false,
        };
      } else {
        // Within window, increment
        record.count++;
        record.lastOccurrence = new Date();
      }
    }

    this.failures.set(key, record);

    // Send alert if threshold reached and not already sent
    if (record.count >= this.failureThreshold && !record.alertSent) {
      record.alertSent = true;
      this.failures.set(key, record);

      await this.sendAlert({
        severity: 'warning',
        title: `Repeated Failures Detected: ${key}`,
        message: `${record.count} failures in ${Math.round(this.failureWindowMs / 1000 / 60)} minutes: ${description}`,
        context: {
          failureKey: key,
          count: record.count,
          threshold: this.failureThreshold,
          firstOccurrence: record.firstOccurrence,
          lastOccurrence: record.lastOccurrence,
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Clear failure record (called on recovery)
   */
  clearFailures(key: string): void {
    this.failures.delete(key);
    logger.error(`[AlertManager] Cleared failure record: ${key}`);
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: Alert): Promise<void> {
    const webhookUrl = config.alerting.slackWebhookUrl;
    if (!webhookUrl) {
      return;
    }

    const color = this.getSeverityColor(alert.severity);
    const payload = {
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: this.formatContextFields(alert.context),
          footer: 'Godot MCP Alert',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}: ${response.statusText}`);
      }

      logger.error(`[AlertManager] Alert sent to Slack`);
    } catch (error) {
      logger.error(`[AlertManager] Failed to send to Slack: ${error}`);
      throw error;
    }
  }

  /**
   * Get color for Slack message based on severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'info':
        return '#36a64f'; // Green
      case 'warning':
        return '#ff9900'; // Orange
      case 'critical':
        return '#ff0000'; // Red
      default:
        return '#808080'; // Gray
    }
  }

  /**
   * Format context for Slack fields
   */
  private formatContextFields(
    context?: Record<string, any>
  ): Array<{ title: string; value: string; short: boolean }> {
    if (!context) {
      return [];
    }

    return Object.entries(context).map(([key, value]) => ({
      title: key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      short: true,
    }));
  }

  /**
   * Log alert locally
   */
  private logAlert(alert: Alert): void {
    const prefix = `[AlertManager] [${alert.severity.toUpperCase()}]`;
    const timestamp = alert.timestamp.toISOString();

    logger.error(`${prefix} ${timestamp} - ${alert.title}`);
    logger.error(`${prefix} ${alert.message}`);

    if (alert.context) {
      logger.error(`${prefix} Context:`, alert.context);
    }
  }

  /**
   * Get failure statistics
   */
  getFailureStats(): Record<string, FailureRecord> {
    const stats: Record<string, FailureRecord> = {};

    for (const [key, record] of this.failures) {
      stats[key] = {
        count: record.count,
        firstOccurrence: record.firstOccurrence,
        lastOccurrence: record.lastOccurrence,
        alertSent: record.alertSent,
      };
    }

    return stats;
  }

  /**
   * Reset all failure records (for testing)
   */
  reset(): void {
    this.failures.clear();
  }
}

/**
 * Global alert manager instance
 */
export const alertManager = new AlertManager(config.alerting.slackWebhookUrl);

/**
 * Helper function to alert on spawn failures
 */
export async function alertSpawnFailure(versionId: number, error: Error): Promise<void> {
  await alertManager.sendAlert({
    severity: 'critical',
    title: `Instance Spawn Failed: Version ${versionId}`,
    message: error.message,
    context: {
      versionId,
      errorType: error.name,
    },
    timestamp: new Date(),
  });
}

/**
 * Helper function to alert on crash loop detection
 */
export async function alertCrashLoopDetected(versionId: number): Promise<void> {
  await alertManager.sendAlert({
    severity: 'critical',
    title: `Crash Loop Detected: Version ${versionId}`,
    message: `Instance for version ${versionId} is in a crash loop. Manual intervention required.`,
    context: {
      versionId,
      action: 'MANUAL_RESTART_REQUIRED',
    },
    timestamp: new Date(),
  });
}

/**
 * Helper function to alert on database connection issues
 */
export async function alertDatabaseConnectionFailure(error: Error): Promise<void> {
  await alertManager.recordFailure('database_connection', error.message);
}

/**
 * Helper function to alert on socket connection issues
 */
export async function alertSocketConnectionFailure(versionId: number, error: Error): Promise<void> {
  await alertManager.recordFailure(`socket_${versionId}`, error.message);
}
