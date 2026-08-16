// @vitest-environment jsdom
import { screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import DiceRoller from '../DiceRoller'
import { valueToAngle } from '../Speedometer'
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
    beforeEach(() => {
      vi.useFakeTimers()
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows the speedometer and hides the dice while holding', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      expect(screen.getByTestId('speedometer')).toBeInTheDocument()
      expect(screen.queryAllByTestId('dice')).toHaveLength(0)
      expect(screen.queryByTestId('dice-aim')).toBeNull()

      fireEvent.pointerUp(button)
    })

    it('rolls the locked target after a continuous sweep', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(240/800) = 5
      fireEvent.pointerUp(button)

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
    })

    it('sweeps continuously (needle moves between whole values)', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(400)) // value = 2 + 10*(400/800) = 7 → top
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(90 70 70)')

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(640/800) = 10
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(10)} 70 70)`,
      )
      fireEvent.pointerUp(button)
    })

    it('turns around at the top boundary without overshooting', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(800)) // apex 12
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(15 70 70)')

      act(() => vi.advanceTimersByTime(80)) // descending: 2 + 10*(880/800) = 11
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(11)} 70 70)`,
      )

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledWith(11)
    })

    it('rolls the target via keyboard hold', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.keyDown(button, { key: ' ' })
      act(() => vi.advanceTimersByTime(160)) // value = 2 + 10*(160/800) = 4
      fireEvent.keyUp(button, { key: ' ' })

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(4)
    })

    it('falls back to the stepped ticker under prefers-reduced-motion', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }))
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      fireEvent.pointerDown(button)
      act(() => vi.advanceTimersByTime(40)) // stepped: no 80ms tick yet → still 2
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe('rotate(165 70 70)')

      act(() => vi.advanceTimersByTime(80)) // one tick → 3
      expect(screen.getByTestId('speedometer-needle').getAttribute('transform')).toBe(
        `rotate(${valueToAngle(3)} 70 70)`,
      )

      fireEvent.pointerUp(button)
      expect(onRoll).toHaveBeenCalledWith(3)
    })
  })
})
