// @vitest-environment jsdom
import { screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
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

  describe('hold-to-roll control', () => {
    it('rolls the locked target after press, tick, and release', () => {
      vi.useFakeTimers()
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      expect(screen.getByTestId('dice-aim')).toHaveTextContent('Aiming: 2')

      act(() => vi.advanceTimersByTime(240)) // 2 → 3 → 4 → 5
      expect(screen.getByTestId('dice-aim')).toHaveTextContent('Aiming: 5')

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
      vi.useRealTimers()
    })

    it('rolls the target via keyboard hold', () => {
      vi.useFakeTimers()
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.keyDown(button, { key: ' ' })
      act(() => vi.advanceTimersByTime(160)) // 2 → 3 → 4
      fireEvent.keyUp(button, { key: ' ' })

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(4)
      vi.useRealTimers()
    })
  })
})
