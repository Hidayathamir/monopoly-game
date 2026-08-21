// @vitest-environment jsdom
import { cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import Lobby from '../Lobby'
import { renderWithProviders } from '../../test/test-utils'
import { createInitialState } from '../../logic/gameReducer'
import type { NetworkGameApi } from '../../hooks/useNetworkGame'
import { PLAYER_COLORS } from '../../data/players'
import { DEFAULT_AVATAR } from '../../data/avatars'

function makeGame(overrides: Partial<NetworkGameApi> = {}): NetworkGameApi {
  return {
    state: createInitialState(),
    myPlayerId: 0,
    playerId: 0,
    hostPlayerId: 0,
    code: 'ABC12',
    lobby: [],
    status: 'connected',
    error: null,
    create: vi.fn(),
    join: vi.fn(),
    setIdentity: vi.fn(),
    leave: vi.fn(),
    start: vi.fn(),
    addBot: vi.fn(),
    removeBot: vi.fn(),
    roll: vi.fn(),
    buyProperty: vi.fn(),
    declineBuy: vi.fn(),
    payRent: vi.fn(),
    buildHouse: vi.fn(),
    sellHouse: vi.fn(),
    mortgage: vi.fn(),
    unmortgage: vi.fn(),
    sellProperty: vi.fn(),
    proposeTrade: vi.fn(),
    acceptTrade: vi.fn(),
    rejectTrade: vi.fn(),
    cancelTrade: vi.fn(),
    drawCard: vi.fn(),
    resolveCard: vi.fn(),
    endTurn: vi.fn(),
    declareBankruptcy: vi.fn(),
    skipAction: vi.fn(),
    payJailFine: vi.fn(),
    useGetOutOfJailFree: vi.fn(),
    resetGame: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('Lobby', () => {
  it('host can add a bot', () => {
    const addBot = vi.fn()
    renderWithProviders(<Lobby game={makeGame({ addBot })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Bot' }))
    expect(addBot).toHaveBeenCalledTimes(1)
  })

  it('host can remove a bot seat', () => {
    const removeBot = vi.fn()
    renderWithProviders(<Lobby game={makeGame({
      removeBot,
      lobby: [
        { id: 0, name: 'Host', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR },
        { id: 1, name: 'Droid', connected: true, isBot: true, color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR },
      ],
    })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Droid' }))
    expect(removeBot).toHaveBeenCalledWith(1)
  })

  it('non-host does not see add/remove bot controls', () => {
    renderWithProviders(<Lobby game={makeGame({ hostPlayerId: 0, playerId: 1 })} />)
    expect(screen.queryByRole('button', { name: 'Add Bot' })).toBeNull()
  })

  it('dims the row of a disconnected player', () => {
    renderWithProviders(<Lobby game={makeGame({
      lobby: [
        { id: 0, name: 'Host', connected: true, isBot: false, color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR },
        { id: 1, name: 'Gone', connected: false, isBot: false, color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR },
      ],
    })} />)
    const goneRow = screen.getByText(/Gone/).closest('div')!
    expect(goneRow.className).toContain('opacity-50')
    const hostRow = screen.getByText('Host').closest('div')!
    expect(hostRow.className).not.toContain('opacity-50')
  })
})
