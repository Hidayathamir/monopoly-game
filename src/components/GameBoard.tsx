import type { ReactNode } from 'react'
import type { GameState } from '../types/game'
import { PLAYER_COLORS } from '../data/players'
import BoardGrid from './BoardGrid'
import PlayerTokens from './PlayerTokens'

interface Props {
  state: GameState
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}

export default function GameBoard({ state, children, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
  return (
    <div className="flex items-center justify-center w-screen h-screen">
      <div data-game-board className="relative w-[calc(100vw-16px)] h-[calc(100vh-16px)] flex-shrink-0 overflow-hidden">
        <BoardGrid
          state={state}
          playerColors={PLAYER_COLORS}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
          onSellProperty={onSellProperty}
        />
        <PlayerTokens state={state} playerColors={PLAYER_COLORS} />
        {children}
      </div>
    </div>
  )
}
