import { describe, it, expect } from 'vitest';
import { GamePhase, PendingActionType } from '../../types/game';
import type { GameState } from '../../types/game';
import { createSeededState, validateStateStructure, validateStateForRoom, ValidationKind } from '../seed';

const SLOTS = [
  { name: 'Alpha', connected: true, isBot: false },
  { name: 'Bravo', connected: true, isBot: false },
];

function baseState(): GameState {
  return createSeededState({
    players: [
      { id: 0, name: 'Alpha', money: 1000 },
      { id: 1, name: 'Bravo', money: 1 },
    ],
    board: { 39: { owner: 0, houses: 4 } },
    currentPlayer: 1,
    turnOrder: [1, 0],
  });
}

describe('createSeededState', () => {
  it('builds a valid waiting state with defaults filled and slot-keyed players', () => {
    const s = baseState();
    expect(s.phase).toBe(GamePhase.Waiting);
    expect(s.board).toHaveLength(40);
    expect(s.players.map((p) => p.id)).toEqual([0, 1]);
    expect(s.players[0].position).toBe(0);
    expect(s.players[0].passedGo).toBe(true);
    expect(s.players[0].bankrupt).toBe(false);
    expect(s.players[0].properties).toEqual([39]);
    expect(s.board[39].owner).toBe(0);
    expect(s.board[39].houses).toBe(4);
    expect(s.board[39].mortgaged).toBe(false);
    expect(s.turnOrder).toEqual([1, 0]);
    expect(s.pendingAction).toBeNull();
    expect(s.dice).toBeNull();
    expect(s.chanceDeck.length).toBeGreaterThan(0);
    expect(validateStateStructure(s).kind).toBe(ValidationKind.Ok);
  });

  it('accepts a staged pending action for a decision-point seed', () => {
    const s = createSeededState({
      players: [
        { id: 0, name: 'Alpha', money: 1000 },
        { id: 1, name: 'Bravo', money: 1 },
      ],
      board: { 39: { owner: 0, houses: 4 } },
      currentPlayer: 1,
      phase: GamePhase.Resolving,
      pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 },
    });
    expect(s.phase).toBe(GamePhase.Resolving);
    expect(s.pendingAction).toEqual({ type: PendingActionType.PayRent, spaceId: 39, amount: 1700 });
    expect(validateStateStructure(s).kind).toBe(ValidationKind.Ok);
  });
});

describe('validateStateStructure', () => {
  it('rejects a wrong board length', () => {
    const s = baseState() as GameState;
    const bad = { ...s, board: s.board.slice(0, 10) };
    expect(validateStateStructure(bad)).toEqual({ kind: ValidationKind.Error, message: expect.stringContaining('40') });
  });

  it('rejects duplicate player ids', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[0] }, { ...s.players[0], name: 'Bravo' }] };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects a turnOrder that is not a permutation of player ids', () => {
    const s = baseState();
    const bad = { ...s, turnOrder: [1, 1] };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects currentPlayer not in turnOrder', () => {
    const s = baseState();
    const bad = { ...s, currentPlayer: 9 };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects a board owner whose properties list does not match', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[0], properties: [] }] };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
    const bad2 = { ...s, players: [{ ...s.players[0], properties: [0] }] };
    expect(validateStateStructure(bad2).kind).toBe(ValidationKind.Error);
  });

  it('rejects a claimed property that is not owned on the board', () => {
    const s = baseState();
    const bad = { ...s, players: [{ ...s.players[1], properties: [1] }] };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects houses out of range', () => {
    const s = baseState() as GameState;
    const bad = { ...s, board: s.board.map((sp, i) => (i === 39 ? { ...sp, houses: 6 } : sp)) };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects Waiting phase with a pending action', () => {
    const s = baseState();
    const bad = { ...s, pendingAction: { type: PendingActionType.PayRent, spaceId: 39, amount: 1700 } };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });

  it('rejects Resolving phase without a pending action', () => {
    const s = baseState();
    const bad = { ...s, phase: GamePhase.Resolving, pendingAction: null };
    expect(validateStateStructure(bad).kind).toBe(ValidationKind.Error);
  });
});

describe('validateStateForRoom', () => {
  it('accepts a seed whose players match the joined slots', () => {
    const s = baseState();
    expect(validateStateForRoom(s, SLOTS).kind).toBe(ValidationKind.Ok);
  });

  it('rejects a player count mismatch', () => {
    const one = createSeededState({ players: [{ id: 0, name: 'Alpha', money: 100 }], currentPlayer: 0 });
    expect(validateStateForRoom(one, SLOTS).kind).toBe(ValidationKind.Error);
  });

  it('rejects a player whose id has no joined slot', () => {
    const stray = createSeededState({
      players: [{ id: 2, name: 'Casper', money: 100 }],
      currentPlayer: 2,
    });
    expect(validateStateForRoom(stray, SLOTS).kind).toBe(ValidationKind.Error);
  });

  it('rejects a player not sitting at its own index', () => {
    const s = baseState();
    const bad = { ...s, players: [s.players[1], s.players[0]] };
    expect(validateStateForRoom(bad, SLOTS).kind).toBe(ValidationKind.Error);
  });

  it('rejects a currentPlayer that is not a connected client or bot', () => {
    const s = baseState();
    expect(validateStateForRoom(s, [
      { name: 'Alpha', connected: true, isBot: false },
      { name: 'Bravo', connected: false, isBot: false },
    ]).kind).toBe(ValidationKind.Error);
  });
});