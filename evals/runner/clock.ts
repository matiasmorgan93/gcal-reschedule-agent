import { DateTime } from 'luxon';

let frozenNow: DateTime | null = null;

/**
 * Freeze the current time for testing purposes
 */
export function freezeTime(nowISO: string): void {
  frozenNow = DateTime.fromISO(nowISO);
}

/**
 * Unfreeze time and return to real time
 */
export function unfreezeTime(): void {
  frozenNow = null;
}

/**
 * Get the current time (either frozen or real)
 */
export function now(): DateTime {
  return frozenNow || DateTime.now();
}

/**
 * Get the current time as ISO string
 */
export function nowISO(): string {
  return now().toISO();
}

/**
 * Check if time is currently frozen
 */
export function isTimeFrozen(): boolean {
  return frozenNow !== null;
}

/**
 * Get the frozen time if set
 */
export function getFrozenTime(): DateTime | null {
  return frozenNow;
}
