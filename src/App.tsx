import { useState, useEffect, useRef } from 'react';
import { PendingActionType } from './types/game';
import { useGame } from './hooks/useGame';
import GameSetup from './components/GameSetup';
import GameBoard from './components/GameBoard';
import Sidebar from './components/Sidebar';
import TradeModal from './components/Modals/TradeModal';
import CardModal from './components/Modals/CardModal';
import BankruptcyModal from './components/Modals/BankruptcyModal';
import GameOverModal from './components/Modals/GameOverModal';
import { GamePhase, type TradeOffer } from './types/game';
import './App.css';

export default function App() {
  const game = useGame();
  const { state } = game;
  const [showTrade, setShowTrade] = useState(false);

  function handleRoll() {
    game.rollDice();
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;
    const animDuration = 500 + (total * 150);
    setTimeout(() => {
      game.diceAnimated([d1, d2]);
      setTimeout(() => {
        game.resolveSpace();
      }, animDuration);
    }, 500);
  }

  function handleDrawCard() {
    game.drawCard();
  }

  useEffect(() => {
    if (state.phase === GamePhase.Resolving && !state.pendingAction) {
      game.resolveSpace();
    }
  }, [state.phase, state.pendingAction, game]);

  useEffect(() => {
    if (state.pendingAction?.type === PendingActionType.DrawCard) {
      const t = setTimeout(() => game.drawCard(), 300);
      return () => clearTimeout(t);
    }
  }, [state.pendingAction, game]);

  const wasInJailRef = useRef<Record<number, boolean>>({});
  useEffect(() => {
    const player = state.players[state.currentPlayer];
    const wasInJail = wasInJailRef.current[player.id] ?? false;
    wasInJailRef.current[player.id] = player.inJail;

    if (player.inJail && !wasInJail && state.phase === GamePhase.Waiting && !state.pendingAction) {
      setTimeout(() => game.endTurn(), 300);
    }
  }, [state.players, state.phase, state.pendingAction, state.currentPlayer, game]);

  if (state.phase === GamePhase.Setup) {
    return (
      <div className="app">
        <GameSetup onStart={game.startGame} />
      </div>
    );
  }

  return (
    <div className="app">
      <GameBoard state={state} onSell={game.sellHouse} onMortgage={game.mortgage} onUnmortgage={game.unmortgage} onBuild={game.buildHouse}>
        <Sidebar
          state={state}
          onRoll={handleRoll}
          onEndTurn={game.endTurn}
          onProposeTrade={() => setShowTrade(true)}
          onDrawCard={handleDrawCard}
          onBuyProperty={game.buyProperty}
          onDeclineBuy={game.declineBuy}
          onPayRent={game.payRent}
          onDeclareBankruptcy={game.declareBankruptcy}
          onSkipAction={game.skipAction}
          onPayJailFine={game.payJailFine}
          onUseGetOutOfJailFree={game.useGetOutOfJailFree}
        />
      </GameBoard>
      <CardModal state={state} onResolve={game.resolveCard} />
      <BankruptcyModal state={state} onClose={game.skipAction} onBankruptcy={game.declareBankruptcy} />
      <GameOverModal state={state} onReset={game.resetGame} />

      {showTrade && (
        <TradeModal
          state={state}
          onPropose={(offer: TradeOffer) => {
            game.proposeTrade(offer);
            setShowTrade(false);
          }}
          onClose={() => setShowTrade(false)}
        />
      )}
    </div>
  );
}
