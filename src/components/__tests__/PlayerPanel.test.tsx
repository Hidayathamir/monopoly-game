// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerPanel from '../PlayerPanel'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { GO_SALARY } from '../../data/board'

function makeState(money: number, position: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, money, position } : p) }
}

describe('PlayerPanel', () => {
  it('shows a money float when a player passes GO (salary increase)', () => {
    const { rerender } = renderWithProviders(
      <PlayerPanel
        state={makeState(1000, 38)}
        onProposeTrade={() => {}}
        canTrade
      />,
    )
    rerender(
      <PlayerPanel
        state={makeState(1000 + GO_SALARY, 5)}
        onProposeTrade={() => {}}
        canTrade
      />,
    )
    expect(screen.getAllByText(/^\+/).length).toBeGreaterThan(0)
  })

  it('renders players in turn order', () => {
    const s = makeState(1000, 0)
    renderWithProviders(
      <PlayerPanel
        state={{ ...s, turnOrder: [1, 0], currentPlayer: 1 }}
        onProposeTrade={() => {}}
        canTrade
      />,
    )
    const names = screen.getAllByText(/Alice|Bob/).map((el) => el.textContent)
    expect(names.indexOf('Bob')).toBeLessThan(names.indexOf('Alice'))
  })

  it('marks a player as offline when excluded from connectedPlayerIds', () => {
    renderWithProviders(
      <PlayerPanel
        state={makeState(1000, 0)}
        onProposeTrade={() => {}}
        canTrade
        connectedPlayerIds={new Set([1])}
      />,
    )
    expect(screen.getByText('OFFLINE')).toBeTruthy()
  })

  it('treats everyone as connected when connectedPlayerIds is omitted', () => {
    renderWithProviders(
      <PlayerPanel state={makeState(1000, 0)} onProposeTrade={() => {}} canTrade />,
    )
    expect(screen.queryByText('OFFLINE')).toBeNull()
  })
})
