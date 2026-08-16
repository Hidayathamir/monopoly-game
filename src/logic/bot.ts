import {
  GamePhase, PendingActionType, SpaceType, type GameAction, type GameState, type Space, type TradeOffer,
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
          ? { type: 'BUY_PROPERTY' }
          : { type: 'DECLINE_BUY' };
      }
      case PendingActionType.PayRent: {
        if (player.money >= pending.amount) return { type: 'PAY_RENT' };
        return liquidationAction(state);
      }
      case PendingActionType.DrawCard:
        return { type: 'DRAW_CARD' };
      case PendingActionType.CardEffect:
        return { type: 'RESOLVE_CARD' };
      case PendingActionType.Bankruptcy:
        return { type: 'DECLARE_BANKRUPTCY' };
      default:
        return null;
    }
  }

  if (state.phase === GamePhase.Waiting) {
    if (player.inJail) {
      if (player.hasGetOutOfJailFree) return { type: 'USE_GET_OUT_OF_JAIL_FREE' };
      if (player.money >= JAIL_FINE) return { type: 'PAY_JAIL_FINE' };
      return { type: 'ROLL_DICE' };
    }
    if (state.dice === null) {
      return buildAction(state) ?? { type: 'ROLL_DICE' };
    }
    return { type: 'END_TURN' };
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
  return best ? { type: 'BUILD_HOUSE', spaceId: best.id } : null;
}

function liquidationAction(state: GameState): GameAction {
  const player = state.players[state.currentPlayer];
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && space.houses > 0) return { type: 'SELL_HOUSE', spaceId: id };
  }
  for (const id of player.properties) {
    const space = state.board[id];
    if (space && !space.mortgaged && space.houses === 0) return { type: 'MORTGAGE', spaceId: id };
  }
  return { type: 'DECLARE_BANKRUPTCY' };
}

export function shouldAcceptTrade(state: GameState, offer: TradeOffer): boolean {
  const received =
    offer.requestCash +
    offer.requestProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  const given =
    offer.offerCash +
    offer.offerProperties.reduce((sum, id) => sum + (state.board[id]?.price ?? 0), 0);
  return received >= given;
}
