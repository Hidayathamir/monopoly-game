import { PendingActionType, type GameState } from '../../types/game';
import { formatMoney } from '../../utils/format';

interface Props {
  state: GameState;
  onBuy: () => void;
  onDecline: () => void;
}

export default function BuyPropertyModal({ state, onBuy, onDecline }: Props) {
  const pending = state.pendingAction;
  if (pending?.type !== PendingActionType.BuyProperty) return null;
  const space = state.board[pending.spaceId];
  if (!space) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{space.name}</h3>
        <p>Harga: <strong>{formatMoney(space.price)}</strong></p>
        {space.rent && (
          <div className="rent-table">
            <p>Sewa: {space.rent[0]}</p>
            <p>Sewa 1🏠: {space.rent[1]}</p>
            <p>Hotel: {space.rent[space.rent.length - 1]}</p>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-success" onClick={onBuy}>Beli ({formatMoney(space.price)})</button>
          <button className="btn btn-secondary" onClick={onDecline}>Tidak</button>
        </div>
      </div>
    </div>
  );
}
