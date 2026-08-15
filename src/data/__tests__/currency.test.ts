import { describe, it, expect } from 'vitest';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '../currency';

describe('currency', () => {
  it('defaults to USD', () => {
    expect(DEFAULT_CURRENCY).toBe('USD');
  });

  it('defines USD and IDR', () => {
    expect(CURRENCIES.USD.multiplier).toBe(1);
    expect(CURRENCIES.IDR.multiplier).toBe(1_000_000);
  });

  it('formats USD with compact notation', () => {
    expect(formatMoney(1500, 'USD')).toContain('$1.5K');
    expect(formatMoney(2000, 'USD')).toContain('$2K');
    expect(formatMoney(60, 'USD')).toContain('$60');
  });

  it('formats IDR by applying the 1e6 multiplier in compact notation', () => {
    expect(formatMoney(1500, 'IDR')).toContain('1,5');
    expect(formatMoney(1500, 'IDR')).toContain('M');
  });

  it('treats undefined as zero', () => {
    expect(formatMoney(undefined, 'USD')).toContain('$0');
  });
});
