// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { useMyTurnSound } from '../useMyTurnSound'
import { SoundProvider } from '../SoundContext'

const { playSoundMock } = vi.hoisted(() => ({ playSoundMock: vi.fn() }))
vi.mock('../soundEngine', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../soundEngine')>()
  return { ...mod, playSound: playSoundMock }
})

function wrapper({ children }: { children: ReactNode }) {
  return <SoundProvider>{children}</SoundProvider>
}

describe('useMyTurnSound', () => {
  beforeEach(() => {
    playSoundMock.mockClear()
  })

  it('does not play on mount (baseline)', () => {
    renderHook(() => useMyTurnSound(true), { wrapper })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('does not play when it is not your turn', () => {
    renderHook(() => useMyTurnSound(false), { wrapper })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays once when your turn starts', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: false },
      wrapper,
    })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ isMyTurn: true })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('yourTurn')
  })

  it('does not re-play while still your turn', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: true },
      wrapper,
    })
    playSoundMock.mockClear()
    rerender({ isMyTurn: true })
    expect(playSoundMock).not.toHaveBeenCalled()
  })

  it('plays again on the next turn', () => {
    const { rerender } = renderHook(({ isMyTurn }: { isMyTurn: boolean }) => useMyTurnSound(isMyTurn), {
      initialProps: { isMyTurn: true },
      wrapper,
    })
    playSoundMock.mockClear()
    rerender({ isMyTurn: false })
    expect(playSoundMock).not.toHaveBeenCalled()
    rerender({ isMyTurn: true })
    expect(playSoundMock).toHaveBeenCalledTimes(1)
    expect(playSoundMock).toHaveBeenCalledWith('yourTurn')
  })
})
