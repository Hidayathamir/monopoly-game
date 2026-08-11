import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../types/game'
import { GO_SALARY } from '../data/board'
import PlayerCard from './PlayerCard'

interface Props {
  state: GameState
  playerColors: string[]
}

export default function PlayerPanel({ state, playerColors }: Props) {
  const { players, board, currentPlayer } = state
  const prevMoney = useRef<Record<number, number>>({})
  const prevPos = useRef<Record<number, number>>({})
  const [diffs, setDiffs] = useState<Record<number, { diff: number; key: number }>>({})
  const diffCounter = useRef(0)

  useEffect(() => {
    const newDiffs: Record<number, { diff: number; key: number }> = {}
    players.forEach((p) => {
      const prev = prevMoney.current[p.id]
      const oldPos = prevPos.current[p.id]
      if (prev !== undefined && prev !== p.money) {
        const passedGO = oldPos !== undefined && p.position < oldPos && (p.money - prev) >= GO_SALARY
        if (!passedGO) {
          diffCounter.current += 1
          newDiffs[p.id] = { diff: p.money - prev, key: diffCounter.current }
        }
      }
      prevMoney.current[p.id] = p.money
      prevPos.current[p.id] = p.position
    })
    if (Object.keys(newDiffs).length > 0) setDiffs(newDiffs)
  }, [players])

  return (
    <div className="bg-bg-card rounded-lg p-2 flex-1 min-h-0 overflow-y-auto flex flex-col w-full">
      <h3 className="text-sm text-gold m-0 mb-1.5">Pemain</h3>
      {players.map((player) => {
        const isCurrent = player.id === currentPlayer
        const properties = board.filter((s) => s.owner === player.id)

        return (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrent={isCurrent}
            color={playerColors[player.id]}
            properties={properties}
            diff={diffs[player.id] ?? null}
          />
        )
      })}
    </div>
  )
}
