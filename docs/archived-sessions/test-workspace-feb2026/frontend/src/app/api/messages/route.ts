import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest) {
  const messagingService = new MessagingService();

  try {
    const user = await messagingService.getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recipient_id, subject, message } = body;

    // Validation
    if (!recipient_id || typeof recipient_id !== 'number') {
      return NextResponse.json({ error: 'Valid recipient ID is required' }, { status: 400 });
    }

    if (recipient_id === user.id) {
      return NextResponse.json({ error: 'Cannot send message to yourself' }, { status: 400 });
    }

    if (!subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Create conversation with the recipient
    const conversation = await messagingService.createConversation(
      {
        subject: subject.trim(),
        participant_ids: [recipient_id],
        initial_message: message.trim(),
      },
      user.id
    );

    return NextResponse.json(
      {
        success: true,
        conversation,
        message: 'Message sent successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { enableCSRF: true });
