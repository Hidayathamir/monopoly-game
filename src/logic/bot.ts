import {
  GameActionType, GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space, type TradeOffer,
} from '../types/game';
import { getHouseCost, JAIL_FINE } from '../data/board';
import { isMonopoly } from './rent';

export function decideBotAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  if (!player.isBot || state.phase === GamePhase.GameOver) return null;

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
      if (player.hasGetOutOfJailFree) return { type: GameActionType.UseGetOutOfJailFree };
      if (player.money >= JAIL_FINE) return { type: GameActionType.PayJailFine };
      return { type: GameActionType.RollDice };
    }
    if (state.dice === null) {
      return buildAction(state) ?? { type: GameActionType.RollDice };
    }
    return { type: GameActionType.EndTurn };
  }

  return null;
}

function buildAction(state: GameState): GameAction | null {
  const player = state.players[state.currentPlayer];
  let best: Space | null = null;
  let bestCost = Infinity;
  for (const id of player.properties) {
    const space = state.board[id];
    if (!space || space.type !== SpaceType.Property) continue;
    if (space.houses >= 5 || space.mortgaged) continue;
    if (!isMonopoly(player.id, state.board, space)) continue;
    const cost = getHouseCost(space, space.houses);
    if (cost === 0 || player.money - cost < 50) continue;
    if (cost < bestCost) {
      bestCost = cost;
      best = space;
    }
  }
  return best ? { type: GameActionType.BuildHouse, spaceId: best.id } : null;
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
