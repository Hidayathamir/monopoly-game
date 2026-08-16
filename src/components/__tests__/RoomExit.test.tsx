// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import RoomExit from '../RoomExit'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('RoomExit', () => {
  it('shows the leave button directly for the default button variant', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} />)
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('renders a compact icon-only button for the icon variant', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} variant="icon" />)
    const btn = screen.getByRole('button', { name: 'Leave Room' })
    expect(btn).toBeVisible()
    expect(btn.textContent?.trim()).toBe('🚪')
  })

  it('opens the confirmation modal and does not leave on cancel (icon variant)', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} variant="icon" />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    expect(screen.getByText('Are you sure you want to leave this room?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('calls onLeave only after confirming (button variant)', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('uses the provided copy keys for the exit button and modal', () => {
    renderWithProviders(
      <RoomExit
        onLeave={() => {}}
        variant="icon"
        labelKey="exit.label"
        titleKey="exit.title"
        messageKey="exit.message"
        confirmKey="exit.confirm"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Exit Game' }))
    expect(screen.getByText('Leave the current game? Progress will be lost and a new game will start.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
  })
})
