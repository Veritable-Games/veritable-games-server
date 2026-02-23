import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { getCurrentUser } from '@/lib/auth/server';
import { errorResponse } from '@/lib/utils/api-errors';
import { UserService } from '@/lib/users/service';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Require admin/moderator
    const user = await getCurrentUser(request);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Admin or moderator access required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { userIds, reason } = body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'userIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Convert to numbers (handles both string and number inputs from database)
    const numericUserIds = userIds.map((id: string | number) =>
      typeof id === 'string' ? parseInt(id, 10) : id
    );

    // Validate all userIds are valid numbers
    if (numericUserIds.some(id => isNaN(id))) {
      return NextResponse.json(
        { success: false, error: 'All userIds must be valid numbers' },
        { status: 400 }
      );
    }

    // Prevent banning self
    if (numericUserIds.includes(user.id)) {
      return NextResponse.json(
        { success: false, error: 'You cannot ban yourself' },
        { status: 400 }
      );
    }

    // Ban users
    const userService = new UserService();
    await userService.batchBanUsers(numericUserIds, user.id, reason);

    return NextResponse.json({
      success: true,
      message: `Successfully soft-banned ${userIds.length} user(s)`,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
