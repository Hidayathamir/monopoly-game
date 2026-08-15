import { PendingActionType, type GameState } from '../../types/game'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../../i18n/CurrencyContext'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onBuy: () => void
  onDecline: () => void
}

export default function BuyPropertyModal({ state, onBuy, onDecline }: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.BuyProperty) return null
  const space = state.board[pending.spaceId]
  if (!space) return null

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">{t('board.space.' + space.id)}</h3>
      <p className="text-lg m-0">{t('buymodal.price')}<strong>{formatMoney(space.price)}</strong></p>
      {space.rent && (
        <div className="bg-bg-dark rounded-lg px-3 py-2 text-base">
          <p className="my-0.5">{t('buymodal.rent')}{space.rent[0]}</p>
          <p className="my-0.5">{t('buymodal.rent1')}{space.rent[1]}</p>
          <p className="my-0.5">{t('buymodal.hotel')}{space.rent[space.rent.length - 1]}</p>
        </div>
      )}
      <Modal.Actions>
        <Button variant="success" onClick={onBuy}>{t('buymodal.buy', { amount: formatMoney(space.price) })}</Button>
        <Button variant="secondary" onClick={onDecline}>{t('action.no')}</Button>
      </Modal.Actions>
    </Modal>
  )
}
