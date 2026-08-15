import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'

export default function App() {
  const game = useGame()
  const { state } = game

  if (state.phase === GamePhase.Setup) {
    return (
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onStart={game.startGame} />
      </div>
    )
  }

  return <GameView game={game} />
}
