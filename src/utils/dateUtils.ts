/**
 * Date utility functions for consent management
 */

/**
 * Calculate the number of days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // hours * minutes * seconds * milliseconds
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / oneDay);
}

/**
 * Calculate the number of months between two dates
 */
export function monthsBetween(date1: Date, date2: Date): number {
  const months = (date2.getFullYear() - date1.getFullYear()) * 12;
  return Math.abs(months + date2.getMonth() - date1.getMonth());
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Check if a date is within the next N days
 */
export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const futureDate = addDays(now, days);
  return date.getTime() >= now.getTime() && date.getTime() <= futureDate.getTime();
}

/**
 * Parse a date string safely
 */
export function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date for HubSpot (ISO 8601 format)
 */
export function formatForHubSpot(date: Date): string {
  return date.toISOString();
}

/**
 * Get midnight UTC for a date
 */
export function getMidnightUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Calculate consent expiry date based on consent date and expiry period
 */
export function calculateConsentExpiry(consentDate: Date, expiryMonths: number): Date {
  return addMonths(consentDate, expiryMonths);
}

/**
 * Check if consent has expired or will expire within the grace period
 */
export function isConsentExpiring(
  consentDate: Date | null,
  expiryMonths: number,
  gracePeriodDays: number
): boolean {
  if (!consentDate) return true;
  
  const expiryDate = calculateConsentExpiry(consentDate, expiryMonths);
  const gracePeriodStart = addDays(new Date(), gracePeriodDays);
  
  return expiryDate.getTime() <= gracePeriodStart.getTime();
}

/**
 * Check if a contact is inactive based on last activity date
 */
export function isInactive(
  lastActivityDate: Date | null,
  inactivityThresholdMonths: number
): boolean {
  if (!lastActivityDate) return true;
  
  const thresholdDate = addMonths(new Date(), -inactivityThresholdMonths);
  return lastActivityDate.getTime() < thresholdDate.getTime();
}
