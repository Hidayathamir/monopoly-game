// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGame } from '../useGame'
import { GamePhase } from '../../types/game'

describe('useGame doubles auto-advance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('auto ends turn (keeps player) after rolling doubles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // dice [4,4]
    const { result } = renderHook(() => useGame())
    act(() => result.current.startGame(2, ['Alice', 'Bob']))

    act(() => result.current.roll())
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.doublesCount).toBe(1)

    act(() => vi.advanceTimersByTime(500 + 8 * 150))
    expect(result.current.state.phase).toBe(GamePhase.Waiting)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toBeNull()
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.eventLog.some((e) => e.key === 'event.doublesAgain')).toBe(true)
  })
})
