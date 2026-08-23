import {
  GameActionType, GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space, type TradeOffer,
} from '../types/game';
import { getHouseCost, JAIL_FINE, MAX_HOUSES, STARTING_MONEY } from '../data/board';

export const BUILD_CASH_RESERVE = Math.floor(STARTING_MONEY * 0.1);

const HOUSE_MULTIPLIERS: Record<number, number> = {
  0: 1,
  1: 1.3,
  2: 1.6,
  3: 2,
  4: 2.5,
  5: 2.5,
};

const TRADE_SURPLUS_REQUIRED = 1.1;
const LOW_CASH_SURPLUS_REQUIRED = 2;
const MONOPOLY_GAIN_BONUS = 0.5;
const MONOPOLY_LOSS_PENALTY = 1;
const TRADE_RESERVE = BUILD_CASH_RESERVE;

const BUYABLE_TYPES: SpaceType[] = [SpaceType.Property, SpaceType.Railroad, SpaceType.Utility];

function isLandScarce(state: GameState): boolean {
  const buyable = state.board.filter((s) => BUYABLE_TYPES.includes(s.type));
  const unowned = buyable.filter((s) => s.owner === null).length;
  return unowned * 4 < buyable.length;
}

export function decideBotAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  if ((!player.isBot && !player.botControlled) || state.phase === GamePhase.GameOver) return null;

  const pending = state.pendingAction;
  if (pending) {
    switch (pending.type) {
      case PendingActionType.BuyProperty: {
        const space = state.board[pending.spaceId];
        return player.money >= (space.price ?? 0)
          ? { type: GameActionType.BuyProperty }
          : { type: GameActionType.DeclineBuy };
      }
      case PendingActionType.PayRent: {
        if (player.money >= pending.amount) return { type: GameActionType.PayRent };
        return liquidationAction(state);
      }
      case PendingActionType.DrawCard:
        return { type: GameActionType.DrawCard };
      case PendingActionType.CardEffect:
        return { type: GameActionType.ResolveCard };
      case PendingActionType.Bankruptcy:
        return { type: GameActionType.DeclareBankruptcy };
      default:
        return null;
    }
  }

  if (state.phase === GamePhase.Waiting) {
    if (player.inJail) {
      if (player.getOutOfJailFreeCards > 0) return { type: GameActionType.UseGetOutOfJailFree };
      if (player.money >= JAIL_FINE) return { type: GameActionType.PayJailFine };
      return { type: GameActionType.RollDice };
    }
    if (state.dice === null) {
      return { type: GameActionType.RollDice };
    }
    return buildAction(state) ?? { type: GameActionType.EndTurn };
  }

  return null;
}

function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  const space = state.board[player.position];
  if (!space || space.type !== SpaceType.Property) return null;
  if (space.owner !== state.currentPlayer) return null;
  if (space.houses >= MAX_HOUSES || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop && !isLandScarce(state)) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
  if (isLandScarce(state) && player.money - cost < BUILD_CASH_RESERVE) return null;
  return { type: GameActionType.BuildHouse, spaceId: space.id };
}

function liquidationAction(state: GameState): GameAction {
  const player = state.players[state.currentPlayer];
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && space.houses > 0) return { type: GameActionType.SellHouse, spaceId: id };
  }
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && !space.mortgaged && space.houses === 0) return { type: GameActionType.Mortgage, spaceId: id };
  }
  return { type: GameActionType.DeclareBankruptcy };
}

function propertyValue(space: Space, houseCost: number): number {
  const multiplier = HOUSE_MULTIPLIERS[space.houses] ?? 1;
  return (space.price ?? 0) + space.houses * houseCost * multiplier;
}

function tradeValue(state: GameState, propertyIds: number[], cash: number): number {
  let total = cash;
  for (const id of propertyIds) {
    const space = state.board[id];
    if (!space) continue;
    total += propertyValue(space, getHouseCost(space, 0));
  }
  return total;
}

function monopolyBonus(state: GameState, offerProperties: number[], requestProperties: number[], playerId: number): number {
  let bonus = 0;
  for (const id of offerProperties) {
    const space = state.board[id];
    if (!space || space.type !== SpaceType.Property || !space.color) continue;
    const set = state.board.filter((s) => s.type === SpaceType.Property && s.color === space.color);
    const ownedAfter = set.filter(
      (s) => s.owner === playerId || offerProperties.includes(s.id),
    ).filter((s) => !requestProperties.includes(s.id)).length;
    if (ownedAfter === set.length && set.some((s) => s.owner !== playerId)) {
      bonus += MONOPOLY_GAIN_BONUS * propertyValue(space, getHouseCost(space, 0));
    }
  }
  return bonus;
}

function monopolyPenalty(state: GameState, requestProperties: number[], playerId: number): number {
  let penalty = 0;
  for (const id of requestProperties) {
    const space = state.board[id];
    if (!space || space.type !== SpaceType.Property || !space.color) continue;
    const set = state.board.filter((s) => s.type === SpaceType.Property && s.color === space.color);
    const currentlyOwned = set.filter((s) => s.owner === playerId).length;
    if (currentlyOwned === set.length) {
      penalty += MONOPOLY_LOSS_PENALTY * propertyValue(space, getHouseCost(space, 0));
    }
  }
  return penalty;
}

export function shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean {
  const bot = state.players[offer.toId];
  if (!bot) return false;

  const receivedValue = tradeValue(state, offer.offerProperties, offer.offerCash);
  const givenValue = tradeValue(state, offer.requestProperties, offer.requestCash);

  const bonus = monopolyBonus(state, offer.offerProperties, offer.requestProperties, bot.id);
  const penalty = monopolyPenalty(state, offer.requestProperties, bot.id);

  const totalReceived = receivedValue + bonus;
  const totalGiven = givenValue + penalty;

  const postTradeMoney = bot.money + offer.offerCash - offer.requestCash;
  if (postTradeMoney < TRADE_RESERVE) {
    return totalReceived > totalGiven * LOW_CASH_SURPLUS_REQUIRED;
  }
  return totalReceived > totalGiven * TRADE_SURPLUS_REQUIRED;
}
