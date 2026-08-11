import { useState } from 'react'
import Button from './Button'

interface Props {
  onStart: (playerCount: number, names: string[]) => void
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

export default function GameSetup({ onStart }: Props) {
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  function handleNameChange(index: number, value: string) {
    const newNames = [...names]
    newNames[index] = value
    setNames(newNames)
  }

  function handleStart() {
    const filledNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Pemain ${i + 1}`)
    onStart(playerCount, filledNames)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5">
      <h1 className="text-[48px] text-gold m-0">Monopoli Indonesia</h1>
      <div className="bg-bg-card px-10 py-[30px] rounded-xl flex flex-col gap-4 min-w-[360px]">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Jumlah Pemain</label>
          <select
            value={playerCount}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-sm"
          >
            <option value={2}>2 Pemain</option>
            <option value={3}>3 Pemain</option>
            <option value={4}>4 Pemain</option>
          </select>
        </div>
        {Array.from({ length: playerCount }).map((_, i) => (
          <div className="flex flex-col gap-1.5" key={i}>
            <label className="text-sm text-muted flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: PLAYER_COLORS[i] }} />
              Nama Pemain {i + 1}
            </label>
            <input
              type="text"
              value={names[i]}
              onChange={(e) => handleNameChange(i, e.target.value)}
              placeholder={`Pemain ${i + 1}`}
              maxLength={12}
              className="px-3 py-2 rounded-lg border border-border bg-input-bg text-text text-sm"
            />
          </div>
        ))}
        <Button variant="start" size="lg" onClick={handleStart}>
          Mulai Permainan
        </Button>
      </div>
    </div>
  )
}
