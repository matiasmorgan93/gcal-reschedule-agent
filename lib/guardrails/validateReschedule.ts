import { DateTime } from 'luxon';
import { loadPolicy, GuardrailPolicy } from '@/config/guardrails';
import { getCalendarClient, GCalEvent, checkFreeBusy, listEvents } from '@/lib/google/calendarClient';

export interface ValidationInput {
  originalEvent: GCalEvent;
  proposedStartISO: string; // with TZ
  proposedEndISO: string;   // with TZ
  userTimeZone?: string;    // from client
  calendarId: string;
  accessToken: string;
}

export interface Violation {
  code: 'BUSINESS_HOURS_OUTSIDE' | 'NOTICE_TOO_SOON' | 'TIME_CONFLICT';
  message: string;
  details?: Record<string, unknown>;
}

export async function validateReschedule(input: ValidationInput): Promise<Violation[]> {
  const policy = loadPolicy();
  const violations: Violation[] = [];

  // 1) Check ≥24h notice
  const noticeViolation = await checkNoticePeriod(input, policy);
  if (noticeViolation) {
    violations.push(noticeViolation);
  }

  // 2) Check business hours
  const businessHoursViolation = await checkBusinessHours(input, policy);
  if (businessHoursViolation) {
    violations.push(businessHoursViolation);
  }

  // 3) Check conflicts
  const conflictViolation = await checkConflicts(input, policy);
  if (conflictViolation) {
    violations.push(conflictViolation);
  }

  return violations;
}

async function checkNoticePeriod(
  input: ValidationInput,
  policy: GuardrailPolicy
): Promise<Violation | null> {
  const evalTimeZone = policy.policyTimeZone || input.userTimeZone || 'UTC';
  const nowServer = DateTime.now().setZone(evalTimeZone);
  const start = DateTime.fromISO(input.proposedStartISO);
  
  const diffHours = start.diff(nowServer, 'hours').hours;
  
  if (diffHours < policy.minNoticeHours) {
    return {
      code: 'NOTICE_TOO_SOON',
      message: `Proposed time is only ${diffHours.toFixed(1)}h from now; policy requires ≥ ${policy.minNoticeHours}h.`,
      details: {
        proposedStart: input.proposedStartISO,
        now: nowServer.toISO(),
        diffHours,
        minNoticeHours: policy.minNoticeHours,
        evaluationTimeZone: evalTimeZone,
      },
    };
  }
  
  return null;
}

async function checkBusinessHours(
  input: ValidationInput,
  policy: GuardrailPolicy
): Promise<Violation | null> {
  const evalTimeZone = policy.policyTimeZone || input.originalEvent.start.timeZone || 'UTC';
  const localStart = DateTime.fromISO(input.proposedStartISO).setZone(evalTimeZone);
  const localEnd = DateTime.fromISO(input.proposedEndISO).setZone(evalTimeZone);
  
  // Get weekday (0-6, where 0 is Sunday)
  const weekday = localStart.weekday % 7;
  const businessHours = policy.businessHoursByWeekday[weekday as keyof typeof policy.businessHoursByWeekday];
  
  if (!businessHours) {
    return {
      code: 'BUSINESS_HOURS_OUTSIDE',
      message: `No business hours defined for ${getWeekdayName(weekday)}.`,
      details: {
        weekday,
        weekdayName: getWeekdayName(weekday),
        proposedStart: localStart.toISO(),
        proposedEnd: localEnd.toISO(),
        evaluationTimeZone: evalTimeZone,
      },
    };
  }
  
  // Parse business hours
  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);
  
  const openTime = localStart.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
  const closeTime = localStart.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });
  
  if (localStart < openTime || localEnd > closeTime) {
    return {
      code: 'BUSINESS_HOURS_OUTSIDE',
      message: `Proposed time ${localStart.toFormat('HH:mm')}–${localEnd.toFormat('HH:mm')} is outside business hours ${businessHours.start}–${businessHours.end} (${evalTimeZone}).`,
      details: {
        weekday,
        weekdayName: getWeekdayName(weekday),
        proposedStart: localStart.toISO(),
        proposedEnd: localEnd.toISO(),
        businessHoursStart: businessHours.start,
        businessHoursEnd: businessHours.end,
        openTime: openTime.toISO(),
        closeTime: closeTime.toISO(),
        evaluationTimeZone: evalTimeZone,
      },
    };
  }
  
  return null;
}

async function checkConflicts(
  input: ValidationInput,
  policy: GuardrailPolicy
): Promise<Violation | null> {
  const client = await getCalendarClient(input.accessToken);
  const calendarsToCheck = new Set<string>([
    input.calendarId,
    ...(policy.calendarsToCheck || []),
  ]);
  
  const hasConflict = await checkConflictsForCalendars(
    client,
    Array.from(calendarsToCheck),
    input.proposedStartISO,
    input.proposedEndISO,
    policy
  );
  
  if (hasConflict) {
    return {
      code: 'TIME_CONFLICT',
      message: 'Proposed time overlaps a busy event.',
      details: {
        proposedStart: input.proposedStartISO,
        proposedEnd: input.proposedEndISO,
        calendarsChecked: Array.from(calendarsToCheck),
        conflictMethod: policy.conflictMethod,
      },
    };
  }
  
  return null;
}

async function checkConflictsForCalendars(
  client: any,
  calendarIds: string[],
  startISO: string,
  endISO: string,
  policy: GuardrailPolicy
): Promise<boolean> {
  try {
    if (policy.conflictMethod === 'freebusy') {
      return await checkConflictsWithFreeBusy(client, calendarIds, startISO, endISO);
    } else {
      return await checkConflictsWithEventsList(client, calendarIds, startISO, endISO, policy);
    }
  } catch (error) {
    console.warn('FreeBusy check failed, falling back to events.list:', error);
    // Fallback to events.list if freebusy fails
    return await checkConflictsWithEventsList(client, calendarIds, startISO, endISO, policy);
  }
}

async function checkConflictsWithFreeBusy(
  client: any,
  calendarIds: string[],
  startISO: string,
  endISO: string
): Promise<boolean> {
  const freeBusyResults = await checkFreeBusy(client, calendarIds, startISO, endISO);
  
  for (const calendar of freeBusyResults) {
    if (calendar.busy && calendar.busy.length > 0) {
      return true;
    }
  }
  
  return false;
}

async function checkConflictsWithEventsList(
  client: any,
  calendarIds: string[],
  startISO: string,
  endISO: string,
  policy: GuardrailPolicy
): Promise<boolean> {
  for (const calendarId of calendarIds) {
    try {
      const events = await listEvents(
        client,
        calendarId,
        startISO,
        endISO,
        policy.treatTentativeAsBusy,
        policy.ignoreDeclined
      );
      
      if (events.length > 0) {
        return true;
      }
    } catch (error) {
      console.warn(`Failed to check conflicts for calendar ${calendarId}:`, error);
      // Continue checking other calendars
    }
  }
  
  return false;
}

function getWeekdayName(weekday: number): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[weekday];
}
