#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { freezeTime, unfreezeTime } from './clock';
import { setMockData, clearMockData, createMockCalendarClient } from './google-mocks';
import { validateReschedule, ValidationInput } from '@/lib/guardrails/validateReschedule';
import { GuardrailPolicy } from '@/config/guardrails';

interface TestCase {
  name: string;
  nowISO: string;
  policyTimeZone?: string;
  businessHoursByWeekday: Record<string, { start: string; end: string }>;
  minNoticeHours: number;
  calendarId: string;
  calendarsToCheck: string[];
  treatTentativeAsBusy: boolean;
  ignoreDeclined: boolean;
  originalEvent: {
    startISO: string;
    endISO: string;
    timeZone: string;
  };
  proposedStartISO: string;
  proposedEndISO: string;
  mockFreeBusy: Array<{
    calendarId: string;
    busy: Array<{ start: string; end: string; status?: string }>;
  }>;
  mockEvents?: Array<{
    id: string;
    summary?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    status?: string;
    attendees?: Array<{ self?: boolean; responseStatus?: string }>;
  }>;
  expected: {
    pass: boolean;
    violations: string[];
  };
}

interface TestResult {
  caseName: string;
  unitTest: {
    passed: boolean;
    violations: string[];
    error?: string;
  };
  apiTest: {
    passed: boolean;
    violations: string[];
    error?: string;
  };
  overallPassed: boolean;
  flakeDetected: boolean;
}

interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    flakeDetected: boolean;
  };
  violations: {
    NOTICE_TOO_SOON: number;
    BUSINESS_HOURS_OUTSIDE: number;
    TIME_CONFLICT: number;
  };
  results: TestResult[];
}

/**
 * Load all test cases from the cases directory
 */
function loadTestCases(): TestCase[] {
  const casesDir = path.join(__dirname, '..', 'cases');
  const caseFiles = fs.readdirSync(casesDir).filter(file => file.endsWith('.json'));
  
  return caseFiles.map(file => {
    const filePath = path.join(casesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as TestCase;
  });
}

/**
 * Load default policy
 */
function loadDefaultPolicy(): GuardrailPolicy {
  const policyPath = path.join(__dirname, '..', 'policy.default.json');
  const content = fs.readFileSync(policyPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create effective policy from test case
 */
function createEffectivePolicy(testCase: TestCase, defaultPolicy: GuardrailPolicy): GuardrailPolicy {
  return {
    ...defaultPolicy,
    minNoticeHours: testCase.minNoticeHours,
    policyTimeZone: testCase.policyTimeZone,
    businessHoursByWeekday: testCase.businessHoursByWeekday,
    calendarsToCheck: testCase.calendarsToCheck,
    treatTentativeAsBusy: testCase.treatTentativeAsBusy,
    ignoreDeclined: testCase.ignoreDeclined,
  };
}

/**
 * Create original event from test case
 */
function createOriginalEvent(testCase: TestCase) {
  return {
    id: 'test-event-1',
    summary: 'Test Event',
    start: {
      dateTime: testCase.originalEvent.startISO,
      timeZone: testCase.originalEvent.timeZone,
    },
    end: {
      dateTime: testCase.originalEvent.endISO,
      timeZone: testCase.originalEvent.timeZone,
    },
  };
}

/**
 * Run unit test (direct validation)
 */
async function runUnitTest(testCase: TestCase, policy: GuardrailPolicy): Promise<{ passed: boolean; violations: string[]; error?: string }> {
  try {
    // Create validation input
    const validationInput: ValidationInput = {
      originalEvent: createOriginalEvent(testCase),
      proposedStartISO: testCase.proposedStartISO,
      proposedEndISO: testCase.proposedEndISO,
      userTimeZone: testCase.policyTimeZone,
      calendarId: testCase.calendarId,
      accessToken: 'mock-token',
    };

    // Run validation with policy override
    // The Google client functions will automatically use mocks when setMockData is called
    const violations = await validateReschedule(validationInput, policy);
    const violationCodes = violations.map(v => v.code);

    const passed = violationCodes.length === 0 === testCase.expected.pass;
    return { passed, violations: violationCodes };
  } catch (error) {
    return { 
      passed: false, 
      violations: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Run API test (integration test)
 */
async function runApiTest(testCase: TestCase, policy: GuardrailPolicy): Promise<{ passed: boolean; violations: string[]; error?: string }> {
  try {
    // Create request body
    const requestBody = {
      eventId: 'test-event-1',
      newDate: new Date(testCase.proposedStartISO).toISOString().split('T')[0],
      newTime: new Date(testCase.proposedStartISO).toTimeString().slice(0, 5),
      keepDuration: true,
      userTimeZone: testCase.policyTimeZone,
    };

    // Mock the request object
    const mockRequest = {
      cookies: {
        get: (name: string) => ({ value: 'mock-token' }),
      },
      json: async () => requestBody,
    };

    // Import and run the API route
    // The Google client functions will automatically use mocks when setMockData is called
    const { POST } = await import('@/app/api/validate-reschedule/route');
    const response = await POST(mockRequest as any);
    const data = await response.json();

    const violations = data.violations?.map((v: any) => v.code) || [];
    const passed = violations.length === 0 === testCase.expected.pass;
    return { passed, violations };
  } catch (error) {
    return { 
      passed: false, 
      violations: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Run a single test case
 */
async function runTestCase(testCase: TestCase, defaultPolicy: GuardrailPolicy): Promise<TestResult> {
  console.log(`Running test case: ${testCase.name}`);

  // Freeze time
  freezeTime(testCase.nowISO);

  try {
    // Create effective policy
    const policy = createEffectivePolicy(testCase, defaultPolicy);

    // Set up mocks once for both tests
    setMockData({
      mockFreeBusy: testCase.mockFreeBusy,
      mockEvents: testCase.mockEvents,
      treatTentativeAsBusy: testCase.treatTentativeAsBusy,
      ignoreDeclined: testCase.ignoreDeclined,
      originalEvent: createOriginalEvent(testCase),
    });

    // Run unit test
    const unitResult = await runUnitTest(testCase, policy);

    // Run API test (mocks are still set)
    const apiResult = await runApiTest(testCase, policy);

    // Check for flake (unit and API disagree)
    const flakeDetected = unitResult.passed !== apiResult.passed || 
      JSON.stringify(unitResult.violations.sort()) !== JSON.stringify(apiResult.violations.sort());

    // Overall pass if both tests pass and no flake
    const overallPassed = unitResult.passed && apiResult.passed && !flakeDetected;

    return {
      caseName: testCase.name,
      unitTest: unitResult,
      apiTest: apiResult,
      overallPassed,
      flakeDetected,
    };
  } finally {
    // Unfreeze time
    unfreezeTime();
    // Clear mocks
    clearMockData();
  }
}

/**
 * Generate plain text report for terminal display
 */
function generateTerminalReport(report: TestReport): string {
  const { summary, results } = report;
  
  let output = `\n📊 RESCHEDULER MICRO-EVAL REPORT\n`;
  output += `================================\n\n`;
  
  // Summary
  output += `SUMMARY:\n`;
  output += `  Total Tests: ${summary.total}\n`;
  output += `  Passed: ${summary.passed}\n`;
  output += `  Failed: ${summary.failed}\n`;
  output += `  Flake Detected: ${summary.flakeDetected ? 'Yes' : 'No'}\n\n`;
  
  // Violations summary
  output += `VIOLATIONS BY TYPE:\n`;
  output += `  NOTICE_TOO_SOON: ${report.violations.NOTICE_TOO_SOON}\n`;
  output += `  BUSINESS_HOURS_OUTSIDE: ${report.violations.BUSINESS_HOURS_OUTSIDE}\n`;
  output += `  TIME_CONFLICT: ${report.violations.TIME_CONFLICT}\n\n`;
  
  // Results table
  output += `TEST RESULTS:\n`;
  output += `┌─────────────────────────────────────┬──────┬──────┬────────────────────┐\n`;
  output += `│ Case                                │ Unit │ API  │ Result             │\n`;
  output += `├─────────────────────────────────────┼──────┼──────┼────────────────────┤\n`;
  
  for (const result of results) {
    const unitStatus = result.unitTest.passed ? '✅' : '❌';
    const apiStatus = result.apiTest.passed ? '✅' : '❌';
    const overallStatus = result.overallPassed ? 'pass' : 'fail';
    
    let resultText = overallStatus;
    if (!result.unitTest.passed && result.unitTest.violations.length > 0) {
      resultText = result.unitTest.violations.join(', ');
    }
    if (result.flakeDetected) {
      resultText += ' (FLAKE)';
    }

    const caseName = result.caseName.padEnd(34);
    const unitCol = unitStatus.padEnd(4);
    const apiCol = apiStatus.padEnd(4);
    const resultCol = resultText.padEnd(18);

    output += `│ ${caseName} │ ${unitCol} │ ${apiCol} │ ${resultCol} │\n`;
  }
  
  output += `└─────────────────────────────────────┴──────┴──────┴────────────────────┘\n\n`;
  
  // Failed test details
  const failedTests = results.filter(r => !r.overallPassed);
  if (failedTests.length > 0) {
    output += `FAILED TEST DETAILS:\n`;
    output += `===================\n\n`;
    
    for (const result of failedTests) {
      output += `${result.caseName}:\n`;
      
      if (!result.unitTest.passed) {
        output += `  Unit Test: FAILED\n`;
        if (result.unitTest.error) {
          output += `    Error: ${result.unitTest.error}\n`;
        }
        if (result.unitTest.violations.length > 0) {
          output += `    Violations: ${result.unitTest.violations.join(', ')}\n`;
        }
      }
      
      if (!result.apiTest.passed) {
        output += `  API Test: FAILED\n`;
        if (result.apiTest.error) {
          output += `    Error: ${result.apiTest.error}\n`;
        }
        if (result.apiTest.violations.length > 0) {
          output += `    Violations: ${result.apiTest.violations.join(', ')}\n`;
        }
      }
      
      if (result.flakeDetected) {
        output += `  Flake Detected: Unit and API tests produced different results\n`;
      }
      
      output += `\n`;
    }
  }
  
  return output;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: TestReport): string {
  const { summary, results } = report;
  
  let markdown = `# Rescheduler Micro-Eval – ${summary.passed}/${summary.total} passing\n\n`;
  
  if (summary.failed > 0) {
    markdown += `⚠️ **${summary.failed} test(s) failed**\n\n`;
  }
  
  if (summary.flakeDetected) {
    markdown += `🚨 **Flake detected**: Unit and API tests disagree\n\n`;
  }

  // Summary table
  markdown += `## Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Tests | ${summary.total} |\n`;
  markdown += `| Passed | ${summary.passed} |\n`;
  markdown += `| Failed | ${summary.failed} |\n`;
  markdown += `| Flake Detected | ${summary.flakeDetected ? 'Yes' : 'No'} |\n\n`;

  // Violations summary
  markdown += `## Violations by Type\n\n`;
  markdown += `| Violation Type | Count |\n`;
  markdown += `|----------------|-------|\n`;
  markdown += `| NOTICE_TOO_SOON | ${report.violations.NOTICE_TOO_SOON} |\n`;
  markdown += `| BUSINESS_HOURS_OUTSIDE | ${report.violations.BUSINESS_HOURS_OUTSIDE} |\n`;
  markdown += `| TIME_CONFLICT | ${report.violations.TIME_CONFLICT} |\n\n`;

  // Results table
  markdown += `## Test Results\n\n`;
  markdown += `| Case | Unit | API | Result |\n`;
  markdown += `|------|------|-----|--------|\n`;

  for (const result of results) {
    const unitStatus = result.unitTest.passed ? '✅' : '❌';
    const apiStatus = result.apiTest.passed ? '✅' : '❌';
    const overallStatus = result.overallPassed ? 'pass' : 'fail';
    
    let resultText = overallStatus;
    if (!result.unitTest.passed && result.unitTest.violations.length > 0) {
      resultText = result.unitTest.violations.join(', ');
    }
    if (result.flakeDetected) {
      resultText += ' (FLAKE)';
    }

    // Pad case name to align columns
    const paddedCaseName = result.caseName.padEnd(25);
    const paddedUnitStatus = unitStatus.padEnd(4);
    const paddedApiStatus = apiStatus.padEnd(4);
    const paddedResultText = resultText.padEnd(20);

    markdown += `| ${paddedCaseName} | ${paddedUnitStatus} | ${paddedApiStatus} | ${paddedResultText} |\n`;
  }

  // Failed test details
  const failedTests = results.filter(r => !r.overallPassed);
  if (failedTests.length > 0) {
    markdown += `\n## Failed Test Details\n\n`;
    
    for (const result of failedTests) {
      markdown += `### ${result.caseName}\n\n`;
      
      if (!result.unitTest.passed) {
        markdown += `**Unit Test Failed:**\n`;
        if (result.unitTest.error) {
          markdown += `- Error: ${result.unitTest.error}\n`;
        }
        if (result.unitTest.violations.length > 0) {
          markdown += `- Violations: ${result.unitTest.violations.join(', ')}\n`;
        }
        markdown += `\n`;
      }
      
      if (!result.apiTest.passed) {
        markdown += `**API Test Failed:**\n`;
        if (result.apiTest.error) {
          markdown += `- Error: ${result.apiTest.error}\n`;
        }
        if (result.apiTest.violations.length > 0) {
          markdown += `- Violations: ${result.apiTest.violations.join(', ')}\n`;
        }
        markdown += `\n`;
      }
      
      if (result.flakeDetected) {
        markdown += `**Flake Detected:** Unit and API tests produced different results\n\n`;
      }
    }
  }

  return markdown;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const specificCase = args.find(arg => arg.startsWith('--case='))?.split('=')[1];

  console.log('🚀 Starting Google Calendar Rescheduler Micro-Evaluation Suite\n');

  try {
    // Load test cases
    const allCases = loadTestCases();
    const testCases = specificCase 
      ? allCases.filter(c => c.name === specificCase)
      : allCases;

    if (testCases.length === 0) {
      console.error('No test cases found');
      process.exit(1);
    }

    console.log(`📋 Loaded ${testCases.length} test case(s)`);

    // Load default policy
    const defaultPolicy = loadDefaultPolicy();

    // Run all test cases
    const results: TestResult[] = [];
    const violations = {
      NOTICE_TOO_SOON: 0,
      BUSINESS_HOURS_OUTSIDE: 0,
      TIME_CONFLICT: 0,
    };

    for (const testCase of testCases) {
      const result = await runTestCase(testCase, defaultPolicy);
      results.push(result);

      // Count violations
      result.unitTest.violations.forEach(v => {
        if (v in violations) {
          violations[v as keyof typeof violations]++;
        }
      });
    }

    // Generate report
    const summary = {
      total: results.length,
      passed: results.filter(r => r.overallPassed).length,
      failed: results.filter(r => !r.overallPassed).length,
      flakeDetected: results.some(r => r.flakeDetected),
    };

    const report: TestReport = {
      summary,
      violations,
      results,
    };

    // Write JSON report
    const reportDir = path.join(__dirname, '..', 'report');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(reportDir, 'results.json'),
      JSON.stringify(report, null, 2)
    );

    // Write markdown report
    const markdown = generateMarkdownReport(report);
    fs.writeFileSync(path.join(reportDir, 'results.md'), markdown);

    // Generate and display terminal report
    const terminalReport = generateTerminalReport(report);
    console.log(terminalReport);

    console.log('📄 Reports generated:');
    console.log(`- JSON: ${path.join(reportDir, 'results.json')}`);
    console.log(`- Markdown: ${path.join(reportDir, 'results.md')}`);

    // Exit with appropriate code
    if (summary.failed > 0 || summary.flakeDetected) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
