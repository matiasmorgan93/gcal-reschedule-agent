# Rescheduler Micro-Eval – 12/14 passing

⚠️ **2 test(s) failed**

🚨 **Flake detected**: Unit and API tests disagree

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 14 |
| Passed | 12 |
| Failed | 2 |
| Flake Detected | Yes |

## Violations by Type

| Violation Type | Count |
|----------------|-------|
| NOTICE_TOO_SOON | 2 |
| BUSINESS_HOURS_OUTSIDE | 6 |
| TIME_CONFLICT | 4 |

## Test Results

| Case | Unit | API | Result |
|------|------|-----|--------|
| allday_event_blocks_busy  | ✅    | ✅    | pass                 |
| boundary_exactly_24h_notice | ✅    | ✅    | pass                 |
| conflict_busy_event_overlap | ✅    | ✅    | pass                 |
| conflict_declined_ignored | ✅    | ✅    | pass                 |
| conflict_tentative_counts_as_busy | ✅    | ✅    | pass                 |
| cross_tz_user_vs_policy   | ✅    | ✅    | pass                 |
| dst_fall_back_overlap     | ✅    | ✅    | pass                 |
| dst_spring_forward_boundary | ✅    | ✅    | pass                 |
| happy_within_hours_no_conflict | ✅    | ✅    | pass                 |
| multi_calendar_conflict   | ✅    | ❌    | fail (FLAKE)         |
| outside_business_hours_end | ✅    | ❌    | fail (FLAKE)         |
| outside_business_hours_start | ✅    | ✅    | pass                 |
| too_soon_23h_59m          | ✅    | ✅    | pass                 |
| weekend_no_hours_defined  | ✅    | ✅    | pass                 |

## Failed Test Details

### multi_calendar_conflict

**API Test Failed:**

**Flake Detected:** Unit and API tests produced different results

### outside_business_hours_end

**API Test Failed:**

**Flake Detected:** Unit and API tests produced different results

