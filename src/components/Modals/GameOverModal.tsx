import { GamePhase, type GameState } from '../../types/game';
import { formatMoney } from '../../utils/format';

interface Props {
  state: GameState;
  onReset: () => void;
}

export default function GameOverModal({ state, onReset }: Props) {
  if (state.phase !== GamePhase.GameOver) return null;
  const winner = state.players.find((p) => !p.bankrupt);
  if (!winner) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal-gameover">
        <h2>🏆 Permainan Selesai!</h2>
        <p className="winner-name">{winner.name} menang!</p>
        <p>Dengan kekayaan bersih: {formatMoney(winner.money + state.board
          .filter((s) => s.owner === winner.id)
          .reduce((sum, s) => sum + (s.price ?? 0) + (s.houseCost ?? 0) * s.houses, 0))}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onReset}>Main Lagi</button>
        </div>
      </div>
    </div>
  );
}
