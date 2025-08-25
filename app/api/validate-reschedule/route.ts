import { NextRequest, NextResponse } from 'next/server';
import { validateReschedule, ValidationInput } from '@/lib/guardrails/validateReschedule';
import { getEvent } from '@/lib/google/calendarClient';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token');
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { eventId, newDate, newTime, keepDuration, userTimeZone } = await request.json();

    if (!eventId || !newDate || !newTime) {
      return NextResponse.json({ 
        error: 'Missing required fields: eventId, newDate, newTime' 
      }, { status: 400 });
    }

    // Get the current event to preserve its duration and get original data
    const { getCalendarClient } = await import('@/lib/google/calendarClient');
    const client = await getCalendarClient(accessToken.value);
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    
    const currentEvent = await getEvent(client, calendarId, eventId);
    
    if (!currentEvent.start?.dateTime && !currentEvent.start?.date) {
      return NextResponse.json({ 
        error: 'Cannot reschedule all-day events' 
      }, { status: 400 });
    }

    // Calculate new start and end times
    const currentStart = new Date(currentEvent.start.dateTime || currentEvent.start.date!);
    const currentEnd = new Date(currentEvent.end.dateTime || currentEvent.end.date!);
    const duration = currentEnd.getTime() - currentStart.getTime();

    const newStart = new Date(`${newDate}T${newTime}`);
    const newEnd = keepDuration 
      ? new Date(newStart.getTime() + duration)
      : new Date(`${newDate}T${newTime}`);

    // Add timezone information
    const timeZone = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const proposedStartISO = newStart.toISOString();
    const proposedEndISO = newEnd.toISOString();

    // Validate the reschedule request
    const validationInput: ValidationInput = {
      originalEvent: currentEvent,
      proposedStartISO,
      proposedEndISO,
      userTimeZone: timeZone,
      calendarId,
      accessToken: accessToken.value,
    };

    const violations = await validateReschedule(validationInput);

    return NextResponse.json({
      valid: violations.length === 0,
      violations,
      proposedStart: proposedStartISO,
      proposedEnd: proposedEndISO,
      timeZone,
    });

  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json({ 
      error: 'Failed to validate reschedule request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
