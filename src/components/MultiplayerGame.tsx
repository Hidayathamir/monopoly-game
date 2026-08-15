import { useEffect } from 'react'
import { GamePhase } from '../types/game'
import { useNetworkGame } from '../hooks/useNetworkGame'
import Lobby from './Lobby'
import GameView from './GameView'

interface Props {
  name: string
  onExit: () => void
}

export default function MultiplayerGame({ name, onExit }: Props) {
  const game = useNetworkGame()
  const { join } = game

  useEffect(() => {
    join(name)
  }, [name, join])

  if (game.state.phase === GamePhase.Setup) {
    return <Lobby game={game} onExit={onExit} />
  }

  return <GameView game={game} />
}
