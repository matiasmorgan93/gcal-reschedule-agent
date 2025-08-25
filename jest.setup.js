// Mock environment variables
process.env.GOOGLE_CALENDAR_ID = 'primary';
process.env.GUARDRAILS_JSON = undefined;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
