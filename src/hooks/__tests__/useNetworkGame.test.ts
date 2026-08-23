// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useNetworkGame } from '../useNetworkGame'
import { Emoticon } from '../../types/emotion'

const sendMock = vi.fn()
let onMessageHandler: ((message: unknown) => void) | null = null

vi.mock('../../net/client', () => ({
  GameClient: class {
    constructor(handlers: { onMessage: (message: unknown) => void }) {
      onMessageHandler = handlers.onMessage
    }
    connect() {}
    send(message: unknown) {
      sendMock(message)
    }
    close() {}
  },
}))

describe('useNetworkGame', () => {
  beforeEach(() => {
    sendMock.mockClear()
    onMessageHandler = null
    cleanup()
  })

  it('leave sends a Leave message and triggers onLeft locally', () => {
    const onLeft = vi.fn()
    const { result } = renderHook(() => useNetworkGame(onLeft))

    act(() => result.current.leave())

    expect(sendMock).toHaveBeenCalledWith({ type: 'leave' })
    expect(onLeft).toHaveBeenCalledTimes(1)
  })

  it('server Left message still triggers onLeft', () => {
    const onLeft = vi.fn()
    renderHook(() => useNetworkGame(onLeft))

    act(() => onMessageHandler?.({ type: 'left' }))

    expect(onLeft).toHaveBeenCalledTimes(1)
  })

  it('exposes emitEmoticon which sends an emoticon client message', () => {
    const onLeft = vi.fn()
    const { result } = renderHook(() => useNetworkGame(onLeft))
    act(() => result.current.emitEmoticon(Emoticon.Proud))
    expect(sendMock).toHaveBeenCalledWith({ type: 'emoticon', emoticon: 'proud' })
  })

  it('appends activeEmotions on an emoticon server message and removes it after the lifetime', () => {
    const onLeft = vi.fn()
    vi.useFakeTimers()
    const { result } = renderHook(() => useNetworkGame(onLeft))

    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 0, emoticon: 'sad' }))
    expect(result.current.activeEmotions).toEqual([{ id: 0, playerId: 0, emoticon: 'sad' }])

    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.activeEmotions).toEqual([])
    vi.useRealTimers()
  })

  it('keeps separate bubbles per emoticon message', () => {
    const onLeft = vi.fn()
    const { result } = renderHook(() => useNetworkGame(onLeft))
    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 0, emoticon: 'sad' }))
    act(() => onMessageHandler?.({ type: 'emoticon', playerId: 1, emoticon: 'angry' }))
    expect(result.current.activeEmotions).toEqual([
      { id: 0, playerId: 0, emoticon: 'sad' },
      { id: 1, playerId: 1, emoticon: 'angry' },
    ])
  })
})
