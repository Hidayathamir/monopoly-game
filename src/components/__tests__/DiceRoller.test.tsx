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
  it('disables the roll button when it is not the current player turn', () => {
    renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
    expect(screen.getByRole('button', { name: 'Roll Dice' })).toBeDisabled()
  })

  it('enables the roll button on the current player turn', () => {
    renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={true} />)
    expect(screen.getByRole('button', { name: 'Roll Dice' })).toBeEnabled()
  })
})
