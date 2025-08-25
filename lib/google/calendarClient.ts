import { google } from 'googleapis';

export interface GCalEvent {
  id: string;
  summary?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  attendees?: Array<{
    self?: boolean;
    responseStatus?: string;
  }>;
}

export async function getCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function getEvent(
  client: any,
  calendarId: string,
  eventId: string
): Promise<GCalEvent> {
  const response = await client.events.get({
    calendarId,
    eventId,
  });
  
  return response.data;
}

export async function checkFreeBusy(
  client: any,
  calendarIds: string[],
  startTime: string,
  endTime: string
): Promise<Array<{ calendarId: string; busy: Array<{ start: string; end: string }> }>> {
  const response = await client.freebusy.query({
    requestBody: {
      timeMin: startTime,
      timeMax: endTime,
      items: calendarIds.map(id => ({ id })),
    },
  });
  
  return response.data.calendars || [];
}

export async function listEvents(
  client: any,
  calendarId: string,
  startTime: string,
  endTime: string,
  treatTentativeAsBusy: boolean = true,
  ignoreDeclined: boolean = true
): Promise<GCalEvent[]> {
  const response = await client.events.list({
    calendarId,
    timeMin: startTime,
    timeMax: endTime,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  let events = response.data.items || [];
  
  // Filter out cancelled events
  events = events.filter((event: GCalEvent) => event.status !== 'cancelled');
  
  // Filter out declined events if ignoreDeclined is true
  if (ignoreDeclined) {
    events = events.filter((event: GCalEvent) => {
      if (!event.attendees) return true;
      const selfAttendee = event.attendees.find(att => att.self);
      return !selfAttendee || selfAttendee.responseStatus !== 'declined';
    });
  }
  
  // Filter out tentative events if treatTentativeAsBusy is false
  if (!treatTentativeAsBusy) {
    events = events.filter((event: GCalEvent) => event.status !== 'tentative');
  }
  
  return events;
}
