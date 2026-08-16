import { useState } from 'react'
import GameSetup from './components/GameSetup'
import MultiplayerGame, { type JoinInfo } from './components/MultiplayerGame'
import LanguageCurrencyBar from './components/LanguageCurrencyBar'
import { loadSession, clearSession } from './net/session'

export default function App() {
  const [session] = useState(loadSession)
  const [started, setStarted] = useState(() => session !== null)
  const [joinInfo, setJoinInfo] = useState<JoinInfo>(() =>
    session ? { name: session.name, code: session.code } : { name: '', code: null },
  )

  function handleCreate(name: string) {
    setJoinInfo({ name, code: null })
    setStarted(true)
  }

  function handleJoin(name: string, code: string) {
    setJoinInfo({ name, code })
    setStarted(true)
  }

  if (started) {
    return (
      <>
        <MultiplayerGame
          joinInfo={joinInfo}
          onLeft={() => {
            clearSession()
            setStarted(false)
          }}
        />
        <LanguageCurrencyBar />
      </>
    )
  }

  return (
    <>
      <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
        <GameSetup onCreate={handleCreate} onJoin={handleJoin} />
      </div>
      <LanguageCurrencyBar />
    </>
  )
}
