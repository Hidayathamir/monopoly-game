// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGameSounds } from '../useGameSounds'
import { createInitialState } from '../../logic/gameReducer'
import type { GameState } from '../../types/game'
import { LogEventKey } from '../../types/game'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function withLog(keys: LogEventKey[]): GameState {
  return { ...createInitialState(), eventLog: keys.map((key) => ({ key })) }
}

describe('useGameSounds', () => {
  beforeEach(() => {
    playSoundMock.mockClear()
  })

  it('plays nothing on first mount (baseline)', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays one sound per new log entry, in order', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()

    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought]) })
    expect(playSoundMock).toHaveBeenNthCalledWith(1, 'diceRoll')
    expect(playSoundMock).toHaveBeenNthCalledWith(2, 'buy')

    playSoundMock.mockClear()
    rerender({ state: withLog([LogEventKey.Rolled, LogEventKey.Bought, LogEventKey.BankruptcyWin]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('win')
  })

  it('plays only the landing thud for the local player own roll', () => {
    const { rerender } = renderHook(
      ({ state, id }) => useGameSounds(state, id),
      { initialProps: { state: withLog([]), id: 1 } },
    )
    const s = withLog([LogEventKey.Rolled])
    s.currentPlayer = 1
    rerender({ state: s, id: 1 })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('diceLand')
  })

  it('plays the full tumbling sound for another player roll', () => {
    const { rerender } = renderHook(
      ({ state, id }) => useGameSounds(state, id),
      { initialProps: { state: withLog([]), id: 2 } },
    )
    const s = withLog([LogEventKey.Rolled])
    s.currentPlayer = 1
    rerender({ state: s, id: 2 })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('diceRoll')
  })

  it('does not replay history on a fresh mount (rejoin)', () => {
    renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([LogEventKey.GameStarted, LogEventKey.Turn, LogEventKey.Rolled]) },
    })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('re-baselines if the log ever shrinks', () => {
    const { rerender } = renderHook(({ state }) => useGameSounds(state), {
      initialProps: { state: withLog([]) },
    })
    rerender({ state: withLog([LogEventKey.Bought]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    playSoundMock.mockClear()

    rerender({ state: withLog([]) })
    expect(playSoundMock).not.toHaveBeenCalled()

    rerender({ state: withLog([LogEventKey.PaidRent]) })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('moneyLoss')
  })
})
