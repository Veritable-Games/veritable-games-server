import { getServerSession } from '@/lib/auth/session';
import { CampaignsView } from '@/components/donations/CampaignsView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Active Campaigns | Veritable Games',
  description: 'Support ongoing development through active funding campaigns',
};

export default async function CampaignsPage() {
  const session = await getServerSession();
  const isAdmin = session?.role === 'admin';

  // Fetch campaigns
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/admin/campaigns`,
    {
      cache: 'no-store',
    }
  );

  let campaigns = [];
  if (response.ok) {
    const result = await response.json();
    campaigns = result.success ? result.data || [] : [];
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold text-white">Active Campaigns</h1>
        <p className="text-sm text-neutral-400">
          {isAdmin
            ? 'Manage funding campaigns with inline editing'
            : 'Help fund ongoing development'}
        </p>
      </div>

      <CampaignsView campaigns={campaigns} isAdmin={isAdmin} />
    </div>
  );
}
