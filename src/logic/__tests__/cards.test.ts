import { describe, it, expect } from 'vitest';
import { resolveCardEffect } from '../cards';
import { CardType, CardActionType, GamePhase, type GameState, type Card } from '../../types/game';
import { createInitialBoard } from '../../data/board';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Waiting,
    players: [
      { id: 0, name: 'Alice', money: 500000, position: 0, properties: [], inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false },
      { id: 1, name: 'Bob', money: 500000, position: 0, properties: [], inJail: false, jailTurns: 0, bankrupt: false, hasGetOutOfJailFree: false },
    ],
    currentPlayer: 0,
    board: createInitialBoard(),
    chanceDeck: [],
    communityDeck: [],
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    eventLog: [],
    pendingAction: null,
    ...overrides,
  };
}

describe('resolveCardEffect', () => {
  it('collect money', () => {
    const state = makeState();
    const card: Card = { id: 1, description: 'Dapat Rp200000', type: CardType.Chance, effect: { action: CardActionType.Collect, amount: 200000 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(700000);
    expect(result.message).toContain('Rp 200 Ribu');
  });

  it('pay money adds to free parking', () => {
    const state = makeState();
    const card: Card = { id: 1, description: 'Bayar Rp100000', type: CardType.Chance, effect: { action: CardActionType.Pay, amount: 100000 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(400000);
    expect(result.state.freeParkingPot).toBe(100000);
  });

  it('go to jail sends player to position 10', () => {
    const state = makeState();
    const card: Card = { id: 1, description: 'Masuk penjara!', type: CardType.Chance, effect: { action: CardActionType.GoToJail } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(10);
    expect(result.state.players[0].inJail).toBe(true);
  });

  it('go to space (forward) collects salary if passes GO', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 35 }] });
    const card: Card = { id: 1, description: 'Maju ke Jakarta', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: 5 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(5);
    expect(result.state.players[0].money).toBe(700000);
  });

  it('go to space (back 3 steps)', () => {
    const state = makeState({ players: [{ ...makeState().players[0], position: 10 }] });
    const card: Card = { id: 1, description: 'Mundur 3 langkah', type: CardType.Chance, effect: { action: CardActionType.GoToSpace, spaceId: -3 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].position).toBe(7);
  });

  it('get out of jail free card', () => {
    const state = makeState();
    const card: Card = { id: 1, description: 'Bebas penjara', type: CardType.Chance, effect: { action: CardActionType.GetOutOfJailFree } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].hasGetOutOfJailFree).toBe(true);
  });

  it('collect from players', () => {
    const state = makeState();
    const card: Card = { id: 1, description: 'Ulang tahun', type: CardType.Chance, effect: { action: CardActionType.CollectFromPlayers, amount: 10000 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(510000);
    expect(result.state.players[1].money).toBe(490000);
  });

  it('street repairs', () => {
    const board = createInitialBoard();
    board[1].owner = 0;
    board[1].houses = 2;
    const state = makeState({ board, players: [{ ...makeState().players[0], properties: [1] }] });
    const card: Card = { id: 1, description: 'Perbaikan jalan', type: CardType.Chance, effect: { action: CardActionType.StreetRepairs, perHouse: 25000, perHotel: 100000 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(450000);
    expect(result.state.freeParkingPot).toBe(50000);
  });

  it('player money does not go below 0 on pay', () => {
    const state = makeState({ players: [{ ...makeState().players[0], money: 30000 }] });
    const card: Card = { id: 1, description: 'Bayar Rp100000', type: CardType.Community, effect: { action: CardActionType.Pay, amount: 100000 } };
    const result = resolveCardEffect(state, card);
    expect(result.state.players[0].money).toBe(-70000);
  });
});
