import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types/game'
import PlayerCard from './PlayerCard'

interface Props {
  state: GameState
  playerColors: string[]
}

export default function PlayerPanel({ state, playerColors }: Props) {
  const { players, currentPlayer, board } = state
  const prevMoney = useRef<Record<number, number>>({})
  const [diffs, setDiffs] = useState<Record<number, { diff: number; key: number }>>({})
  const diffCounter = useRef(0)

  useEffect(() => {
    const newDiffs: Record<number, { diff: number; key: number }> = {}
    players.forEach((p) => {
      const prev = prevMoney.current[p.id]
      if (prev !== undefined && prev !== p.money) {
        diffCounter.current += 1
        newDiffs[p.id] = { diff: p.money - prev, key: diffCounter.current }
      }
      prevMoney.current[p.id] = p.money
    })
    if (Object.keys(newDiffs).length > 0) setDiffs(newDiffs)
  }, [players])

  return (
    <div className="w-full">
      <div className="text-xs uppercase tracking-[0.25em] text-muted mb-1.5 text-center">Pemain</div>
      <div className="flex flex-wrap gap-2 justify-center">
        {players.map((player) => {
          const isCurrent = player.id === currentPlayer
          return (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrent={isCurrent}
              color={playerColors[player.id]}
              diff={diffs[player.id] ?? null}
              board={board}
            />
          )
        })}
      </div>
    </div>
  )
}
