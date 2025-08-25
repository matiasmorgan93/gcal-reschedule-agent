import { NextRequest } from 'next/server';
import { POST as validateReschedule } from '@/app/api/validate-reschedule/route';
import { POST as rescheduleEvent } from '@/app/api/reschedule/route';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(() => ({
        setCredentials: jest.fn(),
      })),
    },
    calendar: jest.fn(() => ({
      events: {
        get: jest.fn(() => Promise.resolve({
          data: {
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
          },
        })),
        patch: jest.fn(() => Promise.resolve({
          data: {
            id: 'test-event-id',
            summary: 'Test Event',
            start: {
              dateTime: '2025-09-16T10:00:00Z',
              timeZone: 'UTC',
            },
            end: {
              dateTime: '2025-09-16T11:00:00Z',
              timeZone: 'UTC',
            },
          },
        })),
      },
    })),
  },
}));

// Mock the Google Calendar client
jest.mock('@/lib/google/calendarClient', () => ({
  getCalendarClient: jest.fn(() => ({
    events: {
      get: jest.fn(() => Promise.resolve({
        data: {
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
        },
      })),
      patch: jest.fn(() => Promise.resolve({
        data: {
          id: 'test-event-id',
          summary: 'Test Event',
          start: {
            dateTime: '2025-09-16T10:00:00Z',
            timeZone: 'UTC',
          },
          end: {
            dateTime: '2025-09-16T11:00:00Z',
            timeZone: 'UTC',
          },
        },
      })),
    },
  })),
  getEvent: jest.fn(() => ({
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
  })),
  checkFreeBusy: jest.fn(() => []),
  listEvents: jest.fn(() => []),
}));

// Mock the guardrails validation
jest.mock('@/lib/guardrails/validateReschedule', () => ({
  validateReschedule: jest.fn(() => []),
}));

describe('API Endpoints', () => {
  const mockAccessToken = 'mock-access-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/validate-reschedule', () => {
    it('should validate reschedule request successfully', async () => {
      const requestBody = {
        eventId: 'test-event-id',
        newDate: '2025-09-16',
        newTime: '10:00',
        keepDuration: true,
        userTimeZone: 'UTC',
      };

      const request = new NextRequest('http://localhost:3000/api/validate-reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock the cookie
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => ({ value: mockAccessToken })),
        },
      });

      const response = await validateReschedule(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.violations).toHaveLength(0);
    });

    it('should return 401 when not authenticated', async () => {
      const requestBody = {
        eventId: 'test-event-id',
        newDate: '2025-09-16',
        newTime: '10:00',
        keepDuration: true,
      };

      const request = new NextRequest('http://localhost:3000/api/validate-reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Mock the cookie to return undefined
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => undefined),
        },
      });

      const response = await validateReschedule(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 400 when required fields are missing', async () => {
      const requestBody = {
        eventId: 'test-event-id',
        // Missing newDate and newTime
        keepDuration: true,
      };

      const request = new NextRequest('http://localhost:3000/api/validate-reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => ({ value: mockAccessToken })),
        },
      });

      const response = await validateReschedule(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });
  });

  describe('/api/reschedule', () => {
    it('should reschedule event successfully when no violations', async () => {
      const requestBody = {
        eventId: 'test-event-id',
        newDate: '2025-09-16',
        newTime: '10:00',
        keepDuration: true,
        userTimeZone: 'UTC',
      };

      const request = new NextRequest('http://localhost:3000/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => ({ value: mockAccessToken })),
        },
      });

      const response = await rescheduleEvent(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 400 when violations exist', async () => {
      const { validateReschedule } = require('@/lib/guardrails/validateReschedule');
      validateReschedule.mockResolvedValue([
        {
          code: 'BUSINESS_HOURS_OUTSIDE',
          message: 'Event is outside business hours',
        },
      ]);

      const requestBody = {
        eventId: 'test-event-id',
        newDate: '2025-09-16',
        newTime: '08:00', // Before business hours
        keepDuration: true,
        userTimeZone: 'UTC',
      };

      const request = new NextRequest('http://localhost:3000/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => ({ value: mockAccessToken })),
        },
      });

      const response = await rescheduleEvent(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Reschedule request violates guardrails');
      expect(data.violations).toHaveLength(1);
      expect(data.violations[0].code).toBe('BUSINESS_HOURS_OUTSIDE');
    });
  });
});
