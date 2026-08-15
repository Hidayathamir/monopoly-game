import type { GameState, GameAction } from './game'

export type LobbyPlayer = { id: number; name: string | null; connected: boolean; isBot: boolean }

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'start' }
  | { type: 'leave' }
  | { type: 'addBot' }
  | { type: 'removeBot'; playerId: number }
  | { type: 'action'; action: GameAction }

export type ServerMessage =
  | { type: 'welcome'; playerId: number; hostPlayerId: number; players: LobbyPlayer[]; state: GameState; code: string }
  | { type: 'lobby'; players: LobbyPlayer[]; hostPlayerId: number }
  | { type: 'state'; state: GameState }
  | { type: 'left' }
  | { type: 'error'; message: string }
