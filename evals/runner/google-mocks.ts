import { GCalEvent } from '@/lib/google/calendarClient';

export interface MockFreeBusyItem {
  calendarId: string;
  busy: Array<{
    start: string;
    end: string;
    status?: string;
  }>;
}

export interface MockEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  attendees?: Array<{
    self?: boolean;
    responseStatus?: string;
  }>;
}

export interface MockCase {
  mockFreeBusy: MockFreeBusyItem[];
  mockEvents?: MockEvent[];
  treatTentativeAsBusy: boolean;
  ignoreDeclined: boolean;
  originalEvent?: MockEvent;
}

let currentMock: MockCase | null = null;

/**
 * Set the current mock data for Google API calls
 */
export function setMockData(mockCase: MockCase): void {
  currentMock = mockCase;
}

/**
 * Clear the current mock data
 */
export function clearMockData(): void {
  currentMock = null;
}

/**
 * Get the current mock data
 */
export function getMockData(): MockCase | null {
  return currentMock;
}

/**
 * Mock implementation of checkFreeBusy
 */
export async function mockCheckFreeBusy(
  client: any,
  calendarIds: string[],
  startTime: string,
  endTime: string
): Promise<Array<{ calendarId: string; busy: Array<{ start: string; end: string }> }>> {
  if (!currentMock) {
    throw new Error('No mock data set');
  }

  const results: Array<{ calendarId: string; busy: Array<{ start: string; end: string }> }> = [];

  for (const calendarId of calendarIds) {
    const mockCalendar = currentMock.mockFreeBusy?.find(c => c.calendarId === calendarId);
    
    if (mockCalendar) {
      // Filter busy periods that overlap with the requested time range
      const overlappingBusy = mockCalendar.busy.filter(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        const requestStart = new Date(startTime);
        const requestEnd = new Date(endTime);
        
        return busyStart < requestEnd && busyEnd > requestStart;
      });

      results.push({
        calendarId,
        busy: overlappingBusy.map(b => ({ start: b.start, end: b.end }))
      });
    } else {
      results.push({
        calendarId,
        busy: []
      });
    }
  }

  return results;
}

/**
 * Mock implementation of listEvents
 */
export async function mockListEvents(
  client: any,
  calendarId: string,
  startTime: string,
  endTime: string,
  treatTentativeAsBusy: boolean = true,
  ignoreDeclined: boolean = true
): Promise<GCalEvent[]> {
  if (!currentMock) {
    throw new Error('No mock data set');
  }

  let events = currentMock.mockEvents ?? [];

  // Filter events that overlap with the requested time range
  events = events.filter(event => {
    const eventStart = event.start.dateTime || event.start.date;
    const eventEnd = event.end.dateTime || event.end.date;
    
    if (!eventStart || !eventEnd) return false;
    
    const eventStartDate = new Date(eventStart);
    const eventEndDate = new Date(eventEnd);
    const requestStart = new Date(startTime);
    const requestEnd = new Date(endTime);
    
    return eventStartDate < requestEnd && eventEndDate > requestStart;
  });

  // Filter out cancelled events
  events = events.filter(event => event.status !== 'cancelled');

  // Filter out declined events if ignoreDeclined is true
  if (ignoreDeclined) {
    events = events.filter(event => {
      if (!event.attendees) return true;
      const selfAttendee = event.attendees.find(att => att.self);
      return !selfAttendee || selfAttendee.responseStatus !== 'declined';
    });
  }

  // Filter out tentative events if treatTentativeAsBusy is false
  if (!treatTentativeAsBusy) {
    events = events.filter(event => event.status !== 'tentative');
  }

  return events as GCalEvent[];
}

/**
 * Mock implementation of getEvent
 */
export async function mockGetEvent(
  client: any,
  calendarId: string,
  eventId: string
): Promise<GCalEvent> {
  if (!currentMock) {
    throw new Error('No mock data set');
  }

  // First check mockEvents, then check originalEvent
  let event = currentMock.mockEvents?.find(e => e.id === eventId);
  if (!event && currentMock.originalEvent && currentMock.originalEvent.id === eventId) {
    event = currentMock.originalEvent;
  }
  
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }

  return event as GCalEvent;
}

/**
 * Create a mock calendar client
 */
export function createMockCalendarClient(): any {
  return {
    freebusy: {
      query: async (params: any) => {
        const { requestBody } = params;
        const results = await mockCheckFreeBusy(
          null,
          requestBody.items.map((item: any) => item.id),
          requestBody.timeMin,
          requestBody.timeMax
        );
        return { data: { calendars: results } };
      }
    },
    events: {
      get: async (params: any) => {
        const event = await mockGetEvent(null, params.calendarId, params.eventId);
        return { data: event };
      },
      list: async (params: any) => {
        const events = await mockListEvents(
          null,
          params.calendarId,
          params.timeMin,
          params.timeMax,
          currentMock?.treatTentativeAsBusy ?? true,
          currentMock?.ignoreDeclined ?? true
        );
        return { data: { items: events } };
      }
    }
  };
}
