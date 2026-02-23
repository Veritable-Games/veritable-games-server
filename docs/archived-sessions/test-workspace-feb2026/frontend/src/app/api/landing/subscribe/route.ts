import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { z } from 'zod';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Subscribe to launch notifications
 * PUBLIC endpoint - no authentication required
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate email format
    const { email } = subscribeSchema.parse(body);

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existingResult = await dbAdapter.query(
      'SELECT id FROM landing_subscribers WHERE email = $1',
      [normalizedEmail],
      { schema: 'auth' }
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json({ error: 'This email is already subscribed.' }, { status: 400 });
    }

    // Insert new subscriber
    await dbAdapter.query(
      `
      INSERT INTO landing_subscribers (email, subscribed_at, source)
      VALUES ($1, $2, $3)
    `,
      [normalizedEmail, new Date(), 'maintenance_landing'],
      { schema: 'auth' }
    );

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Validation failed' },
        { status: 400 }
      );
    }
    return errorResponse(error);
  }
}
