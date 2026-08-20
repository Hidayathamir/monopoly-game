import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ID_IDR_ENABLED } from '../config/features'
import en from './locales/en/translation.json'
import id from './locales/id/translation.json'
import { DEFAULT_LANGUAGE, Language, StorageKey } from './constants'

function readSavedLanguage(): string {
  try {
    return localStorage.getItem(StorageKey.Language) ?? DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function resolveInitialLanguage(enabled = ID_IDR_ENABLED): string {
  return enabled ? readSavedLanguage() : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    [Language.En]: { translation: en },
    [Language.Id]: { translation: id },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  keySeparator: false,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(StorageKey.Language, lng)
  } catch {
    // ignore storage failures
  }
})

export default i18n
