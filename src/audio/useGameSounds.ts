import { useEffect, useRef } from 'react'
import type { GameState } from '../types/game'
import { playSound } from './soundEngine'
import { soundForLogKey } from './soundMap'

export function useGameSounds(state: GameState): void {
  const lastLengthRef = useRef<number | null>(null)

  useEffect(() => {
    const log = state.eventLog
    const last = lastLengthRef.current
    if (last === null || log.length < last) {
      lastLengthRef.current = log.length
      return
    }
    lastLengthRef.current = log.length
    for (let i = last; i < log.length; i++) {
      const sound = soundForLogKey(log[i].key)
      if (sound !== null) playSound(sound)
    }
  }, [state.eventLog])
}

export default function GameSounds({ state }: { state: GameState }) {
  useGameSounds(state)
  return null
}
