import { useState } from 'react'
import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'
import MultiplayerGame from './components/MultiplayerGame'

type Mode = 'local' | 'multiplayer' | null

export default function App() {
  const local = useGame()
  const [mode, setMode] = useState<Mode>(() =>
    local.state.phase !== GamePhase.Setup ? 'local' : null,
  )
  const [name, setName] = useState('')

  function handleStartLocal(count: number, names: string[]) {
    local.startGame(count, names)
    setMode('local')
  }

  function handleJoin(n: string) {
    setName(n)
    setMode('multiplayer')
  }

  if (mode === 'multiplayer') {
    return <MultiplayerGame name={name} onExit={() => setMode(null)} />
  }

  if (mode === null || local.state.phase === GamePhase.Setup) {
    return (
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onStartLocal={handleStartLocal} onJoin={handleJoin} />
      </div>
    )
  }

  return <GameView game={local} />
}
