import { useState, useCallback } from 'react'
import { type GameApi, type TradeOffer } from '../types/game'
import GameBoard from './GameBoard'
import Sidebar from './Sidebar'
import TradeModal from './Modals/TradeModal'
import TradeInboxModal from './Modals/TradeInboxModal'
import CardModal from './Modals/CardModal'
import BankruptcyModal from './Modals/BankruptcyModal'
import GameOverModal from './Modals/GameOverModal'
import GameSounds from '../audio/useGameSounds'
import { useMyTurnSound } from '../audio/useMyTurnSound'

export default function GameView({ game, connectedPlayerIds, onLeave, exitKeys }: { game: GameApi; connectedPlayerIds?: Set<number>; onLeave?: () => void; exitKeys?: { labelKey?: string; titleKey?: string; messageKey?: string; confirmKey?: string } }) {
  const { state } = game
  const isMyTurn = game.myPlayerId === null
    ? !state.players[state.currentPlayer]?.isBot
    : game.myPlayerId === state.currentPlayer
  useMyTurnSound(isMyTurn)
  const tradesEnabled = state.tradesEnabled
  const canTrade = tradesEnabled
  const [tradeTargetId, setTradeTargetId] = useState<number | null>(null)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [showTrades, setShowTrades] = useState(false)
  const [manualBotEnabled, setManualBotEnabled] = useState(false)
  const handleToggleBot = useCallback(() => {
    game.manualBotToggle()
    setManualBotEnabled((prev) => !prev)
  }, [game])
  const sendActionWithAutoReset = useCallback(
    (action: () => void) => {
      if (manualBotEnabled) {
        game.manualBotToggle()
        setManualBotEnabled(false)
      }
      action()
    },
    [game, manualBotEnabled],
  )
  const tradeCount = state.pendingTrades.filter((tr) =>
    game.myPlayerId === null || tr.fromId === game.myPlayerId || tr.toId === game.myPlayerId
  ).length

  return (
    <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
      <GameSounds state={state} myPlayerId={game.myPlayerId} />
      <GameBoard
        state={state}
        isMyTurn={isMyTurn}
        myPlayerId={game.myPlayerId}
        onSell={(spaceId: number) => sendActionWithAutoReset(() => game.sellHouse(spaceId))}
        onMortgage={(spaceId: number) => sendActionWithAutoReset(() => game.mortgage(spaceId))}
        onUnmortgage={(spaceId: number) => sendActionWithAutoReset(() => game.unmortgage(spaceId))}
        onSellProperty={(spaceId: number) => sendActionWithAutoReset(() => game.sellProperty(spaceId))}
      >
        <Sidebar
          state={state}
          myPlayerId={game.myPlayerId}
          isMyTurn={isMyTurn}
          onRoll={(target?: number) => sendActionWithAutoReset(() => game.roll(target))}
          onEndTurn={() => sendActionWithAutoReset(() => game.endTurn())}
          onProposeTrade={(id: number) => { setTradeTargetId(id); setShowTradeModal(true) }}
          canTrade={canTrade}
          tradesEnabled={tradesEnabled}
          connectedPlayerIds={connectedPlayerIds}
          onBuyProperty={() => sendActionWithAutoReset(() => game.buyProperty())}
          onDeclineBuy={() => sendActionWithAutoReset(() => game.declineBuy())}
          onPayRent={() => sendActionWithAutoReset(() => game.payRent())}
          onDeclareBankruptcy={() => sendActionWithAutoReset(() => game.declareBankruptcy())}
          onSkipAction={() => sendActionWithAutoReset(() => game.skipAction())}
          onPayJailFine={() => sendActionWithAutoReset(() => game.payJailFine())}
          onUseGetOutOfJailFree={() => sendActionWithAutoReset(() => game.useGetOutOfJailFree())}
          onBuild={(spaceId: number) => sendActionWithAutoReset(() => game.buildHouse(spaceId))}
          onLeave={onLeave}
          exitKeys={exitKeys}
          tradeCount={tradeCount}
          onOpenTrades={() => setShowTrades(true)}
          manualBotEnabled={manualBotEnabled}
          onToggleBot={handleToggleBot}
          onEmitEmoticon={game.emitEmoticon}
        />
      </GameBoard>
      <CardModal state={state} isMyTurn={isMyTurn} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} isMyTurn={isMyTurn} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
      <GameOverModal state={state} onReset={game.resetGame} />
      {showTradeModal && (
        <TradeModal
          state={state}
          targetPlayerId={tradeTargetId}
          myPlayerId={game.myPlayerId}
          onPropose={(offer: TradeOffer) => {
            if (manualBotEnabled) {
              game.manualBotToggle()
              setManualBotEnabled(false)
            }
            game.proposeTrade(offer)
            setShowTradeModal(false)
          }}
          onClose={() => setShowTradeModal(false)}
        />
      )}
      {showTrades && (
        <TradeInboxModal
          state={state}
          myPlayerId={game.myPlayerId}
          onAccept={(id: number) => { sendActionWithAutoReset(() => game.acceptTrade(id)); setShowTrades(false) }}
          onReject={(id: number) => { sendActionWithAutoReset(() => game.rejectTrade(id)); setShowTrades(false) }}
          onCancel={(id: number) => { sendActionWithAutoReset(() => game.cancelTrade(id)); setShowTrades(false) }}
          onNewTrade={() => { setShowTrades(false); setTradeTargetId(null); setShowTradeModal(true) }}
          canCreateTrade={canTrade}
          onClose={() => setShowTrades(false)}
        />
      )}
    </div>
  )
}
