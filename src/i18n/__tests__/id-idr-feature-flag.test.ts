// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveInitialLanguage } from '../index'
import { readSavedCurrency } from '../CurrencyContext'
import { StorageKey } from '../constants'

vi.mock('../../config/features', () => ({ ID_IDR_ENABLED: false }))

describe('ID/IDR feature flag disabled clamps', () => {
  beforeEach(() => {
    localStorage.setItem(StorageKey.Language, 'id')
    localStorage.setItem(StorageKey.Currency, 'IDR')
  })

  it('forces English regardless of a saved Indonesian preference', () => {
    expect(resolveInitialLanguage()).toBe('en')
  })

  it('forces USD regardless of a saved IDR preference', () => {
    expect(readSavedCurrency()).toBe('USD')
  })
})
