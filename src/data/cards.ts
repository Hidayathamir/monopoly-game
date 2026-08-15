import { CardType, type Card, type CardEffect } from '../types/game';
import cardsData from './cards-data.json';

type RawEffect = {
  action: string;
  amount?: number;
  spaceId?: number;
  perHouse?: number;
  perHotel?: number;
};

type RawCard = { id: number; effect: RawEffect };

interface CardsData {
  chance: RawCard[];
  community: RawCard[];
}

const data = cardsData as unknown as CardsData;

function toCards(raw: RawCard[], type: CardType): Card[] {
  return raw.map((c) => ({ id: c.id, type, effect: c.effect as unknown as CardEffect }));
}

export const CHANCE_CARDS: Card[] = toCards(data.chance, CardType.Chance);
export const COMMUNITY_CARDS: Card[] = toCards(data.community, CardType.Community);
