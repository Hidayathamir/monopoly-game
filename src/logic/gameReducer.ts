import { GamePhase, GameActionType, PendingActionType, SpaceType, CardType, CardActionType, type GameState, type GameAction, type Player, type LogEntry } from '../types/game';
import { createInitialBoard, getHouseCost, GO_SALARY, JAIL_SPACE, STARTING_MONEY, MAX_JAIL_TURNS, JAIL_FINE, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE, INCOME_TAX_RATE } from '../data/board';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cards';
import { resolveCardEffect } from './cards';
import { calculatePropertyRent, calculateRailroadRentFromBoard, calculateUtilityRentFromBoard, isMonopoly } from './rent';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function createInitialState(): GameState {
  return {
    phase: GamePhase.Setup,
    players: [],
    currentPlayer: 0,
    board: createInitialBoard(),
    chanceDeck: shuffle([...CHANCE_CARDS]),
    communityDeck: shuffle([...COMMUNITY_CARDS]),
    freeParkingPot: 0,
    dice: null,
    doublesCount: 0,
    lastMoveSteps: null,
    eventLog: [],
    pendingAction: null,
    justBoughtSpaceId: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case GameActionType.StartGame: {
      const players: Player[] = [];
      for (let i = 0; i < action.playerCount; i++) {
        players.push({
          id: i,
          name: action.names[i] ?? `P${i + 1}`,
          money: STARTING_MONEY,
          position: 0,
          properties: [],
          passedGo: false,
          inJail: false,
          jailTurns: 0,
          bankrupt: false,
          hasGetOutOfJailFree: false,
        });
      }
      return {
        ...state,
        phase: GamePhase.Waiting,
        players,
        currentPlayer: 0,
        eventLog: [{ key: 'event.gameStarted' }],
      };
    }

    case GameActionType.RollDice: {
      return {
        ...state,
        phase: GamePhase.Rolling,
        justBoughtSpaceId: null,
      };
    }

    case GameActionType.DiceAnimated: {
      const dice = action.dice;
      const isDoubles = dice[0] === dice[1];
      const player = state.players[state.currentPlayer];

      if (player.inJail) {
        if (isDoubles) {
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            inJail: false,
            jailTurns: 0,
          };
          const total = dice[0] + dice[1];
          const newPos = (player.position + total) % 40;
          let newMoney = player.money;
          const newEventLog = [...state.eventLog, { key: 'event.jailBreakDoubles', params: { name: player.name } }];
          const passedGo = newPos < player.position
          if (passedGo) {
            newMoney += GO_SALARY;
            newEventLog.push({ key: 'event.passedGo', params: { name: player.name, amount: GO_SALARY } });
          }
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            position: newPos,
            money: newMoney,
            passedGo: newPlayers[state.currentPlayer].passedGo || passedGo,
          };
          return {
            ...state,
            phase: GamePhase.Moving,
            players: newPlayers,
            dice,
            doublesCount: 0,
            lastMoveSteps: total,
            eventLog: newEventLog,
          };
        } else {
          const newTurns = player.jailTurns + 1;
          if (newTurns >= MAX_JAIL_TURNS) {
            const newPlayers = [...state.players];
            const total = dice[0] + dice[1];
            const newPos = (player.position + total) % 40;
            let newMoney = player.money;
            const newEventLog = [...state.eventLog, { key: 'event.jailForcedOut', params: { name: player.name } }];
            const forcedPassedGo = newPos < player.position
            if (forcedPassedGo) {
              newMoney += GO_SALARY;
              newEventLog.push({ key: 'event.passedGo', params: { name: player.name, amount: GO_SALARY } });
            }
            newPlayers[state.currentPlayer] = {
              ...newPlayers[state.currentPlayer],
              inJail: false,
              jailTurns: 0,
              position: newPos,
              money: newMoney,
              passedGo: newPlayers[state.currentPlayer].passedGo || forcedPassedGo,
            };
            return {
              ...state,
              phase: GamePhase.Moving,
              players: newPlayers,
              dice,
              doublesCount: 0,
              lastMoveSteps: total,
              eventLog: newEventLog,
            };
          }
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            jailTurns: newTurns,
          };
          const nextPlayer = getNextPlayer({ ...state, players: newPlayers });
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            currentPlayer: nextPlayer,
            dice: null,
            doublesCount: 0,
            lastMoveSteps: null,
            eventLog: [...state.eventLog, { key: 'event.jailFailed', params: { name: player.name, attempt: newTurns } }, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
          };
        }
      }

      const total = dice[0] + dice[1];
      const newPos = (player.position + total) % 40;
      let newMoney = player.money;
      const newEventLog = [...state.eventLog, { key: 'event.rolled', params: { name: player.name, d1: dice[0], d2: dice[1], total } }];

      let passedGo = false
      if (newPos < player.position || newPos === 0) {
        if (player.position !== 0) {
          passedGo = true
          newMoney += GO_SALARY;
          newEventLog.push({ key: 'event.passedGo', params: { name: player.name, amount: GO_SALARY } });
        }
      }

      const newDoubles = isDoubles ? state.doublesCount + 1 : 0;

      if (isDoubles && newDoubles >= 3) {
        const jailPlayers = [...state.players];
        jailPlayers[state.currentPlayer] = {
          ...jailPlayers[state.currentPlayer],
          position: JAIL_SPACE,
          inJail: true,
          jailTurns: 0,
          money: newMoney,
        };
        const nextPlayer = getNextPlayer({ ...state, players: jailPlayers, currentPlayer: state.currentPlayer });
        return {
          ...state,
          phase: GamePhase.Waiting,
          players: jailPlayers,
          currentPlayer: nextPlayer,
          dice: null,
          doublesCount: 0,
          lastMoveSteps: null,
          eventLog: [...newEventLog, { key: 'event.tripleDoubles', params: { name: player.name } }, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
        };
      }

      const movedPlayers = [...state.players];
      movedPlayers[state.currentPlayer] = {
        ...movedPlayers[state.currentPlayer],
        position: newPos,
        money: newMoney,
        passedGo: movedPlayers[state.currentPlayer].passedGo || passedGo,
      };

      return {
        ...state,
        phase: GamePhase.Moving,
        players: movedPlayers,
        dice,
        doublesCount: newDoubles,
        lastMoveSteps: total,
        eventLog: newEventLog,
      };
    }

    case GameActionType.MoveToken: {
      return { ...state };
    }

    case GameActionType.ResolveSpace: {
      const player = state.players[state.currentPlayer];
      const space = state.board[player.position];

      switch (space.type) {
        case SpaceType.Go:
        case SpaceType.GoToJail: {
          if (space.type === SpaceType.GoToJail) {
            const newPlayers = [...state.players];
            newPlayers[state.currentPlayer] = {
              ...newPlayers[state.currentPlayer],
              position: JAIL_SPACE,
              inJail: true,
              jailTurns: 0,
            };
            const next = getNextPlayer({ ...state, players: newPlayers });
            return {
              ...state,
              phase: GamePhase.Waiting,
              players: newPlayers,
              currentPlayer: next,
              dice: null,
              doublesCount: 0,
              lastMoveSteps: null,
              eventLog: [...state.eventLog, { key: 'event.toJail', params: { name: player.name } }, { key: 'event.turn', params: { name: state.players[next].name } }],
            };
          }
          return { ...state, phase: GamePhase.Waiting };
        }

        case SpaceType.Jail:
          return { ...state, phase: GamePhase.Waiting };

        case SpaceType.FreeParking: {
          const pot = state.freeParkingPot;
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money + pot,
          };
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            freeParkingPot: 0,
            eventLog: [...state.eventLog, { key: 'event.freeParkingJackpot', params: { name: player.name, amount: pot } }],
          };
        }

        case SpaceType.Tax: {
          const isIncome = space.taxType === 'income';
          const taxAmount = isIncome
            ? Math.floor(player.money * INCOME_TAX_RATE)
            : (space.price ?? 0);
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money - taxAmount,
          };
          const message: LogEntry = isIncome
            ? { key: 'event.incomeTax', params: { name: player.name, amount: taxAmount, money: player.money } }
            : { key: 'event.luxuryTax', params: { name: player.name, amount: taxAmount } };
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            freeParkingPot: state.freeParkingPot + taxAmount,
            eventLog: [...state.eventLog, message],
          };
        }

        case SpaceType.Property:
        case SpaceType.Railroad:
        case SpaceType.Utility: {
          if (space.owner !== null && space.owner !== state.currentPlayer && !space.mortgaged) {
            let rent: number;
            let monopoly = false;
            if (space.type === SpaceType.Railroad) {
              rent = calculateRailroadRentFromBoard(space.owner, state.board, space.id);
            } else if (space.type === SpaceType.Utility) {
              rent = calculateUtilityRentFromBoard(space.owner, state.board, space.id, state.dice ?? [1, 1]);
            } else {
              rent = calculatePropertyRent(space);
              monopoly = space.houses === 0 && isMonopoly(space.owner, state.board, space);
              if (monopoly) rent *= 2;
            }

            const currentPlayer = state.players[state.currentPlayer];
            const owner = state.players[space.owner];
            if (owner.inJail) {
              return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, { key: 'event.ownerInJail', params: { owner: owner.name, name: currentPlayer.name } }] };
            }

            return {
              ...state,
              phase: GamePhase.Resolving,
              pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: rent },
              eventLog: monopoly
                ? [...state.eventLog, { key: 'event.monopolyRent', params: { owner: owner.name, name: currentPlayer.name } }]
                : state.eventLog,
            };
          } else if (space.owner === null) {
            if (player.passedGo === false) return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, { key: 'event.mustCircleBoard', params: { name: player.name } }] }
            return {
              ...state,
              phase: GamePhase.Buying,
              pendingAction: { type: PendingActionType.BuyProperty, spaceId: space.id },
            };
          } else if (space.owner === state.currentPlayer) {
            return { ...state, phase: GamePhase.Waiting };
          }
          return { ...state, phase: GamePhase.Waiting };
        }

        case SpaceType.Chance:
        case SpaceType.Community: {
          return {
            ...state,
            phase: GamePhase.Resolving,
            pendingAction: { type: PendingActionType.DrawCard, cardType: space.type as CardType },
          };
        }

        default:
          return { ...state, phase: GamePhase.Waiting };
      }
    }

    case GameActionType.BuyProperty: {
      const pending = state.pendingAction;
      if (pending?.type !== PendingActionType.BuyProperty) return state;
      const space = state.board[pending.spaceId];
      const player = state.players[state.currentPlayer];
      if (player.money < (space.price ?? 0)) return state;
      const newBoard = [...state.board];
      newBoard[pending.spaceId] = { ...space, owner: state.currentPlayer };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        money: player.money - (space.price ?? 0),
        properties: [...player.properties, pending.spaceId],
      };
      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        pendingAction: null,
        justBoughtSpaceId: pending.spaceId,
        eventLog: [...state.eventLog, { key: 'event.bought', params: { name: player.name, spaceId: space.id, amount: space.price ?? 0 } }],
      };
    }

    case GameActionType.DeclineBuy: {
      return { ...state, phase: GamePhase.Waiting, pendingAction: null };
    }

    case GameActionType.PayRent: {
      const pending = state.pendingAction;
      if (pending?.type !== PendingActionType.PayRent && pending?.type !== PendingActionType.Bankruptcy) return state;
      const player = state.players[state.currentPlayer];
      const space = state.board[pending.spaceId];
      if (player.money >= pending.amount) {
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayer] = { ...player, money: player.money - pending.amount };
        if (space.owner !== null) {
          newPlayers[space.owner] = { ...newPlayers[space.owner], money: newPlayers[space.owner].money + pending.amount };
        }
        return {
          ...state,
          phase: GamePhase.Waiting,
          players: newPlayers,
          pendingAction: null,
          eventLog: [...state.eventLog, { key: 'event.paidRent', params: { name: player.name, amount: pending.amount, owner: state.players[space.owner!].name } }],
        };
      }
      return {
        ...state,
        pendingAction: { type: PendingActionType.Bankruptcy, amount: pending.amount, spaceId: pending.spaceId },
      };
    }

    case GameActionType.BuildHouse: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      const cost = getHouseCost(space, space.houses);
      if (space.houses >= 5 || cost === 0 || player.money < cost) return state;
      const newHouses = space.houses + 1;
      const newMoney = player.money - cost;
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, houses: newHouses };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: newMoney };

      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        pendingAction: null,
        eventLog: [...state.eventLog, { key: space.houses === 4 ? 'event.builtHotel' : 'event.builtHouse', params: { name: player.name, spaceId: space.id, amount: cost } }],
      };
    }

    case GameActionType.SellHouse: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      if (space.houses <= 0) return state;
      const refund = Math.floor(getHouseCost(space, space.houses - 1) * HOUSE_SELL_RATE);
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, houses: space.houses - 1 };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: player.money + refund };
      return {
        ...state,
        board: newBoard,
        players: newPlayers,
        eventLog: [...state.eventLog, { key: 'event.soldHouse', params: { name: player.name, spaceId: space.id, amount: refund } }],
      };
    }

    case GameActionType.Mortgage: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      if (space.mortgaged || space.houses > 0) return state;
      const mortgageValue = Math.floor((space.price ?? 0) / 2);
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, mortgaged: true };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: player.money + mortgageValue };
      return {
        ...state,
        board: newBoard,
        players: newPlayers,
        eventLog: [...state.eventLog, { key: 'event.mortgaged', params: { name: player.name, spaceId: space.id, amount: mortgageValue } }],
      };
    }

    case GameActionType.Unmortgage: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      if (!space.mortgaged) return state;
      const unmortgageCost = Math.floor((space.price ?? 0) / 2 * 1.1);
      if (player.money < unmortgageCost) return state;
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, mortgaged: false };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: player.money - unmortgageCost };
      return {
        ...state,
        board: newBoard,
        players: newPlayers,
        eventLog: [...state.eventLog, { key: 'event.unmortgaged', params: { name: player.name, spaceId: space.id, amount: unmortgageCost } }],
      };
    }

    case GameActionType.SellProperty: {
      const space = state.board[action.spaceId];
      const player = state.players[state.currentPlayer];
      if (space.owner !== state.currentPlayer) return state;
      if (space.houses > 0) return state;
      const sellValue = space.mortgaged
        ? Math.floor((space.price ?? 0) * MORTGAGED_SELL_EXTRA)
        : Math.floor((space.price ?? 0) * SELL_RATE);
      const newBoard = [...state.board];
      newBoard[action.spaceId] = { ...space, owner: null, mortgaged: false };
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        money: player.money + sellValue,
        properties: player.properties.filter((id) => id !== action.spaceId),
      };
      return {
        ...state,
        board: newBoard,
        players: newPlayers,
        eventLog: [...state.eventLog, { key: 'event.soldToBank', params: { name: player.name, spaceId: space.id, amount: sellValue } }],
      };
    }

    case GameActionType.ProposeTrade: {
      return {
        ...state,
        pendingAction: { type: PendingActionType.DrawCard, cardType: CardType.Chance },
        eventLog: [...state.eventLog, { key: 'event.tradeProposed', params: { from: state.players[state.currentPlayer].name, to: state.players[action.offer.toId].name } }],
      };
    }

    case GameActionType.AcceptTrade:
    case GameActionType.RejectTrade: {
      return { ...state, pendingAction: null };
    }

    case GameActionType.DrawCard: {
      const pending = state.pendingAction;
      if (pending?.type !== PendingActionType.DrawCard) return state;
      const isChance = pending.cardType === CardType.Chance;
      const deck = isChance ? [...state.chanceDeck] : [...state.communityDeck];

      if (deck.length === 0) {
        const freshDeck = isChance
          ? shuffle([...CHANCE_CARDS])
          : shuffle([...COMMUNITY_CARDS]);
        deck.push(...freshDeck);
      }

      const card = deck.shift()!;
      return {
        ...state,
        phase: GamePhase.Resolving,
        chanceDeck: isChance ? deck : state.chanceDeck,
        communityDeck: isChance ? state.communityDeck : deck,
        pendingAction: { type: PendingActionType.CardEffect, card },
        eventLog: state.eventLog,
      };
    }

    case GameActionType.ResolveCard: {
      const pending = state.pendingAction;
      if (pending?.type !== PendingActionType.CardEffect) return state;
      const oldPos = state.players[state.currentPlayer].position;
      const result = resolveCardEffect(state, pending.card);
      const newPos = result.state.players[state.currentPlayer].position;
      const positionChanged = oldPos !== newPos;
      const wentToJail = pending.card.effect.action === CardActionType.GoToJail;

      return {
        ...result.state,
        phase: positionChanged && !wentToJail ? GamePhase.Resolving : GamePhase.Waiting,
        pendingAction: null,
        currentPlayer: wentToJail ? getNextPlayer(result.state) : result.state.currentPlayer,
        dice: wentToJail ? null : result.state.dice,
        eventLog: [
          ...result.state.eventLog,
          ...result.log,
          ...(wentToJail ? [{ key: 'event.turn', params: { name: result.state.players[getNextPlayer(result.state)].name } }] : []),
        ],
      };
    }

    case GameActionType.CollectFreeParking: {
      const player = state.players[state.currentPlayer];
      const pot = state.freeParkingPot;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = { ...player, money: player.money + pot };
      return {
        ...state,
        players: newPlayers,
        freeParkingPot: 0,
        eventLog: [...state.eventLog, { key: 'event.freeParkingJackpot', params: { name: player.name, amount: pot } }],
      };
    }

    case GameActionType.PayJailFine: {
      const player = state.players[state.currentPlayer];
      if (!player.inJail || player.money < JAIL_FINE) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        money: player.money - JAIL_FINE,
        inJail: false,
        jailTurns: 0,
      };
      const nextPlayer = getNextPlayer({ ...state, currentPlayer: state.currentPlayer });
      return {
        ...state,
        players: newPlayers,
        currentPlayer: nextPlayer,
        freeParkingPot: state.freeParkingPot + JAIL_FINE,
        dice: null,
        eventLog: [...state.eventLog, { key: 'event.paidJailFine', params: { name: player.name, amount: JAIL_FINE } }, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
      };
    }

    case GameActionType.UseGetOutOfJailFree: {
      const player = state.players[state.currentPlayer];
      if (!player.inJail || !player.hasGetOutOfJailFree) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        inJail: false,
        jailTurns: 0,
        hasGetOutOfJailFree: false,
      };
      const nextPlayer = getNextPlayer({ ...state, currentPlayer: state.currentPlayer });
      return {
        ...state,
        players: newPlayers,
        currentPlayer: nextPlayer,
        dice: null,
        eventLog: [...state.eventLog, { key: 'event.usedJailCard', params: { name: player.name } }, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
      };
    }

    case GameActionType.SkipAction: {
      return { ...state, phase: GamePhase.Waiting, pendingAction: null };
    }

    case GameActionType.EndTurn: {
      const isDoubles = state.dice !== null && state.dice[0] === state.dice[1];
      const nextPlayer = isDoubles ? state.currentPlayer : getNextPlayer(state);

      if (isDoubles) {
        return {
          ...state,
          phase: GamePhase.Waiting,
          dice: null,
          doublesCount: state.dice?.[0] === state.dice?.[1] ? state.doublesCount : 0,
          eventLog: [...state.eventLog, { key: 'event.doublesAgain', params: { name: state.players[state.currentPlayer].name } }],
        };
      }

      return {
        ...state,
        phase: GamePhase.Waiting,
        currentPlayer: nextPlayer,
        dice: null,
        doublesCount: 0,
        eventLog: [...state.eventLog, { key: 'event.turn', params: { name: state.players[nextPlayer].name } }],
      };
    }

    case GameActionType.DeclareBankruptcy: {
      const player = state.players[state.currentPlayer];
      const newBoard = state.board.map((s) => {
        if (s.owner === player.id) {
          return { ...s, owner: null, houses: 0, mortgaged: false };
        }
        return s;
      });
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        money: 0,
        properties: [],
        bankrupt: true,
      };
      const activePlayers = newPlayers.filter((p) => !p.bankrupt);
      if (activePlayers.length <= 1) {
        return {
          ...state,
          phase: GamePhase.GameOver,
          board: newBoard,
          players: newPlayers,
          pendingAction: null,
          eventLog: [...state.eventLog, { key: 'event.bankruptcyWin', params: { name: player.name, winner: activePlayers[0]?.name ?? '' } }],
        };
      }
      const winnerIdx = newPlayers.indexOf(activePlayers[0]);
      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        currentPlayer: winnerIdx,
        pendingAction: null,
        eventLog: [...state.eventLog, { key: 'event.bankruptcy', params: { name: player.name } }],
      };
    }

    default:
      return state;
  }
}

function getNextPlayer(state: GameState): number {
  let next = (state.currentPlayer + 1) % state.players.length;
  let safety = 0;
  while (state.players[next]?.bankrupt && safety < state.players.length) {
    next = (next + 1) % state.players.length;
    safety++;
  }
  return next;
}
