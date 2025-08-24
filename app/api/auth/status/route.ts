import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')
  
  return NextResponse.json({
    authenticated: !!accessToken
  })
}
