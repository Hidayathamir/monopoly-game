import { PendingActionType, type GameState } from '../../types/game';
import { formatMoney } from '../../utils/format';

interface Props {
  state: GameState;
  onClose: () => void;
  onBankruptcy: () => void;
}

export default function BankruptcyModal({ state, onClose, onBankruptcy }: Props) {
  const pending = state.pendingAction;
  if (pending?.type !== PendingActionType.Bankruptcy) return null;
  const player = state.players[state.currentPlayer];
  const amount = pending.amount;

  const canPayAfterLiquidation = (() => {
    let money = player.money;
    const ownedProps = state.board.filter((s) => s.owner === state.currentPlayer && !s.mortgaged);
    for (const s of ownedProps) {
      money += Math.floor((s.houseCost ?? 0) / 2) * s.houses;
      money += Math.floor((s.price ?? 0) / 2);
    }
    return money >= amount;
  })();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>⚠️ Kebangkrutan</h3>
        <p>{player.name} tidak bisa membayar <strong>{formatMoney(amount)}</strong>.</p>
        <p>Uang saat ini: {formatMoney(player.money)}</p>

        {canPayAfterLiquidation && (
          <p className="text-muted">Jual rumah / gadaikan properti untuk mendapatkan uang.</p>
        )}

        <div className="modal-actions">
          {!canPayAfterLiquidation && (
            <button className="btn btn-danger" onClick={onBankruptcy}>
              Nyatakan Bangkrut
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Tutup (Jual/Gadai lebih dulu)</button>
        </div>
      </div>
    </div>
  );
}
