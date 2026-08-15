import { describe, it, expect } from 'vitest';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from '../currency';

describe('currency', () => {
  it('defaults to IDR', () => {
    expect(DEFAULT_CURRENCY).toBe('IDR');
  });

  it('defines USD and IDR', () => {
    expect(CURRENCIES.USD.multiplier).toBe(1);
    expect(CURRENCIES.IDR.multiplier).toBe(1_000_000);
  });

  it('formats USD with a dollar sign and thousand separators', () => {
    expect(formatMoney(1500, 'USD')).toContain('$1,500');
  });

  it('formats IDR by applying the 1e6 multiplier', () => {
    expect(formatMoney(1500, 'IDR')).toContain('1.500.000.000');
  });

  it('treats undefined as zero', () => {
    expect(formatMoney(undefined, 'USD')).toContain('0');
  });
});
