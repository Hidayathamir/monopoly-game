import { useState } from 'react';
import type { GameState, TradeOffer } from '../../types/game';

interface Props {
  state: GameState;
  onPropose: (offer: TradeOffer) => void;
  onClose: () => void;
}

export default function TradeModal({ state, onPropose, onClose }: Props) {
  const [targetPlayer, setTargetPlayer] = useState<number | null>(null);
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState(0);
  const [requestProperties] = useState<number[]>([]);
  const [requestCash, setRequestCash] = useState(0);

  const currentProps = state.board.filter(
    (s) => s.owner === state.currentPlayer && !s.mortgaged && s.houses === 0
  );

  function handlePropose() {
    if (targetPlayer === null) return;
    onPropose({
      fromId: state.currentPlayer,
      toId: targetPlayer,
      offerProperties,
      offerCash,
      requestProperties,
      requestCash,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-trade">
        <h3>🤝 Tukar</h3>
        <div className="trade-section">
          <label>Dengan:</label>
          <select
            value={targetPlayer ?? ''}
            onChange={(e) => setTargetPlayer(Number(e.target.value))}
          >
            <option value="">Pilih pemain</option>
            {state.players
              .filter((p) => p.id !== state.currentPlayer && !p.bankrupt)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        <div className="trade-columns">
          <div className="trade-col">
            <h4>Anda tawarkan:</h4>
            <label>Uang: <input type="number" value={offerCash} onChange={(e) => setOfferCash(Number(e.target.value))} min={0} /></label>
            {currentProps.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={offerProperties.includes(s.id)}
                  onChange={() =>
                    setOfferProperties((prev) =>
                      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
          <div className="trade-col">
            <h4>Anda minta:</h4>
            <label>Uang: <input type="number" value={requestCash} onChange={(e) => setRequestCash(Number(e.target.value))} min={0} /></label>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-success" onClick={handlePropose}>Ajukan</button>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}
