import { describe, it, expect } from 'vitest';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../cards';
import { CardActionType, CardType } from '../../types/game';

describe('cards data', () => {
  it('exports 16 chance and 16 community cards', () => {
    expect(CHANCE_CARDS).toHaveLength(16);
    expect(COMMUNITY_CARDS).toHaveLength(16);
  });

  it('exposes collect/pay amounts in base units', () => {
    const dividend = CHANCE_CARDS.find((c) => c.id === 5)!;
    expect(dividend.effect).toMatchObject({ action: CardActionType.Collect, amount: 50 });

    const parkingFine = COMMUNITY_CARDS.find((c) => c.id === 110)!;
    expect(parkingFine.effect).toMatchObject({ action: CardActionType.Pay, amount: 25 });
  });

  it('exposes street repairs amounts in base units', () => {
    const repairs = CHANCE_CARDS.find((c) => c.id === 8)!;
    expect(repairs.effect).toMatchObject({ perHouse: 25, perHotel: 100 });
  });

  it('sets the correct deck type on each card', () => {
    expect(CHANCE_CARDS.every((c) => c.type === CardType.Chance)).toBe(true);
    expect(COMMUNITY_CARDS.every((c) => c.type === CardType.Community)).toBe(true);
  });
});
