import { DateTime } from 'luxon';
import { validateReschedule, ValidationInput } from '../validateReschedule';
import { GCalEvent } from '@/lib/google/calendarClient';

// Mock the Google Calendar client
jest.mock('@/lib/google/calendarClient', () => ({
  getCalendarClient: jest.fn(),
  checkFreeBusy: jest.fn(),
  listEvents: jest.fn(),
}));

// Mock the config
jest.mock('@/config/guardrails', () => ({
  loadPolicy: jest.fn(() => ({
    minNoticeHours: 24,
    policyTimeZone: undefined,
    businessHoursByWeekday: {
      1: { start: '09:00', end: '17:00' }, // Monday
      2: { start: '09:00', end: '17:00' }, // Tuesday
      3: { start: '09:00', end: '17:00' }, // Wednesday
      4: { start: '09:00', end: '17:00' }, // Thursday
      5: { start: '09:00', end: '17:00' }, // Friday
    },
    calendarsToCheck: [],
    treatTentativeAsBusy: true,
    ignoreDeclined: true,
    conflictMethod: 'freebusy',
  })),
}));

describe('validateReschedule', () => {
  const mockEvent: GCalEvent = {
    id: 'test-event-id',
    summary: 'Test Event',
    start: {
      dateTime: '2025-09-15T10:00:00Z',
      timeZone: 'UTC',
    },
    end: {
      dateTime: '2025-09-15T11:00:00Z',
      timeZone: 'UTC',
    },
  };

  const baseInput: ValidationInput = {
    originalEvent: mockEvent,
    proposedStartISO: '2025-09-16T10:00:00Z',
    proposedEndISO: '2025-09-16T11:00:00Z',
    userTimeZone: 'UTC',
    calendarId: 'primary',
    accessToken: 'mock-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notice Period Validation', () => {
    it('should pass when proposed time is ≥24h from now', async () => {
      // Use a specific future date that's within business hours
      const futureTime = DateTime.now().plus({ days: 2 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toISO();
      const input = {
        ...baseInput,
        proposedStartISO: futureTime,
        proposedEndISO: DateTime.fromISO(futureTime).plus({ hours: 1 }).toISO(),
      };

      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([]);

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(0);
    });

    it('should fail when proposed time is <24h from now', async () => {
      const nearTime = DateTime.now().plus({ hours: 23 }).toISO();
      const input = {
        ...baseInput,
        proposedStartISO: nearTime,
        proposedEndISO: DateTime.fromISO(nearTime).plus({ hours: 1 }).toISO(),
      };

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('NOTICE_TOO_SOON');
      expect(violations[0].message).toContain('23.0h from now');
    });


  });

  describe('Business Hours Validation', () => {
    it('should pass when event is within business hours on Monday', async () => {
      // Set to a Monday at 10:00 AM
      const mondayTime = DateTime.fromISO('2025-09-15T10:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: mondayTime.toISO(),
        proposedEndISO: mondayTime.plus({ hours: 1 }).toISO(),
      };

      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([]);

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(0);
    });

    it('should fail when event starts before business hours', async () => {
      // Set to a Monday at 8:00 AM (before 9:00 AM business hours)
      const earlyTime = DateTime.fromISO('2025-09-15T08:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: earlyTime.toISO(),
        proposedEndISO: earlyTime.plus({ hours: 1 }).toISO(),
      };

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('BUSINESS_HOURS_OUTSIDE');
      expect(violations[0].message).toContain('outside business hours');
    });

    it('should fail when event ends after business hours', async () => {
      // Set to a Monday at 4:00 PM, ending at 6:00 PM (after 5:00 PM business hours)
      const lateStart = DateTime.fromISO('2025-09-15T16:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: lateStart.toISO(),
        proposedEndISO: lateStart.plus({ hours: 2 }).toISO(), // Ends at 6:00 PM
      };

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('BUSINESS_HOURS_OUTSIDE');
    });

    it('should fail when no business hours defined for Sunday', async () => {
      // Set to a Sunday
      const sundayTime = DateTime.fromISO('2025-09-14T10:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: sundayTime.toISO(),
        proposedEndISO: sundayTime.plus({ hours: 1 }).toISO(),
      };

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('BUSINESS_HOURS_OUTSIDE');
      expect(violations[0].message).toContain('No business hours defined for Sunday');
    });

    it('should pass when event ends exactly at close time', async () => {
      // Set to a Monday ending exactly at 5:00 PM
      const mondayTime = DateTime.fromISO('2025-09-15T16:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: mondayTime.toISO(),
        proposedEndISO: mondayTime.plus({ hours: 1 }).toISO(), // Ends at 5:00 PM
      };

      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([]);

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Conflict Validation', () => {
    it('should pass when no conflicts exist', async () => {
      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([]);

      const violations = await validateReschedule(baseInput);
      expect(violations).toHaveLength(0);
    });

    it('should fail when conflicts exist', async () => {
      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([
        {
          calendarId: 'primary',
          busy: [{ start: '2024-01-16T10:30:00Z', end: '2024-01-16T11:30:00Z' }],
        },
      ]);

      const violations = await validateReschedule(baseInput);
      expect(violations).toHaveLength(1);
      expect(violations[0].code).toBe('TIME_CONFLICT');
      expect(violations[0].message).toContain('overlaps a busy event');
    });

    it('should fallback to events.list when freebusy fails', async () => {
      const { checkFreeBusy, listEvents } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockRejectedValue(new Error('FreeBusy failed'));
      listEvents.mockResolvedValue([]);

      const violations = await validateReschedule(baseInput);
      expect(violations).toHaveLength(0);
      expect(listEvents).toHaveBeenCalled();
    });
  });

  describe('Multiple Violations', () => {
    it('should return all violations when multiple rules are broken', async () => {
      // Too soon AND outside business hours
      const nearTime = DateTime.now().plus({ hours: 23 }).toISO();
      const earlyTime = DateTime.fromISO('2025-09-15T08:00:00Z').setZone('UTC');
      const input = {
        ...baseInput,
        proposedStartISO: earlyTime.toISO(),
        proposedEndISO: earlyTime.plus({ hours: 1 }).toISO(),
      };

      const violations = await validateReschedule(input);
      expect(violations.length).toBeGreaterThanOrEqual(1);
      
      const codes = violations.map(v => v.code);
      expect(codes).toContain('BUSINESS_HOURS_OUTSIDE');
    });
  });

  describe('Timezone Handling', () => {
    it('should use policy timezone when specified', async () => {
      const { loadPolicy } = require('@/config/guardrails');
      loadPolicy.mockReturnValue({
        minNoticeHours: 24,
        policyTimeZone: 'America/New_York',
        businessHoursByWeekday: {
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
        },
        calendarsToCheck: [],
        treatTentativeAsBusy: true,
        ignoreDeclined: true,
        conflictMethod: 'freebusy',
      });

      const { checkFreeBusy } = require('@/lib/google/calendarClient');
      checkFreeBusy.mockResolvedValue([]);

      // Use a time that's within business hours in the policy timezone
      const input = {
        ...baseInput,
        proposedStartISO: '2025-09-16T14:00:00Z', // 10:00 AM EDT
        proposedEndISO: '2025-09-16T15:00:00Z',   // 11:00 AM EDT
      };

      const violations = await validateReschedule(input);
      expect(violations).toHaveLength(0);
    });
  });
});
