import { describe, it, expect } from 'vitest';
import { decideBotAction, shouldAcceptTrade } from '../bot';
import { gameReducer, createInitialState } from '../gameReducer';
import {
  GameActionType, GamePhase, PendingActionType, SpaceType,
  type GameState, type Player, type Space, type TradeOffer,
} from '../../types/game';
import { createInitialBoard, STARTING_MONEY, JAIL_FINE } from '../../data/board';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 0,
    name: 'Bot',
    money: STARTING_MONEY,
    position: 0,
    properties: [],
    passedGo: true,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    getOutOfJailFreeCards: 0,
    isBot: true,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}, player: Player = makePlayer()): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [player],
    currentPlayer: 0,
    board: createInitialBoard(),
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
    pendingTrades: [],
    nextTradeId: 0,
    ...overrides,
  };
}

function colorGroup(board: Space[]): Space[] {
  const first = board.find((s) => s.type === SpaceType.Property && s.color != null);
  if (!first) return [];
  return board.filter((s) => s.type === SpaceType.Property && s.color === first.color);
}

describe('decideBotAction', () => {
  it('returns null when the current player is not a bot', () => {
    const state = makeState({}, makePlayer({ isBot: false }));
    expect(decideBotAction(state)).toBeNull();
  });

  it('returns null in GameOver', () => {
    const state = makeState({ phase: GamePhase.GameOver });
    expect(decideBotAction(state)).toBeNull();
  });

  it('rolls when waiting with no dice and no pending action', () => {
    expect(decideBotAction(makeState())).toEqual({ type: 'ROLL_DICE' });
  });

  it('uses the get-out-of-jail card when in jail', () => {
    const state = makeState({}, makePlayer({ inJail: true, getOutOfJailFreeCards: 1 }));
    expect(decideBotAction(state)).toEqual({ type: 'USE_GET_OUT_OF_JAIL_FREE' });
  });

  it('pays the jail fine when it cannot use a card', () => {
    const state = makeState({}, makePlayer({ inJail: true, money: JAIL_FINE + 10 }));
    expect(decideBotAction(state)).toEqual({ type: 'PAY_JAIL_FINE' });
  });

  it('rolls from jail when it cannot pay the fine', () => {
    const state = makeState({}, makePlayer({ inJail: true, money: 0 }));
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });

  it('buys an affordable unowned property', () => {
    const board = createInitialBoard();
    const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
    const state = makeState({
      phase: GamePhase.Buying,
      pendingAction: { type: PendingActionType.BuyProperty, spaceId },
    });
    expect(decideBotAction(state)).toEqual({ type: 'BUY_PROPERTY' });
  });

  it('declines a property it cannot afford', () => {
    const board = createInitialBoard();
    const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
    const state = makeState({
      phase: GamePhase.Buying,
      pendingAction: { type: PendingActionType.BuyProperty, spaceId },
    }, makePlayer({ money: 0 }));
    expect(decideBotAction(state)).toEqual({ type: 'DECLINE_BUY' });
  });

  it('pays rent it can afford', () => {
    const state = makeState({
      pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 100 },
    });
    expect(decideBotAction(state)).toEqual({ type: 'PAY_RENT' });
  });

  it('sells a house to raise cash for rent', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property && s.houseCost);
    if (!space) throw new Error('no buildable property');
    board[space.id] = { ...space, owner: 0, houses: 1 };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'SELL_HOUSE', spaceId: space.id });
  });

  it('mortgages a property when houses are gone but still short', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property);
    if (!space) throw new Error('no property');
    board[space.id] = { ...space, owner: 0, houses: 0 };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'MORTGAGE', spaceId: space.id });
  });

  it('declares bankruptcy when nothing is left to liquidate', () => {
    const board = createInitialBoard();
    const space = board.find((s) => s.type === SpaceType.Property);
    if (!space) throw new Error('no property');
    board[space.id] = { ...space, owner: 0, houses: 0, mortgaged: true };
    const state = makeState({
      board,
      pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: STARTING_MONEY },
    }, makePlayer({ money: 0, properties: [space.id] }));
    expect(decideBotAction(state)).toEqual({ type: 'DECLARE_BANKRUPTCY' });
  });

  it('draws and resolves cards automatically', () => {
    const draw = makeState({ pendingAction: { type: PendingActionType.DrawCard, cardType: 'chance' as const } });
    expect(decideBotAction(draw)).toEqual({ type: 'DRAW_CARD' });
    const effect = makeState({
      pendingAction: {
        type: PendingActionType.CardEffect,
        card: { id: 1, type: 'chance' as const, effect: { action: 'collect' as const, amount: 50 } },
      },
    });
    expect(decideBotAction(effect)).toEqual({ type: 'RESOLVE_CARD' });
  });

  it('ends the turn after movement when waiting with dice set', () => {
    const state = makeState({ dice: [3, 4] });
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds a house on a completed, affordable color set', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const groupIds = group.map((s) => s.id);
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState({ board }, makePlayer({ properties: groupIds, money: 100000 }));
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: expect.any(Number) });
  });

  it('does not build when the color set is incomplete', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    board[group[0].id] = { ...group[0], owner: 0 };
    const state = makeState({ board }, makePlayer({ properties: [group[0].id], money: 100000 }));
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });
});

describe('shouldAcceptTrade', () => {
  function offer(overrides: Partial<TradeOffer> = {}): TradeOffer {
    return {
      fromId: 0, toId: 1,
      offerProperties: [], offerCash: 0,
      requestProperties: [], requestCash: 0,
      ...overrides,
    };
  }

  it('accepts when the bot receives more than it gives', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ offerCash: 61, requestProperties: [1] }))).toBe(true);
  });

  it('rejects when the bot gives more than it receives', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ offerCash: 40, requestProperties: [1] }))).toBe(false);
  });

  it('accepts an equal swap', () => {
    const state = gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount: 2, names: ['A', 'B'] });
    expect(shouldAcceptTrade(state, offer({ offerProperties: [1], requestProperties: [3] }))).toBe(true);
  });
});
