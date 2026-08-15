// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import GameSetup from '../GameSetup'
import { renderWithProviders } from '../../test/test-utils'

afterEach(cleanup)

describe('GameSetup', () => {
  it('switches to multiplayer form and calls onJoin', () => {
    const onJoin = vi.fn()
    renderWithProviders(<GameSetup onStartLocal={() => {}} onCreate={() => {}} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('Multiplayer (LAN)'))
    fireEvent.click(screen.getByText('Join Room'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByPlaceholderText('Code'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('Continue'))

    expect(onJoin).toHaveBeenCalledWith('Alice', 'ABC')
  })

  it('starts a local game with filled names', () => {
    const onStartLocal = vi.fn()
    renderWithProviders(<GameSetup onStartLocal={onStartLocal} onCreate={() => {}} onJoin={() => {}} />)

    fireEvent.change(screen.getAllByPlaceholderText(/Player/)[0], { target: { value: 'A' } })
    fireEvent.change(screen.getAllByPlaceholderText(/Player/)[1], { target: { value: 'B' } })
    fireEvent.click(screen.getByText('Start Game'))

    expect(onStartLocal).toHaveBeenCalledWith(2, ['A', 'B'])
  })

  it('marks the active mode toggle with a gold ring', () => {
    renderWithProviders(<GameSetup onStartLocal={() => {}} onCreate={() => {}} onJoin={() => {}} />)
    const single = screen.getByText('Single Device').closest('button')!
    const multiplayer = screen.getByText('Multiplayer (LAN)').closest('button')!
    expect(single.className).toContain('ring-gold')
    expect(multiplayer.className).toContain('opacity-60')
  })
})
