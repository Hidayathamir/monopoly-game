import type { GameState } from '../types/game'
import { useTranslation } from 'react-i18next'
import { PLAYER_COLORS } from '../data/players'
import TurnHeader from './TurnHeader'
import DiceRoller from './DiceRoller'
import RoomExit from './RoomExit'
import PlayerPanel from './PlayerPanel'
import ActionSection from './ActionSection'
import EventLog from './EventLog'

interface Props {
  state: GameState
  onRoll: () => void
  onEndTurn: () => void
  onProposeTrade: (playerId: number) => void
  onDrawCard: () => void
  onBuyProperty: () => void
  onDeclineBuy: () => void
  onPayRent: () => void
  onDeclareBankruptcy: () => void
  onSkipAction: () => void
  onPayJailFine: () => void
  onUseGetOutOfJailFree: () => void
  onBuild: (spaceId: number) => void
  onLeave?: () => void
  isMyTurn: boolean
  canTrade?: boolean
}

export default function Sidebar({ state, isMyTurn, onLeave, onProposeTrade, canTrade = true, ...actions }: Props) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
      <div
        data-testid="sidebar"
        className="pointer-events-auto w-[min(380px,calc((100vw-16px)*9/11-16px))] min-h-0 max-h-[calc((100vh-16px)*9/11-16px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4"
      >
        <div className="relative">
          <TurnHeader state={state} />
          {onLeave && (
            <div className="absolute top-0 right-0">
              <RoomExit onLeave={onLeave} variant="icon" />
            </div>
          )}
        </div>
        <DiceRoller state={state} onRoll={actions.onRoll} isMyTurn={isMyTurn} />
        {isMyTurn ? (
          <ActionSection state={state} {...actions} isMyTurn={isMyTurn} />
        ) : (
          <p className="text-base text-muted text-center" data-testid="waiting-for">
            {t('turn.waitingFor', { name: state.players[state.currentPlayer].name })}
          </p>
        )}
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} onProposeTrade={onProposeTrade} canTrade={canTrade} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
