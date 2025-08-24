import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { eventId, newDate, newTime, keepDuration } = await request.json()

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken.value })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Get the current event to preserve its duration
    const currentEvent = await calendar.events.get({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId
    })

    const currentStart = new Date(currentEvent.data.start?.dateTime || currentEvent.data.start?.date!)
    const currentEnd = new Date(currentEvent.data.end?.dateTime || currentEvent.data.end?.date!)
    const duration = currentEnd.getTime() - currentStart.getTime()

    // Calculate new start and end times
    const newStart = new Date(`${newDate}T${newTime}`)
    const newEnd = keepDuration 
      ? new Date(newStart.getTime() + duration)
      : new Date(`${newDate}T${newTime}`)

    // Update the event
    const updatedEvent = await calendar.events.patch({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId,
      requestBody: {
        start: {
          dateTime: newStart.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: newEnd.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }
    })

    return NextResponse.json({
      success: true,
      event: updatedEvent.data
    })
  } catch (error) {
    console.error('Failed to reschedule event:', error)
    return NextResponse.json({ error: 'Failed to reschedule event' }, { status: 500 })
  }
}
