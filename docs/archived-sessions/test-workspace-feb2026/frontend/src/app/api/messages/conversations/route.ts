import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/lib/messaging/service';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function getHandler(request: NextRequest) {
  const messagingService = new MessagingService();

  try {
    const user = await messagingService.getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

    const conversations = await messagingService.getUserConversations(user.id, limit, offset);

    return NextResponse.json({
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        has_more: conversations.length === limit,
      },
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

async function postHandler(request: NextRequest) {
  const messagingService = new MessagingService();

  try {
    const user = await messagingService.getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, participant_ids, initial_message } = body;

    // Validation
    if (!subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    if (!initial_message?.trim()) {
      return NextResponse.json({ error: 'Initial message is required' }, { status: 400 });
    }

    if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
    }

    // Ensure all participant IDs are numbers
    const validParticipantIds = participant_ids.filter(
      id => typeof id === 'number' && id > 0 && id !== user.id
    );

    if (validParticipantIds.length === 0) {
      return NextResponse.json({ error: 'Valid participants are required' }, { status: 400 });
    }

    const conversation = await messagingService.createConversation(
      {
        subject: subject.trim(),
        participant_ids: validParticipantIds,
        initial_message: initial_message.trim(),
      },
      user.id
    );

    return NextResponse.json(
      {
        success: true,
        conversation,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export const GET = withSecurity(getHandler, {});
export const POST = withSecurity(postHandler, { enableCSRF: true });
