import { CardType, PendingActionType, type GameState } from '../../types/game'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  onResolve: () => void
}

export default function CardModal({ state, onResolve }: Props) {
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.CardEffect) return null

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">
        {pending.card.type === CardType.Chance ? 'Kesempatan' : 'Dana Umum'}
      </h3>
      <p className="text-xl p-4 bg-bg-dark rounded-lg text-center">
        {pending.card.description}
      </p>
      <Modal.Actions>
        <Button variant="primary" onClick={onResolve}>OK</Button>
      </Modal.Actions>
    </Modal>
  )
}
