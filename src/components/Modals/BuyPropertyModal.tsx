import { PendingActionType, type GameState } from '../../types/game'
import { formatMoney } from '../../utils/format'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onBuy: () => void
  onDecline: () => void
}

export default function BuyPropertyModal({ state, onBuy, onDecline }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.BuyProperty) return null
  const space = state.board[pending.spaceId]
  if (!space) return null

  return (
    <Modal>
      <h3 className="text-lg text-gold m-0">{space.name}</h3>
      <p className="text-sm m-0">Harga: <strong>{formatMoney(space.price)}</strong></p>
      {space.rent && (
        <div className="bg-bg-dark rounded-lg px-3 py-2 text-xs">
          <p className="my-0.5">Sewa: {space.rent[0]}</p>
          <p className="my-0.5">Sewa 1🏠: {space.rent[1]}</p>
          <p className="my-0.5">Hotel: {space.rent[space.rent.length - 1]}</p>
        </div>
      )}
      <Modal.Actions>
        <Button variant="success" onClick={onBuy}>Beli ({formatMoney(space.price)})</Button>
        <Button variant="secondary" onClick={onDecline}>Tidak</Button>
      </Modal.Actions>
    </Modal>
  )
}
