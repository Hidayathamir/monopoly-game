// @vitest-environment jsdom
import { cleanup, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import EmoticonBar from '../EmoticonBar'
import { renderWithProviders } from '../../test/test-utils'
import { Emoticon } from '../../types/emotion'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('EmoticonBar', () => {
  it('renders one button per emoticon with the right glyph', () => {
    renderWithProviders(<EmoticonBar onEmit={() => {}} />)
    expect(screen.getByTestId('emoticon-button-sad')).toHaveTextContent('😢')
    expect(screen.getByTestId('emoticon-button-happy')).toHaveTextContent('😂')
    expect(screen.getByTestId('emoticon-button-angry')).toHaveTextContent('😠')
    expect(screen.getByTestId('emoticon-button-proud')).toHaveTextContent('😎')
  })

  it('calls onEmit with the clicked emoticon', () => {
    const onEmit = vi.fn()
    renderWithProviders(<EmoticonBar onEmit={onEmit} />)
    fireEvent.click(screen.getByTestId('emoticon-button-proud'))
    expect(onEmit).toHaveBeenCalledWith(Emoticon.Proud)
  })

  it('disables all buttons when disabled is set', () => {
    renderWithProviders(<EmoticonBar disabled onEmit={() => {}} />)
    expect(screen.getByTestId('emoticon-button-sad')).toBeDisabled()
    expect(screen.getByTestId('emoticon-button-happy')).toBeDisabled()
  })

  it('applies a 1s cooldown after a click', () => {
    vi.useFakeTimers()
    const onEmit = vi.fn()
    renderWithProviders(<EmoticonBar onEmit={onEmit} />)

    fireEvent.click(screen.getByTestId('emoticon-button-angry'))
    expect(screen.getByTestId('emoticon-button-angry')).toBeDisabled()
    fireEvent.click(screen.getByTestId('emoticon-button-angry'))
    expect(onEmit).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(999) })
    expect(screen.getByTestId('emoticon-button-angry')).toBeDisabled()

    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByTestId('emoticon-button-angry')).toBeEnabled()
  })
})
