import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from './Button'
import Modal from './Modals/Modal'

interface Props {
  onLeave: () => void
  collapsed?: boolean
}

export default function RoomExit({ onLeave, collapsed = false }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-col items-stretch gap-1.5 w-full">
      {collapsed && (
        <button
          type="button"
          aria-label={t('confirm.leaveExpand')}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center bg-bg-dark/80 border border-border-light rounded-lg px-2 py-1 text-xs text-text cursor-pointer hover:opacity-90"
        >
          <span aria-hidden>⚙</span>
        </button>
      )}
      {(!collapsed || open) && (
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
