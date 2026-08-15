import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n'
import { CurrencyProvider } from '../i18n/CurrencyContext'

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <CurrencyProvider>{children}</CurrencyProvider>
    </I18nextProvider>
  )
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options })
}
