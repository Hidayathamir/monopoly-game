import { SpaceType, TaxType, type GameState, type Space } from '../types/game'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../i18n/CurrencyContext'
import { getHouseCost, GO_SALARY, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE } from '../data/board'
import { isMonopoly, calculatePropertyRent } from '../logic/rent'
import Button from './Button'

interface Props {
  space: Space
  state: GameState
  isMyTurn?: boolean
  onSell: (id: number) => void
  onMortgage: (id: number) => void
  onUnmortgage: (id: number) => void
  onSellProperty: (id: number) => void
}

export default function PropertyTooltip({
  space, state, isMyTurn = true, onSell, onMortgage, onUnmortgage, onSellProperty,
}: Props) {
  const { t } = useTranslation()
  const { formatMoney } = useCurrency()
  const owner = space.owner !== null ? state.players[space.owner] : null
  const isBuyable = space.type === SpaceType.Property || space.type === SpaceType.Railroad || space.type === SpaceType.Utility
  const isOwned = space.owner === state.currentPlayer
  const nextHouseCost = getHouseCost(space, space.houses)
  const unmortgageCost = Math.floor((space.price ?? 0) / 2 * 1.1)

  return (
    <div
      className="bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[160px] shadow-lg pointer-events-auto"
    >
      <div className="text-base text-gold mb-1 border-l-[3px] pl-1.5" style={space.color ? { borderLeftColor: space.color } : {}}>
        <strong>{t('board.space.' + space.id)}</strong>
      </div>
      {space.mortgaged && <div className="text-sm text-red-danger font-bold">{t('tooltip.mortgaged')}</div>}
      {space.type === SpaceType.Go && (
        <div className="text-sm text-text-dim">{t('tooltip.passGo', { amount: formatMoney(GO_SALARY) })}</div>
      )}
      {space.type === SpaceType.FreeParking && (
        <div className="text-sm text-text-dim">{t('tooltip.jackpot', { amount: formatMoney(state.freeParkingPot) })}</div>
      )}
      {space.type === SpaceType.Tax && (
        <div className="text-sm text-text-dim">
          {space.taxType === TaxType.Income
            ? t('tooltip.incomeTax')
            : t('tooltip.flatTax', { amount: formatMoney(space.price) })}
        </div>
      )}
      {isBuyable && space.price && (
        <>
          <div className="text-sm text-text-dim m-0.5">{t('tooltip.price')}<strong className="text-green-money">{formatMoney(space.price)}</strong></div>
          {space.rent && space.type === SpaceType.Property && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">{t('tooltip.baseRent')}{formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">1 {t('tooltip.house')}: {formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">2 {t('tooltip.house')}: {formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">3 {t('tooltip.house')}: {formatMoney(space.rent[3])}</div>
              <div className="text-text-dim">4 {t('tooltip.house')}: {formatMoney(space.rent[4])}</div>
              <div className="text-text-dim">{t('tooltip.hotelWord')}: {formatMoney(space.rent[space.rent.length - 1])}</div>
            </div>
          )}
          {space.rent && space.type === SpaceType.Railroad && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">{t('tooltip.railroad1')}{formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">{t('tooltip.railroad2')}{formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">{t('tooltip.railroad3')}{formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">{t('tooltip.railroad4')}{formatMoney(space.rent[3])}</div>
            </div>
          )}
          {space.type === SpaceType.Utility && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">{t('tooltip.utility1')}</div>
              <div className="text-text-dim">{t('tooltip.utility2')}</div>
            </div>
          )}
          {space.type === SpaceType.Property && space.owner !== null && isMonopoly(space.owner, state.board, space) && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm text-gold font-semibold">
              {t('tooltip.monopoly', { amount: formatMoney(calculatePropertyRent(space) * 2) })}
            </div>
          )}
          {space.houseCost && <div className="text-sm text-text-dim">{t('tooltip.nextHouse')}{formatMoney(nextHouseCost)}</div>}
          {space.houses > 0 && (
            <div className="text-sm text-text-dim">
              {t('tooltip.level')}{space.houses === 5 ? t('tooltip.hotel') : '🏠'.repeat(space.houses)}
            </div>
          )}
        </>
      )}
      {owner && (
        <div className="text-sm text-text-dim">
          {t('tooltip.owner')}<span className="text-gold">{owner.name}</span>
        </div>
      )}
      {isOwned && isMyTurn && (
        <div className="mt-1.5 pt-1.5 border-t border-border-light flex flex-col gap-[3px]">
          {space.houses > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onSell(space.id) }}
            >
              {t(space.houses === 5 ? 'tooltip.sellHotel' : 'tooltip.sellHouse', { amount: formatMoney(Math.floor(getHouseCost(space, space.houses - 1) * HOUSE_SELL_RATE)) })}
            </Button>
          )}
          {!space.mortgaged && space.houses === 0 && isOwned && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onMortgage(space.id) }}>
              {t('tooltip.mortgage', { amount: formatMoney(Math.floor((space.price ?? 0) / 2)) })}
            </Button>
          )}
          {!space.mortgaged && space.houses === 0 && isOwned && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); onSellProperty(space.id) }}
            >
              {t('tooltip.sellToBank', { amount: formatMoney(Math.floor((space.price ?? 0) * SELL_RATE)) })}
            </Button>
          )}
          {space.mortgaged && (
            <Button
              size="sm"
              disabled={state.players[state.currentPlayer]?.money < unmortgageCost}
              onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id) }}
            >
              {t('tooltip.redeem', { amount: formatMoney(unmortgageCost) })}{state.players[state.currentPlayer]?.money < unmortgageCost ? t('action.notEnoughSuffix') : ''}
            </Button>
          )}
          {space.mortgaged && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); onSellProperty(space.id) }}
            >
              {t('tooltip.sellToBank', { amount: formatMoney(Math.floor((space.price ?? 0) * MORTGAGED_SELL_EXTRA)) })}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
