// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import RoomExit from '../RoomExit'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('RoomExit', () => {
  it('renders only the collapse toggle when collapsed (no leave button)', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} collapsed />)
    expect(screen.getByRole('button', { name: 'Leave Room Options' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Leave Room' })).toBeNull()
  })

  it('expands to reveal the leave button when the toggle is clicked', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} collapsed />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room Options' }))
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('shows the leave button directly when not collapsed', () => {
    renderWithProviders(<RoomExit onLeave={() => {}} />)
    expect(screen.getByRole('button', { name: 'Leave Room' })).toBeVisible()
  })

  it('opens the confirmation modal and does not leave on cancel', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    expect(screen.getByText('Are you sure you want to leave this room?')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('calls onLeave only after confirming', () => {
    const onLeave = vi.fn()
    renderWithProviders(<RoomExit onLeave={onLeave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Leave Room' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
