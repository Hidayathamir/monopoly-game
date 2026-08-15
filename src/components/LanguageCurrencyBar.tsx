import { useTranslation } from 'react-i18next'
import { useCurrency } from '../i18n/CurrencyContext'
import type { Currency } from '../data/currency'

export default function LanguageCurrencyBar() {
  const { t, i18n } = useTranslation()
  const { currency, setCurrency } = useCurrency()

  return (
    <div className="fixed top-2 right-2 z-[200] flex gap-2 bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted">{t('settings.language')}</span>
        <select
          aria-label={t('settings.language')}
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
        >
          <option value="en">EN</option>
          <option value="id">ID</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted">{t('settings.currency')}</span>
        <select
          aria-label={t('settings.currency')}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="bg-input-bg text-text text-xs rounded px-1 py-0.5 border border-border"
        >
          <option value="USD">USD</option>
          <option value="IDR">IDR</option>
        </select>
      </div>
    </div>
  )
}
