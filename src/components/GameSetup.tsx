import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { PLAYER_COLORS } from '../data/players'

interface Props {
  onStartLocal: (playerCount: number, names: string[]) => void
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}

export default function GameSetup({ onStartLocal, onCreate, onJoin }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'local' | 'multiplayer'>('local')
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(['', '', '', ''])
  const [myName, setMyName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mpAction, setMpAction] = useState<'create' | 'join'>('create')

  function handleNameChange(index: number, value: string) {
    const newNames = [...names]
    newNames[index] = value
    setNames(newNames)
  }

  function handleStart() {
    const filledNames = names.slice(0, playerCount).map((n, i) => n.trim() || t('common.player', { n: i + 1 }))
    onStartLocal(playerCount, filledNames)
  }

  function handleSubmit() {
    const name = myName.trim() || t('lobby.player')
    if (mpAction === 'create') onCreate(name)
    else onJoin(name, roomCode.trim().toUpperCase())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[80px] text-gold m-0">{t('setup.title')}</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex gap-2">
          <Button variant={mode === 'local' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('local')}>
            {t('setup.singleDevice')}
          </Button>
          <Button variant={mode === 'multiplayer' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('multiplayer')}>
            {t('setup.multiplayer')}
          </Button>
        </div>

        {mode === 'local' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-base text-muted">{t('setup.playerCount')}</label>
              <select
                aria-label="player-count"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
              >
                <option value={2}>{t('setup.playerCount2')}</option>
                <option value={3}>{t('setup.playerCount3')}</option>
                <option value={4}>{t('setup.playerCount4')}</option>
              </select>
            </div>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div className="flex flex-col gap-1.5" key={i}>
                <label className="text-base text-muted flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                  {t('setup.playerName', { n: i + 1 })}
                </label>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={t('setup.playerPlaceholder', { n: i + 1 })}
                  maxLength={12}
                  className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
                />
              </div>
            ))}
            <Button variant="start" size="lg" onClick={handleStart}>
              {t('setup.start')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-base text-muted">{t('setup.yourName')}</label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder={t('setup.namePlaceholder')}
                maxLength={12}
                className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={mpAction === 'create' ? 'primary' : 'secondary'} size="sm" onClick={() => setMpAction('create')}>
                {t('setup.createRoom')}
              </Button>
              <Button variant={mpAction === 'join' ? 'primary' : 'secondary'} size="sm" onClick={() => setMpAction('join')}>
                {t('setup.joinRoom')}
              </Button>
            </div>
            {mpAction === 'join' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-base text-muted">{t('setup.roomCode')}</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder={t('setup.codePlaceholder')}
                  maxLength={5}
                  className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
                />
              </div>
            )}
            <Button variant="start" size="lg" onClick={handleSubmit}>
              {t('setup.continue')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
