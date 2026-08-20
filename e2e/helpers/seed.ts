import type { GameState, Player } from '../../src/types/game'
import { GamePhase } from '../../src/types/game'
import { INITIAL_BOARD, INITIAL_CHANCE_DECK, INITIAL_COMMUNITY_DECK } from '../fixtures/initial-state'

export async function seedGame(url: string, code: string, state: GameState): Promise<void> {
  const res = await fetch(`${url}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(`seed failed (HTTP ${res.status})${body?.message ? `: ${body.message}` : ''}`)
  }
}

export interface SeedWaitingPlayerSpec {
  id: number
  name: string
  money?: number
  isBot?: boolean
}

export interface SeedWaitingOptions {
  players: SeedWaitingPlayerSpec[]
  currentPlayer: number
  turnOrder?: number[]
}

export function buildWaitingState(opts: SeedWaitingOptions): GameState {
  const players: Player[] = [...opts.players]
    .sort((a, b) => a.id - b.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      money: p.money ?? 1500,
      position: 0,
      properties: [],
      passedGo: true,
      inJail: false,
      jailTurns: 0,
      bankrupt: false,
      getOutOfJailFreeCards: 0,
      isBot: p.isBot ?? false,
      botControlled: false,
      afk: false,
    }))
  return {
    phase: GamePhase.Waiting,
    players,
    turnOrder: opts.turnOrder ?? players.map((p) => p.id),
    currentPlayer: opts.currentPlayer,
    board: INITIAL_BOARD,
    chanceDeck: INITIAL_CHANCE_DECK,
    communityDeck: INITIAL_COMMUNITY_DECK,
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
    tradesEnabled: false,
  }
}

export async function seedWaitingGame(url: string, code: string, opts: SeedWaitingOptions): Promise<void> {
  await seedGame(url, code, buildWaitingState(opts))
}
