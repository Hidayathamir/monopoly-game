import { PendingActionType, type GameState, type Space } from '../types/game';
import { formatMoney } from '../utils/format';

export type CellSide = 'top' | 'right' | 'bottom' | 'left' | 'corner';

interface Props {
  space: Space;
  state: GameState;
  rect: DOMRect;
  boardRect: DOMRect;
  side: CellSide;
  onSell: (id: number) => void;
  onMortgage: (id: number) => void;
  onUnmortgage: (id: number) => void;
  onBuild: (id: number) => void;
}

export default function PropertyTooltip({
  space,
  state,
  rect,
  boardRect,
  side,
  onSell,
  onMortgage,
  onUnmortgage,
  onBuild,
}: Props) {
  const owner = space.owner !== null ? state.players[space.owner] : null;
  const isBuyable = space.type === 'property' || space.type === 'railroad' || space.type === 'utility';
  const isOwned = space.owner === state.currentPlayer;
  const isBankruptcy = state.pendingAction?.type === PendingActionType.Bankruptcy;

  const canBuild =
    space.type === 'property' &&
    space.houses < 5 &&
    !space.mortgaged &&
    !isBankruptcy &&
    state.players[state.currentPlayer]?.money >= (space.houseCost ?? Infinity);

  const gap = 6;
  const top = rect.top - boardRect.top;
  const left = rect.left - boardRect.left;

  const topCorner = space.id === 20 || space.id === 30;

  let tooltipStyle: React.CSSProperties;
  switch (side) {
    case 'left':
      tooltipStyle = {
        position: 'absolute',
        top: top + rect.height + gap,
        left: left + rect.width / 2,
        bottom: 'auto',
        right: 'auto',
        transform: 'translateX(-50%)',
      };
      break;
    case 'right':
      tooltipStyle = {
        position: 'absolute',
        top: top + rect.height / 2,
        left: left - gap,
        bottom: 'auto',
        right: 'auto',
        transform: 'translate(-100%, -50%)',
      };
      break;
    case 'top':
      tooltipStyle = {
        position: 'absolute',
        top: top + rect.height / 2,
        left: left + rect.width + gap,
        bottom: 'auto',
        right: 'auto',
        transform: 'translateY(-50%)',
      };
      break;
    case 'corner':
      if (topCorner) {
        tooltipStyle = {
          position: 'absolute',
          top: top + rect.height + gap,
          left: left + rect.width / 2,
          bottom: 'auto',
          right: 'auto',
          transform: 'translateX(-50%)',
        };
      } else {
        tooltipStyle = {
          position: 'absolute',
          top: top - gap,
          left: left + rect.width / 2,
          bottom: 'auto',
          right: 'auto',
          transform: 'translate(-50%, -100%)',
        };
      }
      break;
    case 'bottom':
    default:
      tooltipStyle = {
        position: 'absolute',
        top: top - gap,
        left: left + rect.width / 2,
        bottom: 'auto',
        right: 'auto',
        transform: 'translate(-50%, -100%)',
      };
      break;
  }

  return (
    <div className="property-tooltip" style={tooltipStyle}>
      <div className="tooltip-header" style={space.color ? { borderLeftColor: space.color } : {}}>
        <strong>{space.name}</strong>
      </div>
      {isBuyable && space.price && (
        <>
          <div className="tooltip-row">Harga: <strong>{formatMoney(space.price)}</strong></div>
          {space.rent && space.type === 'property' && (
            <div className="tooltip-rent">
              <div className="tooltip-row">Sewa dasar: {formatMoney(space.rent[0])}</div>
              <div className="tooltip-row">1 🏠 : {formatMoney(space.rent[1])}</div>
              <div className="tooltip-row">2 🏠 : {formatMoney(space.rent[2])}</div>
              <div className="tooltip-row">3 🏠 : {formatMoney(space.rent[3])}</div>
              <div className="tooltip-row">4 🏠 : {formatMoney(space.rent[4])}</div>
              <div className="tooltip-row">🏨 : {formatMoney(space.rent[space.rent.length - 1])}</div>
            </div>
          )}
          {space.rent && space.type === 'railroad' && (
            <div className="tooltip-rent">
              <div className="tooltip-row">1 Stasiun: {formatMoney(space.rent[0])}</div>
              <div className="tooltip-row">2 Stasiun: {formatMoney(space.rent[1])}</div>
              <div className="tooltip-row">3 Stasiun: {formatMoney(space.rent[2])}</div>
              <div className="tooltip-row">4 Stasiun: {formatMoney(space.rent[3])}</div>
            </div>
          )}
          {space.type === 'utility' && (
            <div className="tooltip-rent">
              <div className="tooltip-row">1 Perusahaan: 4× Dadu</div>
              <div className="tooltip-row">2 Perusahaan: 10× Dadu</div>
            </div>
          )}
          {space.houseCost && <div className="tooltip-row">Biaya rumah: {formatMoney(space.houseCost)}</div>}
          {space.houses > 0 && (
            <div className="tooltip-row">
              Level: {space.houses === 5 ? '🏨 Hotel' : '🏠'.repeat(space.houses)}
            </div>
          )}
        </>
      )}
      {space.mortgaged && <div className="tooltip-row mortgaged">Digadaikan</div>}
      {owner && (
        <div className="tooltip-row">
          Pemilik: <span style={{ color: '#f0c040' }}>{owner.name}</span>
        </div>
      )}
      {isOwned && (
        <div className="tooltip-actions">
          {space.houses > 0 && (
            <button className="btn btn-small btn-sell" onClick={(e) => { e.stopPropagation(); onSell(space.id); }}>
              Jual {space.houses === 5 ? 'Hotel' : 'Rumah'} (+{formatMoney(Math.floor((space.houseCost ?? 0) / 2))})
            </button>
          )}
          {!space.mortgaged && space.houses === 0 && (
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); onMortgage(space.id); }}>
              Gadai (+{formatMoney(Math.floor((space.price ?? 0) / 2))})
            </button>
          )}
          {space.mortgaged && (
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); onUnmortgage(space.id); }}>
              Tebus (-{formatMoney(Math.floor((space.price ?? 0) / 2 * 1.1))})
            </button>
          )}
          {canBuild && (
            <button className="btn btn-small btn-build" onClick={(e) => { e.stopPropagation(); onBuild(space.id); }}>
              Bangun ({formatMoney(space.houseCost!)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
