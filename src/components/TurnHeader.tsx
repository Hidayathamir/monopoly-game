import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { PendingActionType, type GameState } from '../types/game'

interface Props {
  state: GameState
}

function statusText(state: GameState, t: TFunction): string {
  const p = state.players[state.currentPlayer]
  const pending = state.pendingAction
  if (pending?.type === PendingActionType.BuyProperty) return t('turn.buyOffer')
  if (pending?.type === PendingActionType.PayRent) return t('turn.payRent')
  if (pending?.type === PendingActionType.Bankruptcy) return t('turn.notEnough')
  if (pending?.type === PendingActionType.DrawCard) return t('turn.drawCard')
  if (pending?.type === PendingActionType.CardEffect) return t('turn.cardEffect')
  if (p.inJail) return t('turn.inJail')
  if (state.dice) return t('turn.dice', { a: state.dice[0], b: state.dice[1], total: state.dice[0] + state.dice[1] })
  return t('turn.roll')
}

export default function TurnHeader({ state }: Props) {
  const { t } = useTranslation()
  const player = state.players[state.currentPlayer]
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-[0.25em] text-muted">{t('turn.label')}</div>
      <div className="text-2xl font-bold text-gold leading-tight">{player.name}</div>
      <div className="text-sm text-muted mt-0.5">{statusText(state, t)}</div>
    </div>
  )
}
