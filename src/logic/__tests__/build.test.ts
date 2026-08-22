import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialState } from '../gameReducer';
import { GameActionType } from '../../types/game';
import { canBuildOnCurrentSpace } from '../build';

function makeState() {
  return gameReducer(createInitialState(), {
    type: GameActionType.StartGame,
    playerCount: 2,
    names: ['Alice', 'Bob'],
  });
}

describe('canBuildOnCurrentSpace', () => {
  it('returns false before any roll', () => {
    const s = makeState();
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns false when the player is not on their own buildable property', () => {
    const s = { ...makeState(), dice: [1, 2] as [number, number] };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns true on own property below MAX_HOUSES, not mortgaged, not just bought', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: [1, 2] as [number, number],
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: false }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(true);
  });

  it('returns false on a mortgaged property', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: [1, 2] as [number, number],
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: true }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });

  it('returns false when dice is null even on own property', () => {
    const base = makeState();
    const property = base.board.find((sp) => sp.type === 'property');
    if (!property) throw new Error('no property space');
    const s = {
      ...base,
      dice: null,
      currentPlayer: 0,
      board: base.board.map((sp) =>
        sp.id === property.id
          ? { ...sp, owner: 0, houses: 0, mortgaged: false }
          : sp,
      ),
      players: base.players.map((p, i) => (i === 0 ? { ...p, position: property.id } : p)),
    };
    expect(canBuildOnCurrentSpace(s)).toBe(false);
  });
});