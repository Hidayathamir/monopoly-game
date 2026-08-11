import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import { formatMoney } from '../utils/format';
import { GO_SALARY } from '../data/board';

interface Props {
  state: GameState;
  playerColors: string[];
}

function MoneyChange({ diff }: { diff: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, [diff]);

  if (!visible) return null;
  const isGain = diff > 0;
  return (
    <span className={`money-change ${isGain ? 'money-gain' : 'money-loss'}`}>
      {isGain ? '+' : ''}{formatMoney(diff)}
    </span>
  );
}

export default function PlayerPanel({ state, playerColors }: Props) {
  const { players, board, currentPlayer } = state;
  const prevMoney = useRef<Record<number, number>>({});
  const prevPos = useRef<Record<number, number>>({});
  const [diffs, setDiffs] = useState<Record<number, { diff: number; key: number }>>({});
  const diffCounter = useRef(0);

  useEffect(() => {
    const newDiffs: Record<number, { diff: number; key: number }> = {};
    players.forEach((p) => {
      const prev = prevMoney.current[p.id];
      const oldPos = prevPos.current[p.id];
      if (prev !== undefined && prev !== p.money) {
        const passedGO = oldPos !== undefined && p.position < oldPos && (p.money - prev) >= GO_SALARY;
        if (!passedGO) {
          diffCounter.current += 1;
          newDiffs[p.id] = { diff: p.money - prev, key: diffCounter.current };
        }
      }
      prevMoney.current[p.id] = p.money;
      prevPos.current[p.id] = p.position;
    });
    if (Object.keys(newDiffs).length > 0) setDiffs(newDiffs);
  }, [players]);

  return (
    <div className="sidebar-section player-panel-section">
      <h3 className="sidebar-title">Pemain</h3>
      {players.map((player) => {
        const isCurrent = player.id === currentPlayer;
        const properties = board.filter((s) => s.owner === player.id);
        const d = diffs[player.id];

        return (
          <div
            key={player.id}
            className={`player-card ${isCurrent ? 'player-card-active' : ''} ${player.bankrupt ? 'player-card-bankrupt' : ''}`}
            style={{ borderLeftColor: playerColors[player.id] }}
          >
            <div className="player-card-header">
              <span className="player-dot" style={{ backgroundColor: playerColors[player.id] }} />
              <strong>{player.name}</strong>
              {player.inJail && <span className="jail-badge">🔒</span>}
              {player.bankrupt && <span className="bankrupt-badge">BANGKRUT</span>}
            </div>
            <div className="player-card-money">
              {formatMoney(player.money)}
              {d && <MoneyChange key={d.key} diff={d.diff} />}
            </div>
            {properties.length > 0 && (
              <div className="player-card-props">
                {properties.map((s) => (
                  <span
                    key={s.id}
                    className="prop-chip"
                    style={{ borderLeftColor: s.color ?? '#888' }}
                    title={`${s.name}${s.mortgaged ? ' (Digadai)' : ''}${s.houses > 0 ? ` (${s.houses === 5 ? 'Hotel' : `${s.houses}🏠`})` : ''}`}
                  >
                    {s.mortgaged ? '🔸' : ''}{s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
