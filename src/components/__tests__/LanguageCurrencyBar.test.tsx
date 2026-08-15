// @vitest-environment jsdom
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('LanguageCurrencyBar', () => {
  it('shows a collapsed toggle without the EN·USD label', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
    expect(screen.queryByText(/EN · USD/)).toBeNull()
  })

  it('opens the panel when clicked', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByLabelText('Language')).toBeVisible()
    expect(screen.getByLabelText('Currency')).toBeVisible()
  })
})
