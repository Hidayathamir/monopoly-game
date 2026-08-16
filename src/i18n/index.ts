import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ID_IDR_ENABLED } from '../config/features'
import en from './locales/en/translation.json'
import id from './locales/id/translation.json'

const STORAGE_KEY = 'monopoly-language'
export const DEFAULT_LANGUAGE = 'en'

function readSavedLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function resolveInitialLanguage(enabled = ID_IDR_ENABLED): string {
  return enabled ? readSavedLanguage() : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  keySeparator: false,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // ignore storage failures
  }
})

export default i18n
