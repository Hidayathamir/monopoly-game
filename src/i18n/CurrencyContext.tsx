import { createContext, useContext, useState, type ReactNode } from 'react'
import { ID_IDR_ENABLED } from '../config/features'
import { DEFAULT_CURRENCY, formatMoney as formatMoneyFor, type Currency } from '../data/currency'

const STORAGE_KEY = 'monopoly-currency'

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (c: Currency) => void
  formatMoney: (amount: number | undefined) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function readSavedCurrency(enabled = ID_IDR_ENABLED): Currency {
  if (!enabled) return DEFAULT_CURRENCY
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'IDR' || saved === 'USD' ? saved : DEFAULT_CURRENCY
  } catch {
    return DEFAULT_CURRENCY
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(readSavedCurrency)

  const setCurrency = (c: Currency) => {
    const next = ID_IDR_ENABLED ? c : DEFAULT_CURRENCY
    setCurrencyState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    formatMoney: (amount) => formatMoneyFor(amount, currency),
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider')
  return ctx
}
