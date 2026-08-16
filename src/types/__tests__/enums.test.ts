import { expect, test } from 'vitest'
import {
  CardActionType, CardType, GameActionType, GamePhase, PendingActionType, SpaceType, TaxType,
} from '../game';
import { ClientMessageType, ConnectionStatus, ServerMessageType } from '../net';

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
    'USE_GET_OUT_OF_JAIL_FREE', 'SET_BOT_CONTROL',
  ]);
  expect(Object.values(ClientMessageType)).toEqual(['create', 'join', 'start', 'leave', 'addBot', 'removeBot', 'action']);
  expect(Object.values(ServerMessageType)).toEqual(['welcome', 'lobby', 'state', 'left', 'error']);
  expect(Object.values(ConnectionStatus)).toEqual(['connecting', 'connected', 'disconnected']);
});
