import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import Modal from './Modals/Modal'

interface Props {
  onLeave: () => void
  variant?: 'icon' | 'button'
}

export default function RoomExit({ onLeave, variant = 'button' }: Props) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={variant === 'icon' ? 'flex flex-col items-center' : 'flex flex-col items-stretch gap-1.5 w-full'}>
      {variant === 'icon' ? (
        <button
          type="button"
          aria-label={t('lobby.leaveRoom')}
          title={t('lobby.leaveRoom')}
          onClick={() => setConfirming(true)}
          className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-sm text-text cursor-pointer hover:opacity-90"
        >
          <span aria-hidden>🚪</span>
        </button>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t('lobby.leaveRoom')}
        </Button>
      )}
      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <h3 className="text-2xl text-gold m-0">{t('confirm.leaveTitle')}</h3>
          <p className="text-base text-text">{t('confirm.leaveMessage')}</p>
          <Modal.Actions>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button variant="danger" onClick={onLeave}>
              {t('confirm.leave')}
            </Button>
          </Modal.Actions>
        </Modal>
      )}
    </div>
  )
}
