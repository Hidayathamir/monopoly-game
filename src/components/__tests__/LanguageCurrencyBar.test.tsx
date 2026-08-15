// @vitest-environment jsdom
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'
import i18n from '../../i18n'

afterEach(() => {
  cleanup()
  i18n.changeLanguage('en')
})

describe('LanguageCurrencyBar', () => {
  it('shows a collapsed toggle without the panel', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('opens the panel when clicked', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByLabelText('Language')).toBeVisible()
    expect(screen.getByLabelText('Currency')).toBeVisible()
  })

  it('closes the panel after selecting a language', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'id' } })
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('closes the panel after selecting a currency', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'IDR' } })
    expect(screen.queryByLabelText('Currency')).toBeNull()
  })

  it('closes the panel when clicking outside', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByLabelText('Language')).toBeNull()
  })

  it('closes the panel when pressing Escape', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Language')).toBeNull()
  })
})
