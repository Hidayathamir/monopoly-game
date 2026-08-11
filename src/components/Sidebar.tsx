import type { GameState } from '../types/game'
import DiceRoller from './DiceRoller'
import PlayerPanel from './PlayerPanel'
import EventLog from './EventLog'
import ActionSection from './ActionSection'

interface Props {
  state: GameState
  onRoll: () => void
  onEndTurn: () => void
  onProposeTrade: () => void
  onDrawCard: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onSkipAction: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
}

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12']

export default function Sidebar({ state, ...actions }: Props) {
  return (
    <div
      data-testid="sidebar"
      className="absolute top-[calc(100%/11)] left-[calc(100%/11)] w-[calc(100%*9/11)] h-[calc(100%*9/11)] flex flex-col items-center gap-1 p-2 overflow-hidden z-[5] bg-bg-main/92 rounded"
    >
      <DiceRoller state={state} onRoll={actions.onRoll} />
      <ActionSection state={state} {...actions} />
      <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
      <EventLog log={state.eventLog} />
    </div>
  )
}
