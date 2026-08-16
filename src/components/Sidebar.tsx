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
  onRoll: (target?: number) => void
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
  exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string }
  isMyTurn: boolean
  canTrade?: boolean
  tradesEnabled?: boolean
  tradeCount: number
  onOpenTrades: () => void
}

export default function Sidebar({ state, isMyTurn, onLeave, exitKeys, onProposeTrade, canTrade = true, tradesEnabled = true, tradeCount, onOpenTrades, ...actions }: Props) {
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
              <RoomExit onLeave={onLeave} variant="icon" {...exitKeys} />
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
        {tradesEnabled && (
          <button
            type="button"
            onClick={onOpenTrades}
            className="relative w-full py-1.5 rounded-lg border border-border bg-bg-dark text-sm font-semibold hover:opacity-90"
          >
            {t('trade.inbox')}
            {tradeCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-danger text-white text-xs font-bold rounded-full px-1.5">
                {tradeCount}
              </span>
            )}
          </button>
        )}
        <PlayerPanel state={state} playerColors={PLAYER_COLORS} onProposeTrade={onProposeTrade} canTrade={canTrade} tradesEnabled={tradesEnabled} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
