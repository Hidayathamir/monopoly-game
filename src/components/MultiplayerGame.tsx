import { useEffect, useRef } from 'react'
import { GamePhase } from '../types/game'
import { useNetworkGame } from '../hooks/useNetworkGame'
import { saveSession, clearSession } from '../net/session'
import Lobby from './Lobby'
import GameView from './GameView'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'

export interface JoinInfo {
  name: string
  code: string | null
}

interface Props {
  joinInfo: JoinInfo
  onLeft: () => void
}

export default function MultiplayerGame({ joinInfo, onLeft }: Props) {
  const game = useNetworkGame(onLeft)
  const connectedPlayerIds = new Set(game.lobby.filter((p) => p.connected).map((p) => p.id))
  const { create, join } = game
  const name = joinInfo.name
  const code = joinInfo.code

  const play = useSound()
  const prevCodeRef = useRef(game.code)
  const prevPhaseRef = useRef<GamePhase | null>(null)

  useEffect(() => {
    if (game.code !== null && prevCodeRef.current === null) play(SoundId.RoomJoin)
    prevCodeRef.current = game.code
  }, [game.code, play])

  useEffect(() => {
    if (game.code === null) return
    if (prevPhaseRef.current === null) {
      prevPhaseRef.current = game.state.phase
      return
    }
    const prev = prevPhaseRef.current
    prevPhaseRef.current = game.state.phase
    if (prev === GamePhase.Setup && game.state.phase !== GamePhase.Setup) {
      play(SoundId.GameStart)
    }
  }, [game.code, game.state.phase, play])

  useEffect(() => {
    if (code === null) create(name)
    else join(code, name)
  }, [code, name, create, join])

  useEffect(() => {
    if (game.state.phase !== GamePhase.Setup && game.code && name) saveSession({ name, code: game.code })
  }, [game.code, name, game.state.phase])

  useEffect(() => {
    if (game.state.phase === GamePhase.GameOver) clearSession()
  }, [game.state.phase])

  if (game.state.phase === GamePhase.Setup) {
    return <Lobby game={game} />
  }

  return <GameView game={game} connectedPlayerIds={connectedPlayerIds} onLeave={game.leave} />
}
