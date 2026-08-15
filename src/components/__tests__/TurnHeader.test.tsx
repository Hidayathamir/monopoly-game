// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import TurnHeader from '../TurnHeader'
import { GamePhase, type GameState } from '../../types/game'

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      {
        id: 0, name: 'Alpha', money: 15000, position: 0, properties: [],
        passedGo: false, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false,
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
    ...overrides,
  }
}

afterEach(cleanup)

describe('TurnHeader', () => {
  it('shows the current player name', () => {
    render(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('shows a roll prompt before the roll', () => {
    render(<TurnHeader state={makeState()} />)
    expect(screen.getByText('Lempar dadu')).toBeTruthy()
  })

  it('shows the dice total after the roll', () => {
    render(<TurnHeader state={makeState({ dice: [3, 4] })} />)
    expect(screen.getByText('Dadu 3 + 4 = 7')).toBeTruthy()
  })
})
