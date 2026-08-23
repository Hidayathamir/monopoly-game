// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import DiceHints from '../DiceHints'
import { GamePhase } from '../../types/game'
import type { GameState } from '../../types/game'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      { id: 0, name: 'P1', money: 1500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#E74C3C', avatar: { kind: 'preset' as const, id: 'cat' as const } },
      { id: 1, name: 'P2', money: 1500, position: 10, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#3498DB', avatar: { kind: 'preset' as const, id: 'dog' as const } },
    ],
    turnOrder: [0, 1],
    currentPlayer: 0,
    board: [],
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled: false,
    ...overrides,
  }
}

describe('DiceHints', () => {
  it('renders 11 hint badges during aiming phase', () => {
    const state = makeState()
    render(<DiceHints state={state} />)
    const hints = screen.getAllByTestId(/^dice-hint-\d+$/)
    expect(hints).toHaveLength(11)
  })

  it('shows values 2 through 12', () => {
    const state = makeState()
    render(<DiceHints state={state} />)
    for (let v = 2; v <= 12; v++) {
      expect(screen.getByTestId(`dice-hint-${v}`)).toHaveTextContent(String(v))
    }
  })

  it('does not render when dice already rolled', () => {
    const state = makeState({ dice: [3, 4] })
    render(<DiceHints state={state} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('does not render when pendingAction exists', () => {
    const state = makeState({ pendingAction: { type: 'buyProperty' as const, spaceId: 1 } })
    render(<DiceHints state={state} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('positions hints at correct board cells for position 0', () => {
    const RATIO = 100 / 11
    const expectedPos = (col: number, row: number) => ({
      x: Math.round((col - 0.5) * RATIO * 100) / 100,
      y: Math.round((row - 0.5) * RATIO * 100) / 100,
    })
    const state = makeState()
    render(<DiceHints state={state} />)
    // value 2 → cell 2 → POSITIONS[2] = c(9,11)
    const hint2 = screen.getByTestId('dice-hint-2')
    const pos2 = expectedPos(9, 11)
    expect(hint2).toHaveStyle({ left: `calc(${pos2.x}% - 9px)`, top: `calc(${pos2.y}% - 9px)` })
    // value 12 → cell 12 → POSITIONS[12] = c(1,9)
    const hint12 = screen.getByTestId('dice-hint-12')
    const pos12 = expectedPos(1, 9)
    expect(hint12).toHaveStyle({ left: `calc(${pos12.x}% - 9px)`, top: `calc(${pos12.y}% - 9px)` })
  })

  it('wraps around the board correctly', () => {
    const RATIO = 100 / 11
    const expectedPos = (col: number, row: number) => ({
      x: Math.round((col - 0.5) * RATIO * 100) / 100,
      y: Math.round((row - 0.5) * RATIO * 100) / 100,
    })
    // Player at position 38, value 5 → (38+5)%40 = 3
    const state = makeState({
      players: [
        { ...makeState().players[0], position: 38 },
        makeState().players[1],
      ],
    })
    render(<DiceHints state={state} />)
    const hint5 = screen.getByTestId('dice-hint-5')
    // POSITIONS[3] = c(8, 11)
    const pos3 = expectedPos(8, 11)
    expect(hint5).toHaveStyle({ left: `calc(${pos3.x}% - 9px)`, top: `calc(${pos3.y}% - 9px)` })
  })
})
