import { useEffect, useRef } from 'react'
import type { GameState } from '../types/game'
import { playSound, SoundId } from './soundEngine'
import { soundForLogKey } from './soundMap'

export function useGameSounds(state: GameState, myPlayerId: number | null = null): void {
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
      if (sound === null) continue
      // The current player's own roll already played the tumbling sound at the
      // button press; their log entry just adds the landing thud. Everyone
      // else's roll (no button press) gets the full tumbling sound.
      const isOwnRoll =
        sound === SoundId.DiceRoll && myPlayerId !== null && state.currentPlayer === myPlayerId
      playSound(isOwnRoll ? SoundId.DiceLand : sound)
    }
  }, [state.eventLog, state.currentPlayer, myPlayerId])
}

export default function GameSounds({ state, myPlayerId }: { state: GameState; myPlayerId?: number | null }) {
  useGameSounds(state, myPlayerId)
  return null
}
