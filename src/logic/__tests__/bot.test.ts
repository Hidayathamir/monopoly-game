import { describe, it, expect } from 'vitest';
import { decideBotAction, shouldAcceptTrade } from '../bot';
import { gameReducer, createInitialState } from '../gameReducer';
import {
  GameActionType, GamePhase, PendingActionType, SpaceType,
  type GameState, type Player, type Space, type TradeOffer, type GameAction,
} from '../../types/game';
import { createInitialBoard, STARTING_MONEY, JAIL_FINE, MAX_HOUSES } from '../../data/board';

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
    botControlled: false,
    afk: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}, player: Player = makePlayer()): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [player],
    currentPlayer: 0,
    turnOrder: [0],
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
    builtThisStop: false,
    pendingTrades: [],
    nextTradeId: 0,
    reconnectGrace: null,
    tradesEnabled: false,
    ...overrides,
  };
}

function colorGroup(board: Space[]): Space[] {
  const first = board.find((s) => s.type === SpaceType.Property && s.color != null);
  if (!first) return [];
  return board.filter((s) => s.type === SpaceType.Property && s.color === first.color);
}

function boardWithUnowned(unowned: number, target: Space): Space[] {
  const board = createInitialBoard();
  const buyable = board.filter((s) =>
    ([SpaceType.Property, SpaceType.Railroad, SpaceType.Utility] as SpaceType[]).includes(s.type),
  );
  const owned = buyable.length - unowned;
  let count = 0;
  for (const s of buyable) {
    if (s.id === target.id) {
      board[s.id] = { ...s, owner: 0 };
      count++;
    } else if (count < owned) {
      board[s.id] = { ...s, owner: 1 };
      count++;
    } else {
      board[s.id] = { ...s, owner: null };
    }
  }
  return board;
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

  it('builds a house when standing on an owned, completed, affordable property', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });

  it('does not build before rolling', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });

  it('builds a house on a single owned property without a full color set', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    board[target.id] = { ...target, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });

  it('builds only once per landing', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds only once per landing when land is not scarce (7 unowned)', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    const state = makeState(
      { board: boardWithUnowned(7, target), dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('builds again despite builtThisStop when land is scarce (6 unowned)', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    const state = makeState(
      { board: boardWithUnowned(6, target), dice: [3, 4], builtThisStop: true },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
  });

  it('builds up to MAX_HOUSES in scarce land when it can afford it', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    let state = makeState(
      { board: boardWithUnowned(6, target), dice: [3, 4] },
      makePlayer({ properties: [target.id], money: 100000, position: target.id }),
    );
    const actions: GameAction[] = [];
    let action = decideBotAction(state);
    while (action && action.type === 'BUILD_HOUSE') {
      actions.push(action);
      state = gameReducer(state, action);
      action = decideBotAction(state);
    }
    expect(actions.length).toBe(MAX_HOUSES);
    expect(state.board[target.id].houses).toBe(MAX_HOUSES);
    expect(action).toEqual({ type: 'END_TURN' });
  });

  it('builds exactly once per landing, end to end', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ properties: group.map((s) => s.id), money: 100000, position: target.id }),
    );
    const action = decideBotAction(state);
    if (!action) throw new Error('expected a build action');
    expect(action).toEqual({ type: 'BUILD_HOUSE', spaceId: target.id });
    const endMove = gameReducer(state, action);
    expect(endMove.builtThisStop).toBe(true);
    expect(endMove.board[target.id].houses).toBe(1);
    expect(decideBotAction(endMove)).toEqual({ type: 'END_TURN' });
  });

  it('does not build on a rival-owned property', () => {
    const board = createInitialBoard();
    const target = colorGroup(board)[0];
    if (!target) throw new Error('no color group');
    board[target.id] = { ...target, owner: 1 };
    const state = makeState(
      { board, dice: [3, 4] },
      makePlayer({ money: 100000, position: target.id }),
    );
    expect(decideBotAction(state)).toEqual({ type: 'END_TURN' });
  });

  it('does not build on a property it just bought this turn', () => {
    const board = createInitialBoard();
    const group = colorGroup(board);
    if (group.length === 0) throw new Error('no color group');
    const target = group[0];
    for (const s of group) if (s.id !== target.id) board[s.id] = { ...s, owner: 0 };
    const state = makeState(
      { board, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId: target.id } },
      makePlayer({
        properties: group.filter((s) => s.id !== target.id).map((s) => s.id),
        money: 100000,
        position: target.id,
      }),
    );
    const bought: GameState = { ...gameReducer(state, { type: GameActionType.BuyProperty }), dice: [3, 4] as [number, number] };
    expect(bought.justBoughtSpaceId).toBe(target.id);
    expect(decideBotAction(bought)).toEqual({ type: 'END_TURN' });
  });

  it('drives a bot-controlled human seat', () => {
    const state = makeState({}, makePlayer({ isBot: false, botControlled: true }));
    expect(decideBotAction(state)).toEqual({ type: 'ROLL_DICE' });
  });

  it('does not drive a plain human seat', () => {
    const state = makeState({}, makePlayer({ isBot: false, botControlled: false }));
    expect(decideBotAction(state)).toBeNull();
  });

  it('buys for a bot-controlled player at a buy prompt', () => {
    const board = createInitialBoard();
    const spaceId = board.findIndex((s) => s.type === SpaceType.Property);
    const state = makeState({
      phase: GamePhase.Buying,
      pendingAction: { type: PendingActionType.BuyProperty, spaceId },
    }, makePlayer({ isBot: false, botControlled: true }));
    expect(decideBotAction(state)).toEqual({ type: 'BUY_PROPERTY' });
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
