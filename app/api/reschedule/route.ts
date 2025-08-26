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
    const { 
      calendarId = 'primary', 
      eventId, 
      newStartISO, 
      newEndISO, 
      timeZone = 'Europe/London',
      minNoticeHours,
      bhStart,
      bhEnd,
      // Legacy support
      newDate,
      newTime,
      keepDuration,
      userTimeZone
    } = await request.json()

    if (!eventId || (!newStartISO && !newDate) || (!newEndISO && !newTime)) {
      return NextResponse.json({ 
        error: 'Missing required fields: eventId and either (newStartISO, newEndISO) or (newDate, newTime)' 
      }, { status: 400 })
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken.value })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const effectiveCalendarId = calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary'

    // Get the current event to preserve its duration
    const currentEvent = await getEvent(calendar, effectiveCalendarId, eventId)

    if (!currentEvent.start?.dateTime && !currentEvent.start?.date) {
      return NextResponse.json({ 
        error: 'Cannot reschedule all-day events' 
      }, { status: 400 })
    }

    // Use provided ISO strings or calculate from date/time components
    let proposedStartISO: string;
    let proposedEndISO: string;
    const effectiveTimeZone = timeZone || userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (newStartISO && newEndISO) {
      // Use provided ISO strings directly
      proposedStartISO = newStartISO;
      proposedEndISO = newEndISO;
    } else {
      // Calculate from date/time components (legacy support)
      const currentStart = new Date(currentEvent.start.dateTime || currentEvent.start.date!)
      const currentEnd = new Date(currentEvent.end.dateTime || currentEvent.end.date!)
      const duration = currentEnd.getTime() - currentStart.getTime()

      const newStart = new Date(`${newDate}T${newTime}`)
      const newEnd = keepDuration 
        ? new Date(newStart.getTime() + duration)
        : new Date(`${newDate}T${newTime}`)

      proposedStartISO = newStart.toISOString()
      proposedEndISO = newEnd.toISOString()
    }

    // Validate the reschedule request
    const validationInput: ValidationInput = {
      originalEvent: currentEvent,
      proposedStartISO,
      proposedEndISO,
      userTimeZone: effectiveTimeZone,
      calendarId: effectiveCalendarId,
      accessToken: accessToken.value,
    }

    const violations = await validateReschedule(validationInput)

    if (violations.length > 0) {
      // Return specific policy error codes as expected by the micro-eval
      const violation = violations[0]; // Take the first violation
      let errorCode = 'policy:unknown';
      let statusCode = 400;
      
      switch (violation.code) {
        case 'NOTICE_TOO_SOON':
          errorCode = 'policy:min_notice';
          statusCode = 400;
          break;
        case 'BUSINESS_HOURS_OUTSIDE':
          errorCode = 'policy:business_hours';
          statusCode = 400;
          break;
        case 'TIME_CONFLICT':
          errorCode = 'policy:conflict';
          statusCode = 409;
          break;
      }
      
      return NextResponse.json({
        error: errorCode,
      }, { status: statusCode })
    }

    // Update the event
    const updatedEvent = await calendar.events.patch({
      calendarId: effectiveCalendarId,
      eventId,
      requestBody: {
        start: {
          dateTime: proposedStartISO,
          timeZone: effectiveTimeZone
        },
        end: {
          dateTime: proposedEndISO,
          timeZone: effectiveTimeZone
        }
      }
    })

    return NextResponse.json({
      ok: true,
      event: updatedEvent.data
    })
  } catch (error) {
    console.error('Failed to reschedule event:', error)
    return NextResponse.json({ error: 'Failed to reschedule event' }, { status: 500 })
  }
}
