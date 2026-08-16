// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useNetworkGame } from '../useNetworkGame'

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
})
