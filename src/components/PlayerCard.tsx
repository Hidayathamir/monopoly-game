import { useEffect, useState } from 'react'
import type { Player } from '../types/game'
import { formatMoney } from '../utils/format'

function MoneyChange({ diff }: { diff: number }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200)
    return () => clearTimeout(t)
  }, [diff])

  if (!visible) return null
  const isGain = diff > 0
  return (
    <span
      className={[
        'ml-2 text-[13px] font-bold inline-block animate-money-float',
        isGain ? 'text-green-money' : 'text-red-danger',
      ].join(' ')}
    >
      {isGain ? '+' : ''}{formatMoney(diff)}
    </span>
  )
}

interface PlayerCardProps {
  player: Player
  isCurrent: boolean
  color: string
  diff?: { diff: number; key: number } | null
}

export default function PlayerCard({ player, isCurrent, color, diff }: PlayerCardProps) {
  return (
    <div
      data-testid="player-card"
      className={[
        'p-1.5 mb-1 rounded-md bg-bg-dark border-l-[3px] overflow-hidden',
        isCurrent ? 'bg-[#1a4a7a] border-l-[4px]' : '',
        player.bankrupt ? 'opacity-50' : '',
      ].join(' ')}
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center gap-1.5 text-xs mb-0.5">
        <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: color }} />
        <strong>{player.name}</strong>
        {player.inJail && <span className="text-xs">🔒</span>}
        {player.bankrupt && <span className="text-[9px] font-bold text-red-danger">BANGKRUT</span>}
      </div>
      <div className="text-sm font-bold text-green-money">
        {formatMoney(player.money)}
        {diff && <MoneyChange key={diff.key} diff={diff.diff} />}
      </div>
    </div>
  )
}
