// Unified User System Types
export interface User {
  id: number;
  uuid: string; // Immutable unique identifier for moderation/support (users can change username)
  username: string;
  email: string;
  display_name: string; // Made required to match auth/utils User type
  bio?: string;
  avatar_url?: string;
  role: 'user' | 'moderator' | 'developer' | 'admin';
  email_verified: boolean;
  reputation: number;
  post_count: number;
  is_active: boolean;
  ban_type?: 'soft' | 'hard' | null; // null = not banned, 'soft' = reversible, 'hard' = permanent
  ban_reason?: string;
  banned_at?: string;
  banned_by?: number;
  last_login_at?: string;
  created_at: string;
  updated_at?: string;
  // Email notification preferences
  email_notifications_enabled?: boolean;
  email_message_notifications?: boolean;
  email_reply_notifications?: boolean;
  // Additional profile fields
  location?: string;
  website_url?: string;
  github_url?: string;
  mastodon_url?: string;
  linkedin_url?: string;
  discord_username?: string;
  steam_url?: string;
  xbox_gamertag?: string;
  psn_id?: string;
  bluesky_url?: string; // Added missing field
  avatar_position_x?: number;
  avatar_position_y?: number;
  avatar_scale?: number;
  last_active: string; // Required for auth compatibility
}

export interface UserProfile extends User {
  // Forum statistics (optional - forums disabled)
  forum_topic_count?: number;
  forum_reply_count?: number;
  forum_reputation?: number;

  // Wiki statistics
  wiki_page_count: number;
  wiki_edit_count: number;

  // Activity statistics
  total_activity_count: number;
  recent_activity: UnifiedActivity[];
}

export interface UnifiedActivity {
  id: number;
  user_id: number;
  activity_type: string;
  entity_id: string; // TEXT in database schema
  entity_type: string;
  action?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  display_name?: string;
  bio?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  role?: User['role'];
  is_active?: boolean;
  // Additional profile fields
  location?: string;
  website_url?: string;
  github_url?: string;
  mastodon_url?: string;
  linkedin_url?: string;
  discord_username?: string;
  steam_url?: string;
  xbox_gamertag?: string;
  psn_id?: string;
  bluesky_url?: string; // Added missing field
  avatar_position_x?: number;
  avatar_position_y?: number;
  avatar_scale?: number;
}

export interface UserSearchOptions {
  query?: string;
  role?: User['role'];
  limit?: number;
  offset?: number;
  sort?: 'recent' | 'alphabetical' | 'activity';
  viewerRole?: User['role']; // Role of the user making the request
}

export interface UserSession {
  id: string;
  user_id: number;
  token: string;
  expires_at: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
}

export interface LoginData {
  identifier: string; // username or email
  password: string;
  remember_me?: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface Permission {
  id: number;
  user_id: number;
  permission: string;
  resource_type?: string;
  resource_id?: number;
  granted_by: number;
  granted_at: string;
  expires_at?: string;
}

// Activity aggregation types
export interface ActivitySummary {
  date: string;
  forum_activity?: number; // Optional - forums disabled
  wiki_activity: number;
  total_activity: number;
}

export interface UserStats {
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  new_users_today: number;
  top_contributors: UserProfile[];
}
