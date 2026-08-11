import { useState } from 'react';
import { GamePhase, type GameState } from '../types/game';

interface Props {
  state: GameState;
  onRoll: () => void;
}

export default function DiceRoller({ state, onRoll }: Props) {
  const [rolling, setRolling] = useState(false);
  const player = state.players[state.currentPlayer];

  function handleRoll() {
    setRolling(true);
    onRoll();
    setTimeout(() => setRolling(false), 500);
  }

  const canRoll = state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice === null;
  const canRollJail = state.phase === GamePhase.Waiting && !state.pendingAction && player.inJail;

  return (
    <div className="sidebar-section">
      <div className="dice-container">
        <div className={`die ${rolling ? 'die-rolling' : ''}`}>
          {state.dice?.[0] ?? '?'}
        </div>
        <div className={`die ${rolling ? 'die-rolling' : ''}`}>
          {state.dice?.[1] ?? '?'}
        </div>
      </div>
      {(canRoll || canRollJail) && (
        <button className="btn btn-primary btn-roll" onClick={handleRoll}>
          {player.inJail ? '🎲 Lempar Dadu (Penjara)' : '🎲 Lempar Dadu'}
        </button>
      )}
      {player.inJail && state.phase === GamePhase.Waiting && !state.pendingAction && state.dice !== null && (
        <p className="sidebar-note">Ganda? {state.dice[0] === state.dice[1] ? 'Ya! 🎉' : 'Tidak 😔'} — {3 - player.jailTurns}x lagi</p>
      )}
      {state.phase === GamePhase.Waiting && !state.pendingAction && !player.inJail && state.dice !== null && (
        <p className="sidebar-note">{state.dice[0]} + {state.dice[1]} = {state.dice[0] + state.dice[1]}</p>
      )}
    </div>
  );
}
