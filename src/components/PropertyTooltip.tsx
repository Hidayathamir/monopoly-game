import { type GameState, type Space } from '../types/game'
import { formatMoney } from '../utils/format'
import { getHouseCost } from '../data/board'
import { GO_SALARY } from '../data/board'
import Button from './Button'

interface Props {
  space: Space
  state: GameState
  onSell: (id: number) => void
  onMortgage: (id: number) => void
  onUnmortgage: (id: number) => void
  onSellProperty: (id: number) => void
}

export default function PropertyTooltip({
  space, state, onSell, onMortgage, onUnmortgage, onSellProperty,
}: Props) {
  const owner = space.owner !== null ? state.players[space.owner] : null
  const isBuyable = space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
  const isOwned = space.owner === state.currentPlayer
  const nextHouseCost = getHouseCost(space, space.houses)
  const unmortgageCost = Math.floor((space.price ?? 0) / 2 * 1.1)

  return (
    <div
      className="bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[160px] shadow-lg pointer-events-auto"
    >
      <div className="text-base text-gold mb-1 border-l-[3px] pl-1.5" style={space.color ? { borderLeftColor: space.color } : {}}>
        <strong>{space.name}</strong>
      </div>
      {space.mortgaged && <div className="text-sm text-red-danger font-bold">Digadaikan</div>}
      {space.type === 'go' && (
        <div className="text-sm text-text-dim">Dapat <strong className="text-green-money">{formatMoney(GO_SALARY)}</strong> setiap lewat MULAI</div>
      )}
      {space.type === 'freeParking' && (
        <div className="text-sm text-text-dim">Jackpot saat ini: <strong className="text-green-money">{formatMoney(state.freeParkingPot)}</strong></div>
      )}
      {isBuyable && space.price && (
        <>
          <div className="text-sm text-text-dim m-0.5">Harga: <strong className="text-green-money">{formatMoney(space.price)}</strong></div>
          {space.rent && space.type === 'property' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">Sewa dasar: {formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">1 🏠 : {formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">2 🏠 : {formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">3 🏠 : {formatMoney(space.rent[3])}</div>
              <div className="text-text-dim">4 🏠 : {formatMoney(space.rent[4])}</div>
              <div className="text-text-dim">🏨 : {formatMoney(space.rent[space.rent.length - 1])}</div>
            </div>
          )}
          {space.rent && space.type === 'railroad' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">1 Stasiun: {formatMoney(space.rent[0])}</div>
              <div className="text-text-dim">2 Stasiun: {formatMoney(space.rent[1])}</div>
              <div className="text-text-dim">3 Stasiun: {formatMoney(space.rent[2])}</div>
              <div className="text-text-dim">4 Stasiun: {formatMoney(space.rent[3])}</div>
            </div>
          )}
          {space.type === 'utility' && (
            <div className="my-1 p-1 bg-bg-darker rounded text-sm">
              <div className="text-text-dim">1 Perusahaan: 4× Dadu</div>
              <div className="text-text-dim">2 Perusahaan: 10× Dadu</div>
            </div>
          )}
          {space.houseCost && <div className="text-sm text-text-dim">Biaya rumah selanjutnya: {formatMoney(nextHouseCost)}</div>}
          {space.houses > 0 && (
            <div className="text-sm text-text-dim">
              Level: {space.houses === 5 ? '🏨 Hotel' : '🏠'.repeat(space.houses)}
            </div>
          )}
        </>
      )}
      {owner && (
        <div className="text-sm text-text-dim">
          Pemilik: <span className="text-gold">{owner.name}</span>
        </div>
      )}
      {isOwned && (
        <div className="mt-1.5 pt-1.5 border-t border-border-light flex flex-col gap-[3px]">
          {space.houses > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onSell(space.id) }}
            >
              Jual {space.houses === 5 ? 'Hotel' : 'Rumah'} (+{formatMoney(Math.floor(getHouseCost(space, space.houses - 1) / 2))})
            </Button>
          )}
          {!space.mortgaged && space.houses === 0 && isOwned && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onMortgage(space.id) }}>
              Gadai (+{formatMoney(Math.floor((space.price ?? 0) / 2))})
            </Button>
          )}
          {!space.mortgaged && space.houses === 0 && isOwned && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); onSellProperty(space.id) }}
            >
              Jual ke Bank (+{formatMoney(Math.floor((space.price ?? 0) / 2))})
            </Button>
          )}
          {space.mortgaged && (
            <Button
              size="sm"
              disabled={state.players[state.currentPlayer]?.money < unmortgageCost}
              onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id) }}
            >
              Tebus (-{formatMoney(unmortgageCost)}){state.players[state.currentPlayer]?.money < unmortgageCost ? ' - uang kurang' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
