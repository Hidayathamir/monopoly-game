import { useEffect } from 'react'
import { GamePhase } from '../types/game'
import { useNetworkGame } from '../hooks/useNetworkGame'
import { saveSession, clearSession } from '../net/session'
import Lobby from './Lobby'
import GameView from './GameView'

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
