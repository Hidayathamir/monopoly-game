import { GamePhase, GameActionType, PendingActionType, SpaceType, CardType, CardActionType, LogEventKey, LogParamKey, TaxType, BotControlReason, type GameState, type GameAction, type Player, type LogEntry, type PendingTrade } from '../types/game';
import { createInitialBoard, getHouseCost, getTotalHouseInvestment, GO_SALARY, JAIL_SPACE, STARTING_MONEY, MAX_JAIL_TURNS, JAIL_FINE, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE, INCOME_TAX_RATE, BOARD_SIZE, MAX_HOUSES } from '../data/board';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cards';
import { PLAYER_COLORS } from '../data/players';
import { DEFAULT_AVATAR } from '../data/avatars';
import { resolveCardEffect } from './cards';
import { calculatePropertyRent, calculateRailroadRentFromBoard, calculateUtilityRentFromBoard, isMonopoly } from './rent';
import { shouldAcceptTrade } from './bot';
import { actorEntry, turnEntry } from './logEntries';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function createInitialState({ tradesEnabled = false }: { tradesEnabled?: boolean } = {}): GameState {
  return {
    phase: GamePhase.Setup,
    players: [],
    turnOrder: [],
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
    builtThisStop: false,
    reconnectGrace: null,
    pendingTrades: [],
    nextTradeId: 0,
    tradesEnabled,
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
          getOutOfJailFreeCards: 0,
          isBot: action.isBot?.[i] ?? false,
          botControlled: false,
          afk: false,
          color: action.colors?.[i] ?? PLAYER_COLORS[i % PLAYER_COLORS.length],
          avatar: action.avatars?.[i] ?? DEFAULT_AVATAR,
        });
      }
      const turnOrder = shuffle(Array.from({ length: action.playerCount }, (_, i) => i));
      return {
        ...state,
        phase: GamePhase.Waiting,
        players,
        turnOrder,
        currentPlayer: turnOrder[0],
        eventLog: [{ key: LogEventKey.GameStarted }],
      };
    }

    case GameActionType.RollDice: {
      return {
        ...state,
        phase: GamePhase.Rolling,
        justBoughtSpaceId: null,
        builtThisStop: false,
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
          const newPos = (player.position + total) % BOARD_SIZE;
          let newMoney = player.money;
          const newEventLog = [...state.eventLog, actorEntry(LogEventKey.JailBreakDoubles, player)];
          const passedGo = newPos < player.position
          if (passedGo) {
            newMoney += GO_SALARY;
            newEventLog.push(actorEntry(LogEventKey.PassedGo, player, { [LogParamKey.Amount]: GO_SALARY }));
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
            const newPos = (player.position + total) % BOARD_SIZE;
            let newMoney = player.money;
            const newEventLog = [...state.eventLog, actorEntry(LogEventKey.JailForcedOut, player)];
            const forcedPassedGo = newPos < player.position
            if (forcedPassedGo) {
              newMoney += GO_SALARY;
              newEventLog.push(actorEntry(LogEventKey.PassedGo, player, { [LogParamKey.Amount]: GO_SALARY }));
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
            eventLog: [...state.eventLog, actorEntry(LogEventKey.JailFailed, player, { attempt: newTurns }), turnEntry(state.players, nextPlayer)],
          };
        }
      }

      const total = dice[0] + dice[1];
      const newPos = (player.position + total) % BOARD_SIZE;
      let newMoney = player.money;
      const target = action.target;
      const luck = action.luck;
      const aimed = target !== undefined && luck !== undefined;
      const rolledEntry: LogEntry = aimed
        ? actorEntry(LogEventKey.RolledAimed, player, { d1: dice[0], d2: dice[1], total, target, luck })
        : actorEntry(LogEventKey.Rolled, player, { d1: dice[0], d2: dice[1], total });
      const newEventLog = [...state.eventLog, rolledEntry];

      let passedGo = false
      if (newPos < player.position || newPos === 0) {
        if (player.position !== 0) {
          passedGo = true
          newMoney += GO_SALARY;
          newEventLog.push(actorEntry(LogEventKey.PassedGo, player, { [LogParamKey.Amount]: GO_SALARY }));
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
          eventLog: [...newEventLog, actorEntry(LogEventKey.TripleDoubles, player), turnEntry(state.players, nextPlayer)],
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
              eventLog: [...state.eventLog, actorEntry(LogEventKey.ToJail, player), turnEntry(state.players, next)],
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
            eventLog: [...state.eventLog, actorEntry(LogEventKey.FreeParkingJackpot, player, { [LogParamKey.Amount]: pot })],
          };
        }

        case SpaceType.Tax: {
          const isIncome = space.taxType === TaxType.Income;
          const taxAmount = isIncome
            ? Math.floor(player.money * INCOME_TAX_RATE)
            : (space.price ?? 0);
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money - taxAmount,
          };
          const message: LogEntry = isIncome
            ? actorEntry(LogEventKey.IncomeTax, player, { [LogParamKey.Amount]: taxAmount, [LogParamKey.Money]: player.money })
            : actorEntry(LogEventKey.LuxuryTax, player, { [LogParamKey.Amount]: taxAmount });
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
              monopoly = isMonopoly(space.owner, state.board, space);
              if (monopoly) rent *= 2;
            }

            const currentPlayer = state.players[state.currentPlayer];
            const owner = state.players[space.owner];
            if (owner.inJail) {
              return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, { key: LogEventKey.OwnerInJail, params: { owner: owner.name, name: currentPlayer.name, ...(currentPlayer.botControlled ? { [LogParamKey.Bot]: true } : {}) } }] };
            }

            return {
              ...state,
              phase: GamePhase.Resolving,
              pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: rent },
              eventLog: monopoly
                ? [...state.eventLog, { key: LogEventKey.MonopolyRent, params: { owner: owner.name, name: currentPlayer.name, ...(currentPlayer.botControlled ? { [LogParamKey.Bot]: true } : {}) } }]
                : state.eventLog,
            };
          } else if (space.owner === null) {
            if (player.passedGo === false) return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, actorEntry(LogEventKey.MustCircleBoard, player)] }
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.Bought, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: space.price ?? 0 })],
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
          eventLog: [...state.eventLog, { key: LogEventKey.PaidRent, params: { name: player.name, ...(player.botControlled ? { [LogParamKey.Bot]: true } : {}), [LogParamKey.Amount]: pending.amount, owner: state.players[space.owner!].name } }],
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
      if (
        space.id !== player.position ||
        space.owner !== state.currentPlayer ||
        state.dice === null ||
        state.pendingAction !== null ||
        space.houses >= MAX_HOUSES ||
        space.mortgaged ||
        cost === 0 ||
        player.money < cost ||
        space.id === state.justBoughtSpaceId
      ) return state;
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
        builtThisStop: true,
        eventLog: [...state.eventLog, actorEntry(space.houses === MAX_HOUSES - 1 ? LogEventKey.BuiltHotel : LogEventKey.BuiltHouse, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: cost })],
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.SoldHouse, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: refund })],
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.Mortgaged, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: mortgageValue })],
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.Unmortgaged, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: unmortgageCost })],
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.SoldToBank, player, { [LogParamKey.SpaceId]: space.id, [LogParamKey.Amount]: sellValue })],
      };
    }

    case GameActionType.ProposeTrade: {
      if (!state.tradesEnabled) return state;
      const offer = action.offer;
      const from = state.players[offer.fromId];
      const to = state.players[offer.toId];
      if (!from || !to || offer.fromId === offer.toId || from.bankrupt || to.bankrupt) return state;
      const trade: PendingTrade = { ...offer, id: state.nextTradeId };
      if (!isTradeValid(state, trade)) {
        return {
          ...state,
          eventLog: [...state.eventLog, { key: LogEventKey.TradeProposalRejected, params: { from: from.name, to: to.name } }],
        };
      }
      if (to.isBot || to.botControlled) {
        if (shouldAcceptTrade(state, trade)) {
          const applied = applyTrade(state, trade);
          return {
            ...applied,
            eventLog: [...applied.eventLog, { key: LogEventKey.TradeAccepted, params: { from: from.name, to: to.name } }],
          };
        }
        return { ...state, eventLog: [...state.eventLog, { key: LogEventKey.TradeRejected, params: { from: from.name, to: to.name } }] };
      }
      return {
        ...state,
        pendingTrades: [...state.pendingTrades, trade],
        nextTradeId: state.nextTradeId + 1,
        eventLog: [...state.eventLog, { key: LogEventKey.TradeProposed, params: { from: from.name, to: to.name } }],
      };
    }

    case GameActionType.AcceptTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      const from = state.players[trade.fromId];
      const to = state.players[trade.toId];
      if (!from || !to) return state;
      if (!isTradeValid(state, trade)) {
        return {
          ...state,
          pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
          eventLog: [...state.eventLog, { key: LogEventKey.TradeRejected, params: { from: from.name, to: to.name } }],
        };
      }
      const applied = applyTrade(state, trade);
      return {
        ...applied,
        pendingTrades: applied.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...applied.eventLog, { key: LogEventKey.TradeAccepted, params: { from: from.name, to: to.name } }],
      };
    }

    case GameActionType.RejectTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      return {
        ...state,
        pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...state.eventLog, { key: LogEventKey.TradeRejected, params: { from: state.players[trade.fromId].name, to: state.players[trade.toId].name } }],
      };
    }

    case GameActionType.CancelTrade: {
      if (!state.tradesEnabled) return state;
      const trade = state.pendingTrades.find((t) => t.id === action.tradeId);
      if (!trade) return state;
      return {
        ...state,
        pendingTrades: state.pendingTrades.filter((t) => t.id !== trade.id),
        eventLog: [...state.eventLog, { key: LogEventKey.TradeCancelled, params: { from: state.players[trade.fromId].name, to: state.players[trade.toId].name } }],
      };
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
          ...(wentToJail ? [turnEntry(result.state.players, getNextPlayer(result.state))] : []),
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.FreeParkingJackpot, player, { [LogParamKey.Amount]: pot })],
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
        eventLog: [...state.eventLog, actorEntry(LogEventKey.PaidJailFine, player, { [LogParamKey.Amount]: JAIL_FINE }), turnEntry(state.players, nextPlayer)],
      };
    }

    case GameActionType.UseGetOutOfJailFree: {
      const player = state.players[state.currentPlayer];
      if (!player.inJail || player.getOutOfJailFreeCards <= 0) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayer] = {
        ...player,
        inJail: false,
        jailTurns: 0,
        getOutOfJailFreeCards: player.getOutOfJailFreeCards - 1,
      };
      const nextPlayer = getNextPlayer({ ...state, currentPlayer: state.currentPlayer });
      return {
        ...state,
        players: newPlayers,
        currentPlayer: nextPlayer,
        dice: null,
        eventLog: [...state.eventLog, actorEntry(LogEventKey.UsedJailCard, player), turnEntry(state.players, nextPlayer)],
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
          eventLog: [...state.eventLog, actorEntry(LogEventKey.DoublesAgain, state.players[state.currentPlayer])],
        };
      }

      return {
        ...state,
        phase: GamePhase.Waiting,
        currentPlayer: nextPlayer,
        dice: null,
        doublesCount: 0,
        eventLog: [...state.eventLog, turnEntry(state.players, nextPlayer)],
      };
    }

    case GameActionType.DeclareBankruptcy: {
      const player = state.players[state.currentPlayer];
      const pending = state.pendingAction;
      const creditorId =
        pending?.type === PendingActionType.Bankruptcy || pending?.type === PendingActionType.PayRent
          ? state.board[pending.spaceId]?.owner ?? null
          : null;

      let liquidationTotal = Math.max(0, player.money);
      const newBoard = state.board.map((s) => {
        if (s.owner !== player.id) return s;
        if (s.houses > 0) liquidationTotal += Math.floor(getTotalHouseInvestment(s) * HOUSE_SELL_RATE);
        if (s.mortgaged) {
          liquidationTotal += Math.floor((s.price ?? 0) * MORTGAGED_SELL_EXTRA);
        } else {
          liquidationTotal += Math.floor((s.price ?? 0) * SELL_RATE);
        }
        return { ...s, owner: null, houses: 0, mortgaged: false };
      });

      const newPlayers = state.players.map((p, i) => {
        if (i === state.currentPlayer) {
          return { ...p, money: 0, properties: [], bankrupt: true, getOutOfJailFreeCards: 0 };
        }
        if (creditorId !== null && i === creditorId) {
          return { ...p, money: p.money + liquidationTotal };
        }
        return p;
      });

      const activePlayers = newPlayers.filter((p) => !p.bankrupt);
      const baseLog: LogEntry[] = [actorEntry(LogEventKey.Bankruptcy, player)];
      const transferLog: LogEntry | null =
        creditorId !== null
          ? { key: LogEventKey.BankruptcyTransfer, params: { name: player.name, ...(player.botControlled ? { [LogParamKey.Bot]: true } : {}), creditor: newPlayers[creditorId].name, [LogParamKey.Amount]: liquidationTotal } }
          : null;
      const logs: LogEntry[] = [...baseLog, ...(transferLog ? [transferLog] : [])];

      if (activePlayers.length <= 1) {
        return {
          ...state,
          phase: GamePhase.GameOver,
          board: newBoard,
          players: newPlayers,
          pendingAction: null,
          eventLog: [...state.eventLog, ...logs, { key: LogEventKey.BankruptcyWin, params: { name: player.name, ...(player.botControlled ? { [LogParamKey.Bot]: true } : {}), winner: activePlayers[0]?.name ?? '' } }],
        };
      }
      const next = getNextPlayer({ ...state, board: newBoard, players: newPlayers });
      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        currentPlayer: next,
        pendingAction: null,
        dice: null,
        doublesCount: 0,
        lastMoveSteps: null,
        eventLog: [...state.eventLog, ...logs, turnEntry(newPlayers, next)],
      };
    }

    case GameActionType.SetReconnectGrace: {
      if (action.until == null) {
        if (!state.reconnectGrace) return state;
        return { ...state, reconnectGrace: null };
      }
      if (state.reconnectGrace?.playerId === action.playerId) return state;
      const player = state.players[action.playerId];
      return {
        ...state,
        reconnectGrace: { playerId: action.playerId, until: action.until },
        eventLog: player ? [...state.eventLog, { key: LogEventKey.ReconnectWait, params: { name: player.name } }] : state.eventLog,
      };
    }

    case GameActionType.SetBotControl: {
      const target = state.players[action.playerId];
      if (!target || target.botControlled === action.controlled) return state;
      const newPlayers = [...state.players];
      newPlayers[action.playerId] = {
        ...target,
        botControlled: action.controlled,
        afk: action.controlled ? action.reason === BotControlReason.Afk : false,
      };
      const logKey = action.controlled
        ? action.reason === BotControlReason.Afk
          ? LogEventKey.PlayerAfk
          : LogEventKey.PlayerOffline
        : LogEventKey.PlayerBack;
      return {
        ...state,
        players: newPlayers,
        reconnectGrace: !action.controlled && state.reconnectGrace?.playerId === action.playerId ? null : state.reconnectGrace,
        eventLog: [...state.eventLog, { key: logKey, params: { name: target.name } }],
      };
    }

    default:
      return state;
  }
}

function getNextPlayer(state: GameState): number {
  const order = state.turnOrder.length > 0 ? state.turnOrder : state.players.map((_, i) => i);
  const idx = order.indexOf(state.currentPlayer);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(idx + i) % order.length];
    if (!state.players[id]?.bankrupt) return id;
  }
  return state.currentPlayer;
}

function isTradeValid(state: GameState, trade: PendingTrade): boolean {
  if (
    trade.offerCash <= 0 &&
    trade.offerProperties.length === 0 &&
    trade.requestCash <= 0 &&
    trade.requestProperties.length === 0
  ) {
    return false;
  }
  for (const id of trade.offerProperties) {
    const space = state.board[id];
    if (!space || space.owner !== trade.fromId || space.mortgaged || space.houses > 0) return false;
  }
  for (const id of trade.requestProperties) {
    const space = state.board[id];
    if (!space || space.owner !== trade.toId || space.mortgaged || space.houses > 0) return false;
  }
  if (state.players[trade.fromId].money < trade.offerCash) return false;
  if (state.players[trade.toId].money < trade.requestCash) return false;
  return true;
}

function applyTrade(state: GameState, trade: PendingTrade): GameState {
  const board = state.board.map((space) => {
    if (trade.offerProperties.includes(space.id)) return { ...space, owner: trade.toId };
    if (trade.requestProperties.includes(space.id)) return { ...space, owner: trade.fromId };
    return space;
  });
  const players = state.players.map((p) => {
    if (p.id === trade.fromId) {
      return {
        ...p,
        money: p.money - trade.offerCash + trade.requestCash,
        properties: p.properties.filter((id) => !trade.offerProperties.includes(id)).concat(trade.requestProperties),
      };
    }
    if (p.id === trade.toId) {
      return {
        ...p,
        money: p.money + trade.offerCash - trade.requestCash,
        properties: p.properties.filter((id) => !trade.requestProperties.includes(id)).concat(trade.offerProperties),
      };
    }
    return p;
  });
  return { ...state, board, players };
}
