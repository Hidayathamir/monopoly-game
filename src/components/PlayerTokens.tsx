import { useState, useEffect, useRef } from 'react'
import type { GameState } from '../types/game'
import { PLAYER_OFFSETS } from '../data/players'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
import { BOARD_SIZE, JAIL_SPACE } from '../data/board'
import Avatar from './Avatar'

interface Props {
  state: GameState
}

const RATIO = 100 / 11

function c(col: number, row: number) {
  return {
    x: Math.round((col - 0.5) * RATIO * 100) / 100,
    y: Math.round((row - 0.5) * RATIO * 100) / 100,
  }
}

const POSITIONS: Record<number, { x: number; y: number }> = {
  0: c(11, 11), 1: c(10, 11), 2: c(9, 11), 3: c(8, 11),
  4: c(7, 11), 5: c(6, 11), 6: c(5, 11), 7: c(4, 11),
  8: c(3, 11), 9: c(2, 11), 10: c(1, 11), 11: c(1, 10),
  12: c(1, 9), 13: c(1, 8), 14: c(1, 7), 15: c(1, 6),
  16: c(1, 5), 17: c(1, 4), 18: c(1, 3), 19: c(1, 2),
  20: c(1, 1), 21: c(2, 1), 22: c(3, 1), 23: c(4, 1),
  24: c(5, 1), 25: c(6, 1), 26: c(7, 1), 27: c(8, 1),
  28: c(9, 1), 29: c(10, 1), 30: c(11, 1), 31: c(11, 2),
  32: c(11, 3), 33: c(11, 4), 34: c(11, 5), 35: c(11, 6),
  36: c(11, 7), 37: c(11, 8), 38: c(11, 9), 39: c(11, 10),
}

// eslint-disable-next-line react-refresh/only-export-components
export function getPath(from: number, to: number, backward: boolean): number[] {
  if (from === to) return []
  const steps = backward ? (from - to + BOARD_SIZE) % BOARD_SIZE : (to - from + BOARD_SIZE) % BOARD_SIZE
  const path: number[] = []
  let current = from
  for (let i = 0; i < steps; i++) {
    current = backward ? (current - 1 + BOARD_SIZE) % BOARD_SIZE : (current + 1) % BOARD_SIZE
    path.push(current)
  }
  return path
}

export default function PlayerTokens({ state }: Props) {
  const play = useSound()
  const { players } = state
  const lastMoveSteps = state.lastMoveSteps
  const [displayPositions, setDisplayPositions] = useState<Record<number, number>>({})
  const prevTargets = useRef<Record<number, number>>({})
  const animating = useRef<Record<number, boolean>>({})

  useEffect(() => {
    players.forEach((player) => {
      const prevTarget = prevTargets.current[player.id] ?? 0
      if (prevTarget === player.position) return
      if (animating.current[player.id]) return
      prevTargets.current[player.id] = player.position
      if (player.inJail && player.position === JAIL_SPACE) {
        setDisplayPositions((prev) => ({ ...prev, [player.id]: JAIL_SPACE }))
        animating.current[player.id] = false
        return
      }
      animating.current[player.id] = true
      const backward = (lastMoveSteps ?? 0) < 0
      const path = getPath(displayPositions[player.id] ?? prevTarget, player.position, backward)
      function step(index: number) {
        if (index >= path.length) { animating.current[player.id] = false; return }
        play(SoundId.TokenStep)
        setDisplayPositions((prev) => ({ ...prev, [player.id]: path[index] }))
        setTimeout(() => step(index + 1), 150)
      }
      if (path.length > 0) { setTimeout(() => step(0), 50) }
      else { animating.current[player.id] = false }
    })
  }, [players, displayPositions, play, lastMoveSteps])

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {players.map((player) => {
        const posId = displayPositions[player.id] ?? player.position
        const pos = POSITIONS[posId] ?? POSITIONS[0]
        const offset = PLAYER_OFFSETS[player.id] ?? PLAYER_OFFSETS[0]
        const isCurrentPlayer = state.currentPlayer === player.id
        return (
          <div
            key={player.id}
            className={[
              'absolute rounded-full flex items-center justify-center text-base font-bold text-white',
              '-translate-x-1/2 -translate-y-1/2',
              isCurrentPlayer ? 'w-[28px] h-[28px] z-20' : 'w-[22px] h-[22px] z-10',
              isCurrentPlayer ? 'border-[3px] border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : '',
              isCurrentPlayer ? 'animate-[token-pulse_2s_ease-in-out_infinite]' : '',
              player.bankrupt ? 'opacity-30' : '',
            ].join(' ')}
            style={{
              backgroundColor: player.color,
              left: `calc(${pos.x}% + ${offset.dx}px)`,
              top: `calc(${pos.y}% + ${offset.dy}px)`,
              transition: 'left 0.12s ease-in-out, top 0.12s ease-in-out',
              ...(isCurrentPlayer ? { '--pulse-color': `${player.color}80` } as React.CSSProperties : {}),
            }}
            title={player.name}
          >
            <Avatar avatar={player.avatar} className="w-4 h-4 rounded-full" title={player.name} />
          </div>
        )
      })}
    </div>
  )
}
