import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { errorResponse, PermissionError, DatabaseError } from '@/lib/utils/api-errors';
import { getCurrentUser } from '@/lib/auth/server';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface User {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
}

// GET /api/users - Fetch users (optionally filtered by roles)
async function getHandler(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return errorResponse(new PermissionError('Admin access required'));
  }

  try {
    const { searchParams } = new URL(request.url);
    const rolesParam = searchParams.get('roles'); // e.g., "admin,developer"

    let query = 'SELECT id, username, display_name, role FROM users';
    const params: string[] = [];

    if (rolesParam) {
      const roles = rolesParam.split(',').map(r => r.trim());
      const placeholders = roles.map((_, i) => `$${i + 1}`).join(', ');
      query += ` WHERE role IN (${placeholders})`;
      params.push(...roles);
    }

    query += ' ORDER BY username ASC';

    const users = await dbAdapter.query<User>(query, params, { schema: 'users' });

    return NextResponse.json({ users: users.rows });
  } catch (error) {
    return errorResponse(new DatabaseError('Failed to fetch users', error as Error));
  }
}

export const GET = withSecurity(getHandler, { enableCSRF: false });
