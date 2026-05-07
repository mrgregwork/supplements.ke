import { describe, it, expect, vi } from 'vitest';

// Mock DB module so auth.ts can be imported without a real DATABASE_URL
vi.mock('../../server/db', () => ({
  db: {},
  pool: {},
}));

import { generateOtpCode, isValidEmail, isValidPhone } from '../lib/auth';

describe('generateOtpCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateOtpCode();
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('stays within 100000–999999 range', () => {
    for (let i = 0; i < 100; i++) {
      const n = parseInt(generateOtpCode(), 10);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it('produces varied output (not constant)', () => {
    const codes = new Set(Array.from({ length: 20 }, generateOtpCode));
    expect(codes.size).toBeGreaterThan(5);
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('greg@kentexcargo.com')).toBe(true);
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    expect(isValidEmail('a@b.io')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain')).toBe(false);
    expect(isValidEmail('no@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts valid phone numbers', () => {
    expect(isValidPhone('+254712345678')).toBe(true);
    expect(isValidPhone('0712345678')).toBe(true);
    expect(isValidPhone('+1 800 555 0100')).toBe(true);
  });

  it('rejects short or non-numeric strings', () => {
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('abcdefghij')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});
