import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../i18n/CurrencyContext'
import type { Currency } from '../data/currency'

export default function LanguageCurrencyBar() {
  const { t, i18n } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed top-2 right-2 z-[200] flex flex-col items-end gap-1.5">
      {open && (
        <div className="flex flex-col gap-2 bg-bg-dark/95 border border-border-light rounded-lg p-2.5 shadow-lg">
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>{t('settings.language')}</span>
            <select
              aria-label={t('settings.language')}
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
            >
              <option value="en">EN</option>
              <option value="id">ID</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>{t('settings.currency')}</span>
            <select
              aria-label={t('settings.currency')}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
            >
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </select>
          </label>
        </div>
      )}
      <button
        type="button"
        aria-label={t('settings.toggle')}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-xs text-text cursor-pointer hover:opacity-90"
      >
        <span aria-hidden>🌐</span>
      </button>
    </div>
  )
}
