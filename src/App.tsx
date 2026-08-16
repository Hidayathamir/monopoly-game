import { useState } from 'react'
import { GamePhase } from './types/game'
import { useGame } from './hooks/useGame'
import GameSetup from './components/GameSetup'
import GameView from './components/GameView'
import MultiplayerGame, { type JoinInfo } from './components/MultiplayerGame'
import LanguageCurrencyBar from './components/LanguageCurrencyBar'
import { loadSession, clearSession } from './net/session'

const Mode = {
  Local: 'local',
  Multiplayer: 'multiplayer',
} as const
type Mode = (typeof Mode)[keyof typeof Mode] | null

export default function App() {
  const local = useGame()
  const [mode, setMode] = useState<Mode>(() => {
    if (loadSession()) return Mode.Multiplayer
    return local.state.phase !== GamePhase.Setup ? Mode.Local : null
  })
  const [joinInfo, setJoinInfo] = useState<JoinInfo>(() => {
    const session = loadSession()
    return session ? { name: session.name, code: session.code } : { name: '', code: null }
  })

  function handleStartLocal(players: { name: string; isBot: boolean }[]) {
    local.startGame(players)
    setMode(Mode.Local)
  }

  function handleCreate(name: string) {
    setJoinInfo({ name, code: null })
    setMode(Mode.Multiplayer)
  }

  function handleJoin(name: string, code: string) {
    setJoinInfo({ name, code })
    setMode(Mode.Multiplayer)
  }

  if (mode === Mode.Multiplayer) {
    return (
      <>
        <MultiplayerGame
          joinInfo={joinInfo}
          onLeft={() => {
            clearSession()
            setMode(null)
          }}
        />
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
      <GameView
        game={local}
        onLeave={local.resetGame}
        exitKeys={{ labelKey: 'exit.label', titleKey: 'exit.title', messageKey: 'exit.message', confirmKey: 'exit.confirm' }}
      />
      <LanguageCurrencyBar />
    </>
  )
}
