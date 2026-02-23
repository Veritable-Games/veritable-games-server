import SiteSettingsManager from '@/components/admin/SiteSettingsManager';

export const metadata = {
  title: 'Veritable Games',
  description: 'Site settings',
};

export default function AdminSettingsPage() {
  // Auth/admin check handled by admin layout
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-white">Site Settings</h1>
      <p className="mb-8 text-neutral-400">Manage site-wide settings</p>
      <SiteSettingsManager />
    </div>
  );
}
