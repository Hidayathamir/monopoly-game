import { useEffect, useRef } from 'react'
import { useSound } from './SoundContext'
import { SoundId } from './soundEngine'

export function useMyTurnSound(isMyTurn: boolean): void {
  const play = useSound()
  const prevIsMyTurnRef = useRef(isMyTurn)

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current) play(SoundId.YourTurn)
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, play])
}
