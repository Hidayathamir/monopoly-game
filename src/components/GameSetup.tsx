import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'

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

  function handleSubmit() {
    const name = myName.trim() || t('lobby.player')
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
    </div>
  )
}
