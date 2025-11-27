import {
  daysBetween,
  monthsBetween,
  addMonths,
  addDays,
  isPast,
  isWithinDays,
  parseDate,
  formatForHubSpot,
  getMidnightUTC,
  calculateConsentExpiry,
  isConsentExpiring,
  isInactive
} from '../../src/utils/dateUtils';

describe('Date Utilities', () => {
  describe('daysBetween', () => {
    it('should calculate days between two dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-10');
      expect(daysBetween(date1, date2)).toBe(9);
    });

    it('should return same result regardless of order', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-10');
      expect(daysBetween(date1, date2)).toBe(daysBetween(date2, date1));
    });

    it('should return 0 for same date', () => {
      const date = new Date('2024-01-01');
      expect(daysBetween(date, date)).toBe(0);
    });
  });

  describe('monthsBetween', () => {
    it('should calculate months between two dates', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-06-15');
      expect(monthsBetween(date1, date2)).toBe(5);
    });

    it('should handle year boundaries', () => {
      const date1 = new Date('2023-11-01');
      const date2 = new Date('2024-02-01');
      expect(monthsBetween(date1, date2)).toBe(3);
    });
  });

  describe('addMonths', () => {
    it('should add months to a date', () => {
      const date = new Date('2024-01-15');
      const result = addMonths(date, 3);
      expect(result.getMonth()).toBe(3); // April (0-indexed)
    });

    it('should handle year boundary', () => {
      const date = new Date('2024-11-15');
      const result = addMonths(date, 3);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should not modify original date', () => {
      const date = new Date('2024-01-15');
      const original = new Date(date);
      addMonths(date, 3);
      expect(date.getTime()).toBe(original.getTime());
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date('2024-01-15');
      const result = addDays(date, 10);
      expect(result.getDate()).toBe(25);
    });

    it('should handle month boundary', () => {
      const date = new Date('2024-01-28');
      const result = addDays(date, 5);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(2);
    });
  });

  describe('isPast', () => {
    it('should return true for past date', () => {
      const pastDate = new Date('2020-01-01');
      expect(isPast(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date('2030-01-01');
      expect(isPast(futureDate)).toBe(false);
    });
  });

  describe('isWithinDays', () => {
    it('should return true for date within range', () => {
      const futureDate = addDays(new Date(), 5);
      expect(isWithinDays(futureDate, 10)).toBe(true);
    });

    it('should return false for date outside range', () => {
      const futureDate = addDays(new Date(), 15);
      expect(isWithinDays(futureDate, 10)).toBe(false);
    });

    it('should return false for past date', () => {
      const pastDate = addDays(new Date(), -5);
      expect(isWithinDays(pastDate, 10)).toBe(false);
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const result = parseDate('2024-01-15T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return null for null input', () => {
      expect(parseDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseDate('invalid-date')).toBeNull();
    });
  });

  describe('formatForHubSpot', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      expect(formatForHubSpot(date)).toBe(date.toISOString());
    });
  });

  describe('getMidnightUTC', () => {
    it('should set time to midnight UTC', () => {
      const date = new Date('2024-01-15T15:30:45Z');
      const result = getMidnightUTC(date);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('calculateConsentExpiry', () => {
    it('should calculate expiry date correctly', () => {
      const consentDate = new Date('2024-01-15');
      const expiryDate = calculateConsentExpiry(consentDate, 24);
      expect(expiryDate.getFullYear()).toBe(2026);
      expect(expiryDate.getMonth()).toBe(0); // January
    });
  });

  describe('isConsentExpiring', () => {
    it('should return true when consent is expired', () => {
      const oldConsentDate = addMonths(new Date(), -25);
      expect(isConsentExpiring(oldConsentDate, 24, 30)).toBe(true);
    });

    it('should return true when consent is within grace period', () => {
      // Consent that will expire in 15 days (within 30 day grace)
      const almostExpired = addMonths(new Date(), -24);
      almostExpired.setDate(almostExpired.getDate() + 15);
      expect(isConsentExpiring(almostExpired, 24, 30)).toBe(true);
    });

    it('should return false when consent is not expiring', () => {
      const recentConsent = new Date();
      expect(isConsentExpiring(recentConsent, 24, 30)).toBe(false);
    });

    it('should return true for null consent date', () => {
      expect(isConsentExpiring(null, 24, 30)).toBe(true);
    });
  });

  describe('isInactive', () => {
    it('should return true when last activity is beyond threshold', () => {
      const oldActivity = addMonths(new Date(), -25);
      expect(isInactive(oldActivity, 24)).toBe(true);
    });

    it('should return false when last activity is recent', () => {
      const recentActivity = new Date();
      expect(isInactive(recentActivity, 24)).toBe(false);
    });

    it('should return true for null last activity date', () => {
      expect(isInactive(null, 24)).toBe(true);
    });
  });
});
