import { GamePhase, GameActionType, PendingActionType, SpaceType, CardType, CardActionType, type GameState, type GameAction, type Player } from '../types/game';
import { formatMoney } from '../utils/format';
import { createInitialBoard, getHouseCost, GO_SALARY, JAIL_SPACE, STARTING_MONEY, MAX_JAIL_TURNS, JAIL_FINE, SELL_RATE, MORTGAGED_SELL_EXTRA, HOUSE_SELL_RATE, INCOME_TAX_RATE } from '../data/board';
import { CHANCE_CARDS, COMMUNITY_CARDS } from '../data/cards';
import { resolveCardEffect } from './cards';
import { calculatePropertyRent, calculateRailroadRentFromBoard, calculateUtilityRentFromBoard, isMonopoly, getPlayerNetWorth } from './rent';

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
          name: action.names[i] || `Pemain ${i + 1}`,
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
        eventLog: [{ key: 'Permainan dimulai!' }],
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
          const newEventLog = [...state.eventLog, { key: `${player.name} keluar dari penjara! (dadu ganda)` }];
          const passedGo = newPos < player.position
          if (passedGo) {
            newMoney += GO_SALARY;
            newEventLog.push({ key: `${player.name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}` });
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
            const newEventLog = [...state.eventLog, { key: `${player.name} sudah 3 kali gagal, dipaksa keluar penjara` }];
            const forcedPassedGo = newPos < player.position
            if (forcedPassedGo) {
              newMoney += GO_SALARY;
              newEventLog.push({ key: `${player.name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}` });
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
            eventLog: [...state.eventLog, { key: `${player.name} gagal keluar penjara (percobaan ke-${newTurns})` }, { key: `Giliran ${state.players[nextPlayer].name}` }],
          };
        }
      }

      const total = dice[0] + dice[1];
      const newPos = (player.position + total) % 40;
      let newMoney = player.money;
      const newEventLog = [...state.eventLog, { key: `${player.name} melempar ${dice[0]}+${dice[1]}=${total}` }];

      let passedGo = false
      if (newPos < player.position || newPos === 0) {
        if (player.position !== 0) {
          passedGo = true
          newMoney += GO_SALARY;
          newEventLog.push({ key: `${player.name} melewati MULAI, dapat ${formatMoney(GO_SALARY)}` });
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
          eventLog: [...newEventLog, { key: `3x ganda berturut-turut! ${player.name} masuk Penjara!` }, { key: `Giliran ${state.players[nextPlayer].name}` }],
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
              eventLog: [...state.eventLog, { key: `${player.name} masuk Penjara!` }, { key: `Giliran ${state.players[next].name}` }],
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
            eventLog: [...state.eventLog, { key: `${player.name} mendapat jackpot Parkir Gratis ${formatMoney(pot)}!` }],
          };
        }

        case SpaceType.Tax: {
          const isIncome = space.taxType === 'income';
          const netWorth = isIncome ? getPlayerNetWorth(player, state.board) : 0;
          const taxAmount = isIncome
            ? Math.floor(netWorth * INCOME_TAX_RATE)
            : (space.price ?? 0);
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayer] = {
            ...newPlayers[state.currentPlayer],
            money: player.money - taxAmount,
          };
          const message = isIncome
            ? `${player.name} membayar pajak penghasilan ${formatMoney(taxAmount)} (10% dari total aset ${formatMoney(netWorth)})`
            : `${player.name} membayar pajak mewah ${formatMoney(taxAmount)}`;
          return {
            ...state,
            phase: GamePhase.Waiting,
            players: newPlayers,
            freeParkingPot: state.freeParkingPot + taxAmount,
            eventLog: [...state.eventLog, { key: message }],
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
              return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, { key: `${owner.name} di penjara — tidak mendapat sewa dari ${currentPlayer.name}` }] };
            }

            return {
              ...state,
              phase: GamePhase.Resolving,
              pendingAction: { type: PendingActionType.PayRent, spaceId: space.id, amount: rent },
              eventLog: monopoly
                ? [...state.eventLog, { key: `${owner.name} memiliki komplek lengkap — sewa ${currentPlayer.name} jadi 2x!` }]
                : state.eventLog,
            };
          } else if (space.owner === null) {
            if (player.passedGo === false) return { ...state, phase: GamePhase.Waiting, eventLog: [...state.eventLog, { key: `${player.name} harus mengelilingi papan 1x sebelum membeli properti` }] }
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
        eventLog: [...state.eventLog, { key: `${player.name} membeli ${space.id} seharga ${formatMoney(space.price)}` }],
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
          eventLog: [...state.eventLog, { key: `${player.name} membayar sewa ${formatMoney(pending.amount)} ke ${state.players[space.owner!].name}` }],
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
      const houseOrHotel = space.houses === 4 ? 'Hotel' : 'Rumah';

      return {
        ...state,
        phase: GamePhase.Waiting,
        board: newBoard,
        players: newPlayers,
        pendingAction: null,
        eventLog: [...state.eventLog, { key: `${player.name} membangun ${houseOrHotel} di ${space.id} seharga ${formatMoney(cost)}` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} menjual rumah di ${space.id}, mendapat ${formatMoney(refund)}` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} menggadaikan ${space.id} seharga ${formatMoney(mortgageValue)}` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} menebus ${space.id} seharga ${formatMoney(unmortgageCost)}` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} menjual ${space.id} ke bank seharga ${formatMoney(sellValue)}` }],
      };
    }

    case GameActionType.ProposeTrade: {
      return {
        ...state,
        pendingAction: { type: PendingActionType.DrawCard, cardType: CardType.Chance },
        eventLog: [...state.eventLog, { key: `${state.players[state.currentPlayer].name} mengajukan tawaran pertukaran ke ${state.players[action.offer.toId].name}` }],
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
        eventLog: [...state.eventLog, { key: `${state.players[state.currentPlayer].name} mengambil kartu: ${card.id}` }],
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
        eventLog: [...result.state.eventLog, { key: result.message }, ...(wentToJail ? [{ key: `Giliran ${result.state.players[getNextPlayer(result.state)].name}` }] : [])],
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
        eventLog: [...state.eventLog, { key: `${player.name} mendapat jackpot ${formatMoney(pot)}!` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} membayar ${formatMoney(JAIL_FINE)} untuk keluar dari penjara` }, { key: `Giliran ${state.players[nextPlayer].name}` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} menggunakan Kartu Bebas Penjara!` }, { key: `Giliran ${state.players[nextPlayer].name}` }],
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
          eventLog: [...state.eventLog, { key: `${state.players[state.currentPlayer].name} main lagi (dadu ganda)!` }],
        };
      }

      return {
        ...state,
        phase: GamePhase.Waiting,
        currentPlayer: nextPlayer,
        dice: null,
        doublesCount: 0,
        eventLog: [...state.eventLog, { key: `Giliran ${state.players[nextPlayer].name}` }],
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
          eventLog: [...state.eventLog, { key: `${player.name} bangkrut! ${activePlayers[0]?.name ?? ''} menang!` }],
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
        eventLog: [...state.eventLog, { key: `${player.name} bangkrut!` }],
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
