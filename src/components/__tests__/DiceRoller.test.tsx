// @vitest-environment jsdom
import { screen, cleanup, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import DiceRoller from '../DiceRoller'
import { gameReducer, createInitialState } from '../../logic/gameReducer'
import { GameActionType, type GameState } from '../../types/game'
import { renderWithProviders } from '../../test/test-utils'

function makeState(): GameState {
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
}

function needleTip(): { x: number; y: number } {
  const line = screen.getByTestId('speedometer-needle')
  return { x: parseFloat(line.getAttribute('x2') ?? ''), y: parseFloat(line.getAttribute('y2') ?? '') }
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

  describe('click-to-stop control', () => {
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

    it('shows the speedometer and hides the dice when it is the player turn to roll', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      expect(screen.getByTestId('speedometer')).toBeInTheDocument()
      expect(screen.queryAllByTestId('dice')).toHaveLength(0)
    })

    it('shows the dice faces instead of the gauge after a roll', () => {
      const s = { ...makeState(), dice: [3, 4] as [number, number] }
      renderWithProviders(<DiceRoller state={s} onRoll={() => {}} isMyTurn={true} />)
      expect(screen.queryByTestId('speedometer')).toBeNull()
      expect(screen.queryAllByTestId('dice')).toHaveLength(2)
    })

    it('shows no gauge when it is not the player turn', () => {
      renderWithProviders(<DiceRoller state={makeState()} onRoll={() => {}} isMyTurn={false} />)
      expect(screen.queryByTestId('speedometer')).toBeNull()
    })

    it('stops the needle and rolls the locked target on click', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(240/800) = 5
      fireEvent.click(button)

      expect(onRoll).toHaveBeenCalledTimes(1)
      expect(onRoll).toHaveBeenCalledWith(5)
    })

    it('sweeps continuously (needle moves between whole values)', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)

      act(() => vi.advanceTimersByTime(400)) // value = 2 + 10*(400/800) = 7 → top
      expect(needleTip()).toEqual({ x: 70, y: 26 }) // straight up, into the arc

      act(() => vi.advanceTimersByTime(240)) // value = 2 + 10*(640/800) = 10
      const tip = needleTip()
      expect(tip.x).toBeCloseTo(101.11, 2) // moved up-right, past the apex
      expect(tip.y).toBeCloseTo(38.89, 2)
    })

    it('turns around at the top boundary without overshooting', () => {
      const onRoll = vi.fn()
      renderWithProviders(<DiceRoller state={makeState()} onRoll={onRoll} isMyTurn={true} />)
      const button = screen.getByRole('button', { name: 'Roll Dice' })

      act(() => vi.advanceTimersByTime(800)) // apex 12
      const apex = needleTip()
      expect(apex.x).toBeCloseTo(112.5, 1) // 12 → up-right at 15°
      expect(apex.y).toBeCloseTo(58.61, 2)
      expect(apex.y).toBeLessThan(70) // never pointing down away from the arc

      act(() => vi.advanceTimersByTime(80)) // descending: 2 + 10*(880/800) = 11
      const tip = needleTip()
      expect(tip.x).toBeCloseTo(108.11, 2)
      expect(tip.y).toBeCloseTo(48, 1)
      expect(tip.y).toBeLessThan(70)

      fireEvent.click(button)
      expect(onRoll).toHaveBeenCalledWith(11)
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

      act(() => vi.advanceTimersByTime(40)) // stepped: no 80ms tick yet → still 2
      const low = needleTip()
      expect(low.x).toBeCloseTo(27.5, 1) // 2 → up-left at 165°
      expect(low.y).toBeCloseTo(58.61, 2)
      expect(low.y).toBeLessThan(70)

      act(() => vi.advanceTimersByTime(80)) // one tick → 3
      const stepped = needleTip()
      expect(stepped.x).toBeCloseTo(31.89, 2) // 3 → up-left at 150°
      expect(stepped.y).toBeCloseTo(48, 1)

      fireEvent.click(button)
      expect(onRoll).toHaveBeenCalledWith(3)
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
  })
})
