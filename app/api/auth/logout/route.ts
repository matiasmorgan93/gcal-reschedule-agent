import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url))
  
  // Clear authentication cookies
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0 // Expire immediately
  })
  
  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0 // Expire immediately
  })

  return response
}
