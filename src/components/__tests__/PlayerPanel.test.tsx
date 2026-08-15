// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PlayerPanel from '../PlayerPanel'
import { renderWithProviders } from '../../test/test-utils'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { GO_SALARY } from '../../data/board'

const COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#E67E22']

function makeState(money: number, position: number): GameState {
  const s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
  return { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, money, position } : p) }
}

describe('PlayerPanel', () => {
  it('shows a money float when a player passes GO (salary increase)', () => {
    const { rerender } = renderWithProviders(<PlayerPanel state={makeState(1000, 38)} playerColors={COLORS} />)
    rerender(<PlayerPanel state={makeState(1000 + GO_SALARY, 5)} playerColors={COLORS} />)
    expect(screen.getAllByText(/^\+/).length).toBeGreaterThan(0)
  })
})
