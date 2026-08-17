// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRoomList } from '../useRoomList'
import type { RoomInfo } from '../../types/net'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRoomList', () => {
  it('fetches rooms on mount and returns them', async () => {
    const rooms: RoomInfo[] = [{ code: 'ABCDE', hostName: 'Alice', playerCount: 1, phase: 'setup' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rooms }))

    const { result } = renderHook(() => useRoomList())

    await waitFor(() => expect(result.current.rooms).toEqual(rooms))
    expect(result.current.error).toBe(false)
  })

  it('sets error when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    const { result } = renderHook(() => useRoomList())

    await waitFor(() => expect(result.current.error).toBe(true))
  })
})
