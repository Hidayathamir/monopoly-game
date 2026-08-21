import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../cards';
import { CardType, CardActionType, GamePhase, type GameState, type Card } from '../../types/game';
import { createInitialBoard } from '../../data/board';
import { GO_SALARY } from '../../data/board';
import { PLAYER_COLORS } from '../../data/players';
import { DEFAULT_AVATAR } from '../../data/avatars';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      { id: 0, name: 'Alice', money: 500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: PLAYER_COLORS[0], avatar: DEFAULT_AVATAR },
      { id: 1, name: 'Bob', money: 500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, getOutOfJailFreeCards: 0, isBot: false, botControlled: false, afk: false, color: PLAYER_COLORS[1], avatar: DEFAULT_AVATAR },
    ],
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

describe('resolveCardEffect', () => {
  it('collect money', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.Collect, amount: 200 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(700);
    expect(result.log).toEqual([{ key: 'event.cardCollect', params: { name: 'Alice', cardId: 1, amount: 200 } }])
  });

  it('pay money adds to free parking and names the card', () => {
    const state = makeState();
    const card: Card = { id: 101, type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(400);
    expect(result.state.freeParkingPot).toBe(100);
    expect(result.log).toEqual([{ key: 'event.cardPay', params: { name: 'Alice', cardId: 101, amount: 100 } }]);
  });

  it('go to jail sends player to position 10 and logs cardToJail', () => {
    const state = makeState();
    const card: Card = { id: 6, type: CardType.Chance, effect: { action: CardActionType.GoToJail } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(10);
    expect(result.state.players[0].inJail).toBe(true);
    expect(result.log).toEqual([{ key: 'event.cardToJail', params: { name: 'Alice', cardId: 6 } }]);
  });

  it('go to space (forward) collects salary if passes GO', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 35 }] });
    const card: Card = { id: 2, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(5);
    expect(result.state.players[0].money).toBe(500 + GO_SALARY);
    expect(result.log).toContainEqual({ key: 'event.movedForward', params: { name: 'Alice', spaceId: 5, cardId: 2 } });
  });

  it('go to space (back 3 steps)', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 10 }] });
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(7);
    expect(result.log).toContainEqual({ key: 'event.movedBack', params: { name: 'Alice', spaceId: 7, cardId: 10 } });
  });

  it('a forward card that wraps sets passedGo and positive lastMoveSteps', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 7, passedGo: false }] })
    const card: Card = { id: 4, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].passedGo).toBe(true)
    expect(result.state.players[0].money).toBe(500 + GO_SALARY)
    expect(result.state.lastMoveSteps).toBe(38) // (5 - 7 + 40) % 40
  })

  it('a backward card that wraps past GO records negative lastMoveSteps', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 2, passedGo: false }] })
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].position).toBe(39)
    expect(result.state.lastMoveSteps).toBe(-3)
  })

  it('a backward card sets negative lastMoveSteps and no passedGo', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 20, passedGo: false }] })
    const card: Card = { id: 10, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } }
    const result = resolveCardEffect(state, card)
    expect(result.state.players[0].position).toBe(17)
    expect(result.state.players[0].passedGo).toBe(false)
    expect(result.state.players[0].money).toBe(500) // no GO salary on a backward move
    expect(result.state.lastMoveSteps).toBe(-3)
  })

  it('get out of jail free card', () => {
    const state = makeState();
    const card: Card = { id: 7, type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].getOutOfJailFreeCards).toBe(1);
    expect(result.log).toEqual([{ key: 'event.gotJailCard', params: { name: 'Alice', cardId: 7 } }]);
  });

  it('stacks multiple jail cards as a count', () => {
    let state = makeState();
    const card: Card = { id: 7, type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    state = resolveCardEffect(state, card).state;
    state = resolveCardEffect(state, card).state;
    expect(state.players[0].getOutOfJailFreeCards).toBe(2);
  });

  it('collect from players logs a per-player breakdown', () => {
    const state = makeState();
    const card: Card = { id: 9, type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(510);
    expect(result.state.players[1].money).toBe(490);
    expect(result.log).toEqual([{ key: 'event.cardCollectPlayers', params: { name: 'Alice', cardId: 9, amount: 10, perPlayer: 10, playerCount: 1 } }]);
  });

  it('collect from players takes nothing from a player in debt', () => {
    const state = makeState({
      players: [
        { ...makeState().players[0], money: 500 },
        { ...makeState().players[1], money: -5 },
      ],
    });
    const card: Card = { id: 9, type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(500);
    expect(result.state.players[1].money).toBe(-5);
    expect(result.log).toEqual([{ key: 'event.cardCollectPlayers', params: { name: 'Alice', cardId: 9, amount: 0, perPlayer: 10, playerCount: 0 } }]);
  });

  it('collect from players only takes what opponents can afford', () => {
    const state = makeState({
      players: [
        { ...makeState().players[0], money: 500 },
        { ...makeState().players[1], money: 4 },
      ],
    });
    const card: Card = { id: 9, type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(504);
    expect(result.state.players[1].money).toBe(0);
    expect(result.log).toEqual([{ key: 'event.cardCollectPlayers', params: { name: 'Alice', cardId: 9, amount: 4, perPlayer: 10, playerCount: 1 } }]);
  });

  it('street repairs logs the house/hotel breakdown', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1] }] });
    const card: Card = { id: 8, type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25, perHotel: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(450);
    expect(result.state.freeParkingPot).toBe(50);
    expect(result.log).toEqual([{ key: 'event.cardStreetRepairs', params: { name: 'Alice', cardId: 8, amount: 50, houseCount: 2, hotelCount: 0, perHouse: 25, perHotel: 100 } }]);
  });

  it('street repairs counts hotels separately', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 5; // hotel
    board[3].owner = 0;
    board[3].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1, 3] }] });
    const card: Card = { id: 8, type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25, perHotel: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(500 - 100 - 50);
    expect(result.log).toEqual([{ key: 'event.cardStreetRepairs', params: { name: 'Alice', cardId: 8, amount: 150, houseCount: 2, hotelCount: 1, perHouse: 25, perHotel: 100 } }]);
  });

  it('player money does not go below 0 on pay', () => {
    const state = makeState({ players: [{ ...makeState().players[0], money: 30 }] });
    const card: Card = { id: 101, type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(-70);
  });
});
