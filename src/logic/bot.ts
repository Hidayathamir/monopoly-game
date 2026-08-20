import {
  GameActionType, GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type TradeOffer,
} from '../types/game';
import { getHouseCost, JAIL_FINE } from '../data/board';

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
  if (space.houses >= 5 || space.mortgaged) return null;
  if (space.id === state.justBoughtSpaceId) return null;
  if (state.builtThisStop) return null;
  const cost = getHouseCost(space, space.houses);
  if (cost === 0 || player.money < cost) return null;
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

export function shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean {
  const received =
    offer.offerCash +
    offer.offerProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  const given =
    offer.requestCash +
    offer.requestProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  return received >= given;
}
