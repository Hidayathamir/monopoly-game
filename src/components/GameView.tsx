import { useState } from 'react'
import type { GameApi, TradeOffer } from '../types/game'
import GameBoard from './GameBoard'
import Sidebar from './Sidebar'
import TradeModal from './Modals/TradeModal'
import CardModal from './Modals/CardModal'
import BankruptcyModal from './Modals/BankruptcyModal'
import GameOverModal from './Modals/GameOverModal'

export default function GameView({ game, onLeave }: { game: GameApi; onLeave?: () => void }) {
  const { state } = game
  const isMyTurn = game.myPlayerId === null
    ? !state.players[state.currentPlayer]?.isBot
    : game.myPlayerId === state.currentPlayer
  const [showTrade, setShowTrade] = useState(false)

  return (
    <div className="flex justify-center items-center h-screen p-0 overflow-hidden">
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
          isMyTurn={isMyTurn}
          onRoll={game.roll}
          onEndTurn={game.endTurn}
          onProposeTrade={() => setShowTrade(true)}
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
        />
      </GameBoard>
      <CardModal state={state} isMyTurn={isMyTurn} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} isMyTurn={isMyTurn} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
      <GameOverModal state={state} onReset={game.resetGame} />
      {showTrade && (
        <TradeModal
          state={state}
          onPropose={(offer: TradeOffer) => {
            game.proposeTrade(offer)
            setShowTrade(false)
          }}
          onClose={() => setShowTrade(false)}
        />
      )}
    </div>
  )
}
