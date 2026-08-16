import { CardType, GamePhase, PendingActionType, SpaceType, type GameState } from '../types/game'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../i18n/CurrencyContext'
import { JAIL_FINE, getHouseCost } from '../data/board'
import Button from './Button'

interface Props {
  state: GameState
  onEndTurn: () => void
  onDrawCard: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
  onBuild?: (spaceId: number) => void
  isMyTurn?: boolean
}

export default function ActionSection({
  state, onEndTurn, onDrawCard, onBuyProperty,
  onDeclineBuy, onPayRent, onDeclareBankruptcy, onPayJailFine, onUseGetOutOfJailFree,
  onBuild, isMyTurn = true,
}: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const player = state.players[state.currentPlayer]
  if (!isMyTurn) return null
  const pending = state.pendingAction
  const canAct = state.phase === GamePhase.Waiting && !pending
  const hasRolled = state.dice !== null

  if (pending?.type === PendingActionType.BuyProperty) {
    const space = state.board[pending.spaceId]
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">{t('action.buyPrompt', { name: t('board.space.' + space.id) })}</p>
          <p className="text-base my-[3px] text-center">{t('action.price', { amount: formatMoney(space.price) })}</p>
          <Button variant="success" onClick={onBuyProperty} disabled={player.money < (space.price ?? 0)}>
            {t('action.buy', { amount: formatMoney(space.price) })}{player.money < (space.price ?? 0) ? t('action.notEnoughSuffix') : ''}
          </Button>
          <Button variant="secondary" onClick={onDeclineBuy}>{t('action.no')}</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.PayRent || pending?.type === PendingActionType.Bankruptcy) {
    const amount = pending.amount
    const canAffordNow = player.money >= amount
    const label = pending.type === PendingActionType.PayRent ? t('action.payRentLabel') : t('action.notEnoughMoney')
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">{label} <strong>{formatMoney(amount)}</strong></p>
          {!canAffordNow && (
            <p className="text-base text-muted text-center font-bold" style={{ color: '#f39c12' }}>
              {t('action.hoverHint')}
            </p>
          )}
          <Button variant="success" onClick={onPayRent} disabled={!canAffordNow}>
            {canAffordNow ? t('action.payRent') : t('action.stillNotEnough')}
          </Button>
          <Button variant="danger" onClick={onDeclareBankruptcy}>{t('action.declareBankruptcy')}</Button>
        </div>
      </div>
    )
  }

  if (pending?.type === PendingActionType.DrawCard) {
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <Button variant="primary" onClick={onDrawCard}>{t('action.drawCard')}</Button>
      </div>
    )
  }

  if (pending?.type === PendingActionType.CardEffect) {
    return (
      <div className="flex flex-col gap-1.5 w-full items-stretch">
        <div className="flex flex-col gap-1 items-center">
          <p className="text-base my-[3px] text-center">{t('card.' + (pending.card.id >= 100 ? CardType.Community : CardType.Chance) + '.' + pending.card.id)}</p>
          <p className="text-base text-muted text-center">{t('action.clickToContinue')}</p>
        </div>
      </div>
    )
  }

  if (!canAct) return null

  const space = state.board[player.position]
  const canBuild =
    state.dice !== null &&
    space?.type === SpaceType.Property &&
    space.owner === state.currentPlayer &&
    space.houses < 5 &&
    !space.mortgaged &&
    space.id !== state.justBoughtSpaceId

  return (
    <div className="flex flex-col gap-1.5 w-full items-stretch">
      {canBuild && (
        <Button
          variant="success"
          size="sm"
          onClick={() => onBuild?.(space.id)}
          disabled={player.money < getHouseCost(space, space.houses)}
        >
          {t('action.build', { amount: formatMoney(getHouseCost(space, space.houses)) })}
          {player.money < getHouseCost(space, space.houses) ? t('action.notEnoughSuffix') : ''}
        </Button>
      )}
      {player.inJail ? (
        <>
          <p className="text-base text-muted text-center mt-1">{t('action.inJailPrompt')}</p>
          {player.getOutOfJailFreeCards > 0 && (
            <Button variant="success" size="sm" onClick={onUseGetOutOfJailFree}>
              {t('action.useJailCard')}
            </Button>
          )}
          <Button variant="success" size="sm" onClick={onPayJailFine} disabled={player.money < JAIL_FINE}>
            {t('action.pay', { amount: formatMoney(JAIL_FINE) })}
          </Button>
          {player.money < JAIL_FINE && (
            <p className="text-base text-muted text-center mt-1">{t('action.notEnough')}</p>
          )}
          <p className="text-base text-muted text-center mt-1">
            {t('action.orRollDoubles', { n: 3 - player.jailTurns })}
          </p>
        </>
      ) : hasRolled ? (
        <>
          {player.money >= 0 ? (
            <>
              <Button variant="secondary" onClick={onEndTurn}>{t(state.doublesCount > 0 ? 'action.rollAgain' : 'action.endTurn')}</Button>
            </>
          ) : (
            <p className="text-base text-muted text-center mt-1" style={{ color: '#e74c3c' }}>
              {t('action.negativeBalance')}
            </p>
          )}
        </>
      ) : null}
      {(hasRolled && !player.inJail) || player.money < 0 ? (
        <p className="text-base text-muted text-center" style={{ fontSize: '16px' }}>
          {t('action.hoverShort')}
        </p>
      ) : null}
    </div>
  )
}
