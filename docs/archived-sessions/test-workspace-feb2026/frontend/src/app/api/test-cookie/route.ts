import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.json({
    success: true,
    message: 'Cookie test endpoint',
  });

  // Test setting various cookies
  response.cookies.set('test_httponly', 'value1', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600,
    path: '/',
  });

  response.cookies.set('test_non_httponly', 'value2', {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600,
    path: '/',
  });

  response.cookies.set('test_session_id', 'test_session_value', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600,
    path: '/',
  });

  return response;
}
