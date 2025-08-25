import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { validateReschedule, ValidationInput } from '@/lib/guardrails/validateReschedule'
import { getEvent } from '@/lib/google/calendarClient'

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { eventId, newDate, newTime, keepDuration, userTimeZone } = await request.json()

    if (!eventId || !newDate || !newTime) {
      return NextResponse.json({ 
        error: 'Missing required fields: eventId, newDate, newTime' 
      }, { status: 400 })
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken.value })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

    // Get the current event to preserve its duration
    const currentEvent = await getEvent(calendar, calendarId, eventId)

    if (!currentEvent.start?.dateTime && !currentEvent.start?.date) {
      return NextResponse.json({ 
        error: 'Cannot reschedule all-day events' 
      }, { status: 400 })
    }

    const currentStart = new Date(currentEvent.start.dateTime || currentEvent.start.date!)
    const currentEnd = new Date(currentEvent.end.dateTime || currentEvent.end.date!)
    const duration = currentEnd.getTime() - currentStart.getTime()

    // Calculate new start and end times
    const newStart = new Date(`${newDate}T${newTime}`)
    const newEnd = keepDuration 
      ? new Date(newStart.getTime() + duration)
      : new Date(`${newDate}T${newTime}`)

    // Add timezone information
    const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const proposedStartISO = newStart.toISOString()
    const proposedEndISO = newEnd.toISOString()

    // Validate the reschedule request
    const validationInput: ValidationInput = {
      originalEvent: currentEvent,
      proposedStartISO,
      proposedEndISO,
      userTimeZone: timeZone,
      calendarId,
      accessToken: accessToken.value,
    }

    const violations = await validateReschedule(validationInput)

    if (violations.length > 0) {
      return NextResponse.json({
        error: 'Reschedule request violates guardrails',
        violations,
      }, { status: 400 })
    }

    // Update the event
    const updatedEvent = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        start: {
          dateTime: newStart.toISOString(),
          timeZone: timeZone
        },
        end: {
          dateTime: newEnd.toISOString(),
          timeZone: timeZone
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
