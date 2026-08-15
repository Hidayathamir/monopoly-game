import { createContext, useContext, useState, type ReactNode } from 'react'
import { DEFAULT_CURRENCY, formatMoney as formatMoneyFor, type Currency } from '../data/currency'

const STORAGE_KEY = 'monopoly-currency'

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (c: Currency) => void
  formatMoney: (amount: number | undefined) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

function readSavedCurrency(): Currency {
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
    setCurrencyState(c)
    try {
      localStorage.setItem(STORAGE_KEY, c)
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

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider')
  return ctx
}
