# Changelog

## [1.1.0] - 2025-08-25

### Added
- **Guardrails System**: Comprehensive server-enforced validation for event rescheduling
  - **Business Hours Validation**: Events must be scheduled within configured business hours for each weekday
  - **Notice Period Validation**: Events must be scheduled with at least 24 hours advance notice (configurable)
  - **Conflict Detection**: Events must not conflict with existing calendar events
  - **Timezone Support**: Full IANA timezone support with policy and user timezone handling
  - **Configurable Policy**: Environment variable `GUARDRAILS_JSON` for custom guardrail settings

### New Features
- **GuardrailPanel Component**: Real-time validation feedback in the UI
- **Validation API Endpoint**: `/api/validate-reschedule` for client-side validation
- **Server-Side Enforcement**: All reschedule requests are validated before execution
- **Conflict Detection Methods**: Support for both `freebusy.query` and `events.list` approaches
- **Duration Preservation**: Automatic preservation of event duration when rescheduling

### Configuration
- **Default Business Hours**: Monday-Friday 9:00 AM - 5:00 PM
- **Default Notice Period**: 24 hours minimum advance notice
- **Configurable Options**:
  - `minNoticeHours`: Minimum hours of advance notice
  - `policyTimeZone`: IANA timezone for policy evaluation
  - `businessHoursByWeekday`: Business hours by weekday (0=Sunday)
  - `calendarsToCheck`: Additional calendars to check for conflicts
  - `treatTentativeAsBusy`: Whether tentative events block scheduling
  - `ignoreDeclined`: Whether declined events block scheduling
  - `conflictMethod`: Method for conflict detection ("freebusy" or "list")

### Error Codes
- `BUSINESS_HOURS_OUTSIDE`: Event time is outside configured business hours
- `NOTICE_TOO_SOON`: Insufficient advance notice for the event
- `TIME_CONFLICT`: Event conflicts with existing calendar events

### Technical Improvements
- **TypeScript**: Full type safety with comprehensive interfaces
- **Testing**: 17 unit tests covering all validation scenarios
- **Performance**: Optimized conflict detection with fallback mechanisms
- **Security**: Server-side validation prevents bypassing guardrails
- **UX**: Real-time feedback with clear error messages

### Dependencies
- Added `luxon` for robust timezone handling
- Added `@types/luxon` for TypeScript support
- Added Jest testing framework with TypeScript support

### Files Added
- `config/guardrails.ts` - Guardrail configuration and policy management
- `lib/google/calendarClient.ts` - Google Calendar API client utilities
- `lib/guardrails/validateReschedule.ts` - Core validation logic
- `app/api/validate-reschedule/route.ts` - Validation API endpoint
- `components/GuardrailPanel.tsx` - UI component for validation feedback
- `lib/guardrails/__tests__/validateReschedule.test.ts` - Unit tests
- `lib/guardrails/__tests__/api.test.ts` - API integration tests
- `jest.config.js` - Jest configuration
- `jest.setup.js` - Jest setup file

### Files Modified
- `app/api/reschedule/route.ts` - Added server-side validation
- `app/page.tsx` - Integrated GuardrailPanel and validation flow
- `package.json` - Added dependencies and test scripts
- `env.example` - Added guardrails configuration example
- `README.md` - Added comprehensive guardrails documentation

### Breaking Changes
- None - All changes are backward compatible

### Migration Guide
1. Update environment variables to include `GUARDRAILS_JSON` if custom configuration is needed
2. No code changes required for existing functionality
3. New validation will be automatically applied to all reschedule requests
