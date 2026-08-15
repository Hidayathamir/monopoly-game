// @vitest-environment jsdom
import { screen, cleanup } from '@testing-library/react'
import { afterEach, describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import DiceRoller from '../DiceRoller'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { renderWithProviders } from '../../test/test-utils'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

afterEach(cleanup)

describe('DiceRoller', () => {
  it('hides the roll button when it is not the current player turn', () => {
    renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull()
  })

  it('enables the roll button on the current player turn', () => {
    renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={true} />)
    expect(screen.getByRole('button', { name: 'Roll Dice' })).toBeEnabled()
  })

  it('labels the roll button Roll Again when a doubles roll is pending', () => {
    const s = { ...makeState(), doublesCount: 1 } // dice stays null, so canRoll is true
    renderWithProviders(<DiceRoller state={s} onRoll={() => {}} isMyTurn={true} />)
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll Again' })).toBeEnabled()
  })
})
