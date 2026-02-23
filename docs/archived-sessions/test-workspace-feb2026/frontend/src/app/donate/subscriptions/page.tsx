import { redirect } from 'next/navigation';

export const metadata = {
  title: 'My Donation History | Veritable Games',
  description: 'View your donation history and subscriptions',
};

export default function SubscriptionsPage() {
  // Redirect to new unified history page
  redirect('/donate/history');
}
