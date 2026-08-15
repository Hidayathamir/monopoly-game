export type Currency = 'USD' | 'IDR'

export interface CurrencyDef {
  code: Currency
  multiplier: number
  locale: string
  currency: string
}

export const CURRENCIES: Record<Currency, CurrencyDef> = {
  USD: { code: 'USD', multiplier: 1, locale: 'en-US', currency: 'USD' },
  IDR: { code: 'IDR', multiplier: 1_000_000, locale: 'id-ID', currency: 'IDR' },
}

export const DEFAULT_CURRENCY: Currency = 'IDR'

export function formatMoney(amount: number | undefined, currency: Currency = DEFAULT_CURRENCY): string {
  if (amount === undefined) amount = 0
  const def = CURRENCIES[currency]
  const value = amount * def.multiplier
  return new Intl.NumberFormat(def.locale, {
    style: 'currency',
    currency: def.currency,
    maximumFractionDigits: 0,
  }).format(value)
}
