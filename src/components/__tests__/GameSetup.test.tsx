// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('GameSetup', () => {
  it('creates a room with the entered name', () => {
    const onCreate = vi.fn()
    renderWithProviders(<GameSetup onCreate={onCreate} onJoin={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onCreate).toHaveBeenCalledWith('Alice')
  })

  it('joins a room and calls onJoin', () => {
    const onJoin = vi.fn()
    renderWithProviders(<GameSetup onCreate={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Join Room'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByPlaceholderText('Code'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onJoin).toHaveBeenCalledWith('Alice', 'ABC')
  })
})
