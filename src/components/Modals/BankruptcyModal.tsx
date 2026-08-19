import { PendingActionType, type GameState } from '../../types/game'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../../i18n/CurrencyContext'
import { getTotalHouseInvestment } from '../../data/board'
import Modal from './Modal'
import Button from '../Button'
import HoldToConfirmButton from '../HoldToConfirmButton'

interface Props {
  state: GameState
  isMyTurn: boolean
  onClose: () => void
  onBankruptcy: () => void
}

export default function BankruptcyModal({ state, isMyTurn, onClose, onBankruptcy }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.Bankruptcy) return null
  const player = state.players[state.currentPlayer]
  const amount = pending.amount

  const canPayAfterLiquidation = (() => {
    let money = player.money
    const ownedProps = state.board.filter((s) => s.owner === state.currentPlayer && !s.mortgaged)
    for (const s of ownedProps) {
      money += Math.floor(getTotalHouseInvestment(s) / 2)
      money += Math.floor((s.price ?? 0) / 2)
    }
    return money >= amount
  })()

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">{t('bankruptcy.title')}</h3>
      <p className="text-lg m-0">{t('bankruptcy.cannotPay', { name: player.name, amount: formatMoney(amount) })}</p>
      <p className="text-lg m-0">{t('bankruptcy.currentMoney')}{formatMoney(player.money)}</p>
      {canPayAfterLiquidation && (
        <p className="text-muted text-base">{t('bankruptcy.hint')}</p>
      )}
      <Modal.Actions>
        {!isMyTurn ? (
          <p className="text-base text-muted text-center">{t('turn.waitingFor', { name: player.name })}</p>
        ) : (
          <>
            {!canPayAfterLiquidation && (
              <HoldToConfirmButton variant="danger" onConfirm={onBankruptcy} hint={t('bankruptcy.holdHint')}>
                {t('bankruptcy.declare')}
              </HoldToConfirmButton>
            )}
            <Button variant="secondary" onClick={onClose}>{t('bankruptcy.close')}</Button>
          </>
        )}
      </Modal.Actions>
    </Modal>
  )
}
