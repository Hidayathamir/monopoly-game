import type { GameState, GameAction } from './game'

export type LobbyPlayer = { id: number; name: string | null; connected: boolean }

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'start' }
  | { type: 'action'; action: GameAction }

export type ServerMessage =
  | { type: 'welcome'; playerId: number; players: LobbyPlayer[]; state: GameState }
  | { type: 'lobby'; players: LobbyPlayer[] }
  | { type: 'state'; state: GameState }
  | { type: 'error'; message: string }
