import type { GameState } from '../../src/types/game'
import { GamePhase, PendingActionType } from '../../src/types/game'
import { buildWaitingState, type SeedWaitingPlayerSpec } from '../helpers/seed'

export interface ResolvingPayRentOptions {
  players: SeedWaitingPlayerSpec[]
  currentPlayer: number
  spaceId: number
  ownerId: number
  amount: number
  turnOrder?: number[]
}

export function buildResolvingPayRentState(opts: ResolvingPayRentOptions): GameState {
  const base = buildWaitingState({
    players: opts.players,
    currentPlayer: opts.currentPlayer,
    turnOrder: opts.turnOrder,
  })
  return {
    ...base,
    phase: GamePhase.Resolving,
    pendingAction: { type: PendingActionType.PayRent, spaceId: opts.spaceId, amount: opts.amount },
    board: base.board.map((s) => (s.id === opts.spaceId ? { ...s, owner: opts.ownerId } : s)),
    players: base.players.map((p) =>
      p.id === opts.ownerId && !p.properties.includes(opts.spaceId)
        ? { ...p, properties: [...p.properties, opts.spaceId] }
        : p,
    ),
  }
}
