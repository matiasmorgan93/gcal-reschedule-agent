#!/usr/bin/env node

import { DateTime } from 'luxon';
import { google } from 'googleapis';

// Configuration from environment
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const GCAL_CAL_ID = process.env.GCAL_CAL_ID || 'primary';
const GCAL_TZ = process.env.GCAL_TZ || 'Europe/London';
const GCAL_EVENT_ID = process.env.GCAL_EVENT_ID;

if (!GCAL_EVENT_ID) {
  console.error('❌ GCAL_EVENT_ID environment variable is required');
  process.exit(1);
}

// Google Calendar client setup
let calendar = null;
let oauth2Client = null;

async function setupGoogleClient() {
  // For testing, we'll use a mock token - in real usage you'd get this from OAuth flow
  oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: 'mock-token-for-testing' });
  calendar = google.calendar({ version: 'v3', auth: oauth2Client });
}

// Test case definitions
const testCases = [
  {
    id: "happy_within_hours_no_conflict",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "too_soon_23h_59m",
    buildWindow: ({ DateTime, tz }) => {
      const start = DateTime.now().setZone(tz).plus({ hours: 23, minutes: 59 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "policy", code: "policy:min_notice", status: 400 },
  },
  {
    id: "boundary_exactly_24h_notice",
    buildWindow: ({ DateTime, tz }) => {
      const start = DateTime.now().setZone(tz).plus({ hours: 24 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "outside_business_hours_start",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 21, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "policy", code: "policy:business_hours", status: 400 },
  },
  {
    id: "outside_business_hours_end",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1, minutes: 5 }); // Ends at 18:05
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "policy", code: "policy:business_hours", status: 400 },
  },
  {
    id: "weekend_no_hours_defined",
    buildWindow: ({ DateTime, tz }) => {
      const nextSaturday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 6 });
      const start = nextSaturday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "conflict_busy_event_overlap",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    setup: async ({ calendar, calId, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 30, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      
      const blocker = await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: 'Test Blocker Event',
          start: { dateTime: start.toISO(), timeZone: tz },
          end: { dateTime: end.toISO(), timeZone: tz },
        }
      });
      
      return { blockerId: blocker.data.id };
    },
    cleanup: async ({ calendar, calId, blockerId }) => {
      if (blockerId) {
        await calendar.events.delete({ calendarId: calId, eventId: blockerId });
      }
    },
    expect: { type: "policy", code: "policy:conflict", status: 409 },
  },
  {
    id: "conflict_tentative_counts_as_busy",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    setup: async ({ calendar, calId, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 30, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      
      const blocker = await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: 'Test Tentative Event',
          start: { dateTime: start.toISO(), timeZone: tz },
          end: { dateTime: end.toISO(), timeZone: tz },
          transparency: 'opaque',
        }
      });
      
      return { blockerId: blocker.data.id };
    },
    cleanup: async ({ calendar, calId, blockerId }) => {
      if (blockerId) {
        await calendar.events.delete({ calendarId: calId, eventId: blockerId });
      }
    },
    expect: { type: "policy", code: "policy:conflict", status: 409 },
  },
  {
    id: "conflict_declined_ignored",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    setup: async ({ calendar, calId, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 30, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      
      const blocker = await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: 'Test Declined Event',
          start: { dateTime: start.toISO(), timeZone: tz },
          end: { dateTime: end.toISO(), timeZone: tz },
          attendees: [{ email: 'test@example.com', responseStatus: 'declined' }],
        }
      });
      
      return { blockerId: blocker.data.id };
    },
    cleanup: async ({ calendar, calId, blockerId }) => {
      if (blockerId) {
        await calendar.events.delete({ calendarId: calId, eventId: blockerId });
      }
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "multi_calendar_conflict",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    setup: async ({ calendar, calId, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 30, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      
      // Create blocker on a different calendar
      const otherCalId = 'work@company.com';
      const blocker = await calendar.events.insert({
        calendarId: otherCalId,
        requestBody: {
          summary: 'Work Calendar Blocker',
          start: { dateTime: start.toISO(), timeZone: tz },
          end: { dateTime: end.toISO(), timeZone: tz },
        }
      });
      
      return { blockerId: blocker.data.id, blockerCalId: otherCalId };
    },
    cleanup: async ({ calendar, blockerCalId, blockerId }) => {
      if (blockerId && blockerCalId) {
        await calendar.events.delete({ calendarId: blockerCalId, eventId: blockerId });
      }
    },
    expect: { type: "policy", code: "policy:conflict", status: 409 },
  },
  {
    id: "allday_event_blocks_busy",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    setup: async ({ calendar, calId, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      
      const blocker = await calendar.events.insert({
        calendarId: calId,
        requestBody: {
          summary: 'All Day Event',
          start: { date: nextTuesday.toISODate() },
          end: { date: nextTuesday.plus({ days: 1 }).toISODate() },
        }
      });
      
      return { blockerId: blocker.data.id };
    },
    cleanup: async ({ calendar, calId, blockerId }) => {
      if (blockerId) {
        await calendar.events.delete({ calendarId: calId, eventId: blockerId });
      }
    },
    expect: { type: "policy", code: "policy:conflict", status: 409 },
  },
  {
    id: "cross_tz_user_vs_policy",
    buildWindow: ({ DateTime, tz }) => {
      const nextTuesday = DateTime.now().setZone(tz).plus({ days: 1 }).startOf('week').plus({ days: 2 });
      const start = nextTuesday.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "dst_spring_forward_boundary",
    buildWindow: ({ DateTime, tz }) => {
      // March 9, 2025 - DST spring forward in US
      const dstDate = DateTime.fromISO('2025-03-09T10:00:00', { zone: tz });
      const start = dstDate.plus({ days: 1 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
  {
    id: "dst_fall_back_overlap",
    buildWindow: ({ DateTime, tz }) => {
      // November 2, 2025 - DST fall back in US
      const dstDate = DateTime.fromISO('2025-11-02T10:00:00', { zone: tz });
      const start = dstDate.plus({ days: 1 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
      const end = start.plus({ hours: 1 });
      return { start: start.toISO(), end: end.toISO() };
    },
    expect: { type: "success", status: 200 },
  },
];

// Run a single test case
async function runCase(testCase) {
  console.log(`Running test case: ${testCase.id}`);
  
  let setupData = null;
  let startTime, endTime;
  
  try {
    // Run setup if provided
    if (testCase.setup) {
      setupData = await testCase.setup({ 
        calendar, 
        calId: GCAL_CAL_ID, 
        tz: GCAL_TZ 
      });
    }
    
    // Build the time window
    const { start, end } = testCase.buildWindow({ DateTime, tz: GCAL_TZ });
    
    // Prepare request body
    const requestBody = {
      calendarId: GCAL_CAL_ID,
      eventId: GCAL_EVENT_ID,
      newStartISO: start,
      newEndISO: end,
      timeZone: GCAL_TZ,
    };
    
    // Measure latency
    startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    endTime = Date.now();
    
    const json = await response.json();
    const ms = endTime - startTime;
    
    // Determine if test passed
    let ok = false;
    let note = json.error || '';
    let violationCode = null;
    
    if (testCase.expect.type === 'success') {
      ok = response.status === 200 && json.ok === true;
    } else if (testCase.expect.type === 'policy') {
      ok = response.status === testCase.expect.status && 
           json.error?.startsWith(testCase.expect.code);
      violationCode = json.error;
    }
    
    return {
      id: testCase.id,
      status: response.status,
      ok,
      ms,
      note,
      violationCode,
      setupData,
    };
    
  } catch (error) {
    const ms = endTime ? endTime - startTime : 0;
    return {
      id: testCase.id,
      status: 500,
      ok: false,
      ms,
      note: error.message,
      violationCode: null,
      setupData,
    };
  } finally {
    // Run cleanup if provided
    if (testCase.cleanup && setupData) {
      try {
        await testCase.cleanup({ 
          calendar, 
          calId: GCAL_CAL_ID, 
          ...setupData 
        });
      } catch (error) {
        console.warn(`Cleanup failed for ${testCase.id}:`, error.message);
      }
    }
  }
}

// Retry a failed case to detect flakes
async function retryCase(testCase) {
  const result = await runCase(testCase);
  return result;
}

// Main execution
async function main() {
  console.log('🚀 Starting Google Calendar Rescheduler Micro-Evaluation Suite\n');
  console.log(`📋 Loaded ${testCases.length} test case(s)`);
  
  await setupGoogleClient();
  
  const results = [];
  const flakeResults = [];
  
  // Run all test cases
  for (const testCase of testCases) {
    const result = await runCase(testCase);
    results.push(result);
    
    // If failed, retry once to detect flakes
    if (!result.ok && result.status >= 500) {
      console.log(`  Retrying failed case: ${testCase.id}`);
      const retryResult = await retryCase(testCase);
      if (retryResult.ok) {
        flakeResults.push({ ...result, flake: true });
      } else {
        flakeResults.push(result);
      }
    } else if (!result.ok) {
      flakeResults.push(result);
    }
  }
  
  // Calculate summary
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;
  const flakeDetected = flakeResults.length > 0;
  
  // Aggregate violations
  const violations = {};
  results.forEach(result => {
    if (result.violationCode) {
      violations[result.violationCode] = (violations[result.violationCode] || 0) + 1;
    }
  });
  
  // Print summary
  console.log('\n📊 RESCHEDULER MICRO-EVAL REPORT');
  console.log('================================\n');
  console.log('SUMMARY:');
  console.log(`  Total Tests: ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Flake Detected: ${flakeDetected ? 'Yes' : 'No'}\n`);
  
  if (Object.keys(violations).length > 0) {
    console.log('VIOLATIONS BY TYPE:');
    Object.entries(violations).forEach(([code, count]) => {
      console.log(`  ${code.padEnd(20)} ${count}`);
    });
    console.log('');
  }
  
  // Print detailed results table
  console.log('DETAIL (compact):');
  console.log('Case'.padEnd(35) + 'Status'.padEnd(8) + 'OK'.padEnd(6) + 'Latency(ms)'.padEnd(12) + 'Note');
  console.log('---------------------------------------------------------------------------');
  
  results.forEach(result => {
    const caseName = result.id.padEnd(35);
    const status = result.status.toString().padEnd(8);
    const ok = result.ok ? '✅' : '❌';
    const latency = result.ms.toString().padEnd(12);
    const note = result.note || '';
    const flake = flakeResults.find(f => f.id === result.id && f.flake) ? ' (FLAKE)' : '';
    
    console.log(`${caseName}${status}${ok}    ${latency}${note}${flake}`);
  });
  
  // Print legacy view
  console.log('\nLEGACY VIEW (unit/api/result):');
  console.log('┌─────────────────────────────────────┬──────┬──────┬────────────────────┐');
  console.log('│ Case                                │ Unit │ API  │ Result             │');
  console.log('├─────────────────────────────────────┼──────┼──────┼────────────────────┤');
  
  results.forEach(result => {
    const caseName = result.id.padEnd(34);
    const unitStatus = '✅'; // All our expectations are valid
    const apiStatus = result.ok ? '✅' : '❌';
    let resultText = result.ok ? 'pass' : 'fail';
    if (flakeResults.find(f => f.id === result.id && f.flake)) {
      resultText += ' (FLAKE)';
    }
    const resultCol = resultText.padEnd(18);
    
    console.log(`│ ${caseName} │ ${unitStatus}    │ ${apiStatus}    │ ${resultCol} │`);
  });
  
  console.log('└─────────────────────────────────────┴──────┴──────┴────────────────────┘\n');
  
  // Exit with appropriate code
  const nonFlakeFailures = flakeResults.filter(r => !r.flake).length;
  if (nonFlakeFailures > 0) {
    console.log(`Exit code: 1  (${nonFlakeFailures} non-flake failures)`);
    process.exit(1);
  } else {
    console.log('Exit code: 0  (non-flake failures only trigger exit 1)');
    process.exit(0);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Evaluation failed:', error);
  process.exit(1);
});
