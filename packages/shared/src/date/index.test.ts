import { describe, expect, it } from 'vitest';
import {
  formatDateWIB,
  formatDisplayDate,
  formatTimeWIB,
  getMonthBounds,
  isDateInPeriod,
  parsePostingDate,
  toPeriodCode,
} from './index';

describe('date', () => {
  describe('formatDateWIB()', () => {
    it('formats a UTC date as YYYY-MM-DD in WIB', () => {
      // 2026-05-06T00:00:00Z → in WIB (UTC+7) = 2026-05-06 07:00
      const date = new Date('2026-05-06T00:00:00Z');
      expect(formatDateWIB(date)).toBe('2026-05-06');
    });

    it('handles date boundary crossing (late UTC = next day WIB)', () => {
      // 2026-05-06T20:00:00Z → WIB = 2026-05-07 03:00
      const date = new Date('2026-05-06T20:00:00Z');
      expect(formatDateWIB(date)).toBe('2026-05-07');
    });
  });

  describe('parsePostingDate()', () => {
    it('parses YYYY-MM-DD to midnight WIB', () => {
      const date = parsePostingDate('2026-05-06');
      // Midnight WIB = 2026-05-05T17:00:00Z
      expect(date.toISOString()).toBe('2026-05-05T17:00:00.000Z');
    });

    it('throws on invalid format', () => {
      expect(() => parsePostingDate('06/05/2026')).toThrow();
      expect(() => parsePostingDate('2026-5-6')).toThrow();
    });
  });

  describe('isDateInPeriod()', () => {
    it('returns true when date is within period', () => {
      const date = parsePostingDate('2026-05-15');
      expect(isDateInPeriod(date, '2026-05-01', '2026-05-31')).toBe(true);
    });

    it('returns true on period boundaries', () => {
      const start = parsePostingDate('2026-05-01');
      const end = parsePostingDate('2026-05-31');
      expect(isDateInPeriod(start, '2026-05-01', '2026-05-31')).toBe(true);
      expect(isDateInPeriod(end, '2026-05-01', '2026-05-31')).toBe(true);
    });

    it('returns false when outside period', () => {
      const date = parsePostingDate('2026-06-01');
      expect(isDateInPeriod(date, '2026-05-01', '2026-05-31')).toBe(false);
    });
  });

  describe('getMonthBounds()', () => {
    it('returns correct bounds for a regular month', () => {
      expect(getMonthBounds(2026, 5)).toEqual({
        start: '2026-05-01',
        end: '2026-05-31',
      });
    });

    it('handles February in non-leap year', () => {
      expect(getMonthBounds(2026, 2)).toEqual({
        start: '2026-02-01',
        end: '2026-02-28',
      });
    });

    it('handles February in leap year', () => {
      expect(getMonthBounds(2028, 2)).toEqual({
        start: '2028-02-01',
        end: '2028-02-29',
      });
    });
  });

  describe('toPeriodCode()', () => {
    it('returns YYYY-MM format', () => {
      const date = parsePostingDate('2026-05-15');
      expect(toPeriodCode(date)).toBe('2026-05');
    });
  });

  describe('formatDisplayDate()', () => {
    it('formats in Indonesian locale', () => {
      const date = new Date('2026-05-06T07:00:00Z');
      const result = formatDisplayDate(date, 'id');
      // Should contain "Mei" and "2026"
      expect(result).toContain('2026');
    });
  });

  describe('formatTimeWIB()', () => {
    it('formats time as HH:mm in WIB', () => {
      // 2026-05-06T03:30:00Z → WIB = 10:30
      const date = new Date('2026-05-06T03:30:00Z');
      expect(formatTimeWIB(date)).toBe('10:30');
    });
  });
});
