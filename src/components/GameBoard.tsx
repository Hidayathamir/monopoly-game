import type { ReactNode } from 'react'
import type { GameState } from '../types/game'
import BoardGrid from './BoardGrid'
import PlayerTokens from './PlayerTokens'
import DiceHints from './DiceHints'

interface Props {
  state: GameState
  isMyTurn: boolean
  myPlayerId?: number | null
  children?: ReactNode
  onSell: (spaceId: number) => void
  onMortgage: (spaceId: number) => void
  onUnmortgage: (spaceId: number) => void
  onSellProperty: (spaceId: number) => void
}

export default function GameBoard({ state, isMyTurn, myPlayerId = null, children, onSell, onMortgage, onUnmortgage, onSellProperty }: Props) {
  return (
    <div
      className="flex items-center justify-center w-screen h-screen select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div data-game-board className="relative w-[calc(100vw-16px)] h-[calc(100vh-16px)] flex-shrink-0 overflow-hidden">
        <BoardGrid
          state={state}
          isMyTurn={isMyTurn}
          onSell={onSell}
          onMortgage={onMortgage}
          onUnmortgage={onUnmortgage}
          onSellProperty={onSellProperty}
        />
        <PlayerTokens state={state} myPlayerId={myPlayerId} />
        <DiceHints state={state} myPlayerId={myPlayerId} />
        {children}
      </div>
    </div>
  )
}
