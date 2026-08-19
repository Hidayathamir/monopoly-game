// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoldToConfirmButton from '../HoldToConfirmButton'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderButton(overrides: Partial<ComponentProps<typeof HoldToConfirmButton>> = {}) {
    const props = { onConfirm: () => {}, children: 'Declare Bankruptcy', ...overrides }
    return renderWithProviders(<HoldToConfirmButton {...props} />)
  }

  it('renders the idle label and the hint', () => {
    renderButton({ hint: 'Press and hold for 5 seconds' })
    expect(screen.getByRole('button', { name: 'Declare Bankruptcy' })).toBeVisible()
    expect(screen.getByTestId('hold-hint')).toHaveTextContent('Press and hold for 5 seconds')
  })

  it('fires onConfirm once after holding for the full duration', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not fire on a quick tap', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.pointerUp(button)
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets after an early release and still fires on the next full hold', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(2500))
    fireEvent.pointerUp(button)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Declare Bankruptcy' })).toBeVisible()
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows the countdown label while holding', () => {
    renderButton()
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('button', { name: /^Hold/ })).toBeVisible()
  })

  it('ignores non-primary pointer buttons', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 2 })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('supports keyboard hold with Space', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.keyUp(button, { key: ' ' })
  })

  it('does not fire on a quick keyboard press', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyUp(button, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not fire while disabled', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm, disabled: true })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not start a second hold on a double pointer-down', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.pointerUp(button)
  })

  it('ignores repeated key events while holding', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: ' ', repeat: true })
    fireEvent.keyUp(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('ignores repeat keyDown during an active hold', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.keyDown(button, { key: ' ' })
    fireEvent.keyDown(button, { key: ' ', repeat: true })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.keyUp(button, { key: ' ' })
  })

  it('resets on pointer cancel and still fires on the next full hold', () => {
    const onConfirm = vi.fn()
    renderButton({ onConfirm })
    const button = screen.getByRole('button', { name: 'Declare Bankruptcy' })
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(2500))
    fireEvent.pointerCancel(button)
    act(() => vi.advanceTimersByTime(6000))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.pointerDown(button, { button: 0 })
    act(() => vi.advanceTimersByTime(5000))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
