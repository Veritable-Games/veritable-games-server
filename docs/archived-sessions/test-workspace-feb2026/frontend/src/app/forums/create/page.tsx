import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { CreateTopicForm } from '@/components/forums/CreateTopicForm';
import { Loader2 } from 'lucide-react';

export default async function CreateTopicPage() {
  // Server-side auth check
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login with return URL
    redirect('/auth/login?redirect=/forums/create');
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="animate-spin" />
            Loading...
          </div>
        </div>
      }
    >
      <CreateTopicForm user={user} />
    </Suspense>
  );
}
