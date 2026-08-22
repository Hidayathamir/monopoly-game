import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { useRoomList } from '../hooks/useRoomList'
import { GamePhase } from '../types/game'
import { StorageKey } from '../i18n/constants'

const MpAction = {
  Create: 'create',
  Join: 'join',
} as const
type MpAction = (typeof MpAction)[keyof typeof MpAction]

interface Props {
  onCreate: (name: string) => void
  onJoin: (name: string, code: string) => void
}

export default function GameSetup({ onCreate, onJoin }: Props) {
  const { t } = useTranslation()
  const [myName, setMyName] = useState(() => localStorage.getItem(StorageKey.PlayerName) ?? '')
  const [roomCode, setRoomCode] = useState('')
  const [mpAction, setMpAction] = useState<MpAction>(MpAction.Create)
  const { rooms, error } = useRoomList()
  const [nameError, setNameError] = useState<string | null>(null)

  function handleSubmit() {
    const trimmed = myName.trim()
    if (!trimmed) {
      setNameError(t('setup.nameRequired'))
      return
    }
    setNameError(null)
    if (mpAction === MpAction.Create) onCreate(trimmed)
    else onJoin(trimmed, roomCode.trim().toUpperCase())
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[80px] text-gold m-0">{t('setup.title')}</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-base text-muted">{t('setup.yourName')}</label>
          <input
            type="text"
            value={myName}
            onChange={(e) => {
              const value = e.target.value
              setMyName(value)
              if (nameError) setNameError(null)
              localStorage.setItem(StorageKey.PlayerName, value)
            }}
            placeholder={t('setup.namePlaceholder')}
            maxLength={12}
            className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
          />
          {nameError && <p className="text-red-danger text-xs mt-0.5">{nameError}</p>}
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
      </div>
      {!error && (
        <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
          <h2 className="text-xl text-gold m-0">{t('setup.openRooms')}</h2>
          {rooms.length === 0 ? (
            <p className="text-base text-muted" data-testid="no-rooms">
              {t('setup.noRooms')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="room-list">
              {rooms.map((room) => (
                <li key={room.code}>
<button
                      type="button"
                      data-testid="room-row"
                      onClick={() => {
                        const trimmed = myName.trim()
                        if (!trimmed) { setNameError(t('setup.nameRequired')); return }
                        setNameError(null)
                        onJoin(trimmed, room.code)
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base cursor-pointer hover:-translate-y-px hover:opacity-90 transition-transform duration-150"
                    >
                      <span>{room.hostName ?? '—'}</span>
                      <span className="text-muted text-sm">
                        {t('setup.playerCount', { n: room.playerCount, max: 6 })}
                      </span>
                      <span className="text-muted text-sm">
                        {room.phase === GamePhase.Setup ? t('setup.statusLobby') : t('setup.statusInGame')}
                      </span>
                      <span className="text-gold text-sm font-semibold whitespace-nowrap" aria-label={t('setup.joinRoom')}>
                        {t('setup.joinRoom')} →
                      </span>
                    </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}