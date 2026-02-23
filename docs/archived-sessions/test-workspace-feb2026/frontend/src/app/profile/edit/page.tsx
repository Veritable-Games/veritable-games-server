import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';

export default async function EditProfilePage() {
  // NOTE: Profile edit ALWAYS requires authentication regardless of maintenance mode,
  // because editing a profile requires a logged-in user account.
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/forums');
  }

  // Redirect to the new settings page
  redirect('/settings');
}
