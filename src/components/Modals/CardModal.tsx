import { CardType, PendingActionType, type GameState } from '../../types/game';

interface Props {
  state: GameState;
  onResolve: () => void;
}

export default function CardModal({ state, onResolve }: Props) {
  const pending = state.pendingAction;
  if (pending?.type !== PendingActionType.CardEffect) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal-card">
        <h3>{pending.card.type === CardType.Chance ? 'Kesempatan' : 'Dana Umum'}</h3>
        <p className="card-description">{pending.card.description}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onResolve}>OK</button>
        </div>
      </div>
    </div>
  );
}
