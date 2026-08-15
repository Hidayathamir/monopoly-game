import { CardActionType, type Card, type GameState } from '../types/game';
import { formatMoney } from '../utils/format';
import { GO_SALARY } from '../data/board';

export interface CardResolution {
  state: GameState;
  message: string;
}

export function resolveCardEffect(state: GameState, card: Card): CardResolution {
  const effect = card.effect;
  const player = state.players[state.currentPlayer];
  let newState = { ...state };

  switch (effect.action) {
    case CardActionType.Collect: {
      newState = updatePlayerMoney(newState, state.currentPlayer, effect.amount);
      return { state: newState, message: `${player.name} mendapatkan ${formatMoney(effect.amount)}` };
    }
    case CardActionType.Pay: {
      newState = addToFreeParking(newState, effect.amount);
      newState = updatePlayerMoney(newState, state.currentPlayer, -effect.amount);
      return { state: newState, message: `${player.name} membayar ${formatMoney(effect.amount)} ke Parkir Gratis` };
    }
    case CardActionType.GoToJail: {
      newState = sendPlayerToJail(newState, state.currentPlayer);
      return { state: newState, message: `${player.name} masuk penjara!` };
    }
    case CardActionType.GetOutOfJailFree: {
      const newPlayers = [...newState.players];
      newPlayers[state.currentPlayer] = {
        ...newPlayers[state.currentPlayer],
        hasGetOutOfJailFree: true,
      };
      return { state: { ...newState, players: newPlayers }, message: `${player.name} mendapat kartu Bebas Penjara!` };
    }
    case CardActionType.GoToSpace: {
      const isBackward = effect.spaceId < 0;
      const targetSpace = isBackward
        ? (player.position + effect.spaceId + 40) % 40
        : effect.spaceId;
      return goToSpace(newState, state.currentPlayer, targetSpace, isBackward);
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
        message: `${player.name} menerima ${formatMoney(totalReceived)} dari semua pemain`,
      };
    }
    case CardActionType.StreetRepairs: {
      let totalRepairs = 0;
      for (const pid of player.properties) {
        const space = newState.board[pid];
        if (space.houses === 5) {
          totalRepairs += effect.perHotel;
        } else {
          totalRepairs += space.houses * effect.perHouse;
        }
      }
      newState = addToFreeParking(newState, totalRepairs);
      newState = updatePlayerMoney(newState, state.currentPlayer, -totalRepairs);
      return {
        state: newState,
        message: `${player.name} membayar perbaikan ${formatMoney(totalRepairs)} ke Parkir Gratis`,
      };
    }
    default:
      return { state: newState, message: '' };
  }
}

function goToSpace(state: GameState, playerIndex: number, spaceId: number, isBackward: boolean): CardResolution {
  const player = state.players[playerIndex];
  let newState = { ...state };
  let message = '';

  const passesGo = !isBackward && spaceId < player.position;
  if (passesGo) {
    newState = updatePlayerMoney(newState, playerIndex, GO_SALARY);
    newState = setPlayerPassedGo(newState, playerIndex);
    message += `${player.name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}. `;
  }

  const steps = isBackward ? spaceId - player.position : (spaceId - player.position + 40) % 40;
  const newPlayers = [...newState.players];
  newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: spaceId };
  newState = { ...newState, players: newPlayers, lastMoveSteps: steps };

  const spaceName = state.board[spaceId].name;
  message += `${player.name} ${isBackward ? 'mundur' : 'maju'} ke ${spaceName}.`;

  return { state: newState, message };
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
