import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/server';
import { SettingsLayout } from '@/components/settings/SettingsLayout';

export default async function SettingsPage() {
  // NOTE: Settings page ALWAYS requires authentication regardless of maintenance mode,
  // because user settings require a logged-in user account.
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/forums');
  }

  return (
    <div className="h-full overflow-y-auto [scrollbar-width:none] md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
      <SettingsLayout user={currentUser} />
    </div>
  );
}
