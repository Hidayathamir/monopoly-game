// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGame } from '../useGame'
import { GameActionType, GamePhase } from '../../types/game'
import { gameReducer, createInitialState } from '../../logic/gameReducer'

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

  it('does not auto-advance after rolling doubles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // dice [4,4]
    const { result } = renderHook(() => useGame())
    act(() => result.current.startGame([{ name: 'Alice', isBot: false }, { name: 'Bob', isBot: false }]))

    act(() => result.current.roll())
    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.doublesCount).toBe(1)

    act(() => vi.advanceTimersByTime(500 + 8 * 150))
    expect(result.current.state.phase).toBe(GamePhase.Waiting)
    expect(result.current.state.dice).toEqual([4, 4])

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.dice).toEqual([4, 4])
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.eventLog.some((e) => e.key === 'event.doublesAgain')).toBe(false)
  })
})

describe('useGame jailed player turn', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does not auto-skip a jailed player\'s turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    // Drive Alice into jail via triple doubles, then let Bob end his turn so it is Alice's turn again.
    let s = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['Alice', 'Bob'] })
    s = gameReducer(s, { type: GameActionType.RollDice })
    s = gameReducer(s, { type: GameActionType.DiceAnimated, dice: [6, 6] })
    s = gameReducer(s, { type: GameActionType.ResolveSpace })
    s = gameReducer(s, { type: GameActionType.RollDice })
    s = gameReducer(s, { type: GameActionType.DiceAnimated, dice: [6, 6] })
    s = gameReducer(s, { type: GameActionType.ResolveSpace })
    s = gameReducer(s, { type: GameActionType.RollDice })
    s = gameReducer(s, { type: GameActionType.DiceAnimated, dice: [6, 6] }) // triple doubles → jail, turn passes to Bob
    s = gameReducer(s, { type: GameActionType.EndTurn }) // Bob ends → Alice (jailed) is current

    expect(s.players[0].inJail).toBe(true)
    expect(s.currentPlayer).toBe(0)
    expect(s.phase).toBe(GamePhase.Waiting)

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ ...s, _version: 9 })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })

    const { result } = renderHook(() => useGame())
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.players[0].inJail).toBe(true)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.players[0].inJail).toBe(true)
  })
})

describe('useGame bot auto-play', () => {
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

  it('auto-rolls and ends a bot turn in local mode', () => {
    let s = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bot'],
      isBot: [false, true],
    })
    s = { ...s, currentPlayer: 1 }

    // Deterministic non-doubles: arm the spy AFTER the reducer's deck shuffle,
    // so the first roll() call draws (1,4).
    let n = 0
    vi.spyOn(Math, 'random').mockImplementation(() => (n++ === 0 ? 0 : 0.5))

    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ ...s, _version: 9 })),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })

    const { result } = renderHook(() => useGame())
    expect(result.current.state.players[1].isBot).toBe(true)
    expect(result.current.state.currentPlayer).toBe(1)

    act(() => vi.advanceTimersByTime(600)) // bot driver fires → roll()
    expect(result.current.state.phase).toBe(GamePhase.Rolling)

    act(() => vi.advanceTimersByTime(500)) // DICE_ANIMATED
    expect(result.current.state.dice).toEqual([1, 4])

    act(() => vi.advanceTimersByTime(500 + 5 * 150)) // RESOLVE_SPACE (space 5, unowned, not passed Go → Waiting)
    expect(result.current.state.phase).toBe(GamePhase.Waiting)

    act(() => vi.advanceTimersByTime(600)) // bot END_TURN
    expect(result.current.state.currentPlayer).toBe(0)
    expect(result.current.state.dice).toBeNull()
  })
})
