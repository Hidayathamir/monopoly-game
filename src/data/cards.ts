import { CardType, type Card, type CardEffect } from '../types/game';
import config from './game-config.json';
import cardsData from './cards-data.json';

const m = config.priceMultiplier;

type RawEffect = {
  action: string;
  amount?: number;
  spaceId?: number;
  perHouse?: number;
  perHotel?: number;
};

type RawCard = { id: number; description: string; effect: RawEffect };

interface CardsData {
  chance: RawCard[];
  community: RawCard[];
}

const data = cardsData as unknown as CardsData;

function scaleEffect(effect: RawEffect): CardEffect {
  const scaled = { ...effect };
  if ('amount' in scaled && scaled.amount !== undefined) scaled.amount *= m;
  if ('perHouse' in scaled && scaled.perHouse !== undefined) scaled.perHouse *= m;
  if ('perHotel' in scaled && scaled.perHotel !== undefined) scaled.perHotel *= m;
  return scaled as unknown as CardEffect;
}

function toCards(raw: RawCard[], type: CardType): Card[] {
  return raw.map((c) => ({ id: c.id, description: c.description, type, effect: scaleEffect(c.effect) }));
}

export const CHANCE_CARDS: Card[] = toCards(data.chance, CardType.Chance);
export const COMMUNITY_CARDS: Card[] = toCards(data.community, CardType.Community);
