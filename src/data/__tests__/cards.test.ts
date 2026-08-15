import { describe, it, expect } from 'vitest';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../cards';
import { CardActionType, CardType } from '../../types/game';

describe('cards data', () => {
  it('exports 10 chance and 10 community cards', () => {
    expect(CHANCE_CARDS).toHaveLength(10);
    expect(COMMUNITY_CARDS).toHaveLength(10);
  });

  it('scales collect/pay amounts by priceMultiplier', () => {
    const dividend = CHANCE_CARDS.find((c) => c.id === 5)!;
    expect(dividend.effect).toMatchObject({ action: CardActionType.Collect, amount: 50000000 });

    const parkingFine = COMMUNITY_CARDS.find((c) => c.id === 110)!;
    expect(parkingFine.effect).toMatchObject({ action: CardActionType.Pay, amount: 25000000 });
  });

  it('scales street repairs per-house/per-hotel amounts', () => {
    const repairs = CHANCE_CARDS.find((c) => c.id === 8)!;
    expect(repairs.effect).toMatchObject({ perHouse: 25000000, perHotel: 100000000 });
  });

  it('sets the correct deck type on each card', () => {
    expect(CHANCE_CARDS.every((c) => c.type === CardType.Chance)).toBe(true);
    expect(COMMUNITY_CARDS.every((c) => c.type === CardType.Community)).toBe(true);
  });
});
