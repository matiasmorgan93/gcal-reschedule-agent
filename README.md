# Google Calendar Rescheduler

A modern web application for rescheduling Google Calendar events with intelligent guardrails and AI assistance.

## Features

- **Google OAuth Integration** - Secure authentication with Google Calendar API
- **Smart Guardrails** - Automatic validation of reschedule requests
- **Business Hours Enforcement** - Respects configured business hours
- **Conflict Detection** - Prevents double-booking and scheduling conflicts
- **Multi-Calendar Support** - Check availability across multiple calendars
- **Timezone Awareness** - Handles DST transitions and cross-timezone scenarios

## Demos

### **1. Agent demo** 
https://www.loom.com/share/6dda9645279943b2aa64c3215bbb2c28

### 2. Simulation suite demo
[need to record it]

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Project with Calendar API enabled
- Google OAuth 2.0 credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gcal-rescheduler-agent
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your Google OAuth credentials:
```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

### Frontend (Next.js)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** components for accessibility
- **Luxon** for timezone handling

### Backend (Next.js API Routes)
- **Google Calendar API** integration
- **Guardrail validation** system
- **OAuth 2.0** authentication flow

### Guardrails System
The application enforces several guardrails to ensure responsible rescheduling:

1. **Notice Period** - Minimum advance notice (default: 24 hours)
2. **Business Hours** - Only allow scheduling during configured business hours
3. **Conflict Detection** - Prevent double-booking using Google's FreeBusy API
4. **Multi-Calendar Support** - Check availability across multiple calendars
5. **Event Status Handling** - Respect tentative/declined event statuses

## Configuration

### Guardrail Policy

Configure guardrails in `config/guardrails.ts` or via environment variables:

```typescript
export const defaultPolicy: GuardrailPolicy = {
  minNoticeHours: 24,
  policyTimeZone: 'America/New_York',
  businessHoursByWeekday: {
    1: { start: '09:00', end: '17:00' }, // Monday
    2: { start: '09:00', end: '17:00' }, // Tuesday
    3: { start: '09:00', end: '17:00' }, // Wednesday
    4: { start: '09:00', end: '17:00' }, // Thursday
    5: { start: '09:00', end: '17:00' }, // Friday
  },
  calendarsToCheck: ['primary'],
  treatTentativeAsBusy: true,
  ignoreDeclined: true,
  conflictMethod: 'freebusy',
};
```

## Testing

### Micro-Evaluation Suite

The project includes a comprehensive micro-evaluation suite for testing guardrail logic:

```bash
# Run all evaluation tests
npm run eval

# Run tests and open report
npm run eval:update

# Run specific test case
npx tsx evals/runner/run-evals.ts --case happy_within_hours_no_conflict
```

#### Test Categories

- **Notice Period Tests** - Validates minimum advance notice requirements
- **Business Hours Tests** - Ensures scheduling within business hours
- **Conflict Detection Tests** - Verifies conflict detection logic
- **Multi-Calendar Tests** - Tests cross-calendar availability checking
- **Timezone & DST Tests** - Handles timezone edge cases

#### Test Structure

Each test case is defined in `evals/cases/` as a JSON file:

```json
{
  "name": "test_case_name",
  "nowISO": "2025-03-10T08:00:00-04:00",
  "policyTimeZone": "America/New_York",
  "businessHoursByWeekday": {
    "1": {"start": "09:00", "end": "17:00"}
  },
  "minNoticeHours": 24,
  "originalEvent": {
    "startISO": "2025-03-12T10:00:00-04:00",
    "endISO": "2025-03-12T11:00:00-04:00"
  },
  "proposedStartISO": "2025-03-12T14:00:00-04:00",
  "proposedEndISO": "2025-03-12T15:00:00-04:00",
  "mockFreeBusy": [],
  "expected": {
    "pass": true,
    "violations": []
  }
}
```

### Unit Tests

```bash
# Run Jest tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## API Reference

### Validate Reschedule

```http
POST /api/validate-reschedule
Content-Type: application/json

{
  "eventId": "event_id",
  "newDate": "2025-03-12",
  "newTime": "14:00",
  "keepDuration": true,
  "userTimeZone": "America/New_York"
}
```

Response:
```json
{
  "valid": true,
  "violations": [],
  "proposedStart": "2025-03-12T14:00:00-04:00",
  "proposedEnd": "2025-03-12T15:00:00-04:00"
}
```

### Reschedule Event

```http
POST /api/reschedule
Content-Type: application/json

{
  "eventId": "event_id",
  "newDate": "2025-03-12",
  "newTime": "14:00",
  "keepDuration": true,
  "userTimeZone": "America/New_York"
}
```

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- **Netlify** - Static export with API routes
- **Railway** - Full-stack deployment
- **AWS** - Using AWS Amplify or custom setup
- **Google Cloud** - Using Cloud Run or App Engine

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Add tests for new functionality
4. Run the evaluation suite: `npm run eval`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure all evaluation tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- Create an issue in the GitHub repository
- Check the [documentation](docs/)
- Review the [evaluation test cases](evals/cases/) for examples
