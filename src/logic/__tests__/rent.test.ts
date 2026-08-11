import { describe, it, expect } from 'vitest';
import { calculatePropertyRent } from '../rent';
import { SpaceType, type Space } from '../../types/game';

function makeSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: 1,
    name: 'Cirebon',
    type: SpaceType.Property,
    price: 60000,
    rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000],
    houseCost: [50000],
    color: '#8B4513',
    owner: null,
    houses: 0,
    mortgaged: false,
    ...overrides,
  };
}

describe('calculatePropertyRent', () => {
  it('base rent with 0 houses', () => {
    const space = makeSpace({ houses: 0, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000] });
    expect(calculatePropertyRent(space)).toBe(2000);
  });

  it('rent with 1 house', () => {
    const space = makeSpace({ houses: 1, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000] });
    expect(calculatePropertyRent(space)).toBe(4000);
  });

  it('rent with 4 houses', () => {
    const space = makeSpace({ houses: 4, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000] });
    expect(calculatePropertyRent(space)).toBe(90000);
  });

  it('rent with hotel (5 houses)', () => {
    const space = makeSpace({ houses: 5, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000] });
    expect(calculatePropertyRent(space)).toBe(450000);
  });

  it('returns 0 for missing rent array', () => {
    const space = makeSpace({ rent: undefined, type: SpaceType.Go });
    expect(calculatePropertyRent(space)).toBe(0);
  });

  it('clamps to last rent if houses exceed array', () => {
    const space = makeSpace({ houses: 10, rent: [2000, 4000, 10000, 30000, 90000, 160000, 250000, 450000] });
    expect(calculatePropertyRent(space)).toBe(450000);
  });

  it('Boardwalk rent at hotel level', () => {
    const space = makeSpace({
      name: 'Bali',
      price: 400000,
      rent: [50000, 200000, 600000, 1400000, 1700000, 2000000, 2200000, 2000000],
      houseCost: [200000],
      houses: 5,
    });
    expect(calculatePropertyRent(space)).toBe(2000000);
  });
});

describe('railroad rent', () => {
  it('calculates railroad rent based on count', () => {
    const gambir = makeSpace({ type: SpaceType.Railroad, name: 'Gambir', rent: [25000, 50000, 100000, 200000], price: 200000 });
    expect(calculatePropertyRent(gambir)).toBe(25000);
  });
});

describe('utility rent', () => {
  it('4x dice roll for 1 utility', () => {
    const pln = makeSpace({ type: SpaceType.Utility, name: 'PLN', price: 150000, rent: [0] });
    expect(calculatePropertyRent(pln, [3, 4])).toBe(28);
  });
});
