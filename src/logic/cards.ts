import { CardActionType, LogEventKey, type Card, type GameState, type LogEntry } from '../types/game';
import { GO_SALARY, BOARD_SIZE, JAIL_SPACE, MAX_HOUSES } from '../data/board';
import { actorEntry } from './logEntries';

export interface CardResolution {
  state: GameState;
  log: LogEntry[];
}

export function resolveCardEffect(state: GameState, card: Card): CardResolution {
  const effect = card.effect;
  const player = state.players[state.currentPlayer];
  let newState = { ...state };

  switch (effect.action) {
    case CardActionType.Collect: {
      newState = updatePlayerMoney(newState, state.currentPlayer, effect.amount);
      return { state: newState, log: [actorEntry(LogEventKey.CardCollect, player, { cardId: card.id, amount: effect.amount })] };
    }
    case CardActionType.Pay: {
      newState = addToFreeParking(newState, effect.amount);
      newState = updatePlayerMoney(newState, state.currentPlayer, -effect.amount);
      return { state: newState, log: [actorEntry(LogEventKey.CardPay, player, { cardId: card.id, amount: effect.amount })] };
    }
    case CardActionType.GoToJail: {
      newState = sendPlayerToJail(newState, state.currentPlayer);
      return { state: newState, log: [actorEntry(LogEventKey.CardToJail, player, { cardId: card.id })] };
    }
    case CardActionType.GetOutOfJailFree: {
      const newPlayers = [...newState.players];
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        getOutOfJailFreeCards: (newPlayers[state.currentPlayer].getOutOfJailFreeCards ?? 0) + 1,
      };
      return { state: { ...newState, players: newPlayers }, log: [actorEntry(LogEventKey.GotJailCard, player, { cardId: card.id })] };
    }
    case CardActionType.GoToSpace: {
      const isBackward = effect.spaceId < 0;
      const targetSpace = isBackward
        ? (player.position + effect.spaceId + BOARD_SIZE) % BOARD_SIZE
        : effect.spaceId;
      return goToSpace(newState, state.currentPlayer, targetSpace, isBackward, card.id);
    }
    case CardActionType.CollectFromPlayers: {
      const amount = effect.amount;
      let actualReceived = 0;
      let payingPlayers = 0;
      const newPlayers = newState.players.map((p, i) => {
        if (i === state.currentPlayer) return p;
        const paid = Math.min(Math.max(0, p.money), amount);
        if (paid > 0) payingPlayers += 1;
        actualReceived += paid;
        return { ...p, money: p.money - paid };
      });
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        money: newPlayers[state.currentPlayer].money + actualReceived,
      };
      return {
        state: { ...newState, players: newPlayers },
        log: [actorEntry(LogEventKey.CardCollectPlayers, player, { cardId: card.id, amount: actualReceived, perPlayer: amount, playerCount: payingPlayers })],
      };
    }
    case CardActionType.StreetRepairs: {
      let totalRepairs = 0;
      let houseCount = 0;
      let hotelCount = 0;
      for (const pid of player.properties) {
        const space = newState.board[pid];
        if (space.houses === MAX_HOUSES) {
          hotelCount += 1;
          totalRepairs += effect.perHotel;
        } else {
          houseCount += space.houses;
          totalRepairs += space.houses * effect.perHouse;
        }
      }
      newState = addToFreeParking(newState, totalRepairs);
      newState = updatePlayerMoney(newState, state.currentPlayer, -totalRepairs);
      return {
        state: newState,
        log: [actorEntry(LogEventKey.CardStreetRepairs, player, { cardId: card.id, amount: totalRepairs, houseCount, hotelCount, perHouse: effect.perHouse, perHotel: effect.perHotel })],
      };
    }
    default:
      return { state: newState, log: [] };
  }
}

function goToSpace(state: GameState, playerIndex: number, spaceId: number, isBackward: boolean, cardId: number): CardResolution {
  const player = state.players[playerIndex];
  let newState = { ...state };
  const log: LogEntry[] = [];

  const passesGo = !isBackward && spaceId < player.position;
  if (passesGo) {
    newState = updatePlayerMoney(newState, playerIndex, GO_SALARY);
    newState = setPlayerPassedGo(newState, playerIndex);
    log.push(actorEntry(LogEventKey.PassedGo, player, { amount: GO_SALARY }));
  }

  const steps = isBackward
    ? -((player.position - spaceId + BOARD_SIZE) % BOARD_SIZE)
    : (spaceId - player.position + BOARD_SIZE) % BOARD_SIZE;
  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: spaceId };
  newState = { ...newState, players: newPlayers, lastMoveSteps: steps };

  log.push(actorEntry(isBackward ? LogEventKey.MovedBack : LogEventKey.MovedForward, player, { spaceId, cardId }));

  return { state: newState, log };
}

function setPlayerPassedGo(state: GameState, playerIndex: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], passedGo: true };
  return { ...state, players: newPlayers };
}

function updatePlayerMoney(state: GameState, playerIndex: number, amount: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = {
    ...newPlayers[playerIndex],
    money: newPlayers[playerIndex].money + amount,
  };
  return { ...state, players: newPlayers };
}

function addToFreeParking(state: GameState, amount: number): GameState {
  return { ...state, freeParkingPot: state.freeParkingPot + amount };
}

function sendPlayerToJail(state: GameState, playerIndex: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[playerIndex] = {
    ...newPlayers[playerIndex],
    position: JAIL_SPACE,
    inJail: true,
    jailTurns: 0,
  };
  return { ...state, players: newPlayers, lastMoveSteps: null };
}
