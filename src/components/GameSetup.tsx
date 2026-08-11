import { useState } from 'react';

interface Props {
  onStart: (playerCount: number, names: string[]) => void;
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

export default function GameSetup({ onStart }: Props) {
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '', '', '']);

  function handleNameChange(index: number, value: string) {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  }

  function handleStart() {
    const filledNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Pemain ${i + 1}`);
    onStart(playerCount, filledNames);
  }

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Monopoli Indonesia</h1>
      <div className="setup-card">
        <div className="setup-field">
          <label>Jumlah Pemain</label>
          <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            <option value={2}>2 Pemain</option>
            <option value={3}>3 Pemain</option>
            <option value={4}>4 Pemain</option>
          </select>
        </div>
        {Array.from({ length: playerCount }).map((_, i) => (
          <div className="setup-field" key={i}>
            <label>
              <span className="player-dot" style={{ backgroundColor: PLAYER_COLORS[i] }} />
              Nama Pemain {i + 1}
            </label>
            <input
              type="text"
              value={names[i]}
              onChange={(e) => handleNameChange(i, e.target.value)}
              placeholder={`Pemain ${i + 1}`}
              maxLength={12}
            />
          </div>
        ))}
        <button className="btn btn-start" onClick={handleStart}>
          Mulai Permainan
        </button>
      </div>
    </div>
  );
}
