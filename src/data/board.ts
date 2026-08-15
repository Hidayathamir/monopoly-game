import { SpaceType, type Space } from '../types/game';
import boardData from './board-data.json';
import config from './game-config.json';

const TYPE_MAP: Record<string, SpaceType> = {
  go: SpaceType.Go,
  property: SpaceType.Property,
  railroad: SpaceType.Railroad,
  utility: SpaceType.Utility,
  chance: SpaceType.Chance,
  community: SpaceType.Community,
  tax: SpaceType.Tax,
  jail: SpaceType.Jail,
  goToJail: SpaceType.GoToJail,
  freeParking: SpaceType.FreeParking,
};

export function getHouseCost(space: Space, level: number): number {
  if (!space.houseCost || level < 0 || level >= space.houseCost.length) return 0;
  return space.houseCost[level];
}

export function getTotalHouseInvestment(space: Space): number {
  if (!space.houseCost) return 0;
  let total = 0;
  for (let i = 0; i < space.houses && i < space.houseCost.length; i++) {
    total += space.houseCost[i];
  }
  return total;
}

export function createInitialBoard(): Space[] {
  return boardData.map((item: Record<string, unknown>) => ({
    id: item.id as number,
    type: TYPE_MAP[item.type as string] ?? SpaceType.Property,
    price: item.price as number | undefined,
    rent: item.rent as number[] | undefined,
    houseCost: item.houseCost as number[] | undefined,
    color: item.color as string | undefined,
    owner: null,
    houses: 0,
    mortgaged: false,
    taxType: item.taxType as Space['taxType'] | undefined,
  }));
}

export const GO_SALARY = config.goSalary;
export const JAIL_FINE = config.jailFine;
export const JAIL_SPACE = 10;
export const STARTING_MONEY = config.startingMoney;
export const MAX_JAIL_TURNS = 3;
export const INCOME_TAX_RATE = config.incomeTaxRate;
export const SELL_RATE = config.sellRate;
export const MORTGAGED_SELL_EXTRA = config.mortgagedSellExtra;
export const HOUSE_SELL_RATE = config.houseSellRate;
