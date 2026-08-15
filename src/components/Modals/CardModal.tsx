import { CardType, PendingActionType, type GameState } from '../../types/game'
import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import Button from '../Button'

interface Props {
  state: GameState
  isMyTurn: boolean
  onResolve: () => void
}

export default function CardModal({ state, isMyTurn, onResolve }: Props) {
  const { t } = useTranslation()
  const pending = state.pendingAction
  if (pending?.type !== PendingActionType.CardEffect) return null
  const player = state.players[state.currentPlayer]

  return (
    <Modal>
      <h3 className="text-2xl text-gold m-0">
        {t(pending.card.type === CardType.Chance ? 'cardmodal.chance' : 'cardmodal.community')}
      </h3>
      <p className="text-xl p-4 bg-bg-dark rounded-lg text-center">
        {t('card.' + (pending.card.type === CardType.Chance ? 'chance' : 'community') + '.' + pending.card.id)}
      </p>
      <Modal.Actions>
        {isMyTurn ? (
          <Button variant="primary" onClick={onResolve}>OK</Button>
        ) : (
          <p className="text-base text-muted text-center">{t('turn.waitingFor', { name: player.name })}</p>
        )}
      </Modal.Actions>
    </Modal>
  )
}
