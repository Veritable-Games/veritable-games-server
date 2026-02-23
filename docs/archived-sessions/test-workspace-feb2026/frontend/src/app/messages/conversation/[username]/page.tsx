import React, { Suspense } from 'react';
import { ConversationView } from '@/components/messaging/ConversationView';
import { getCurrentUser } from '@/lib/auth/server';
import { redirect, notFound } from 'next/navigation';
import { UserService } from '@/lib/users/service';
import Link from 'next/link';
import { parseProfileIdentifier, getConversationUrlFromUsername } from '@/lib/utils/profile-url';

interface ConversationPageProps {
  params: Promise<{
    username: string;
  }>;
}

async function ConversationPageContent({ params }: ConversationPageProps) {
  // NOTE: Messages ALWAYS require authentication regardless of maintenance mode,
  // because messaging requires a logged-in user account.
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('/forums');
  }

  const resolvedParams = await params;
  const userService = new UserService();

  // Parse the identifier - could be numeric ID (legacy) or username
  const identifier = parseProfileIdentifier(decodeURIComponent(resolvedParams.username));
  let userId: number;
  let recipient;

  if (identifier.isNumeric) {
    // Legacy numeric ID URL - redirect to username-based URL for consistency
    userId = identifier.numericId!;
    recipient = await userService.getUserById(userId);
    if (recipient) {
      // Redirect to username-based URL
      redirect(getConversationUrlFromUsername(recipient.username));
    }
    // If user not found with numeric ID, show not found
    notFound();
  } else {
    // Username-based URL (new format)
    recipient = await userService.getUserByUsername(identifier.username!);
    if (!recipient) {
      notFound();
    }
    userId = recipient.id;
  }

  if (userId === currentUser.id) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
        <div className="py-12 text-center">
          <h1 className="mb-2 text-xl font-bold text-yellow-400">Cannot Message Yourself</h1>
          <p className="mb-4 text-gray-400">You cannot start a conversation with yourself.</p>
          <Link href="/messages" className="text-blue-400 hover:text-blue-300">
            Return to Messages
          </Link>
        </div>
      </div>
    );
  }

  // recipient is already fetched during identifier resolution above

  const breadcrumbs = [{ label: 'Messages', href: '/messages' }];

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-4">
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

        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            {recipient.avatar_url ? (
              <img
                src={recipient.avatar_url}
                alt={`${recipient.display_name || recipient.username}'s avatar`}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700">
                <span className="text-sm font-medium text-gray-300">
                  {(recipient.display_name || recipient.username).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {recipient.display_name || recipient.username}
            </h1>
            <p className="text-sm text-gray-400">@{recipient.username}</p>
          </div>
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 overflow-hidden">
        <ConversationView userId={userId} />
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
