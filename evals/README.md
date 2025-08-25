# Google Calendar Rescheduler Micro-Evaluation Suite

This directory contains a comprehensive test suite for validating the guardrail logic in the Google Calendar Rescheduler.

## Structure

```
evals/
├── cases/                    # Test case fixtures (JSON)
├── policy.default.json       # Default policy configuration
├── runner/                   # Test execution framework
│   ├── run-evals.ts         # Main test runner
│   ├── google-mocks.ts      # Google API mocks
│   └── clock.ts             # Time control utilities
└── report/                   # Generated reports
    ├── results.json         # Raw test results
    └── results.md           # Human-readable report
```

## Test Cases

Each test case in `cases/` is a JSON file that defines:

- **Scenario setup**: Current time, policy configuration, event details
- **Mock data**: Simulated Google Calendar responses
- **Expected outcomes**: What violations should be detected

### Case Format

```json
{
  "name": "test_case_name",
  "nowISO": "2025-03-10T08:00:00-04:00",
  "policyTimeZone": "America/New_York",
  "businessHoursByWeekday": {
    "1": {"start":"09:00","end":"17:00"},
    "2": {"start":"09:00","end":"17:00"},
    "3": {"start":"09:00","end":"17:00"},
    "4": {"start":"09:00","end":"17:00"},
    "5": {"start":"09:00","end":"17:00"}
  },
  "minNoticeHours": 24,
  "calendarId": "primary",
  "calendarsToCheck": ["primary"],
  "treatTentativeAsBusy": true,
  "ignoreDeclined": true,
  "originalEvent": {
    "startISO": "2025-03-12T10:00:00-04:00",
    "endISO": "2025-03-12T11:00:00-04:00",
    "timeZone": "America/New_York"
  },
  "proposedStartISO": "2025-03-11T07:59:00-04:00",
  "proposedEndISO": "2025-03-11T08:59:00-04:00",
  "mockFreeBusy": [],
  "expected": {
    "pass": false,
    "violations": ["NOTICE_TOO_SOON"]
  }
}
```

## Running Tests

```bash
# Run all tests
npm run eval

# Run tests and open report
npm run eval:update

# Run specific test case
npx tsx runner/run-evals.ts --case happy_within_hours_no_conflict
```

## Test Categories

### 1. Notice Period Tests
- `happy_within_hours_no_conflict.json` - Valid reschedule with sufficient notice
- `boundary_exactly_24h_notice.json` - Edge case: exactly 24 hours notice
- `too_soon_23h_59m.json` - Invalid: 23 hours 59 minutes notice

### 2. Business Hours Tests
- `outside_business_hours_start.json` - Start time before business hours
- `outside_business_hours_end.json` - End time after business hours
- `weekend_no_hours_defined.json` - Weekend with no business hours

### 3. Conflict Detection Tests
- `conflict_busy_event_overlap.json` - Overlapping busy event
- `conflict_tentative_counts_as_busy.json` - Tentative event treated as busy
- `conflict_declined_ignored.json` - Declined event ignored
- `allday_event_blocks_busy.json` - All-day event blocking

### 4. Multi-Calendar Tests
- `multi_calendar_conflict.json` - Conflict in secondary calendar

### 5. Timezone & DST Tests
- `dst_spring_forward_boundary.json` - DST spring forward edge case
- `dst_fall_back_overlap.json` - DST fall back edge case
- `cross_tz_user_vs_policy.json` - Cross-timezone user vs policy

## Violation Codes

- `NOTICE_TOO_SOON` - Proposed time is too soon (less than minNoticeHours)
- `BUSINESS_HOURS_OUTSIDE` - Proposed time is outside business hours
- `TIME_CONFLICT` - Proposed time conflicts with existing events

## CI Integration

The test suite is designed for CI/CD integration:

- Exit code 0: All tests pass
- Exit code 1: One or more tests fail
- Generates artifacts: `report/results.md` and `report/results.json`

## Adding New Test Cases

1. Create a new JSON file in `cases/`
2. Follow the case format above
3. Run `npm run eval` to verify
4. Commit the new test case

## Mock Data Format

### FreeBusy Mock
```json
"mockFreeBusy": [
  {
    "calendarId": "primary",
    "busy": [
      {
        "start": "2025-03-11T10:00:00-04:00",
        "end": "2025-03-11T11:00:00-04:00"
      }
    ]
  }
]
```

### Events List Mock
```json
"mockEvents": [
  {
    "id": "event1",
    "summary": "Busy Meeting",
    "start": {"dateTime": "2025-03-11T10:00:00-04:00"},
    "end": {"dateTime": "2025-03-11T11:00:00-04:00"},
    "status": "confirmed"
  }
]
```
