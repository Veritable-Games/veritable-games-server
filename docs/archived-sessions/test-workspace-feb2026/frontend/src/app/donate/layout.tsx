import { getServerSession } from '@/lib/auth/session';
import { DonateNavigation } from '@/components/donations/DonateNavigation';

export default async function DonateLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isAdmin = session?.role === 'admin';
  const isAuthenticated = !!session;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950">
      {/* Navigation */}
      <DonateNavigation isAdmin={isAdmin} isAuthenticated={isAuthenticated} />

      {/* Page Content */}
      {children}
    </div>
  );
}
