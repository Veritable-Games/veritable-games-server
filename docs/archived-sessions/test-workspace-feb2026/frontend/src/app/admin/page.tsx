import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin Dashboard | Veritable Games',
  description: 'Admin dashboard for Veritable Games',
};

export default function AdminDashboardPage() {
  // Redirect to settings by default
  redirect('/admin/settings');
}
