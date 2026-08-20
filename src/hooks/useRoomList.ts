import { useEffect, useState } from 'react'
import type { RoomInfo } from '../types/net'
import { HttpPath } from '../types/net'

const POLL_INTERVAL_MS = 4000

export interface RoomListApi {
  rooms: RoomInfo[]
  error: boolean
}

export function useRoomList(): RoomListApi {
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(HttpPath.Rooms)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as RoomInfo[]
        if (!cancelled) {
          setRooms(data)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { rooms, error }
}
