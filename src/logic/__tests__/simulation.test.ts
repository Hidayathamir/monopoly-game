import { describe, it, expect } from 'vitest';
import { gameReducer, createInitialState } from '../gameReducer';
import { GamePhase, GameActionType, PendingActionType, type GameState } from '../../types/game';

function randomDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

function simulateTurn(state: GameState): GameState {
  if (state.phase === GamePhase.GameOver) return state;

  let s = state;

  s = gameReducer(s, { type: GameActionType.RollDice });
  const dice = randomDice();
  s = gameReducer(s, { type: GameActionType.DiceAnimated, dice });

  s = gameReducer(s, { type: GameActionType.ResolveSpace });

  s = handlePendingActions(s);

  s = gameReducer(s, { type: GameActionType.EndTurn });

  return s;
}

function handlePendingActions(state: GameState): GameState {
  let s = state;

  for (let safety = 0; safety < 20; safety++) {
    const pending = s.pendingAction;
    if (!pending) break;

    switch (pending.type) {
      case PendingActionType.BuyProperty:
        if (s.players[s.currentPlayer].money >= (s.board[pending.spaceId].price ?? 0) + 100000) {
          s = gameReducer(s, { type: GameActionType.BuyProperty });
        } else {
          s = gameReducer(s, { type: GameActionType.DeclineBuy });
        }
        break;

      case PendingActionType.PayRent:
        if (s.players[s.currentPlayer].money >= pending.amount) {
          s = gameReducer(s, { type: GameActionType.PayRent });
        } else {
          const ownedProps = s.board.filter(
            (sp) => sp.owner === s.currentPlayer && !sp.mortgaged
          );

          for (const prop of ownedProps) {
            while (prop.houses > 0 && s.players[s.currentPlayer].money < pending.amount) {
              s = gameReducer(s, { type: GameActionType.SellHouse, spaceId: prop.id });
              prop.houses--;
            }
          }

          for (const prop of ownedProps) {
            if (prop.houses === 0 && !prop.mortgaged && s.players[s.currentPlayer].money < pending.amount) {
              s = gameReducer(s, { type: GameActionType.Mortgage, spaceId: prop.id });
            }
          }

          if (s.players[s.currentPlayer].money >= pending.amount) {
            s = gameReducer(s, { type: GameActionType.PayRent });
          } else {
            s = gameReducer(s, { type: GameActionType.DeclareBankruptcy });
          }
        }
        break;

      case PendingActionType.DrawCard:
        s = gameReducer(s, { type: GameActionType.DrawCard });
        break;

      case PendingActionType.CardEffect:
        s = gameReducer(s, { type: GameActionType.ResolveCard });
        if (s.phase === GamePhase.Resolving && !s.pendingAction) {
          s = gameReducer(s, { type: GameActionType.ResolveSpace });
        }
        break;

      case PendingActionType.Bankruptcy:
        s = gameReducer(s, { type: GameActionType.DeclareBankruptcy });
        break;

      default:
        s = gameReducer(s, { type: GameActionType.SkipAction });
        break;
    }

    if (s.phase === GamePhase.GameOver) break;
  }

  return s;
}

describe('Full Game Simulation', () => {
  it('3-player game survives many turns without crashing', () => {
    let state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 3,
      names: ['Alice', 'Bob', 'Charlie'],
    });

    let turns = 0;
    const maxTurns = 5000;

    while (state.phase !== GamePhase.GameOver && turns < maxTurns) {
      state = simulateTurn(state);
      turns++;
    }

    const winner = state.players.find((p) => !p.bankrupt);
    console.log(`Game finished in ${turns} turns`);
    console.log(
      `Winner: ${winner?.name || 'unknown'}, Rp${winner?.money || 0}`
    );
    console.log(
      `Survivors: ${state.players.filter(p => !p.bankrupt).map(p => p.name).join(', ') || 'none'}`
    );

    expect(state.players.every(p => p.money !== undefined)).toBe(true);
  }, 60000);

  it('4-player game survives many turns without crashing', () => {
    let state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 4,
      names: ['Alice', 'Bob', 'Charlie', 'Diana'],
    });

    let turns = 0;
    const maxTurns = 5000;

    while (state.phase !== GamePhase.GameOver && turns < maxTurns) {
      state = simulateTurn(state);
      turns++;
    }

    console.log(`4-player game: ${turns} turns`);
    expect(state.players.every(p => p.money !== undefined)).toBe(true);
  }, 60000);

  it('2-player game survives many turns without crashing', () => {
    let state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Alice', 'Bob'],
    });

    let turns = 0;
    const maxTurns = 5000;

    while (state.phase !== GamePhase.GameOver && turns < maxTurns) {
      state = simulateTurn(state);
      turns++;
    }

    console.log(`2-player game: ${turns} turns`);
    expect(state.players.every(p => p.money !== undefined)).toBe(true);
  }, 60000);

  it('each space type resolves without crashing', () => {
    let state = gameReducer(createInitialState(), {
      type: GameActionType.StartGame,
      playerCount: 2,
      names: ['Test', 'Bot'],
    });

    for (let pos = 0; pos < 40; pos++) {
      state = {
        ...state,
        phase: GamePhase.Waiting,
        players: [
          { ...state.players[0], position: pos },
          state.players[1],
        ],
        dice: [1, 1],
        pendingAction: null,
      };

      state = gameReducer(state, { type: GameActionType.ResolveSpace });
      state = handlePendingActions(state);

      expect(state.players[0].bankrupt !== undefined).toBe(true);
    }
  });
});
