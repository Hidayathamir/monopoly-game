import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import { useRoomList } from '../hooks/useRoomList'
import { GamePhase } from '../types/game'

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
  const [myName, setMyName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mpAction, setMpAction] = useState<MpAction>(MpAction.Create)
  const { rooms, error } = useRoomList()

  function resolveName() {
    return myName.trim() || t('lobby.player')
  }

  function handleSubmit() {
    const name = resolveName()
    if (mpAction === MpAction.Create) onCreate(name)
    else onJoin(name, roomCode.trim().toUpperCase())
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
                    onClick={() => onJoin(resolveName(), room.code)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-base"
                  >
                    <span>{room.hostName ?? '—'}</span>
                    <span className="text-muted text-sm">
                      {t('setup.playerCount', { n: room.playerCount, max: 6 })}
                    </span>
                    <span className="text-muted text-sm">
                      {room.phase === GamePhase.Setup ? t('setup.statusLobby') : t('setup.statusInGame')}
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