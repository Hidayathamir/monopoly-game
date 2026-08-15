import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../cards';
import { CardType, CardActionType, GamePhase, type GameState, type Card } from '../../types/game';
import { createInitialBoard } from '../../data/board';
import { GO_SALARY } from '../../data/board';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      { id: 0, name: 'Alice', money: 500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false },
      { id: 1, name: 'Bob', money: 500, position: 0, properties: [], passedGo: true, inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false },
    ],
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
    ...overrides,
  };
}

describe('resolveCardEffect', () => {
  it('collect money', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.Collect, amount: 200 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(700);
    expect(result.log).toEqual([{ key: 'event.cardCollect', params: { name: 'Alice', amount: 200 } }])
  });

  it('pay money adds to free parking', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(400);
    expect(result.state.freeParkingPot).toBe(100);
  });

  it('go to jail sends player to position 10', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.GoToJail } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(10);
    expect(result.state.players[0].inJail).toBe(true);
  });

  it('go to space (forward) collects salary if passes GO', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 35 }] });
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(5);
    expect(result.state.players[0].money).toBe(500 + GO_SALARY);
  });

  it('go to space (back 3 steps)', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 10 }] });
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(7);
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
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].hasGetOutOfJailFree).toBe(true);
  });

  it('collect from players', () => {
    const state = makeState();
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(510);
    expect(result.state.players[1].money).toBe(490);
  });

  it('street repairs', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1] }] });
    const card: Card = { id: 1, type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25, perHotel: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(450);
    expect(result.state.freeParkingPot).toBe(50);
  });

  it('player money does not go below 0 on pay', () => {
    const state = makeState({ players: [{ ...makeState().players[0], money: 30 }] });
    const card: Card = { id: 1, type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(-70);
  });
});
