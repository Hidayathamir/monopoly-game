import { useState } from 'react'
import { GamePhase, type GameApi, type TradeOffer } from '../types/game'
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
  const canTrade = tradesEnabled && state.phase === GamePhase.Waiting && !state.pendingAction
  const [tradeTargetId, setTradeTargetId] = useState<number | null>(null)
  const [showTradeModal, setShowTradeModal] = useState(false)
  const [showTrades, setShowTrades] = useState(false)
  const tradeCount = state.pendingTrades.filter((tr) =>
    game.myPlayerId === null || tr.fromId === game.myPlayerId || tr.toId === game.myPlayerId
  ).length

  return (
    <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
      <GameSounds state={state} myPlayerId={game.myPlayerId} />
      <GameBoard
        state={state}
        isMyTurn={isMyTurn}
        onSell={game.sellHouse}
        onMortgage={game.mortgage}
        onUnmortgage={game.unmortgage}
        onSellProperty={game.sellProperty}
      >
        <Sidebar
          state={state}
          myPlayerId={game.myPlayerId}
          isMyTurn={isMyTurn}
          onRoll={game.roll}
          onEndTurn={game.endTurn}
          onProposeTrade={(id: number) => { setTradeTargetId(id); setShowTradeModal(true) }}
          canTrade={canTrade}
          tradesEnabled={tradesEnabled}
          connectedPlayerIds={connectedPlayerIds}
          onDrawCard={game.drawCard}
          onBuyProperty={game.buyProperty}
          onDeclineBuy={game.declineBuy}
          onPayRent={game.payRent}
          onDeclareBankruptcy={game.declareBankruptcy}
          onSkipAction={game.skipAction}
          onPayJailFine={game.payJailFine}
          onUseGetOutOfJailFree={game.useGetOutOfJailFree}
          onBuild={game.buildHouse}
          onLeave={onLeave}
          exitKeys={exitKeys}
          tradeCount={tradeCount}
          onOpenTrades={() => setShowTrades(true)}
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
          onAccept={(id) => game.acceptTrade(id)}
          onReject={(id) => game.rejectTrade(id)}
          onCancel={(id) => game.cancelTrade(id)}
          onNewTrade={() => { setShowTrades(false); setTradeTargetId(null); setShowTradeModal(true) }}
          canCreateTrade={canTrade}
          onClose={() => setShowTrades(false)}
        />
      )}
    </div>
  )
}
