// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import TurnHeader from '../TurnHeader'
import { GamePhase, type GameState } from '../../types/game'
import { renderWithProviders } from '../../test/test-utils'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      {
        id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
        passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false, isBot: false,
      },
    ],
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
    pendingTrades: [],
    nextTradeId: 0,
    ...overrides,
  }
}

afterEach(cleanup)

describe('TurnHeader', () => {
  it('shows the current player name', () => {
    renderWithProviders(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('shows a roll prompt before the roll', () => {
    renderWithProviders(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Roll dice')).toBeTruthy()
  })

  it('shows the dice total after the roll', () => {
    renderWithProviders(<TurnHeader state={makeState({ dice: [3, 4] })} />)
    expect(screen.getByText('Dice 3 + 4 = 7')).toBeTruthy()
  })
})
