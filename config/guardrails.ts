export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday=0, Monday=1, etc.

export interface BusinessHours {
  start: string; // "09:00"
  end: string;   // "17:00"
}

export interface GuardrailPolicy {
  minNoticeHours: number;
  policyTimeZone?: string; // IANA timezone
  businessHoursByWeekday: Partial<Record<Weekday, BusinessHours>>;
  calendarsToCheck?: string[];
  treatTentativeAsBusy: boolean;
  ignoreDeclined: boolean;
  conflictMethod: 'freebusy' | 'list';
}

export const defaultPolicy: GuardrailPolicy = {
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
};

export function loadPolicy(): GuardrailPolicy {
  // Try to load from environment variable first
  const envPolicy = process.env.GUARDRAILS_JSON;
  if (envPolicy) {
    try {
      const parsed = JSON.parse(envPolicy);
      return { ...defaultPolicy, ...parsed };
    } catch (error) {
      console.warn('Failed to parse GUARDRAILS_JSON, using default policy:', error);
    }
  }

  // Try to load from config file
  try {
    // This would be a dynamic import in a real implementation
    // For now, we'll just return the default
    return defaultPolicy;
  } catch (error) {
    console.warn('Failed to load guardrails config file, using default policy:', error);
    return defaultPolicy;
  }
}

// Helper function to validate policy
export function validatePolicy(policy: GuardrailPolicy): string[] {
  const errors: string[] = [];

  if (policy.minNoticeHours < 0) {
    errors.push('minNoticeHours must be non-negative');
  }

  if (policy.policyTimeZone) {
    try {
      // Try to create a date in the timezone to validate it
      new Date().toLocaleString('en-US', { timeZone: policy.policyTimeZone });
    } catch (error) {
      errors.push(`Invalid timezone: ${policy.policyTimeZone}`);
    }
  }

  for (const [weekday, hours] of Object.entries(policy.businessHoursByWeekday)) {
    const day = parseInt(weekday);
    if (day < 0 || day > 6) {
      errors.push(`Invalid weekday: ${weekday}`);
      continue;
    }

    if (!hours.start || !hours.end) {
      errors.push(`Missing start or end time for weekday ${weekday}`);
      continue;
    }

    const startMatch = hours.start.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);
    const endMatch = hours.end.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/);

    if (!startMatch) {
      errors.push(`Invalid start time format for weekday ${weekday}: ${hours.start}`);
    }
    if (!endMatch) {
      errors.push(`Invalid end time format for weekday ${weekday}: ${hours.end}`);
    }

    if (startMatch && endMatch) {
      const startMinutes = parseInt(startMatch[1]) * 60 + parseInt(startMatch[0].split(':')[1]);
      const endMinutes = parseInt(endMatch[1]) * 60 + parseInt(endMatch[0].split(':')[1]);
      
      if (startMinutes >= endMinutes) {
        errors.push(`Start time must be before end time for weekday ${weekday}`);
      }
    }
  }

  if (!['freebusy', 'list'].includes(policy.conflictMethod)) {
    errors.push('conflictMethod must be either "freebusy" or "list"');
  }

  return errors;
}
