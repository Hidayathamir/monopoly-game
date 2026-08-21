import { expect, test } from 'vitest'
import {
  CardActionType, CardType, GameActionType, GamePhase, LogEventKey, PendingActionType, SpaceType, TaxType,
} from '../game';
import { ClientMessageType, ConnectionStatus, ServerMessageType } from '../net';
import { Currency } from '../../data/currency';

test('wire values are locked for all enum-like consts', () => {
  expect(Object.values(SpaceType)).toEqual(['property', 'railroad', 'utility', 'chance', 'community', 'tax', 'go', 'jail', 'goToJail', 'freeParking']);
  expect(Object.values(CardType)).toEqual(['chance', 'community']);
  expect(Object.values(CardActionType)).toEqual(['collect', 'pay', 'goToJail', 'getOutOfJailFree', 'goToSpace', 'collectFromPlayers', 'streetRepairs']);
  expect(Object.values(TaxType)).toEqual(['income', 'luxury']);
  expect(Object.values(GamePhase)).toEqual(['setup', 'waiting', 'rolling', 'moving', 'resolving', 'buying', 'building', 'gameOver']);
  expect(Object.values(PendingActionType)).toEqual(['buyProperty', 'payRent', 'drawCard', 'cardEffect', 'bankruptcy']);
  expect(Object.values(GameActionType)).toEqual([
    'START_GAME', 'ROLL_DICE', 'DICE_ANIMATED', 'MOVE_TOKEN', 'PASS_GO', 'RESOLVE_SPACE',
    'BUY_PROPERTY', 'DECLINE_BUY', 'PAY_RENT', 'BUILD_HOUSE', 'SELL_HOUSE', 'MORTGAGE',
    'UNMORTGAGE', 'SELL_PROPERTY', 'PROPOSE_TRADE', 'ACCEPT_TRADE', 'REJECT_TRADE',
    'CANCEL_TRADE', 'DRAW_CARD', 'RESOLVE_CARD', 'ATTEMPT_JAILBREAK', 'END_TURN',
    'DECLARE_BANKRUPTCY', 'COLLECT_FREE_PARKING', 'SKIP_ACTION', 'PAY_JAIL_FINE',
    'USE_GET_OUT_OF_JAIL_FREE', 'SET_BOT_CONTROL', 'SET_RECONNECT_GRACE',
  ]);
  expect(Object.values(ClientMessageType)).toEqual(['create', 'join', 'start', 'leave', 'addBot', 'removeBot', 'action', 'setIdentity']);
  expect(Object.values(ServerMessageType)).toEqual(['welcome', 'lobby', 'state', 'left', 'error']);
  expect(Object.values(ConnectionStatus)).toEqual(['connecting', 'connected', 'disconnected']);
  expect(Object.values(LogEventKey)).toEqual([
    'event.gameStarted', 'event.turn', 'event.rolled', 'event.rolledAimed', 'event.passedGo',
    'event.jailBreakDoubles', 'event.jailForcedOut', 'event.jailFailed', 'event.tripleDoubles',
    'event.toJail', 'event.freeParkingJackpot', 'event.incomeTax', 'event.luxuryTax',
    'event.ownerInJail', 'event.monopolyRent', 'event.mustCircleBoard', 'event.bought',
    'event.paidRent', 'event.builtHouse', 'event.builtHotel', 'event.soldHouse',
    'event.mortgaged', 'event.unmortgaged', 'event.soldToBank', 'event.tradeProposed',
    'event.tradeAccepted', 'event.tradeRejected', 'event.tradeCancelled', 'event.paidJailFine',
    'event.usedJailCard', 'event.doublesAgain', 'event.cardCollect', 'event.cardPay',
    'event.cardToJail', 'event.gotJailCard', 'event.cardCollectPlayers', 'event.cardStreetRepairs',
    'event.movedForward', 'event.movedBack', 'event.bankruptcy', 'event.bankruptcyWin',
    'event.bankruptcyTransfer', 'event.playerOffline', 'event.playerAfk', 'event.playerBack', 'event.reconnectWait',
  ]);
  expect(Object.values(Currency)).toEqual(['USD', 'IDR']);
});
