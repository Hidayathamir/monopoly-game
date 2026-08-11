import { GamePhase, PendingActionType, type GameState } from '../types/game';
import { formatMoney } from '../utils/format';
import { JAIL_FINE } from '../data/board';
import DiceRoller from './DiceRoller';
import PlayerPanel from './PlayerPanel';
import EventLog from './EventLog';

interface Props {
  state: GameState;
  onRoll: () => void;
  onEndTurn: () => void;
  onProposeTrade: () => void;
  onDrawCard: () => void;
  onBuyProperty: () => void;
  onDeclineBuy: () => void;
  onPayRent: () => void;
  onDeclareBankruptcy: () => void;
  onSkipAction: () => void;
  onPayJailFine: () => void;
  onUseGetOutOfJailFree: () => void;
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

export default function SidebarComponent({ state, ...actions }: Props) {
  return (
    <div className="sidebar">
      <DiceRoller state={state} onRoll={actions.onRoll} />
      <ActionSection state={state} {...actions} />
      <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
      <EventLog log={state.eventLog} />
    </div>
  );
}

function ActionSection({
  state,
  onEndTurn,
  onDrawCard,
  onProposeTrade,
  onBuyProperty,
  onDeclineBuy,
  onPayRent,
  onDeclareBankruptcy,
  onPayJailFine,
  onUseGetOutOfJailFree,
}: Props) {
  const player = state.players[state.currentPlayer];
  const pending = state.pendingAction;
  const canAct = state.phase === GamePhase.Waiting && !pending;
  const hasRolled = state.dice !== null;

  if (pending?.type === PendingActionType.BuyProperty) {
    const space = state.board[pending.spaceId];
    return (
      <div className="sidebar-section">
        <div className="action-group">
          <p>Beli <strong>{space.name}</strong>?</p>
          <p>Harga: <strong>{formatMoney(space.price)}</strong></p>
          <button className="btn btn-success" onClick={onBuyProperty}>
            Beli ({formatMoney(space.price)})
          </button>
          <button className="btn btn-secondary" onClick={onDeclineBuy}>
            Tidak
          </button>
        </div>
      </div>
    );
  }

  if (pending?.type === PendingActionType.PayRent || pending?.type === PendingActionType.Bankruptcy) {
    const amount = pending.amount;
    const canAffordNow = player.money >= amount;
    const label = pending.type === PendingActionType.PayRent ? 'Bayar sewa' : 'Uang tidak cukup!';
    return (
      <div className="sidebar-section">
        <div className="action-group">
          <p>{label} <strong>{formatMoney(amount)}</strong></p>
          {!canAffordNow && (
            <p className="sidebar-note" style={{ color: '#f39c12', fontWeight: 'bold' }}>
              Hover properti di papan untuk jual/gadai/tebus aset
            </p>
          )}
          <button
            className="btn btn-success"
            onClick={onPayRent}
            disabled={!canAffordNow}
          >
            {canAffordNow ? 'Bayar Sewa' : 'Uang Masih Kurang'}
          </button>
          <button className="btn btn-danger" onClick={onDeclareBankruptcy}>
            Nyatakan Bangkrut
          </button>
        </div>
      </div>
    );
  }

  if (pending?.type === PendingActionType.DrawCard) {
    return (
      <div className="sidebar-section">
        <button className="btn btn-primary" onClick={onDrawCard}>
          Ambil Kartu
        </button>
      </div>
    );
  }

  if (pending?.type === PendingActionType.CardEffect) {
    return (
      <div className="sidebar-section">
        <div className="action-group">
          <p>{pending.card.description}</p>
          <p className="sidebar-note">Klik tombol untuk melanjutkan</p>
        </div>
      </div>
    );
  }

  if (!canAct) return null;

  return (
    <div className="sidebar-section">
      {player.inJail ? (
        <>
          <p className="sidebar-note">Di Penjara — pilih:</p>
          {player.hasGetOutOfJailFree && (
            <button className="btn btn-success btn-small" onClick={onUseGetOutOfJailFree}>
              🎴 Gunakan Kartu Bebas Penjara
            </button>
          )}
          {player.jailTurns > 0 && (
            <>
              <button
                className="btn btn-success btn-small"
                onClick={onPayJailFine}
                disabled={player.money < JAIL_FINE}
              >
                Bayar {formatMoney(JAIL_FINE)}
              </button>
              {player.money < JAIL_FINE && (
                <p className="sidebar-note">Uang tidak cukup</p>
              )}
              <p className="sidebar-note">atau lempar dadu ganda ({3 - player.jailTurns}x lagi)</p>
            </>
          )}
          {player.jailTurns === 0 && (
            <p className="sidebar-note">Lempar dadu ganda untuk keluar. Bayar bisa mulai putaran depan.</p>
          )}
        </>
      ) : hasRolled ? (
        <>
          {player.money >= 0 ? (
            <>
              <button className="btn btn-secondary" onClick={onEndTurn}>
                Akhiri Giliran
              </button>
              <button className="btn btn-small" onClick={onProposeTrade}>
                🤝 Tukar
              </button>
            </>
          ) : (
            <p className="sidebar-note" style={{ color: '#e74c3c' }}>Uang minus! Jual aset dulu sebelum akhiri giliran.</p>
          )}
        </>
      ) : (
        <p className="sidebar-note">Giliran {player.name} — lempar dadu</p>
      )}
      {(hasRolled && !player.inJail) || player.money < 0 ? (
        <p className="sidebar-note" style={{ fontSize: '10px' }}>Hover properti di papan untuk jual/gadai</p>
      ) : null}
    </div>
  );
}
