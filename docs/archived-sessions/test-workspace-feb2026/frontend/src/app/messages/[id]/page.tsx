import React, { Suspense } from 'react';
import { ConversationByIdView } from '@/components/messaging/ConversationByIdView';
import Link from 'next/link';

interface ConversationPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function ConversationPageContent({ params }: ConversationPageProps) {
  const resolvedParams = await params;
  const conversationId = parseInt(resolvedParams.id);

  if (isNaN(conversationId)) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
        <div className="py-12 text-center">
          <h1 className="mb-2 text-xl font-bold text-red-400">Invalid Conversation</h1>
          <p className="mb-4 text-gray-400">The conversation ID provided is not valid.</p>
          <Link href="/messages" className="text-blue-400 hover:text-blue-300">
            Return to Messages
          </Link>
        </div>
      </div>
    );
  }

  const breadcrumbs = [{ label: 'Messages', href: '/messages' }, { label: 'Conversation' }];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <nav className="mb-4 text-sm text-gray-400" aria-label="Breadcrumb">
          <ol className="flex items-center">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <li>
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-blue-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white">{crumb.label}</span>
                  )}
                </li>
                {index < breadcrumbs.length - 1 && (
                  <li>
                    <span className="mx-2">›</span>
                  </li>
                )}
              </React.Fragment>
            ))}
          </ol>
        </nav>
      </div>

      {/* Conversation View */}
      <div className="flex-1 overflow-hidden">
        <ConversationByIdView conversationId={conversationId} />
      </div>
    </div>
  );
}

export default function ConversationPage(props: ConversationPageProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-400"></div>
            <span className="ml-3 text-gray-400">Loading conversation...</span>
          </div>
        </div>
      }
    >
      <ConversationPageContent {...props} />
    </Suspense>
  );
}
