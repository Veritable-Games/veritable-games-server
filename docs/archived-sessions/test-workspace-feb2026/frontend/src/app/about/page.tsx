import { dbAdapter } from '@/lib/database/adapter';
import { getCurrentUser } from '@/lib/auth/server';
import AboutPageClient from './AboutPageClient';
import { logger } from '@/lib/utils/logger';

interface TeamMemberWithUser {
  id: number;
  user_id: number;
  title: string | null;
  tags: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface CommissionCredit {
  id: number;
  project_name: string;
  client_name: string;
  project_type: string | null;
  year: number | null;
  description: string | null;
  url: string | null;
  color: string | null;
  display_order: number;
}

async function getTeamMembers(): Promise<TeamMemberWithUser[]> {
  try {
    const result = await dbAdapter.query<TeamMemberWithUser>(
      `SELECT
        tm.id,
        tm.user_id,
        tm.title,
        tm.tags,
        tm.display_order,
        tm.created_at,
        tm.updated_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio
      FROM content.team_members tm
      JOIN users.users u ON tm.user_id = u.id
      WHERE u.role IN ('admin', 'developer')
      ORDER BY tm.display_order ASC, tm.created_at ASC`,
      []
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching team members:', error);
    return [];
  }
}

async function getCommissionCredits(): Promise<CommissionCredit[]> {
  try {
    const result = await dbAdapter.query<CommissionCredit>(
      `SELECT * FROM commission_credits
       ORDER BY display_order ASC, year DESC NULLS LAST`,
      [],
      { schema: 'content' }
    );

    return result.rows;
  } catch (error) {
    logger.error('Error fetching commission credits:', error);
    return [];
  }
}

async function getAboutSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const settingKey = `about_${key}`;
    const result = await dbAdapter.query<{ value: string }>(
      `SELECT value FROM settings WHERE key = $1`,
      [settingKey],
      { schema: 'system' }
    );

    if (result.rows.length > 0 && result.rows[0]) {
      return result.rows[0].value;
    }

    return defaultValue;
  } catch (error) {
    logger.error(`Error fetching about setting ${key}:`, error);
    return defaultValue;
  }
}

export default async function AboutPage() {
  const teamMembers = await getTeamMembers();
  const commissionCredits = await getCommissionCredits();

  const pageTitle = await getAboutSetting('title', 'About Veritable Games');
  const missionText = await getAboutSetting(
    'mission',
    `At Veritable Games, we believe in the transformative power of interactive storytelling. Our mission is to create meaningful gaming experiences that challenge players intellectually, emotionally, and morally while delivering exceptional entertainment value.

We are committed to developing games that push boundaries - not just in technology and gameplay, but in their ability to provoke thought, inspire empathy, and foster genuine human connection. Every project we undertake is guided by our core principle: games as a medium for profound expression.

Through innovative game design, compelling narratives, and cutting-edge technology, we strive to elevate the gaming medium and create experiences that resonate long after the screen goes dark.`
  );

  const commissionIntro = await getAboutSetting(
    'commission_intro',
    `We extend our sincere gratitude to the talented artists and developers who have contributed to our projects through commissioned work. Their expertise and creativity have been instrumental in bringing our vision to life.`
  );

  // Check if user is admin
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Parse tags JSON for team members
  const formattedTeamMembers = teamMembers.map(member => ({
    ...member,
    tags: member.tags ? JSON.parse(member.tags) : [],
  }));

  return (
    <AboutPageClient
      initialTeamMembers={formattedTeamMembers}
      initialCommissionCredits={commissionCredits}
      pageTitle={pageTitle}
      missionText={missionText}
      commissionIntro={commissionIntro}
      isAdmin={isAdmin}
    />
  );
}
