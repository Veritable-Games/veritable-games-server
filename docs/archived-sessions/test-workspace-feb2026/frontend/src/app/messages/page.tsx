import Link from 'next/link';
import MessageInbox from '@/components/messaging/MessageInbox';

export default function MessagesPage() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <nav className="mb-4 flex items-center space-x-2 text-sm text-gray-400">
          <Link href="/forums" className="transition-colors hover:text-blue-400">
            Forums
          </Link>
          <span className="mx-2">→</span>
          <span className="text-white">Messages</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold text-white">Messages</h1>
            <p className="text-gray-400">Your private conversations</p>
          </div>
          <Link
            href="/users"
            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-500"
          >
            New Message
          </Link>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-hidden">
        <MessageInbox />
      </div>
    </div>
  );
}
