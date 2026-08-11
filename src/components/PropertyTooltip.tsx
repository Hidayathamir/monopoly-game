import { PendingActionType, type GameState, type Space } from '../types/game'
import { formatMoney } from '../utils/format'
import Button from './Button'

export type CellSide = 'top' | 'right' | 'bottom' | 'left' | 'corner'

interface Props {
  space: Space
  state: GameState
  rect: DOMRect
  boardRect: DOMRect
  side: CellSide
  onSell: (id: number) => void
  onMortgage: (id: number) => void
  onUnmortgage: (id: number) => void
  onBuild: (id: number) => void
  onSellProperty: (id: number) => void
}

export default function PropertyTooltip({
  space, state, rect, boardRect, side, onSell, onMortgage, onUnmortgage, onBuild, onSellProperty,
}: Props) {
  const owner = space.owner !== null ? state.players[space.owner] : null
  const isBuyable = space.type === 'property' || space.type === 'railroad' || space.type === 'utility'
  const isOwned = space.owner === state.currentPlayer
  const isBankruptcy = state.pendingAction?.type === PendingActionType.Bankruptcy

  const canBuildBase =
    space.type === 'property' &&
    space.houses < 5 &&
    !space.mortgaged &&
    !isBankruptcy &&
    space.id === state.players[state.currentPlayer]?.position
  const canAffordBuild = state.players[state.currentPlayer]?.money >= (space.houseCost ?? Infinity)

  const gap = 6
  const top = rect.top - boardRect.top
  const left = rect.left - boardRect.left
  const topCorner = space.id === 20 || space.id === 30

  let tooltipStyle: React.CSSProperties
  switch (side) {
    case 'left':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height + gap, left: left + rect.width / 2,
        bottom: 'auto', right: 'auto', transform: 'translateX(-50%)',
      }
      break
    case 'right':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height / 2, left: left - gap,
        bottom: 'auto', right: 'auto', transform: 'translate(-100%, -50%)',
      }
      break
    case 'top':
      tooltipStyle = {
        position: 'absolute', top: top + rect.height / 2, left: left + rect.width + gap,
        bottom: 'auto', right: 'auto', transform: 'translateY(-50%)',
      }
      break
    case 'corner':
      if (topCorner) {
        tooltipStyle = {
          position: 'absolute', top: top + rect.height + gap, left: left + rect.width / 2,
          bottom: 'auto', right: 'auto', transform: 'translateX(-50%)',
        }
      } else {
        tooltipStyle = {
          position: 'absolute', top: top - gap, left: left + rect.width / 2,
          bottom: 'auto', right: 'auto', transform: 'translate(-50%, -100%)',
        }
      }
      break
    case 'bottom':
    default:
      tooltipStyle = {
        position: 'absolute', top: top - gap, left: left + rect.width / 2,
        bottom: 'auto', right: 'auto', transform: 'translate(-50%, -100%)',
      }
      break
  }

  return (
    <div
      className="absolute bg-bg-dark border border-border-light rounded-lg px-3 py-2.5 min-w-[160px] z-[999] shadow-lg pointer-events-auto"
      style={tooltipStyle}
    >
      <div className="text-base text-gold mb-1 border-l-[3px] pl-1.5" style={space.color ? { borderLeftColor: space.color } : {}}>
        <strong>{space.name}</strong>
      </div>
      {space.mortgaged && <div className="text-sm text-red-danger font-bold">Digadaikan</div>}
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
          {space.houseCost && <div className="text-sm text-text-dim">Biaya rumah: {formatMoney(space.houseCost)}</div>}
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
              Jual {space.houses === 5 ? 'Hotel' : 'Rumah'} (+{formatMoney(Math.floor((space.houseCost ?? 0) / 2))})
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
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id) }}>
              Tebus (-{formatMoney(Math.floor((space.price ?? 0) / 2 * 1.1))})
            </Button>
          )}
          {canBuildBase && (
            <Button
              size="sm"
              variant="success"
              disabled={!canAffordBuild}
              onClick={(e) => { e.stopPropagation(); onBuild(space.id) }}
            >
              Bangun ({formatMoney(space.houseCost!)}){!canAffordBuild ? ' - uang kurang' : ''}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
