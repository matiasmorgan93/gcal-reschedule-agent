# Demo Setup Guide for Loom Recording

## Pre-Recording Checklist

### 1. App Setup
- [ ] Next.js app running at `http://localhost:3000`
- [ ] Terminal ready in project root
- [ ] One test event on your Google Calendar (note the event ID)

### 2. Environment Variables
Set these in your terminal:

```bash
# For mock mode (deterministic, fast)
export MODE=mock
export GCAL_CAL_ID="primary"
export GCAL_TZ="Europe/London"
export GCAL_EVENT_ID="your-test-event-id"

# For live mode (real API calls)
export MODE=live
export GCAL_CAL_ID="primary"
export GCAL_TZ="Europe/London"
export GCAL_EVENT_ID="your-test-event-id"
```

### 3. Google Calendar Authentication (for live mode)
- [ ] `credentials.json` file in project root (service account)
- [ ] OR `token.json` file in project root (OAuth token)

## Demo Commands

### Mock Mode (Fast & Deterministic)
```bash
MODE=mock npm run eval:micro
```

### Live Mode (Real API Calls)
```bash
MODE=live npm run eval:micro
```

### Specific Test Cases
```bash
MODE=live npm run eval:micro -- --cases=happy_within_hours_no_conflict,too_soon_23h_59m
```

## Demo Flow

### 0-10s: Title & Purpose
- Show app homepage + `tests/` folder
- "Quick demo of a small action-taking agent plus a micro-eval that we use to gate changes"

### 10-30s: Agent & Guardrails (Live UI)
- Select "Test Meeting" → choose next Tue 10:00 → Reschedule
- Show success toast + "Open in Calendar" link
- Change time to within 2h → show refusal (`policy:min_notice`)
- Set 21:00 → refusal (`policy:business_hours`)
- Try overlapping time → refusal (`policy:conflict`)

### 30-65s: Micro-Eval Run (Mock → Deterministic & Fast)
```bash
MODE=mock npm run eval:micro
```
- Point to the table showing policy codes and latency
- "Note the policy codes and latency per case; our script returns exit 1 on non-flake failures"

### 65-85s: Live Spot-Check (Two Cases)
```bash
MODE=live npm run eval:micro -- --cases=happy_within_hours_no_conflict,too_soon_23h_59m
```
- Show real HTTP statuses and latency numbers

### 85-95s: Close (SLOs + Scaling)
- "We gate releases on success, containment-style refusals, policy-correctness, and p95 latency thresholds"

## Expected Output Format

```
🚀 Starting Google Calendar Rescheduler Micro-Evaluation Suite

📋 Loaded 14 test case(s)
Running test case: happy_within_hours_no_conflict
Running test case: too_soon_23h_59m
...

📊 RESCHEDULER MICRO-EVAL REPORT
================================

SUMMARY:
  Total Tests: 14
  Passed: 12
  Failed: 2
  Flake Detected: Yes

VIOLATIONS BY TYPE:
  policy:min_notice    1
  policy:business_hours 2
  policy:conflict      4

DETAIL (compact):
Case                               Status  OK    Latency(ms) Note
---------------------------------------------------------------------------
happy_within_hours_no_conflict     200     ✅    820
too_soon_23h_59m                   400     ✅    6          policy:min_notice
...
```

## Key Features to Highlight

- **Guardrails**: Business hours, ≥24h notice, conflict checks
- **HITL**: Human-in-the-loop confirmation
- **Post-verify**: Actions verified by reading event back
- **Policy-coded refusals**: Machine-checkable error codes
- **Sim suite**: Mock vs live testing
- **Flake detection**: Auto-retry for transient failures
- **SLO gates**: Latency thresholds and success rates
- **CI-ready**: Exit codes for automation
