import { ProfileService } from './service';
import { ForumServiceAdapter } from './adapters/forum-service-adapter';
import { WikiServiceAdapter } from './adapters/wiki-service-adapter';
import { MessagingServiceAdapter } from './adapters/messaging-service-adapter';
import {
  ProfileAggregatorService,
  ServiceDependencies,
  ProfileAggregatorConfig,
} from '@/types/profile-aggregation';
import { profileAggregatorFactory } from './profile-aggregator-service';

/**
 * Factory function to create a configured ProfileAggregatorService
 * with all service adapters properly wired up.
 */
export function createProfileAggregatorService(
  config?: Partial<ProfileAggregatorConfig>
): ProfileAggregatorService {
  // Create service adapters
  const profileService = new ProfileService();
  const forumAdapter = new ForumServiceAdapter();
  const wikiAdapter = new WikiServiceAdapter();
  const messagingAdapter = new MessagingServiceAdapter();

  // Create service dependencies object
  const dependencies: ServiceDependencies = {
    profile: profileService,
    forum: forumAdapter,
    wiki: wikiAdapter,
    messaging: messagingAdapter,
  };

  // Create and return the aggregator service
  return profileAggregatorFactory.create(dependencies, config);
}

/**
 * Create ProfileAggregatorService with default configuration
 */
export function createDefaultProfileAggregatorService(): ProfileAggregatorService {
  return createProfileAggregatorService();
}

// Export singleton instance for convenience
export const profileAggregatorService = createDefaultProfileAggregatorService();
