import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import Link from 'next/link';

export const metadata = {
  title: 'Admin Dashboard | Veritable Games',
  description: 'Admin dashboard for managing site settings and x402 payments',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check authentication and admin role
  // NOTE: Admin pages ALWAYS require authentication regardless of maintenance mode,
  // because they contain sensitive administrative functionality.
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login?redirect=/admin');
  }

  if (user.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="min-h-screen w-64 border-r border-neutral-800 bg-neutral-900/50">
          <div className="p-6">
            <h2 className="mb-6 text-lg font-bold text-white">Admin Panel</h2>
            <p className="mb-6 text-xs font-medium uppercase tracking-widest text-neutral-500">
              Navigation
            </p>
            <nav className="space-y-2">
              <NavLink href="/admin/settings">⚙️ Site Settings</NavLink>
              <NavLink href="/admin/x402">💰 X402 Payments</NavLink>
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <p className="mb-2 px-4 text-xs text-neutral-500">
                  Campaigns, expenses, and categories are now managed via /donate/transparency
                </p>
                <NavLink href="/donate/transparency">🔍 Financial Transparency</NavLink>
                <NavLink href="/">← Back to Site</NavLink>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-4 py-2 text-neutral-400 transition-colors hover:bg-neutral-800/50 hover:text-white"
    >
      {children}
    </Link>
  );
}
