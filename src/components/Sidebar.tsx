import type { GameState } from '../types/game'
import TurnHeader from './TurnHeader'
import DiceRoller from './DiceRoller'
import PlayerPanel from './PlayerPanel'
import ActionSection from './ActionSection'
import EventLog from './EventLog'

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
      className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(380px,92%)] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4">
        <TurnHeader state={state} />
        <DiceRoller state={state} onRoll={actions.onRoll} />
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} />
        <ActionSection state={state} {...actions} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
