import type { ReactNode } from 'react'
import type { GameState } from '../types/game'
import BoardGrid from './BoardGrid'
import PlayerTokens from './PlayerTokens'

interface Props {
  state: GameState
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onBuild: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}

export default function GameBoard({ state, children, onSell, onMortgage, onUnmortgage, onBuild, onSellProperty }: Props) {
  return (
    <div className="flex items-center justify-center w-screen h-screen">
      <div data-game-board className="relative w-[calc(100vw-16px)] h-[calc(100vh-16px)] flex-shrink-0 overflow-hidden">
        <BoardGrid
          state={state}
          playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
          onBuild={onBuild}
          onSellProperty={onSellProperty}
        />
        <PlayerTokens state={state} playerColors={['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']} />
        {children}
      </div>
    </div>
  )
}
