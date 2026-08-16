import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from '../gameReducer';
import { GamePhase, GameActionType, PendingActionType, type GameState } from '../../types/game';
import { STARTING_MONEY, GO_SALARY } from '../../data/board';

function makeStartedState(playerCount = 2): GameState {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana'];
  return gameReducer(createInitialState(), { type: GameActionType.StartGame, playerCount, names });
}

function setMoney(state: GameState, playerIndex: number, money: number): GameState {
  const players = [...state.players];
  players[playerIndex] = { ...players[playerIndex], money };
  return { ...state, players };
}

function setPosition(state: GameState, playerIndex: number, position: number): GameState {
  const players = [...state.players];
  players[playerIndex] = { ...players[playerIndex], position };
  return { ...state, players };
}

function buyProperty(state: GameState, playerIndex: number, spaceId: number): GameState {
  const board = [...state.board];
  const space = board[spaceId];
  board[spaceId] = { ...space, owner: playerIndex };
  const players = [...state.players];
  const player = players[playerIndex];
  players[playerIndex] = {
    ...player,
    money: player.money - (space.price ?? 0),
    properties: [...player.properties, spaceId],
  };
  return { ...state, board, players };
}

describe('gameReducer', () => {
  it('initializes an empty trade inbox', () => {
    const state = createInitialState();
    expect(state.pendingTrades).toEqual([]);
    expect(state.nextTradeId).toBe(0);
  });

  describe('START_GAME', () => {
    it('creates players with 1500 each', () => {
      const state = makeStartedState(3);
      expect(state.players).toHaveLength(3);
      expect(state.players[0].money).toBe(STARTING_MONEY);
      expect(state.players[1].money).toBe(STARTING_MONEY);
      expect(state.players[2].name).toBe('Charlie');
      expect(state.phase).toBe(GamePhase.Waiting);
      expect(state.currentPlayer).toBe(0);
    });

    it('stamps isBot flags from the action (default false)', () => {
      const state = gameReducer(createInitialState(), {
        type: GameActionType.StartGame,
        playerCount: 3,
        names: ['Alice', 'Bot', 'Charlie'],
        isBot: [false, true, false],
      });
      expect(state.players.map((p) => p.isBot)).toEqual([false, true, false]);
    });

    it('defaults every player isBot to false when isBot is omitted', () => {
      const state = gameReducer(createInitialState(), {
        type: GameActionType.StartGame,
        playerCount: 2,
        names: ['Alice', 'Bob'],
      });
      expect(state.players.map((p) => p.isBot)).toEqual([false, false]);
    });
  });

  describe('ROLL_DICE + DICE_ANIMATED', () => {
    it('moves player forward by dice sum', () => {
      const state = makeStartedState();
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      expect(s1.phase).toBe(GamePhase.Rolling);

      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] });
      expect(s2.players[0].position).toBe(7);
      expect(s2.phase).toBe(GamePhase.Moving);
    });

    it('records forward lastMoveSteps on a dice move', () => {
      const state = makeStartedState()
      const s1 = gameReducer(state, { type: GameActionType.RollDice })
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] })
      expect(s2.lastMoveSteps).toBe(7)
    })

    it('collects 200 when passing GO', () => {
      const state = setPosition(makeStartedState(), 0, 38);
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] });
      expect(s2.players[0].position).toBe(5);
      expect(s2.players[0].money).toBe(STARTING_MONEY + GO_SALARY);
    });

    it('doubles gives extra turn', () => {
      const state = makeStartedState();
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 3] });
      expect(s2.doublesCount).toBe(1);

      const endState = gameReducer(s2, { type: GameActionType.EndTurn });
      expect(endState.currentPlayer).toBe(0);
      expect(endState.dice).toBeNull();
    });

    it('three doubles sends to jail', () => {
      let state = makeStartedState();
      state = gameReducer(state, { type: GameActionType.RollDice });
      state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [1, 1] });
      expect(state.players[0].inJail).toBe(false);
      state = { ...state, phase: GamePhase.Waiting, doublesCount: 2 };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [1, 1] });

      expect(s2.players[0].inJail).toBe(true);
      expect(s2.players[0].position).toBe(10);
      expect(s2.phase).toBe(GamePhase.Waiting);
    });
  });

  describe('END_TURN', () => {
    it('switches to next player', () => {
      let state = makeStartedState();
      state = gameReducer(state, { type: GameActionType.RollDice });
      state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      state = { ...state, phase: GamePhase.Waiting };

      const s1 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s1.currentPlayer).toBe(1);
      expect(s1.dice).toBeNull();
    });

    it('wraps around to player 0', () => {
      let state = makeStartedState();
      state = { ...state, currentPlayer: 1 };
      state = gameReducer(state, { type: GameActionType.RollDice });
      state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      state = { ...state, phase: GamePhase.Waiting };

      const s1 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s1.currentPlayer).toBe(0);
    });

    it('skips bankrupt players', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], money: 100 },
          { ...state.players[1], bankrupt: true },
        ],
        currentPlayer: 0,
      };
      state = gameReducer(state, { type: GameActionType.RollDice });
      state = gameReducer(state, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      state = { ...state, phase: GamePhase.Waiting };

      const s1 = gameReducer(state, { type: GameActionType.EndTurn });
      expect(s1.currentPlayer).toBe(0);
    });

    it('advances to the next player when dice is null', () => {
      const state = makeStartedState()
      const s1 = gameReducer(state, { type: GameActionType.EndTurn })
      expect(s1.currentPlayer).toBe(1)
      expect(s1.dice).toBeNull()
      expect(s1.eventLog).toContainEqual({ key: 'event.turn', params: { name: 'Bob' } })
    });
  });

  describe('BUY_PROPERTY', () => {
    it('buys an unowned property', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 1);
      state = {
        ...state,
        phase: GamePhase.Buying,
        pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 },
      };

      const s1 = gameReducer(state, { type: GameActionType.BuyProperty });
      expect(s1.board[1].owner).toBe(0);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60);
      expect(s1.players[0].properties).toContain(1);
      expect(s1.pendingAction).toBeNull();
    });

    it('tracks justBoughtSpaceId between buy and next roll', () => {
      let state = makeStartedState()
      state = setPosition(state, 0, 1)
      state = { ...state, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 } }
      const bought = gameReducer(state, { type: GameActionType.BuyProperty })
      expect(bought.justBoughtSpaceId).toBe(1)
      const rolled = gameReducer(bought, { type: GameActionType.RollDice })
      expect(rolled.justBoughtSpaceId).toBeNull()
    })
  });

  describe('DECLINE_BUY', () => {
    it('declines to buy property', () => {
      let state = makeStartedState();
      state = {
        ...state,
        phase: GamePhase.Buying,
        pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 },
      };

      const s1 = gameReducer(state, { type: GameActionType.DeclineBuy });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.players[0].money).toBe(STARTING_MONEY);
      expect(s1.pendingAction).toBeNull();
    });
  });

  describe('PAY_RENT', () => {
    it('pays rent to property owner', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);
      state = {
        ...state,
        phase: GamePhase.Resolving,
        pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2 },
      };

      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 2);
      expect(s1.players[1].money).toBe(STARTING_MONEY - 60 + 2);
      expect(s1.phase).toBe(GamePhase.Waiting);
    });

    it('transitions to bankruptcy when cannot pay', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 1);
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);
      state = {
        ...state,
        phase: GamePhase.Resolving,
        pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2 },
      };

      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.pendingAction?.type).toBe(PendingActionType.Bankruptcy);
      expect((s1.pendingAction as { amount: number })?.amount).toBe(2);
    });
  });

  describe('BUILD_HOUSE', () => {
    it('builds a house on owned property', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      state = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(state.board[1].houses).toBe(1);
      expect(state.players[0].money).toBe(STARTING_MONEY - 60 - 25);
    });

    it('cannot build if not enough money', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 10);
      state = buyProperty(state, 0, 1);
      state = { ...state, players: [{ ...state.players[0], money: 10 }] };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });

    it('builds hotel at 5 houses', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)),
      };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(5);
    });

    it('cannot build beyond hotel (6+)', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 5 } : s)),
      };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(5);
    });
  });

  describe('SELL_HOUSE', () => {
    it('sells a house for 75% of its build cost', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 2 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(1);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60 + 37);
    });
  });

  describe('MORTGAGE', () => {
    it('mortgages property for half price', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      const s1 = gameReducer(state, { type: GameActionType.Mortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(true);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60 + 30);
    });

    it('cannot mortgage with houses', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 1 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.Mortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(false);
    });
  });

  describe('UNMORTGAGE', () => {
    it('unmortgages property for mortgage + 10%', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)),
      };

      const cost = Math.floor(60 / 2 * 1.1);
      const s1 = gameReducer(state, { type: GameActionType.Unmortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60 - cost);
    });
  });

  describe('SELL_PROPERTY', () => {
    it('sells an unmortgaged property for 75% of price', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].properties).not.toContain(1);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60 + 45);
    });

    it('sells a mortgaged property for an extra 10% on top of mortgage', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].money).toBe(STARTING_MONEY - 60 + 6);
    });

    it('cannot sell a property that still has houses', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 1 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
      expect(s1.board[1].owner).toBe(0);
      expect(s1.players[0].properties).toContain(1);
    });
  });

  describe('DECLARE_BANKRUPTCY', () => {
    it('eliminates player, returns properties to bank', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = buyProperty(state, 0, 3);

      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.players[0].bankrupt).toBe(true);
      expect(s1.players[0].properties).toHaveLength(0);
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[3].owner).toBeNull();
      expect(s1.board[1].houses).toBe(0);
    });

    it('declares winner when last player remains', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0] },
          { ...state.players[1], bankrupt: true },
        ],
      };

      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.phase).toBe(GamePhase.GameOver);
      expect(s1.players[1].bankrupt).toBe(true);
      expect(s1.currentPlayer).toBe(0);
    });
  });

  describe('jail mechanics', () => {
    it('jail escape with doubles', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], inJail: true, position: 10 },
          state.players[1],
        ],
      };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 3] });
      expect(s2.players[0].inJail).toBe(false);
      expect(s2.phase).toBe(GamePhase.Moving);
    });

    it('jail escape fails on non-doubles', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], inJail: true, position: 10 },
          state.players[1],
        ],
      };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      expect(s2.players[0].inJail).toBe(true);
      expect(s2.players[0].jailTurns).toBe(1);
      expect(s2.phase).toBe(GamePhase.Waiting);
    });

    it('forced out of jail after 3 failures', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], inJail: true, position: 10, jailTurns: 2 },
          state.players[1],
        ],
      };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      expect(s2.players[0].inJail).toBe(false);
      expect(s2.phase).toBe(GamePhase.Moving);
    });

    it('go to jail space sends player to jail', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 30);
      state = {
        ...state,
        phase: GamePhase.Resolving,
        pendingAction: null,
      };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].inJail).toBe(true);
      expect(s1.players[0].position).toBe(10);
    });
  });

  describe('GET_OUT_OF_JAIL_FREE', () => {
    it('initially has no jail cards', () => {
      const state = makeStartedState();
      expect(state.players[0].getOutOfJailFreeCards).toBe(0);
    });

    it('uses one card and keeps the second', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [
          { ...state.players[0], inJail: true, position: 10, getOutOfJailFreeCards: 2 },
          state.players[1],
        ],
      };
      const s1 = gameReducer(state, { type: GameActionType.UseGetOutOfJailFree });
      expect(s1.players[0].inJail).toBe(false);
      expect(s1.players[0].getOutOfJailFreeCards).toBe(1);
      expect(s1.currentPlayer).toBe(1);
    });

    it('does nothing without a jail card', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [{ ...state.players[0], inJail: true, position: 10, getOutOfJailFreeCards: 0 }, state.players[1]],
      };
      const s1 = gameReducer(state, { type: GameActionType.UseGetOutOfJailFree });
      expect(s1.players[0].inJail).toBe(true);
    });
  });

  describe('tax handling', () => {
    it('pays income tax (10% of current money) to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 150);
      expect(s1.freeParkingPot).toBe(150);
      expect(s1.eventLog).toContainEqual({ key: 'event.incomeTax', params: { name: 'Alice', amount: 150, money: STARTING_MONEY } })
    });

    it('income tax ignores property value (10% of money only)', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: state.players.map((p, i) => i === 0 ? { ...p, money: 1000, properties: [1] } : p),
        board: state.board.map((b) => b.id === 1 ? { ...b, owner: 0 } : b),
      };
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(1000 - 100);
      expect(s1.freeParkingPot).toBe(100);
    });

    it('pays flat luxury tax to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 38);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY - 100);
      expect(s1.freeParkingPot).toBe(100);
      expect(s1.eventLog).toContainEqual({ key: 'event.luxuryTax', params: { name: 'Alice', amount: 100 } })
    });

    it('collects free parking jackpot', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 20);
      state = { ...state, phase: GamePhase.Resolving, freeParkingPot: 350, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(STARTING_MONEY + 350);
      expect(s1.freeParkingPot).toBe(0);
    });
  });

  describe('rent - jailed owner collects no rent', () => {
    it('jailed owner does not collect rent', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);

      state = {
        ...state,
        players: [
          state.players[0],
          { ...state.players[1], inJail: true, position: 10 },
        ],
        phase: GamePhase.Resolving,
        dice: [2, 2],
      };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.phase).toBe(GamePhase.Waiting);
      expect(s1.players[0].money).toBe(STARTING_MONEY);
      expect(s1.players[1].money).toBe(STARTING_MONEY - 60);
    });
  });

  describe('RESOLVE_SPACE — edge cases', () => {
    it('unowned property, cannot afford → buy offer shown but disabled', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 1);
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Resolving, dice: [1, 1], players: [{ ...state.players[0], passedGo: true }, state.players[1]] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.phase).toBe(GamePhase.Buying);
      expect(s1.board[1].owner).toBeNull();
      expect(s1.players[0].money).toBe(1);
    });

    it('own property, no money to build → still shows build offer', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = setMoney(state, 0, 5);
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Resolving, dice: [1, 1] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.phase).toBe(GamePhase.Waiting);
      expect(s1.pendingAction).toBeNull();
    });

    it('land on other player railroad → pending pay rent', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 5);
      state = setPosition(state, 0, 5);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.pendingAction?.type).toBe(PendingActionType.PayRent);
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(25);
    });

    it('owns 2 railroads → higher rent pending', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 5);
      state = buyProperty(state, 1, 15);
      state = setPosition(state, 0, 5);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(50);
    });

    it('land on other player utility → pending pay rent', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 12);
      state = setPosition(state, 0, 12);
      state = { ...state, phase: GamePhase.Resolving, dice: [3, 4] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      const expectedRent = (3 + 4) * 4;
      expect(s1.pendingAction?.type).toBe(PendingActionType.PayRent);
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(expectedRent);
    });

    it('both utilities owned → 10x dice roll pending', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 12);
      state = buyProperty(state, 1, 28);
      state = setPosition(state, 0, 12);
      state = { ...state, phase: GamePhase.Resolving, dice: [3, 4] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      const expectedRent = (3 + 4) * 10;
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(expectedRent);
    });

    it('declining to buy → property stays unowned', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 } };

      const s1 = gameReducer(state, { type: GameActionType.DeclineBuy });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.players[0].money).toBe(STARTING_MONEY);
      expect(s1.pendingAction).toBeNull();
    });
  });

  describe('sell house then mortgage', () => {
    it('sell houses to 0 then mortgage works', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 2 } : s)) };

      state = gameReducer(state, { type: GameActionType.SellHouse, spaceId: 1 });
      state = gameReducer(state, { type: GameActionType.SellHouse, spaceId: 1 });
      expect(state.board[1].houses).toBe(0);

      state = gameReducer(state, { type: GameActionType.Mortgage, spaceId: 1 });
      expect(state.board[1].mortgaged).toBe(true);
    });
  });

  describe('unmortgage fails with insufficient funds', () => {
    it('cannot unmortgage if not enough money for 10% interest', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)), players: [{ ...state.players[0], money: 10 }] };

      const s1 = gameReducer(state, { type: GameActionType.Unmortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(true); // still mortgaged
    });
  });

  describe('bankruptcy returns properties clean', () => {
    it('bankrupt → all properties: houses=0, owner=null, mortgaged=false', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 3 } : s)),
      };

      const s1 = gameReducer(state, { type: GameActionType.DeclareBankruptcy });
      expect(s1.board[1].owner).toBeNull();
      expect(s1.board[1].houses).toBe(0);
      expect(s1.board[1].mortgaged).toBe(false);
    });
  });

  describe('three doubles → jail', () => {
    it('three consecutive doubles sends to jail and resets count', () => {
      let state = makeStartedState();
      state = { ...state, phase: GamePhase.Waiting, doublesCount: 2 };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 3] });
      expect(s2.players[0].inJail).toBe(true);
      expect(s2.players[0].position).toBe(10);
      expect(s2.doublesCount).toBe(0);
    });
  });

  describe('forced jail exit position', () => {
    it('forced exit after 3 failures moves to correct position', () => {
      let state = makeStartedState();
      state = {
        ...state,
        players: [{ ...state.players[0], inJail: true, position: 10, jailTurns: 2 }, state.players[1]],
      };

      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [2, 5] });
      expect(s2.players[0].inJail).toBe(false);
      expect(s2.players[0].position).toBe(17); // 10 + 7 = 17
      expect(s2.phase).toBe(GamePhase.Moving);
    });
  });

  describe('event log messages', () => {
    it('buy property produces correct message', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Buying, pendingAction: { type: PendingActionType.BuyProperty, spaceId: 1 } };
      const s1 = gameReducer(state, { type: GameActionType.BuyProperty });
      expect(s1.eventLog).toContainEqual({ key: 'event.bought', params: { name: 'Alice', spaceId: 1, amount: 60 } });
    });

    it('pay rent produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Resolving, pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2 } };
      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.eventLog).toContainEqual({ key: 'event.paidRent', params: { name: 'Alice', amount: 2, owner: 'Bob' } });
    });

    it('build house produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog).toContainEqual({ key: 'event.builtHouse', params: { name: 'Alice', spaceId: 1, amount: 25 } });
    });

    it('build hotel produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)) };
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog).toContainEqual({ key: 'event.builtHotel', params: { name: 'Alice', spaceId: 1, amount: 150 } });
    });

    it('jail entry produces correct message', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 30);
      state = { ...state, phase: GamePhase.Resolving };
      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.eventLog).toContainEqual({ key: 'event.toJail', params: { name: 'Alice' } });
    });

  });
});

describe('trade negotiation', () => {
  function makeSubjects() {
    let state = makeStartedState();
    state = buyProperty(state, 0, 1);
    state = buyProperty(state, 1, 3);
    state = setMoney(state, 0, 2000);
    state = setMoney(state, 1, 2000);
    return state;
  }

  function proposeTradeForId(state: GameState): GameState {
    return gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 50, requestProperties: [3], requestCash: 100 },
    });
  }

  it('stores a proposed offer in the inbox for a human target', () => {
    const state = proposeTradeForId(makeSubjects());
    expect(state.pendingTrades).toHaveLength(1);
    expect(state.pendingTrades[0]).toMatchObject({ id: 0, fromId: 0, toId: 1, offerProperties: [1], offerCash: 50, requestProperties: [3], requestCash: 100 });
    expect(state.nextTradeId).toBe(1);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeProposed', params: { from: 'Alice', to: 'Bob' } });
  });

  it('rejects a proposal whose offered property is not owned by the proposer', () => {
    const state = makeSubjects();
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [3], offerCash: 0, requestProperties: [], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
  });

  it('accept transfers property and cash in both directions and clears the inbox', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.AcceptTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.board[1].owner).toBe(1);
    expect(state.board[3].owner).toBe(0);
    expect(state.players[0].money).toBe(2000 - 50 + 100);
    expect(state.players[1].money).toBe(2000 + 50 - 100);
    expect(state.players[0].properties).toContain(3);
    expect(state.players[0].properties).not.toContain(1);
    expect(state.players[1].properties).toContain(1);
    expect(state.players[1].properties).not.toContain(3);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeAccepted', params: { from: 'Alice', to: 'Bob' } });
  });

  it('reject removes the offer and logs rejection', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.RejectTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
    expect(state.players[0].money).toBe(2000);
    expect(state.board[1].owner).toBe(0);
  });

  it('cancel removes the offer and logs cancellation', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.CancelTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeCancelled', params: { from: 'Alice', to: 'Bob' } });
  });

  it('accept on a stale deal drops it and re-logs as rejected', () => {
    let state = proposeTradeForId(makeSubjects());
    state = gameReducer(state, { type: GameActionType.SellProperty, spaceId: 1 });
    state = gameReducer(state, { type: GameActionType.AcceptTrade, tradeId: 0 });
    expect(state.pendingTrades).toHaveLength(0);
    expect(state.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
  });

  it('resolves a proposal to a bot instantly with an accept', () => {
    let state = makeSubjects();
    state = { ...state, players: state.players.map((p, i) => (i === 1 ? { ...p, isBot: true } : p)) };
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 0, requestProperties: [3], requestCash: 0 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
    expect(s1.eventLog).toContainEqual({ key: 'event.tradeAccepted', params: { from: 'Alice', to: 'Bob' } });
    expect(s1.board[1].owner).toBe(1);
    expect(s1.board[3].owner).toBe(0);
  });

  it('resolves a proposal to a bot instantly with a reject on a losing deal', () => {
    let state = makeSubjects();
    state = { ...state, players: state.players.map((p, i) => (i === 1 ? { ...p, isBot: true } : p)) };
    const s1 = gameReducer(state, {
      type: GameActionType.ProposeTrade,
      offer: { fromId: 0, toId: 1, offerProperties: [1], offerCash: 0, requestProperties: [3], requestCash: 70 },
    });
    expect(s1.pendingTrades).toHaveLength(0);
    expect(s1.eventLog).toContainEqual({ key: 'event.tradeRejected', params: { from: 'Alice', to: 'Bob' } });
    expect(s1.board[1].owner).toBe(0);
    expect(s1.board[3].owner).toBe(1);
  });
});
