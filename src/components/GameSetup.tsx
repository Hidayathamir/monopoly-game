import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { PLAYER_COLORS } from '../data/players'
import { BOT_NAMES } from '../data/bots'

const SetupMode = {
  Local: 'local',
  Multiplayer: 'multiplayer',
} as const
type SetupMode = (typeof SetupMode)[keyof typeof SetupMode]

const MpAction = {
  Create: 'create',
  Join: 'join',
} as const
type MpAction = (typeof MpAction)[keyof typeof MpAction]

interface Props {
  onStartLocal: (players: { name: string; isBot: boolean }[]) => void
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}

export default function GameSetup({ onStartLocal, onCreate, onJoin }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<SetupMode>(SetupMode.Local)
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(['', '', '', '', '', ''])
  const [isBot, setIsBot] = useState<boolean[]>(Array(6).fill(false))
  const [myName, setMyName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mpAction, setMpAction] = useState<MpAction>(MpAction.Create)

  function handleNameChange(index: number, value: string) {
    const newNames = [...names]
    newNames[index] = value
    setNames(newNames)
  }

  function handleBotChange(index: number, value: boolean) {
    const next = [...isBot]
    next[index] = value
    setIsBot(next)
  }

  function handleStart() {
    const players = Array.from({ length: playerCount }, (_, i) => ({
      name: names[i].trim() || (isBot[i] ? BOT_NAMES[i] ?? `Bot ${i + 1}` : t('common.player', { n: i + 1 })),
      isBot: isBot[i],
    }))
    onStartLocal(players)
  }

  function handleSubmit() {
    const name = myName.trim() || t('lobby.player')
    if (mpAction === MpAction.Create) onCreate(name)
    else onJoin(name, roomCode.trim().toUpperCase())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[80px] text-gold m-0">{t('setup.title')}</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex gap-2">
          <Button
            variant={mode === SetupMode.Local ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode(SetupMode.Local)}
            className={mode === SetupMode.Local ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.singleDevice')}
          </Button>
          <Button
            variant={mode === SetupMode.Multiplayer ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode(SetupMode.Multiplayer)}
            className={mode === SetupMode.Multiplayer ? 'ring-2 ring-gold/80' : 'opacity-60'}
          >
            {t('setup.multiplayer')}
          </Button>
        </div>

        {mode === SetupMode.Local ? (
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
                <option value={5}>{t('setup.playerCount5')}</option>
                <option value={6}>{t('setup.playerCount6')}</option>
              </select>
            </div>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div className="flex flex-col gap-1.5" key={i}>
                <label className="text-base text-muted flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                  {t('setup.playerName', { n: i + 1 })}
                  <span className="ml-auto flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={isBot[i]}
                      onChange={(e) => handleBotChange(i, e.target.checked)}
                      aria-label={t('setup.isBot', { n: i + 1 })}
                    />
                    {t('setup.isBotLabel')}
                  </span>
                </label>
                <input
                  type="text"
                  value={names[i]}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  placeholder={isBot[i] ? BOT_NAMES[i] : t('setup.playerPlaceholder', { n: i + 1 })}
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
              <Button
                variant={mpAction === MpAction.Create ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMpAction(MpAction.Create)}
                className={mpAction === MpAction.Create ? 'ring-2 ring-gold/80' : 'opacity-60'}
              >
                {t('setup.createRoom')}
              </Button>
              <Button
                variant={mpAction === MpAction.Join ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMpAction(MpAction.Join)}
                className={mpAction === MpAction.Join ? 'ring-2 ring-gold/80' : 'opacity-60'}
              >
                {t('setup.joinRoom')}
              </Button>
            </div>
            {mpAction === MpAction.Join && (
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
