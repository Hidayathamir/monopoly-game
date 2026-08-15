import { CardActionType, type Card, type GameState, type LogEntry } from '../types/game';
import { GO_SALARY } from '../data/board';

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
      return { state: newState, log: [{ key: 'event.cardCollect', params: { name: player.name, cardId: card.id, amount: effect.amount } }] };
    }
    case CardActionType.Pay: {
      newState = addToFreeParking(newState, effect.amount);
      newState = updatePlayerMoney(newState, state.currentPlayer, -effect.amount);
      return { state: newState, log: [{ key: 'event.cardPay', params: { name: player.name, cardId: card.id, amount: effect.amount } }] };
    }
    case CardActionType.GoToJail: {
      newState = sendPlayerToJail(newState, state.currentPlayer);
      return { state: newState, log: [{ key: 'event.cardToJail', params: { name: player.name, cardId: card.id } }] };
    }
    case CardActionType.GetOutOfJailFree: {
      const newPlayers = [...newState.players];
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        hasGetOutOfJailFree: true,
      };
      return { state: { ...newState, players: newPlayers }, log: [{ key: 'event.gotJailCard', params: { name: player.name, cardId: card.id } }] };
    }
    case CardActionType.GoToSpace: {
      const isBackward = effect.spaceId < 0;
      const targetSpace = isBackward
        ? (player.position + effect.spaceId + 40) % 40
        : effect.spaceId;
      return goToSpace(newState, state.currentPlayer, targetSpace, isBackward, card.id);
    }
    case CardActionType.CollectFromPlayers: {
      const amount = effect.amount;
      const newPlayers = newState.players.map((p, i) => {
        if (i === state.currentPlayer) return p;
        return { ...p, money: Math.max(0, p.money - amount) };
      });
      const totalReceived = (newState.players.length - 1) * amount;
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        money: newPlayers[state.currentPlayer].money + totalReceived,
      };
      return {
        state: { ...newState, players: newPlayers },
        log: [{ key: 'event.cardCollectPlayers', params: { name: player.name, cardId: card.id, amount: totalReceived, perPlayer: amount, playerCount: newState.players.length - 1 } }],
      };
    }
    case CardActionType.StreetRepairs: {
      let totalRepairs = 0;
      let houseCount = 0;
      let hotelCount = 0;
      for (const pid of player.properties) {
        const space = newState.board[pid];
        if (space.houses === 5) {
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
        log: [{ key: 'event.cardStreetRepairs', params: { name: player.name, cardId: card.id, amount: totalRepairs, houseCount, hotelCount, perHouse: effect.perHouse, perHotel: effect.perHotel } }],
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
    log.push({ key: 'event.passedGo', params: { name: player.name, amount: GO_SALARY } });
  }

  const steps = isBackward
    ? -((player.position - spaceId + 40) % 40)
    : (spaceId - player.position + 40) % 40;
  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: spaceId };
  newState = { ...newState, players: newPlayers, lastMoveSteps: steps };

  log.push({ key: isBackward ? 'event.movedBack' : 'event.movedForward', params: { name: player.name, spaceId, cardId } });

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
    position: 10,
    inJail: true,
    jailTurns: 0,
  };
  return { ...state, players: newPlayers, lastMoveSteps: null };
}
