import { useState } from 'react'
import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'
import MultiplayerGame, { type JoinInfo } from './components/MultiplayerGame'
import LanguageCurrencyBar from './components/LanguageCurrencyBar'

type Mode = 'local' | 'multiplayer' | null

export default function App() {
  const local = useGame()
  const [mode, setMode] = useState<Mode>(() =>
    local.state.phase !== GamePhase.Setup ? 'local' : null,
  )
  const [joinInfo, setJoinInfo] = useState<JoinInfo>({ name: '', code: null })

  function handleStartLocal(players: { name: string; isBot: boolean }[]) {
    local.startGame(players)
    setMode('local')
  }

  function handleCreate(name: string) {
    setJoinInfo({ name, code: null })
    setMode('multiplayer')
  }

  function handleJoin(name: string, code: string) {
    setJoinInfo({ name, code })
    setMode('multiplayer')
  }

  if (mode === 'multiplayer') {
    return (
      <>
        <MultiplayerGame joinInfo={joinInfo} onLeft={() => setMode(null)} />
        <LanguageCurrencyBar />
      </>
    )
  }

  if (mode === null || local.state.phase === GamePhase.Setup) {
    return (
      <>
        <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
          <GameSetup onStartLocal={handleStartLocal} onCreate={handleCreate} onJoin={handleJoin} />
        </div>
        <LanguageCurrencyBar />
      </>
    )
  }

  return (
    <>
      <GameView game={local} />
      <LanguageCurrencyBar />
    </>
  )
}
