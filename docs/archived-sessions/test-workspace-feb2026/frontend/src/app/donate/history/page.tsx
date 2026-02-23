/**
 * Donation History Page (Deprecated)
 * Redirects to /donate which now has unified management
 */

import { redirect } from 'next/navigation';

export default function DonationHistoryPage() {
  redirect('/donate');
}
