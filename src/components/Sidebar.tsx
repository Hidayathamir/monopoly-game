import type { GameState } from '../types/game'
import { useTranslation } from 'react-i18next'
import TurnHeader from './TurnHeader'
import DiceRoller from './DiceRoller'
import RoomExit from './RoomExit'
import PlayerPanel from './PlayerPanel'
import ActionSection from './ActionSection'
import EventLog from './EventLog'
import { useSound } from '../audio/SoundContext'
import { SoundId } from '../audio/soundEngine'
import EmoticonBar from './EmoticonBar'
import type { Emoticon } from '../types/emotion'

interface Props {
  state: GameState
  onRoll: (target?: number) => void
  onEndTurn: () => void
  onProposeTrade: (playerId: number) => void
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
  manualBotEnabled?: boolean
  onToggleBot?: () => void
  isMyTurn: boolean
  myPlayerId?: number | null
  canTrade?: boolean
  tradesEnabled?: boolean
  connectedPlayerIds?: Set<number>
  tradeCount: number
  onOpenTrades: () => void
  onEmitEmoticon: (emoticon: Emoticon) => void
}

export default function Sidebar({ state, isMyTurn, myPlayerId, onLeave, exitKeys, manualBotEnabled, onToggleBot, onProposeTrade, canTrade = true, tradesEnabled = true, connectedPlayerIds, tradeCount, onOpenTrades, onEmitEmoticon, ...actions }: Props) {
  const { t } = useTranslation()
  const play = useSound()
  return (
    <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
      <div
        data-testid="sidebar"
        className="pointer-events-auto w-[min(380px,calc((100vw-16px)*9/11-16px))] min-h-0 max-h-[calc((100vh-16px)*9/11-16px)] overflow-y-auto rounded-2xl border border-panel-border bg-panel backdrop-blur-md shadow-2xl px-5 py-4 flex flex-col gap-4"
      >
        <div className="relative">
          <TurnHeader state={state} />
          {onLeave && (
            <div className="absolute top-0 right-0 flex items-center gap-1">
              {onToggleBot && (
                <button
                  type="button"
                  onClick={onToggleBot}
                  title={manualBotEnabled ? t('bot.toggleOn') : t('bot.toggleOff')}
                  aria-pressed={manualBotEnabled}
                  className={`flex items-center rounded-lg border transition-all ${
                    manualBotEnabled
                      ? 'bg-gold text-bg-darker border-gold font-black h-7 px-1.5 gap-1 shadow-[0_0_16px_rgba(240,192,64,0.8)] animate-bot-alert'
                      : 'w-7 h-7 justify-center text-muted hover:text-text border-transparent hover:border-border'
                  }`}
                  data-testid="bot-toggle"
                >
                  <span className={manualBotEnabled ? 'text-xl' : 'text-base'}>🤖</span>
                  {manualBotEnabled && <span className="text-xs font-black tracking-wider">BOT</span>}
                </button>
              )}
              <RoomExit onLeave={onLeave} variant="icon" {...exitKeys} />
            </div>
          )}
        </div>
        <DiceRoller state={state} onRoll={actions.onRoll} isMyTurn={isMyTurn} />
        <EmoticonBar onEmit={onEmitEmoticon} />
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
            onClick={() => {
              onOpenTrades()
              play(SoundId.Click)
            }}
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
        <PlayerPanel state={state} myPlayerId={myPlayerId} onProposeTrade={onProposeTrade} canTrade={canTrade} connectedPlayerIds={connectedPlayerIds} tradesEnabled={tradesEnabled} />
        <EventLog log={state.eventLog} />
      </div>
    </div>
  )
}
