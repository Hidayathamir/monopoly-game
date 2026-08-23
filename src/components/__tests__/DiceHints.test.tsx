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
      { id: 0, name: 'P1', money: 1500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#E74C3C', avatar: { kind: 'preset' as const, id: 'default' } },
      { id: 1, name: 'P2', money: 1500, position: 10, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: '#3498DB', avatar: { kind: 'preset' as const, id: 'default' } },
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
    render(<DiceHints state={state} myPlayerId={0} />)
    const hints = screen.getAllByTestId(/^dice-hint-\d+$/)
    expect(hints).toHaveLength(11)
  })

  it('shows values 2 through 12', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={0} />)
    for (let v = 2; v <= 12; v++) {
      expect(screen.getByTestId(`dice-hint-${v}`)).toHaveTextContent(String(v))
    }
  })

  it('does not render when dice already rolled', () => {
    const state = makeState({ dice: [3, 4] })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('does not render when not my turn', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={1} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('does not render when pendingAction exists', () => {
    const state = makeState({ pendingAction: { type: 'buyProperty' as const, spaceId: 1 } })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.queryByTestId('dice-hints')).not.toBeInTheDocument()
  })

  it('computes correct target cells for position 0', () => {
    const state = makeState()
    render(<DiceHints state={state} myPlayerId={0} />)
    // Player at position 0, value 2 → target cell 2
    const hint2 = screen.getByTestId('dice-hint-2')
    expect(hint2).toBeInTheDocument()
    // Value 12 → target cell 12
    const hint12 = screen.getByTestId('dice-hint-12')
    expect(hint12).toBeInTheDocument()
  })

  it('wraps around the board correctly', () => {
    // Player at position 38, value 5 → (38+5)%40 = 3
    const state = makeState({
      players: [
        { ...makeState().players[0], position: 38 },
        makeState().players[1],
      ],
    })
    render(<DiceHints state={state} myPlayerId={0} />)
    expect(screen.getByTestId('dice-hint-5')).toBeInTheDocument()
  })
})
