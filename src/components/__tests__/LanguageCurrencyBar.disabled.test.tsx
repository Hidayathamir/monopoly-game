// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import LanguageCurrencyBar from '../LanguageCurrencyBar'
import { renderWithProviders } from '../../test/test-utils'

vi.mock('../../config/features', () => ({ ID_IDR_ENABLED: false }))

afterEach(cleanup)

describe('LanguageCurrencyBar disabled', () => {
  it('renders nothing when the ID/IDR feature is disabled', () => {
    renderWithProviders(<LanguageCurrencyBar />)
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })
})