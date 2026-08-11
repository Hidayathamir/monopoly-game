import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from '../gameReducer';
import { GamePhase, GameActionType, PendingActionType, type GameState } from '../../types/game';

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
  describe('START_GAME', () => {
    it('creates players with Rp1500000 each', () => {
      const state = makeStartedState(3);
      expect(state.players).toHaveLength(3);
      expect(state.players[0].money).toBe(1500000);
      expect(state.players[1].money).toBe(1500000);
      expect(state.players[2].name).toBe('Charlie');
      expect(state.phase).toBe(GamePhase.Waiting);
      expect(state.currentPlayer).toBe(0);
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

    it('collects Rp200000 when passing GO', () => {
      const state = setPosition(makeStartedState(), 0, 38);
      const s1 = gameReducer(state, { type: GameActionType.RollDice });
      const s2 = gameReducer(s1, { type: GameActionType.DiceAnimated, dice: [3, 4] });
      expect(s2.players[0].position).toBe(5);
      expect(s2.players[0].money).toBe(1700000);
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
          { ...state.players[0], money: 100000 },
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
      expect(s1.players[0].money).toBe(1440000);
      expect(s1.players[0].properties).toContain(1);
      expect(s1.pendingAction).toBeNull();
    });
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
      expect(s1.players[0].money).toBe(1500000);
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
        pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2000 },
      };

      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.players[0].money).toBe(1498000);
      expect(s1.players[1].money).toBe(1500000 - 60000 + 2000);
      expect(s1.phase).toBe(GamePhase.Waiting);
    });

    it('transitions to bankruptcy when cannot pay', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 1000);
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);
      state = {
        ...state,
        phase: GamePhase.Resolving,
        pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2000 },
      };

      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.pendingAction?.type).toBe(PendingActionType.Bankruptcy);
      expect((s1.pendingAction as { amount: number })?.amount).toBe(2000);
    });
  });

  describe('BUILD_HOUSE', () => {
    it('builds a house on owned property', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      state = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(state.board[1].houses).toBe(1);
      expect(state.players[0].money).toBe(1440000 - 50000);
    });

    it('cannot build if not enough money', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 10000);
      state = buyProperty(state, 0, 1);
      state = { ...state, players: [{ ...state.players[0], money: 10000 }] };

      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(0);
    });

    it('builds hotel at 5 houses', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = {
        ...state,
        board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)),
        players: [{ ...state.players[0], money: 1440000 }],
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
    it('sells a house for half price', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 2 } : s)) };

      const s1 = gameReducer(state, { type: GameActionType.SellHouse, spaceId: 1 });
      expect(s1.board[1].houses).toBe(1);
      expect(s1.players[0].money).toBe(1440000 + 25000);
    });
  });

  describe('MORTGAGE', () => {
    it('mortgages property for half price', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);

      const s1 = gameReducer(state, { type: GameActionType.Mortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(true);
      expect(s1.players[0].money).toBe(1440000 + 30000);
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
        players: [{ ...state.players[0], money: 1400000 }],
      };

      const cost = Math.floor(60000 / 2 * 1.1);
      const s1 = gameReducer(state, { type: GameActionType.Unmortgage, spaceId: 1 });
      expect(s1.board[1].mortgaged).toBe(false);
      expect(s1.players[0].money).toBe(1400000 - cost);
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

  describe('tax handling', () => {
    it('pays income tax to free parking', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 4);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(1300000);
      expect(s1.freeParkingPot).toBe(200000);
    });

    it('collects free parking jackpot', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 20);
      state = { ...state, phase: GamePhase.Resolving, freeParkingPot: 350000, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.players[0].money).toBe(1850000);
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
      expect(s1.players[0].money).toBe(1500000);
      expect(s1.players[1].money).toBe(1440000);
    });
  });

  describe('RESOLVE_SPACE — edge cases', () => {
    it('unowned property, cannot afford → no buy offer', () => {
      let state = makeStartedState();
      state = setMoney(state, 0, 1000);
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Resolving, dice: [1, 1] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.phase).toBe(GamePhase.Waiting);
      expect(s1.board[1].owner).toBeNull();
      expect(s1.players[0].money).toBe(1000);
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
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(25000);
    });

    it('owns 2 railroads → higher rent pending', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 5);
      state = buyProperty(state, 1, 15);
      state = setPosition(state, 0, 5);
      state = { ...state, phase: GamePhase.Resolving, dice: [2, 2] };

      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect((s1.pendingAction as Record<string, unknown>)?.amount).toBe(50000);
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
      expect(s1.players[0].money).toBe(1500000);
      expect(s1.pendingAction).toBeNull();
    });
  });

  describe('sell house then mortgage', () => {
    it('sell houses to 0 then mortgage works', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 2 } : s)), players: [{ ...state.players[0], money: 1340000 }] };

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
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, mortgaged: true } : s)), players: [{ ...state.players[0], money: 10000 }] };

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
      expect(s1.eventLog).toContain('Alice membeli Cirebon seharga Rp60K');
    });

    it('pay rent produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 1, 1);
      state = setPosition(state, 0, 1);
      state = { ...state, phase: GamePhase.Resolving, pendingAction: { type: PendingActionType.PayRent, spaceId: 1, amount: 2000 } };
      const s1 = gameReducer(state, { type: GameActionType.PayRent });
      expect(s1.eventLog.some((e) => e.includes('membayar sewa') && e.includes('2K'))).toBe(true);
    });

    it('build house produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, players: [{ ...state.players[0], money: 1440000 }] };
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog.some((e) => e.includes('membangun') && e.includes('Cirebon'))).toBe(true);
    });

    it('build hotel produces correct message', () => {
      let state = makeStartedState();
      state = buyProperty(state, 0, 1);
      state = { ...state, board: state.board.map((s) => (s.id === 1 ? { ...s, houses: 4 } : s)), players: [{ ...state.players[0], money: 1440000 }] };
      const s1 = gameReducer(state, { type: GameActionType.BuildHouse, spaceId: 1 });
      expect(s1.eventLog.some((e) => e.includes('Hotel'))).toBe(true);
    });

    it('jail entry produces correct message', () => {
      let state = makeStartedState();
      state = setPosition(state, 0, 30);
      state = { ...state, phase: GamePhase.Resolving };
      const s1 = gameReducer(state, { type: GameActionType.ResolveSpace });
      expect(s1.eventLog.some((e) => e.includes('masuk Penjara'))).toBe(true);
    });
  });
});
